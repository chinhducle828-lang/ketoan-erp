import express from 'express';
import { pool } from '../server.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { canAccessCompany } from '../services/helpers.js';
import { invalidateCache } from '../cache/redis.js';

const router = express.Router();

// Lấy danh sách chứng từ
router.get('/', authenticate, async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id; 
    const year = req.query.year ? Number(req.query.year) : 2026;

    if (!targetCompanyId) return res.json([]);

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Bạn không có quyền truy cập dữ liệu của doanh nghiệp này!' });
    }

    const result = await pool.query(
      `SELECT id, company_id as "companyId", voucher_date as "voucherDate", description, account_dr as "accountDr", account_cr as "accountCr", amount, voucher_type as "type" FROM vouchers 
       WHERE company_id = $1 
         AND EXTRACT(YEAR FROM voucher_date) = $2 
       ORDER BY voucher_date DESC, id DESC`, 
      [targetCompanyId, year]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Tạo chứng từ mới
router.post('/', authenticate, async (req, res) => {
  try {
    const { voucherDate, description, accountDr, accountCr, amount, type, companyId } = req.body;
    const targetCompanyId = companyId;
    
    if (!targetCompanyId) return res.status(400).json({ error: 'Vui lòng xác định rõ doanh nghiệp cần ghi sổ!' });

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Bạn không có quyền ghi sổ tại doanh nghiệp này!' });
    }

    const result = await pool.query(
      `INSERT INTO vouchers (company_id, voucher_date, description, account_dr, account_cr, amount, voucher_type, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, company_id as "companyId", voucher_date as "voucherDate", description, account_dr as "accountDr", account_cr as "accountCr", amount, voucher_type as "type"`,
      [targetCompanyId, voucherDate, description, accountDr, accountCr, amount, type, req.user.id]
    );
    
    // Invalidate dashboard cache
    await invalidateCache(`dashboard:cashflow:${targetCompanyId}:*`);
    
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Xóa chứng từ
router.delete('/:id', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id;
    if (!targetCompanyId) return res.status(400).json({ error: 'Thiếu mã đơn vị cần xóa dữ liệu!' });

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Bạn không có quyền thao tác trên dữ liệu doanh nghiệp này!' });
      await pool.query('DELETE FROM vouchers WHERE id = $1 AND company_id = $2', [req.params.id, targetCompanyId]);
    } else {
      await pool.query('DELETE FROM vouchers WHERE id = $1', [req.params.id]);
    }
    
    // Invalidate dashboard cache
    await invalidateCache(`dashboard:cashflow:${targetCompanyId}:*`);
    
    res.json({ success: true, message: 'Xóa chứng từ thành công!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export { router as vouchersRouter };