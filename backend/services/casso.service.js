/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import crypto from 'crypto';
import { pool } from '../config/db.js';
import { CASSO_BASE_URL, getCassoHeaders } from '../config/casso.js';
import { publishToCompany } from './websocket.service.js';
import { logAudit } from './audit.service.js';
import { encrypt, decrypt } from '../utils/encryption.js';

/**
 * ====================================================================
 * CASSO SERVICE - Open Banking Payment Integration
 * ====================================================================
 * - Shared API key + shared webhook
 * - Per-company bank account mapping (casso_company_accounts)
 * - Inbound webhook routes tx to company by bank_sub_acc_id
 */

// --------------------------------------------------------------------
// Casso API client
// --------------------------------------------------------------------

async function cassoRequest(method, path, body = null) {
  const url = `${CASSO_BASE_URL}${path}`;
  const options = {
    method,
    headers: getCassoHeaders()
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const message = data?.error || data?.message || `Casso API error ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.payload = data;
    throw err;
  }
  return data;
}

// --------------------------------------------------------------------
// Casso API wrappers
// --------------------------------------------------------------------

export async function getCassoUserInfo() {
  return cassoRequest('GET', '/userInfo');
}

export async function getCassoTransactions({ bankAccId, fromDate, toDate, limit = 50, offset = 0 } = {}) {
  const qs = new URLSearchParams();
  if (bankAccId) qs.set('bank_acc_id', bankAccId);
  if (fromDate) qs.set('from_date', fromDate);
  if (toDate) qs.set('to_date', toDate);
  qs.set('limit', String(limit));
  qs.set('offset', String(offset));
  return cassoRequest('GET', `/transactions?${qs.toString()}`);
}

export async function syncCassoTransactions({ bankAccId } = {}) {
  const qs = new URLSearchParams();
  if (bankAccId) qs.set('bank_acc_id', bankAccId);
  return cassoRequest('POST', `/sync?${qs.toString()}`);
}

// --------------------------------------------------------------------
// Webhook management (Casso side)
// --------------------------------------------------------------------

export async function createCassoWebhook({ webhookUrl, secureToken, bankAccountId }) {
  return cassoRequest('POST', '/webhooks', {
    webhook_url: webhookUrl,
    secure_token: secureToken,
    bank_acc_id: bankAccountId || null
  });
}

export async function getCassoWebhook(cassoWebhookId) {
  return cassoRequest('GET', `/webhooks/${encodeURIComponent(cassoWebhookId)}`);
}

export async function updateCassoWebhook(cassoWebhookId, { webhookUrl, secureToken, bankAccountId }) {
  return cassoRequest('PUT', `/webhooks/${encodeURIComponent(cassoWebhookId)}`, {
    webhook_url: webhookUrl,
    secure_token: secureToken,
    bank_acc_id: bankAccountId || null
  });
}

// --------------------------------------------------------------------
// Local DB helpers
// --------------------------------------------------------------------

export function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function saveWebhookRecord({ cassoWebhookId, companyId, secureToken, webhookUrl, bankAccountId }) {
  const result = await pool.query(
    `INSERT INTO casso_webhooks
       (casso_webhook_id, company_id, secure_token, webhook_url, bank_account_id, scope, is_active, updated_at)
     VALUES ($1, $2, $3, $4, $5, 'global', TRUE, NOW())
     ON CONFLICT (company_id) DO UPDATE
       SET casso_webhook_id = $1,
           secure_token = $3,
           webhook_url = $4,
           bank_account_id = $5,
           is_active = TRUE,
           updated_at = NOW()
     RETURNING *`,
    [cassoWebhookId, companyId, secureToken, webhookUrl, bankAccountId]
  );
  return result.rows[0];
}

export async function getWebhookByCompany(companyId) {
  const result = await pool.query(
    'SELECT * FROM casso_webhooks WHERE company_id = $1 ORDER BY id DESC LIMIT 1',
    [companyId]
  );
  return result.rows[0] || null;
}

export async function getGlobalWebhook() {
  const result = await pool.query(
    "SELECT * FROM casso_webhooks WHERE scope = 'global' ORDER BY id DESC LIMIT 1"
  );
  return result.rows[0] || null;
}

// --------------------------------------------------------------------
// Company accounts mapping
// --------------------------------------------------------------------

export async function assignCompanyAccount({ companyId, bankSubAccId, bankName, accountNumber, ownerName }) {
  const encryptedAccountNumber = accountNumber ? encrypt(accountNumber) : null;
  const encryptedOwnerName = ownerName ? encrypt(ownerName) : null;

  const result = await pool.query(
    `INSERT INTO casso_company_accounts
       (company_id, bank_sub_acc_id, bank_name, account_number, owner_name, is_active, updated_at)
     VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
     ON CONFLICT (bank_sub_acc_id) DO UPDATE
       SET company_id = $1,
           bank_name = $3,
           account_number = $4,
           owner_name = $5,
           is_active = TRUE,
           updated_at = NOW()
     RETURNING *`,
    [companyId, bankSubAccId, bankName, encryptedAccountNumber, encryptedOwnerName]
  );
  return result.rows[0];
}

export async function getCompanyByBankSubAcc(bankSubAccId) {
  const result = await pool.query(
    'SELECT * FROM casso_company_accounts WHERE bank_sub_acc_id = $1 AND is_active = TRUE LIMIT 1',
    [bankSubAccId]
  );
  return result.rows[0] || null;
}

export async function listCompanyAccounts(companyId) {
  const result = await pool.query(
    'SELECT * FROM casso_company_accounts WHERE company_id = $1 ORDER BY id DESC',
    [companyId]
  );
  return result.rows.map(row => ({
    ...row,
    account_number: row.account_number ? decrypt(row.account_number) : null,
    owner_name: row.owner_name ? decrypt(row.owner_name) : null
  }));
}

export async function listPublicCompanyAccounts(companyId) {
  const result = await pool.query(
    'SELECT bank_name, account_number, owner_name, bank_sub_acc_id FROM casso_company_accounts WHERE company_id = $1 AND is_active = TRUE ORDER BY id DESC',
    [companyId]
  );
  return result.rows.map(row => ({
    ...row,
    account_number: row.account_number ? decrypt(row.account_number) : null,
    owner_name: row.owner_name ? decrypt(row.owner_name) : null
  }));
}

// --------------------------------------------------------------------
// Webhook verification
// --------------------------------------------------------------------

export async function verifyWebhookPayload(payload) {
  const secureToken = payload?.secure_token || payload?.data?.secure_token;
  if (!secureToken) return null;

  const result = await pool.query(
    "SELECT * FROM casso_webhooks WHERE secure_token = $1 AND is_active = TRUE LIMIT 1",
    [secureToken]
  );
  return result.rows[0] || null;
}

// --------------------------------------------------------------------
// Transaction reconciliation
// --------------------------------------------------------------------

export function parseOrderNumber(description = '') {
  if (!description) return null;
  const match = description.match(/(?:ORD|WEB|DH)[-_]?[\d]+/i);
  if (match) return match[0].toUpperCase();
  return null;
}

async function createReceiptVoucher(client, { companyId, amount, partnerId, orderNumber, description, txDate, userId }) {
  const voucherDate = txDate ? new Date(txDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

  const seqRes = await client.query(
    `SELECT COUNT(*)::int AS cnt FROM vouchers WHERE company_id = $1 AND voucher_type = 'PT'`,
    [companyId]
  );
  const seq = (seqRes.rows[0].cnt || 0) + 1;
  const voucherNumber = `PT${String(seq).padStart(6, '0')}`;

  const voucherRes = await client.query(
    `INSERT INTO vouchers
       (company_id, voucher_number, voucher_date, voucher_type, description, currency, exchange_rate, created_by, is_posted)
     VALUES ($1, $2, $3, 'PT', $4, 'VND', 1, $5, TRUE)
     RETURNING id`,
    [companyId, voucherNumber, voucherDate, description || `Thu tiền đơn hàng ${orderNumber || ''}`.trim(), userId]
  );
  const voucherId = voucherRes.rows[0].id;

  await client.query(
    `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount, partner_id)
     VALUES ($1, '112', 'DR', $2, $3)`,
    [voucherId, amount, partnerId]
  );
  await client.query(
    `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount, partner_id)
     VALUES ($1, '131', 'CR', $2, $3)`,
    [voucherId, amount, partnerId]
  );

  return { voucherId, voucherNumber };
}

export async function handleIncomingTransaction(payload, webhookRecord) {
  const data = payload?.data || payload;
  const cassoTxId = String(data.id ?? data.transaction_id ?? crypto.randomUUID());
  const bankSubAccId = data.bank_sub_acc_id || data.bankSubAccId || null;
  const amount = Number(data.amount || 0);
  const description = data.description || '';
  const txDate = data.transaction_date || data.when || null;
  const credit = data.credit !== false;

  const client = await pool.connect();
  try {
    const existing = await client.query(
      'SELECT id, status, voucher_id FROM casso_transactions WHERE casso_tx_id = $1 LIMIT 1',
      [cassoTxId]
    );
    if (existing.rows.length > 0) {
      return { status: 'duplicate', transaction: existing.rows[0] };
    }

    // Resolve company by bank account mapping
    let companyId = webhookRecord?.company_id || null;
    let mappedAccount = null;
    if (!companyId && bankSubAccId) {
      mappedAccount = await getCompanyByBankSubAcc(bankSubAccId);
      if (mappedAccount) companyId = mappedAccount.company_id;
    }

    const orderNumber = parseOrderNumber(description);

    let matchedVoucher = null;
    let partnerId = null;
    if (orderNumber && companyId) {
      const vRes = await client.query(
        `SELECT v.id, vd.partner_id
         FROM vouchers v
         LEFT JOIN voucher_details vd ON vd.voucher_id = v.id AND vd.partner_id IS NOT NULL
         WHERE v.company_id = $1 AND v.voucher_number = $2 AND v.voucher_type = 'XK'
         LIMIT 1`,
        [companyId, orderNumber]
      );
      if (vRes.rows.length > 0) {
        matchedVoucher = vRes.rows[0];
        partnerId = matchedVoucher.partner_id;
      }
    }

    const insertRes = await client.query(
      `INSERT INTO casso_transactions
         (casso_tx_id, company_id, webhook_id, bank_sub_acc_id, amount, description,
          transaction_date, credit, order_number, order_id, status, raw_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        cassoTxId,
        companyId,
        webhookRecord?.id || null,
        bankSubAccId,
        amount,
        description,
        txDate ? new Date(txDate) : null,
        credit,
        orderNumber,
        matchedVoucher ? matchedVoucher.id : null,
        companyId ? (matchedVoucher ? 'pending' : 'pending') : 'unassigned',
        JSON.stringify(payload)
      ]
    );
    const transaction = insertRes.rows[0];

    if (credit && amount > 0 && matchedVoucher) {
      const receipt = await createReceiptVoucher(client, {
        companyId,
        amount,
        partnerId,
        orderNumber,
        description: `Thu tiền đơn hàng ${orderNumber}`,
        txDate,
        userId: null
      });

      await client.query(
        `UPDATE casso_transactions
         SET status = 'reconciled', order_id = $1, voucher_id = $2
         WHERE id = $3`,
        [matchedVoucher.id, receipt.voucherId, transaction.id]
      );

      await client.query(
        `UPDATE vouchers SET is_posted = TRUE, posted_at = NOW() WHERE id = $1 AND is_posted = FALSE`,
        [matchedVoucher.id]
      );

      transaction.status = 'reconciled';
      transaction.voucher_id = receipt.voucherId;
      transaction.order_id = matchedVoucher.id;

      try {
        publishToCompany(companyId, 'paymentReceived', {
          cassoTxId,
          orderNumber,
          amount,
          voucherId: receipt.voucherId,
          voucherNumber: receipt.voucherNumber,
          status: 'reconciled',
          timestamp: new Date().toISOString()
        });
      } catch (wsErr) {
        console.error('Casso WS notify error:', wsErr.message);
      }

      try {
        logAudit({
          userId: null,
          action: 'CREATE',
          entityType: 'VOUCHERS',
          newValues: { voucherId: receipt.voucherId, voucherNumber: receipt.voucherNumber, cassoTxId, orderNumber },
          ipAddress: null,
          companyId
        });
      } catch (auditErr) {
        console.warn('Casso audit warning:', auditErr.message);
      }
    } else if (credit && amount > 0 && companyId) {
      try {
        publishToCompany(companyId, 'paymentReceived', {
          cassoTxId,
          orderNumber: orderNumber || null,
          amount,
          status: 'pending',
          timestamp: new Date().toISOString()
        });
      } catch (wsErr) {
        console.error('Casso WS notify error:', wsErr.message);
      }
    }

    return { status: 'processed', transaction };
  } finally {
    client.release();
  }
}