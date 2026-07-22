/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import express from 'express';
import { pool } from '../config/db.js';
import { authenticate, requireRole, checkCompanyAccess } from '../middleware/auth.js';
import { invalidateCache } from '../cache/redis.js';
// BỔ SUNG LOGIC: Nạp hàm quản lý xóa bộ đệm RAM kết xuất kế toán dồn tích
import { invalidateCompanyCache } from '../controllers/erpController.js';
// BỔ SUNG LOGIC: Nạp hàm ghi audit log
import { logAction, getClientIp } from '../services/auditLog.service.js';

const router = express.Router();

const normalizeCompanyId = (companyId) => {
  if (Array.isArray(companyId)) return companyId[0];
  return companyId;
};

// 1. API lấy số dư đầu kỳ
router.get('/', authenticate, requireRole(['admin', 'ktt']), checkCompanyAccess, async (req, res) => {
  try {
    const targetCompanyId = normalizeCompanyId(req.query.company_id);
    const fiscalYear = req.query.year ? Number(req.query.year) : 2026;

    const result = await pool.query(
      `SELECT 
        ob.account_code,
        ob.opening_debit,
        ob.opening_credit,
        ob.fiscal_year,
        ob.partner_id,
        p.partner_name,
        p.partner_code
      FROM opening_balances ob
      LEFT JOIN partners p ON ob.partner_id = p.id
      WHERE ob.company_id = $1 AND ob.fiscal_year = $2
      ORDER BY ob.account_code`,
      [targetCompanyId, fiscalYear]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. API cập nhật số dư đầu kỳ lịch sử (FIX: Wrap trong transaction để đảm bảo atomicity)
router.post('/', authenticate, requireRole(['admin', 'ktt']), checkCompanyAccess, async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('[openingBalances] POST request received:', {
      body: req.body,
      query: req.query,
      user: req.user?.id,
      companyId: req.body.companyId || req.query.company_id
    });
    
    const targetCompanyId = normalizeCompanyId(req.body.companyId || req.query.company_id);
    const { accountCode, debitBalance, creditBalance, fiscalYear, partnerId } = req.body;
    const finalYear = fiscalYear ? Number(fiscalYear) : 2026;

    await client.query('BEGIN');

    // Kiểm tra chốt chặn an toàn dữ liệu khóa sổ (FIX: Check tất cả records của fiscal year)
    const yearLockCheck = await client.query(
      'SELECT is_locked FROM opening_balances WHERE company_id = $1 AND fiscal_year = $2 LIMIT 1',
      [targetCompanyId, finalYear]
    );
    if (yearLockCheck.rows.length > 0 && yearLockCheck.rows[0].is_locked) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Số liệu năm ${finalYear} đã khóa sổ, cấm sửa đổi!` });
    }

    // Cập nhật câu lệnh INSERT để hỗ trợ partner_id
    console.log('[openingBalances] Executing UPSERT:', {
      company_id: targetCompanyId,
      account_code: accountCode,
      opening_debit: debitBalance || 0,
      opening_credit: creditBalance || 0,
      fiscal_year: finalYear,
      partner_id: partnerId || null
    });
    
    await client.query(
      `INSERT INTO opening_balances (company_id, account_code, opening_debit, opening_credit, fiscal_year, partner_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ON CONSTRAINT unique_opening_balance 
       DO UPDATE SET opening_debit = EXCLUDED.opening_debit, opening_credit = EXCLUDED.opening_credit`,
      [targetCompanyId, accountCode, debitBalance || 0, creditBalance || 0, finalYear, partnerId || null]
    );
    
    console.log('[openingBalances] UPSERT successful');

    // Ghi audit log cho thao tác tạo/cập nhật số dư đầu kỳ
    await logAction({
      userId: req.user?.id || null,
      action: 'UPSERT',
      entityType: 'OPENING_BALANCES',
      oldValues: null, // UPSERT không có old values
      newValues: {
        company_id: targetCompanyId,
        account_code: accountCode,
        opening_debit: debitBalance || 0,
        opening_credit: creditBalance || 0,
        fiscal_year: finalYear,
        partner_id: partnerId || null
      },
      ipAddress: getClientIp(req),
      companyId: targetCompanyId
    });

    // ĐỒNG BỤ HOÀN TOÀN: Hủy cache dòng tiền và cache báo cáo động
    invalidateCompanyCache(targetCompanyId);
    await invalidateCache(`dashboard:cashflow:${targetCompanyId}:*`);

    await client.query('COMMIT');

    res.json({ success: true, message: 'Cập nhật số dư thành công!' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[openingBalances] ERROR saving balance:', {
      error: err.message,
      stack: err.stack,
      body: req.body,
      companyId: req.body.companyId || req.query.company_id
    });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 2. API Khóa / Mở khóa sổ số dư đầu kỳ (FIX: Thêm audit log)
router.post('/toggle-lock', authenticate, requireRole(['admin', 'ktt']), checkCompanyAccess, async (req, res) => {
  try {
    const targetCompanyId = normalizeCompanyId(req.query.company_id);
    const { lockStatus, fiscalYear } = req.body;
    const finalYear = fiscalYear ? Number(fiscalYear) : 2026;

    await pool.query(
      'UPDATE opening_balances SET is_locked = $1 WHERE company_id = $2 AND fiscal_year = $3',
      [lockStatus, targetCompanyId, finalYear]
    );

    // Ghi audit log cho thao tác khóa/mở khóa sổ
    await logAction({
      userId: req.user?.id || null,
      action: lockStatus ? 'LOCK' : 'UNLOCK',
      entityType: 'OPENING_BALANCES',
      oldValues: null,
      newValues: {
        company_id: targetCompanyId,
        fiscal_year: finalYear,
        is_locked: lockStatus
      },
      ipAddress: getClientIp(req),
      companyId: targetCompanyId
    });

    // Kích hoạt dọn dẹp cache
    invalidateCompanyCache(targetCompanyId);

    res.json({ success: true, message: 'Thay đổi trạng thái khóa sổ thành công!' });
  } catch (err) { 
    console.error('[openingBalances] ERROR toggling lock:', err);
    res.status(500).json({ error: err.message }); 
  }
});

export { router as openingBalancesRouter };