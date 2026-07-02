import express from 'express';
import { pool } from '../config/db.js';
import { authenticate, requireRole, checkCompanyAccess } from '../middleware/auth.js';
import { invalidateCache } from '../cache/redis.js';

const router = express.Router();

// Danh sách các tài khoản bị bãi bỏ theo Thông tư 99/2025/TT-BTC
const BANNED_ACCOUNTS_TT99 = ['1562', '611', '621', '622', '627']; // Bổ sung thêm tùy đặc thù doanh nghiệp

// 1. Lấy số dư đầu kỳ (Lấy thêm thông tin ngoại tệ TT 99)
router.get('/', authenticate, checkCompanyAccess, async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id;
    const year = req.query.year ? Number(req.query.year) : 2026;

    const queryStr = `
      SELECT 
        id, company_id as "companyId", account_code as "accountCode",
        debit_balance as "debitBalance", credit_balance as "creditBalance",
        currency, exchange_rate as "exchangeRate", -- TT99: Bổ sung đa tiền tệ
        fiscal_year as "fiscalYear", is_locked as "isLocked"
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

// 2. Cập nhật số dư đầu kỳ (Ràng buộc TT 99 & Khóa sổ)
router.post('/', authenticate, requireRole(['admin', 'accountant']), checkCompanyAccess, async (req, res) => {
  try {
    // Nhận thêm tiền tệ và tỷ giá từ Frontend gửi lên
    const { balances, year, companyId, currency = 'VND', exchangeRate = 1 } = req.body;
    const targetCompanyId = companyId;
    const finalYear = year ? Number(year) : 2026;

    if (!balances || Object.keys(balances).length === 0) {
      return res.status(400).json({ error: 'Dữ liệu số dư trống!' });
    }

    // 🔒 CHỐT CHẶN 1: Kiểm tra khóa sổ
    const lockCheck = await pool.query(
      'SELECT is_locked FROM opening_balances WHERE company_id = $1 AND fiscal_year = $2 AND is_locked = true LIMIT 1',
      [targetCompanyId, finalYear]
    );

    if (lockCheck.rows.length > 0) {
      return res.status(403).json({ error: `Năm tài chính ${finalYear} đã bị KHÓA SỔ!` });
    }

    const entries = Object.entries(balances);
    const valueExpressions = [];
    const queryArgs = [targetCompanyId, finalYear, currency, exchangeRate]; // Thêm currency & rate vào args cố định
    
    let totalDebit = 0;
    let totalCredit = 0;
    let paramIndex = 5; // Bắt đầu từ $5 do $1-$4 là biến dùng chung

    for (const [code, val] of entries) {
      // ⚖️ CHỐT CHẶN 2: Chặn tài khoản cũ theo TT 99
      if (BANNED_ACCOUNTS_TT99.includes(code.substring(0, 4)) || BANNED_ACCOUNTS_TT99.includes(code.substring(0, 3))) {
        return res.status(400).json({ 
          error: `Tài khoản ${code} đã bị bãi bỏ theo Thông tư 99/2025/TT-BTC.` 
        });
      }

      const dr = parseFloat(val.dr || 0);
      const cr = parseFloat(val.cr || 0);
      
      totalDebit += Math.round(dr * exchangeRate);
      totalCredit += Math.round(cr * exchangeRate);

      valueExpressions.push(`($1, $${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $2, false, $3, $4)`); 
      queryArgs.push(code, dr, cr);
      paramIndex += 3;
    }

    // ⚖️ CHỐT CHẶN 3: Đảm bảo cân bằng Nợ - Có (Quy tắc bất di bất dịch)
    if (totalDebit !== totalCredit) {
      return res.status(400).json({ error: 'Tổng dư Nợ và dư Có không cân bằng!' });
    }

    // Cập nhật câu lệnh Bulk Query có thêm currency và exchange_rate
    const bulkQueryStr = `
      INSERT INTO opening_balances (company_id, account_code, debit_balance, credit_balance, fiscal_year, is_locked, currency, exchange_rate)
      VALUES ${valueExpressions.join(', ')}
      ON CONFLICT (company_id, account_code, fiscal_year)
      DO UPDATE SET 
        debit_balance = EXCLUDED.debit_balance, 
        credit_balance = EXCLUDED.credit_balance,
        currency = EXCLUDED.currency,
        exchange_rate = EXCLUDED.exchange_rate
    `;

    await pool.query(bulkQueryStr, queryArgs);
    await invalidateCache(`dashboard:cashflow:${targetCompanyId}:*`);
    
    res.json({ success: true, message: `Cập nhật số dư đầu kỳ năm ${finalYear} thành công!` });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// 3. Khóa/Mở khóa sổ (Giữ nguyên logic cực tốt của bạn)
router.patch('/toggle-lock', authenticate, requireRole(['admin', 'accountant']), checkCompanyAccess, async (req, res) => {
  // ... (Giữ nguyên đoạn code của bạn)
  try {
    const { companyId, year, lockStatus } = req.body;
    const finalYear = year ? Number(year) : 2026;

    if (lockStatus === undefined) {
      return res.status(400).json({ error: 'Thiếu trạng thái thay đổi khóa (lockStatus)!' });
    }

    const updateLockStr = `
      UPDATE opening_balances 
      SET is_locked = $1 
      WHERE company_id = $2 AND fiscal_year = $3
    `;
    
    await pool.query(updateLockStr, [lockStatus, companyId, finalYear]);

    res.json({ 
      success: true, 
      message: lockStatus ? `Đã khóa sổ số dư đầu kỳ năm ${finalYear}!` : `Đã mở khóa sổ số dư đầu kỳ năm ${finalYear}!` 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Kiểm tra trạng thái (Giữ nguyên)
router.get('/status', authenticate, checkCompanyAccess, async (req, res) => {
  // ... (Giữ nguyên đoạn code của bạn)
  try {
    const targetCompanyId = req.query.company_id;
    const result = await pool.query(
      'SELECT COUNT(*)::int as count FROM opening_balances WHERE company_id = $1 AND (debit_balance > 0 OR credit_balance > 0)',
      [targetCompanyId]
    );

    const hasBalance = result.rows[0].count > 0;
    res.json({ 
      hasOpeningBalance: hasBalance,
      message: hasBalance ? 'Đã nhập số dư đầu kỳ' : 'Chưa nhập số dư đầu kỳ.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Đổi cách Export cho đồng bộ với file index.js mới
export default router;