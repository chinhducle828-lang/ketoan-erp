/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import express from 'express';
import { pool } from '../config/db.js';
import { buildOrderNumber, calculateTaxAmount, buildAccountingEntries } from '../services/logistics.service.js';
import { publishStorefrontOrderEvent } from '../services/storefrontRealtime.service.js';
import { getBusinessRules, getSaleRules } from '../config/businessRules.js';
import { sendToRole } from '../services/webPush.service.js';
import { resolveTaxBreakdown } from '../services/taxRule.service.js';
import { logAudit } from '../services/audit.service.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
const SCHEMA_CACHE_TTL_MS = 30 * 1000;
const tableColumnsCache = new Map();

const IDENTIFIER_PART_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const quoteQualifiedIdentifier = (identifier) => {
  const raw = String(identifier || '').trim();
  if (!raw) return null;
  const parts = raw.split('.').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.some((part) => !IDENTIFIER_PART_REGEX.test(part))) return null;
  return parts.map((part) => `"${part}"`).join('.');
};

const getTableColumnsMetadata = async (db, tableName) => {
  const normalizedName = String(tableName || '').trim().toLowerCase();
  if (!normalizedName) return [];

  const cacheEntry = tableColumnsCache.get(normalizedName);
  if (cacheEntry && Date.now() - cacheEntry.cachedAt < SCHEMA_CACHE_TTL_MS) {
    return cacheEntry.rows;
  }

  const { rows } = await db.query(
    `SELECT column_name, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_name = $1
       AND table_schema NOT IN ('information_schema', 'pg_catalog')`,
    [normalizedName]
  );

  const normalizedRows = rows.map((row) => ({
    column_name: String(row.column_name || '').trim().toLowerCase(),
    is_nullable: String(row.is_nullable || '').trim().toUpperCase(),
    column_default: row.column_default
  }));

  tableColumnsCache.set(normalizedName, {
    cachedAt: Date.now(),
    rows: normalizedRows
  });

  return normalizedRows;
};

const ensureLockDateOpen = async (db, companyId) => {
  const lockRes = await db.query('SELECT lock_date FROM companies WHERE id = $1 LIMIT 1', [companyId]);
  const lockDate = lockRes.rows?.[0]?.lock_date;
  // Nếu không có lock_date, công ty chưa khóa sổ → cho phép
  if (!lockDate) return;

  const today = new Date();
  const lockBoundary = new Date(lockDate);
  // SỬA: Nếu ngày hôm nay NHỎ HƠN hoặc BẰNG ngày khóa sổ → vẫn cho phép tạo đơn
  // Chỉ chặn khi ngày hôm nay LỚN HƠN ngày khóa sổ (đã quá hạn)
  if (today > lockBoundary) {
    throw new Error(`Doanh nghiệp đã khóa sổ đến ngày ${lockBoundary.toISOString().slice(0, 10)}. Không thể tạo đơn web.`);
  }
  // Nếu today <= lockBoundary, đồng nghĩa với việc chưa quá hạn → cho phép tiếp tục
};

const resolveLegacyAccountByConstraint = async (db, { tableName, columnName, preferredCode, fallbackCodes = [] }) => {
  const constraintRes = await db.query(
    `SELECT c.confrelid::regclass::text AS referenced_table,
            af.attname AS referenced_column
     FROM pg_constraint c
     JOIN pg_attribute a
       ON a.attrelid = c.conrelid
      AND a.attnum = ANY(c.conkey)
     JOIN pg_attribute af
       ON af.attrelid = c.confrelid
      AND af.attnum = ANY(c.confkey)
     WHERE c.contype = 'f'
       AND c.conrelid = $1::regclass
       AND a.attname = $2
     LIMIT 1`,
    [tableName, columnName]
  );

  const referencedTable = constraintRes.rows?.[0]?.referenced_table;
  const referencedColumn = constraintRes.rows?.[0]?.referenced_column;
  if (!referencedTable || !referencedColumn) {
    return preferredCode || fallbackCodes.find(Boolean) || null;
  }

  const safeTable = quoteQualifiedIdentifier(referencedTable);
  const safeColumn = quoteQualifiedIdentifier(referencedColumn);
  if (!safeTable || !safeColumn) {
    return preferredCode || fallbackCodes.find(Boolean) || null;
  }

  const candidates = [preferredCode, ...fallbackCodes]
    .map((code) => String(code || '').trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const candidateRes = await db.query(
      `SELECT 1
       FROM ${safeTable}
       WHERE ${safeColumn}::text = $1
       LIMIT 1`,
      [candidate]
    );
    if (candidateRes.rowCount > 0) return candidate;
  }

  const fallbackRes = await db.query(
    `SELECT ${safeColumn}::text AS account_code
     FROM ${safeTable}
     ORDER BY ${safeColumn}::text
     LIMIT 1`
  );

  return String(fallbackRes.rows?.[0]?.account_code || '').trim() || null;
};

const getItemsMetadata = async (db) => {
  const itemColumnsRows = await getTableColumnsMetadata(db, 'items');

  const itemColumns = new Set(
    itemColumnsRows
      .map((row) => String(row.column_name || '').trim().toLowerCase())
      .filter(Boolean)
  );

  const commonKeys = ['id', 'item_id', 'itemid', 'id_item'];
  let itemIdExpr = commonKeys.find((name) => itemColumns.has(name)) || null;

  if (!itemIdExpr) {
    const pkRes = await db.query(
      `SELECT a.attname AS column_name
       FROM pg_index i
       JOIN pg_class t ON t.oid = i.indrelid
       JOIN pg_namespace ns ON ns.oid = t.relnamespace
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
       WHERE t.relname = 'items'
         AND i.indisprimary
         AND ns.nspname = ANY(current_schemas(true))
       ORDER BY a.attnum
       LIMIT 1`
    );

    const pkColumn = String(pkRes.rows?.[0]?.column_name || '').trim().toLowerCase();
    if (pkColumn) itemIdExpr = pkColumn;
  }

  return { itemColumns, itemIdExpr };
};

const buildItemsSelectExpressions = (itemColumns) => {
  const hasCode = itemColumns.has('code');
  const hasLegacyCode = itemColumns.has('item_code');
  const hasName = itemColumns.has('name');
  const hasLegacyName = itemColumns.has('item_name');
  const hasDescription = itemColumns.has('description');
  const hasLegacyDescription = itemColumns.has('item_description');
  const hasUnit = itemColumns.has('unit');
  const hasPriceSell = itemColumns.has('price_sell');
  const hasImageUrl = itemColumns.has('image_url');

  const codeExpr = hasCode && hasLegacyCode
    ? "COALESCE(NULLIF(code, ''), NULLIF(item_code, ''), '')"
    : hasCode
      ? "COALESCE(NULLIF(code, ''), '')"
      : hasLegacyCode
        ? "COALESCE(NULLIF(item_code, ''), '')"
        : "''";

  const nameExpr = hasName && hasLegacyName
    ? "COALESCE(NULLIF(name, ''), NULLIF(item_name, ''), '')"
    : hasName
      ? "COALESCE(NULLIF(name, ''), '')"
      : hasLegacyName
        ? "COALESCE(NULLIF(item_name, ''), '')"
        : "''";

  const descriptionExpr = hasDescription
    ? "COALESCE(description, '')"
    : hasLegacyDescription
      ? "COALESCE(item_description, '')"
      : "''";

  const unitExpr = hasUnit ? "COALESCE(unit, '')" : "''";
  const priceSellExpr = hasPriceSell ? 'COALESCE(price_sell, 0)' : '0';
  const imageUrlExpr = hasImageUrl ? 'image_url' : 'NULL';

  return {
    codeExpr,
    nameExpr,
    descriptionExpr,
    unitExpr,
    priceSellExpr,
    imageUrlExpr,
    orderByNameExpr: nameExpr
  };
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

/**
 * Public Item DTO - Only exposes safe fields for storefront/public access
 * SECURITY: Excludes cost_price, price_sell, opening_quantity to prevent information leakage
 */
const buildPublicItemDTO = (row, imageUrl, imageUrls) => ({
  id: row.id,
  code: row.code,
  name: row.name,
  description: row.description,
  unit: row.unit,
  image_url: imageUrl,
  image_urls: imageUrls
  // Intentionally excluded: price_sell, cost_price, opening_quantity, company_id
});

router.get('/items', async (req, res) => {
  try {
    const companyId = req.query.company_id || req.query.companyId;
    if (!companyId) return res.status(400).json({ error: 'Thiếu company_id' });

    const { itemColumns, itemIdExpr } = await getItemsMetadata(pool);
    if (!itemIdExpr) {
      return res.status(500).json({ error: 'Bảng items thiếu khóa định danh. Cần có cột định danh hoặc khóa chính.' });
    }
    const hasImageUrls = itemColumns.has('image_urls');
    const {
      codeExpr,
      nameExpr,
      descriptionExpr,
      unitExpr,
      imageUrlExpr,
      orderByNameExpr
    } = buildItemsSelectExpressions(itemColumns);

    // SECURITY: Only select public-safe fields - no price_sell, cost_price, or opening_quantity
    const { rows } = await pool.query(
      `SELECT ${itemIdExpr} AS id,
              ${codeExpr} AS code,
              ${nameExpr} AS name,
              ${descriptionExpr} AS description,
              ${unitExpr} AS unit,
              ${imageUrlExpr} AS image_url,
              ${hasImageUrls ? "COALESCE(image_urls, '[]'::jsonb)" : "'[]'::jsonb"} AS image_urls
       FROM items
       WHERE company_id = $1
       ORDER BY ${orderByNameExpr}`,
      [companyId]
    );

    const normalizedRows = rows.map((row) => {
      const imageUrl = toAbsoluteMediaUrl(req, row.image_url);
      const imageUrls = normalizeImageUrlsField(row.image_urls)
        .map((url) => toAbsoluteMediaUrl(req, url))
        .filter(Boolean);

      if (imageUrl && !imageUrls.includes(imageUrl)) {
        imageUrls.unshift(imageUrl);
      }

      // Apply DTO transformation to ensure no sensitive data leaks
      return buildPublicItemDTO(row, imageUrl, imageUrls);
    });

    res.json(normalizedRows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/orders', rateLimiter, async (req, res) => {
  try {
    const { companyId, items, customerName, phone, address, taxRate } = req.body;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu thông tin đơn hàng' });
    }

    // Enqueue order for async processing
    const { enqueueOrder } = await import('../workers/orderQueue.js');
    const job = await enqueueOrder(req.body, req.ip, Number(companyId));
    
    // Return immediately with job ID for tracking
    res.status(202).json({
      success: true,
      message: 'Đơn hàng đang được xử lý',
      jobId: job.id,
      estimatedCompletion: '30 seconds'
    });

    // Process order asynchronously (fire and forget)
    job.finished()
      .then((result) => {
        console.log(`Order ${job.id} completed:`, result);
      })
      .catch((err) => {
        console.error(`Order ${job.id} failed:`, err);
      });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /partners/find-or-create
 * Tìm partner theo số điện thoại, nếu chưa có thì tạo mới
 */
router.post('/partners/find-or-create', async (req, res) => {
  try {
    const { company_id, partner_name, phone, address, type } = req.body;
    
    if (!company_id || !partner_name || !phone) {
      return res.status(400).json({ error: 'Thiếu thông tin: company_id, partner_name, phone' });
    }
    
    // 1. Tìm partner theo số điện thoại
    const existingRes = await pool.query(
      'SELECT id, partner_code, partner_name, phone FROM partners WHERE company_id = $1 AND phone = $2 AND is_active = TRUE LIMIT 1',
      [company_id, phone]
    );
    
    if (existingRes.rows.length > 0) {
      return res.json({ partner: existingRes.rows[0], created: false });
    }
    
    // 2. Tạo partner_code tự động
    const codeRes = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM partners WHERE company_id = $1',
      [company_id]
    );
    const nextNum = (codeRes.rows[0]?.cnt || 0) + 1;
    const partnerCode = `KH${String(nextNum).padStart(4, '0')}`;
    
    // 3. Tạo mới partner
    const insertRes = await pool.query(
      `INSERT INTO partners (company_id, partner_code, partner_name, phone, address, type, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING id, partner_code, partner_name, phone, address, type`,
      [company_id, partnerCode, partner_name, phone, address || '', type || 'customer']
    );
    
    res.status(201).json({ partner: insertRes.rows[0], created: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
