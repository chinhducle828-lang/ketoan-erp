/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * routes/accountingPeriods.js - Quản lý kỳ kế toán (Open/Close/Lock)
 * 
 * Endpoints:
 *   GET    /api/accounting-periods?company_id=X
 *   POST   /api/accounting-periods
 *   PUT    /api/accounting-periods/:id/close
 *   PUT    /api/accounting-periods/:id/open
 *   GET    /api/accounting-periods/check?company_id=X&date=YYYY-MM-DD
 */

import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/accounting-periods
 * Lấy danh sách kỳ kế toán
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.user?.activeCompanyId;
    const fiscalYear = req.query.fiscal_year;

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id' });
    }

    let query = `
      SELECT id, fiscal_year, period_number, start_date, end_date, period_status,
             closed_at, closed_by, close_reason, created_at, updated_at
      FROM accounting_periods
      WHERE company_id = $1
    `;
    const params = [companyId];

    if (fiscalYear) {
      query += ` AND fiscal_year = $2`;
      params.push(fiscalYear);
    }

    query += ` ORDER BY fiscal_year DESC, period_number DESC`;

    const { rows } = await pool.query(query, params);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('❌ Lỗi lấy accounting periods:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/accounting-periods
 * Tạo kỳ kế toán mới (admin only)
 */
router.post('/', authenticate, requireRole('admin', 'ktt'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { company_id, fiscal_year, period_number, start_date, end_date } = req.body;
    const companyId = company_id || req.user?.activeCompanyId;

    if (!companyId || !fiscal_year || !period_number || !start_date || !end_date) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id, fiscal_year, period_number, start_date, end_date' });
    }

    const { rows } = await client.query(
      `INSERT INTO accounting_periods 
       (company_id, fiscal_year, period_number, start_date, end_date, period_status)
       VALUES ($1, $2, $3, $4, $5, 'OPEN')
       RETURNING *`,
      [companyId, fiscal_year, period_number, start_date, end_date]
    );

    res.status(201).json({
      success: true,
      message: 'Tạo kỳ kế toán thành công',
      data: rows[0]
    });
  } catch (err) {
    console.error('❌ Lỗi tạo accounting period:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/accounting-periods/:id/close
 * Đóng kỳ kế toán (không cho phép sửa chứng từ)
 */
router.put('/:id/close', authenticate, requireRole('admin', 'ktt'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { close_reason } = req.body;

    // Kiểm tra kỳ tồn tại và đang mở
    const period = await client.query(
      'SELECT * FROM accounting_periods WHERE id = $1',
      [id]
    );

    if (period.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy kỳ kế toán' });
    }

    if (period.rows[0].period_status !== 'OPEN') {
      return res.status(400).json({ success: false, error: `Kỳ đã ở trạng thái ${period.rows[0].period_status}` });
    }

    // Đóng kỳ
    const { rows } = await client.query(
      `UPDATE accounting_periods 
       SET period_status = 'CLOSED', closed_at = NOW(), closed_by = $1, close_reason = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [req.user?.id, close_reason || null, id]
    );

    res.json({
      success: true,
      message: `Đã đóng kỳ ${rows[0].period_number}/${rows[0].fiscal_year}`,
      data: rows[0]
    });
  } catch (err) {
    console.error('❌ Lỗi đóng accounting period:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/accounting-periods/:id/open
 * Mở lại kỳ kế toán (cho phép sửa chứng từ)
 */
router.put('/:id/open', authenticate, requireRole('admin', 'ktt'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const period = await client.query(
      'SELECT * FROM accounting_periods WHERE id = $1',
      [id]
    );

    if (period.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy kỳ kế toán' });
    }

    const { rows } = await client.query(
      `UPDATE accounting_periods 
       SET period_status = 'OPEN', closed_at = NULL, closed_by = NULL, close_reason = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    res.json({
      success: true,
      message: `Đã mở lại kỳ ${rows[0].period_number}/${rows[0].fiscal_year}`,
      data: rows[0]
    });
  } catch (err) {
    console.error('❌ Lỗi mở accounting period:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/accounting-periods/check
 * Kiểm tra xem 1 ngày có nằm trong kỳ đã đóng không
 */
router.get('/check', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.user?.activeCompanyId;
    const date = req.query.date;

    if (!companyId || !date) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id hoặc date' });
    }

    const { rows } = await pool.query(
      `SELECT is_date_in_closed_period($1, $2) as is_closed`,
      [companyId, date]
    );

    const isClosed = rows[0]?.is_closed || false;

    // Nếu đóng, lấy kỳ mở gần nhất
    let nextOpenPeriod = null;
    if (isClosed) {
      const periodResult = await pool.query(
        `SELECT * FROM get_next_open_period($1, $2)`,
        [companyId, date]
      );
      if (periodResult.rows.length > 0) {
        nextOpenPeriod = periodResult.rows[0];
      }
    }

    res.json({
      success: true,
      data: {
        company_id: companyId,
        date,
        is_closed: isClosed,
        next_open_period: nextOpenPeriod
      }
    });
  } catch (err) {
    console.error('❌ Lỗi check accounting period:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;