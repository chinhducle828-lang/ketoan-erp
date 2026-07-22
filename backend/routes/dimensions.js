/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * routes/dimensions.js - Query API cho Multi-Dimensional Ledger
 * 
 * Endpoints:
 *   GET /api/dimensions/values?company_id=X&dimension_name=project_id
 *   GET /api/vouchers/by-dimension?company_id=X&dimension=project_id&value=123
 */

import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/dimensions/values
 * Lấy danh sách distinct values của 1 dimension
 * 
 * Query params:
 *   - company_id (required)
 *   - dimension_name (required): VD: project_id, cost_center, department
 *   - limit (optional, default 100)
 */
router.get('/values', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.user?.activeCompanyId;
    const dimensionName = req.query.dimension_name;
    const limit = parseInt(req.query.limit) || 100;

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id' });
    }
    if (!dimensionName) {
      return res.status(400).json({ success: false, error: 'Thiếu dimension_name' });
    }

    // Query distinct values từ JSONB dimensions
    const query = `
      SELECT DISTINCT 
        (dimensions->>$1)::text as dimension_value,
        COUNT(*) as usage_count
      FROM voucher_details vd
      JOIN vouchers v ON v.id = vd.voucher_id
      WHERE v.company_id = $2
        AND dimensions ? $1
        AND dimensions->>$1 IS NOT NULL
        AND dimensions->>$1 != ''
      GROUP BY (dimensions->>$1)::text
      ORDER BY usage_count DESC
      LIMIT $3
    `;

    const { rows } = await pool.query(query, [dimensionName, companyId, limit]);

    const values = rows.map(r => ({
      value: r.dimension_value,
      usage_count: parseInt(r.usage_count)
    }));

    res.json({
      success: true,
      data: {
        dimension_name: dimensionName,
        values
      }
    });
  } catch (err) {
    console.error('❌ Lỗi lấy dimension values:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/vouchers/by-dimension
 * Lọc voucher theo dimension value
 * 
 * Query params:
 *   - company_id (required)
 *   - dimension (required): VD: project_id, cost_center
 *   - value (required): Giá trị cần lọc
 *   - limit (optional, default 50)
 *   - offset (optional, default 0)
 */
router.get('/by-dimension', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.user?.activeCompanyId;
    const dimension = req.query.dimension;
    const value = req.query.value;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id' });
    }
    if (!dimension || !value) {
      return res.status(400).json({ success: false, error: 'Thiếu dimension và value' });
    }

    // Query voucher_details có dimension value khớp
    const query = `
      SELECT 
        vd.id,
        vd.voucher_id,
        v.voucher_number,
        v.voucher_date,
        v.voucher_type,
        vd.account_code,
        vd.entry_type,
        vd.amount,
        vd.dimensions,
        v.is_posted
      FROM voucher_details vd
      JOIN vouchers v ON v.id = vd.voucher_id
      WHERE v.company_id = $1
        AND vd.dimensions->>$2 = $3
      ORDER BY v.voucher_date DESC
      LIMIT $4 OFFSET $5
    `;

    const { rows } = await pool.query(query, [companyId, dimension, value, limit, offset]);

    // Đếm tổng số records
    const countQuery = `
      SELECT COUNT(*) as total
      FROM voucher_details vd
      JOIN vouchers v ON v.id = vd.voucher_id
      WHERE v.company_id = $1
        AND vd.dimensions->>$2 = $3
    `;
    const countResult = await pool.query(countQuery, [companyId, dimension, value]);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: {
        dimension,
        value,
        filters: { company_id: companyId },
        total,
        limit,
        offset,
        entries: rows
      }
    });
  } catch (err) {
    console.error('❌ Lỗi lọc voucher by dimension:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/dimensions/summary
 * Lấy tổng hợp chi phí theo dimension
 * 
 * Query params:
 *   - company_id (required)
 *   - dimension (required): VD: project_id, cost_center
 *   - account_code (optional): Lọc theo tài khoản cụ thể
 *   - from_date (optional)
 *   - to_date (optional)
 */
router.get('/summary', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.user?.activeCompanyId;
    const dimension = req.query.dimension;
    const accountCode = req.query.account_code;
    const fromDate = req.query.from_date;
    const toDate = req.query.to_date;

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id' });
    }
    if (!dimension) {
      return res.status(400).json({ success: false, error: 'Thiếu dimension' });
    }

    // Build query với điều kiện lọc
    let whereClause = 'v.company_id = $1 AND vd.dimensions ? $2';
    const params = [companyId, dimension];
    let paramCount = 2;

    if (accountCode) {
      paramCount++;
      whereClause += ` AND vd.account_code = $${paramCount}`;
      params.push(accountCode);
    }

    if (fromDate) {
      paramCount++;
      whereClause += ` AND v.voucher_date >= $${paramCount}`;
      params.push(fromDate);
    }

    if (toDate) {
      paramCount++;
      whereClause += ` AND v.voucher_date <= $${paramCount}`;
      params.push(toDate);
    }

    const query = `
      SELECT 
        (vd.dimensions->>$2)::text as dimension_value,
        vd.account_code,
        SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as total_debit,
        SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as total_credit,
        COUNT(DISTINCT v.id) as voucher_count
      FROM voucher_details vd
      JOIN vouchers v ON v.id = vd.voucher_id
      WHERE ${whereClause}
      GROUP BY (vd.dimensions->>$2)::text, vd.account_code
      ORDER BY total_debit DESC
    `;

    const { rows } = await pool.query(query, params);

    // Group by dimension_value
    const summary = {};
    rows.forEach(r => {
      const dimValue = r.dimension_value;
      if (!summary[dimValue]) {
        summary[dimValue] = {
          dimension_value: dimValue,
          total_debit: 0,
          total_credit: 0,
          voucher_count: 0,
          by_account: []
        };
      }
      summary[dimValue].total_debit += parseFloat(r.total_debit) || 0;
      summary[dimValue].total_credit += parseFloat(r.total_credit) || 0;
      summary[dimValue].voucher_count += parseInt(r.voucher_count) || 0;
      summary[dimValue].by_account.push({
        account_code: r.account_code,
        debit: parseFloat(r.total_debit) || 0,
        credit: parseFloat(r.total_credit) || 0
      });
    });

    res.json({
      success: true,
      data: {
        dimension,
        filters: { company_id: companyId, account_code: accountCode, from_date: fromDate, to_date: toDate },
        summary: Object.values(summary)
      }
    });
  } catch (err) {
    console.error('❌ Lỗi lấy dimension summary:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;