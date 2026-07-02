import express from 'express';
import { pool } from '../config/db.js';
import { authenticate, requireRole, checkCompanyAccess } from '../middleware/auth.js';

const router = express.Router();

// Danh sách tài khoản bị bãi bỏ theo Thông tư 99/2025/TT-BTC
const BANNED_ACCOUNTS_TT99 = ['1562', '611', '621', '622', '627'];

/**
 * @route   POST /api/cash
 * @desc    Tạo mới phiếu Thu hoặc phiếu Chi tiền mặt / tiền gửi ngân hàng (TT 99)
 * @access  Private (Admin, Accountant)
 */
router.post('/', authenticate, requireRole(['admin', 'ktt']), checkCompanyAccess, async (req, res) => {
  const client = await pool.connect();
  try {
    const { companyId, type, voucherDate, description, details, currency = 'VND', exchangeRate = 1 } = req.body;
    
    // Kiểm tra định dạng loại phiếu hạch toán
    if (!['Thu', 'Chi'].includes(type)) {
      return res.status(400).json({ error: 'Loại chứng từ quỹ không hợp lệ (Bắt buộc là Thu hoặc Chi).' });
    }

    // 1. Kiểm tra trạng thái khóa sổ kỳ kế toán theo tháng (YYYY-MM)
    const period = voucherDate.substring(0, 7);
    const lockCheck = await client.query(
      'SELECT id FROM closed_periods WHERE company_id = $1 AND period = $2',
      [companyId, period]
    );
    if (lockCheck.rows.length > 0) {
      return res.status(403).json({ error: `Kỳ kế toán tháng ${period} của công ty đã được khóa sổ. Không thể phát sinh giao dịch!` });
    }

    let drSum = 0;
    let crSum = 0;
    let hasCashOrBank = false;

    // 2. Kiểm duyệt chi tiết định khoản theo chuẩn mực Thông tư 99
    for (const d of details) {
      const mainAccount = d.accountCode.substring(0, 4);
      const subAccount = d.accountCode.substring(0, 3);

      // Chặn các tài khoản không còn hiệu lực hạch toán
      if (BANNED_ACCOUNTS_TT99.includes(mainAccount) || BANNED_ACCOUNTS_TT99.includes(subAccount)) {
        return res.status(400).json({ error: `Tài khoản hạch toán ${d.accountCode} đã bị bãi bỏ theo Thông tư 99/2025/TT-BTC.` });
      }

      // Nghiệp vụ thu/chi tiền bắt buộc phải xuất hiện tài khoản nhóm 111 (Tiền mặt) hoặc 112 (Tiền gửi)
      if (d.accountCode.startsWith('111') || d.accountCode.startsWith('112')) {
        hasCashOrBank = true;
      }

      // Quy đổi ngoại tệ theo tỷ giá thực tế cuối ngày phát sinh chứng từ
      const convertedAmount = Math.round(parseFloat(d.amount) * exchangeRate);
      if (d.entryType === 'DR') drSum += convertedAmount;
      if (d.entryType === 'CR') crSum += convertedAmount;
    }

    if (!hasCashOrBank) {
      return res.status(400).json({ error: 'Chứng từ thu/chi tiền mặt hoặc tiền gửi bắt buộc phải sử dụng nhóm tài khoản 111 hoặc 112.' });
    }

    if (drSum !== crSum) {
      return res.status(400).json({ error: `Chứng từ mất cân đối Nợ - Có (Tổng Nợ: ${drSum} VND - Tổng Có: ${crSum} VND).` });
    }

    // 3. Thực hiện ghi sổ hạch toán dạng ACID Transaction bảo vệ tính toàn vẹn dữ liệu
    await client.query('BEGIN');
    
    const insertVoucherQuery = `
      INSERT INTO vouchers (company_id, voucher_type, voucher_date, description, created_by) 
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `;
    const voucherRes = await client.query(insertVoucherQuery, [
      companyId, 
      type, 
      voucherDate, 
      description, 
      req.user.id
    ]);
    const newVoucherId = voucherRes.rows[0].id;

    const insertDetailQuery = `
      INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
      VALUES ($1, $2, $3, $4)
    `;
    for (const d of details) {
      const converted = Math.round(parseFloat(d.amount) * exchangeRate);
      await client.query(insertDetailQuery, [newVoucherId, d.accountCode, d.entryType, converted]);
    }
    
    await client.query('COMMIT');
    res.status(201).json({ success: true, message: `Hạch toán và ghi sổ thành công phiếu ${type} tiền tệ!` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;