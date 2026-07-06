import express from 'express';
import { pool } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate, createVoucherSchema } from '../middleware/validation.js';
import { canAccessCompany } from '../services/helpers.js';
import { invalidateCache } from '../cache/redis.js';
import { buildPostingUpdateValues } from '../services/voucherStatus.js';
import { buildMultiCurrencyDetail } from '../services/multiCurrency.service.js';

const router = express.Router();

// Hàm trung gian: Kiểm tra trạng thái khóa sổ nghiêm ngặt
async function checkLockDate(companyId, voucherDate) {
  const compQuery = await pool.query('SELECT lock_date FROM companies WHERE id = $1', [companyId]);
  if (compQuery.rowCount > 0 && compQuery.rows[0].lock_date) {
    const lockDate = new Date(compQuery.rows[0].lock_date);
    const targetDate = new Date(voucherDate);
    if (targetDate <= lockDate) {
      throw new Error(`Dữ liệu đã khóa sổ tính đến ngày ${compQuery.rows[0].lock_date.toISOString().split('T')[0]}. Thao tác bị từ chối!`);
    }
  }
}

// 1. GET: LẤY DANH SÁCH CHỨNG TỪ (Tích hợp Gom nhóm JSON_AGG chi tiết)
router.get('/', authenticate, async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id; 
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    if (!targetCompanyId) return res.json([]);
    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Không có quyền truy cập dữ liệu doanh nghiệp này!' });
    }

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
router.post('/', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { company_id, voucher_number, voucher_date, voucher_type, description, currency, exchange_rate, details } = req.body;
    const postingValues = buildPostingUpdateValues(req.body.is_posted ?? req.body.isPosted, req.user?.id || null, new Date());

    if (postingValues.is_posted && !['admin', 'ktt'].includes(req.user?.role)) {
      throw new Error('Chỉ quản trị hoặc kế toán trưởng mới được ghi sổ chứng từ');
    }

    // Kiểm tra khóa sổ trước khi thêm mới
    await checkLockDate(company_id, voucher_date);

    const vMasterQuery = `
      INSERT INTO vouchers (
        company_id, voucher_number, voucher_date, voucher_type, description, currency, exchange_rate, created_by, is_posted, posted_at, posted_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id
    `;
    const masterRes = await client.query(vMasterQuery, [
      company_id, voucher_number, voucher_date, voucher_type, description, currency || 'VND', exchange_rate || 1,
      req.user?.id || null, postingValues.is_posted, postingValues.posted_at, postingValues.posted_by
    ]);
    const vId = masterRes.rows[0].id;

    if (details && details.length > 0) {
      const valuesArr = [];
      const queryArgs = [];
      let idx = 1;

      details.forEach((item) => {
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
      });

      const bulkDetailQuery = `
        INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount, partner_id, item_id, quantity, amount_origin, currency_origin) 
        VALUES ${valuesArr.join(', ')}
      `;
      await client.query(bulkDetailQuery, queryArgs);
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Tạo chứng từ thành công!' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 3. POST: GHI SỔ CHỨNG TỪ
router.post('/:id/post', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const voucherId = parseInt(req.params.id, 10);
    const postingValues = buildPostingUpdateValues(true, req.user?.id || null, new Date());

    const voucherRes = await pool.query('SELECT id, company_id, voucher_date FROM vouchers WHERE id = $1', [voucherId]);
    if (voucherRes.rows.length === 0) {
      return res.status(404).json({ error: 'Chứng từ không tồn tại' });
    }

    const voucher = voucherRes.rows[0];
    await checkLockDate(voucher.company_id, voucher.voucher_date);

    const result = await pool.query(
      'UPDATE vouchers SET is_posted = $1, posted_at = $2, posted_by = $3 WHERE id = $4 RETURNING id, is_posted, posted_at, posted_by',
      [postingValues.is_posted, postingValues.posted_at, postingValues.posted_by, voucherId]
    );

    res.json({ success: true, message: 'Đã ghi sổ chứng từ', voucher: result.rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. DELETE: XÓA CHỨNG TỪ CÓ KIỂM TRA KHÓA SỔ VÀ GHI AUDIT LOG
router.delete('/:id', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const voucherId = parseInt(req.params.id, 10);
    
    // 1. Truy vấn thông tin chứng từ chính (Master)
    const voucherRes = await client.query('SELECT * FROM vouchers WHERE id = $1', [voucherId]);
    if (voucherRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Chứng từ kế toán không tồn tại' });
    }
    const voucher = voucherRes.rows[0];
    
    // 2. Kiểm tra ràng buộc ngày Khóa sổ kế toán (lock_date) - SỬ DỤNG HÀM CHUNG
    await checkLockDate(voucher.company_id, voucher.voucher_date);
    
    // 3. Truy vấn các dòng định khoản chi tiết Nợ/Có liên quan (Detail)
    const detailsRes = await client.query('SELECT * FROM voucher_details WHERE voucher_id = $1', [voucherId]);
    const details = detailsRes.rows;
    
    // Gom toàn bộ trạng thái cũ của chứng từ trước khi xóa sạch khỏi hệ thống
    const oldSnapshotValues = {
      ...voucher,
      details: details
    };
    
    // 4. Ghi nhận vào Audit Logs kèm thông tin IP định danh và dữ liệu Snapshot dạng JSON
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, old_values, new_values, ip_address) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.id || null,
        'DELETE',
        'VOUCHERS',
        JSON.stringify(oldSnapshotValues),
        null,
        req.ip
      ]
    );
    
    // 5. Tiến hành xóa dữ liệu theo thứ tự ưu tiên Khóa ngoại (Details trước, Master sau)
    await client.query('DELETE FROM voucher_details WHERE voucher_id = $1', [voucherId]);
    await client.query('DELETE FROM vouchers WHERE id = $1', [voucherId]);
    
    await client.query('COMMIT');
    res.json({ success: true, message: 'Xóa chứng từ kế toán thành công và đã đồng bộ lưu lịch sử vết hệ thống.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi khi thực hiện xóa và sao lưu log chứng từ:', err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 5. PUT: CẬP NHẬT CHỨNG TỪ (CÓ KIỂM TRA KHÓA SỔ)
router.put('/:id', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const voucherId = parseInt(req.params.id, 10);
    const { voucher_number, voucher_date, description, currency, exchange_rate, details } = req.body;
    
    // 1. Truy vấn thông tin chứng từ hiện tại
    const voucherRes = await client.query('SELECT * FROM vouchers WHERE id = $1', [voucherId]);
    if (voucherRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Chứng từ kế toán không tồn tại' });
    }
    const voucher = voucherRes.rows[0];
    
    // 2. Kiểm tra ràng buộc ngày Khóa sổ kế toán (lock_date) - SỬ DỤNG HÀM CHUNG
    await checkLockDate(voucher.company_id, voucher_date || voucher.voucher_date);
    
    // 3. Lưu trữ trạng thái cũ để ghi audit log
    const oldDetailsRes = await client.query('SELECT * FROM voucher_details WHERE voucher_id = $1', [voucherId]);
    const oldSnapshotValues = {
      ...voucher,
      details: oldDetailsRes.rows
    };
    
    // 4. Cập nhật thông tin chứng từ master
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
    
    // 5. Xóa và tạo lại chi tiết chứng từ nếu có
    if (details) {
      await client.query('DELETE FROM voucher_details WHERE voucher_id = $1', [voucherId]);
      
      const valuesArr = [];
      const queryArgs = [];
      let idx = 1;
      
      details.forEach((item) => {
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
      });
      
      if (valuesArr.length > 0) {
        const bulkDetailQuery = `
          INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount, partner_id, item_id, quantity, amount_origin, currency_origin) 
          VALUES ${valuesArr.join(', ')}
        `;
        await client.query(bulkDetailQuery, queryArgs);
      }
    }
    
    // 6. Ghi audit log
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, old_values, new_values, ip_address) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.id || null,
        'UPDATE',
        'VOUCHERS',
        JSON.stringify(oldSnapshotValues),
        JSON.stringify({ ...req.body, id: voucherId }),
        req.ip
      ]
    );
    
    await client.query('COMMIT');
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
