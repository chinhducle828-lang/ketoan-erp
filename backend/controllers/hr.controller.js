import { pool } from '../config/db.js';

const BANNED_ACCOUNTS_TT99 = ['1562', '611', '621', '622', '627'];

export const createPayrollVoucher = async (req, res) => {
  const client = await pool.connect();
  try {
    const { companyId, voucherDate, description, details } = req.body;
    
    const period = voucherDate.substring(0, 7);
    const lockCheck = await client.query(
      'SELECT id FROM closed_periods WHERE company_id = $1 AND period = $2', 
      [companyId, period]
    );
    if (lockCheck.rows.length > 0) {
      return res.status(403).json({ error: `Kỳ kế toán lương tháng ${period} đã bị khóa sổ.` });
    }

    let drSum = 0;
    let crSum = 0;
    let hasPayrollAccount = false;

    for (const d of details) {
      const mainAccount = d.accountCode.substring(0, 4);
      if (BANNED_ACCOUNTS_TT99.includes(mainAccount)) {
        return res.status(400).json({ error: `Tài khoản lương/bảo hiểm ${d.accountCode} bị bãi bỏ theo TT 99.` });
      }

      if (d.accountCode.startsWith('334') || d.accountCode.startsWith('338')) {
        hasPayrollAccount = true;
      }

      if (d.entryType === 'DR') drSum += parseFloat(d.amount);
      if (d.entryType === 'CR') crSum += parseFloat(d.amount);
    }

    if (!hasPayrollAccount) {
      return res.status(400).json({ error: 'Nghiệp vụ tiền lương bắt buộc phải sử dụng tài khoản nhóm 334 hoặc 338.' });
    }

    // Dung sai 1 đồng cho việc làm tròn tỷ lệ 32% bảo hiểm
    const difference = Math.abs(drSum - crSum);
    if (difference > 1) {
      return res.status(400).json({ error: `Hạch toán bảng lương mất cân đối (Chênh lệch: ${difference} VND).` });
    }

    await client.query('BEGIN');
    
    const voucherRes = await client.query(
      'INSERT INTO vouchers (company_id, voucher_type, voucher_date, description, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [companyId, 'Luong', voucherDate, description, req.user.id]
    );
    const voucherId = voucherRes.rows[0].id;

    for (const d of details) {
      await client.query(
        'INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) VALUES ($1, $2, $3, $4)', 
        [voucherId, d.accountCode, d.entryType, d.amount]
      );
    }
    
    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Duyệt và trích quỹ lương/bảo hiểm thành công!' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};