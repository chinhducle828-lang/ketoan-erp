import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { canAccessCompany } from '../services/helpers.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const itemsUploadDir = path.join(__dirname, '..', 'uploads', 'items');
fs.mkdirSync(itemsUploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, itemsUploadDir),
    filename: (req, file, cb) => {
      const safeName = file.originalname
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9._-]/g, '');
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }
});

const getItemsColumns = async () => {
  const rs = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'items'`
  );
  return new Set(rs.rows.map((row) => row.column_name));
};

const parseImageUrls = (bodyValue, uploadedImages) => {
  if (uploadedImages.length > 0) return uploadedImages;
  if (!bodyValue) return null;
  if (Array.isArray(bodyValue)) return bodyValue;
  try {
    const parsed = JSON.parse(bodyValue);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const toAbsoluteMediaUrl = (req, rawValue) => {
  const value = String(rawValue || '').trim();
  if (!value) return null;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const basePath = value.startsWith('/') ? value : `/${value}`;
  return `${req.protocol}://${req.get('host')}${basePath}`;
};

const normalizeImageUrlsField = (input) => {
  if (Array.isArray(input)) return input;
  if (!input) return [];
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [trimmed];
    } catch {
      return [trimmed];
    }
  }
  return [];
};

const codeExpr = "COALESCE(NULLIF(code, ''), item_code)";
const nameExpr = "COALESCE(NULLIF(name, ''), item_name)";
const descriptionExpr = "COALESCE(description, item_description, '')";
const openingQuantityExpr = "COALESCE(opening_quantity, 0)";

// Lấy danh sách vật tư
router.get('/', authenticate, async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id;
    if (!targetCompanyId) return res.json([]);

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Từ chối quyền truy xuất danh mục vật tư!' });
    }

    const columns = await getItemsColumns();
    const hasImageUrls = columns.has('image_urls');

    const items = await pool.query(
      `SELECT id,
              ${codeExpr} AS code,
              ${nameExpr} AS name,
              ${descriptionExpr} AS description,
              unit,
              COALESCE(price_sell, 0) AS price_sell,
              ${columns.has('opening_quantity') ? `${openingQuantityExpr}` : '0'} AS opening_quantity,
              image_url,
              ${hasImageUrls ? "COALESCE(image_urls, '[]'::jsonb)" : "'[]'::jsonb"} AS image_urls,
              company_id
       FROM items
       WHERE company_id = $1
       ORDER BY ${codeExpr}`,
      [targetCompanyId]
    );
    const normalizedRows = items.rows.map((row) => {
      const imageUrl = toAbsoluteMediaUrl(req, row.image_url);
      const imageUrls = normalizeImageUrlsField(row.image_urls)
        .map((url) => toAbsoluteMediaUrl(req, url))
        .filter(Boolean);

      if (imageUrl && !imageUrls.includes(imageUrl)) {
        imageUrls.unshift(imageUrl);
      }

      return {
        ...row,
        image_url: imageUrl,
        image_urls: imageUrls
      };
    });

    res.json(normalizedRows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Thêm vật tư mới
router.post('/', authenticate, requireRole(['admin', 'ktt']), upload.array('images', 6), async (req, res) => {
  try {
    const { code, name, description, item_description, unit, price_sell, opening_quantity, image_url, companyId, company_id } = req.body;
    const targetCompanyId = companyId || company_id || req.query.company_id;
    const priceSellValue = Number(price_sell ?? req.body.priceSell ?? 0);
    const openingQuantityValue = Number(opening_quantity ?? req.body.openingQuantity ?? 0);
    const imageUrlValue = image_url || req.body.imageUrl || null;
    const descriptionValue = (description ?? item_description ?? '').trim();
    const uploadedImages = Array.isArray(req.files) ? req.files.map((file) => `/uploads/items/${file.filename}`) : [];

    if (!code || !name || !unit) return res.status(400).json({ error: 'Thiếu mã, tên hoặc đơn vị tính.' });
    if (!targetCompanyId) return res.status(400).json({ error: 'Không xác định được doanh nghiệp cần khai báo vật tư!' });

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Bạn không có quyền khai báo danh mục cho đơn vị này!' });
    }

    const columns = await getItemsColumns();
    const imageUrlsValue = parseImageUrls(req.body.image_urls, uploadedImages);
    const firstImage = uploadedImages[0] || imageUrlValue || null;

    const insertColumns = ['company_id', 'unit'];
    const insertValues = [targetCompanyId, unit.trim()];

    if (columns.has('code')) {
      insertColumns.push('code');
      insertValues.push(code.toUpperCase().trim());
    }
    if (columns.has('name')) {
      insertColumns.push('name');
      insertValues.push(name.trim());
    }
    if (columns.has('item_code')) {
      insertColumns.push('item_code');
      insertValues.push(code.toUpperCase().trim());
    }
    if (columns.has('item_name')) {
      insertColumns.push('item_name');
      insertValues.push(name.trim());
    }
    if (columns.has('description')) {
      insertColumns.push('description');
      insertValues.push(descriptionValue || null);
    }
    if (columns.has('item_description')) {
      insertColumns.push('item_description');
      insertValues.push(descriptionValue || null);
    }
    if (columns.has('price_sell')) {
      insertColumns.push('price_sell');
      insertValues.push(priceSellValue);
    }
    if (columns.has('opening_quantity')) {
      insertColumns.push('opening_quantity');
      insertValues.push(openingQuantityValue);
    }
    if (columns.has('image_url')) {
      insertColumns.push('image_url');
      insertValues.push(firstImage);
    }
    if (columns.has('image_urls')) {
      insertColumns.push('image_urls');
      insertValues.push(imageUrlsValue ? JSON.stringify(imageUrlsValue) : JSON.stringify([]));
    }
    if (columns.has('created_by')) {
      insertColumns.push('created_by');
      insertValues.push(req.user.id);
    }

    const placeholders = insertColumns.map((_, index) => `$${index + 1}`).join(', ');
    await pool.query(
      `INSERT INTO items (${insertColumns.join(', ')}) VALUES (${placeholders})`,
      insertValues
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

    const columns = await getItemsColumns();
    const whereCode = columns.has('item_code')
      ? '(code = $1 OR item_code = $1)'
      : 'code = $1';

    const result = await pool.query(
      `DELETE FROM items WHERE ${whereCode} AND company_id = $2 RETURNING id`,
      [code, targetCompanyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Vật tư không tìm thấy hoặc không thuộc quyền quản lý của đơn vị.' });
    res.json({ success: true, message: 'Đã xóa vật tư thành công khỏi danh mục.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Cập nhật vật tư
router.put('/:code', authenticate, requireRole(['admin', 'ktt']), upload.array('images', 6), async (req, res) => {
  try {
    const { code } = req.params;
    const { name, description, item_description, unit, price_sell, opening_quantity, image_url, companyId, company_id } = req.body;
    const targetCompanyId = companyId || company_id || req.query.company_id;
    const priceSellValue = Number(price_sell ?? req.body.priceSell ?? 0);
    const openingQuantityValue = Number(opening_quantity ?? req.body.openingQuantity ?? 0);
    const imageUrlValue = image_url || req.body.imageUrl || null;
    const descriptionValue = (description ?? item_description ?? '').trim();
    const uploadedImages = Array.isArray(req.files) ? req.files.map((file) => `/uploads/items/${file.filename}`) : [];
    const firstImage = uploadedImages[0] || imageUrlValue || null;

    if (!name || !unit) return res.status(400).json({ error: 'Thiếu tên hoặc đơn vị tính mới.' });
    if (!targetCompanyId) return res.status(400).json({ error: 'Thiếu thông tin xác định doanh nghiệp cần cập nhật!' });

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Quyền chỉnh sửa danh mục tại đơn vị này bị chặn!' });
    }

    const columns = await getItemsColumns();
    const imageUrlsValue = parseImageUrls(req.body.image_urls, uploadedImages);
    const updateSet = [];
    const updateValues = [];

    updateSet.push(`unit = $${updateSet.length + 1}`);
    updateValues.push(unit.trim());

    if (columns.has('name')) {
      updateSet.push(`name = $${updateSet.length + 1}`);
      updateValues.push(name.trim());
    }
    if (columns.has('item_name')) {
      updateSet.push(`item_name = $${updateSet.length + 1}`);
      updateValues.push(name.trim());
    }
    if (columns.has('description')) {
      updateSet.push(`description = $${updateSet.length + 1}`);
      updateValues.push(descriptionValue || null);
    }
    if (columns.has('item_description')) {
      updateSet.push(`item_description = $${updateSet.length + 1}`);
      updateValues.push(descriptionValue || null);
    }
    if (columns.has('price_sell')) {
      updateSet.push(`price_sell = $${updateSet.length + 1}`);
      updateValues.push(priceSellValue);
    }
    if (columns.has('opening_quantity')) {
      updateSet.push(`opening_quantity = $${updateSet.length + 1}`);
      updateValues.push(openingQuantityValue);
    }
    if (columns.has('image_url')) {
      updateSet.push(`image_url = $${updateSet.length + 1}`);
      updateValues.push(firstImage);
    }
    if (columns.has('image_urls') && imageUrlsValue) {
      updateSet.push(`image_urls = $${updateSet.length + 1}`);
      updateValues.push(JSON.stringify(imageUrlsValue));
    }

    const codeIndex = updateSet.length + 1;
    const companyIndex = updateSet.length + 2;
    const whereCode = columns.has('item_code')
      ? `(code = $${codeIndex} OR item_code = $${codeIndex})`
      : `code = $${codeIndex}`;

    const result = await pool.query(
      `UPDATE items
       SET ${updateSet.join(', ')}
       WHERE ${whereCode} AND company_id = $${companyIndex}
       RETURNING id`,
      [...updateValues, code, targetCompanyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Vật tư không tìm thấy hoặc không thuộc quyền quản lý của đơn vị.' });
    res.json({ success: true, message: 'Cập nhật thông tin vật tư thành công.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export { router as itemsRouter };