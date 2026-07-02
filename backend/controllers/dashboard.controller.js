import { pool } from '../config/db.js';
import { getCache, setCache } from '../cache/redis.js';

/**
 * Lấy các chỉ số KPI tài chính quan trọng của doanh nghiệp
 */
export const getFinancialSummary = async (req, res) => {
  try {
    const { company_id, year = 2026 } = req.query;
    if (!company_id) {
      return res.status(400).json({ error: 'Yêu cầu truyền tham số company_id!' });
    }

    const cacheKey = `dashboard:summary:${company_id}:${year}`;
    
    // 1. Tận dụng Redis để tối ưu tốc độ phản hồi dashboard
    try {
      const cachedData = await getCache(cacheKey);
      if (cachedData) return res.json(JSON.parse(cachedData));
    } catch (redisErr) {
      // Bỏ qua lỗi kết nối redis nếu có, tiếp tục truy xuất DB trực tiếp
    }

    // 2. Tính toán số dư tiền mặt hiện tại (Dư Nợ TK 111, 112)
    const cashQuery = `
      SELECT 
        COALESCE(SUM(CASE WHEN entry_type = 'DR' THEN converted_amount ELSE -converted_amount END), 0) as "netCash"
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
        AND (vd.account_code LIKE '111%' OR vd.account_code LIKE '112%')
    `;
    const cashRes = await pool.query(cashQuery, [company_id]);
    const cashBalance = parseFloat(cashRes.rows[0].netCash);

    // 3. Tính toán tổng Doanh thu bán hàng trong năm (Ghi Có phát sinh TK 511)
    const revenueQuery = `
      SELECT 
        COALESCE(SUM(converted_amount), 0) as "totalRevenue"
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
        AND v.voucher_date LIKE $2
        AND vd.account_code LIKE '511%' 
        AND vd.entry_type = 'CR'
    `;
    const revRes = await pool.query(revenueQuery, [company_id, `${year}-%`]);
    const totalRevenue = parseFloat(revRes.rows[0].totalRevenue);

    // 4. Tính toán Công nợ phải thu (Dư Nợ TK 131) & Phải trả (Dư Có TK 331)
    const receivablesQuery = `
      SELECT COALESCE(SUM(CASE WHEN entry_type = 'DR' THEN converted_amount ELSE -converted_amount END), 0) as balance
      FROM voucher_details vd JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 AND vd.account_code LIKE '131%'
    `;
    const payablesQuery = `
      SELECT COALESCE(SUM(CASE WHEN entry_type = 'CR' THEN converted_amount ELSE -converted_amount END), 0) as balance
      FROM voucher_details vd JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 AND vd.account_code LIKE '331%'
    `;
    
    const [recRes, payRes] = await Promise.all([
      pool.query(receivablesQuery, [company_id]),
      pool.query(payablesQuery, [company_id])
    ]);

    const data = {
      cashBalance,
      totalRevenue,
      receivables: parseFloat(recRes.rows[0].balance),
      payables: parseFloat(payRes.rows[0].balance)
    };

    // Thiết lập Cache Redis lưu trữ trong 10 phút
    try {
      await setCache(cacheKey, JSON.stringify(data), 600);
    } catch (cacheErr) {}

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};