/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import express from 'express';
import { pool } from '../config/db.js';
import { authenticate, requireRole, checkCompanyAccess } from '../middleware/auth.js';
import { validate, createVoucherSchema } from '../middleware/validation.js';
import { invalidateCache } from '../cache/redis.js';
import { buildPostingUpdateValues, emitVoucherPostingRealtime } from '../services/voucherStatus.js';
import { buildMultiCurrencyDetail } from '../services/multiCurrency.service.js';
import { checkCompanyActive } from '../middleware/waf.js';
import { emitVoucherRealtime } from '../services/voucherRealtime.service.js';
import { assertCompanyOperational, validateVoucherDetailReferences } from '../services/cascadeValidation.service.js';
import { logAction, getClientIp, logVoucherDetails } from '../services/auditLog.service.js';
import { requireSignedVoucher } from '../middleware/signingCheck.js';
import { EventHelpers } from '../services/eventStore.service.js';
import { redis, isRedisReadyCheck } from '../cache/redis.js';

const router = express.Router();

// Constants
const POSTING_ALLOWED_ROLES = ['admin', 'ktt'];

/**
 * Kiểm tra trạng thái khóa sổ nghiêm ngặt
 * Compares dates as YYYY-MM-DD strings to avoid timezone issues
 */
async function checkLockDate(companyId, voucherDate) {
  const compQuery = await pool.query('SELECT lock_date FROM companies WHERE id = $1', [companyId]);
  if (compQuery.rowCount > 0 && compQuery.rows[0].lock_date) {
    const lockDateStr = String(compQuery.rows[0].lock_date).split('T')[0];
    const targetDateStr = String(voucherDate).split('T')[0];
    if (targetDateStr <= lockDateStr) {
      throw new Error(
        `Dữ liệu đã khóa sổ tính đến ngày ${lockDateStr}. Không cho phép thao tác, vui lòng dùng bút toán điều chỉnh.`
      );
    }
  }
}

/**
 * Check idempotency key to prevent duplicate voucher creation
 */
async function checkIdempotency(companyId, idempotencyKey, client) {
  if (!idempotencyKey) return null;
  
  const existing = await client.query(
    `SELECT result FROM idempotency_keys 
     WHERE company_id = $1 AND event_type = 'CREATE_VOUCHER' AND idempotency_key = $2`,
    [companyId, idempotencyKey]
  );
  
  if (existing.rows.length > 0) {
    return existing.rows[0].result;
  }
  
  // Reserve the idempotency key
  await client.query(
    `INSERT INTO idempotency_keys (company_id, event_type, idempotency_key, status)
     VALUES ($1, 'CREATE_VOUCHER', $2, 'processing')
     ON CONFLICT (company_id, event_type, idempotency_key) DO NOTHING`,
    [companyId, idempotencyKey]
  );
  
  return null;
}

/**
 * Complete idempotency key after successful operation
 */
async function completeIdempotency(companyId, idempotencyKey, result, client) {
  if (!idempotencyKey) return;
  
  await client.query(
    `UPDATE idempotency_keys 
     SET status = 'completed', result = $3, completed_at = NOW()
     WHERE company_id = $1 AND event_type = 'CREATE_VOUCHER' AND idempotency_key = $2`,
    [companyId, idempotencyKey, JSON.stringify(result)]
  );
}

// 1. GET: LẤY DANH SÁCH CHỨNG TỪ
router.get('/', authenticate, checkCompanyAccess, async (req, res) => {
  try {
    const targetCompanyId = req.companyId;
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    const queryStr = `
      SELECT 
        v.id, 
        v.company_id as "companyId", 
        v.voucher_number as "voucherNumber",
        v.voucher_date as "voucherDate", 
        v.description, 
        v.voucher_type as "type",
        v.currency,
        v.exchange_rate as "exchangeRate",
        v.is_posted as "isPosted",
        v.posted_at as "postedAt",
        v.posted_by as "postedBy",
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', vd.id,
              'accountCode', vd.account_code,
              'entryType', vd.entry_type,
              'amount', vd.amount,
              'quantity', vd.quantity,
              'partnerId', vd.partner_id,
              'itemId', vd.item_id
            )
          ) FILTER (WHERE vd.id IS NOT NULL), '[]'
        ) as details
      FROM vouchers v
      LEFT JOIN voucher_details vd ON v.id = vd.voucher_id
      WHERE v.company_id = $1 AND EXTRACT(YEAR FROM v.voucher_date) = $2
      GROUP BY v.id
      ORDER BY v.voucher_date DESC, v.id DESC
    `;
    const result = await pool.query(queryStr, [targetCompanyId, year]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. POST: TẠO MỚI CHỨNG TỪ ĐA DÒNG, ĐA TIỀN TỆ
router.post('/', authenticate, checkCompanyAccess, checkCompanyActive, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { voucher_number, voucher_date, voucher_type, description, 
            currency, exchange_rate, details, idempotency_key } = req.body;
    
    // Use the validated company_id from checkCompanyAccess middleware (req.companyId)
    // rather than reading from req.body to prevent cross-company data leaks
    const company_id = req.companyId;
    
    // Check idempotency first
    const existingResult = await checkIdempotency(company_id, idempotency_key, client);
    if (existingResult === 'processing') {
      await client.query('ROLLBACK');
      return res.status(409).json({ 
        error: 'Duplicate request detected. This voucher is being created by another request.',
        idempotency_key: idempotency_key
      });
    }
    if (existingResult) {
      await client.query('COMMIT');
      return res.status(200).json(existingResult);
    }
    
    const postingValues = buildPostingUpdateValues(
      req.body.is_posted ?? req.body.isPosted, 
      req.user?.id || null, 
      new Date()
    );

    if (postingValues.is_posted && !POSTING_ALLOWED_ROLES.includes(req.user?.role)) {
      throw new Error('Chỉ quản trị hoặc kế toán trưởng mới được ghi sổ chứng từ');
    }

    // Validate before insert
    await checkLockDate(company_id, voucher_date);
    await assertCompanyOperational(company_id, { client });
    await validateVoucherDetailReferences({ client, companyId: company_id, details });

    const vMasterQuery = `
      INSERT INTO vouchers (
        company_id, voucher_number, voucher_date, voucher_type, description, 
        currency, exchange_rate, created_by, is_posted, posted_at, posted_by, amount
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id
    `;
    const masterRes = await client.query(vMasterQuery, [
      company_id, voucher_number, voucher_date, voucher_type, description, 
      currency || 'VND', exchange_rate || 1,
      req.user?.id || null, postingValues.is_posted, 
      postingValues.posted_at, postingValues.posted_by, 0
    ]);
    const vId = masterRes.rows[0].id;

    if (details && details.length > 0) {
      const valuesArr = [];
      const queryArgs = [];
      let idx = 1;

      for (const item of details) {
        const normalized = buildMultiCurrencyDetail(item, exchange_rate || 1);
        valuesArr.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8})`);
        queryArgs.push(
          vId,
          normalized.accountCode || normalized.account_code,
          normalized.entryType || normalized.entry_type,
          normalized.amount,
          normalized.partnerId || normalized.partner_id || null,
          normalized.itemId || normalized.item_id || null,
          normalized.quantity || 0,
          normalized.amountOrigin ?? normalized.amount_origin ?? null,
          normalized.currencyOrigin || normalized.currency_origin || 'VND'
        );
        idx += 9;
      }

      const bulkDetailQuery = `
        INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount, partner_id, item_id, quantity, amount_origin, currency_origin) 
        VALUES ${valuesArr.join(', ')}
      `;
      await client.query(bulkDetailQuery, queryArgs);
    }

    // Audit log
    await logAction({
      userId: req.user?.id || null,
      action: 'CREATE',
      entityType: 'VOUCHERS',
      newValues: { voucher_number, voucher_date, voucher_type, description, currency, exchange_rate, is_posted: postingValues.is_posted },
      ipAddress: getClientIp(req),
      companyId: company_id
    });

    if (details && details.length > 0) {
      const detailRecords = details.map((item) => ({
        voucher_id: vId,
        account_code: item.accountCode || item.account_code,
        entry_type: item.entryType || item.entry_type,
        amount: item.amount,
        quantity: item.quantity || 0,
        partner_id: item.partnerId || item.partner_id || null,
        item_id: item.itemId || item.item_id || null
      }));
      await logVoucherDetails({
        companyId: company_id, userId: req.user?.id || null,
        action: 'CREATE', details: detailRecords,
        ipAddress: getClientIp(req),
        voucherInfo: { voucher_number, voucher_type }
      });
    }

    // Event Store
    await EventHelpers.voucherCreated({
      id: vId, company_id, voucher_number, voucher_date, voucher_type,
      amount: 0, is_posted: postingValues.is_posted
    }, req.user?.id || null, {
      ip_address: getClientIp(req), details_count: details?.length || 0
    });

    // Complete idempotency
    const successResult = { success: true, message: 'Tạo chứng từ thành công!', voucherId: vId };
    await completeIdempotency(company_id, idempotency_key, successResult, client);

    await client.query('COMMIT');

    // Invalidate cache
    if (isRedisReadyCheck()) {
      invalidateCache(`company_${company_id}:voucher:*`).catch(() => {});
    }

    emitVoucherRealtime('created', {
      voucherId: vId, companyId: company_id, type: voucher_type,
      posted: postingValues.is_posted, userId: req.user?.id || null,
      clientInstanceId: req.headers['x-client-instance-id'] || null
    });

    res.status(201).json(successResult);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 3. POST: GHI SỔ CHỨNG TỪ
router.post('/:id/post', authenticate, checkCompanyAccess, requireRole(POSTING_ALLOWED_ROLES), requireSignedVoucher, async (req, res) => {
  try {
    const voucherId = parseInt(req.params.id, 10);
    const postingValues = buildPostingUpdateValues(true, req.user?.id || null, new Date());

    const voucherRes = await pool.query('SELECT id, company_id, voucher_date FROM vouchers WHERE id = $1', [voucherId]);
    if (voucherRes.rows.length === 0) {
      return res.status(404).json({ error: 'Chứng từ không tồn tại' });
    }

    const voucher = voucherRes.rows[0];
    
    // Validate company access for the voucher's company
    if (voucher.company_id !== req.companyId) {
      // Use the voucher's company_id for lock date check
    }
    
    await checkLockDate(voucher.company_id, voucher.voucher_date);

    const result = await pool.query(
      'UPDATE vouchers SET is_posted = $1, posted_at = $2, posted_by = $3 WHERE id = $4 RETURNING id, is_posted, posted_at, posted_by',
      [postingValues.is_posted, postingValues.posted_at, postingValues.posted_by, voucherId]
    );

    // Event Store
    await EventHelpers.voucherPosted({
      id: voucherId, company_id: voucher.company_id, voucher_date: voucher.voucher_date,
      is_posted: result.rows[0].is_posted,
      posted_at: result.rows[0].posted_at,
      posted_by: result.rows[0].posted_by
    }, req.user?.id || null, { ip_address: getClientIp(req) });

    // Invalidate cache
    if (isRedisReadyCheck()) {
      invalidateCache(`company_${voucher.company_id}:voucher:*`).catch(() => {});
    }

    emitVoucherPostingRealtime({
      voucherId, companyId: voucher.company_id,
      posted: result.rows[0]?.is_posted,
      postedBy: postingValues.posted_by,
      postedAt: postingValues.posted_at,
      clientInstanceId: req.headers['x-client-instance-id'] || null
    });

    res.json({ success: true, message: 'Đã ghi sổ chứng từ', voucher: result.rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. DELETE: XÓA CHỨNG TỪ CÓ KIỂM TRA KHÓA SỔ VÀ GHI AUDIT LOG
router.delete('/:id', authenticate, checkCompanyAccess, requireRole(POSTING_ALLOWED_ROLES), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const voucherId = parseInt(req.params.id, 10);
    
    const voucherRes = await client.query('SELECT * FROM vouchers WHERE id = $1', [voucherId]);
    if (voucherRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Chứng từ kế toán không tồn tại' });
    }
    const voucher = voucherRes.rows[0];

    if (voucher.is_posted) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Chứng từ đã ghi sổ. Không cho phép xóa vật lý, vui lòng lập bút toán điều chỉnh.' });
    }
    
    await checkLockDate(voucher.company_id, voucher.voucher_date);
    
    const detailsRes = await client.query('SELECT * FROM voucher_details WHERE voucher_id = $1', [voucherId]);
    const details = detailsRes.rows;
    const oldSnapshotValues = { ...voucher, details };

    // Audit log
    await logAction({
      userId: req.user?.id || null, action: 'DELETE', entityType: 'VOUCHERS',
      oldValues: oldSnapshotValues, ipAddress: getClientIp(req),
      companyId: voucher.company_id
    });

    if (details && details.length > 0) {
      await logVoucherDetails({
        companyId: voucher.company_id, userId: req.user?.id || null,
        action: 'DELETE', details, ipAddress: getClientIp(req),
        voucherInfo: { voucher_number: voucher.voucher_number, voucher_type: voucher.voucher_type }
      });
    }
    
    // Event Store
    await EventHelpers.voucherDeleted({
      id: voucherId, company_id: voucher.company_id,
      voucher_number: voucher.voucher_number, voucher_date: voucher.voucher_date,
      voucher_type: voucher.voucher_type, amount: voucher.amount
    }, req.user?.id || null, { ip_address: getClientIp(req), reason: 'User requested deletion' });

    await client.query('DELETE FROM voucher_details WHERE voucher_id = $1', [voucherId]);
    await client.query('DELETE FROM vouchers WHERE id = $1', [voucherId]);
    
    await client.query('COMMIT');

    // Invalidate cache
    if (isRedisReadyCheck()) {
      invalidateCache(`company_${voucher.company_id}:voucher:*`).catch(() => {});
    }

    emitVoucherRealtime('deleted', {
      voucherId, companyId: voucher.company_id, type: voucher.voucher_type,
      userId: req.user?.id || null,
      clientInstanceId: req.headers['x-client-instance-id'] || null
    });

    res.json({ success: true, message: 'Xóa chứng từ kế toán thành công và đã đồng bộ lưu lịch sử vết hệ thống.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi khi thực hiện xóa và sao lưu log chứng từ:', err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 5. PUT: CẬP NHẬT CHỨNG TỪ
router.put('/:id', authenticate, checkCompanyAccess, requireRole(POSTING_ALLOWED_ROLES), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const voucherId = parseInt(req.params.id, 10);
    const { voucher_number, voucher_date, description, currency, exchange_rate, details } = req.body;
    
    const voucherRes = await client.query('SELECT * FROM vouchers WHERE id = $1', [voucherId]);
    if (voucherRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Chứng từ kế toán không tồn tại' });
    }
    const voucher = voucherRes.rows[0];
    
    if (voucher.is_posted) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Chứng từ đã ghi sổ. Không cho phép sửa, vui lòng lập bút toán điều chỉnh.' });
    }
    
    await checkLockDate(voucher.company_id, voucher_date || voucher.voucher_date);
    await assertCompanyOperational(voucher.company_id, { client });
    await validateVoucherDetailReferences({ client, companyId: voucher.company_id, details });
    
    // Save old state for audit
    const oldDetailsRes = await client.query('SELECT * FROM voucher_details WHERE voucher_id = $1', [voucherId]);
    const oldSnapshotValues = { ...voucher, details: oldDetailsRes.rows };
    
    // Update voucher master
    await client.query(
      `UPDATE vouchers 
       SET voucher_number = COALESCE($1, voucher_number),
           voucher_date = COALESCE($2, voucher_date),
           description = COALESCE($3, description),
           currency = COALESCE($4, currency),
           exchange_rate = COALESCE($5, exchange_rate)
       WHERE id = $6`,
      [voucher_number, voucher_date, description, currency, exchange_rate, voucherId]
    );
    
    // Replace details if provided
    if (details) {
      await client.query('DELETE FROM voucher_details WHERE voucher_id = $1', [voucherId]);
      
      const valuesArr = [];
      const queryArgs = [];
      let idx = 1;
      
      for (const item of details) {
        const normalized = buildMultiCurrencyDetail(item, exchange_rate || 1);
        valuesArr.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6}, $${idx+7}, $${idx+8})`);
        queryArgs.push(
          voucherId,
          normalized.accountCode || normalized.account_code,
          normalized.entryType || normalized.entry_type,
          normalized.amount,
          normalized.partnerId || normalized.partner_id || null,
          normalized.itemId || normalized.item_id || null,
          normalized.quantity || 0,
          normalized.amountOrigin ?? normalized.amount_origin ?? null,
          normalized.currencyOrigin || normalized.currency_origin || 'VND'
        );
        idx += 9;
      }
      
      if (valuesArr.length > 0) {
        const bulkDetailQuery = `
          INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount, partner_id, item_id, quantity, amount_origin, currency_origin) 
          VALUES ${valuesArr.join(', ')}
        `;
        await client.query(bulkDetailQuery, queryArgs);
      }
    }
    
    // Audit log
    await logAction({
      userId: req.user?.id || null, action: 'UPDATE', entityType: 'VOUCHERS',
      oldValues: oldSnapshotValues, newValues: { ...req.body, id: voucherId },
      ipAddress: getClientIp(req), companyId: voucher.company_id
    });

    // Log detail changes
    if (details && details.length > 0) {
      if (oldDetailsRes.rows.length > 0) {
        await logVoucherDetails({
          companyId: voucher.company_id, userId: req.user?.id || null,
          action: 'DELETE', details: oldDetailsRes.rows, ipAddress: getClientIp(req),
          voucherInfo: { voucher_number: voucher.voucher_number, voucher_type: voucher.voucher_type }
        });
      }
      
      const newDetailRecords = details.map((item) => ({
        voucher_id: voucherId,
        account_code: item.accountCode || item.account_code,
        entry_type: item.entryType || item.entry_type,
        amount: item.amount, quantity: item.quantity || 0,
        partner_id: item.partnerId || item.partner_id || null,
        item_id: item.itemId || item.item_id || null
      }));
      await logVoucherDetails({
        companyId: voucher.company_id, userId: req.user?.id || null,
        action: 'CREATE', details: newDetailRecords, ipAddress: getClientIp(req),
        voucherInfo: { voucher_number: voucher.voucher_number, voucher_type: voucher.voucher_type }
      });
    }
    
    // Event Store
    await EventHelpers.voucherUpdated({
      id: voucherId, company_id: voucher.company_id,
      voucher_number: voucher_number || voucher.voucher_number,
      voucher_date: voucher_date || voucher.voucher_date,
      voucher_type: voucher.voucher_type, amount: voucher.amount
    }, req.user?.id || null, {
      ip_address: getClientIp(req),
      changes: { voucher_number, voucher_date, description, currency, exchange_rate }
    });

    await client.query('COMMIT');

    // Invalidate cache
    if (isRedisReadyCheck()) {
      invalidateCache(`company_${voucher.company_id}:voucher:*`).catch(() => {});
    }

    emitVoucherRealtime('updated', {
      voucherId, companyId: voucher.company_id, type: voucher.voucher_type,
      userId: req.user?.id || null,
      clientInstanceId: req.headers['x-client-instance-id'] || null
    });

    res.json({ success: true, message: 'Cập nhật chứng từ thành công!' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi khi cập nhật chứng từ:', err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;