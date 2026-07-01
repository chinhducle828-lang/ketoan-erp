import express from 'express';
import { pool } from '../server.js';
// Thêm checkCompanyAccess vào danh sách import
import { authenticate, requireRole, checkCompanyAccess } from '../middleware/auth.js';
import { invalidateCache } from '../cache/redis.js';

const router = express.Router();

// 1. Lấy số dư đầu kỳ (Đã bọc checkCompanyAccess bảo mật)
router.get('/', authenticate, checkCompanyAccess, async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id;
    const year = req.query.year ? Number(req.query.year) : 2026;

    // (Đoạn check quyền canAccessCompany cũ đã được middleware checkCompanyAccess xử lý triệt để ở ngoài)

    const queryStr = `
      SELECT 
        id,
        company_id as "companyId",
        account_code as "accountCode",
        debit_balance as "debitBalance",
        credit_balance as "creditBalance",
        fiscal_year as "fiscalYear"
      FROM opening_balances 
      WHERE company_id = $1 AND fiscal_year = $2 
      ORDER BY account_code ASC
    `;

    const result = await pool.query(queryStr, [targetCompanyId, year]);
    res.json(result.rows);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// 2. Cập nhật số dư đầu kỳ (Đồng bộ role 'accountant' và bọc bảo mật RLS)
router.post('/', authenticate, requireRole(['admin', 'accountant']), checkCompanyAccess, async (req, res) => {
  try {
    const { balances, year, companyId } = req.body;
    const targetCompanyId = companyId;
    const finalYear = year ? Number(year) : 2026;

    if (!balances || Object.keys(balances).length === 0) {
      return res.status(400).json({ error: 'Dữ liệu số dư trống!' });
    }

    // (Đoạn check quyền cũ được lược bỏ nhờ middleware xếp hàng phía trên)

    const entries = Object.entries(balances);
    const valueExpressions = [];
    const queryArgs = [targetCompanyId, finalYear];

    // Chuyển mảng Object thành cấu trúc Bulk Parameterized Query
    entries.forEach(([code, val], index) => {
      const offset = index * 3 + 3; // $1 và $2 đã dành cho company_id và finalYear
      valueExpressions.push(`($1, $${offset}, $${offset + 1}, $${offset + 2}, $2)`);
      queryArgs.push(code, parseFloat(val.dr || 0), parseFloat(val.cr || 0));
    });

    const bulkQueryStr = `
      INSERT INTO opening_balances (company_id, account_code, debit_balance, credit_balance, fiscal_year)
      VALUES ${valueExpressions.join(', ')}
      ON CONFLICT (company_id, account_code, fiscal_year)
      DO UPDATE SET 
        debit_balance = EXCLUDED.debit_balance, 
        credit_balance = EXCLUDED.credit_balance
    `;

    await pool.query(bulkQueryStr, queryArgs);
    
    // Xóa bộ nhớ đệm Cache dòng tiền của Dashboard cũ
    await invalidateCache(`dashboard:cashflow:${targetCompanyId}:*`);
    
    res.json({ success: true, message: `Cập nhật số dư đầu kỳ cho năm ${finalYear} thành công!` });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// 3. Kiểm tra trạng thái số dư đầu kỳ
router.get('/status', authenticate, checkCompanyAccess, async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id;

    const result = await pool.query(
      'SELECT COUNT(*)::int as count FROM opening_balances WHERE company_id = $1 AND (debit_balance > 0 OR credit_balance > 0)',
      [targetCompanyId]
    );

    const hasBalance = result.rows[0].count > 0;
    res.json({ 
      hasOpeningBalance: hasBalance,
      message: hasBalance 
        ? 'Đã nhập số dư đầu kỳ' 
        : 'Chưa nhập số dư đầu kỳ. Vui lòng vào phân hệ "Khai báo số dư đầu kỳ" để nhập trước khi thực hiện nghiệp vụ khác.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { router as openingBalancesRouter };