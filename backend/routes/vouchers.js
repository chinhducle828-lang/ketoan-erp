import express from 'express';
import { pool } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate, createVoucherSchema } from '../middleware/validation.js';
import { canAccessCompany } from '../services/helpers.js';
import { invalidateCache } from '../cache/redis.js';

const router = express.Router();

// ==========================================
// 1. LẤY DANH SÁCH CHỨNG TỪ 
// ==========================================
router.get('/', authenticate, async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id; 
    const year = req.query.year ? Number(req.query.year) : 2026;

    if (!targetCompanyId) return res.json([]);

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Bạn không có quyền truy cập dữ liệu của doanh nghiệp này!' });
      }
    }

    const queryStr = `
      SELECT 
        v.id, 
        v.company_id as "companyId", 
        v.voucher_date as "voucherDate", 
        v.description, 
        v.voucher_type as "type",
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', vd.id,
              'accountCode', vd.account_code,
              'entryType', vd.entry_type,
              'amount', vd.amount
            ) ORDER BY vd.entry_type DESC
          ) FILTER (WHERE vd.id IS NOT NULL), '[]'
        ) AS details
      FROM vouchers v
      LEFT JOIN voucher_details vd ON v.id = vd.voucher_id
      WHERE v.company_id = $1 AND EXTRACT(YEAR FROM v.voucher_date) = $2
      GROUP BY v.id, v.company_id, v.voucher_date, v.description, v.voucher_type
      ORDER BY v.voucher_date DESC, v.id DESC
    `;

    const result = await pool.query(queryStr, [targetCompanyId, year]);
    res.json(result.rows);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// ==========================================
// 2. TẠO CHỨNG TỪ MỚI
// ==========================================
router.post('/', authenticate, validate(createVoucherSchema), async (req, res) => {
  const client = await pool.connect();
  try {
    const { voucherDate, description, type, companyId, details } = req.body;
    const targetCompanyId = companyId;
    
    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Bạn không có quyền ghi sổ tại doanh nghiệp này!' });
      }
    }

    const drSum = details.filter(d => d.entryType === 'DR').reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
    const crSum = details.filter(d => d.entryType === 'CR').reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
    
    if (Math.abs(drSum - crSum) > 0.5) {
      return res.status(400).json({ error: `Hạch toán không cân! Tổng Nợ (${drSum.toLocaleString()}) phải bằng Tổng Có (${crSum.toLocaleString()})` });
    }

    await client.query('BEGIN');

    const masterQuery = `
      INSERT INTO vouchers (company_id, voucher_date, description, voucher_type, created_by) 
      VALUES ($1, $2, $3, $4, $5) 
      RETURNING id, company_id as "companyId", voucher_date as "voucherDate", description, voucher_type as "type"
    `;
    const masterRes = await client.query(masterQuery, [targetCompanyId, voucherDate, description, type, req.user.id]);
    const newVoucher = masterRes.rows[0];

    const valuesArr = [];
    const queryArgs = [];
    
    details.forEach((item, index) => {
      const offset = index * 4;
      valuesArr.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
      queryArgs.push(newVoucher.id, item.accountCode, item.entryType, item.amount);
    });

    const bulkDetailQuery = `
      INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
      VALUES ${valuesArr.join(', ')} 
      RETURNING id, account_code as "accountCode", entry_type as "entryType", amount
    `;
    
    const detailRes = await client.query(bulkDetailQuery, queryArgs);

    await client.query('COMMIT');

    await invalidateCache(`dashboard:cashflow:${targetCompanyId}:*`);
    
    // ĐÃ SỬA: Đóng gói Response vào object success: true và voucher để Context đọc được
    res.json({ 
      success: true, 
      voucher: { ...newVoucher, details: detailRes.rows } 
    });

  } catch (err) { 
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message }); 
  } finally {
    client.release();
  }
});

// ==========================================
// 3. XÓA CHỨNG TỪ
// ==========================================
router.delete('/:id', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const voucherId = parseInt(req.params.id, 10);

    // ĐÃ SỬA: Tự động tìm company_id của chứng từ này trong CSDL trước để kiểm tra quyền
    const voucherCheck = await pool.query('SELECT company_id FROM vouchers WHERE id = $1', [voucherId]);
    
    if (voucherCheck.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy chứng từ!' });
    }

    const targetCompanyId = voucherCheck.rows[0].company_id;

    const hasAccess = await canAccessCompany(req.user, targetCompanyId);
    if (!hasAccess && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Bạn không có quyền thao tác trên dữ liệu doanh nghiệp này!' });
    }
    
    const deleteResult = await pool.query('DELETE FROM vouchers WHERE id = $1', [voucherId]);
    
    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ error: 'Xóa thất bại!' });
    }
    
    await invalidateCache(`dashboard:cashflow:${targetCompanyId}:*`);
    res.json({ success: true, message: 'Xóa chứng từ thành công!' });

  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

export { router as vouchersRouter };