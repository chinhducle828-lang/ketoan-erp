import express from 'express';
import { pool } from '../config/db.js';
import { buildAccountingEntries } from '../services/logistics.service.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { canAccessCompany } from '../services/helpers.js';

const router = express.Router();
const LOGISTICS_ALLOWED_ROLES = ['admin', 'ktt', 'nv', 'nv_kho', 'nv_banhang'];

const ensureCompanyAccess = async (req, companyId) => {
  if (!companyId) return { ok: false, message: 'Thiếu company_id' };
  if (req.user.role === 'admin') return { ok: true };
  const hasAccess = await canAccessCompany(req.user, companyId);
  if (!hasAccess) return { ok: false, message: 'Không có quyền truy cập doanh nghiệp này' };
  return { ok: true };
};

router.get('/queue', authenticate, requireRole(LOGISTICS_ALLOWED_ROLES), async (req, res) => {
  try {
    const companyId = req.query.company_id || req.query.companyId;
    const access = await ensureCompanyAccess(req, companyId);
    if (!access.ok) return res.status(403).json({ error: access.message });

    const { rows } = await pool.query(
      `SELECT v.id, v.voucher_number, v.description, v.voucher_date, v.loading_status, v.truck_id
       FROM vouchers v
       WHERE v.company_id = $1 AND v.voucher_type = 'XK' AND v.loading_status = 'pending_loading'
       ORDER BY v.voucher_date DESC, v.id DESC`,
      [companyId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/queue-details', authenticate, requireRole(LOGISTICS_ALLOWED_ROLES), async (req, res) => {
  try {
    const companyId = req.query.company_id || req.query.companyId;
    const statusFilter = (req.query.status || 'all').toString().trim();
    const access = await ensureCompanyAccess(req, companyId);
    if (!access.ok) return res.status(403).json({ error: access.message });

    const allowedStatuses = ['pending_loading', 'assigned', 'delivering', 'completed'];
    const useAllStatuses = statusFilter === 'all' || !statusFilter;
    const statuses = useAllStatuses
      ? allowedStatuses
      : statusFilter
          .split(',')
          .map((s) => s.trim())
          .filter((s) => allowedStatuses.includes(s));

    if (statuses.length === 0) {
      return res.status(400).json({ error: 'Bộ lọc trạng thái không hợp lệ' });
    }

    const { rows } = await pool.query(
      `SELECT v.id,
              v.voucher_number,
              v.description,
              v.voucher_date,
              v.loading_status,
              v.created_at,
              COALESCE(vd.quantity, 0) AS quantity,
              COALESCE(i.code, '') AS item_code,
              COALESCE(i.name, '') AS item_name,
              COALESCE(i.unit, '') AS item_unit,
              i.id AS item_id
       FROM vouchers v
       LEFT JOIN voucher_details vd
              ON vd.voucher_id = v.id
             AND vd.entry_type = 'CR'
             AND vd.item_id IS NOT NULL
             AND COALESCE(vd.quantity, 0) > 0
       LEFT JOIN items i ON i.id = vd.item_id
       WHERE v.company_id = $1
         AND v.voucher_type = 'XK'
         AND v.loading_status = ANY($2::text[])
       ORDER BY v.voucher_date DESC, v.id DESC, i.code ASC`,
      [companyId, statuses]
    );

    const ordersMap = new Map();
    for (const row of rows) {
      const voucherId = Number(row.id);
      if (!ordersMap.has(voucherId)) {
        ordersMap.set(voucherId, {
          id: voucherId,
          voucher_number: row.voucher_number,
          description: row.description,
          voucher_date: row.voucher_date,
          loading_status: row.loading_status,
          lines: [],
          total_quantity: 0
        });
      }

      if (row.item_id) {
        const qty = Number(row.quantity || 0);
        const order = ordersMap.get(voucherId);
        order.lines.push({
          item_id: Number(row.item_id),
          item_code: row.item_code,
          item_name: row.item_name,
          item_unit: row.item_unit,
          quantity: qty
        });
        order.total_quantity += qty;
      }
    }

    res.json(Array.from(ordersMap.values()));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/mark-completed', authenticate, requireRole(['admin', 'ktt', 'nv', 'nv_kho']), async (req, res) => {
  try {
    const { companyId, voucherId } = req.body;
    if (!companyId || !voucherId) return res.status(400).json({ error: 'Thiếu thông tin đơn xuất kho' });

    const access = await ensureCompanyAccess(req, companyId);
    if (!access.ok) return res.status(403).json({ error: access.message });

    const rs = await pool.query(
      `UPDATE vouchers
       SET loading_status = 'completed'
       WHERE id = $1
         AND company_id = $2
         AND voucher_type = 'XK'
         AND loading_status <> 'completed'
       RETURNING id, voucher_number, loading_status`,
      [voucherId, companyId]
    );

    if (rs.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy đơn cần hoàn thành hoặc đơn đã hoàn thành trước đó.' });
    }

    res.json({ success: true, order: rs.rows[0], message: 'Đơn hàng đã được xác nhận hoàn thành xuất kho.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/assign-truck', authenticate, requireRole(LOGISTICS_ALLOWED_ROLES), async (req, res) => {
  try {
    const { companyId, voucherId, truckId } = req.body;
    if (!companyId || !voucherId || !truckId) return res.status(400).json({ error: 'Thiếu thông tin' });

    const access = await ensureCompanyAccess(req, companyId);
    if (!access.ok) return res.status(403).json({ error: access.message });

    await pool.query('UPDATE vouchers SET truck_id = $1, loading_status = $2 WHERE id = $3 AND company_id = $4', [truckId, 'assigned', voucherId, companyId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/confirm-loaded', authenticate, requireRole(LOGISTICS_ALLOWED_ROLES), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { companyId, voucherId, amount, costAmount, taxAmount = 0 } = req.body;

    if (!companyId || !voucherId) return res.status(400).json({ error: 'Thiếu voucherId' });

    const access = await ensureCompanyAccess(req, companyId);
    if (!access.ok) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: access.message });
    }

    const entries = buildAccountingEntries({ amount, costAmount, taxAmount });

    await client.query(
      `UPDATE vouchers SET loading_status = 'delivering' WHERE id = $1 AND company_id = $2`,
      [voucherId, companyId]
    );

    for (const entry of entries) {
      await client.query(
        `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount)
         VALUES ($1, $2, $3, $4)`,
        [voucherId, entry.accountCode, entry.entryType, entry.amount]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

export default router;
