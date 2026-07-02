import { pool } from '../config/db.js';

// Lấy danh sách kỳ đã khóa
export const getClosedPeriods = async (req, res) => {
  try {
    const { company_id, year } = req.query;
    if (!company_id) {
      return res.status(400).json({ error: 'Yêu cầu truyền tham số company_id!' });
    }

    const filterYear = year ? `${year}-%` : '2026-%';

    const result = await pool.query(
      'SELECT period, closed_at as "closedAt", closed_by as "closedBy" FROM closed_periods WHERE company_id = $1 AND period LIKE $2 ORDER BY period DESC',
      [company_id, filterYear]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Thực hiện khóa/mở khóa sổ
export const toggleClosedPeriod = async (req, res) => {
  try {
    const { companyId, period, action } = req.body; 
    
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({ error: 'Định dạng kỳ kế toán không hợp lệ. Vui lòng sử dụng cấu trúc YYYY-MM.' });
    }

    if (!['lock', 'unlock'].includes(action)) {
      return res.status(400).json({ error: 'Hành động không hợp lệ (Chỉ chấp nhận lock hoặc unlock).' });
    }

    if (action === 'lock') {
      await pool.query(
        'INSERT INTO closed_periods (company_id, period, closed_by) VALUES ($1, $2, $3) ON CONFLICT (company_id, period) DO NOTHING',
        [companyId, period, req.user.id] 
      );
      return res.json({ success: true, message: `Hệ thống đã thực hiện khóa sổ kỳ hạch toán tháng ${period} thành công!` });
    } else {
      await pool.query(
        'DELETE FROM closed_periods WHERE company_id = $1 AND period = $2',
        [companyId, period]
      );
      return res.json({ success: true, message: `Kỳ hạch toán tháng ${period} đã được mở khóa để hiệu chỉnh.` });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};