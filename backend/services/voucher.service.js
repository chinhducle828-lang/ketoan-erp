/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * VoucherService - Service layer cho CRUD voucher
 * Được gọi bởi cả routes/vouchers.js (cũ) và routes/events.js (mới)
 * Tránh HTTP loopback: gọi trực tiếp function, không fetch nội bộ
 */

import { pool } from '../config/db.js';
import { buildPostingUpdateValues } from './voucherStatus.js';
import { buildMultiCurrencyDetail } from './multiCurrency.service.js';
import { logAction, logVoucherDetails } from './auditLog.service.js';
import { EventHelpers } from './eventStore.service.js';

export class VoucherService {
  /**
   * Tạo voucher mới (dùng chung cho routes cũ và events mới)
   * @param {Object} data - { company_id, voucher_number, voucher_date, voucher_type, description, currency, exchange_rate, details, is_posted }
   * @param {Object} options - { client: dbClient (optional, cho transaction), userId, ipAddress }
   * @returns {Promise<number>} voucherId
   */
  static async create(data, options = {}) {
    const client = options.client || pool;
    const isExternalClient = !!options.client;

    try {
      if (!isExternalClient) await client.query('BEGIN');

      const postingValues = buildPostingUpdateValues(data.is_posted, options.userId, new Date());

      // 1. Insert voucher master
      const vResult = await client.query(`
        INSERT INTO vouchers (
          company_id, voucher_number, voucher_date, voucher_type, description,
          currency, exchange_rate, created_by, is_posted, posted_at, posted_by, amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `, [
        data.company_id, data.voucher_number, data.voucher_date, data.voucher_type,
        data.description, data.currency || 'VND', data.exchange_rate || 1,
        options.userId, postingValues.is_posted, postingValues.posted_at,
        postingValues.posted_by, 0
      ]);
      const voucherId = vResult.rows[0].id;

      // 2. Insert voucher details (nếu có)
      if (data.details?.length > 0) {
        const valuesArr = [];
        const queryArgs = [];
        let idx = 1;

        for (const item of data.details) {
          const normalized = buildMultiCurrencyDetail(item, data.exchange_rate || 1);
          const dimensions = item.dimensions || item.dimensions_json || {};
          valuesArr.push(
            `($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7}, $${idx + 8}, $${idx + 9})`
          );
          queryArgs.push(
            voucherId,
            normalized.accountCode || normalized.account_code,
            normalized.entryType || normalized.entry_type,
            normalized.amount,
            normalized.partnerId || normalized.partner_id || null,
            normalized.itemId || normalized.item_id || null,
            normalized.quantity || 0,
            normalized.amountOrigin ?? normalized.amount_origin ?? null,
            normalized.currencyOrigin || normalized.currency_origin || 'VND',
            JSON.stringify(dimensions)
          );
          idx += 10; // Tăng chỉ số placeholder sau mỗi item
        }

        await client.query(
          `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount, partner_id, item_id, quantity, amount_origin, currency_origin, dimensions) VALUES ${valuesArr.join(', ')}`,
          queryArgs
        );
      }

      // 3. Audit log
      await logAction({
        userId: options.userId,
        action: 'CREATE',
        entityType: 'VOUCHERS',
        newValues: {
          voucher_number: data.voucher_number,
          voucher_date: data.voucher_date,
          voucher_type: data.voucher_type,
          is_posted: postingValues.is_posted
        },
        ipAddress: options.ipAddress || '0.0.0.0',
        companyId: data.company_id
      });

      // 3.1 Event Store log
      await EventHelpers.voucherCreated({
        id: voucherId,
        company_id: data.company_id,
        voucher_number: data.voucher_number,
        voucher_date: data.voucher_date,
        voucher_type: data.voucher_type,
        amount: 0,
        is_posted: postingValues.is_posted
      }, options.userId, {
        ip_address: options.ipAddress || '0.0.0.0',
        details_count: data.details?.length || 0
      });

      if (!isExternalClient) await client.query('COMMIT');
      return voucherId;
    } catch (err) {
      if (!isExternalClient) await client.query('ROLLBACK');
      throw err;
    } finally {
      if (!isExternalClient) client.release();
    }
  }

  /**
   * Ghi sổ chứng từ
   */
  static async post(voucherId, userId, ipAddress = '0.0.0.0') {
    const postingValues = buildPostingUpdateValues(true, userId, new Date());
    const result = await pool.query(
      'UPDATE vouchers SET is_posted = $1, posted_at = $2, posted_by = $3 WHERE id = $4 RETURNING id, is_posted, posted_at, posted_by, company_id, voucher_date',
      [postingValues.is_posted, postingValues.posted_at, postingValues.posted_by, voucherId]
    );
    
    const voucher = result.rows[0];
    
    // Event Store log
    await EventHelpers.voucherPosted({
      id: voucherId,
      company_id: voucher.company_id,
      voucher_date: voucher.voucher_date,
      is_posted: voucher.is_posted,
      posted_at: voucher.posted_at,
      posted_by: voucher.posted_by
    }, userId, {
      ip_address: ipAddress
    });
    
    return voucher;
  }

  /**
   * Xóa chứng từ (soft delete qua audit log)
   */
  static async delete(voucherId, userId, ipAddress) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const voucherRes = await client.query('SELECT * FROM vouchers WHERE id = $1', [voucherId]);
      if (voucherRes.rows.length === 0) throw new Error('Chứng từ không tồn tại');
      const voucher = voucherRes.rows[0];

      if (voucher.is_posted) {
        throw new Error('Chứng từ đã ghi sổ. Không cho phép xóa vật lý.');
      }

      // Audit log trước khi xóa
      await logAction({
        userId,
        action: 'DELETE',
        entityType: 'VOUCHERS',
        oldValues: voucher,
        ipAddress,
        companyId: voucher.company_id
      });

      // Event Store log
      await EventHelpers.voucherDeleted({
        id: voucherId,
        company_id: voucher.company_id,
        voucher_number: voucher.voucher_number,
        voucher_date: voucher.voucher_date,
        voucher_type: voucher.voucher_type,
        amount: voucher.amount
      }, userId, {
        ip_address: ipAddress,
        reason: 'User requested deletion'
      });

      await client.query('DELETE FROM voucher_details WHERE voucher_id = $1', [voucherId]);
      await client.query('DELETE FROM vouchers WHERE id = $1', [voucherId]);

      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}