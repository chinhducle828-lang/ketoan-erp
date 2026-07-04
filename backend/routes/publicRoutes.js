import express from 'express';
import { pool } from '../config/db.js';
import { buildOrderNumber, calculateTaxAmount, buildAccountingEntries } from '../services/logistics.service.js';

const router = express.Router();

router.get('/items', async (req, res) => {
  try {
    const companyId = req.query.company_id || req.query.companyId;
    if (!companyId) return res.status(400).json({ error: 'Thiếu company_id' });

    const itemColumnsRes = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'items'`
    );
    const itemColumns = new Set(itemColumnsRes.rows.map((row) => row.column_name));
    const itemIdExpr = itemColumns.has('id')
      ? 'id'
      : itemColumns.has('item_id')
        ? 'item_id'
        : null;
    if (!itemIdExpr) {
      return res.status(500).json({ error: 'Bảng items thiếu khóa định danh (id/item_id).' });
    }
    const hasImageUrls = itemColumns.has('image_urls');
    const hasOpeningQuantity = itemColumns.has('opening_quantity');
    const descriptionExpr = itemColumns.has('description')
      ? "COALESCE(description, '')"
      : itemColumns.has('item_description')
        ? "COALESCE(item_description, '')"
        : "''";

    const { rows } = await pool.query(
      `SELECT ${itemIdExpr} AS id,
              company_id,
              COALESCE(NULLIF(code, ''), item_code) AS code,
              COALESCE(NULLIF(name, ''), item_name) AS name,
              ${descriptionExpr} AS description,
              unit,
              COALESCE(price_sell, 0) AS price_sell,
              ${hasOpeningQuantity ? 'COALESCE(opening_quantity, 0)' : '0'} AS opening_quantity,
              image_url,
              ${hasImageUrls ? "COALESCE(image_urls, '[]'::jsonb)" : "'[]'::jsonb"} AS image_urls
       FROM items
       WHERE company_id = $1
       ORDER BY COALESCE(NULLIF(name, ''), item_name)`,
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

    const rawItems = Array.isArray(items) && items.length > 0
      ? items
      : [{ itemId, quantity }];

    const normalizedItems = rawItems
      .map((entry) => ({
        itemId: Number(entry?.itemId),
        quantity: Number(entry?.quantity)
      }))
      .filter((entry) => Number.isInteger(entry.itemId) && Number.isFinite(entry.quantity));

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

    const itemColumnsRes = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'items'`
    );
    const itemColumns = new Set(itemColumnsRes.rows.map((row) => row.column_name));
    const itemIdExpr = itemColumns.has('id')
      ? 'id'
      : itemColumns.has('item_id')
        ? 'item_id'
        : null;
    if (!itemIdExpr) {
      return res.status(500).json({ error: 'Bảng items thiếu khóa định danh (id/item_id).' });
    }

    const itemIds = mergedItems.map((entry) => entry.itemId);
    const itemRes = await client.query(
      `SELECT ${itemIdExpr} AS item_pk,
              COALESCE(NULLIF(code, ''), item_code) AS code,
              COALESCE(NULLIF(name, ''), item_name) AS name,
              unit,
              COALESCE(price_sell, 0) AS price_sell
       FROM items
       WHERE company_id = $1 AND ${itemIdExpr} = ANY($2::int[])`,
      [companyId, itemIds]
    );

    if (itemRes.rows.length !== itemIds.length) {
      return res.status(404).json({ error: 'Có sản phẩm không tồn tại hoặc không thuộc doanh nghiệp này' });
    }

    const itemById = new Map(itemRes.rows.map((row) => [Number(row.item_pk), row]));
    const lineItems = mergedItems.map((line) => {
      const item = itemById.get(line.itemId);
      const unitPrice = Number(item.price_sell || 0);
      const lineAmount = Number((unitPrice * line.quantity).toFixed(2));
      return {
        itemId: line.itemId,
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
    const voucherType = hasVoucherNumber ? 'XK' : 'Xuat';

    const voucherRes = hasVoucherNumber
      ? await client.query(
          `INSERT INTO vouchers (company_id, voucher_number, voucher_date, voucher_type, description, is_posted, loading_status)
           VALUES ($1, $2, CURRENT_DATE, $3, $4, FALSE, 'pending_loading') RETURNING id`,
          [companyId, voucherNumber, voucherType, description]
        )
      : await client.query(
          `INSERT INTO vouchers (company_id, voucher_date, voucher_type, description, account_dr, account_cr, amount, is_posted, loading_status)
           VALUES ($1, CURRENT_DATE, $2, $3, '131', '511', $4, FALSE, 'pending_loading') RETURNING id`,
          [companyId, voucherType, description, amount]
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

    // Dòng xuất kho giữ liên kết item và quantity để đồng bộ xử lý kho sau này.
    for (const line of lineItems) {
      const columns = ['voucher_id', 'account_code', 'entry_type', 'amount'];
      const values = [voucherId, '156', 'CR', line.lineAmount];
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
