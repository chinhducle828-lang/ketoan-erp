import express from 'express';
import { pool } from '../server.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { canAccessCompany } from '../services/helpers.js';
import { invalidateCache } from '../cache/redis.js';

const router = express.Router();

// Lấy số dư đầu kỳ
router.get('/', authenticate, async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id;
    const year = req.query.year ? Number(req.query.year) : 2026;

    if (!targetCompanyId) return res.json([]);

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Quyền truy cập số dư bị từ chối!' });
    }

    const result = await pool.query(
      'SELECT * FROM opening_balances WHERE company_id = $1 AND fiscal_year = $2 ORDER BY account_code ASC', 
      [targetCompanyId, year]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Cập nhật số dư đầu kỳ
router.post('/', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const { balances, year, companyId } = req.body;
    const targetCompanyId = companyId;
    const finalYear = year ? Number(year) : 2026;

    if (!targetCompanyId) return res.status(400).json({ error: 'Thông tin công ty không hợp lệ!' });
    if (!balances) return res.status(400).json({ error: 'Dữ liệu số dư trống!' });

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa số dư tại doanh nghiệp này!' });
    }

    for (const [code, val] of Object.entries(balances)) {
      await pool.query(
        `INSERT INTO opening_balances (company_id, account_code, debit_balance, credit_balance, fiscal_year)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (company_id, account_code, fiscal_year)
         DO UPDATE SET debit_balance = $3, credit_balance = $4`,
        [targetCompanyId, code, val.dr || 0, val.cr || 0, finalYear]
      );
    }
    
    // Invalidate dashboard cache
    await invalidateCache(`dashboard:cashflow:${targetCompanyId}:*`);
    
    res.json({ success: true, message: `Cập nhật số dư đầu kỳ cho năm ${finalYear} thành công!` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Kiểm tra trạng thái số dư đầu kỳ
router.get('/status', authenticate, async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id;
    if (!targetCompanyId) {
      return res.json({ hasOpeningBalance: false, message: 'Chưa chọn doanh nghiệp' });
    }

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Bạn không có quyền truy cập!' });
      }
    }

    const result = await pool.query(
      'SELECT COUNT(*) as count FROM opening_balances WHERE company_id = $1 AND (debit_balance > 0 OR credit_balance > 0)',
      [targetCompanyId]
    );

    const hasBalance = result.rows[0].count > 0;
    res.json({ 
      hasOpeningBalance: hasBalance,
      message: hasBalance 
        ? 'Đã nhập số dư đầu kỳ' 
        : 'Chưa nhập số dư đầu kỳ. Vui lòng vào phân hệ "Khai báo số dư đầu kỳ" để nhập trước khi thực hiện nghiệp vụ khác.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { router as openingBalancesRouter };