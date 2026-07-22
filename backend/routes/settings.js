/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * settings.js - API Routes for company settings (tax rates, defaults, etc.)
 */

import express from 'express';
import { pool } from '../config/db.js';
import { authenticateToken, authorizeAdmin } from '../middleware/auth.js';
import {
  searchSystemConfigs,
  createSystemConfig,
  updateSystemConfig,
  deleteSystemConfig,
  batchUpdateConfigs,
  exportSystemConfigs,
  importSystemConfigs
} from '../services/systemConfig.service.js';
import {
  validateCreateConfig,
  validateUpdateConfig,
  validateBatchUpdate,
  validateSearchConfigs,
  validateConfigKey
} from '../middleware/configValidator.js';

const router = express.Router();

/**
 * Get system config value
 * GET /api/settings/config/:key
 */
router.get('/config/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { company_id } = req.query;

    if (!key) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu tham số config key'
      });
    }

    // Try to get company-specific config first if company_id provided
    if (company_id) {
      const companyConfigResult = await pool.query(
        `SELECT config_value FROM system_configs 
         WHERE config_key = $1 AND company_id = $2 AND is_active = true
         LIMIT 1`,
        [key, company_id]
      );

      if (companyConfigResult.rows.length > 0) {
        return res.json({
          success: true,
          key,
          value: companyConfigResult.rows[0].config_value,
          source: 'company'
        });
      }
    }

    // Fallback to global config
    const globalConfigResult = await pool.query(
      `SELECT config_value, value_type FROM system_configs 
       WHERE config_key = $1 AND company_id IS NULL AND is_active = true
       LIMIT 1`,
      [key]
    );

    if (globalConfigResult.rows.length > 0) {
      const configValue = globalConfigResult.rows[0].config_value;
      const valueType = globalConfigResult.rows[0].value_type;
      
      // Parse value based on value_type
      let parsedValue = configValue;
      if (valueType === 'number') {
        parsedValue = parseFloat(configValue);
      } else if (valueType === 'boolean') {
        parsedValue = configValue === 'true';
      } else if (valueType === 'json') {
        try {
          parsedValue = JSON.parse(configValue);
        } catch (e) {
          // Keep as string if JSON parse fails
        }
      }

      return res.json({
        success: true,
        key,
        value: parsedValue,
        source: 'global'
      });
    }

    // Config not found
    return res.status(404).json({
      success: false,
      error: `Không tìm thấy config: ${key}`
    });
  } catch (err) {
    console.error('Error fetching system config:', err);
    res.status(500).json({
      success: false,
      error: 'Lỗi lấy cấu hình hệ thống'
    });
  }
});

/**
 * Get multiple system configs at once
 * POST /api/settings/configs/batch
 */
router.post('/configs/batch', async (req, res) => {
  try {
    const { keys, company_id } = req.body;

    if (!Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu danh sách config keys'
      });
    }

    const results = {};
    
    for (const key of keys) {
      try {
        // Try company-specific first
        if (company_id) {
          const companyResult = await pool.query(
            `SELECT config_value FROM system_configs 
             WHERE config_key = $1 AND company_id = $2 AND is_active = true
             LIMIT 1`,
            [key, company_id]
          );

          if (companyResult.rows.length > 0) {
            results[key] = {
              value: companyResult.rows[0].config_value,
              source: 'company'
            };
            continue;
          }
        }

        // Fallback to global
        const globalResult = await pool.query(
          `SELECT config_value, value_type FROM system_configs 
           WHERE config_key = $1 AND company_id IS NULL AND is_active = true
           LIMIT 1`,
          [key]
        );

        if (globalResult.rows.length > 0) {
          const configValue = globalResult.rows[0].config_value;
          const valueType = globalResult.rows[0].value_type;
          
          let parsedValue = configValue;
          if (valueType === 'number') {
            parsedValue = parseFloat(configValue);
          } else if (valueType === 'boolean') {
            parsedValue = configValue === 'true';
          } else if (valueType === 'json') {
            try {
              parsedValue = JSON.parse(configValue);
            } catch (e) {
              // Keep as string
            }
          }

          results[key] = {
            value: parsedValue,
            source: 'global'
          };
        } else {
          results[key] = null;
        }
      } catch (err) {
        console.error(`Error fetching config ${key}:`, err);
        results[key] = null;
      }
    }

    res.json({
      success: true,
      configs: results
    });
  } catch (err) {
    console.error('Error fetching batch configs:', err);
    res.status(500).json({
      success: false,
      error: 'Lỗi lấy cấu hình hệ thống'
    });
  }
});

/**
 * Get tax rate for a partner
 * GET /api/settings/tax-rate?partner_id=X&company_id=Y
 */
router.get('/tax-rate', async (req, res) => {
  try {
    const { partner_id, company_id } = req.query;

    // Try to get from system_configs first
    if (company_id) {
      // Try company-specific config
      const companyConfigResult = await pool.query(
        `SELECT config_value FROM system_configs 
         WHERE config_key = 'tax.standard_rate' AND company_id = $1 AND is_active = true
         LIMIT 1`,
        [company_id]
      );

      if (companyConfigResult.rows.length > 0) {
        return res.json({
          success: true,
          tax_rate: parseFloat(companyConfigResult.rows[0].config_value),
          source: 'company_config'
        });
      }
    }

    // Try global config
    const globalConfigResult = await pool.query(
      `SELECT config_value FROM system_configs 
       WHERE config_key = 'tax.standard_rate' AND company_id IS NULL AND is_active = true
       LIMIT 1`,
      []
    );

    if (globalConfigResult.rows.length > 0) {
      return res.json({
        success: true,
        tax_rate: parseFloat(globalConfigResult.rows[0].config_value),
        source: 'global_config'
      });
    }

    // Fallback to partner-specific or default
    const defaultTaxRate = 8; // 8% fallback

    if (partner_id && company_id) {
      // Try to find partner-specific tax rate
      const result = await pool.query(
        `SELECT tax_rate FROM partners 
         WHERE id = $1 AND company_id = $2 AND tax_rate IS NOT NULL`,
        [partner_id, company_id]
      );

      if (result.rows.length > 0) {
        return res.json({
          success: true,
          tax_rate: parseFloat(result.rows[0].tax_rate),
          source: 'partner'
        });
      }

      // Fallback to company default tax rate
      const companyResult = await pool.query(
        `SELECT default_tax_rate FROM companies WHERE id = $1`,
        [company_id]
      );

      if (companyResult.rows.length > 0 && companyResult.rows[0].default_tax_rate) {
        return res.json({
          success: true,
          tax_rate: parseFloat(companyResult.rows[0].default_tax_rate),
          source: 'company'
        });
      }
    }

    // Return default
    res.json({
      success: true,
      tax_rate: defaultTaxRate,
      source: 'default'
    });
  } catch (err) {
    console.error('Error fetching tax rate:', err);
    res.status(500).json({
      success: false,
      error: 'Lỗi lấy thông tin thuế suất',
      tax_rate: 8 // Fallback to 8%
    });
  }
});

// ============================================================================
// SYSTEM CONFIGS CRUD API
// ============================================================================

/**
 * Get all system configs with filters
 * GET /api/settings/configs
 * Query params: ?category=TAX_RATES&search=vat&page=1&limit=50&company_id=1
 */
router.get('/configs', authenticateToken, validateSearchConfigs, async (req, res) => {
  try {
    const { category, search, page, limit, company_id } = req.query;
    const companyId = company_id ? parseInt(company_id) : null;

    const result = await searchSystemConfigs(
      search || null,
      companyId,
      category || null,
      parseInt(page),
      parseInt(limit)
    );

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  } catch (err) {
    console.error('Error fetching system configs:', err);
    res.status(500).json({
      success: false,
      error: 'Lỗi lấy danh sách cấu hình hệ thống',
      message: err.message
    });
  }
});

/**
 * Create new system config
 * POST /api/settings/configs
 * Body: { config_key, config_value, value_type, category, description, is_sensitive, is_editable, company_id }
 */
router.post('/configs', authenticateToken, authorizeAdmin, validateCreateConfig, async (req, res) => {
  try {
    const userId = req.user?.id;
    const config = req.body;

    const created = await createSystemConfig(config, userId);

    res.status(201).json({
      success: true,
      message: 'Tạo cấu hình thành công',
      data: created
    });
  } catch (err) {
    console.error('Error creating system config:', err);
    
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({
        success: false,
        error: 'Config key đã tồn tại',
        message: `Config key "${req.body.config_key}" đã được sử dụng`
      });
    }

    res.status(500).json({
      success: false,
      error: 'Lỗi tạo cấu hình hệ thống',
      message: err.message
    });
  }
});

/**
 * Update system config
 * PUT /api/settings/config/:key
 * Body: { config_value, is_sensitive, is_editable }
 * Query: ?company_id=1 (optional, for company-specific configs)
 */
router.put('/config/:key', authenticateToken, authorizeAdmin, validateConfigKey, validateUpdateConfig, async (req, res) => {
  try {
    const { key } = req.params;
    const { company_id } = req.query;
    const userId = req.user?.id;
    const companyId = company_id ? parseInt(company_id) : null;

    const updated = await updateSystemConfig(key, req.body, companyId, userId);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy cấu hình',
        message: `Config key "${key}" không tồn tại`
      });
    }

    res.json({
      success: true,
      message: 'Cập nhật cấu hình thành công',
      data: updated
    });
  } catch (err) {
    console.error('Error updating system config:', err);
    res.status(500).json({
      success: false,
      error: 'Lỗi cập nhật cấu hình hệ thống',
      message: err.message
    });
  }
});

/**
 * Delete system config (soft delete)
 * DELETE /api/settings/config/:key
 * Query: ?company_id=1 (optional, for company-specific configs)
 */
router.delete('/config/:key', authenticateToken, authorizeAdmin, validateConfigKey, async (req, res) => {
  try {
    const { key } = req.params;
    const { company_id } = req.query;
    const userId = req.user?.id;
    const companyId = company_id ? parseInt(company_id) : null;

    const deleted = await deleteSystemConfig(key, companyId, userId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy cấu hình',
        message: `Config key "${key}" không tồn tại`
      });
    }

    res.json({
      success: true,
      message: 'Xóa cấu hình thành công'
    });
  } catch (err) {
    console.error('Error deleting system config:', err);
    res.status(500).json({
      success: false,
      error: 'Lỗi xóa cấu hình hệ thống',
      message: err.message
    });
  }
});

/**
 * Batch update system configs
 * POST /api/settings/configs/batch-update
 * Body: { configs: [{ key, value }] }
 * Query: ?company_id=1 (optional)
 */
router.post('/configs/batch-update', authenticateToken, authorizeAdmin, validateBatchUpdate, async (req, res) => {
  try {
    const { configs } = req.body;
    const { company_id } = req.query;
    const userId = req.user?.id;
    const companyId = company_id ? parseInt(company_id) : null;

    const result = await batchUpdateConfigs(configs, companyId, userId);

    res.json({
      success: true,
      message: `Batch update completed: ${result.success} success, ${result.failed} failed`,
      data: result
    });
  } catch (err) {
    console.error('Error batch updating system configs:', err);
    res.status(500).json({
      success: false,
      error: 'Lỗi batch update cấu hình hệ thống',
      message: err.message
    });
  }
});

/**
 * Export all system configs as JSON
 * GET /api/settings/configs/export
 * Query: ?company_id=1 (optional)
 */
router.get('/configs/export', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { company_id } = req.query;
    const companyId = company_id ? parseInt(company_id) : null;

    const configs = await exportSystemConfigs(companyId);

    res.json({
      success: true,
      data: configs,
      exported_at: new Date().toISOString(),
      company_id: companyId
    });
  } catch (err) {
    console.error('Error exporting system configs:', err);
    res.status(500).json({
      success: false,
      error: 'Lỗi export cấu hình hệ thống',
      message: err.message
    });
  }
});

/**
 * Import system configs from JSON
 * POST /api/settings/configs/import
 * Body: { configs: [...] }
 * Query: ?company_id=1 (optional)
 */
router.post('/configs/import', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { configs } = req.body;
    const { company_id } = req.query;
    const userId = req.user?.id;
    const companyId = company_id ? parseInt(company_id) : null;

    if (!Array.isArray(configs) || configs.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Configs array is required and must not be empty'
      });
    }

    const result = await importSystemConfigs(configs, companyId, userId);

    res.json({
      success: true,
      message: `Import completed: ${result.success} success, ${result.failed} failed`,
      data: result
    });
  } catch (err) {
    console.error('Error importing system configs:', err);
    res.status(500).json({
      success: false,
      error: 'Lỗi import cấu hình hệ thống',
      message: err.message
    });
  }
});

export default router;
