/**
 * BullMQ Queue for Storefront Orders
 * Prevents race conditions and ensures sequential order processing
 */

import { Queue, Worker, Job } from 'bullmq';
import { pool } from '../config/db.js';
import { buildOrderNumber, calculateTaxAmount, buildAccountingEntries } from '../services/logistics.service.js';
import { publishStorefrontOrderEvent } from '../services/storefrontRealtime.service.js';
import { getBusinessRules, getSaleRules } from '../config/businessRules.js';
import { sendToRole } from '../services/webPush.service.js';
import { resolveTaxBreakdown } from '../services/taxRule.service.js';
import { logAudit } from '../services/audit.service.js';

const connection = { host: process.env.REDIS_HOST || 'localhost', port: Number(process.env.REDIS_PORT || 6379) };

export const orderQueue = new Queue('storefront-orders', { connection });

const JOB_TIMEOUT = 30000;

export const orderWorker = new Worker('storefront-orders', async (job) => {
  const { orderData, requestIp, companyId } = job.data;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const businessRules = getBusinessRules();
    const saleRules = getSaleRules();
    const amountPrecision = Number(businessRules.pricing?.amountPrecision ?? 2);
    const defaultTaxRate = Number(businessRules.pricing?.defaultTaxRate ?? 0.08);
    const minOrderQuantity = Number(businessRules.pricing?.minOrderQuantity ?? 1);
    const defaultLoadingStatus = String(businessRules.voucher?.defaultLoadingStatus || 'pending_loading').trim() || 'pending_loading';
    const saleVoucherType = String(businessRules.voucher?.saleVoucherType || 'XK').trim() || 'XK';
    const voucherPrefix = String(businessRules.voucher?.storefrontPrefix || 'WEB').trim() || 'WEB';
    const excludeFinancialEntries = new Set(
      (Array.isArray(saleRules.excludeFinancialEntriesForStorefront) ? saleRules.excludeFinancialEntriesForStorefront : [])
        .map((code) => String(code || '').trim())
        .filter(Boolean)
    );

    const { entityType, annualRevenueBand, category, priceMode, discount_amount, coupon_code, tax_rate, tax_amount, shipping_fee, payment_method, payment_status, sales_channel, partner_id } = orderData;

    await ensureLockDateOpen(client, Number(companyId));

    let resolvedEntityType = String(entityType || '').trim().toLowerCase();
    let resolvedRevenueBand = String(annualRevenueBand || '').trim().toLowerCase();
    if (!resolvedEntityType || !resolvedRevenueBand) {
      const companyRes = await client.query('SELECT entity_type, annual_revenue_band FROM companies WHERE id = $1 LIMIT 1', [companyId]);
      if (companyRes.rows.length > 0) {
        if (!resolvedEntityType) resolvedEntityType = String(companyRes.rows[0].entity_type || 'company').trim().toLowerCase();
        if (!resolvedRevenueBand) resolvedRevenueBand = String(companyRes.rows[0].annual_revenue_band || 'under_1b').trim().toLowerCase();
      } else {
        resolvedEntityType = 'company';
        resolvedRevenueBand = 'under_1b';
      }
    }

    const rawItems = Array.isArray(orderData.items) && orderData.items.length > 0 ? orderData.items : [{ itemId: orderData.itemId, quantity: orderData.quantity }];
    const normalizedItems = rawItems.map((entry) => ({ itemId: String(entry?.itemId ?? '').trim(), quantity: Number(entry?.quantity) })).filter((entry) => entry.itemId !== '' && Number.isFinite(entry.quantity));
    if (normalizedItems.length === 0) throw new Error('Danh sách sản phẩm đặt hàng không hợp lệ');
    if (normalizedItems.some((entry) => entry.quantity < minOrderQuantity)) throw new Error(`Số lượng mua phải lớn hơn hoặc bằng ${minOrderQuantity}`);

    const mergedItemsMap = new Map();
    for (const entry of normalizedItems) { const current = mergedItemsMap.get(entry.itemId) || 0; mergedItemsMap.set(entry.itemId, current + entry.quantity); }
    const mergedItems = Array.from(mergedItemsMap.entries()).map(([productId, qty]) => ({ itemId: productId, quantity: qty }));

    const { itemColumns, itemIdExpr } = await getItemsMetadata(client);
    if (!itemIdExpr) throw new Error('Bảng items thiếu khóa định danh.');
    const { codeExpr, nameExpr, unitExpr, priceSellExpr } = buildItemsSelectExpressions(itemColumns);
    const itemIds = mergedItems.map((entry) => entry.itemId);
    const itemRes = await client.query(`SELECT ${itemIdExpr} AS item_pk, ${codeExpr} AS code, ${nameExpr} AS name, ${unitExpr} AS unit, ${priceSellExpr} AS price_sell FROM items WHERE company_id = $1 AND ${itemIdExpr}::text = ANY($2::text[])`, [companyId, itemIds]);
    if (itemRes.rows.length !== itemIds.length) throw new Error('Có sản phẩm không tồn tại hoặc không thuộc doanh nghiệp này');

    const itemById = new Map(itemRes.rows.map((row) => [String(row.item_pk), row]));
    const hasCostPrice = itemColumns.has('cost_price');
    const lineItems = mergedItems.map((line) => {
      const item = itemById.get(String(line.itemId));
      const unitPrice = Number(item.price_sell || 0);
      const unitCost = hasCostPrice ? Number(item.cost_price || 0) : unitPrice;
      return { itemId: item.item_pk, code: item.code, name: item.name, unit: item.unit, quantity: line.quantity, unitPrice, unitCost, lineAmount: Number((unitPrice * line.quantity).toFixed(amountPrecision)), lineCostAmount: Number((unitCost * line.quantity).toFixed(amountPrecision)) };
    });

    const amount = Number(lineItems.reduce((sum, line) => sum + line.lineAmount, 0).toFixed(amountPrecision));
    const taxResolution = resolveTaxBreakdown({ amount, taxRate: orderData.taxRate || defaultTaxRate, entityType: resolvedEntityType, annualRevenueBand: resolvedRevenueBand, category, businessRules, priceMode });
    const { taxAmount, grossAmount } = taxResolution;
    const voucherNumber = buildOrderNumber(voucherPrefix);
    const totalCostAmount = Number(lineItems.reduce((sum, line) => sum + (line.lineCostAmount || 0), 0).toFixed(amountPrecision));
    const accountingEntries = buildAccountingEntries({ amount: grossAmount, costAmount: totalCostAmount, taxAmount }).filter((entry) => !excludeFinancialEntries.has(entry.accountCode)).map((entry) => ({ ...entry, amount: Number(entry.amount || 0) })).filter((entry) => entry.amount > 0);

    const totalDr = accountingEntries.filter(e => e.entryType === 'DR').reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const totalCr = accountingEntries.filter(e => e.entryType === 'CR').reduce((sum, e) => sum + Number(e.amount || 0), 0);
    if (Math.abs(totalDr - totalCr) > 0.01) throw new Error(`Lỗi bút toán kế toán: Tổng Nợ (${totalDr}) không bằng tổng Có (${totalCr}).`);

    const description = [`Đơn web từ ${orderData.customerName || 'Khách'}`, orderData.phone ? `SĐT: ${orderData.phone}` : null, orderData.address ? `Địa chỉ: ${orderData.address}` : null, `SP: ${lineItems.slice(0, 3).map((line) => `${line.code} x${line.quantity}${line.unit ? ` ${line.unit}` : ''}`.trim()).join(', ')}${lineItems.length > 3 ? ` +${lineItems.length - 3} SP` : ''}`].filter(Boolean).join(' | ');

    const vouchersColumnsRows = await getTableColumnsMetadata(client, 'vouchers');
    const vouchersMeta = new Map(vouchersColumnsRows.map((row) => [String(row.column_name || '').trim().toLowerCase(), { isNullable: String(row.is_nullable || '').toUpperCase() !== 'NO', hasDefault: row.column_default !== null }]));
    const hasVoucherColumn = (name) => vouchersMeta.has(name);
    const isVoucherColumnRequired = (name) => { const meta = vouchersMeta.get(name); if (!meta) return false; return !meta.isNullable && !meta.hasDefault; };
    const hasVoucherNumber = hasVoucherColumn('voucher_number');
    const hasAccountDr = hasVoucherColumn('account_dr');
    const hasAccountCr = hasVoucherColumn('account_cr');
    const hasVoucherAmount = hasVoucherColumn('amount');

    const debitHeaderEntry = accountingEntries.filter((entry) => entry.entryType === 'DR').sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0] || null;
    const creditHeaderEntry = accountingEntries.filter((entry) => entry.entryType === 'CR').sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0] || null;
    const legacyAccountDr = hasAccountDr ? await resolveLegacyAccountByConstraint(client, { tableName: 'vouchers', columnName: 'account_dr', preferredCode: debitHeaderEntry?.accountCode || saleRules.receivableAccount, fallbackCodes: saleRules.legacyAccountDrFallback }) : null;
    const legacyAccountCr = hasAccountCr ? await resolveLegacyAccountByConstraint(client, { tableName: 'vouchers', columnName: 'account_cr', preferredCode: creditHeaderEntry?.accountCode || saleRules.revenueAccount, fallbackCodes: saleRules.legacyAccountCrFallback }) : null;
    if (hasAccountDr && isVoucherColumnRequired('account_dr') && !legacyAccountDr) throw new Error('Không xác định được account_dr hợp lệ cho chứng từ bán hàng.');
    if (hasAccountCr && isVoucherColumnRequired('account_cr') && !legacyAccountCr) throw new Error('Không xác định được account_cr hợp lệ cho chứng từ bán hàng.');

    const voucherInsertColumns = ['company_id', 'voucher_date', 'voucher_type', 'description'];
    const voucherInsertValues = [companyId, new Date().toISOString().slice(0, 10), saleVoucherType, description];
    if (hasVoucherNumber) { voucherInsertColumns.push('voucher_number'); voucherInsertValues.push(voucherNumber); }
    if (hasAccountDr && (legacyAccountDr || isVoucherColumnRequired('account_dr'))) { voucherInsertColumns.push('account_dr'); voucherInsertValues.push(legacyAccountDr); }
    if (hasAccountCr && (legacyAccountCr || isVoucherColumnRequired('account_cr'))) { voucherInsertColumns.push('account_cr'); voucherInsertValues.push(legacyAccountCr); }
    if (hasVoucherAmount) { voucherInsertColumns.push('amount'); voucherInsertValues.push(amount); }
    if (hasVoucherColumn('is_posted')) { voucherInsertColumns.push('is_posted'); voucherInsertValues.push(false); }
    if (hasVoucherColumn('loading_status')) { voucherInsertColumns.push('loading_status'); voucherInsertValues.push(defaultLoadingStatus); }
    if (hasVoucherColumn('discount_amount')) { voucherInsertColumns.push('discount_amount'); voucherInsertValues.push(Number(discount_amount || 0)); }
    if (hasVoucherColumn('coupon_code')) { voucherInsertColumns.push('coupon_code'); voucherInsertValues.push(coupon_code || null); }
    if (hasVoucherColumn('tax_rate')) { voucherInsertColumns.push('tax_rate'); voucherInsertValues.push(Number(tax_rate || 0)); }
    if (hasVoucherColumn('tax_amount')) { voucherInsertColumns.push('tax_amount'); voucherInsertValues.push(Number(tax_amount || 0)); }
    if (hasVoucherColumn('shipping_fee')) { voucherInsertColumns.push('shipping_fee'); voucherInsertValues.push(Number(shipping_fee || 0)); }
    if (hasVoucherColumn('payment_method')) { voucherInsertColumns.push('payment_method'); voucherInsertValues.push(payment_method || 'cod'); }
    if (hasVoucherColumn('payment_status')) { voucherInsertColumns.push('payment_status'); voucherInsertValues.push(payment_status || 'pending'); }
    if (hasVoucherColumn('sales_channel')) { voucherInsertColumns.push('sales_channel'); voucherInsertValues.push(sales_channel || 'storefront'); }
    if (hasVoucherColumn('partner_id')) { voucherInsertColumns.push('partner_id'); voucherInsertValues.push(partner_id || null); }

    const voucherInsertPlaceholders = voucherInsertColumns.map((_, index) => `$${index + 1}`).join(', ');
    const voucherRes = await client.query(`INSERT INTO vouchers (${voucherInsertColumns.join(', ')}) VALUES (${voucherInsertPlaceholders}) RETURNING id`, voucherInsertValues);
    const voucherId = voucherRes.rows[0].id;

    const detailsColumnsRows = await getTableColumnsMetadata(client, 'voucher_details');
    const detailsColumns = new Set(detailsColumnsRows.map((r) => r.column_name));
    const hasDetailQuantity = detailsColumns.has('quantity');
    const hasDetailItemId = detailsColumns.has('item_id');
    const detailInsertColumns = ['voucher_id', 'account_code', 'entry_type', 'amount'];
    if (hasDetailQuantity) detailInsertColumns.push('quantity');
    if (hasDetailItemId) detailInsertColumns.push('item_id');

    const detailRows = [];
    for (const entry of accountingEntries) { detailRows.push({ accountCode: entry.accountCode, entryType: entry.entryType, amount: entry.amount, quantity: 0, itemId: null }); }
    for (const line of lineItems) { detailRows.push({ accountCode: saleRules.logisticsOpsAccount, entryType: 'CR', amount: 0, quantity: line.quantity, itemId: line.itemId }); }

    if (detailRows.length > 0) {
      const detailValues = [];
      const detailPlaceholders = detailRows.map((row, rowIndex) => {
        const rowValues = [voucherId, row.accountCode, row.entryType, row.amount];
        if (hasDetailQuantity) rowValues.push(row.quantity);
        if (hasDetailItemId) rowValues.push(row.itemId);
        detailValues.push(...rowValues);
        const offset = rowIndex * detailInsertColumns.length;
        return `(${detailInsertColumns.map((_, colIndex) => `$${offset + colIndex + 1}`).join(', ')})`;
      });
      await client.query(`INSERT INTO voucher_details (${detailInsertColumns.join(', ')}) VALUES ${detailPlaceholders.join(', ')}`, detailValues);
    }

    const itemsMetadata = await getItemsMetadata(client);
    const hasOpeningQuantity = itemsMetadata.itemColumns.has('opening_quantity');
    if (hasOpeningQuantity && lineItems.length > 0) {
      const itemIdColumn = itemsMetadata.itemIdExpr;
      for (const line of lineItems) {
        await client.query(`UPDATE items SET opening_quantity = GREATEST(COALESCE(opening_quantity, 0) - $1, 0) WHERE ${itemIdColumn} = $2 AND company_id = $3`, [line.quantity, line.itemId, companyId]);
      }
    }

    await client.query('COMMIT');

    try {
      const auditAction = (saleVoucherType || '').trim().toUpperCase() === 'XK' ? 'GOODSISSUE' : 'CREATE';
      logAudit({ userId: null, action: auditAction, entityType: 'VOUCHERS', newValues: { voucherId, voucherNumber, amount, netAmount: amount, taxAmount, items: lineItems }, ipAddress: requestIp, companyId: Number(companyId) });
    } catch (auditErr) { console.warn('Audit log warning:', auditErr.message); }

    try {
      await pool.query(`INSERT INTO notifications (company_id, order_id, type, title, message, recipient_role) VALUES ($1, $2, 'order', 'Đơn hàng mới', $3, 'nv_banhang')`, [companyId, voucherId, `Đơn hàng ${voucherNumber} vừa được tạo`]);
      const notification = { id: voucherId, type: 'order', title: 'Đơn hàng mới', message: `Đơn hàng ${voucherNumber} vừa được tạo` };
      sendToRole('nv_banhang', companyId, notification).catch((err) => console.warn('Push notification failed:', err));
      await publishStorefrontOrderEvent(client, { event: 'order_created', companyId: Number(companyId), voucherId, voucherNumber, amount, taxAmount, createdAt: new Date().toISOString(), targetRoles: ['admin', 'nv_banhang', 'nv_kho'] });
    } catch (notifyError) { console.warn('Notification failed:', notifyError.message); }

    return { success: true, voucherId, voucherNumber, order: { companyId: Number(companyId), items: lineItems.map((line) => ({ itemId: line.itemId, code: line.code, name: line.name, unit: line.unit, quantity: line.quantity, unitPrice: line.unitPrice, amount: line.lineAmount })), amount: grossAmount, taxAmount, netAmount: amount } };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}, { connection, timeout: JOB_TIMEOUT });

orderWorker.on('failed', (job, err) => { console.error(`Order job ${job?.id} failed:`, err); });
orderWorker.on('completed', (job) => { console.log(`Order job ${job?.id} completed successfully`); });

const ensureLockDateOpen = async (db, companyId) => {
  const lockRes = await db.query('SELECT lock_date FROM companies WHERE id = $1 LIMIT 1', [companyId]);
  const lockDate = lockRes.rows?.[0]?.lock_date;
  if (!lockDate) return;
  const today = new Date();
  const lockBoundary = new Date(lockDate);
  if (today > lockBoundary) throw new Error(`Doanh nghiệp đã khóa sổ đến ngày ${lockBoundary.toISOString().slice(0, 10)}. Không thể tạo đơn web.`);
};

const getItemsMetadata = async (db) => {
  const itemColumnsRows = await getTableColumnsMetadata(db, 'items');
  const itemColumns = new Set(itemColumnsRows.map((row) => String(row.column_name || '').trim().toLowerCase()).filter(Boolean));
  const commonKeys = ['id', 'item_id', 'itemid', 'id_item'];
  let itemIdExpr = commonKeys.find((name) => itemColumns.has(name)) || null;
  if (!itemIdExpr) {
    const pkRes = await db.query(`SELECT a.attname AS column_name FROM pg_index i JOIN pg_class t ON t.oid = i.indrelid JOIN pg_namespace ns ON ns.oid = t.relnamespace JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey) WHERE t.relname = 'items' AND i.indisprimary AND ns.nspname = ANY(current_schemas(true)) ORDER BY a.attnum LIMIT 1`);
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
  const codeExpr = hasCode && hasLegacyCode ? "COALESCE(NULLIF(code, ''), NULLIF(item_code, ''), '')" : hasCode ? "COALESCE(NULLIF(code, ''), '')" : hasLegacyCode ? "COALESCE(NULLIF(item_code, ''), '')" : "''";
  const nameExpr = hasName && hasLegacyName ? "COALESCE(NULLIF(name, ''), NULLIF(item_name, ''), '')" : hasName ? "COALESCE(NULLIF(name, ''), '')" : hasLegacyName ? "COALESCE(NULLIF(item_name, ''), '')" : "''";
  const descriptionExpr = hasDescription ? "COALESCE(description, '')" : hasLegacyDescription ? "COALESCE(item_description, '')" : "''";
  const unitExpr = hasUnit ? "COALESCE(unit, '')" : "''";
  const priceSellExpr = hasPriceSell ? 'COALESCE(price_sell, 0)' : '0';
  const imageUrlExpr = hasImageUrl ? 'image_url' : 'NULL';
  return { codeExpr, nameExpr, descriptionExpr, unitExpr, priceSellExpr, imageUrlExpr, orderByNameExpr: nameExpr };
};

const getTableColumnsMetadata = async (db, tableName) => {
  const normalizedName = String(tableName || '').trim().toLowerCase();
  if (!normalizedName) return [];
  const cacheEntry = tableColumnsCache.get(normalizedName);
  if (cacheEntry && Date.now() - cacheEntry.cachedAt < SCHEMA_CACHE_TTL_MS) return cacheEntry.rows;
  const { rows } = await db.query(`SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = $1 AND table_schema NOT IN ('information_schema', 'pg_catalog')`, [normalizedName]);
  const normalizedRows = rows.map((row) => ({ column_name: String(row.column_name || '').trim().toLowerCase(), is_nullable: String(row.is_nullable || '').trim().toUpperCase(), column_default: row.column_default }));
  tableColumnsCache.set(normalizedName, { cachedAt: Date.now(), rows: normalizedRows });
  return normalizedRows;
};

const resolveLegacyAccountByConstraint = async (db, { tableName, columnName, preferredCode, fallbackCodes = [] }) => {
  const constraintRes = await db.query(`SELECT c.confrelid::regclass::text AS referenced_table, af.attname AS referenced_column FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = ANY(c.conkey) WHERE c.contype = 'f' AND c.conrelid = $1::regclass AND a.attname = $2 LIMIT 1`, [tableName, columnName]);
  const referencedTable = constraintRes.rows?.[0]?.referenced_table;
  const referencedColumn = constraintRes.rows?.[0]?.referenced_column;
  if (!referencedTable || !referencedColumn) return preferredCode || fallbackCodes.find(Boolean) || null;
  const safeTable = quoteQualifiedIdentifier(referencedTable);
  const safeColumn = quoteQualifiedIdentifier(referencedColumn);
  if (!safeTable || !safeColumn) return preferredCode || fallbackCodes.find(Boolean) || null;
  const candidates = [preferredCode, ...fallbackCodes].map((code) => String(code || '').trim()).filter(Boolean);
  for (const candidate of candidates) { const candidateRes = await db.query(`SELECT 1 FROM ${safeTable} WHERE ${safeColumn}::text = $1 LIMIT 1`, [candidate]); if (candidateRes.rowCount > 0) return candidate; }
  const fallbackRes = await db.query(`SELECT ${safeColumn}::text AS account_code FROM ${safeTable} ORDER BY ${safeColumn}::text LIMIT 1`);
  return String(fallbackRes.rows?.[0]?.account_code || '').trim() || null;
};

const quoteQualifiedIdentifier = (identifier) => {
  const raw = String(identifier || '').trim();
  if (!raw) return null;
  const parts = raw.split('.').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.some((part) => !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(part))) return null;
  return parts.map((part) => `"${part}"`).join('.');
};

export const enqueueOrder = async (orderData, requestIp, companyId) => {
  const job = await orderQueue.add('process-order', { orderData, requestIp, companyId }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
  return job;
};