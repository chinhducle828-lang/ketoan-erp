/**
 * Refund Requests Routes
 * 
 * Quản lý yêu cầu hoàn tiền và hủy gói
 * - NĐ 248/2026/NĐ-CP Điều 14: Chính sách hoàn tiền & hủy gói
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import express from 'express';
import { pool } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { canAccessCompany } from '../services/helpers.js';
import { logAction, getClientIp } from '../services/auditLog.service.js';

const router = express.Router();

/**
 * Tạo yêu cầu hoàn tiền
 * POST /api/refunds
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { company_id, voucher_id, amount, reason } = req.body;
    if (!company_id || !amount || !reason) {
      return res.status(400).json({ error: 'Thiếu thông tin yêu cầu hoàn tiền' });
    }

    const hasAccess = await canAccessCompany(req.user, Number(company_id));
    if (!hasAccess) {
      return res.status(403).json({ error: 'Không có quyền truy cập công ty này' });
    }

    const result = await pool.query(
      `INSERT INTO refund_requests (company_id, user_id, voucher_id, amount, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [company_id, req.user.id, voucher_id || null, amount, reason]
    );

    // Audit log
    try {
      await logAction({
        userId: req.user.id,
        action: 'REFUND_REQUEST_CREATED',
        entityType: 'REFUND_REQUESTS',
        entityId: result.rows[0].id,
        newValues: { company_id, amount, reason },
        ipAddress: getClientIp(req)
      });
    } catch (e) {
      console.warn('Audit log error:', e.message);
    }

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Lấy danh sách yêu cầu hoàn tiền của công ty
 * GET /api/refunds
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.query.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu company_id' });
    }

    const hasAccess = await canAccessCompany(req.user, Number(companyId));
    if (!hasAccess) {
      return res.status(403).json({ error: 'Không có quyền truy cập' });
    }

    const result = await pool.query(
      'SELECT * FROM refund_requests WHERE company_id = $1 ORDER BY created_at DESC',
      [companyId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Duyệt yêu cầu hoàn tiền
 * POST /api/refunds/:id/approve
 */
router.post('/:id/approve', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const refundId = parseInt(req.params.id, 10);
    const { status } = req.body; // 'approved' | 'rejected'

    const refund = await pool.query('SELECT * FROM refund_requests WHERE id = $1 LIMIT 1', [refundId]);
    if (refund.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy yêu cầu hoàn tiền' });
    }

    await pool.query(
      `UPDATE refund_requests
       SET status = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [status || 'approved', req.user.id, refundId]
    );

    // Audit log
    try {
      await logAction({
        userId: req.user.id,
        action: `REFUND_REQUEST_${(status !== 'rejected' ? 'APPROVED' : 'REJECTED')}`,
        entityType: 'REFUND_REQUESTS',
        entityId: refundId,
        oldValues: { status: refund.rows[0].status },
        newValues: { status: status || 'approved' },
        ipAddress: getClientIp(req)
      });
    } catch (e) {
      console.warn('Audit log error:', e.message);
    }

    res.json({ success: true, message: `Đã ${status === 'rejected' ? 'từ chối' : 'duyệt'} yêu cầu hoàn tiền` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { router as refundsRouter };
export default router;