import { pool } from '../config/db.js';

/**
 * Lấy danh sách Khách hàng / Nhà cung cấp
 */
export const getPartners = async (req, res) => {
  try {
    const { company_id, type } = req.query; // type: 'customer' | 'supplier'
    if (!company_id) {
      return res.status(400).json({ error: 'Yêu cầu truyền tham số company_id!' });
    }

    let queryStr = `
      SELECT id, partner_code as code, partner_name as name, tax_code as "taxCode", address, phone, type 
      FROM partners 
      WHERE company_id = $1
    `;
    const params = [company_id];

    if (type) {
      queryStr += ' AND type = $2';
      params.push(type);
    }

    queryStr += ' ORDER BY code ASC';

    const result = await pool.query(queryStr, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Thêm đối tác mới
 */
export const createPartner = async (req, res) => {
  try {
    const { companyId, code, name, taxCode, address, phone, type } = req.body;

    // Kiểm tra trùng mã đối tác
    const checkExist = await pool.query(
      'SELECT id FROM partners WHERE company_id = $1 AND partner_code = $2',
      [companyId, code]
    );
    if (checkExist.rows.length > 0) {
      return res.status(400).json({ error: 'Mã đối tác này đã tồn tại trong danh mục của công ty!' });
    }

    const insertQuery = `
      INSERT INTO partners (company_id, partner_code, partner_name, tax_code, address, phone, type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, partner_code as code, partner_name as name, type
    `;
    const result = await pool.query(insertQuery, [companyId, code, name, taxCode, address, phone, type]);

    res.status(201).json({
      success: true,
      message: 'Thêm mới đối tác thành công!',
      data: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};