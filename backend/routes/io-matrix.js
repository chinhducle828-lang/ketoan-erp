/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * routes/io-matrix.js - I-O Matrix Forecasting API
 * POST /api/io-matrix/forecast — Dự báo tác động chuỗi cung ứng
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { buildAndForecast } from '../core/ioMatrix.js';

const router = Router();

/**
 * POST /api/io-matrix/forecast
 * Dự báo tác động khi 1 công ty trong tập đoàn tăng trưởng
 * Body: { targetCompanyId: 2, growthRate: 0.2 }
 * Response: { success: true, data: [{ companyId: 1, requiredGrowth: 0.15 }, ...] }
 */
router.post('/forecast', authenticate, async (req, res) => {
  try {
    const { targetCompanyId, growthRate } = req.body;

    if (!targetCompanyId) {
      return res.status(400).json({ error: 'Thiếu targetCompanyId' });
    }
    if (growthRate === undefined || growthRate === null) {
      return res.status(400).json({ error: 'Thiếu growthRate' });
    }
    if (typeof growthRate !== 'number' || growthRate < -1 || growthRate > 10) {
      return res.status(400).json({ error: 'growthRate phải là số từ -1 đến 10' });
    }

    const forecast = await buildAndForecast(targetCompanyId, growthRate);

    res.json({
      success: true,
      data: forecast,
      meta: {
        targetCompanyId,
        growthRate,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Lỗi I-O Matrix forecast:', err.message);
    res.status(500).json({
      success: false,
      error: err.message || 'Lỗi tính toán I-O Matrix'
    });
  }
});

/**
 * POST /api/io-matrix/seed
 * Thêm dữ liệu mẫu cho I-O coefficients (dùng để test)
 */
router.post('/seed', authenticate, async (req, res) => {
  try {
    const { pool } = await import('../config/db.js');
    const sampleData = req.body.coefficients || [
      { from_company_id: 1, to_company_id: 2, resource_type: 'goods', coefficient: 0.65 },
      { from_company_id: 2, to_company_id: 3, resource_type: 'goods', coefficient: 0.30 },
      { from_company_id: 1, to_company_id: 3, resource_type: 'service', coefficient: 0.15 },
    ];

    for (const row of sampleData) {
      await pool.query(`
        INSERT INTO io_coefficients (from_company_id, to_company_id, resource_type, coefficient)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (from_company_id, to_company_id, resource_type, valid_from) DO NOTHING
      `, [row.from_company_id, row.to_company_id, row.resource_type, row.coefficient]);
    }

    res.json({ success: true, message: `Đã thêm ${sampleData.length} dòng I-O coefficients` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;