import express from 'express';
import { pool } from '../config/db.js';
import { buildOrderNumber, calculateTaxAmount, buildAccountingEntries } from '../services/logistics.service.js';
import { publishStorefrontOrderEvent } from '../services/storefrontRealtime.service.js';
import { getBusinessRules, getSaleRules } from '../config/businessRules.js';
import { sendToRole } from '../services/webPush.service.js';
import { resolveTaxBreakdown } from '../services/taxRule.service.js';
import { logAudit } from '../services/audit.service.js';

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
  if (!lockDate) return;

  const today = new Date();
  const lockBoundary = new Date(lockDate);
  if (today <= lockBoundary) {
    throw new Error(`Doanh nghiệp đã khóa sổ đến ngày ${lockBoundary.toISOString().slice(0, 10)}. Không thể tạo đơn web.`);
  }
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

router.get('/items', async (req, res) => {
  try {
    const companyId = req.query.company_id || req.query.companyId;
    if (!companyId) return res.status(400).json({ error: 'Thiếu company_id' });

    const { itemColumns, itemIdExpr } = await getItemsMetadata(pool);
    if (!itemIdExpr) {
      return res.status(500).json({ error: 'Bảng items thiếu khóa định danh. Cần có cột định danh hoặc khóa chính.' });
    }
    const hasImageUrls = itemColumns.has('image_urls');
    const hasOpeningQuantity = itemColumns.has('opening_quantity');
    const {
      codeExpr,
      nameExpr,
      descriptionExpr,
      unitExpr,
      priceSellExpr,
      imageUrlExpr,
      orderByNameExpr
    } = buildItemsSelectExpressions(itemColumns);

    const { rows } = await pool.query(
      `SELECT ${itemIdExpr} AS id,
              company_id,
              ${codeExpr} AS code,
              ${nameExpr} AS name,
              ${descriptionExpr} AS description,
              ${unitExpr} AS unit,
              ${priceSellExpr} AS price_sell,
              ${hasOpeningQuantity ? 'COALESCE(opening_quantity, 0)' : '0'} AS opening_quantity,
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

      return {
        ...row,
        image_url: imageUrl,
        image_urls: imageUrls
      };
    });

    res.json(normalizedRows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/orders', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const businessRules = getBusinessRules();
    const saleRules = getSaleRules();
    const amountPrecision = Number(businessRules.pricing?.amountPrecision ?? 2);
    const defaultTaxRate = Number(businessRules.pricing?.defaultTaxRate ?? 0.1);
    const minOrderQuantity = Number(businessRules.pricing?.minOrderQuantity ?? 1);
    const defaultLoadingStatus = String(businessRules.voucher?.defaultLoadingStatus || 'pending_loading').trim() || 'pending_loading';
    const saleVoucherType = String(businessRules.voucher?.saleVoucherType || 'XK').trim() || 'XK';
    const voucherPrefix = String(businessRules.voucher?.storefrontPrefix || 'WEB').trim() || 'WEB';
    const excludeFinancialEntries = new Set(
      (Array.isArray(saleRules.excludeFinancialEntriesForStorefront)
        ? saleRules.excludeFinancialEntriesForStorefront
        : [])
      .map((code) => String(code || '').trim())
      .filter(Boolean)
    );

    const { companyId, itemId, quantity, items, customerName, phone, address, taxRate, entityType, annualRevenueBand, category, priceMode } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu thông tin đơn hàng' });
    }

    await ensureLockDateOpen(client, Number(companyId));

    // Tự động lấy thông tin pháp nhân từ companies nếu payload không gửi
    let resolvedEntityType = String(entityType || '').trim().toLowerCase();
    let resolvedRevenueBand = String(annualRevenueBand || '').trim().toLowerCase();
    if (!resolvedEntityType || !resolvedRevenueBand) {
      const companyRes = await client.query(
        'SELECT entity_type, annual_revenue_band FROM companies WHERE id = $1 LIMIT 1',
        [companyId]
      );
      if (companyRes.rows.length > 0) {
        if (!resolvedEntityType) {
          resolvedEntityType = String(companyRes.rows[0].entity_type || 'company').trim().toLowerCase();
        }
        if (!resolvedRevenueBand) {
          resolvedRevenueBand = String(companyRes.rows[0].annual_revenue_band || 'under_1b').trim().toLowerCase();
        }
      } else {
        resolvedEntityType = 'company';
        resolvedRevenueBand = 'under_1b';
      }
    }

    const rawItems = Array.isArray(items) && items.length > 0
      ? items
      : [{ itemId, quantity }];

    const normalizedItems = rawItems
      .map((entry) => ({
        itemId: String(entry?.itemId ?? '').trim(),
        quantity: Number(entry?.quantity)
      }))
      .filter((entry) => entry.itemId !== '' && Number.isFinite(entry.quantity));

    if (normalizedItems.length === 0) {
      return res.status(400).json({ error: 'Danh sách sản phẩm đặt hàng không hợp lệ' });
    }

    if (normalizedItems.some((entry) => entry.quantity < minOrderQuantity)) {
      return res.status(400).json({ error: `Số lượng mua phải lớn hơn hoặc bằng ${minOrderQuantity}` });
    }

    const mergedItemsMap = new Map();
    for (const entry of normalizedItems) {
      const current = mergedItemsMap.get(entry.itemId) || 0;
      mergedItemsMap.set(entry.itemId, current + entry.quantity);
    }

    const mergedItems = Array.from(mergedItemsMap.entries()).map(([productId, qty]) => ({
      itemId: productId,
      quantity: qty
    }));

    const { itemColumns, itemIdExpr } = await getItemsMetadata(client);
    if (!itemIdExpr) {
      return res.status(500).json({ error: 'Bảng items thiếu khóa định danh. Cần có cột định danh hoặc khóa chính.' });
    }
    const { codeExpr, nameExpr, unitExpr, priceSellExpr } = buildItemsSelectExpressions(itemColumns);

    const itemIds = mergedItems.map((entry) => entry.itemId);
    const itemRes = await client.query(
      `SELECT ${itemIdExpr} AS item_pk,
              ${codeExpr} AS code,
              ${nameExpr} AS name,
              ${unitExpr} AS unit,
              ${priceSellExpr} AS price_sell
       FROM items
       WHERE company_id = $1 AND ${itemIdExpr}::text = ANY($2::text[])`,
      [companyId, itemIds]
    );

    if (itemRes.rows.length !== itemIds.length) {
      return res.status(404).json({ error: 'Có sản phẩm không tồn tại hoặc không thuộc doanh nghiệp này' });
    }

    const itemById = new Map(itemRes.rows.map((row) => [String(row.item_pk), row]));
    const hasCostPrice = itemColumns.has('cost_price');
    const lineItems = mergedItems.map((line) => {
      const item = itemById.get(String(line.itemId));
      const unitPrice = Number(item.price_sell || 0);
      const unitCost = hasCostPrice ? Number(item.cost_price || 0) : unitPrice;
      const lineAmount = Number((unitPrice * line.quantity).toFixed(amountPrecision));
      const lineCostAmount = Number((unitCost * line.quantity).toFixed(amountPrecision));
      return {
        itemId: item.item_pk,
        code: item.code,
        name: item.name,
        unit: item.unit,
        quantity: line.quantity,
        unitPrice,
        unitCost,
        lineAmount,
        lineCostAmount
      };
    });

    const amount = Number(lineItems.reduce((sum, line) => sum + line.lineAmount, 0).toFixed(amountPrecision));
    const taxResolution = resolveTaxBreakdown({
      amount,
      taxRate,
      entityType: resolvedEntityType,
      annualRevenueBand: resolvedRevenueBand,
      category,
      businessRules,
      priceMode
    });
    const { taxAmount, grossAmount } = taxResolution;

    const voucherNumber = buildOrderNumber(voucherPrefix);
    const totalCostAmount = Number(lineItems.reduce((sum, line) => sum + (line.lineCostAmount || 0), 0).toFixed(amountPrecision));
    const accountingEntries = buildAccountingEntries({ amount: grossAmount, costAmount: totalCostAmount, taxAmount })
      .filter((entry) => !excludeFinancialEntries.has(entry.accountCode))
      .map((entry) => ({
        ...entry,
        amount: Number(entry.amount || 0)
      }))
      .filter((entry) => entry.amount > 0);

    const description = [
      `Đơn web từ ${customerName || 'Khách'}`,
      phone ? `SĐT: ${phone}` : null,
      address ? `Địa chỉ: ${address}` : null,
      `SP: ${lineItems
        .slice(0, 3)
        .map((line) => `${line.code} x${line.quantity}${line.unit ? ` ${line.unit}` : ''}`.trim())
        .join(', ')}${lineItems.length > 3 ? ` +${lineItems.length - 3} SP` : ''}`
    ].filter(Boolean).join(' | ');

    const vouchersColumnsRows = await getTableColumnsMetadata(client, 'vouchers');
    const vouchersMeta = new Map(
      vouchersColumnsRows.map((row) => [
        String(row.column_name || '').trim().toLowerCase(),
        {
          isNullable: String(row.is_nullable || '').toUpperCase() !== 'NO',
          hasDefault: row.column_default !== null
        }
      ])
    );

    const hasVoucherColumn = (name) => vouchersMeta.has(name);
    const isVoucherColumnRequired = (name) => {
      const meta = vouchersMeta.get(name);
      if (!meta) return false;
      return !meta.isNullable && !meta.hasDefault;
    };

    const hasVoucherNumber = hasVoucherColumn('voucher_number');
    const hasAccountDr = hasVoucherColumn('account_dr');
    const hasAccountCr = hasVoucherColumn('account_cr');
    const hasVoucherAmount = hasVoucherColumn('amount');
    const voucherType = saleVoucherType;

    const debitHeaderEntry = accountingEntries
      .filter((entry) => entry.entryType === 'DR')
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0] || null;
    const creditHeaderEntry = accountingEntries
      .filter((entry) => entry.entryType === 'CR')
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0] || null;

    const legacyAccountDr = hasAccountDr
      ? await resolveLegacyAccountByConstraint(client, {
          tableName: 'vouchers',
          columnName: 'account_dr',
          preferredCode: debitHeaderEntry?.accountCode || saleRules.receivableAccount,
          fallbackCodes: saleRules.legacyAccountDrFallback
        })
      : null;

    const legacyAccountCr = hasAccountCr
      ? await resolveLegacyAccountByConstraint(client, {
          tableName: 'vouchers',
          columnName: 'account_cr',
          preferredCode: creditHeaderEntry?.accountCode || saleRules.revenueAccount,
          fallbackCodes: saleRules.legacyAccountCrFallback
        })
      : null;

    if (hasAccountDr && isVoucherColumnRequired('account_dr') && !legacyAccountDr) {
      return res.status(400).json({ error: 'Không xác định được account_dr hợp lệ cho chứng từ bán hàng.' });
    }

    if (hasAccountCr && isVoucherColumnRequired('account_cr') && !legacyAccountCr) {
      return res.status(400).json({ error: 'Không xác định được account_cr hợp lệ cho chứng từ bán hàng.' });
    }

    const voucherInsertColumns = ['company_id', 'voucher_date', 'voucher_type', 'description'];
    const voucherInsertValues = [companyId, new Date().toISOString().slice(0, 10), voucherType, description];

    if (hasVoucherNumber) {
      voucherInsertColumns.push('voucher_number');
      voucherInsertValues.push(voucherNumber);
    }

    if (hasAccountDr && (legacyAccountDr || isVoucherColumnRequired('account_dr'))) {
      voucherInsertColumns.push('account_dr');
      voucherInsertValues.push(legacyAccountDr);
    }

    if (hasAccountCr && (legacyAccountCr || isVoucherColumnRequired('account_cr'))) {
      voucherInsertColumns.push('account_cr');
      voucherInsertValues.push(legacyAccountCr);
    }

    if (hasVoucherAmount) {
      voucherInsertColumns.push('amount');
      voucherInsertValues.push(amount);
    }

    if (hasVoucherColumn('is_posted')) {
      voucherInsertColumns.push('is_posted');
      voucherInsertValues.push(false);
    }

    if (hasVoucherColumn('loading_status')) {
      voucherInsertColumns.push('loading_status');
      voucherInsertValues.push(defaultLoadingStatus);
    }

    const voucherInsertPlaceholders = voucherInsertColumns
      .map((_, index) => `$${index + 1}`)
      .join(', ');

    const voucherRes = await client.query(
      `INSERT INTO vouchers (${voucherInsertColumns.join(', ')})
       VALUES (${voucherInsertPlaceholders}) RETURNING id`,
      voucherInsertValues
    );

    const voucherId = voucherRes.rows[0].id;

    const detailsColumnsRows = await getTableColumnsMetadata(client, 'voucher_details');
    const detailsColumns = new Set(detailsColumnsRows.map((r) => r.column_name));
    const hasDetailQuantity = detailsColumns.has('quantity');
    const hasDetailItemId = detailsColumns.has('item_id');

    const detailInsertColumns = ['voucher_id', 'account_code', 'entry_type', 'amount'];
    if (hasDetailQuantity) detailInsertColumns.push('quantity');
    if (hasDetailItemId) detailInsertColumns.push('item_id');

    const detailRows = [];
    for (const entry of accountingEntries) {
      detailRows.push({
        accountCode: entry.accountCode,
        entryType: entry.entryType,
        amount: entry.amount,
        quantity: 0,
        itemId: null
      });
    }

    // Dòng vận hành kho được tách khỏi bút toán tài chính: amount=0, chỉ giữ quantity + item_id để logistics xử lý.
    for (const line of lineItems) {
      detailRows.push({
        accountCode: saleRules.logisticsOpsAccount,
        entryType: 'CR',
        amount: 0,
        quantity: line.quantity,
        itemId: line.itemId
      });
    }

    if (detailRows.length > 0) {
      const detailValues = [];
      const detailPlaceholders = detailRows.map((row, rowIndex) => {
        const rowValues = [voucherId, row.accountCode, row.entryType, row.amount];
        if (hasDetailQuantity) rowValues.push(row.quantity);
        if (hasDetailItemId) rowValues.push(row.itemId);

        detailValues.push(...rowValues);
        const offset = rowIndex * detailInsertColumns.length;
        const rowPlaceholders = detailInsertColumns.map((_, colIndex) => `$${offset + colIndex + 1}`);
        return `(${rowPlaceholders.join(', ')})`;
      });

      await client.query(
        `INSERT INTO voucher_details (${detailInsertColumns.join(', ')})
         VALUES ${detailPlaceholders.join(', ')}`,
        detailValues
      );
    }

    // Tự động trừ số lượng tồn kho khi có giao dịch bán hàng
    const itemsMetadata = await getItemsMetadata(client);
    const hasOpeningQuantity = itemsMetadata.itemColumns.has('opening_quantity');
    if (hasOpeningQuantity && lineItems.length > 0) {
      const itemIdColumn = itemsMetadata.itemIdExpr;
      const itemIdsToUpdate = lineItems.map(line => line.itemId);
      
      // Trừ số lượng cho từng sản phẩm trong đơn hàng
      for (const line of lineItems) {
        await client.query(
          `UPDATE items 
           SET opening_quantity = GREATEST(COALESCE(opening_quantity, 0) - $1, 0) 
           WHERE ${itemIdColumn} = $2 AND company_id = $3`,
          [line.quantity, line.itemId, companyId]
        );
      }
    }

    await client.query('COMMIT');

    // Ghi audit log (non-blocking)
    try {
      const auditAction = (voucherType || '').trim().toUpperCase() === 'XK' ? 'GOODSISSUE' : 'CREATE';
      logAudit({
        userId: null,
        action: auditAction,
        entityType: 'VOUCHERS',
        newValues: { voucherId, voucherNumber, amount, netAmount: amount, taxAmount, items: lineItems },
        ipAddress: req.ip,
        companyId: Number(companyId)
      });
    } catch (auditErr) {
      console.warn('Audit log warning:', auditErr.message);
    }

    // Send notifications (non-blocking)
    try {
      // 1. Save notification to DB
      await pool.query(`
        INSERT INTO notifications (company_id, order_id, type, title, message, recipient_role)
        VALUES ($1, $2, 'order', 'Đơn hàng mới', $3, 'nv_banhang')
      `, [companyId, voucherId, `Đơn hàng ${voucherNumber} vừa được tạo`]);

      // 2. Send push notification to sales staff (fire and forget)
      const notification = {
        id: voucherId,
        type: 'order',
        title: 'Đơn hàng mới',
        message: `Đơn hàng ${voucherNumber} vừa được tạo`
      };
      
      sendToRole('nv_banhang', companyId, notification).catch(err => 
        console.warn('Push notification failed:', err)
      );

      // 3. Publish SSE event (keep existing)
      await publishStorefrontOrderEvent(client, {
        event: 'order_created',
        companyId: Number(companyId),
        voucherId,
        voucherNumber,
        amount,
        taxAmount,
        createdAt: new Date().toISOString(),
        targetRoles: ['admin', 'nv_banhang', 'nv_kho']
      });
    } catch (notifyError) {
      // Notification failure must not break order creation flow.
      console.warn('Notification failed:', notifyError.message);
    }

    res.status(201).json({
      success: true,
      voucherId,
      voucherNumber,
      order: {
        companyId: Number(companyId),
        items: lineItems.map((line) => ({
          itemId: line.itemId,
          code: line.code,
          name: line.name,
          unit: line.unit,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          amount: line.lineAmount
        })),
        amount: grossAmount,
        taxAmount,
        netAmount: amount
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

export default router;
