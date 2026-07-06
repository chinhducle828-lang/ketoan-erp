import { pool } from '../config/db.js';
import { publishToCompany } from './websocket.service.js';
import { getInventoryRules } from '../config/businessRules.js';

const getSalesVoucherType = () => {
  const rules = getInventoryRules();
  return String(rules.salesVoucherType || 'XK');
};

const getInventoryAccount = () => {
  const rules = getInventoryRules();
  const accounts = rules.accounts || {};
  return String(accounts.inventory || '156');
};

const getSalesAccount = () => {
  const rules = getInventoryRules();
  const accounts = rules.accounts || {};
  return String(accounts.sales || '511');
};

export async function ingestOrderToVoucher(order, userId = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      company_id,
      order_number,
      order_date,
      customer_id,
      items,
      description
    } = order;

    if (!company_id || !order_number || !order_date || !items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Thiếu thông tin bắt buộc: company_id, order_number, order_date, items');
    }

    const voucherType = getSalesVoucherType();
    const inventoryAccount = getInventoryAccount();
    const salesAccount = getSalesAccount();

    const voucherRes = await client.query(
      `INSERT INTO vouchers (
        company_id, voucher_type, voucher_date, voucher_number,
        description, currency, exchange_rate, created_by, is_posted
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        company_id,
        voucherType,
        order_date,
        order_number,
        description || `Đơn hàng từ storefront: ${order_number}`,
        'VND',
        1,
        userId,
        false
      ]
    );

    const voucherId = voucherRes.rows[0].id;
    let totalDebit = 0;

    for (const item of items) {
      const { item_id, quantity, amount } = item;
      if (quantity > 0 && amount > 0) {
        totalDebit += parseFloat(amount);
        await client.query(
          `INSERT INTO voucher_details (
            voucher_id, account_code, entry_type, amount, quantity, item_id, partner_id
          ) VALUES ($1, $2, 'DR', $3, $4, $5, $6)`,
          [voucherId, inventoryAccount, amount, quantity, item_id, customer_id]
        );
      }
    }

    if (totalDebit > 0) {
      await client.query(
        `INSERT INTO voucher_details (
          voucher_id, account_code, entry_type, amount, partner_id
        ) VALUES ($1, $2, 'CR', $3, $4)`,
        [voucherId, salesAccount, totalDebit, customer_id]
      );
    }

    await client.query('COMMIT');

    try {
      publishToCompany(company_id, 'orderCreated', {
        orderId: voucherId,
        orderNumber: order_number,
        status: 'draft',
        timestamp: new Date().toISOString()
      });
    } catch (wsError) {
      console.error('WebSocket notification error:', wsError);
    }

    return {
      voucher_id: voucherId,
      voucher_number: order_number,
      status: 'draft'
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
