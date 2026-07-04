import express from 'express';
import { pool } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { canAccessCompany } from '../services/helpers.js';
import { 
  getBalanceSheet, 
  getCustomerBalances, 
  getAdvanceCustomerBalances,
  getSupplierBalances,
  getTaxBalances,
  executeClosing,
  invalidateReportCache
} from '../controllers/report.controller.js';
import { getCycleData } from '../services/cycle.service.js';
import { getBalanceSheetData } from '../services/report.service.js';
import { calculateBalances, getTotalDebit, getTotalCredit } from '../utils/accountingEngine.js';

const router = express.Router();

/**
 * Middleware kiểm tra quyền truy cập công ty
 */
async function checkCompanyAccess(req, res, next) {
  const companyId = req.companyId || req.query.company_id || req.query.companyId || req.body.companyId || req.body.company_id;
  
  if (!companyId) {
    return res.status(400).json({ error: 'Thiếu tham số bắt buộc companyId!' });
  }
  
  if (req.user.role !== 'admin') {
    const hasAccess = await canAccessCompany(req.user, companyId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Không có quyền truy cập!' });
    }
  }
  
  req.companyId = companyId;
  next();
}

// API: Lấy bảng cân đối kế toán
router.get('/balance-sheet', authenticate, checkCompanyAccess, getBalanceSheet);

// API: Lấy số dư công nợ khách hàng (TK 131)
router.get('/customer-balances', authenticate, checkCompanyAccess, getCustomerBalances);

// API: Lấy số dư người mua trả tiền trước (TK 312)
router.get('/advance-balances', authenticate, checkCompanyAccess, getAdvanceCustomerBalances);

// API: Lấy số dư phải trả người bán (TK 331)
router.get('/supplier-balances', authenticate, checkCompanyAccess, getSupplierBalances);

// API: Lấy số dư thuế
router.get('/tax-balances', authenticate, checkCompanyAccess, getTaxBalances);

// API: Thực hiện kết chuyển sổ
router.post('/closing', authenticate, checkCompanyAccess, executeClosing);

// API: Xóa cache báo cáo
router.post('/invalidate-cache', authenticate, checkCompanyAccess, (req, res) => {
  const companyId = req.companyId;
  invalidateReportCache(companyId);
  res.json({ success: true, message: 'Đã xóa cache báo cáo!' });
});

// API: Lấy dữ liệu 9 chu trình nghiệp vụ
router.get('/cycle-data', authenticate, checkCompanyAccess, async (req, res) => {
  try {
    const companyId = req.companyId;
    const year = req.query.year ? Number(req.query.year) : null;
    
    const cycleData = await getCycleData(companyId, year);
    
    res.json({
      success: true,
      data: cycleData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Báo cáo tài chính B01-DN (Bảng cân đối kế toán)
router.get('/b01', authenticate, checkCompanyAccess, async (req, res) => {
  try {
    const companyId = req.companyId;
    const year = req.query.year ? Number(req.query.year) : null;
    
    const balanceSheet = await getBalanceSheetData(companyId, null, year);
    
    res.json({
      success: true,
      data: balanceSheet
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Báo cáo kết quả kinh doanh B02-DN
router.get('/b02', authenticate, checkCompanyAccess, async (req, res) => {
  try {
    const companyId = req.companyId;
    const year = req.query.year ? Number(req.query.year) : null;
    
    // Lấy dữ liệu tài khoản để tính báo cáo kết quả kinh doanh
    const vouchersRes = await pool.query(`
      SELECT v.id, v.voucher_date, v.voucher_type, v.description,
             vd.account_code, vd.entry_type, vd.amount
      FROM vouchers v
      JOIN voucher_details vd ON v.id = vd.voucher_id
      WHERE v.company_id = $1
      ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $2` : ''}
    `, year ? [companyId, year] : [companyId]);
    
    const ledger = calculateBalances(vouchersRes.rows, []);
    
    // Tính toán các chỉ tiêu
    const incomeStatement = {
      revenue: (getTotalCredit(ledger, '511') || 0) + (getTotalCredit(ledger, '515') || 0),
      cogs: getTotalDebit(ledger, '632') || 0,
      grossProfit: (getTotalCredit(ledger, '511') || 0) + (getTotalCredit(ledger, '515') || 0) - (getTotalDebit(ledger, '632') || 0),
      operatingExpenses: {
        '635': getTotalDebit(ledger, '635') || 0,
        '641': getTotalDebit(ledger, '641') || 0,
        '642': getTotalDebit(ledger, '642') || 0
      },
      totalOperatingExpenses: (getTotalDebit(ledger, '635') || 0) + (getTotalDebit(ledger, '641') || 0) + (getTotalDebit(ledger, '642') || 0),
      operatingProfit: (getTotalCredit(ledger, '511') || 0) + (getTotalCredit(ledger, '515') || 0) - (getTotalDebit(ledger, '632') || 0) - (getTotalDebit(ledger, '635') || 0) - (getTotalDebit(ledger, '641') || 0) - (getTotalDebit(ledger, '642') || 0),
      otherIncome: getTotalCredit(ledger, '711') || 0,
      otherExpenses: getTotalDebit(ledger, '811') || 0,
      profitBeforeTax: (getTotalCredit(ledger, '511') || 0) + (getTotalCredit(ledger, '515') || 0) - (getTotalDebit(ledger, '632') || 0) - (getTotalDebit(ledger, '635') || 0) - (getTotalDebit(ledger, '641') || 0) - (getTotalDebit(ledger, '642') || 0) + (getTotalCredit(ledger, '711') || 0) - (getTotalDebit(ledger, '811') || 0),
      taxExpense: getTotalDebit(ledger, '821') || 0,
      netProfit: (getTotalCredit(ledger, '511') || 0) + (getTotalCredit(ledger, '515') || 0) - (getTotalDebit(ledger, '632') || 0) - (getTotalDebit(ledger, '635') || 0) - (getTotalDebit(ledger, '641') || 0) - (getTotalDebit(ledger, '642') || 0) + (getTotalCredit(ledger, '711') || 0) - (getTotalDebit(ledger, '811') || 0) - (getTotalDebit(ledger, '821') || 0)
    };
    
    res.json({
      success: true,
      data: incomeStatement
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Báo cáo quản trị
router.get('/management', authenticate, checkCompanyAccess, async (req, res) => {
  try {
    const companyId = req.companyId;
    const year = req.query.year ? Number(req.query.year) : null;
    
    // Lấy dữ liệu tổng hợp từ 9 chu trình nghiệp vụ
    const cycleData = await getCycleData(companyId, year);
    
    // Lấy dữ liệu bảng cân đối
    const balanceSheet = await getBalanceSheetData(companyId, null, year);
    
    res.json({
      success: true,
      data: {
        cycleData,
        balanceSheet,
        reportDate: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export { router as reportRouter };
