import express from 'express';
import { pool } from '../server.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { canAccessCompany } from '../services/helpers.js';
import { invalidateCache } from '../cache/redis.js';

const router = express.Router();

// 1. Lấy danh sách chứng từ (Gộp dữ liệu từ Master và Detail)
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

    // Câu lệnh SQL nâng cao: Lấy chứng từ gộp mảng các dòng chi tiết bằng JSON_AGG
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
            )
          ) FILTER (WHERE vd.id IS NOT NULL), '[]'
        ) AS details
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

// 2. Tạo chứng từ mới (Hỗ trợ cấu trúc đa dòng Nợ/Có)
router.post('/', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    // Frontend giờ đây sẽ gửi lên mảng 'details' thay vì accountDr, accountCr phẳng
    // Định dạng details: [{ accountCode: '1111', entryType: 'DR', amount: 1000 }, ...]
    const { voucherDate, description, type, companyId, details } = req.body;
    const targetCompanyId = companyId;
    
    if (!targetCompanyId) return res.status(400).json({ error: 'Vui lòng xác định rõ doanh nghiệp cần ghi sổ!' });
    if (!details || !Array.isArray(details) || details.length < 2) {
      return res.status(400).json({ error: 'Chứng từ phải có ít nhất 2 dòng hạch toán đối ứng!' });
    }

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Bạn không có quyền ghi sổ tại doanh nghiệp này!' });
      }
    }

    // Kiểm tra ràng buộc kế toán cân bằng (Tổng Nợ = Tổng Có)
    const drSum = details.filter(d => d.entryType === 'DR').reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
    const crSum = details.filter(d => d.entryType === 'CR').reduce((sum, d) => sum + parseFloat(d.amount || 0), 0);
    
    if (drSum !== crSum) {
      return res.status(400).json({ error: `Hạch toán không cân! Tổng Nợ (${drSum}) phải bằng Tổng Có (${crSum})` });
    }

    // Bắt đầu Transaction ghi nhận đa dòng liên đới
    await client.query('BEGIN');

    // Bước 2a: Ghi vào bảng MASTER (vouchers)
    const masterQuery = `
      INSERT INTO vouchers (company_id, voucher_date, description, voucher_type, created_by) 
      VALUES ($1, $2, $3, $4, $5) RETURNING id, company_id as "companyId", voucher_date as "voucherDate", description, voucher_type as "type"
    `;
    const masterRes = await client.query(masterQuery, [targetCompanyId, voucherDate, description, type, req.user.id]);
    const newVoucher = masterRes.rows[0];

    // Bước 2b: Vòng lặp ghi vào bảng DETAIL (voucher_details)
    const detailQuery = `
      INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
      VALUES ($1, $2, $3, $4) RETURNING id, account_code as "accountCode", entry_type as "entryType", amount
    `;
    
    const savedDetails = [];
    for (const item of details) {
      const detailRes = await client.query(detailQuery, [newVoucher.id, item.accountCode, item.entryType, item.amount]);
      savedDetails.push(detailRes.rows[0]);
    }

    await client.query('COMMIT');

    // Giải phóng bộ nhớ tạm Redis
    await invalidateCache(`dashboard:cashflow:${targetCompanyId}:*`);
    
    // Trả ra cấu trúc dữ liệu đầy đủ cho Frontend hiển thị
    res.json({ ...newVoucher, details: savedDetails });
  } catch (err) { 
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message }); 
  } finally {
    client.release();
  }
});

// 3. Xóa chứng từ (Cơ chế ON DELETE CASCADE tự động dọn sạch voucher_details)
router.delete('/:id', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id;
    if (!targetCompanyId) return res.status(400).json({ error: 'Thiếu mã đơn vị cần xóa dữ liệu!' });

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Bạn không có quyền thao tác trên dữ liệu doanh nghiệp này!' });
      }
      await pool.query('DELETE FROM vouchers WHERE id = $1 AND company_id = $2', [req.params.id, targetCompanyId]);
    } else {
      await pool.query('DELETE FROM vouchers WHERE id = $1', [req.params.id]);
    }
    
    // Invalidate dashboard cache
    await invalidateCache(`dashboard:cashflow:${targetCompanyId}:*`);
    
    res.json({ success: true, message: 'Xóa chứng từ thành công!' });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

export { router as vouchersRouter };