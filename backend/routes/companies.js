import express from 'express';
import { pool } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createCompanySchema } from '../validators/index.js';

const router = express.Router();

// Tạo mới công ty - Đồng bộ snake_case và chống trùng lặp dữ liệu an toàn
router.post('/', authenticate, requireRole(['admin']), validate(createCompanySchema), async (req, res) => {
  try {
    const { name, tax_code, address } = req.body;
    
    // Kiểm tra trùng lặp MST trước khi chèn để tránh Exception DB quăng lỗi 500
    const checkDuplicate = await pool.query('SELECT id FROM companies WHERE tax_code = $1 LIMIT 1', [tax_code]);
    if (checkDuplicate.rows.length > 0) {
      return res.status(400).json({ error: 'Mã số thuế này đã được một doanh nghiệp khác đăng ký trên hệ thống!' });
    }

    const result = await pool.query(
      'INSERT INTO companies (name, tax_code, address) VALUES ($1, $2, $3) RETURNING *',
      [name, tax_code, address]
    );
    res.status(201).json({ success: true, company: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi hệ thống lưu trữ: ' + err.message });
  }
});

// Lấy danh sách công ty hạch toán
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM companies ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi nạp danh sách công ty: ' + err.message });
  }
});

// Xóa công ty hạch toán khỏi cơ sở dữ liệu
router.delete('/:id', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const companyId = req.params.id;
    await pool.query('DELETE FROM companies WHERE id = $1', [companyId]);
    res.json({ success: true, message: 'Đã xóa công ty khỏi hệ thống thành công!' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi xóa công ty: ' + err.message });
  }
});

export { router as companiesRouter };