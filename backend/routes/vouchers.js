import express from 'express';
import { pool } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate, createVoucherSchema } from '../middleware/validation.js';
import { canAccessCompany } from '../services/helpers.js';
import { invalidateCache } from '../cache/redis.js';

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

    // Kiểm tra khóa sổ trước khi thêm mới
    await checkLockDate(company_id, voucher_date);

    const vMasterQuery = `
      INSERT INTO vouchers (company_id, voucher_number, voucher_date, voucher_type, description, currency, exchange_rate, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id
    `;
    const masterRes = await client.query(vMasterQuery, [
      company_id, voucher_number, voucher_date, voucher_type, description, currency || 'VND', exchange_rate || 1, req.user?.id || null
    ]);
    const vId = masterRes.rows[0].id;

    if (details && details.length > 0) {
      const valuesArr = [];
      const queryArgs = [];
      let idx = 1;

      details.forEach((item) => {
        valuesArr.push(`($${idx}, $${idx+1}, $${idx+2}, $${idx+3}, $${idx+4}, $${idx+5}, $${idx+6})`);
        queryArgs.push(vId, item.accountCode, item.entryType, item.amount, item.partnerId || null, item.itemId || null, item.quantity || 0);
        idx += 7;
      });

      const bulkDetailQuery = `
        INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount, partner_id, item_id, quantity) 
        VALUES ${valuesArr.join(', ')}
      `;
      await client.query(bulkDetailQuery, queryArgs);
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Tạo chứng từ thành công!' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 3. DELETE: XÓA CHỨNG TỪ CÓ KIỂM TRA KHÓA SỔ VÀ GHI AUDIT LOG
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
    
    // 2. Kiểm tra ràng buộc ngày Khóa sổ kế toán (lock_date)
    const companyRes = await client.query('SELECT lock_date FROM companies WHERE id = $1', [voucher.company_id]);
    if (companyRes.rows.length > 0 && companyRes.rows[0].lock_date) {
      const lockDate = new Date(companyRes.rows[0].lock_date);
      const voucherDate = new Date(voucher.voucher_date);
      if (voucherDate <= lockDate) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Không thể xóa! Chứng từ nằm trong giai đoạn đã khóa sổ kế toán.' });
      }
    }
    
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

export default router;