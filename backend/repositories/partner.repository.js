/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * partner.repository - Data Access Object cho đối tác
 */

import { pool } from '../config/db.js';

export const PartnerRepository = {
  /**
   * Lấy danh sách đối tác
   * @param {number} companyId - ID công ty
   * @param {Object} options - Tùy chọn lọc
   * @returns {Promise<Array>}
   */
  async getList(companyId, options = {}) {
    const { search = null, type = null, isActive = true } = options;
    
    let whereClause = 'WHERE company_id = $1';
    const params = [Number(companyId)];
    let paramCount = 1;

    if (type) {
      paramCount++;
      whereClause += ` AND type = $${paramCount}`;
      params.push(type);
    }

    if (isActive !== null) {
      paramCount++;
      whereClause += ` AND is_active = $${paramCount}`;
      params.push(isActive);
    }

    if (search) {
      paramCount++;
      whereClause += ` AND (partner_name ILIKE $${paramCount} OR partner_code ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    const { rows } = await pool.query(
      `SELECT id, partner_code, partner_name, type, phone, email, address, is_active, created_at
       FROM partners
       ${whereClause}
       ORDER BY partner_name`,
      params
    );

    return rows;
  },

  /**
   * Tìm đối tác theo ID
   * @param {number} partnerId - ID đối tác
   * @returns {Promise<Object|null>}
   */
  async findById(partnerId) {
    const { rows } = await pool.query(
      'SELECT * FROM partners WHERE id = $1',
      [Number(partnerId)]
    );
    return rows[0] || null;
  },

  /**
   * Tạo đối tác mới
   * @param {Object} partner - Thông tin đối tác
   * @param {Object} client - Database client
   * @returns {Promise<Object>}
   */
  async create(partner, client = pool) {
    const { 
      company_id, 
      partner_code, 
      partner_name, 
      type, 
      phone, 
      email, 
      address 
    } = partner;

    const result = await client.query(
      `INSERT INTO partners (
        company_id, partner_code, partner_name, type, phone, email, address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *`,
      [company_id, partner_code, partner_name, type, phone, email, address]
    );
    return result.rows[0];
  },

  /**
   * Cập nhật đối tác
   * @param {number} partnerId - ID đối tác
   * @param {Object} partner - Thông tin cập nhật
   * @param {Object} client - Database client
   * @returns {Promise<Object>}
   */
  async update(partnerId, partner, client = pool) {
    const { partner_name, type, phone, email, address, is_active } = partner;

    const result = await client.query(
      `UPDATE partners 
       SET partner_name = $1, type = $2, phone = $3, email = $4, 
           address = $5, is_active = $6
       WHERE id = $7
       RETURNING *`,
      [partner_name, type, phone, email, address, is_active, partnerId]
    );
    return result.rows[0];
  },

  /**
   * Xóa đối tác
   * @param {number} partnerId - ID đối tác
   * @param {Object} client - Database client
   * @returns {Promise<void>}
   */
  async delete(partnerId, client = pool) {
    await client.query('DELETE FROM partners WHERE id = $1', [partnerId]);
  }
};

export default PartnerRepository;