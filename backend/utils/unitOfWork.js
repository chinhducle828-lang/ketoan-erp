/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * UnitOfWork - Transaction wrapper
 * Tập trung quản lý transaction, tránh rò rỉ kết nối
 */

import { pool } from '../config/db.js';
import logger from './logger.js';

/**
 * @typedef {Object} UnitOfWorkResult
 * @property {boolean} success - Transaction thành công
 * @property {*} data - Kết quả trả về
 * @property {Error} [error] - Lỗi nếu có
 */

export const UnitOfWork = {
  /**
   * Thực thi function trong transaction
   * @param {Function} fn - Function nhận client và trả về kết quả
   * @param {string} [traceId] - Trace ID để log
   * @returns {Promise<UnitOfWorkResult>}
   */
  async transaction(fn, traceId = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      logger.debug({ traceId, action: 'transaction_begin' }, 'Transaction started');
      
      const result = await fn(client);
      
      await client.query('COMMIT');
      logger.debug({ traceId, action: 'transaction_commit' }, 'Transaction committed');
      
      return { success: true, data: result };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({ traceId, action: 'transaction_rollback', error: error.message }, 'Transaction rolled back');
      return { success: false, error };
    } finally {
      client.release();
    }
  },

  /**
   * Thực thi nhiều queries độc lập (không transaction)
   * Dùng cho các thao tác chỉ đọc hoặc không cần atomicity
   * @param {Function} fn - Function nhận client
   * @param {string} [traceId] - Trace ID để log
   * @returns {Promise<*>}
   */
  async execute(fn, traceId = null) {
    const client = await pool.connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }
};

export default UnitOfWork;