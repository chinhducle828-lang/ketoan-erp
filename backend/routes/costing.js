/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * routes/costing.js - CRUD + Query cho Strategy Costing Engine
 * 
 * Endpoints:
 *   GET    /api/costing/strategies?company_id=X
 *   POST   /api/costing/strategies
 *   PUT    /api/costing/strategies/:id
 *   DELETE /api/costing/strategies/:id
 *   GET    /api/costing/layers?company_id=X&product_id=Y
 *   POST   /api/costing/replay
 *   POST   /api/costing/replay/batch
 */

import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { 
  getStrategy, 
  invalidateStrategyCache,
  calculateCOGS,
  createInboundLayer,
  consumeLayers,
  getLayers,
  getLayerById
} from '../services/costingEngine.service.js';
import { triggerReplay, batchTriggerReplay } from '../services/wacReplay.service.js';

const router = Router();

// ====================================================================
// STRATEGIES CRUD
// ====================================================================

/**
 * GET /api/costing/strategies
 * Lấy danh sách strategies cho 1 company
 */
router.get('/strategies', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.user?.activeCompanyId;
    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id' });
    }

    const { rows } = await pool.query(
      `SELECT id, strategy_name, strategy_type, sku_pattern, product_id, warehouse_id, 
              config, priority, is_active, created_at, updated_at
       FROM costing_strategies
       WHERE company_id = $1
       ORDER BY priority DESC, created_at DESC`,
      [companyId]
    );

    const strategies = rows.map(r => ({
      ...r,
      config: typeof r.config === 'string' ? JSON.parse(r.config) : r.config
    }));

    res.json({ success: true, data: strategies });
  } catch (err) {
    console.error('❌ Lỗi lấy costing strategies:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/costing/strategies
 * Tạo strategy mới
 */
router.post('/strategies', authenticate, requireRole('admin', 'ktt'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { company_id, strategy_name, strategy_type, sku_pattern, product_id, warehouse_id, config, priority } = req.body;
    const companyId = company_id || req.user?.activeCompanyId;

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id' });
    }
    if (!strategy_name || !strategy_type) {
      return res.status(400).json({ success: false, error: 'Thiếu strategy_name hoặc strategy_type' });
    }

    const validTypes = ['AVCO', 'FIFO', 'STANDARD'];
    if (!validTypes.includes(strategy_type)) {
      return res.status(400).json({ success: false, error: `strategy_type phải là một trong: ${validTypes.join(', ')}` });
    }

    const { rows } = await client.query(
      `INSERT INTO costing_strategies 
       (company_id, strategy_name, strategy_type, sku_pattern, product_id, warehouse_id, config, priority, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        companyId,
        strategy_name,
        strategy_type,
        sku_pattern || null,
        product_id || null,
        warehouse_id || null,
        JSON.stringify(config || {}),
        priority || 0,
        req.user?.id
      ]
    );

    // Invalidate cache
    await invalidateStrategyCache(companyId);

    res.status(201).json({
      success: true,
      message: `Tạo strategy "${strategy_name}" thành công`,
      data: { id: rows[0].id }
    });
  } catch (err) {
    console.error('❌ Lỗi tạo costing strategy:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/costing/strategies/:id
 * Cập nhật strategy
 */
router.put('/strategies/:id', authenticate, requireRole('admin', 'ktt'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { strategy_name, strategy_type, sku_pattern, product_id, warehouse_id, config, priority, is_active } = req.body;

    // Lấy strategy cũ để invalidate cache
    const oldStrategy = await client.query(
      'SELECT company_id FROM costing_strategies WHERE id = $1',
      [id]
    );
    if (oldStrategy.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy strategy' });
    }

    const updates = [];
    const params = [];
    let paramCount = 0;

    if (strategy_name !== undefined) {
      paramCount++; updates.push(`strategy_name = $${paramCount}`); params.push(strategy_name);
    }
    if (strategy_type !== undefined) {
      paramCount++; updates.push(`strategy_type = $${paramCount}`); params.push(strategy_type);
    }
    if (sku_pattern !== undefined) {
      paramCount++; updates.push(`sku_pattern = $${paramCount}`); params.push(sku_pattern);
    }
    if (product_id !== undefined) {
      paramCount++; updates.push(`product_id = $${paramCount}`); params.push(product_id);
    }
    if (warehouse_id !== undefined) {
      paramCount++; updates.push(`warehouse_id = $${paramCount}`); params.push(warehouse_id);
    }
    if (config !== undefined) {
      paramCount++; updates.push(`config = $${paramCount}`); params.push(JSON.stringify(config));
    }
    if (priority !== undefined) {
      paramCount++; updates.push(`priority = $${paramCount}`); params.push(priority);
    }
    if (is_active !== undefined) {
      paramCount++; updates.push(`is_active = $${paramCount}`); params.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'Không có trường nào để cập nhật' });
    }

    paramCount++; updates.push(`updated_at = NOW()`);
    params.push(id);

    await client.query(
      `UPDATE costing_strategies SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      params
    );

    // Invalidate cache
    await invalidateStrategyCache(oldStrategy.rows[0].company_id);

    res.json({ success: true, message: 'Cập nhật strategy thành công' });
  } catch (err) {
    console.error('❌ Lỗi cập nhật costing strategy:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/costing/strategies/:id
 * Xóa strategy (soft delete)
 */
router.delete('/strategies/:id', authenticate, requireRole('admin', 'ktt'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const strategy = await client.query(
      'SELECT company_id FROM costing_strategies WHERE id = $1',
      [id]
    );
    if (strategy.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy strategy' });
    }

    await client.query(
      'UPDATE costing_strategies SET is_active = FALSE, updated_at = NOW() WHERE id = $1',
      [id]
    );

    await invalidateStrategyCache(strategy.rows[0].company_id);

    res.json({ success: true, message: 'Đã xóa strategy (soft delete)' });
  } catch (err) {
    console.error('❌ Lỗi xóa costing strategy:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ====================================================================
// LAYERS QUERY
// ====================================================================

/**
 * GET /api/costing/layers
 * Lấy danh sách layers cho 1 product
 */
router.get('/layers', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.user?.activeCompanyId;
    const productId = req.query.product_id;
    const warehouseId = req.query.warehouse_id;
    const layerType = req.query.layer_type;
    const onlyActive = req.query.only_active !== 'false';

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id' });
    }
    if (!productId) {
      return res.status(400).json({ success: false, error: 'Thiếu product_id' });
    }

    const layers = await getLayers(companyId, productId, {
      warehouseId: warehouseId || null,
      layerType: layerType || null,
      onlyActive
    });

    res.json({ success: true, data: layers });
  } catch (err) {
    console.error('❌ Lỗi lấy costing layers:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/costing/layers/:id
 * Lấy chi tiết 1 layer
 */
router.get('/layers/:id', authenticate, async (req, res) => {
  try {
    const layer = await getLayerById(req.params.id);
    if (!layer) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy layer' });
    }
    res.json({ success: true, data: layer });
  } catch (err) {
    console.error('❌ Lỗi lấy layer detail:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ====================================================================
// COGS CALCULATION
// ====================================================================

/**
 * POST /api/costing/calculate
 * Tính giá vốn cho 1 lần xuất kho (không tạo voucher)
 */
router.post('/calculate', authenticate, async (req, res) => {
  try {
    const { company_id, product_id, quantity, sku, warehouse_id, voucher_date } = req.body;
    const companyId = company_id || req.user?.activeCompanyId;

    if (!companyId || !product_id || !quantity) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id, product_id, quantity' });
    }

    const result = await calculateCOGS(companyId, product_id, quantity, sku, warehouse_id, voucher_date);

    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('❌ Lỗi tính COGS:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ====================================================================
// REPLAY
// ====================================================================

/**
 * POST /api/costing/replay
 * Kích hoạt WAC Replay cho 1 product
 */
router.post('/replay', authenticate, requireRole('admin', 'ktt'), async (req, res) => {
  try {
    const { company_id, product_id, warehouse_id, reason } = req.body;
    const companyId = company_id || req.user?.activeCompanyId;

    if (!companyId || !product_id) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id, product_id' });
    }

    const result = await triggerReplay(companyId, product_id, {
      warehouseId: warehouse_id || null,
      reason: reason || 'Manual WAC replay',
      createdBy: req.user?.id
    });

    res.json(result);
  } catch (err) {
    console.error('❌ Lỗi WAC replay:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/costing/replay/batch
 * Batch replay cho nhiều products
 */
router.post('/replay/batch', authenticate, requireRole('admin', 'ktt'), async (req, res) => {
  try {
    const { company_id, product_ids, warehouse_id, reason } = req.body;
    const companyId = company_id || req.user?.activeCompanyId;

    if (!companyId || !product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id, product_ids (array)' });
    }

    const result = await batchTriggerReplay(companyId, product_ids, {
      warehouseId: warehouse_id || null,
      reason: reason || 'Batch WAC replay',
      createdBy: req.user?.id
    });

    res.json(result);
  } catch (err) {
    console.error('❌ Lỗi batch WAC replay:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;