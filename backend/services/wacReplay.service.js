/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * wacReplay.service.js - WAC Replay Engine
 * 
 * Mục tiêu: Khi có backdated event (nhập kho ngày cũ), tự động tính lại
 * giá bình quân và sinh bút toán điều chỉnh COGS_ADJUSTED.
 * 
 * @FLOW:
 * 1. detectBackdatedEvent(voucher) — Phát hiện voucher có ngày cũ hơn
 * 2. triggerReplay(productId, voucherId) — Kích hoạt replay chain
 * 3. recalculateAndAdjust(productId) — Tính lại WAC và tạo adjustment entries
 */

import { pool } from '../config/db.js';
import { wacReplay as costingWacReplay } from './costingEngine.service.js';

/**
 * Phát hiện backdated event: voucher có ngày < ngày hiện tại
 * và là loại nhập kho (NK, PNK, PCK)
 */
async function detectBackdatedEvent(voucherId) {
  const { rows } = await pool.query(
    `SELECT v.id, v.voucher_date, v.voucher_type, v.company_id, vd.product_id
     FROM vouchers v
     JOIN voucher_details vd ON vd.voucher_id = v.id
     WHERE v.id = $1
       AND v.voucher_date < CURRENT_DATE
       AND v.voucher_type IN ('NK', 'PNK', 'PCK', 'IMPORT')`,
    [voucherId]
  );

  if (rows.length === 0) return null;

  // Group by product_id
  const products = {};
  rows.forEach(r => {
    if (!products[r.product_id]) {
      products[r.product_id] = {
        company_id: r.company_id,
        product_ids: []
      };
    }
    products[r.product_id].product_ids.push(r.product_id);
  });

  return Object.values(products);
}

/**
 * Kích hoạt replay chain cho 1 product
 */
async function triggerReplay(companyId, productId, options = {}) {
  const { warehouseId = null, reason = 'Backdated inbound event', voucherDate = null } = options;

  try {
    // 1. Gọi costing engine để tính lại WAC
    const adjustment = await costingWacReplay(companyId, productId, null, {
      warehouseId,
      reason,
      voucherDate
    });

    if (!adjustment) {
      return { success: true, message: 'Không có thay đổi giá vốn', adjustment: null };
    }

    // 2. Tạo voucher điều chỉnh COGS_ADJUSTED
    // Nếu kỳ đã đóng, voucher được tạo vào kỳ mở gần nhất
    const voucherDateToUse = adjustment.is_closed_period ? adjustment.target_period_start : (voucherDate || new Date().toISOString().split('T')[0]);
    const voucherId = await createAdjustmentVoucher(companyId, productId, adjustment, {
      ...options,
      voucherDate: voucherDateToUse
    });

    return {
      success: true,
      message: adjustment.is_closed_period 
        ? `Đã điều chỉnh giá vốn (period shift: ${voucherDate} → ${voucherDateToUse})`
        : 'Đã điều chỉnh giá vốn do backdated event',
      adjustment: {
        ...adjustment,
        voucher_id: voucherId,
        voucher_date: voucherDateToUse
      }
    };
  } catch (err) {
    console.error(`❌ Lỗi WAC Replay cho product_id=${productId}:`, err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Tạo voucher điều chỉnh giá vốn (COGS_ADJUSTED)
 */
async function createAdjustmentVoucher(companyId, productId, adjustment, options = {}) {
  const { warehouseId = null, createdBy = null, voucherDate = null } = options;
  const effectiveDate = voucherDate || new Date().toISOString().split('T')[0];

  // Tính chênh lệch: Nếu giá tăng → Tăng TK 632 (Giá vốn), giảm TK 156 (Hàng hóa)
  // Nếu giá giảm → Giảm TK 632, tăng TK 156
  const diff = adjustment.new_cost - adjustment.old_cost;
  const totalDiff = Math.round(diff * adjustment.quantity);

  const voucherNumber = `COGS-ADJ-${Date.now().toString().slice(-8)}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Tạo voucher master
    const vResult = await client.query(
      `INSERT INTO vouchers 
       (company_id, voucher_number, voucher_date, voucher_type, description, currency, exchange_rate, created_by, is_posted, posted_at, posted_by, amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        companyId,
        voucherNumber,
        effectiveDate,
        'COGS_ADJ',
        `Điều chỉnh giá vốn do backdated event. Product: ${productId}, Old: ${adjustment.old_cost}, New: ${adjustment.new_cost}${adjustment.is_closed_period ? ` (Period shift: ${adjustment.target_period_start})` : ''}`,
        'VND',
        1,
        createdBy,
        true, // is_posted
        new Date(),
        createdBy,
        Math.abs(totalDiff)
      ]
    );

    const voucherId = vResult.rows[0].id;

    // 2. Tạo voucher details
    if (totalDiff !== 0) {
      if (totalDiff > 0) {
        // Giá tăng: Tăng giá vốn, giảm hàng hóa
        await client.query(
          `INSERT INTO voucher_details 
           (voucher_id, account_code, entry_type, amount, partner_id, item_id, quantity, dimensions)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            voucherId,
            '632', // Giá vốn
            'DR',
            Math.abs(totalDiff),
            null,
            productId,
            adjustment.quantity,
            JSON.stringify({ adjustment_type: 'COGS_ADJUSTED', product_id: productId })
          ]
        );
        await client.query(
          `INSERT INTO voucher_details 
           (voucher_id, account_code, entry_type, amount, partner_id, item_id, quantity, dimensions)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            voucherId,
            '156', // Hàng hóa
            'CR',
            Math.abs(totalDiff),
            null,
            productId,
            adjustment.quantity,
            JSON.stringify({ adjustment_type: 'COGS_ADJUSTED', product_id: productId })
          ]
        );
      } else {
        // Giá giảm: Giảm giá vốn, tăng hàng hóa
        await client.query(
          `INSERT INTO voucher_details 
           (voucher_id, account_code, entry_type, amount, partner_id, item_id, quantity, dimensions)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            voucherId,
            '632', // Giá vốn
            'CR',
            Math.abs(totalDiff),
            null,
            productId,
            adjustment.quantity,
            JSON.stringify({ adjustment_type: 'COGS_ADJUSTED', product_id: productId })
          ]
        );
        await client.query(
          `INSERT INTO voucher_details 
           (voucher_id, account_code, entry_type, amount, partner_id, item_id, quantity, dimensions)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            voucherId,
            '156', // Hàng hóa
            'DR',
            Math.abs(totalDiff),
            null,
            productId,
            adjustment.quantity,
            JSON.stringify({ adjustment_type: 'COGS_ADJUSTED', product_id: productId })
          ]
        );
      }
    }

    // 3. Cập nhật cost_adjustment_log với voucher_id
    await client.query(
      `UPDATE cost_adjustment_log 
       SET voucher_id = $1 
       WHERE id = $2`,
      [voucherId, adjustment.adjustment_id]
    );

    await client.query('COMMIT');
    return voucherId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Batch replay: Kích hoạt replay cho nhiều products cùng lúc
 */
async function batchTriggerReplay(companyId, productIds, options = {}) {
  const results = [];
  
  for (const productId of productIds) {
    const result = await triggerReplay(companyId, productId, options);
    results.push({
      product_id: productId,
      ...result
    });
  }

  return {
    success: true,
    total: results.length,
    results
  };
}

export {
  detectBackdatedEvent,
  triggerReplay,
  batchTriggerReplay,
  createAdjustmentVoucher
};