import express from 'express';
import { pool } from '../server.js';
import { authenticate } from '../middleware/auth.js';
import { canAccessCompany } from '../services/helpers.js';
import { cacheMiddleware } from '../cache/redis.js';

const router = express.Router();

// Dashboard cashflow with Redis caching
router.get('/cashflow', authenticate, cacheMiddleware('dashboard:cashflow', 300), async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id;
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    if (!targetCompanyId) return res.json([]);
    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Không có quyền truy cập!' });
    }

    // Thống kê thu/chi theo tháng
    const monthly = await pool.query(`
      SELECT 
        EXTRACT(MONTH FROM voucher_date)::int AS month,
        SUM(CASE WHEN voucher_type IN ('Thu','Nhap') THEN amount ELSE 0 END) AS thu,
        SUM(CASE WHEN voucher_type IN ('Chi','Xuat') THEN amount ELSE 0 END) AS chi
      FROM vouchers
      WHERE company_id = $1 AND EXTRACT(YEAR FROM voucher_date) = $2
      GROUP BY month
      ORDER BY month
    `, [targetCompanyId, year]);

    // Tổng số dư tiền mặt (1111, 1121)
    const cashBalances = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN account_dr IN ('1111','1121') THEN amount ELSE 0 END), 0) AS tong_thu_tien,
        COALESCE(SUM(CASE WHEN account_cr IN ('1111','1121') THEN amount ELSE 0 END), 0) AS tong_chi_tien
      FROM vouchers
      WHERE company_id = $1 AND EXTRACT(YEAR FROM voucher_date) = $2
    `, [targetCompanyId, year]);

    // Danh sách giao dịch gần đây nhất (10 cái)
    const recent = await pool.query(`
      SELECT id, voucher_date, description, account_dr, account_cr, amount, voucher_type
      FROM vouchers
      WHERE company_id = $1 AND EXTRACT(YEAR FROM voucher_date) = $2
      ORDER BY voucher_date DESC, id DESC
      LIMIT 10
    `, [targetCompanyId, year]);

    res.json({
      monthly: monthly.rows,
      summary: cashBalances.rows[0],
      recent: recent.rows
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export { router as dashboardRouter };