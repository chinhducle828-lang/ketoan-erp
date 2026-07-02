import { pool } from '../config/db.js';

// Các tài khoản bị bãi bỏ theo Thông tư 99/2025/TT-BTC
const BANNED_ACCOUNTS_TT99 = ['1562', '611', '621', '622', '627'];

export const createSalesInvoice = async (req, res) => {
  const client = await pool.connect();
  try {
    const { companyId, voucherDate, description, details, currency = 'VND', exchangeRate = 1, customerId } = req.body;
    
    // 1. Kiểm soát khóa sổ
    const period = voucherDate.substring(0, 7);
    const lockCheck = await client.query(
      'SELECT id FROM closed_periods WHERE company_id = $1 AND period = $2', 
      [companyId, period]
    );
    if (lockCheck.rows.length > 0) {
      return res.status(403).json({ error: `Tháng ${period} đã thực hiện khóa sổ kế toán tài chính. Không được ghi nhận phát sinh!` });
    }

    let drSum = 0;
    let crSum = 0;
    let hasRevenueAccount = false;

    // 2. Kiểm thử nghiệp vụ đối ứng chuẩn Thông tư 99
    for (const d of details) {
      const mainAccount = d.accountCode.substring(0, 4);
      if (BANNED_ACCOUNTS_TT99.includes(mainAccount)) {
        return res.status(400).json({ error: `Tài khoản hạch toán ${d.accountCode} không còn nằm trong danh mục tài khoản (TT 99).` });
      }

      // Giao dịch bán hàng bắt buộc phải xuất hiện tài khoản doanh thu (511)
      if (d.accountCode.startsWith('511')) {
        hasRevenueAccount = true;
      }

      const converted = Math.round(parseFloat(d.amount) * exchangeRate);
      if (d.entryType === 'DR') drSum += converted;
      if (d.entryType === 'CR') crSum += converted;
    }

    if (!hasRevenueAccount) {
      return res.status(400).json({ error: 'Nghiệp vụ hạch toán bán hàng bắt buộc phải sử dụng tài khoản doanh thu 511.' });
    }

    if (drSum !== crSum) {
      return res.status(400).json({ error: `Chứng từ bán hàng bị mất cân đối Nợ - Có (DR: ${drSum} VND | CR: ${crSum} VND).` });
    }

    // 3. Tiến hành ghi nhận bút toán hạch toán
    await client.query('BEGIN');
    
    const voucherQuery = `
      INSERT INTO vouchers (company_id, voucher_type, voucher_date, description, created_by) 
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `;
    const voucherRes = await client.query(voucherQuery, [
      companyId, 
      'BanHang', 
      voucherDate, 
      description, 
      req.user.id
    ]);
    const voucherId = voucherRes.rows[0].id;

    const detailQuery = `
      INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
      VALUES ($1, $2, $3, $4)
    `;
    for (const d of details) {
      const converted = Math.round(parseFloat(d.amount) * exchangeRate);
      await client.query(detailQuery, [voucherId, d.accountCode, d.entryType, converted]);
    }
    
    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Ghi sổ hóa đơn bán hàng & công nợ phải thu thành công!' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};