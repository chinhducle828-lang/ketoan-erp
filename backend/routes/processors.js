/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * routes/processors.js
 * ====================================================================
 * Admin CRUD API cho REA Event Processors
 * ====================================================================
 * Cho phép admin tạo, đọc, cập nhật, xóa các processor cấu hình
 * trong bảng rea_event_processors.
 * 
 * KHÔNG hard-code: mọi cấu hình đều lưu trong DB, có thể CRUD qua API
 * ====================================================================
 */

import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { ReaProcessorEngine } from '../core/rea/ReaProcessorEngine.js';

const router = Router();

/**
 * GET /api/processors
 * Lấy danh sách tất cả processors
 * Query params: event_type, company_id, is_active
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { event_type, company_id, is_active } = req.query;
    
    let sql = 'SELECT * FROM rea_event_processors WHERE 1=1';
    const params = [];
    let paramIdx = 0;

    if (event_type) {
      paramIdx++;
      sql += ` AND event_type = $${paramIdx}`;
      params.push(event_type);
    }
    if (company_id !== undefined) {
      paramIdx++;
      sql += ` AND (company_id = $${paramIdx} OR company_id IS NULL)`;
      params.push(company_id ? parseInt(company_id) : null);
    }
    if (is_active !== undefined) {
      paramIdx++;
      sql += ` AND is_active = $${paramIdx}`;
      params.push(is_active === 'true');
    }

    sql += ' ORDER BY event_type, company_id NULLS LAST';

    const { rows } = await pool.query(sql, params);
    
    res.json({
      success: true,
      count: rows.length,
      data: rows.map(row => ({
        ...row,
        validation_rules: typeof row.validation_rules === 'string'
          ? JSON.parse(row.validation_rules)
          : row.validation_rules,
        formula_rules: typeof row.formula_rules === 'string'
          ? JSON.parse(row.formula_rules)
          : row.formula_rules,
        entry_rules: typeof row.entry_rules === 'string'
          ? JSON.parse(row.entry_rules)
          : row.entry_rules,
        workflow_config: row.workflow_config
          ? (typeof row.workflow_config === 'string' ? JSON.parse(row.workflow_config) : row.workflow_config)
          : null,
        ui_schema: row.ui_schema
          ? (typeof row.ui_schema === 'string' ? JSON.parse(row.ui_schema) : row.ui_schema)
          : null
      }))
    });
  } catch (err) {
    console.error('❌ Lỗi lấy danh sách processors:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/processors/:eventType
 * Lấy chi tiết 1 processor (ưu tiên company-specific)
 */
router.get('/:eventType', authenticate, async (req, res) => {
  try {
    const { eventType } = req.params;
    const companyId = req.query.company_id ? parseInt(req.query.company_id) : req.user?.activeCompanyId;

    const config = await ReaProcessorEngine.getConfig(eventType, companyId);
    if (!config) {
      return res.status(404).json({
        success: false,
        error: `Không tìm thấy processor cho event_type: ${eventType}`
      });
    }

    res.json({
      success: true,
      data: {
        ...config,
        validation_rules: typeof config.validation_rules === 'string'
          ? JSON.parse(config.validation_rules)
          : config.validation_rules,
        formula_rules: typeof config.formula_rules === 'string'
          ? JSON.parse(config.formula_rules)
          : config.formula_rules,
        entry_rules: typeof config.entry_rules === 'string'
          ? JSON.parse(config.entry_rules)
          : config.entry_rules
      }
    });
  } catch (err) {
    console.error('❌ Lỗi lấy processor:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/processors
 * Tạo mới 1 processor
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { event_type, company_id, label, description, is_active,
            validation_rules, formula_rules, entry_rules, workflow_config, ui_schema } = req.body;

    if (!event_type) {
      return res.status(400).json({ success: false, error: 'Thiếu event_type' });
    }

    const result = await ReaProcessorEngine.register(event_type, company_id, {
      label,
      description,
      is_active,
      validation_rules,
      formula_rules,
      entry_rules,
      workflow_config,
      ui_schema
    });

    res.status(201).json({
      success: true,
      message: `Đã tạo processor cho event_type: ${event_type}`,
      data: result
    });
  } catch (err) {
    console.error('❌ Lỗi tạo processor:', err.message);
    
    if (err.code === '23505') { // unique violation
      return res.status(409).json({
        success: false,
        error: `Processor cho event_type "${req.body.event_type}" đã tồn tại`
      });
    }
    
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/processors/:eventType
 * Cập nhật processor (dùng ReaProcessorEngine.register với upsert)
 */
router.put('/:eventType', authenticate, async (req, res) => {
  try {
    const { eventType } = req.params;
    const companyId = req.body.company_id || null;

    const result = await ReaProcessorEngine.register(eventType, companyId, {
      label: req.body.label,
      description: req.body.description,
      is_active: req.body.is_active,
      validation_rules: req.body.validation_rules,
      formula_rules: req.body.formula_rules,
      entry_rules: req.body.entry_rules,
      workflow_config: req.body.workflow_config,
      ui_schema: req.body.ui_schema
    });

    res.json({
      success: true,
      message: `Đã cập nhật processor cho event_type: ${eventType}`,
      data: result
    });
  } catch (err) {
    console.error('❌ Lỗi cập nhật processor:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/processors/:eventType
 * Xóa processor (soft delete bằng cách set is_active = false)
 */
router.delete('/:eventType', authenticate, async (req, res) => {
  try {
    const { eventType } = req.params;
    const companyId = req.query.company_id || null;

    const { rows } = await pool.query(`
      UPDATE rea_event_processors 
      SET is_active = FALSE, updated_at = NOW()
      WHERE event_type = $1 AND (company_id = $2 OR (company_id IS NULL AND $2 IS NULL))
      RETURNING id, event_type, version
    `, [eventType, companyId]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Không tìm thấy processor cho event_type: ${eventType}`
      });
    }

    // Invalidate cache
    ReaProcessorEngine.invalidateCache(eventType, companyId);

    res.json({
      success: true,
      message: `Đã vô hiệu hóa processor cho event_type: ${eventType}`,
      data: rows[0]
    });
  } catch (err) {
    console.error('❌ Lỗi xóa processor:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/processors/test
 * Test 1 processor với dữ liệu mẫu KHÔNG cần lưu vào DB
 * Cho phép admin thử cấu hình trước khi apply
 */
router.post('/test', authenticate, async (req, res) => {
  try {
    const { event_type, company_id, test_data, validation_rules, formula_rules, entry_rules } = req.body;

    if (!event_type || !test_data) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu event_type hoặc test_data'
      });
    }

    // Tạo config tạm thời từ body (không lưu vào DB)
    const tempConfig = {
      validation_rules: validation_rules || [],
      formula_rules: formula_rules || [],
      entry_rules: entry_rules || []
    };

    const startTime = Date.now();

    // Validate
    const validationErrors = ReaProcessorEngine.validate(tempConfig, test_data, companyId);
    if (validationErrors.length > 0) {
      return res.json({
        success: false,
        phase: 'validate',
        errors: validationErrors,
        duration_ms: Date.now() - startTime
      });
    }

    // Calculate
    const calculatedData = ReaProcessorEngine.calculate(tempConfig, test_data);

    // Generate entries
    const entries = await ReaProcessorEngine.generateEntries(tempConfig, calculatedData, companyId);

    res.json({
      success: true,
      duration_ms: Date.now() - startTime,
      phases: {
        validate: { passed: true },
        calculate: { input_fields: Object.keys(test_data).length, calculated_fields: Object.keys(calculatedData).length },
        generateEntries: { entry_count: entries.length }
      },
      result: {
        input: test_data,
        calculated: calculatedData,
        entries
      }
    });
  } catch (err) {
    console.error('❌ Lỗi test processor:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;