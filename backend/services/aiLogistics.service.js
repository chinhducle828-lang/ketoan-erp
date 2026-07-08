/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiLogistics.service - AI tối ưu logistics
 * Tối ưu tuyến đường, dự báo thời gian giao hàng
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { AI_CONFIG } from '../config/aiConfig.js';

const PYTHON_AI_SERVICE_URL = AI_CONFIG.PYTHON_SERVICE_URL;

/**
 * Tối ưu tuyến đường giao hàng
 * @param {Array} orders - Danh sách đơn hàng
 * @param {Object} vehicles - Thông tin xe
 * @returns {Promise<Object>}
 */
export async function optimizeDeliveryRoute(orders, vehicles) {
  try {
    const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/optimize-route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orders,
        vehicles
      })
    });

    if (!response.ok) {
      throw new AppError(ErrorCodes.SERVICE_UNAVAILABLE, 'AI route optimization service không phản hồi', 503);
    }

    const result = await response.json();

    logger.info({
      ordersCount: orders.length,
      optimized: result.optimized_routes?.length || 0
    }, 'AI route optimization completed');

    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCodes.SERVICE_UNAVAILABLE, 'Lỗi kết nối AI route optimization service', 503);
  }
}

/**
 * Dự báo thời gian giao hàng
 * @param {string} companyId - ID công ty
 * @param {string} orderId - ID đơn hàng
 * @returns {Promise<Object>}
 */
export async function predictDeliveryTime(companyId, orderId) {
  const { rows: order } = await pool.query(
    `SELECT o.*, p.address as partner_address
     FROM orders o
     JOIN partners p ON o.partner_id = p.id
     WHERE o.id = $1 AND o.company_id = $2`,
    [orderId, companyId]
  );

  if (order.length === 0) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Không tìm thấy đơn hàng', 404);
  }

  // Lấy lịch sử giao hàng
  const { rows: history } = await pool.query(
    `SELECT 
      o2.id,
      o2.created_at,
      o2.delivered_at,
      EXTRACT(EPOCH FROM (o2.delivered_at - o2.created_at))/3600 as hours_to_deliver
    FROM orders o2
    WHERE o2.partner_id = $1
    AND o2.status = 'delivered'
    AND o2.created_at >= NOW() - INTERVAL '30 days'`,
    [order[0].partner_id]
  );

  // Gọi AI service
  const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/predict-delivery-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      order: order[0],
      history
    })
  });

  if (!response.ok) {
    return { 
      estimated_hours: 24,
      confidence: 0,
      suggestion: 'Không thể dự báo, mặc định 24 giờ'
    };
  }

  return response.json();
}

/**
 * Dự báo tải trọng kho
 * @param {string} companyId - ID công ty
 * @param {string} period - Kỳ (YYYY-MM)
 * @returns {Promise<Object>}
 */
export async function predictWarehouseLoad(companyId, period) {
  const { rows: items } = await pool.query(
    `SELECT 
      i.id,
      i.name,
      i.opening_quantity,
      COALESCE(SUM(od.quantity), 0) as ordered_quantity,
      COALESCE(SUM(id.quantity), 0) as delivered_quantity
    FROM items i
    LEFT JOIN order_details od ON i.id = od.item_id
    LEFT JOIN inventory_details id ON i.id = id.item_id
    WHERE i.company_id = $1
    AND (od.order_id IN (
      SELECT id FROM orders 
      WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', $2::date)
    ) OR id.voucher_id IN (
      SELECT id FROM vouchers 
      WHERE DATE_TRUNC('month', voucher_date) = DATE_TRUNC('month', $2::date)
    ))
    GROUP BY i.id, i.name, i.opening_quantity`,
    [companyId, period]
  );

  // Gọi AI service
  const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/predict-warehouse-load`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_id: companyId,
      period,
      items
    })
  });

  if (!response.ok) {
    return { error: 'AI service không phản hồi' };
  }

  return response.json();
}

export default {
  optimizeDeliveryRoute,
  predictDeliveryTime,
  predictWarehouseLoad
};