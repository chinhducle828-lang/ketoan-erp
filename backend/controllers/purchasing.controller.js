import { pool } from '../config/db.js';

// Các tài khoản bị bãi bỏ theo Thông tư 99/2025/TT-BTC
const BANNED_ACCOUNTS_TT99 = ['1562', '611', '621', '622', '627'];

export const createPurchasingVoucher = async (req, res) => {
  const client = await pool.connect();
  try {
    const { companyId, voucherDate, description, details, currency = 'VND', exchangeRate = 1, supplierId } = req.body;
    
    // 1. Kiểm soát khóa sổ kỳ kế toán
    const period = voucherDate.substring(0, 7);
    const lockCheck = await client.query(
      'SELECT id FROM closed_periods WHERE company_id = $1 AND period = $2', 
      [companyId, period]
    );
    if (lockCheck.rows.length > 0) {
      return res.status(403).json({ error: `Kỳ kế toán mua hàng tháng ${period} đã khóa sổ. Không thể phát sinh chứng từ.` });
    }

    let drSum = 0;
    let crSum = 0;
    let hasPayableAccount = false;

    // 2. Ràng buộc hạch toán chuẩn mực kế toán TT 99
    for (const d of details) {
      const mainAccount = d.accountCode.substring(0, 4);
      if (BANNED_ACCOUNTS_TT99.includes(mainAccount)) {
        return res.status(400).json({ error: `Tài khoản ${d.accountCode} không còn hiệu lực hạch toán (TT 99).` });
      }

      // Nghiệp vụ mua hàng phải ghi Có tài khoản công nợ phải trả (331), tiền mặt (111) hoặc tiền gửi (112)
      if (d.accountCode.startsWith('331') || d.accountCode.startsWith('111') || d.accountCode.startsWith('112')) {
        hasPayableAccount = true;
      }

      const converted = Math.round(parseFloat(d.amount) * exchangeRate);
      if (d.entryType === 'DR') drSum += converted;
      if (d.entryType === 'CR') crSum += converted;
    }

    if (!hasPayableAccount) {
      return res.status(400).json({ error: 'Nghiệp vụ mua hàng bắt buộc phải ghi nhận bên Có các tài khoản 331, 111 hoặc 112.' });
    }

    if (drSum !== crSum) {
      return res.status(400).json({ error: `Hạch toán mua hàng bị lệch Nợ - Có (Tổng Nợ: ${drSum} VND - Tổng Có: ${crSum} VND).` });
    }

    // 3. Ghi dữ liệu vào database
    await client.query('BEGIN');
    
    const voucherQuery = `
      INSERT INTO vouchers (company_id, type, voucher_date, description, currency, exchange_rate, total_amount, partner_id) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
    `;
    const voucherRes = await client.query(voucherQuery, [
      companyId, 'MuaHang', voucherDate, description, currency, exchangeRate, drSum, supplierId
    ]);
    const voucherId = voucherRes.rows[0].id;

    const detailQuery = `
      INSERT INTO voucher_details (voucher_id, account_code, entry_type, original_amount, converted_amount) 
      VALUES ($1, $2, $3, $4, $5)
    `;
    for (const d of details) {
      const converted = Math.round(parseFloat(d.amount) * exchangeRate);
      await client.query(detailQuery, [voucherId, d.accountCode, d.entryType, d.amount, converted]);
    }
    
    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Ghi sổ hóa đơn chứng từ mua hàng & thuế đầu vào thành công!' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};