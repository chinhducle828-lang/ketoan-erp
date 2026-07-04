import express from 'express';
import { pool } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/stats', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.headers['x-company-id'];
    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu company_id' });
    }

    const orderCountRes = await pool.query(
      `SELECT COUNT(*)::int AS today_orders
       FROM vouchers
       WHERE company_id = $1 AND voucher_date = CURRENT_DATE`,
      [companyId]
    );

    const salesRes = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN entry_type = 'CR' AND account_code = '511' THEN amount ELSE 0 END), 0)::numeric AS today_sales
       FROM voucher_details vd
       JOIN vouchers v ON v.id = vd.voucher_id
       WHERE v.company_id = $1 AND v.voucher_date = CURRENT_DATE`,
      [companyId]
    );

    const notificationRes = await pool.query(
      `SELECT COUNT(*)::int AS unread_count
       FROM notifications
       WHERE company_id = $1 AND is_read = FALSE`,
      [companyId]
    );

    res.json({
      todayOrders: Number(orderCountRes.rows[0]?.today_orders || 0),
      todaySales: Number(salesRes.rows[0]?.today_sales || 0),
      unreadNotifications: Number(notificationRes.rows[0]?.unread_count || 0)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/notify', authenticate, async (req, res) => {
  try {
    const { companyId, orderId, title, message, recipientRole = 'admin' } = req.body;
    if (!companyId || !title) {
      return res.status(400).json({ error: 'Thiếu thông tin thông báo' });
    }

    const { rows } = await pool.query(
      `INSERT INTO notifications (company_id, order_id, type, title, message, recipient_role, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE, CURRENT_TIMESTAMP)
       RETURNING *`,
      [companyId, orderId || null, 'order', title, message || '', recipientRole,]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/notifications', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.headers['x-company-id'];
    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu company_id' });
    }

    const { rows } = await pool.query(
      `SELECT id, company_id, order_id, type, title, message, recipient_role, is_read, created_at
       FROM notifications
       WHERE company_id = $1 AND (recipient_role IS NULL OR recipient_role = $2)
       ORDER BY created_at DESC
       LIMIT 20`,
      [companyId, req.user?.role || 'admin']
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
