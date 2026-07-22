/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * costingEngine.service.js - Strategy Pattern Costing Engine
 * 
 * Mục tiêu: Tính giá vốn theo phương pháp AVCO/FIFO/Standard Costing
 * cho từng SKU, với khả năng replay khi có backdated events.
 * 
 * @STRATEGIES:
 * - AVCO (Bình quân gia quyền): Tính lại giá bình quân sau mỗi nhập kho
 * - FIFO (Nhập trước xuất trước): Lấy từ lớp nhập kho cũ nhất
 * - STANDARD (Giá định mức): Dùng giá cố định, cuối kỳ tính chênh lệch
 * 
 * @FLOW:
 * 1. getStrategy(companyId, productId, sku) — Xác định strategy cho SKU
 * 2. calculateCOGS(companyId, productId, quantity, date) — Tính giá vốn
 * 3. createInboundLayer(...) — Tạo layer khi nhập kho
 * 4. consumeLayers(...) — Tiêu thụ layers khi xuất kho
 * 5. recalculateAVCO(...) — Tính lại AVCO khi có backdated event
 */

import { pool } from '../config/db.js';
import { redis as redisClient, isRedisReadyCheck } from '../cache/redis.js';

const CACHE_TTL = 300; // 5 phút
const STRATEGY_CACHE_PREFIX = 'costing_strategy:';

// ====================================================================
// Helper: Lấy strategy cho 1 product + company
// ====================================================================
async function getStrategy(companyId, productId, sku = null) {
  const cacheKey = `${STRATEGY_CACHE_PREFIX}${companyId}:${productId || 'global'}`;
  
  // Thử cache
  if (isRedisReadyCheck()) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {
      // Cache miss
    }
  }

  // Query DB: tìm strategy phù hợp nhất (priority cao nhất)
  const query = `
    SELECT id, strategy_name, strategy_type, sku_pattern, product_id, warehouse_id, config, priority
    FROM costing_strategies
    WHERE company_id = $1 
      AND is_active = TRUE
      AND (
        product_id = $2
        OR (product_id IS NULL AND sku_pattern IS NOT NULL AND $3 LIKE REPLACE(sku_pattern, '*', '%'))
        OR (product_id IS NULL AND sku_pattern IS NULL)
      )
    ORDER BY priority DESC
    LIMIT 1
  `;

  const { rows } = await pool.query(query, [companyId, productId, sku || '']);
  
  if (rows.length === 0) {
    // Fallback: AVCO mặc định
    return {
      strategy_type: 'AVCO',
      config: { round_precision: 2 }
    };
  }

  const strategy = {
    ...rows[0],
    config: typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : rows[0].config
  };

  // Cache
  if (isRedisReadyCheck()) {
    try {
      await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(strategy));
    } catch (e) {
      // Silent fail
    }
  }

  return strategy;
}

// ====================================================================
// Helper: Invalidate cache cho 1 company
// ====================================================================
async function invalidateStrategyCache(companyId) {
  if (!isRedisReadyCheck()) return;
  
  try {
    const keys = await redisClient.keys(`${STRATEGY_CACHE_PREFIX}${companyId}:*`);
    if (keys.length > 0) await redisClient.del(...keys);
  } catch (e) {
    // Silent fail
  }
}

// ====================================================================
// AVCO: Tính giá bình quân gia quyền
// ====================================================================
async function calculateAVCO(companyId, productId, warehouseId = null) {
  const query = `
    SELECT 
      SUM(quantity) as total_qty,
      SUM(total_cost) as total_cost,
      CASE 
        WHEN SUM(quantity) > 0 THEN ROUND(SUM(total_cost) / SUM(quantity), 2)
        ELSE 0 
      END as avg_cost
    FROM inventory_costing_layers
    WHERE company_id = $1 
      AND product_id = $2 
      AND layer_type = 'AVCO'
      AND remaining_quantity > 0
      AND is_consumed = FALSE
      ${warehouseId ? 'AND warehouse_id = $3' : ''}
  `;

  const params = warehouseId ? [companyId, productId, warehouseId] : [companyId, productId];
  const { rows } = await pool.query(query, params);
  
  const result = rows[0];
  const totalQty = parseFloat(result.total_qty) || 0;
  const avgCost = totalQty > 0 ? parseFloat(result.avg_cost) || 0 : 0;
  
  return {
    total_quantity: totalQty,
    total_cost: parseFloat(result.total_cost) || 0,
    avg_cost: avgCost
  };
}

// ====================================================================
// FIFO: Lấy layers cũ nhất để xuất kho
// ====================================================================
async function getFIFOLayers(companyId, productId, quantityNeeded, warehouseId = null) {
  const query = `
    SELECT id, remaining_quantity, unit_cost, total_cost, effective_date, voucher_id
    FROM inventory_costing_layers
    WHERE company_id = $1 
      AND product_id = $2 
      AND layer_type = 'FIFO'
      AND remaining_quantity > 0
      AND is_consumed = FALSE
      ${warehouseId ? 'AND warehouse_id = $3' : ''}
    ORDER BY effective_date ASC, id ASC
    FOR UPDATE
  `;

  const params = warehouseId ? [companyId, productId, warehouseId] : [companyId, productId];
  const { rows } = await pool.query(query, params);

  const layers = [];
  let remainingQty = quantityNeeded;

  for (const layer of rows) {
    if (remainingQty <= 0) break;

    const availableQty = parseFloat(layer.remaining_quantity);
    const consumeQty = Math.min(availableQty, remainingQty);
    const consumeCost = Math.round(consumeQty * parseFloat(layer.unit_cost));

    layers.push({
      layer_id: layer.id,
      quantity: consumeQty,
      unit_cost: parseFloat(layer.unit_cost),
      total_cost: consumeCost,
      effective_date: layer.effective_date
    });

    remainingQty -= consumeQty;
  }

  if (remainingQty > 0) {
    throw new Error(`Không đủ hàng trong kho. Thiếu ${remainingQty} đơn vị cho product_id=${productId}`);
  }

  return layers;
}

// ====================================================================
// STANDARD: Lấy giá định mức
// ====================================================================
function getStandardCost(strategy, productId) {
  const standardCost = strategy.config?.standard_cost || 0;
  if (standardCost <= 0) {
    throw new Error(`Không có giá định mức cho product_id=${productId}. Cấu hình trong costing_strategies.config.standard_cost`);
  }
  return standardCost;
}

// ====================================================================
// Helper: Lấy fallback cost khi kho âm
// ====================================================================
async function getFallbackCost(companyId, productId, sku = null) {
  // 1. Thử lấy từ last purchase cost
  const lastPurchase = await pool.query(
    `SELECT unit_cost FROM inventory_costing_layers
     WHERE company_id = $1 AND product_id = $2 AND layer_type IN ('AVCO', 'FIFO')
     ORDER BY effective_date DESC, id DESC
     LIMIT 1`,
    [companyId, productId]
  );

  if (lastPurchase.rows.length > 0) {
    return parseFloat(lastPurchase.rows[0].unit_cost);
  }

  // 2. Thử lấy từ standard cost trong costing_strategies
  const strategy = await getStrategy(companyId, productId, sku);
  if (strategy.strategy_type === 'STANDARD' && strategy.config?.standard_cost > 0) {
    return strategy.config.standard_cost;
  }

  // 3. Fallback cuối cùng: 0
  return 0;
}

// ====================================================================
// Helper: Log negative inventory
// ====================================================================
async function logNegativeInventory(companyId, productId, warehouseId, eventType, quantityBefore, quantityAfter, fallbackCost, fallbackCostSource, voucherId, reason, createdBy) {
  await pool.query(
    `INSERT INTO negative_inventory_log 
     (company_id, product_id, warehouse_id, event_type, quantity_before, quantity_after, 
      fallback_cost, fallback_cost_source, voucher_id, reason, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [companyId, productId, warehouseId, eventType, quantityBefore, quantityAfter,
     fallbackCost, fallbackCostSource, voucherId, reason, createdBy]
  );
}

// ====================================================================
// Core: Tính giá vốn cho 1 lần xuất kho
// ====================================================================
async function calculateCOGS(companyId, productId, quantity, sku = null, warehouseId = null, voucherDate = null) {
  const strategy = await getStrategy(companyId, productId, sku);
  const effectiveDate = voucherDate || new Date().toISOString().split('T')[0];

  switch (strategy.strategy_type) {
    case 'AVCO': {
      const avco = await calculateAVCO(companyId, productId, warehouseId);
      
      // Nếu kho âm hoặc không đủ hàng, dùng fallback cost
      if (avco.total_quantity < quantity) {
        const fallbackCost = await getFallbackCost(companyId, productId, sku);
        
        // Log negative inventory
        await logNegativeInventory(
          companyId, productId, warehouseId, 'OUTBOUND',
          avco.total_quantity, avco.total_quantity - quantity,
          fallbackCost, 'LAST_PURCHASE_OR_STANDARD',
          null, `Kho âm: cần xuất ${quantity}, tồn kho ${avco.total_quantity}`,
          null
        );
        
        return {
          strategy_type: 'AVCO_NEGATIVE',
          unit_cost: fallbackCost,
          total_cost: Math.round(quantity * fallbackCost),
          layers: [{ quantity, unit_cost: fallbackCost, total_cost: Math.round(quantity * fallbackCost), is_fallback: true }],
          warning: `Kho âm. Sử dụng fallback cost: ${fallbackCost}`
        };
      }
      
      return {
        strategy_type: 'AVCO',
        unit_cost: avco.avg_cost,
        total_cost: Math.round(quantity * avco.avg_cost),
        layers: [{ quantity, unit_cost: avco.avg_cost, total_cost: Math.round(quantity * avco.avg_cost) }]
      };
    }

    case 'FIFO': {
      try {
        const fifoLayers = await getFIFOLayers(companyId, productId, quantity, warehouseId);
        const totalCost = fifoLayers.reduce((sum, l) => sum + l.total_cost, 0);
        return {
          strategy_type: 'FIFO',
          unit_cost: Math.round(totalCost / quantity),
          total_cost: totalCost,
          layers: fifoLayers
        };
      } catch (err) {
        // FIFO không đủ hàng, dùng fallback
        const fallbackCost = await getFallbackCost(companyId, productId, sku);
        
        await logNegativeInventory(
          companyId, productId, warehouseId, 'OUTBOUND',
          0, -quantity,
          fallbackCost, 'LAST_PURCHASE_OR_STANDARD',
          null, `Kho âm FIFO: ${err.message}`,
          null
        );
        
        return {
          strategy_type: 'FIFO_NEGATIVE',
          unit_cost: fallbackCost,
          total_cost: Math.round(quantity * fallbackCost),
          layers: [{ quantity, unit_cost: fallbackCost, total_cost: Math.round(quantity * fallbackCost), is_fallback: true }],
          warning: `Kho âm FIFO. Sử dụng fallback cost: ${fallbackCost}`
        };
      }
    }

    case 'STANDARD': {
      const standardCost = getStandardCost(strategy, productId);
      return {
        strategy_type: 'STANDARD',
        unit_cost: standardCost,
        total_cost: Math.round(quantity * standardCost),
        layers: [{ quantity, unit_cost: standardCost, total_cost: Math.round(quantity * standardCost) }]
      };
    }

    default:
      throw new Error(`Strategy type không hỗ trợ: ${strategy.strategy_type}`);
  }
}

// ====================================================================
// Tạo layer khi nhập kho (Purchase, Production, Transfer In)
// ====================================================================
async function createInboundLayer(companyId, productId, quantity, unitCost, voucherId, options = {}) {
  const {
    warehouseId = null,
    referenceNo = null,
    effectiveDate = new Date().toISOString().split('T')[0],
    layerType = 'AVCO' // Mặc định AVCO, có thể override
  } = options;

  const totalCost = Math.round(quantity * unitCost);

  const { rows } = await pool.query(
    `INSERT INTO inventory_costing_layers 
     (company_id, product_id, warehouse_id, layer_type, quantity, remaining_quantity, unit_cost, total_cost, voucher_id, reference_no, effective_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [companyId, productId, warehouseId, layerType, quantity, quantity, unitCost, totalCost, voucherId, referenceNo, effectiveDate]
  );

  // Nếu là AVCO, cập nhật lại giá bình quân
  if (layerType === 'AVCO') {
    await recalculateAVCO(companyId, productId, warehouseId);
  }

  return rows[0].id;
}

// ====================================================================
// Tiêu thụ layers khi xuất kho (Sale, Consumption, Transfer Out)
// ====================================================================
async function consumeLayers(companyId, productId, quantity, sku = null, warehouseId = null, voucherDate = null) {
  const strategy = await getStrategy(companyId, productId, sku);
  const cogsResult = await calculateCOGS(companyId, productId, quantity, sku, warehouseId, voucherDate);

  // Cập nhật remaining_quantity cho các layers đã tiêu thụ
  for (const layer of cogsResult.layers) {
    if (layer.layer_id) {
      await pool.query(
        `UPDATE inventory_costing_layers
         SET remaining_quantity = remaining_quantity - $1, is_consumed = (remaining_quantity - $1 <= 0)
         WHERE id = $2`,
        [layer.quantity, layer.layer_id]
      );
    }
  }

  return cogsResult;
}

// ====================================================================
// AVCO Replay: Tính lại giá bình quân khi có backdated event
// ====================================================================
async function recalculateAVCO(companyId, productId, warehouseId = null) {
  const avco = await calculateAVCO(companyId, productId, warehouseId);
  
  // Cập nhật hoặc tạo AVCO layer mới
  if (avco.total_quantity > 0) {
    await pool.query(
      `UPDATE inventory_costing_layers
       SET unit_cost = $1, total_cost = $2, updated_at = NOW()
       WHERE company_id = $3 
         AND product_id = $4 
         AND layer_type = 'AVCO'
         AND remaining_quantity > 0
         AND is_consumed = FALSE
         ${warehouseId ? 'AND warehouse_id = $5' : ''}`,
      warehouseId 
        ? [avco.avg_cost, avco.total_cost, companyId, productId, warehouseId]
        : [avco.avg_cost, avco.total_cost, companyId, productId]
    );
  }

  return avco;
}

// ====================================================================
// WAC Replay: Khi có backdated inbound, tính lại WAC và sinh COGS_ADJUSTED
// ====================================================================
async function wacReplay(companyId, productId, backdatedVoucherId, options = {}) {
  const { warehouseId = null, reason = 'Backdated inbound event', voucherDate = null } = options;
  const effectiveDate = voucherDate || new Date().toISOString().split('T')[0];

  // 1. Kiểm tra xem ngày giao dịch có nằm trong kỳ đã đóng không
  const isClosedPeriod = await pool.query(
    `SELECT is_date_in_closed_period($1, $2) as is_closed`,
    [companyId, effectiveDate]
  );

  const isClosed = isClosedPeriod.rows[0]?.is_closed || false;

  // 2. Lấy AVCO cũ
  const oldAVCO = await calculateAVCO(companyId, productId, warehouseId);
  const oldUnitCost = oldAVCO.avg_cost;

  // 3. Tính lại AVCO mới (bao gồm cả backdated inbound)
  const newAVCO = await recalculateAVCO(companyId, productId, warehouseId);
  const newUnitCost = newAVCO.avg_cost;

  // 4. Nếu có thay đổi, tạo cost_adjustment_log
  if (Math.abs(newUnitCost - oldUnitCost) > 0.01) {
    const adjustmentAmount = Math.round(newAVCO.total_quantity * (newUnitCost - oldUnitCost));
    
    // Nếu kỳ đã đóng, tìm kỳ mở gần nhất để ghi nhận adjustment
    let targetPeriodStart = effectiveDate;
    let targetPeriodEnd = effectiveDate;
    let distributionType = 'FULL';

    if (isClosed) {
      const nextOpenPeriod = await pool.query(
        `SELECT start_date, end_date FROM get_next_open_period($1, $2)`,
        [companyId, effectiveDate]
      );

      if (nextOpenPeriod.rows.length > 0) {
        targetPeriodStart = nextOpenPeriod.rows[0].start_date;
        targetPeriodEnd = nextOpenPeriod.rows[0].end_date;
        distributionType = 'PERIOD_SHIFT';
      }
    }

    const adjustmentId = await pool.query(
      `INSERT INTO cost_adjustment_log 
       (company_id, product_id, adjustment_type, old_cost, new_cost, quantity, total_adjustment, reason, source_event_id, voucher_id)
       VALUES ($1, $2, 'COGS_ADJUSTED', $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        companyId, productId, 
        oldUnitCost, newUnitCost, 
        newAVCO.total_quantity,
        adjustmentAmount,
        isClosed ? `${reason} (Period shift: ${effectiveDate} → ${targetPeriodStart})` : reason,
        backdatedVoucherId?.toString(),
        backdatedVoucherId
      ]
    );

    const adjustment = {
      adjustment_id: adjustmentId.rows[0].id,
      old_cost: oldUnitCost,
      new_cost: newUnitCost,
      quantity: newAVCO.total_quantity,
      total_adjustment: adjustmentAmount,
      is_closed_period: isClosed,
      target_period_start: targetPeriodStart,
      target_period_end: targetPeriodEnd,
      distribution_type: distributionType
    };

    // Nếu kỳ đã đóng, tạo distribution record
    if (isClosed) {
      await pool.query(
        `INSERT INTO cost_adjustment_distribution
         (company_id, product_id, original_adjustment_id, source_period_start, source_period_end,
          target_period_start, target_period_end, adjustment_amount, quantity, distribution_type, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          companyId, productId, adjustmentId.rows[0].id,
          effectiveDate, effectiveDate,
          targetPeriodStart, targetPeriodEnd,
          adjustmentAmount, newAVCO.total_quantity,
          distributionType,
          `Period shift from ${effectiveDate} to ${targetPeriodStart}`
        ]
      );
    }

    return adjustment;
  }

  return null;
}

// ====================================================================
// Query: Lấy danh sách layers cho 1 product
// ====================================================================
async function getLayers(companyId, productId, options = {}) {
  const { warehouseId = null, layerType = null, onlyActive = true } = options;

  let query = `
    SELECT id, warehouse_id, layer_type, quantity, remaining_quantity, unit_cost, total_cost, 
           voucher_id, reference_no, effective_date, is_consumed, created_at
    FROM inventory_costing_layers
    WHERE company_id = $1 AND product_id = $2
  `;
  const params = [companyId, productId];
  let paramCount = 2;

  if (warehouseId) {
    paramCount++;
    query += ` AND warehouse_id = $${paramCount}`;
    params.push(warehouseId);
  }

  if (layerType) {
    paramCount++;
    query += ` AND layer_type = $${paramCount}`;
    params.push(layerType);
  }

  if (onlyActive) {
    query += ` AND remaining_quantity > 0 AND is_consumed = FALSE`;
  }

  query += ` ORDER BY effective_date DESC, id DESC`;

  const { rows } = await pool.query(query, params);
  return rows.map(r => ({
    ...r,
    quantity: parseFloat(r.quantity),
    remaining_quantity: parseFloat(r.remaining_quantity),
    unit_cost: parseFloat(r.unit_cost),
    total_cost: parseFloat(r.total_cost)
  }));
}

// ====================================================================
// Query: Lấy chi tiết 1 layer
// ====================================================================
async function getLayerById(layerId) {
  const { rows } = await pool.query(
    `SELECT * FROM inventory_costing_layers WHERE id = $1`,
    [layerId]
  );
  
  if (rows.length === 0) return null;
  
  const r = rows[0];
  return {
    ...r,
    quantity: parseFloat(r.quantity),
    remaining_quantity: parseFloat(r.remaining_quantity),
    unit_cost: parseFloat(r.unit_cost),
    total_cost: parseFloat(r.total_cost)
  };
}

export {
  getStrategy,
  invalidateStrategyCache,
  calculateCOGS,
  createInboundLayer,
  consumeLayers,
  recalculateAVCO,
  wacReplay,
  getLayers,
  getLayerById,
  calculateAVCO,
  getFIFOLayers,
  getStandardCost
};