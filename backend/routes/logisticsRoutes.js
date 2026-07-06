import express from 'express';
import { pool } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { canAccessCompany } from '../services/helpers.js';
import {
  ensureStorefrontRealtimeListener,
  publishStorefrontOrderEvent,
  registerStorefrontStreamClient
} from '../services/storefrontRealtime.service.js';
import { getLogisticsRules } from '../config/businessRules.js';
import { sendToUser } from '../services/webPush.service.js';

const router = express.Router();
const LOGISTICS_ALLOWED_ROLES = ['admin', 'ktt', 'nv', 'nv_kho', 'nv_banhang'];
ensureStorefrontRealtimeListener();

// Get sale voucher type from rules (with fallback)
const getSaleVoucherType = () => {
  const rules = getLogisticsRules();
  return String(rules.saleVoucherType || 'XK').trim() || 'XK';
};

const ensureCompanyAccess = async (req, companyId) => {
  if (!companyId) return { ok: false, message: 'Thiếu company_id' };
  if (req.user.role === 'admin') return { ok: true };
  const hasAccess = await canAccessCompany(req.user, companyId);
  if (!hasAccess) return { ok: false, message: 'Không có quyền truy cập doanh nghiệp này' };
  return { ok: true };
};

const transitionVoucherStatus = async ({ db, voucherId, companyId, fromStatus, toStatus, patch = {} }) => {
  const saleVoucherType = getSaleVoucherType();
  const patchKeys = Object.keys(patch);
  const patchSql = patchKeys.map((key, idx) => `${key} = $${idx + 1}`).join(', ');
  const values = patchKeys.map((key) => patch[key]);
  const updateBaseIndex = values.length;

  const updateQuery = `
    UPDATE vouchers
    SET ${patchSql ? `${patchSql}, ` : ''}loading_status = $${updateBaseIndex + 1}
    WHERE id = $${updateBaseIndex + 2}
      AND company_id = $${updateBaseIndex + 3}
      AND voucher_type = $${updateBaseIndex + 4}
      AND loading_status = $${updateBaseIndex + 5}
    RETURNING id, voucher_number, loading_status
  `;

  const rs = await db.query(updateQuery, [...values, toStatus, voucherId, companyId, saleVoucherType, fromStatus]);
  if (rs.rows.length > 0) {
    return { ok: true, row: rs.rows[0] };
  }

  const statusRes = await db.query(
    `SELECT id, voucher_number, loading_status
     FROM vouchers
     WHERE id = $1 AND company_id = $2 AND voucher_type = $3
     LIMIT 1`,
    [voucherId, companyId, saleVoucherType]
  );

  if (statusRes.rows.length === 0) {
    return { ok: false, notFound: true };
  }

  return {
    ok: false,
    notFound: false,
    currentStatus: statusRes.rows[0].loading_status,
    voucherNumber: statusRes.rows[0].voucher_number
  };
};

router.get('/queue', authenticate, requireRole(LOGISTICS_ALLOWED_ROLES), async (req, res) => {
  try {
    const companyId = req.query.company_id || req.query.companyId;
    const access = await ensureCompanyAccess(req, companyId);
    if (!access.ok) return res.status(403).json({ error: access.message });

    const saleVoucherType = getSaleVoucherType();
    const { rows } = await pool.query(
      `SELECT v.id, v.voucher_number, v.description, v.voucher_date, v.loading_status, v.truck_id
       FROM vouchers v
       WHERE v.company_id = $1 AND v.voucher_type = $2 AND v.loading_status = 'pending_loading'
       ORDER BY v.voucher_date DESC, v.id DESC`,
      [companyId, saleVoucherType]
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

    const saleVoucherType = getSaleVoucherType();
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
         AND v.voucher_type = $2
         AND v.loading_status = ANY($3::text[])
       ORDER BY v.voucher_date DESC, v.id DESC, i.code ASC`,
      [companyId, saleVoucherType, statuses]
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

router.get('/stream', authenticate, requireRole(LOGISTICS_ALLOWED_ROLES), async (req, res) => {
  try {
    const companyId = req.query.company_id || req.query.companyId;
    const access = await ensureCompanyAccess(req, companyId);
    if (!access.ok) return res.status(403).json({ error: access.message });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    const unregister = registerStorefrontStreamClient({
      companyId: Number(companyId),
      res,
      role: req.user?.storefront_role || req.user?.role || 'all'
    });

    const keepAlive = setInterval(() => {
      try {
        res.write(': keep-alive\n\n');
      } catch {
        // Ignore closed streams.
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(keepAlive);
      unregister();
    });
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

    const transition = await transitionVoucherStatus({
      db: pool,
      voucherId,
      companyId,
      fromStatus: 'delivering',
      toStatus: 'completed'
    });

    if (!transition.ok) {
      if (transition.notFound) {
        return res.status(404).json({ error: 'Không tìm thấy đơn xuất kho.' });
      }
      return res.status(409).json({
        error: `Không thể hoàn thành đơn ở trạng thái hiện tại (${transition.currentStatus || 'unknown'}). Chỉ đơn đang giao mới được hoàn thành.`
      });
    }

    // Send notification (non-blocking)
    try {
      // Get order creator
      const voucher = await pool.query('SELECT created_by FROM vouchers WHERE id = $1', [voucherId]);
      if (voucher.rows[0]?.created_by) {
        const notification = {
          id: voucherId,
          type: 'logistics',
          title: 'Cập nhật trạng thái đơn hàng',
          message: `Đơn ${transition.row.voucher_number} đã chuyển sang trạng thái: Hoàn thành`
        };
        
        await sendToUser(voucher.rows[0].created_by, notification);
      }
    } catch (notifyError) {
      console.warn('Push notification failed:', notifyError.message);
    }

    await publishStorefrontOrderEvent(pool, {
      event: 'logistics_status_changed',
      companyId: Number(companyId),
      voucherId: Number(voucherId),
      voucherNumber: transition.row.voucher_number,
      loadingStatus: transition.row.loading_status,
      targetRoles: ['admin', 'nv_banhang', 'nv_kho']
    });

    res.json({ success: true, order: transition.row, message: 'Đơn hàng đã được xác nhận hoàn thành xuất kho.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/assign-truck', authenticate, requireRole(LOGISTICS_ALLOWED_ROLES), async (req, res) => {
  try {
    const { companyId, voucherId, truckId } = req.body;
    if (!companyId || !voucherId) return res.status(400).json({ error: 'Thiếu thông tin' });

    const access = await ensureCompanyAccess(req, companyId);
    if (!access.ok) return res.status(403).json({ error: access.message });

    const transition = await transitionVoucherStatus({
      db: pool,
      voucherId,
      companyId,
      fromStatus: 'pending_loading',
      toStatus: 'assigned',
      patch: Number.isFinite(Number(truckId)) && Number(truckId) > 0 ? { truck_id: Number(truckId) } : {}
    });

    if (!transition.ok) {
      if (transition.notFound) {
        return res.status(404).json({ error: 'Không tìm thấy đơn xuất kho.' });
      }
      return res.status(409).json({
        error: `Không thể phân xe khi đơn đang ở trạng thái ${transition.currentStatus || 'unknown'}.`
      });
    }

    // Send notification (non-blocking)
    try {
      const voucher = await pool.query('SELECT created_by FROM vouchers WHERE id = $1', [voucherId]);
      if (voucher.rows[0]?.created_by) {
        const notification = {
          id: voucherId,
          type: 'logistics',
          title: 'Đơn hàng đã được phân xe',
          message: `Đơn ${transition.row.voucher_number} đã được phân xe vận chuyển`
        };
        
        await sendToUser(voucher.rows[0].created_by, notification);
      }
    } catch (notifyError) {
      console.warn('Push notification failed:', notifyError.message);
    }

    await publishStorefrontOrderEvent(pool, {
      event: 'logistics_status_changed',
      companyId: Number(companyId),
      voucherId: Number(voucherId),
      voucherNumber: transition.row.voucher_number,
      loadingStatus: transition.row.loading_status,
      targetRoles: ['admin', 'nv_banhang', 'nv_kho']
    });

    res.json({ success: true, order: transition.row });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/confirm-loaded', authenticate, requireRole(LOGISTICS_ALLOWED_ROLES), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { companyId, voucherId } = req.body;

    if (!companyId || !voucherId) return res.status(400).json({ error: 'Thiếu voucherId' });

    const access = await ensureCompanyAccess(req, companyId);
    if (!access.ok) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: access.message });
    }

    const transition = await transitionVoucherStatus({
      db: client,
      voucherId,
      companyId,
      fromStatus: 'assigned',
      toStatus: 'delivering'
    });

    if (!transition.ok) {
      await client.query('ROLLBACK');
      if (transition.notFound) {
        return res.status(404).json({ error: 'Không tìm thấy đơn xuất kho.' });
      }
      return res.status(409).json({
        error: `Không thể xác nhận đã bốc hàng khi đơn đang ở trạng thái ${transition.currentStatus || 'unknown'}.`
      });
    }

    await client.query('COMMIT');

    // Send notification (non-blocking)
    try {
      const voucher = await pool.query('SELECT created_by FROM vouchers WHERE id = $1', [voucherId]);
      if (voucher.rows[0]?.created_by) {
        const notification = {
          id: voucherId,
          type: 'logistics',
          title: 'Đơn hàng đang giao',
          message: `Đơn ${transition.row.voucher_number} đã bốc hàng và đang giao`
        };
        
        await sendToUser(voucher.rows[0].created_by, notification);
      }
    } catch (notifyError) {
      console.warn('Push notification failed:', notifyError.message);
    }

    await publishStorefrontOrderEvent(pool, {
      event: 'logistics_status_changed',
      companyId: Number(companyId),
      voucherId: Number(voucherId),
      voucherNumber: transition.row.voucher_number,
      loadingStatus: transition.row.loading_status,
      targetRoles: ['admin', 'nv_banhang', 'nv_kho']
    });

    res.json({ success: true, order: transition.row });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

export default router;
