import { pool } from '../config/db.js';

const BANNED_ACCOUNTS_TT99 = ['1562', '611', '621', '622', '627'];

export const createCashVoucher = async (req, res) => {
  const client = await pool.connect();
  try {
    const { companyId, type, voucherDate, description, details, currency = 'VND', exchangeRate = 1 } = req.body;
    
    if (!['Thu', 'Chi'].includes(type)) {
      return res.status(400).json({ error: 'Loại chứng từ quỹ không hợp lệ (Bắt buộc là Thu hoặc Chi).' });
    }

    // 1. Kiểm tra khóa sổ
    const period = voucherDate.substring(0, 7);
    const lockCheck = await client.query(
      'SELECT id FROM closed_periods WHERE company_id = $1 AND period = $2',
      [companyId, period]
    );
    if (lockCheck.rows.length > 0) {
      return res.status(403).json({ error: `Kỳ kế toán tháng ${period} đã khóa sổ!` });
    }

    let drSum = 0;
    let crSum = 0;
    let hasCashOrBank = false;

    // 2. Ràng buộc TT99 & Cân bằng Kép
    for (const d of details) {
      const mainAccount = d.accountCode.substring(0, 4);
      if (BANNED_ACCOUNTS_TT99.includes(mainAccount)) {
        return res.status(400).json({ error: `Tài khoản ${d.accountCode} đã bị bãi bỏ (TT 99).` });
      }

      if (d.accountCode.startsWith('111') || d.accountCode.startsWith('112')) {
        hasCashOrBank = true;
      }

      const convertedAmount = Math.round(parseFloat(d.amount) * exchangeRate);
      if (d.entryType === 'DR') drSum += convertedAmount;
      if (d.entryType === 'CR') crSum += convertedAmount;
    }

    if (!hasCashOrBank) {
      return res.status(400).json({ error: 'Chứng từ thu/chi phải sử dụng nhóm tài khoản 111 hoặc 112.' });
    }

    if (drSum !== crSum) {
      return res.status(400).json({ error: 'Chứng từ mất cân đối Nợ - Có.' });
    }

    // 3. Thực hiện ghi sổ
    await client.query('BEGIN');
    
    const voucherRes = await client.query(
      'INSERT INTO vouchers (company_id, voucher_type, voucher_date, description, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [companyId, type, voucherDate, description, req.user.id]
    );
    const newVoucherId = voucherRes.rows[0].id;

    for (const d of details) {
      const converted = Math.round(parseFloat(d.amount) * exchangeRate);
      await client.query(
        'INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) VALUES ($1, $2, $3, $4)', 
        [newVoucherId, d.accountCode, d.entryType, converted]
      );
    }
    
    await client.query('COMMIT');
    res.status(201).json({ success: true, message: `Hạch toán thành công phiếu ${type}!` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};