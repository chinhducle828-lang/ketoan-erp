import { pool } from '../config/db.js';

/**
 * Lập Bảng kê hóa đơn Thuế GTGT đầu vào và đầu ra trong kỳ (Dùng cho tờ khai thuế)
 */
export const getVATReports = async (req, res) => {
  try {
    const { company_id, period } = req.query; // period: YYYY-MM
    if (!company_id || !period) {
      return res.status(400).json({ error: 'Vui lòng cung cấp company_id và period (YYYY-MM)!' });
    }

    // Truy xuất chi tiết các bút toán hạch toán Thuế (TK 133% đối với mua vào, TK 33311 đối với bán ra)
    const queryStr = `
      SELECT 
        v.id as "voucherId",
        v.voucher_date as "date",
        v.description,
        vd.account_code as "accountCode",
        vd.entry_type as "entryType",
        vd.converted_amount as amount
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
        AND v.voucher_date LIKE $2
        AND (vd.account_code LIKE '133%' OR vd.account_code = '33311')
      ORDER BY v.voucher_date ASC, v.id ASC
    `;

    const result = await pool.query(queryStr, [company_id, `${period}-%`]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Thực hiện bút toán kết chuyển khấu trừ thuế GTGT tự động cuối kỳ
 * Khấu trừ giữa Thuế GTGT đầu vào được khấu trừ (TK 133) và Thuế GTGT đầu ra phải nộp (TK 33311)
 */
export const performTaxDeduction = async (req, res) => {
  const client = await pool.connect();
  try {
    const { companyId, period, voucherDate } = req.body;

    // 1. Kiểm soát khóa sổ
    const lockCheck = await client.query(
      'SELECT id FROM closed_periods WHERE company_id = $1 AND period = $2',
      [companyId, period]
    );
    if (lockCheck.rows.length > 0) {
      return res.status(403).json({ error: `Tháng ${period} đã bị khóa sổ. Không thể hạch toán khấu trừ thuế!` });
    }

    // 2. Tìm số dư tích lũy bên Nợ TK 133 (Thuế đầu vào) và bên Có TK 33311 (Thuế đầu ra) trong kỳ tháng đó
    const inputTaxQuery = `
      SELECT COALESCE(SUM(vd.converted_amount), 0)::double precision as amount 
      FROM voucher_details vd JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 AND v.voucher_date LIKE $2 AND vd.account_code LIKE '133%' AND vd.entry_type = 'DR'
    `;
    const outputTaxQuery = `
      SELECT COALESCE(SUM(vd.converted_amount), 0)::double precision as amount 
      FROM voucher_details vd JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 AND v.voucher_date LIKE $2 AND vd.account_code = '33311' AND vd.entry_type = 'CR'
    `;

    const [inputTaxRes, outputTaxRes] = await Promise.all([
      client.query(inputTaxQuery, [companyId, `${period}-%`]),
      client.query(outputTaxQuery, [companyId, `${period}-%`])
    ]);

    const inputTax = inputTaxRes.rows[0].amount;
    const outputTax = outputTaxRes.rows[0].amount;

    if (inputTax === 0 && outputTax === 0) {
      return res.status(400).json({ error: 'Không phát sinh số thuế GTGT đầu vào hoặc đầu ra cần khấu trừ trong kỳ này.' });
    }

    // Nguyên tắc khấu trừ thuế GTGT: Khấu trừ theo số nhỏ hơn giữa đầu vào và đầu ra
    const deductionAmount = Math.min(inputTax, outputTax);

    // 3. Tiến hành tạo bút toán khấu trừ: Ghi Nợ TK 33311 / Ghi Có TK 133
    await client.query('BEGIN');

    const voucherQuery = `
      INSERT INTO vouchers (company_id, type, voucher_date, description, currency, exchange_rate, total_amount)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `;
    const voucherRes = await client.query(voucherQuery, [
      companyId,
      'PhieuKeToan',
      voucherDate || `${period}-30`,
      `Khấu trừ thuế GTGT tự động kỳ tính thuế tháng ${period}`,
      'VND',
      1,
      deductionAmount
    ]);
    const voucherId = voucherRes.rows[0].id;

    const detailQuery = `
      INSERT INTO voucher_details (voucher_id, account_code, entry_type, original_amount, converted_amount)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await client.query(detailQuery, [voucherId, '33311', 'DR', deductionAmount, deductionAmount]);
    await client.query(detailQuery, [voucherId, '133', 'CR', deductionAmount, deductionAmount]);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: `Khấu trừ thuế GTGT thành công số tiền ${deductionAmount.toLocaleString('vi-VN')} VND!`,
      data: {
        deductionAmount,
        inputTax,
        outputTax,
        formula: 'MIN(Đầu vào, Đầu ra)'
      }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};