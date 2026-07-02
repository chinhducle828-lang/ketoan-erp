import { pool } from '../config/db.js';

/**
 * Nghiệp vụ TT 99/2025/TT-BTC: Bãi bỏ các tài khoản trung gian 621, 622, 627 đối với các doanh nghiệp vừa và nhỏ.
 * Toàn bộ chi phí nguyên vật liệu xuất kho, chi phí nhân công trực tiếp và chi phí chung sẽ hạch toán thẳng vào TK 154.
 */
export const calculateProductCosts = async (req, res) => {
  const client = await pool.connect();
  try {
    const { companyId, period, voucherDate, description } = req.body; // period dạng 'YYYY-MM'

    // 1. Kiểm soát khóa sổ
    const lockCheck = await client.query(
      'SELECT id FROM closed_periods WHERE company_id = $1 AND period = $2',
      [companyId, period]
    );
    if (lockCheck.rows.length > 0) {
      return res.status(403).json({ error: `Kỳ kế toán tháng ${period} đã bị khóa sổ. Không thể hạch toán kết chuyển giá thành!` });
    }

    // 2. Thu thập tổng chi phí dở dang đã tập hợp trực tiếp trên TK 154 trong kỳ
    const costGatherQuery = `
      SELECT 
        COALESCE(SUM(converted_amount), 0)::double precision as "totalGathered"
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
        AND v.voucher_date LIKE $2
        AND vd.account_code LIKE '154%' 
        AND vd.entry_type = 'DR'
    `;
    const costGatherRes = await client.query(costGatherQuery, [companyId, `${period}-%`]);
    const totalGathered = costGatherRes.rows[0].totalGathered;

    if (totalGathered <= 0) {
      return res.status(400).json({ error: 'Trong kỳ chưa ghi nhận bất kỳ chi phí sản xuất phát sinh nào trên tài khoản 154.' });
    }

    // 3. Thực hiện bút toán tự động: Kết chuyển từ Chi phí dở dang (TK 154) sang Thành phẩm hoàn thành (TK 155)
    await client.query('BEGIN');

    const voucherQuery = `
      INSERT INTO vouchers (company_id, type, voucher_date, description, currency, exchange_rate, total_amount)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `;
    const voucherRes = await client.query(voucherQuery, [
      companyId,
      'PhieuKeToan',
      voucherDate || `${period}-28`, // Mặc định hạch toán cuối tháng
      description || `Bút toán kết chuyển tính giá thành phẩm hoàn thành kỳ tháng ${period}`,
      'VND',
      1,
      totalGathered
    ]);
    const voucherId = voucherRes.rows[0].id;

    // Ghi Nợ TK 155 (Tăng kho thành phẩm) / Ghi Có TK 154 (Giảm chi phí dở dang)
    const detailQuery = `
      INSERT INTO voucher_details (voucher_id, account_code, entry_type, original_amount, converted_amount)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await client.query(detailQuery, [voucherId, '155', 'DR', totalGathered, totalGathered]);
    await client.query(detailQuery, [voucherId, '154', 'CR', totalGathered, totalGathered]);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: `Tính và kết chuyển giá thành tháng ${period} hoàn tất!`,
      data: {
        totalAllocated: totalGathered,
        debitAccount: '155 (Thành phẩm)',
        creditAccount: '154 (Chi phí SXKD dở dang)'
      }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};