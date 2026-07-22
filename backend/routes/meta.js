/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * routes/meta.js - Meta API cho Server-Driven UI
 * GET /api/meta/:entityType/ui-schema — UI Schema cho DynamicForm
 * GET /api/meta/:entityType/grid-columns — Grid columns cho DynamicGrid
 */

import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getUISchema, getGridColumns } from '../services/metaApi.service.js';
import {
  createEntityConfig,
  updateEntityConfig,
  listEntityConfigs,
  getEntityConfig,
  deleteEntityConfig
} from '../services/metaAdmin.service.js';

const router = Router();

/**
 * GET /api/meta
 * Lấy danh sách entity configs cho 1 company (admin)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.user?.activeCompanyId;
    if (!companyId) return res.status(400).json({ error: 'Thiếu company_id' });

    const configs = await listEntityConfigs(companyId);
    res.json({ success: true, data: configs });
  } catch (err) {
    console.error('Lỗi lấy danh sách entity configs:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/meta
 * Tạo entity config mới (admin)
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const companyId = req.body.company_id || req.user?.activeCompanyId;
    if (!companyId) return res.status(400).json({ error: 'Thiếu company_id' });
    if (!req.body.entity_type) return res.status(400).json({ error: 'Thiếu entity_type' });

    const config = await createEntityConfig({
      entityType: req.body.entity_type,
      companyId,
      tableName: req.body.table_name || null,
      uiSchema: req.body.ui_schema || null,
      gridColumns: req.body.grid_columns || null,
      permissions: req.body.permissions || null,
      createdBy: req.user?.id
    });

    res.status(201).json({ success: true, data: config });
  } catch (err) {
    console.error('Lỗi tạo entity config:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/meta/:entityType
 * Lấy chi tiết 1 entity config
 */
router.get('/:entityType', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.user?.activeCompanyId;
    if (!companyId) return res.status(400).json({ error: 'Thiếu company_id' });

    const config = await getEntityConfig(req.params.entityType, companyId);
    if (!config) {
      return res.status(404).json({ success: false, error: `Entity type "${req.params.entityType}" không tồn tại` });
    }

    res.json({ success: true, data: config });
  } catch (err) {
    console.error('Lỗi lấy entity config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/meta/:entityType/ui-schema
 * Trả về cấu hình form động cho 1 loại nghiệp vụ
 */
router.get('/:entityType/ui-schema', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.user?.activeCompanyId;
    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu company_id' });
    }

    const schema = await getUISchema(req.params.entityType, companyId);
    if (!schema) {
      return res.status(404).json({
        success: false,
        error: `Không tìm thấy UI Schema cho ${req.params.entityType}`
      });
    }

    res.json({
      success: true,
      data: schema,
      version: Date.now()
    });
  } catch (err) {
    console.error('Lỗi lấy UI Schema:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/meta/:entityType/grid-columns
 * Trả về cấu hình cột cho Data Grid động
 */
router.get('/:entityType/grid-columns', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.user?.activeCompanyId;
    const columns = await getGridColumns(req.params.entityType, companyId);

    res.json({
      success: true,
      data: columns
    });
  } catch (err) {
    console.error('Lỗi lấy grid columns:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/meta/:entityType (admin: update schema)
 * Cho phép admin cập nhật UI Schema / Grid Columns
 */
router.put('/:entityType', authenticate, async (req, res) => {
  try {
    const companyId = req.body.company_id || req.user?.activeCompanyId;
    if (!companyId) return res.status(400).json({ error: 'Thiếu company_id' });

    const config = await updateEntityConfig({
      entityType: req.params.entityType,
      companyId,
      uiSchema: req.body.ui_schema || null,
      gridColumns: req.body.grid_columns || null,
      permissions: req.body.permissions || null
    });

    res.json({ success: true, data: config, message: 'Cập nhật thành công' });
  } catch (err) {
    console.error('Lỗi cập nhật entity config:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/meta/:entityType (admin)
 * Soft delete entity config
 */
router.delete('/:entityType', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.user?.activeCompanyId;
    if (!companyId) return res.status(400).json({ error: 'Thiếu company_id' });

    const deleted = await deleteEntityConfig(req.params.entityType, companyId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy entity config' });
    }

    res.json({ success: true, message: 'Xóa thành công' });
  } catch (err) {
    console.error('Lỗi xóa entity config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
