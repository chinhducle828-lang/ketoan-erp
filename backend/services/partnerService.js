import { pool } from '../config/db.js';

/**
 * Thêm mới một đối tác vào Cơ sở dữ liệu
 * @param {Object} partnerData - Dữ liệu đối tác đã được lọc sạch
 */
export const createPartnerDB = async (partnerData) => {
  const { company_id, partner_code, partner_name, type, phone, email, address } = partnerData;

  const sql = `
    INSERT INTO partners (company_id, partner_code, partner_name, type, phone, email, address)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;

  const values = [
    company_id,
    partner_code.trim(),
    partner_name.trim(),
    type,
    phone ? phone.trim() : null,
    email ? email.trim().toLowerCase() : null,
    address ? address.trim() : null
  ];

  const result = await pool.query(sql, values);
  return result.rows[0]; // Trả về bản ghi đối tác vừa được tạo thành công
};

/**
 * Lấy danh sách toàn bộ đối tác hoạt động thuộc một Công ty/Chi nhánh (company_id)
 * Phục vụ cho bài toán cô lập dữ liệu ERP
 * @param {number} company_id 
 */
export const getPartnersByCompanyDB = async (company_id) => {
  const sql = `
    SELECT id, partner_code, partner_name, type, phone, email, address, is_active, created_at
    FROM partners
    WHERE company_id = $1 AND is_active = TRUE
    ORDER BY partner_code ASC;
  `;

  const result = await pool.query(sql, [company_id]);
  return result.rows; // Trả về mảng danh sách đối tác
};