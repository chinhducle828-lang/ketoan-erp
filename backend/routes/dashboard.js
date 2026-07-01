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

    // 1. Thống kê thu/chi theo tháng chuẩn xác (Thu: phát sinh Nợ 111/112 | Chi: phát sinh Có 111/112)
    const monthlyQuery = `
      SELECT 
        EXTRACT(MONTH FROM v.voucher_date)::int AS month,
        SUM(CASE WHEN vd.entry_type = 'DR' AND (vd.account_code LIKE '111%' OR vd.account_code LIKE '112%') THEN vd.amount ELSE 0 END) AS thu,
        SUM(CASE WHEN vd.entry_type = 'CR' AND (vd.account_code LIKE '111%' OR vd.account_code LIKE '112%') THEN vd.amount ELSE 0 END) AS chi
      FROM vouchers v
      JOIN voucher_details vd ON v.id = vd.voucher_id
      WHERE v.company_id = $1 AND EXTRACT(YEAR FROM v.voucher_date) = $2
      GROUP BY month
      ORDER BY month
    `;
    const monthly = await pool.query(monthlyQuery, [targetCompanyId, year]);

    // 2. Tính tổng số dư tiền mặt cuối kỳ thực tế (Số dư đầu kỳ + Phát sinh Nợ - Phát sinh Có)
    const balanceQuery = `
      WITH opening AS (
        SELECT 
          COALESCE(SUM(debit_balance), 0) AS initial_debit,
          COALESCE(SUM(credit_balance), 0) AS initial_credit
        FROM opening_balances
        WHERE company_id = $1 AND fiscal_year = $2 AND (account_code LIKE '111%' OR account_code LIKE '112%')
      ),
      movement AS (
        SELECT 
          SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) AS current_dr,
          SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) AS current_cr
        FROM vouchers v
        JOIN voucher_details vd ON v.id = vd.voucher_id
        WHERE v.company_id = $1 AND EXTRACT(YEAR FROM v.voucher_date) = $2 
          AND (vd.account_code LIKE '111%' OR vd.account_code LIKE '112%')
      )
      SELECT 
        COALESCE(movement.current_dr, 0) AS tong_thu_tien,
        COALESCE(movement.current_cr, 0) AS tong_chi_tien,
        (COALESCE(opening.initial_debit, 0) - COALESCE(opening.initial_credit, 0) + COALESCE(movement.current_dr, 0) - COALESCE(movement.current_cr, 0)) AS so_du_hien_tai
      FROM opening, movement
    `;
    const cashBalances = await pool.query(balanceQuery, [targetCompanyId, year]);

    // 3. Danh sách 10 giao dịch gần đây nhất kèm mảng con details hạch toán
    const recentQuery = `
      SELECT 
        v.id, 
        v.voucher_date as "voucherDate", 
        v.description, 
        v.voucher_type as "voucherType",
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'accountCode', vd.account_code,
            'entryType', vd.entry_type,
            'amount', vd.amount
          ) ORDER BY vd.entry_type DESC
        ) AS details
      FROM vouchers v
      JOIN voucher_details vd ON v.id = vd.voucher_id
      WHERE v.company_id = $1 AND EXTRACT(YEAR FROM v.voucher_date) = $2
      GROUP BY v.id, v.voucher_date, v.description, v.voucher_type
      ORDER BY v.voucher_date DESC, v.id DESC
      LIMIT 10
    `;
    const recent = await pool.query(recentQuery, [targetCompanyId, year]);

    res.json({
      monthly: monthly.rows,
      summary: cashBalances.rows[0] || { tong_thu_tien: 0, tong_chi_tien: 0, so_du_hien_tai: 0 },
      recent: recent.rows
    });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

export { router as dashboardRouter };