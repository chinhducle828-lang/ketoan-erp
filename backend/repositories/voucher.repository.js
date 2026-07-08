/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * voucher.repository - Data Access Object cho chứng từ
 */

import { pool } from '../config/db.js';

export const VoucherRepository = {
  /**
   * Tạo chứng từ mới
   * @param {Object} voucher - Thông tin chứng từ
   * @param {Object} client - Database client (optional, dùng cho transaction)
   * @returns {Promise<Object>}
   */
  async create(voucher, client = pool) {
    const { 
      company_id, 
      voucher_number, 
      voucher_date, 
      voucher_type, 
      description, 
      currency, 
      exchange_rate, 
      created_by,
      is_posted = false
    } = voucher;

    const result = await client.query(
      `INSERT INTO vouchers (
        company_id, voucher_number, voucher_date, voucher_type, 
        description, currency, exchange_rate, created_by, is_posted
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
      RETURNING *`,
      [company_id, voucher_number, voucher_date, voucher_type, 
       description, currency, exchange_rate, created_by, is_posted]
    );
    return result.rows[0];
  },

  /**
   * Tạo chi tiết chứng từ
   * @param {number} voucherId - ID chứng từ
   * @param {Array} details - Chi tiết định khoản
   * @param {Object} client - Database client
   * @returns {Promise<void>}
   */
  async createDetails(voucherId, details, client = pool) {
    for (const detail of details) {
      await client.query(
        `INSERT INTO voucher_details (
          voucher_id, account_code, entry_type, amount, 
          quantity, partner_id, item_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          voucherId,
          detail.accountCode,
          detail.entryType,
          Number(detail.amount) || 0,
          Number(detail.quantity) || 0,
          detail.partnerId || null,
          detail.itemId || null
        ]
      );
    }
  },

  /**
   * Cập nhật trạng thái ghi sổ
   * @param {number} voucherId - ID chứng từ
   * @param {boolean} isPosted - Trạng thái ghi sổ
   * @param {number} [postedBy] - ID người ghi sổ
   * @param {Object} client - Database client
   * @returns {Promise<Object>}
   */
  async updatePostedStatus(voucherId, isPosted, postedBy = null, client = pool) {
    const result = await client.query(
      `UPDATE vouchers 
       SET is_posted = $1, 
           posted_at = CASE WHEN $1 THEN NOW() ELSE posted_at END,
           posted_by = $2
       WHERE id = $3
       RETURNING *`,
      [isPosted, postedBy, voucherId]
    );
    return result.rows[0];
  },

  /**
   * Xóa chứng từ và chi tiết
   * @param {number} voucherId - ID chứng từ
   * @param {Object} client - Database client
   * @returns {Promise<void>}
   */
  async delete(voucherId, client = pool) {
    await client.query('DELETE FROM voucher_details WHERE voucher_id = $1', [voucherId]);
    await client.query('DELETE FROM vouchers WHERE id = $1', [voucherId]);
  },

  /**
   * Lấy danh sách chứng từ có phân trang
   * @param {number} companyId - ID công ty
   * @param {Object} options - Tùy chọn lọc
   * @returns {Promise<Object>}
   */
  async getList(companyId, options = {}) {
    const { 
      limit = 50, 
      offset = 0, 
      type = null, 
      isPosted = null,
      search = null 
    } = options;

    let whereClause = 'WHERE v.company_id = $1';
    const params = [Number(companyId)];
    let paramCount = 1;

    if (type) {
      paramCount++;
      whereClause += ` AND v.voucher_type = $${paramCount}`;
      params.push(type);
    }

    if (isPosted !== null) {
      paramCount++;
      whereClause += ` AND v.is_posted = $${paramCount}`;
      params.push(isPosted);
    }

    if (search) {
      paramCount++;
      whereClause += ` AND (v.voucher_number ILIKE $${paramCount} OR v.description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*)::int as total FROM vouchers v ${whereClause}`,
      params
    );

    // Get vouchers with details count
    paramCount++;
    const dataResult = await pool.query(
      `SELECT v.id, v.voucher_number, v.voucher_date, v.voucher_type, 
              v.description, v.currency, v.exchange_rate, v.is_posted, v.posted_at,
              (SELECT COUNT(*) FROM voucher_details vd WHERE vd.voucher_id = v.id) as detail_count
       FROM vouchers v
       ${whereClause}
       ORDER BY v.voucher_date DESC, v.id DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...params, limit, offset]
    );

    return {
      data: dataResult.rows,
      total: countResult.rows[0].total,
      limit,
      offset
    };
  }
};

export default VoucherRepository;