import express from 'express';
import { pool } from '../config/db.js';
import { buildOrderNumber, calculateTaxAmount, buildAccountingEntries } from '../services/logistics.service.js';

const router = express.Router();

const IDENTIFIER_PART_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const quoteQualifiedIdentifier = (identifier) => {
  const raw = String(identifier || '').trim();
  if (!raw) return null;
  const parts = raw.split('.').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.some((part) => !IDENTIFIER_PART_REGEX.test(part))) return null;
  return parts.map((part) => `"${part}"`).join('.');
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
  const itemColumnsRes = await db.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'items'
       AND table_schema NOT IN ('information_schema', 'pg_catalog')`
  );

  const itemColumns = new Set(
    itemColumnsRes.rows
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

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/orders', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { companyId, itemId, quantity, items, customerName, phone, address, taxRate = 0.1 } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu thông tin đơn hàng' });
    }

    await ensureLockDateOpen(client, Number(companyId));

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

    if (normalizedItems.some((entry) => entry.quantity <= 0)) {
      return res.status(400).json({ error: 'Số lượng mua phải lớn hơn 0' });
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
    const lineItems = mergedItems.map((line) => {
      const item = itemById.get(String(line.itemId));
      const unitPrice = Number(item.price_sell || 0);
      const lineAmount = Number((unitPrice * line.quantity).toFixed(2));
      return {
        itemId: item.item_pk,
        code: item.code,
        name: item.name,
        unit: item.unit,
        quantity: line.quantity,
        unitPrice,
        lineAmount
      };
    });

    const amount = Number(lineItems.reduce((sum, line) => sum + line.lineAmount, 0).toFixed(2));
    const safeTaxRate = Number.isFinite(Number(taxRate)) ? Number(taxRate) : 0.1;

    const voucherNumber = buildOrderNumber('WEB');
    const taxAmount = calculateTaxAmount(amount, safeTaxRate);
    const accountingEntries = buildAccountingEntries({ amount, costAmount: 0, taxAmount })
      .filter((entry) => !['632', '156'].includes(entry.accountCode))
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

    const vouchersColumnsRes = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'vouchers'`
    );
    const vouchersColumns = new Set(vouchersColumnsRes.rows.map((r) => r.column_name));
    const hasVoucherNumber = vouchersColumns.has('voucher_number');
    const hasAccountDr = vouchersColumns.has('account_dr');
    const hasAccountCr = vouchersColumns.has('account_cr');
    const voucherType = 'XK';

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
          preferredCode: debitHeaderEntry?.accountCode || '131',
          fallbackCodes: ['131', '111', '112']
        })
      : null;

    const legacyAccountCr = hasAccountCr
      ? await resolveLegacyAccountByConstraint(client, {
          tableName: 'vouchers',
          columnName: 'account_cr',
          preferredCode: creditHeaderEntry?.accountCode || '511',
          fallbackCodes: ['511', '3331', '33311', '131']
        })
      : null;

    if (!hasVoucherNumber && hasAccountDr && !legacyAccountDr) {
      return res.status(400).json({ error: 'Không xác định được account_dr hợp lệ cho chứng từ bán hàng.' });
    }

    if (!hasVoucherNumber && hasAccountCr && !legacyAccountCr) {
      return res.status(400).json({ error: 'Không xác định được account_cr hợp lệ cho chứng từ bán hàng.' });
    }

    const voucherRes = hasVoucherNumber
      ? await client.query(
          `INSERT INTO vouchers (company_id, voucher_number, voucher_date, voucher_type, description, is_posted, loading_status)
           VALUES ($1, $2, CURRENT_DATE, $3, $4, FALSE, 'pending_loading') RETURNING id`,
          [companyId, voucherNumber, voucherType, description]
        )
      : await client.query(
          `INSERT INTO vouchers (company_id, voucher_date, voucher_type, description, account_dr, account_cr, amount, is_posted, loading_status)
           VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, FALSE, 'pending_loading') RETURNING id`,
          [companyId, voucherType, description, legacyAccountDr, legacyAccountCr, amount]
        );

    const voucherId = voucherRes.rows[0].id;

    const detailsColumnsRes = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'voucher_details'`
    );
    const detailsColumns = new Set(detailsColumnsRes.rows.map((r) => r.column_name));
    const hasDetailQuantity = detailsColumns.has('quantity');
    const hasDetailItemId = detailsColumns.has('item_id');

    for (const entry of accountingEntries) {
      const columns = ['voucher_id', 'account_code', 'entry_type', 'amount'];
      const values = [voucherId, entry.accountCode, entry.entryType, entry.amount];
      if (hasDetailQuantity) {
        columns.push('quantity');
        values.push(0);
      }
      if (hasDetailItemId) {
        columns.push('item_id');
        values.push(null);
      }

      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
      await client.query(
        `INSERT INTO voucher_details (${columns.join(', ')})
         VALUES (${placeholders})`,
        values
      );
    }

    // Dòng vận hành kho được tách khỏi bút toán tài chính: amount=0, chỉ giữ quantity + item_id để logistics xử lý.
    for (const line of lineItems) {
      const columns = ['voucher_id', 'account_code', 'entry_type', 'amount'];
      const values = [voucherId, '156_OPS', 'CR', 0];
      if (hasDetailQuantity) {
        columns.push('quantity');
        values.push(line.quantity);
      }
      if (hasDetailItemId) {
        columns.push('item_id');
        values.push(line.itemId);
      }

      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
      await client.query(
        `INSERT INTO voucher_details (${columns.join(', ')})
         VALUES (${placeholders})`,
        values
      );
    }

    await client.query('COMMIT');
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
        amount,
        taxAmount
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
