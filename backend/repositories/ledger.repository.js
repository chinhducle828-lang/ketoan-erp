/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * ledger.repository - Data Access Object cho sổ cái
 * Chỉ chịu trách nhiệm truy vấn PostgreSQL
 */

import { pool } from '../config/db.js';

/**
 * @typedef {Object} VoucherWithDetails
 * @property {number} id - ID chứng từ
 * @property {string} voucher_date - Ngày chứng từ
 * @property {string} voucher_type - Loại chứng từ
 * @property {string} currency - Loại tiền
 * @property {number} exchange_rate - Tỷ giá
 * @property {string} description - Diễn giải
 * @property {Array} details - Chi tiết định khoản
 */

export const LedgerRepository = {
  /**
   * Lấy tất cả chứng từ của công ty kèm chi tiết
   * @param {number} companyId - ID công ty
   * @returns {Promise<VoucherWithDetails[]>}
   */
  async findByCompany(companyId) {
    const { rows } = await pool.query(
      `SELECT v.id, v.voucher_date, v.voucher_type, v.currency, v.exchange_rate, v.description,
              v.is_posted, v.posted_at, v.posted_by,
              json_agg(json_build_object(
                'accountCode', vd.account_code,
                'entryType', vd.entry_type,
                'amount', vd.amount,
                'quantity', vd.quantity,
                'partnerId', vd.partner_id,
                'itemId', vd.item_id
              )) as details
       FROM vouchers v
       JOIN voucher_details vd ON v.id = vd.voucher_id
       WHERE v.company_id = $1
       GROUP BY v.id
       ORDER BY v.voucher_date DESC, v.id DESC`,
      [Number(companyId)]
    );
    return rows;
  },

  /**
   * Lấy chứng từ theo ID kèm chi tiết
   * @param {number} voucherId - ID chứng từ
   * @returns {Promise<VoucherWithDetails|null>}
   */
  async findById(voucherId) {
    const { rows } = await pool.query(
      `SELECT v.id, v.company_id, v.voucher_date, v.voucher_type, v.currency, v.exchange_rate, v.description,
              v.is_posted, v.posted_at, v.posted_by,
              json_agg(json_build_object(
                'accountCode', vd.account_code,
                'entryType', vd.entry_type,
                'amount', vd.amount,
                'quantity', vd.quantity,
                'partnerId', vd.partner_id,
                'itemId', vd.item_id
              )) as details
       FROM vouchers v
       JOIN voucher_details vd ON v.id = vd.voucher_id
       WHERE v.id = $1
       GROUP BY v.id`,
      [Number(voucherId)]
    );
    return rows[0] || null;
  },

  /**
   * Lấy số dư tài khoản theo công ty
   * @param {number} companyId - ID công ty
   * @param {number} [year] - Năm (optional)
   * @param {number} [month] - Tháng (optional)
   * @returns {Promise<Object>}
   */
  async getAccountBalances(companyId, year = null, month = null) {
    let whereClause = 'WHERE v.company_id = $1';
    const params = [Number(companyId)];
    let paramCount = 1;

    if (year) {
      paramCount++;
      whereClause += ` AND EXTRACT(YEAR FROM v.voucher_date) = $${paramCount}`;
      params.push(year);
    }

    if (month) {
      paramCount++;
      whereClause += ` AND EXTRACT(MONTH FROM v.voucher_date) = $${paramCount}`;
      params.push(month);
    }

    const { rows } = await pool.query(
      `SELECT 
         vd.account_code,
         SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as total_debit,
         SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as total_credit
       FROM voucher_details vd
       JOIN vouchers v ON vd.voucher_id = v.id
       ${whereClause}
       GROUP BY vd.account_code
       ORDER BY vd.account_code`,
      params
    );

    return rows.reduce((acc, row) => {
      acc[row.account_code] = {
        debit: Number(row.total_debit) || 0,
        credit: Number(row.total_credit) || 0,
        balance: (Number(row.total_debit) || 0) - (Number(row.total_credit) || 0)
      };
      return acc;
    }, {});
  }
};

export default LedgerRepository;