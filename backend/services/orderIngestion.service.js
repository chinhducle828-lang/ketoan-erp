import { pool } from '../config/db.js';
import { publishToCompany } from './websocket.service.js';
import { getInventoryRules, getOrderIngestionRules } from '../config/businessRules.js';
import { runSaga } from './saga.service.js';

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
  let createdVoucherId = null;
  const { sagaPrefix, defaultCurrency } = getOrderIngestionRules();

  const rollbackVoucher = async (voucherId) => {
    if (!voucherId) return;
    await client.query('DELETE FROM voucher_details WHERE voucher_id = $1', [voucherId]);
    await client.query('DELETE FROM vouchers WHERE id = $1', [voucherId]);
  };

  try {
    const sagaResult = await runSaga({
      sagaId: `${sagaPrefix}:${order?.order_number || 'unknown'}`,
      steps: [
        {
          name: 'validate-order',
          execute: async () => {
            if (!order?.company_id || !order?.order_number || !order?.order_date || !order?.items || !Array.isArray(order.items) || order.items.length === 0) {
              throw new Error('Thiếu thông tin bắt buộc: company_id, order_number, order_date, items');
            }
          }
        },
        {
          name: 'create-voucher',
          execute: async () => {
            try {
              await client.query('BEGIN');

              const voucherType = getSalesVoucherType();
              const inventoryAccount = getInventoryAccount();
              const salesAccount = getSalesAccount();

              const voucherRes = await client.query(
                `INSERT INTO vouchers (
                  company_id, voucher_type, voucher_date, voucher_number,
                  description, currency, exchange_rate, created_by, is_posted
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
                [
                  order.company_id,
                  voucherType,
                  order.order_date,
                  order.order_number,
                  order.description || `Đơn hàng từ storefront: ${order.order_number}`,
                  defaultCurrency,
                  1,
                  userId,
                  false
                ]
              );

              const voucherId = voucherRes.rows[0].id;
              let totalDebit = 0;

              for (const item of order.items) {
                const { item_id, quantity, amount } = item;
                if (quantity > 0 && amount > 0) {
                  totalDebit += parseFloat(amount);
                  await client.query(
                    `INSERT INTO voucher_details (
                      voucher_id, account_code, entry_type, amount, quantity, item_id, partner_id
                    ) VALUES ($1, $2, 'DR', $3, $4, $5, $6)`,
                    [voucherId, inventoryAccount, amount, quantity, item_id, order.customer_id]
                  );
                }
              }

              if (totalDebit > 0) {
                await client.query(
                  `INSERT INTO voucher_details (
                    voucher_id, account_code, entry_type, amount, partner_id
                  ) VALUES ($1, $2, 'CR', $3, $4)`,
                  [voucherId, salesAccount, totalDebit, order.customer_id]
                );
              }

              await client.query('COMMIT');
              createdVoucherId = voucherId;
              return voucherId;
            } catch (error) {
              await client.query('ROLLBACK');
              throw error;
            }
          }
        }
      ],
      compensations: [
        {
          name: 'rollback-voucher',
          execute: async () => {
            if (createdVoucherId) {
              await rollbackVoucher(createdVoucherId);
            }
          }
        }
      ]
    });

    if (sagaResult.status === 'failed') {
      throw new Error(sagaResult.error);
    }

    try {
      publishToCompany(order.company_id, 'orderCreated', {
        orderId: createdVoucherId,
        orderNumber: order.order_number,
        status: 'draft',
        timestamp: new Date().toISOString()
      });
    } catch (wsError) {
      console.error('WebSocket notification error:', wsError);
    }

    return {
      voucher_id: createdVoucherId,
      voucher_number: order.order_number,
      status: 'draft'
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.warn('Rollback warning:', rollbackErr.message);
    }
    throw err;
  } finally {
    client.release();
  }
}
