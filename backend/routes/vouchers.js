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
// 2. TẠO CHỨNG TỪ MỚI (Hỗ trợ định khoản đa dòng)
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

    const processedDetails = details.map(d => ({
      ...d,
      amount: Math.round(parseFloat(d.amount || 0))
    }));

    const drSum = processedDetails.filter(d => d.entryType === 'DR').reduce((sum, d) => sum + d.amount, 0);
    const crSum = processedDetails.filter(d => d.entryType === 'CR').reduce((sum, d) => sum + d.amount, 0);
    
    if (drSum !== crSum) {
      return res.status(400).json({ 
        error: `Hạch toán không cân đối! Tổng Nợ (${drSum.toLocaleString('vi-VN')}) phải bằng Tổng Có (${crSum.toLocaleString('vi-VN')})` 
      });
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
    
    processedDetails.forEach((item, index) => {
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
    
    res.json({ success: true, voucher: { ...newVoucher, details: detailRes.rows } });
  } catch (err) { 
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message }); 
  } finally {
    client.release();
  }
});

// ==========================================
// 3. TIẾN TRÌNH KHÓA SỔ TỰ ĐỘNG (Dồn tích - Netting)
// ==========================================
router.post('/closing', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  const { companyId, year } = req.body;
  const targetYear = year ? Number(year) : 2026;
  const closingDate = `${targetYear}-12-31`;

  if (req.user.role !== 'admin') {
    const hasAccess = await canAccessCompany(req.user, companyId);
    if (!hasAccess) return res.status(403).json({ error: 'Không có quyền thao tác doanh nghiệp này!' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Bước 3.1: Xóa chứng từ kết chuyển cũ của năm được chọn để tránh trùng lặp số liệu
    await client.query(`
      DELETE FROM vouchers 
      WHERE company_id = $1 AND voucher_type = 'Khac' AND EXTRACT(YEAR FROM voucher_date) = $2
    `, [companyId, targetYear]);

    // Bước 3.2: Quét tổng hợp số liệu thực tế từ chứng từ gốc (Trừ loại 'Khac')
    const sumQuery = `
      SELECT vd.account_code, vd.entry_type, SUM(vd.amount) as total
      FROM vouchers v
      JOIN voucher_details vd ON v.id = vd.voucher_id
      WHERE v.company_id = $1 AND EXTRACT(YEAR FROM v.voucher_date) = $2 AND v.voucher_type != 'Khac'
      GROUP BY vd.account_code, vd.entry_type
    `;
    const sumRes = await client.query(sumQuery, [companyId, targetYear]);

    // Khởi tạo các biến 2 vế để tính toán số Thuần (Net)
    let revCr = 0, revDr = 0; 
    let cogsDr = 0, cogsCr = 0; 
    let adminExpDr = 0, adminExpCr = 0;

    sumRes.rows.forEach(r => {
      const amt = Math.round(parseFloat(r.total) || 0);
      
      if (r.account_code.startsWith('511')) {
        if (r.entry_type === 'CR') revCr += amt;
        else revDr += amt; // Giảm trừ doanh thu
      }
      if (r.account_code.startsWith('632')) {
        if (r.entry_type === 'DR') cogsDr += amt;
        else cogsCr += amt; // Hoàn nhập / Giảm giá vốn
      }
      if (r.account_code.startsWith('642')) {
        if (r.entry_type === 'DR') adminExpDr += amt;
        else adminExpCr += amt; // Hoàn nhập / Giảm chi phí QLDN
      }
    });

    // Tính toán số thuần (Net Amount) để kết chuyển
    const rev = revCr - revDr; 
    const cogs = cogsDr - cogsCr; 
    const adminExp = adminExpDr - adminExpCr;

    // Chỉ dừng khi không có phát sinh thuần nào
    if (rev <= 0 && cogs <= 0 && adminExp <= 0) {
      await client.query('COMMIT');
      return res.json({ success: true, empty: true, message: 'Không có phát sinh doanh thu/chi phí thuần mới để kết chuyển.' });
    }

    // Helper tạo nhanh chứng từ tự động
    const makeClosingVoucher = async (desc, details) => {
      const v = await client.query(`
        INSERT INTO vouchers (company_id, voucher_date, description, voucher_type, created_by)
        VALUES ($1, $2, $3, 'Khac', $4) RETURNING id
      `, [companyId, closingDate, desc, req.user.id]);
      const vId = v.rows[0].id;

      for (const d of details) {
        await client.query(`
          INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount)
          VALUES ($1, $2, $3, $4)
        `, [vId, d.accountCode, d.entryType, d.amount]);
      }
    };

    // Bước 3.3: Thực hiện hạch toán kết chuyển dựa trên số Thuần
    if (rev > 0) await makeClosingVoucher('Kết chuyển doanh thu thuần cuối kỳ', [{ accountCode: '5111', entryType: 'DR', amount: rev }, { accountCode: '911', entryType: 'CR', amount: rev }]);
    if (cogs > 0) await makeClosingVoucher('Kết chuyển chi phí giá vốn hàng bán cuối kỳ', [{ accountCode: '911', entryType: 'DR', amount: cogs }, { accountCode: '632', entryType: 'CR', amount: cogs }]);
    if (adminExp > 0) await makeClosingVoucher('Kết chuyển chi phí quản lý doanh nghiệp cuối kỳ', [{ accountCode: '911', entryType: 'DR', amount: adminExp }, { accountCode: '642', entryType: 'CR', amount: adminExp }]);

    // Bước 3.4: Kết chuyển Thặng dư / Thâm hụt (Lãi lỗ ròng)
    const profitOrLoss = rev - (cogs + adminExp);
    if (profitOrLoss !== 0) {
      const isProfit = profitOrLoss > 0;
      await makeClosingVoucher(
        isProfit ? 'Kết chuyển thặng dư lợi nhuận kinh doanh (Lãi ròng)' : 'Kết chuyển thâm hụt kết quả kinh doanh (Lỗ ròng)',
        isProfit 
          ? [{ accountCode: '911', entryType: 'DR', amount: profitOrLoss }, { accountCode: '4212', entryType: 'CR', amount: profitOrLoss }]
          : [{ accountCode: '4212', entryType: 'DR', amount: Math.abs(profitOrLoss) }, { accountCode: '911', entryType: 'CR', amount: Math.abs(profitOrLoss) }]
      );
    }

    await client.query('COMMIT');
    await invalidateCache(`dashboard:cashflow:${companyId}:*`);
    res.json({ success: true, data: { rev, cogs, adminExp, profitOrLoss } });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 4. THIẾT LẬP SỐ DƯ ĐẦU KỲ ĐỒNG BỘ (ĐÃ TỐI ƯU)
// ==========================================
router.post('/opening', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  const { companyId, year, balances } = req.body; 
  const targetCompanyId = parseInt(companyId, 10); // Ép kiểu an toàn dữ liệu đầu vào
  const targetYear = year ? Number(year) : 2026;
  const openingDate = `${targetYear}-01-01`;

  if (!targetCompanyId) {
    return res.status(400).json({ error: 'Không xác định được ID doanh nghiệp để khởi tạo số dư!' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Xóa chứng từ số dư đầu kỳ cũ nếu tồn tại
    await client.query(`
      DELETE FROM vouchers 
      WHERE company_id = $1 AND voucher_type = 'DauKy' AND EXTRACT(YEAR FROM voucher_date) = $2
    `, [targetCompanyId, targetYear]);

    const details = [];
    
    // Quy chuẩn tiền tố tài khoản thuộc nhóm Tài Sản (Mặc định có số dư bên Nợ)
    const assetPrefixes = ['111', '112', '131', '152', '156', '211', '215'];

    Object.keys(balances).forEach(code => {
      const amount = Math.round(parseFloat(balances[code]) || 0);
      if (amount === 0) return; // Bỏ qua không lưu các tài khoản không có số dư

      // KIỂM TRA QUY CHUẨN NGHIỆP VỤ: 
      // Nếu mã tài khoản bắt đầu bằng 214 (Hao mòn) thì luôn ở bên Có (CR).
      // Nếu thuộc nhóm tài sản (assetPrefixes) thì ở bên Nợ (DR), ngược lại thuộc Nguồn vốn ở bên Có (CR).
      let entryType = 'CR';
      if (!code.startsWith('214') && assetPrefixes.some(prefix => code.startsWith(prefix))) {
        entryType = 'DR';
      }

      details.push({ accountCode: code, entryType, amount });
    });

    if (details.length > 0) {
      // Thêm thông tin người thực hiện (req.user.id) để làm audit log rõ ràng
      const v = await client.query(`
        INSERT INTO vouchers (company_id, voucher_date, description, voucher_type, created_by)
        VALUES ($1, $2, 'Nhập số dư tài khoản đầu kỳ theo Thông tư chuẩn', 'DauKy', $3) RETURNING id
      `, [targetCompanyId, openingDate, req.user.id]);
      const vId = v.rows[0].id;

      // Thực hiện ghi sổ chi tiết số dư tài khoản
      for (const d of details) {
        await client.query(`
          INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount)
          VALUES ($1, $2, $3, $4)
        `, [vId, d.accountCode, d.entryType, d.amount]);
      }
    }

    await client.query('COMMIT');
    // Khuyến nghị: Xóa cache liên quan nếu có dùng hệ thống Redis cho số dư đầu kỳ
    res.json({ success: true, message: 'Cập nhật số dư đầu kỳ thành công!' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 5. XÓA CHỨNG TỪ
// ==========================================
router.delete('/:id', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const voucherId = parseInt(req.params.id, 10);
    const voucherCheck = await pool.query('SELECT company_id FROM vouchers WHERE id = $1', [voucherId]);
    
    if (voucherCheck.rowCount === 0) return res.status(404).json({ error: 'Không tìm thấy chứng từ!' });

    const targetCompanyId = voucherCheck.rows[0].company_id;
    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Không có quyền thao tác!' });
    }
    
    await pool.query('DELETE FROM vouchers WHERE id = $1', [voucherId]);
    await invalidateCache(`dashboard:cashflow:${targetCompanyId}:*`);
    res.json({ success: true, message: 'Xóa chứng từ thành công!' });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

export { router as vouchersRouter };