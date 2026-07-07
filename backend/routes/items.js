import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { canAccessCompany } from '../services/helpers.js';
import { emitInventoryRealtime } from '../services/voucherRealtime.service.js';
import { assertCompanyOperational, assertItemCanBeDeleted } from '../services/cascadeValidation.service.js';
import { logAction, getClientIp } from '../services/auditLog.service.js';

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

const assertCompanyNotLockedForPhysicalDelete = async (companyId) => {
  const result = await pool.query('SELECT lock_date FROM companies WHERE id = $1', [companyId]);
  const lockDate = result.rows[0]?.lock_date || null;
  if (lockDate) {
    throw new Error(`Doanh nghiệp đã khóa sổ đến ${new Date(lockDate).toISOString().split('T')[0]}. Không cho phép xóa vật tư vật lý, vui lòng dùng phương án điều chỉnh.`);
  }
};

const parseImageUrls = (bodyValue, uploadedImages) => {
  if (uploadedImages.length > 0) return uploadedImages;
  if (!bodyValue) return null;
  if (Array.isArray(bodyValue)) {
    return bodyValue
      .map((value) => String(value || '').trim())
      .filter(Boolean);
  }
  try {
    const parsed = JSON.parse(bodyValue);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((value) => String(value || '').trim())
      .filter(Boolean);
  } catch {
    return null;
  }
};

const parseGoogleDriveFileId = (rawInput) => {
  const raw = String(rawInput || '').trim();
  if (!raw) return null;

  const fromPath = raw.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (fromPath?.[1]) return fromPath[1];

  const fromDriveusercontentPath = raw.match(/\/d\/([a-zA-Z0-9_-]{10,})(?:[=?&#/]|$)/);
  if (fromDriveusercontentPath?.[1]) return fromDriveusercontentPath[1];

  try {
    const parsed = new URL(raw);
    const idFromQuery = parsed.searchParams.get('id');
    if (idFromQuery && /^[a-zA-Z0-9_-]{10,}$/.test(idFromQuery)) return idFromQuery;

    const pathnameMatch = parsed.pathname.match(/\/d\/([a-zA-Z0-9_-]{10,})(?:[/?#]|$)/);
    if (pathnameMatch?.[1]) return pathnameMatch[1];
  } catch {
    // Ignore malformed URLs and leave as-is.
  }

  return null;
};

const normalizeImageUrlInput = (rawInput) => {
  const raw = String(rawInput || '').trim();
  if (!raw) return null;

  const driveFileId = parseGoogleDriveFileId(raw);
  if (driveFileId) {
    return `https://drive.google.com/uc?export=view&id=${driveFileId}`;
  }

  return raw;
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
    const imageUrlValue = normalizeImageUrlInput(image_url || req.body.imageUrl || null);
    const descriptionValue = (description ?? item_description ?? '').trim();
    const uploadedImages = Array.isArray(req.files) ? req.files.map((file) => `/uploads/items/${file.filename}`) : [];

    if (!code || !name || !unit) return res.status(400).json({ error: 'Thiếu mã, tên hoặc đơn vị tính.' });
    if (!targetCompanyId) return res.status(400).json({ error: 'Không xác định được doanh nghiệp cần khai báo vật tư!' });
    await assertCompanyOperational(targetCompanyId);

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Bạn không có quyền khai báo danh mục cho đơn vị này!' });
    }

    const columns = await getItemsColumns();
    const imageUrlsValue = (parseImageUrls(req.body.image_urls, uploadedImages) || [])
      .map((value) => normalizeImageUrlInput(value))
      .filter(Boolean);
    const firstImage = uploadedImages[0] || imageUrlValue || imageUrlsValue[0] || null;

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
      insertValues.push(JSON.stringify(imageUrlsValue));
    }
    if (columns.has('created_by')) {
      insertColumns.push('created_by');
      insertValues.push(req.user.id);
    }

const placeholders = insertColumns.map((_, index) => `$${index + 1}`).join(', ');
    const itemResult = await pool.query(
      `INSERT INTO items (${insertColumns.join(', ')}) VALUES (${placeholders}) RETURNING id`,
      insertValues
    );
    const newItemId = itemResult.rows[0]?.id;

// Ghi log tạo mới item
    await logAction({
      userId: req.user?.id || null,
      action: 'CREATE',
      entityType: 'ITEMS',
      newValues: {
        code: code.toUpperCase().trim(),
        name: name.trim(),
        unit: unit.trim(),
        price_sell: priceSellValue,
        opening_quantity: openingQuantityValue
      },
      ipAddress: getClientIp(req),
      companyId: targetCompanyId
    });

    // Tự động tạo voucher NK khi opening_quantity > 0
    if (openingQuantityValue > 0) {
      const voucherNumber = `NK-${Date.now().toString().slice(-6)}`;
      const voucherRes = await pool.query(
        `INSERT INTO vouchers (company_id, voucher_type, voucher_date, voucher_number, description, currency, exchange_rate, created_by, is_posted)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [targetCompanyId, 'NK', new Date().toISOString().split('T')[0], voucherNumber, 
         `Nhập kho đầu kỳ: ${name.trim()}`, 'VND', 1, req.user?.id || null, false]
      );
      const voucherId = voucherRes.rows[0]?.id;

      // Tạo bút toán: Nợ 156 (Hàng hóa kho tổng) / Có 331 (Phải trả cho người bán)
      // Giá vốn mặc định = 0, sẽ được điều chỉnh sau
      const totalAmount = Math.round(openingQuantityValue * priceSellValue);
      
      await pool.query(
        `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount, quantity, item_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [voucherId, '156', 'DR', totalAmount, openingQuantityValue, newItemId]
      );
      
      await pool.query(
        `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount, quantity, item_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [voucherId, '331', 'CR', totalAmount, openingQuantityValue, newItemId]
      );

      // Ghi log tạo voucher NK tự động
      await logAction({
        userId: req.user?.id || null,
        action: 'CREATE',
        entityType: 'INVENTORY_VOUCHERS',
        newValues: {
          voucher_number: voucherNumber,
          voucher_type: 'NK',
          item_id: newItemId,
          item_code: code.toUpperCase().trim(),
          quantity: openingQuantityValue,
          amount: totalAmount
        },
        ipAddress: getClientIp(req),
        companyId: targetCompanyId
      });
    }

    emitInventoryRealtime({
      companyId: targetCompanyId,
      itemCode: code,
      action: 'item_created',
      userId: req.user?.id || null,
      clientInstanceId: req.headers['x-client-instance-id'] || null
    });

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

    await assertCompanyNotLockedForPhysicalDelete(targetCompanyId);
    await assertCompanyOperational(targetCompanyId);
    await assertItemCanBeDeleted({ companyId: targetCompanyId, itemCode: code });

    const columns = await getItemsColumns();
    const whereCode = columns.has('item_code')
      ? '(code = $1 OR item_code = $1)'
      : 'code = $1';

// Lấy dữ liệu cũ trước khi xóa để ghi log
    const oldItem = await pool.query(
      `SELECT code, name, unit, price_sell, opening_quantity FROM items WHERE ${whereCode} AND company_id = $1`,
      [code, targetCompanyId]
    );

    const result = await pool.query(
      `DELETE FROM items WHERE ${whereCode} AND company_id = $2 RETURNING id`,
      [code, targetCompanyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Vật tư không tìm thấy hoặc không thuộc quyền quản lý của đơn vị.' });

    // Ghi log xóa item
    if (oldItem.rows.length > 0) {
      await logAction({
        userId: req.user?.id || null,
        action: 'DELETE',
        entityType: 'ITEMS',
        oldValues: {
          code: oldItem.rows[0].code,
          name: oldItem.rows[0].name,
          unit: oldItem.rows[0].unit,
          price_sell: oldItem.rows[0].price_sell,
          opening_quantity: oldItem.rows[0].opening_quantity
        },
        ipAddress: getClientIp(req),
        companyId: targetCompanyId
      });
    }

    emitInventoryRealtime({
      companyId: targetCompanyId,
      itemCode: code,
      action: 'item_deleted',
      userId: req.user?.id || null,
      clientInstanceId: req.headers['x-client-instance-id'] || null
    });

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
    const hasImageUrlField = Object.prototype.hasOwnProperty.call(req.body, 'image_url')
      || Object.prototype.hasOwnProperty.call(req.body, 'imageUrl');
    const hasImageUrlsField = Object.prototype.hasOwnProperty.call(req.body, 'image_urls');
    const imageUrlValue = normalizeImageUrlInput(image_url || req.body.imageUrl || null);
    const descriptionValue = (description ?? item_description ?? '').trim();
    const uploadedImages = Array.isArray(req.files) ? req.files.map((file) => `/uploads/items/${file.filename}`) : [];

    if (!name || !unit) return res.status(400).json({ error: 'Thiếu tên hoặc đơn vị tính mới.' });
    if (!targetCompanyId) return res.status(400).json({ error: 'Thiếu thông tin xác định doanh nghiệp cần cập nhật!' });
    await assertCompanyOperational(targetCompanyId);

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Quyền chỉnh sửa danh mục tại đơn vị này bị chặn!' });
    }

    const columns = await getItemsColumns();
    const shouldUpdateImageUrls = uploadedImages.length > 0 || hasImageUrlsField;
    const imageUrlsValue = shouldUpdateImageUrls
      ? (parseImageUrls(req.body.image_urls, uploadedImages) || [])
          .map((value) => normalizeImageUrlInput(value))
          .filter(Boolean)
      : null;
    const shouldUpdatePrimaryImage = uploadedImages.length > 0
      || hasImageUrlField
      || (Array.isArray(imageUrlsValue) && imageUrlsValue.length > 0);
    const firstImage = uploadedImages[0] || imageUrlValue || imageUrlsValue?.[0] || null;
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
    if (columns.has('image_url') && shouldUpdatePrimaryImage) {
      updateSet.push(`image_url = $${updateSet.length + 1}`);
      updateValues.push(firstImage);
    }
    if (columns.has('image_urls') && shouldUpdateImageUrls) {
      updateSet.push(`image_urls = $${updateSet.length + 1}`);
      updateValues.push(JSON.stringify(imageUrlsValue));
    }

    const codeIndex = updateSet.length + 1;
    const companyIndex = updateSet.length + 2;
    const whereCode = columns.has('item_code')
      ? `(code = $${codeIndex} OR item_code = $${codeIndex})`
      : `code = $${codeIndex}`;

// Lấy dữ liệu cũ trước khi cập nhật để ghi log
    const oldItem = await pool.query(
      `SELECT code, name, unit, price_sell, opening_quantity FROM items WHERE ${whereCode} AND company_id = $1`,
      [code, targetCompanyId]
    );

    const result = await pool.query(
      `UPDATE items
       SET ${updateSet.join(', ')}
       WHERE ${whereCode} AND company_id = $${companyIndex}
       RETURNING id`,
      [...updateValues, code, targetCompanyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Vật tư không tìm thấy hoặc không thuộc quyền quản lý của đơn vị.' });

    // Ghi log cập nhật item
    if (oldItem.rows.length > 0) {
      await logAction({
        userId: req.user?.id || null,
        action: 'UPDATE',
        entityType: 'ITEMS',
        oldValues: {
          code: oldItem.rows[0].code,
          name: oldItem.rows[0].name,
          unit: oldItem.rows[0].unit,
          price_sell: oldItem.rows[0].price_sell,
          opening_quantity: oldItem.rows[0].opening_quantity
        },
        newValues: {
          code: code.toUpperCase().trim(),
          name: name.trim(),
          unit: unit.trim(),
          price_sell: priceSellValue,
          opening_quantity: openingQuantityValue
        },
        ipAddress: getClientIp(req),
        companyId: targetCompanyId
      });
    }

    emitInventoryRealtime({
      companyId: targetCompanyId,
      itemCode: code,
      action: 'item_updated',
      userId: req.user?.id || null,
      clientInstanceId: req.headers['x-client-instance-id'] || null
    });

    res.json({ success: true, message: 'Cập nhật thông tin vật tư thành công.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export { router as itemsRouter };