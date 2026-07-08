/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiInventory.service - AI dự báo tồn kho
 * Dự báo nhu cầu mua hàng, cảnh báo tồn thừa/thiếu
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { AI_CONFIG } from '../config/aiConfig.js';

/**
 * Dự báo nhu cầu mua hàng dựa trên xu hướng
 * @param {string} companyId - ID công ty
 * @param {number} [days=30] - Số ngày dự báo
 * @returns {Promise<Object>}
 */
export async function predictInventoryNeeds(companyId, days = 30) {
  // Lấy dữ liệu bán hàng 30 ngày qua
  const { rows: sales } = await pool.query(
    `SELECT 
      i.id as item_id,
      i.item_code,
      i.item_name,
      i.opening_quantity,
      SUM(od.quantity) as sold_quantity,
      AVG(od.quantity) as avg_daily_sales
    FROM items i
    LEFT JOIN order_details od ON i.id = od.item_id
    LEFT JOIN orders o ON od.order_id = o.id
    WHERE i.company_id = $1
    AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY i.id, i.item_code, i.item_name, i.opening_quantity`,
    [companyId]
  );

  const predictions = [];
  const alerts = [];

  for (const item of sales) {
    const avgDaily = Number(item.avg_daily_sales) || 0;
    const currentStock = Number(item.opening_quantity) || 0;
    const predictedNeed = avgDaily * days;
    const daysRemaining = avgDaily > 0 ? Math.floor(currentStock / avgDaily) : 999;

    predictions.push({
      item_id: item.item_id,
      item_code: item.item_code,
      item_name: item.item_name,
      current_stock: currentStock,
      predicted_need: predictedNeed,
      days_remaining: daysRemaining,
      recommended_order: Math.max(0, predictedNeed - currentStock)
    });

    // Cảnh báo tồn kho
    if (daysRemaining < AI_CONFIG.INVENTORY.LOW_STOCK_DAYS && daysRemaining > 0) {
      alerts.push({
        type: 'low_stock',
        severity: 'high',
        item_id: item.item_id,
        item_name: item.item_name,
        message: `Hàng ${item.item_code} còn ${daysRemaining} ngày nữa hết`,
        days_remaining: daysRemaining
      });
    } else if (daysRemaining > AI_CONFIG.INVENTORY.OVERSTOCK_DAYS) {
      alerts.push({
        type: 'overstock',
        severity: 'medium',
        item_id: item.item_id,
        item_name: item.item_name,
        message: `Hàng ${item.item_code} tồn quá ${AI_CONFIG.INVENTORY.OVERSTOCK_DAYS} ngày, cân nhắc giảm giá`,
        days_remaining: daysRemaining
      });
    }
  }

  logger.info({ 
    companyId, 
    predictions: predictions.length,
    alerts: alerts.length 
  }, 'AI inventory prediction completed');

  return {
    period_days: days,
    predictions,
    alerts,
    confidence: 80
  };
}

/**
 * Dự báo ABC analysis cho hàng hóa
 * @param {string} companyId - ID công ty
 * @returns {Promise<Array>}
 */
export async function generateABCAnalysis(companyId) {
  const { rows } = await pool.query(
    `SELECT 
      i.id,
      i.item_code,
      i.item_name,
      SUM(od.quantity * od.unit_price) as total_value
    FROM items i
    LEFT JOIN order_details od ON i.id = od.item_id
    LEFT JOIN orders o ON od.order_id = o.id
    WHERE i.company_id = $1
    AND o.created_at >= CURRENT_DATE - INTERVAL '1 year'
    GROUP BY i.id, i.item_code, i.item_name
    ORDER BY total_value DESC`,
    [companyId]
  );

  const totalValue = rows.reduce((sum, r) => sum + Number(r.total_value), 0);
  let cumulative = 0;

  return rows.map(row => {
    cumulative += Number(row.total_value);
    const percentage = (cumulative / totalValue * 100).toFixed(1);
    
    let category = 'C';
    if (percentage <= 70) category = 'A';
    else if (percentage <= 90) category = 'B';

    return {
      ...row,
      total_value: Number(row.total_value),
      cumulative_percentage: percentage,
      category
    };
  });
}

/**
 * Tối ưu giá bán dựa trên tồn kho
 * @param {string} companyId - ID công ty
 * @returns {Promise<Array>}
 */
export async function suggestPriceOptimization(companyId) {
  const { rows } = await pool.query(
    `SELECT 
      i.id,
      i.item_code,
      i.item_name,
      i.opening_quantity,
      i.price_sell,
      COALESCE(SUM(od.quantity), 0) as sold_30days
    FROM items i
    LEFT JOIN order_details od ON i.id = od.item_id
    LEFT JOIN orders o ON od.order_id = o.id AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'
    WHERE i.company_id = $1
    GROUP BY i.id, i.item_code, i.item_name, i.opening_quantity, i.price_sell`,
    [companyId]
  );

  return rows
    .filter(row => Number(row.opening_quantity) > 100 && Number(row.sold_30days) < 5)
    .map(row => ({
      item_id: row.id,
      item_code: row.item_code,
      item_name: row.item_name,
      current_price: row.price_sell,
      suggested_discount: 10, // Giảm 10%
      reason: 'Tồn kho cao, bán chậm'
    }));
}

export default {
  predictInventoryNeeds,
  generateABCAnalysis,
  suggestPriceOptimization
};