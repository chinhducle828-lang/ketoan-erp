import express from 'express';
import { pool } from '../config/db.js';
import { authenticate, requireRole, checkCompanyAccess } from '../middleware/auth.js';

const router = express.Router();
const BANNED_ACCOUNTS_TT99 = ['1562', '611', '621', '622', '627'];

/**
 * @route   POST /api/hr/payroll
 * @desc    Hạch toán bảng lương chi tiết và trích đóng quỹ bảo hiểm xã hội 32% (TT 99)
 * @access  Private (Admin, Accountant)
 */
router.post('/payroll', authenticate, requireRole(['admin', 'accountant']), checkCompanyAccess, async (req, res) => {
  const client = await pool.connect();
  try {
    const { companyId, voucherDate, description, details } = req.body;
    
    // 1. Kiểm soát khóa sổ
    const period = voucherDate.substring(0, 7);
    const lockCheck = await client.query(
      'SELECT id FROM closed_periods WHERE company_id = $1 AND period = $2', 
      [companyId, period]
    );
    if (lockCheck.rows.length > 0) {
      return res.status(403).json({ error: `Kỳ kế toán lương tháng ${period} đã bị khóa sổ. Vui lòng mở khóa trước khi ghi nhận.` });
    }

    let drSum = 0;
    let crSum = 0;
    let hasPayrollAccount = false;

    // 2. Kiểm duyệt tài khoản
    for (const d of details) {
      const mainAccount = d.accountCode.substring(0, 4);
      if (BANNED_ACCOUNTS_TT99.includes(mainAccount)) {
        return res.status(400).json({ error: `Tài khoản lương/bảo hiểm ${d.accountCode} đã lỗi thời hoặc bị bãi bỏ theo Thông tư 99.` });
      }

      // Xác minh phải có tài khoản tiền lương 334 hoặc các tài khoản bảo hiểm xã hội 338
      if (d.accountCode.startsWith('334') || d.accountCode.startsWith('338')) {
        hasPayrollAccount = true;
      }

      if (d.entryType === 'DR') drSum += parseFloat(d.amount);
      if (d.entryType === 'CR') crSum += parseFloat(d.amount);
    }

    if (!hasPayrollAccount) {
      return res.status(400).json({ error: 'Nghiệp vụ tiền lương bắt buộc phải sử dụng tài khoản nhóm 334 hoặc 338.' });
    }

    // 🔥 CƠ CHẾ DUNG SAI LÀM TRÒN: Do trích bảo hiểm 32% phát sinh tiền xu/số lẻ, cho phép chênh lệch tối đa 1 đồng
    const difference = Math.abs(drSum - crSum);
    if (difference > 1) {
      return res.status(400).json({ error: `Hạch toán bảng lương mất cân đối vượt mức cho phép (Chênh lệch: ${difference} VND).` });
    }

    // 3. Thực hiện ghi sổ nghiệp vụ tiền lương
    await client.query('BEGIN');
    
    // Ghi nhận chứng từ tổng hợp
    const voucherRes = await client.query(
      'INSERT INTO vouchers (company_id, type, voucher_date, description, currency, exchange_rate, total_amount) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
      [companyId, 'Luong', voucherDate, description, 'VND', 1, Math.round(drSum)]
    );
    const voucherId = voucherRes.rows[0].id;

    // Hạch toán chi tiết
    const insertDetailQuery = `
      INSERT INTO voucher_details (voucher_id, account_code, entry_type, original_amount, converted_amount) 
      VALUES ($1, $2, $3, $4, $5)
    `;
    for (const d of details) {
      await client.query(insertDetailQuery, [voucherId, d.accountCode, d.entryType, d.amount, d.amount]);
    }
    
    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Ghi nhận và khóa sổ bảng trích lương, bảo hiểm xã hội thành công!' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;