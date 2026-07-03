import express from 'express';
import { pool } from '../config/db.js';
import { authenticate, requireRole, checkCompanyAccess } from '../middleware/auth.js';
import { invalidateCache } from '../cache/redis.js';
// BỔ SUNG LOGIC: Nạp hàm quản lý xóa bộ đệm RAM kết xuất kế toán dồn tích
import { invalidateCompanyCache } from '../controllers/erpController.js';

const router = express.Router();

// 1. API cập nhật số dư đầu kỳ lịch sử
router.post('/', authenticate, requireRole(['admin', 'accountant']), checkCompanyAccess, async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id || req.body.companyId;
    const { accountCode, debitBalance, creditBalance, fiscalYear } = req.body;
    const finalYear = fiscalYear ? Number(fiscalYear) : 2026;

    // Kiểm tra chốt chặn an toàn dữ liệu khóa sổ
    const checkLock = await pool.query(
      'SELECT is_locked FROM opening_balances WHERE company_id = $1 AND account_code = $2 AND fiscal_year = $3',
      [targetCompanyId, accountCode, finalYear]
    );
    if (checkLock.rows.length > 0 && checkLock.rows[0].is_locked) {
      return res.status(400).json({ error: `Số liệu năm ${finalYear} đã khóa sổ, cấm sửa đổi!` });
    }

    await pool.query(
      `INSERT INTO opening_balances (company_id, account_code, debit_balance, credit_balance, fiscal_year)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (company_id, account_code, fiscal_year) 
       DO UPDATE SET debit_balance = EXCLUDED.debit_balance, credit_balance = EXCLUDED.credit_balance`,
      [targetCompanyId, accountCode, debitBalance || 0, creditBalance || 0, finalYear]
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