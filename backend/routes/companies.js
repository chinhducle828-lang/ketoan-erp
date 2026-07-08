/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

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
    const query = req.user?.role === 'admin'
      ? 'SELECT * FROM companies ORDER BY id DESC'
      : `SELECT c.*
         FROM companies c
         JOIN user_companies uc ON uc.company_id = c.id
         WHERE uc.user_id = $1
         ORDER BY c.id DESC`;

    const result = req.user?.role === 'admin'
      ? await pool.query(query)
      : await pool.query(query, [req.user.id]);
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

// ==========================================
// DPO & RETENTION (P6)
// ==========================================

/**
 * Lấy thông tin DPO và chính sách lưu giữ dữ liệu
 * GET /api/companies/:id/legal-profile
 */
router.get('/:id/legal-profile', authenticate, async (req, res) => {
  try {
    const companyId = req.params.id;
    const company = await pool.query('SELECT id, name, tax_code, address FROM companies WHERE id = $1 LIMIT 1', [companyId]);
    if (company.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy công ty' });

    const profile = await pool.query('SELECT * FROM company_profiles WHERE company_id = $1 LIMIT 1', [companyId]);
    res.json({ success: true, data: { ...company.rows[0], ...(profile.rows[0] || {}) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Cập nhật thông tin DPO và chính sách lưu giữ
 * POST /api/companies/:id/legal-profile
 */
router.post('/:id/legal-profile', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const companyId = req.params.id;
    const { legal_name, email, hotline, website, license_no, dpo_name, dpo_email, data_retention_days } = req.body;

    await pool.query(
      `INSERT INTO company_profiles (company_id, legal_name, email, hotline, website, license_no, dpo_name, dpo_email, data_retention_days, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
       ON CONFLICT (company_id) DO UPDATE
         SET legal_name = EXCLUDED.legal_name,
             email = EXCLUDED.email,
             hotline = EXCLUDED.hotline,
             website = EXCLUDED.website,
             license_no = EXCLUDED.license_no,
             dpo_name = EXCLUDED.dpo_name,
             dpo_email = EXCLUDED.dpo_email,
             data_retention_days = EXCLUDED.data_retention_days,
             updated_at = EXCLUDED.updated_at`,
      [companyId, legal_name, email, hotline, website, license_no, dpo_name, dpo_email, data_retention_days]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { router as companiesRouter };
