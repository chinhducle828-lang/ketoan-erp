  /**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import express from 'express';
import { pool } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { canAccessCompany, hashToken } from '../services/helpers.js';
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
              COALESCE(i.id::text, vd.item_id::text) AS item_id
       FROM vouchers v
       LEFT JOIN voucher_details vd
              ON vd.voucher_id = v.id
             AND vd.entry_type = 'CR'
             AND vd.item_id IS NOT NULL
             AND COALESCE(vd.quantity, 0) > 0
       LEFT JOIN items i ON i.id::text = vd.item_id::text
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
        const numericItemId = Number(row.item_id);
        const normalizedItemId = Number.isFinite(numericItemId) ? numericItemId : String(row.item_id);
        const order = ordersMap.get(voucherId);
        order.lines.push({
          item_id: normalizedItemId,
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

// Custom auth for SSE stream - EventSource cannot send Authorization header, so we accept token from query params OR cookies
router.get('/stream', async (req, res) => {
  try {
    const token = req.query.access_token;
    const queryCompanyId = req.query.company_id || req.query.companyId;
    
    // Try to get token from query params first, then fall back to cookies
    let finalToken = token;
    let payload = null;
    let isTokenExpired = false;
    
    if (finalToken) {
      // Verify JWT token from query param - SSE streams need long-lived connections, so accept expired tokens
      // if a valid session exists in the database. This prevents frequent disconnects.
      const jwt = await import('jsonwebtoken');
      
      try {
        payload = jwt.default.verify(finalToken, process.env.JWT_SECRET);
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          isTokenExpired = true;
          // Decode without verification to read payload for session lookup
          payload = jwt.default.decode(finalToken);
        } else {
          return res.status(401).json({ error: 'Invalid token' });
        }
      }
      
      if (!payload || !payload.id) {
        return res.status(401).json({ error: 'Invalid token payload' });
      }
      
      // For SSE streams: if token is expired, validate against DB session instead
      if (isTokenExpired) {
        const sessionCheck = await pool.query(
          'SELECT id, user_id FROM sessions WHERE token = $1 AND user_id = $2 AND (expires_at IS NULL OR expires_at > now()) LIMIT 1',
          [hashToken(finalToken), payload.id]
        );
        
        if (sessionCheck.rows.length === 0) {
          return res.status(401).json({ error: 'Phiên đã hết hạn. Vui lòng đăng nhập lại.' });
        }
        
        console.log('[logistics-stream] Token expired but valid session found - allowing stream connection');
      }
    } else {
      // No token in query params - try to authenticate via cookies/session
      // This allows EventSource to work with cookie-based authentication
      // Note: cookie names are snake_case (access_token, storefront_token, refresh_token)
      const sessionToken = req.cookies?.access_token || req.cookies?.storefront_token || req.cookies?.token || req.cookies?.erp_token;
      
      console.log('[logistics-stream] Cookie auth attempt:', {
        hasAccessToken: !!req.cookies?.access_token,
        hasStorefrontToken: !!req.cookies?.storefront_token,
        hasToken: !!req.cookies?.token,
        hasErpToken: !!req.cookies?.erp_token,
        allCookies: req.cookies ? Object.keys(req.cookies).join(', ') : 'none',
        tokenLength: sessionToken?.length
      });
      
      if (!sessionToken) {
        console.warn('[logistics-stream] No session token found in cookies');
        return res.status(401).json({ error: 'Missing authentication. Please log in.' });
      }
      
      // Verify session token from cookie
      const jwt = await import('jsonwebtoken');
      try {
        console.log('[logistics-stream] Verifying JWT token...');
        payload = jwt.default.verify(sessionToken, process.env.JWT_SECRET);
        console.log('[logistics-stream] JWT verified successfully, payload:', payload);
      } catch (err) {
        console.error('[logistics-stream] JWT verification failed:', err.name, err.message);
        if (err.name === 'TokenExpiredError') {
          // Check if session exists in DB
          const sessionCheck = await pool.query(
          'SELECT id, user_id FROM sessions WHERE token = $1 AND user_id = $2 AND (expires_at IS NULL OR expires_at > now()) LIMIT 1',
          [hashToken(sessionToken), err?.payload?.id]
          );
          
          if (sessionCheck.rows.length === 0) {
            return res.status(401).json({ error: 'Phiên đã hết hạn. Vui lòng đăng nhập lại.' });
          }
          
          payload = err.payload;
          console.log('[logistics-stream] Cookie token expired but valid session found - allowing stream connection');
        } else if (err.name === 'JsonWebTokenError') {
          // Invalid token - check if it's a valid session in DB anyway
          console.warn('[logistics-stream] JWT verification failed, checking DB session:', err.message);
          
          // Try to find session by token hash in DB
          const sessionCheck = await pool.query(
          'SELECT id, user_id FROM sessions WHERE token = $1 AND (expires_at IS NULL OR expires_at > now()) LIMIT 1',
          [hashToken(sessionToken)]
          );
          
          if (sessionCheck.rows.length > 0) {
            console.log('[logistics-stream] Found valid DB session despite JWT error - allowing connection');
            payload = { id: sessionCheck.rows[0].user_id };
          } else {
            console.warn('[logistics-stream] No valid session found in DB');
            return res.status(401).json({ error: 'Invalid session token' });
          }
        } else {
          return res.status(401).json({ error: 'Invalid session token' });
        }
      }
      
      if (!payload || !payload.id) {
        return res.status(401).json({ error: 'Invalid session token payload' });
      }
      
      console.log('[logistics-stream] Authenticated via cookie: userId=', payload.id);
    }
    
    // Determine company_id: prefer from JWT payload, fallback to query param
    const companyId = payload.activeCompanyId || payload.company_ids?.[0] || queryCompanyId;
    
    // Validate that the requested company_id matches what the user has access to
    if (queryCompanyId && String(queryCompanyId) !== String(companyId)) {
      // Allow if user is admin or has the queried company in their list
      if (payload.role !== 'admin' && !payload.company_ids?.includes(Number(queryCompanyId))) {
        return res.status(403).json({ 
          error: `Không có quyền truy cập doanh nghiệp #${queryCompanyId}. Chỉ được phép truy cập doanh nghiệp được phân quyền.` 
        });
      }
    }
    
    // Attach user info to request
    req.user = payload;
    
    // Check role permission
    const userRole = payload.role || payload.storefront_role;
    if (!LOGISTICS_ALLOWED_ROLES.includes(userRole)) {
      return res.status(403).json({ error: 'Không có quyền truy cập stream' });
    }
    
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
