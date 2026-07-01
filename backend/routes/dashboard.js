import express from 'express';
import { pool } from '../server.js';
import { authenticate } from '../middleware/auth.js';
import { canAccessCompany } from '../services/helpers.js';
import { cacheMiddleware } from '../cache/redis.js';

const router = express.Router();

router.get('/cashflow', authenticate, cacheMiddleware('dashboard:cashflow', 300), async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id;
    const year = req.query.year ? Number(req.query.year) : 2026;

    if (!targetCompanyId) return res.json([]);
    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Không có quyền truy cập!' });
    }

    // 1. Thống kê thu/chi theo tháng (Chỉ lấy ở 1 bên dòng DR tránh nhân đôi số tiền)
    const monthly = await pool.query(`
      SELECT 
        EXTRACT(MONTH FROM v.voucher_date)::int AS month,
        SUM(CASE WHEN v.voucher_type IN ('Thu','Nhap') THEN vd.amount ELSE 0 END) AS thu,
        SUM(CASE WHEN v.voucher_type IN ('Chi','Xuat') THEN vd.amount ELSE 0 END) AS chi
      FROM vouchers v
      JOIN voucher_details vd ON v.id = vd.voucher_id
      WHERE v.company_id = $1 AND EXTRACT(YEAR FROM v.voucher_date) = $2 AND vd.entry_type = 'DR'
      GROUP BY month
      ORDER BY month
    `, [targetCompanyId, year]);

    // 2. Tổng số dư tiền mặt (1111, 1121)
    const cashBalances = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN vd.entry_type = 'DR' AND (vd.account_code LIKE '111%' OR vd.account_code LIKE '112%') THEN vd.amount ELSE 0 END), 0) AS tong_thu_tien,
        COALESCE(SUM(CASE WHEN vd.entry_type = 'CR' AND (vd.account_code LIKE '111%' OR vd.account_code LIKE '112%') THEN vd.amount ELSE 0 END), 0) AS tong_chi_tien
      FROM vouchers v
      JOIN voucher_details vd ON v.id = vd.voucher_id
      WHERE v.company_id = $1 AND EXTRACT(YEAR FROM v.voucher_date) = $2
    `, [targetCompanyId, year]);

    // 3. Danh sách giao dịch gần đây nhất kèm mảng details lồng nhau
    const recent = await pool.query(`
      SELECT 
        v.id, v.voucher_date as "voucherDate", v.description, v.voucher_type as "voucherType",
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'accountCode', vd.account_code,
            'entryType', vd.entry_type,
            'amount', vd.amount
          )
        ) AS details
      FROM vouchers v
      JOIN voucher_details vd ON v.id = vd.voucher_id
      WHERE v.company_id = $1 AND EXTRACT(YEAR FROM v.voucher_date) = $2
      GROUP BY v.id
      ORDER BY v.voucher_date DESC, v.id DESC
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