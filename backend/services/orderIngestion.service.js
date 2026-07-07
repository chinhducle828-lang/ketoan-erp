import { pool } from '../config/db.js';
import { publishToCompany } from './websocket.service.js';
import { getInventoryRules, getOrderIngestionRules, getSaleRules, getBusinessRules } from '../config/businessRules.js';
import { runSaga } from './saga.service.js';
import { buildAccountingEntries } from './logistics.service.js';
import { resolveTaxBreakdown } from './taxRule.service.js';
import { logAudit } from './audit.service.js';

const getSalesVoucherType = () => {
  const rules = getInventoryRules();
  return String(rules.salesVoucherType || 'XK');
};

export async function ingestOrderToVoucher(order, userId = null) {
  const client = await pool.connect();
  let createdVoucherId = null;
  const { sagaPrefix, defaultCurrency } = getOrderIngestionRules();
  const saleRules = getSaleRules();
  const businessRules = getBusinessRules();

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

              // Đọc entity_type của công ty để đồng bộ VAT theo loại hình
              let resolvedEntityType = String(order?.entity_type || '').trim().toLowerCase();
              let resolvedRevenueBand = String(order?.annual_revenue_band || '').trim().toLowerCase();
              if (!resolvedEntityType || !resolvedRevenueBand) {
                const companyRes = await client.query(
                  'SELECT entity_type, annual_revenue_band FROM companies WHERE id = $1 LIMIT 1',
                  [order.company_id]
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

              // Tính tổng doanh thu (net) và giá vốn từ items
              const amountPrecision = Number(businessRules.pricing?.amountPrecision ?? 2);
              const netAmount = Number(
                order.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0).toFixed(amountPrecision)
              );
              const costAmount = Number(
                order.items.reduce((sum, item) => sum + (Number(item.cost_amount) || 0), 0).toFixed(amountPrecision)
              );

              // Tính VAT theo entity_type (đồng bộ với storefront)
              const taxResolution = resolveTaxBreakdown({
                amount: netAmount,
                taxRate: order.taxRate,
                entityType: resolvedEntityType,
                annualRevenueBand: resolvedRevenueBand,
                category: order.category,
                businessRules,
                priceMode: order.priceMode
              });
              const { taxAmount, grossAmount } = taxResolution;

              // Tạo bút toán chuẩn: Nợ 131 / Có 511 / Có 3331 / Nợ 632 / Có 156
              const accountingEntries = buildAccountingEntries({
                amount: grossAmount,
                costAmount,
                taxAmount
              });

              for (const entry of accountingEntries) {
                if (Number(entry.amount || 0) <= 0) continue;
                await client.query(
                  `INSERT INTO voucher_details (
                    voucher_id, account_code, entry_type, amount, partner_id
                  ) VALUES ($1, $2, $3, $4, $5)`,
                  [voucherId, entry.accountCode, entry.entryType, Number(entry.amount), order.customer_id]
                );
              }

              // Dòng vận hành kho (amount=0, giữ quantity + item_id)
              for (const item of order.items) {
                const { item_id, quantity } = item;
                if (Number(quantity) > 0) {
                  await client.query(
                    `INSERT INTO voucher_details (
                      voucher_id, account_code, entry_type, amount, quantity, item_id, partner_id
                    ) VALUES ($1, $2, 'CR', 0, $3, $4, $5)`,
                    [voucherId, saleRules.logisticsOpsAccount, quantity, item_id, order.customer_id]
                  );
                }
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

    // Ghi audit log (fire and forget)
    try {
      const voucherType = getSalesVoucherType();
      const auditAction = voucherType === 'XK' ? 'GOODSISSUE' : 'CREATE';
      logAudit({
        userId: userId,
        action: auditAction,
        entityType: 'VOUCHERS',
        newValues: { voucherId: createdVoucherId, orderNumber: order.order_number, items: order.items },
        ipAddress: null,
        companyId: order.company_id
      });
    } catch (auditErr) {
      console.warn('Audit log warning:', auditErr.message);
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
