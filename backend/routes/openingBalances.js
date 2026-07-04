import express from 'express';
import { pool } from '../config/db.js';
import { authenticate, requireRole, checkCompanyAccess } from '../middleware/auth.js';
import { invalidateCache } from '../cache/redis.js';
// BỔ SUNG LOGIC: Nạp hàm quản lý xóa bộ đệm RAM kết xuất kế toán dồn tích
import { invalidateCompanyCache } from '../controllers/erpController.js';

const router = express.Router();

// 1. API lấy số dư đầu kỳ
router.get('/', authenticate, requireRole(['admin', 'ktt', 'accountant']), checkCompanyAccess, async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id;
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

// 2. API cập nhật số dư đầu kỳ lịch sử
router.post('/', authenticate, requireRole(['admin', 'accountant']), checkCompanyAccess, async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id || req.body.companyId;
    const { accountCode, debitBalance, creditBalance, fiscalYear, partnerId } = req.body;
    const finalYear = fiscalYear ? Number(fiscalYear) : 2026;

    // Kiểm tra chốt chặn an toàn dữ liệu khóa sổ
    const checkLock = await pool.query(
      'SELECT is_locked FROM opening_balances WHERE company_id = $1 AND account_code = $2 AND fiscal_year = $3 AND (partner_id = $4 OR (partner_id IS NULL AND $4 IS NULL))',
      [targetCompanyId, accountCode, finalYear, partnerId || null]
    );
    if (checkLock.rows.length > 0 && checkLock.rows[0].is_locked) {
      return res.status(400).json({ error: `Số liệu năm ${finalYear} đã khóa sổ, cấm sửa đổi!` });
    }

    // Cập nhật câu lệnh INSERT để hỗ trợ partner_id
    await pool.query(
      `INSERT INTO opening_balances (company_id, account_code, opening_debit, opening_credit, fiscal_year, partner_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (company_id, account_code, fiscal_year, partner_id) 
       DO UPDATE SET opening_debit = EXCLUDED.opening_debit, opening_credit = EXCLUDED.opening_credit`,
      [targetCompanyId, accountCode, debitBalance || 0, creditBalance || 0, finalYear, partnerId || null]
    );

    // ĐỒNG BỘ HOÀN TOÀN: Hủy cache dòng tiền và cache báo cáo động
    invalidateCompanyCache(targetCompanyId);
    await invalidateCache(`dashboard:cashflow:${targetCompanyId}:*`);

    res.json({ success: true, message: 'Cập nhật số dư thành công!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. API Khóa / Mở khóa sổ số dư đầu kỳ
router.post('/toggle-lock', authenticate, requireRole(['admin', 'ktt']), checkCompanyAccess, async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id;
    const { lockStatus, fiscalYear } = req.body;
    const finalYear = fiscalYear ? Number(fiscalYear) : 2026;

    await pool.query(
      'UPDATE opening_balances SET is_locked = $1 WHERE company_id = $2 AND fiscal_year = $3',
      [lockStatus, targetCompanyId, finalYear]
    );

    // Kích hoạt dọn dẹp cache
    invalidateCompanyCache(targetCompanyId);

    res.json({ success: true, message: 'Thay đổi trạng thái khóa sổ thành công!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export { router as openingBalancesRouter };