import express from 'express';
import { pool } from '../server.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { canAccessCompany } from '../services/helpers.js';
import { invalidateCache } from '../cache/redis.js';

const router = express.Router();

// Lấy danh sách vật tư
router.get('/', authenticate, async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id;
    if (!targetCompanyId) return res.json([]);

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Từ chối quyền truy xuất danh mục vật tư!' });
    }

    const items = await pool.query(
      'SELECT code, name, unit, company_id FROM items WHERE company_id = $1 ORDER BY code', 
      [targetCompanyId]
    );
    res.json(items.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Thêm vật tư mới
router.post('/', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const { code, name, unit, companyId } = req.body;
    const targetCompanyId = companyId;

    if (!code || !name || !unit) return res.status(400).json({ error: 'Thiếu mã, tên hoặc đơn vị tính.' });
    if (!targetCompanyId) return res.status(400).json({ error: 'Không xác định được doanh nghiệp cần khai báo vật tư!' });

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Bạn không có quyền khai báo danh mục cho đơn vị này!' });
    }

    await pool.query(
      'INSERT INTO items (code, name, unit, company_id, created_by) VALUES ($1, $2, $3, $4, $5)',
      [code.toUpperCase().trim(), name.trim(), unit.trim(), targetCompanyId, req.user.id]
    );
    res.status(201).json({ success: true, message: 'Đã lưu vật tư/sản phẩm mới.' });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Mã vật tư này đã được đăng ký tại doanh nghiệp hiện tại!' });
    res.status(500).json({ error: err.message });
  }
});

// Xóa vật tư
router.delete('/:code', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const { code } = req.params;
    const targetCompanyId = req.query.company_id;
    
    if (!targetCompanyId) return res.status(400).json({ error: 'Thiếu tham số xác định doanh nghiệp cần xóa!' });

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Quyền thao tác danh mục bị chặn!' });
    }

    const result = await pool.query(
      'DELETE FROM items WHERE code = $1 AND company_id = $2 RETURNING code', 
      [code, targetCompanyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Vật tư không tìm thấy hoặc không thuộc quyền quản lý của đơn vị.' });
    res.json({ success: true, message: 'Đã xóa vật tư thành công khỏi danh mục.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Cập nhật vật tư
router.put('/:code', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const { code } = req.params;
    const { name, unit, companyId } = req.body;
    const targetCompanyId = companyId;

    if (!name || !unit) return res.status(400).json({ error: 'Thiếu tên hoặc đơn vị tính mới.' });
    if (!targetCompanyId) return res.status(400).json({ error: 'Thiếu thông tin xác định doanh nghiệp cần cập nhật!' });

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Quyền chỉnh sửa danh mục tại đơn vị này bị chặn!' });
    }

    const result = await pool.query(
      'UPDATE items SET name = $1, unit = $2 WHERE code = $3 AND company_id = $4 RETURNING code',
      [name.trim(), unit.trim(), code, targetCompanyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Vật tư không tìm thấy hoặc không thuộc quyền quản lý của đơn vị.' });
    res.json({ success: true, message: 'Cập nhật thông tin vật tư thành công.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export { router as itemsRouter };