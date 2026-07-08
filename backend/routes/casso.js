/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { canAccessCompany } from '../services/helpers.js';
import {
  getCassoUserInfo,
  getCassoTransactions,
  syncCassoTransactions,
  createCassoWebhook,
  getCassoWebhook,
  updateCassoWebhook,
  saveWebhookRecord,
  getWebhookByCompany,
  getGlobalWebhook,
  generateSecureToken,
  verifyWebhookPayload,
  handleIncomingTransaction,
  assignCompanyAccount,
  listCompanyAccounts,
  listPublicCompanyAccounts
} from '../services/casso.service.js';
import { getCassoWebhookUrl } from '../config/casso.js';

const router = express.Router();

/**
 * ====================================================================
 * ADMIN: WEBHOOK MANAGEMENT (shared webhook)
 * ====================================================================
 */

router.post('/webhooks', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const webhookUrl = getCassoWebhookUrl();
    if (!webhookUrl) {
      return res.status(400).json({ success: false, error: 'Chưa cấu hình PUBLIC_APP_URL. Không thể xác định URL webhook.' });
    }

    const secureToken = generateSecureToken();
    const cassoRes = await createCassoWebhook({
      webhookUrl,
      secureToken,
      bankAccountId: null
    });

    const cassoWebhookId = cassoRes?.data?.id || cassoRes?.id || null;
    const record = await saveWebhookRecord({
      cassoWebhookId,
      companyId: null,
      secureToken,
      webhookUrl,
      bankAccountId: null
    });

    res.status(201).json({
      success: true,
      message: 'Đã đăng ký webhook Casso thành công',
      webhook: record,
      cassoResponse: cassoRes
    });
  } catch (error) {
    console.error('Lỗi đăng ký webhook Casso:', error);
    res.status(error.status || 500).json({ success: false, error: error.message, details: error.payload || null });
  }
});

router.get('/webhooks/:id', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const cassoRes = await getCassoWebhook(req.params.id);
    res.json({ success: true, data: cassoRes });
  } catch (error) {
    console.error('Lỗi lấy webhook Casso:', error);
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

router.put('/webhooks/:id', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { webhook_url, secure_token, bank_account_id } = req.body;
    const cassoRes = await updateCassoWebhook(req.params.id, {
      webhookUrl: webhook_url,
      secureToken: secure_token,
      bankAccountId: bank_account_id
    });

    const local = await getGlobalWebhook();
    if (local) {
      const { pool } = await import('../config/db.js');
      await pool.query(
        `UPDATE casso_webhooks
         SET webhook_url = COALESCE($2, webhook_url),
             secure_token = COALESCE($3, secure_token),
             bank_account_id = COALESCE($4, bank_account_id),
             updated_at = NOW()
         WHERE id = $1`,
        [local.id, webhook_url, secure_token, bank_account_id]
      );
    }

    res.json({ success: true, message: 'Đã cập nhật webhook Casso', data: cassoRes });
  } catch (error) {
    console.error('Lỗi cập nhật webhook Casso:', error);
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

router.delete('/webhooks/:id', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    await updateCassoWebhook(req.params.id, { webhookUrl: '', secureToken: '', bankAccountId: null });
    const { pool } = await import('../config/db.js');
    await pool.query("UPDATE casso_webhooks SET is_active = FALSE WHERE scope = 'global'");
    res.json({ success: true, message: 'Đã vô hiệu hóa webhook Casso' });
  } catch (error) {
    console.error('Lỗi xóa webhook Casso:', error);
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

router.get('/webhooks/local', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const record = await getGlobalWebhook();
    if (!record) {
      return res.status(404).json({ success: false, error: 'Chưa đăng ký webhook Casso' });
    }
    res.json({ success: true, webhook: record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * ====================================================================
 * ADMIN: CASSO USER INFO + BANK ACCOUNTS
 * ====================================================================
 */

router.get('/user', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const data = await getCassoUserInfo();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Lỗi lấy thông tin Casso user:', error);
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

/**
 * ====================================================================
 * ADMIN: COMPANY ACCOUNTS MAPPING
 * ====================================================================
 */

router.post('/company-accounts', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { company_id, bank_sub_acc_id, bank_name, account_number, owner_name } = req.body;
    if (!company_id || !bank_sub_acc_id) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id hoặc bank_sub_acc_id' });
    }
    if (!(await canAccessCompany(req.user, company_id))) {
      return res.status(403).json({ success: false, error: 'Không có quyền truy cập công ty này' });
    }

    const record = await assignCompanyAccount({ companyId: company_id, bankSubAccId: bank_sub_acc_id, bankName: bank_name, accountNumber: account_number, ownerName: owner_name });
    res.status(201).json({ success: true, account: record });
  } catch (error) {
    console.error('Lỗi gán tài khoản Casso:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/company-accounts', authenticate, async (req, res) => {
  try {
    const { company_id } = req.query;
    if (!company_id) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id' });
    }
    if (!(await canAccessCompany(req.user, company_id))) {
      return res.status(403).json({ success: false, error: 'Không có quyền truy cập' });
    }

    const rows = await listCompanyAccounts(Number(company_id));
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/company-accounts/public', async (req, res) => {
  try {
    const { company_id } = req.query;
    if (!company_id) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id' });
    }
    const rows = await listPublicCompanyAccounts(Number(company_id));
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * ====================================================================
 * ADMIN: TRANSACTIONS + SYNC
 * ====================================================================
 */

router.get('/transactions', authenticate, async (req, res) => {
  try {
    const { company_id, status, limit = 50, offset = 0 } = req.query;
    if (!company_id) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id' });
    }
    if (!(await canAccessCompany(req.user, company_id))) {
      return res.status(403).json({ success: false, error: 'Không có quyền truy cập' });
    }

    const { pool } = await import('../config/db.js');
    let query = 'SELECT * FROM casso_transactions WHERE company_id = $1';
    const params = [company_id];
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    params.push(parseInt(limit, 10), parseInt(offset, 10));
    query += ` ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows, total: result.rows.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/sync', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { bank_acc_id } = req.query;
    const data = await syncCassoTransactions({ bankAccId: bank_acc_id });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Lỗi đồng bộ Casso:', error);
    res.status(error.status || 500).json({ success: false, error: error.message });
  }
});

/**
 * ====================================================================
 * PUBLIC: WEBHOOK ENDPOINT (Casso calls this)
 * ====================================================================
 */

router.post('/webhook', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    const payload = req.body;
    const webhookRecord = await verifyWebhookPayload(payload);

    if (!webhookRecord) {
      console.warn('⚠️ [CASSO] Webhook bị từ chối: secure_token không hợp lệ.');
      return res.status(200).json({ success: false, error: 'invalid secure_token' });
    }

    const records = Array.isArray(payload?.data) ? payload.data : [payload];
    const results = [];
    for (const record of records) {
      const singlePayload = payload?.data ? { ...payload, data: record } : record;
      const result = await handleIncomingTransaction(singlePayload, webhookRecord);
      results.push(result);
    }

    res.status(200).json({ success: true, processed: results.length, results });
  } catch (error) {
    console.error('Lỗi xử lý webhook Casso:', error);
    res.status(200).json({ success: false, error: error.message });
  }
});

export { router as cassoRouter };
export default router;