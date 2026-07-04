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
import { getCashFlowData } from '../services/cashFlowEngine.js';
import { getFinancialNotesData } from '../services/financialNotesEngine.js';
import { previewClosing, executeClosing as executeClosingWorkflow, getClosingPreviewData, getWorkflowConfig } from '../controllers/closing.controller.js';

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

// API: Báo cáo lưu chuyển tiền tệ B03-DN
router.get('/cash-flow', authenticate, checkCompanyAccess, async (req, res) => {
  try {
    const companyId = req.companyId;
    const year = req.query.year ? Number(req.query.year) : null;
    const method = req.query.method || 'indirect'; // direct hoặc indirect
    
    const cashFlowData = await getCashFlowData(companyId, year, method);
    
    res.json({
      success: true,
      data: cashFlowData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Bản thuyết minh BCTC B09-DN
router.get('/financial-notes', authenticate, checkCompanyAccess, async (req, res) => {
  try {
    const companyId = req.companyId;
    const year = req.query.year ? Number(req.query.year) : null;
    
    const financialNotes = await getFinancialNotesData(companyId, year);
    
    res.json({
      success: true,
      data: financialNotes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Xuất file Excel B03-DN
router.get('/export/cash-flow-excel', authenticate, checkCompanyAccess, async (req, res) => {
  try {
    const companyId = req.companyId;
    const year = req.query.year ? Number(req.query.year) : null;
    const method = req.query.method || 'indirect';
    
    const cashFlowData = await getCashFlowData(companyId, year, method);
    
    // Tạo file Excel đơn giản
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('B03-DN');
    
    ws.columns = [
      { header: 'Chỉ tiêu', key: 'item', width: 40 },
      { header: 'Số tiền (VND)', key: 'amount', width: 20 }
    ];
    
    // Thêm dữ liệu dòng tiền
    if (method === 'direct') {
      ws.addRow({ item: 'I. HOẠT ĐỘNG SẢN XUẤT KINH DOANH', amount: '' });
      ws.addRow({ item: 'Tiền thu từ bán hàng', amount: cashFlowData.operatingActivities?.cashReceivedFromCustomers || 0 });
      ws.addRow({ item: 'Tiền chi trả cho người bán', amount: cashFlowData.operatingActivities?.cashPaidToSuppliers || 0 });
      ws.addRow({ item: 'Tiền chi trả cho nhân viên', amount: cashFlowData.operatingActivities?.cashPaidToEmployees || 0 });
    } else {
      ws.addRow({ item: 'BÁO CÁO LƯU CHUYỂN TIỀN TỆ (B03-DN) - PHƯƠNG PHÁP GIÁN TIẾP', amount: '' });
      ws.addRow({ item: 'Lợi nhuận trước thuế', amount: cashFlowData.profitBeforeTax || 0 });
      ws.addRow({ item: 'Điều chỉnh:', amount: '' });
      ws.addRow({ item: '- Khấu hao TSCĐ', amount: cashFlowData.adjustments?.depreciation || 0 });
      ws.addRow({ item: '- Dự phòng', amount: cashFlowData.adjustments?.provisions || 0 });
      ws.addRow({ item: 'Biến động vốn lưu động:', amount: '' });
      ws.addRow({ item: '- Phải thu KH', amount: cashFlowData.adjustments?.workingCapitalChanges?.accountsReceivable || 0 });
      ws.addRow({ item: '- Hàng tồn kho', amount: cashFlowData.adjustments?.workingCapitalChanges?.inventory || 0 });
      ws.addRow({ item: '- Phải trả NCC', amount: cashFlowData.adjustments?.workingCapitalChanges?.accountsPayable || 0 });
    }
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=B03-DN_${companyId}_${year || 'all'}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Xem trước bút toán kết chuyển
router.post('/closing/preview', authenticate, checkCompanyAccess, previewClosing);

// API: Thực thi kết chuyển sổ (workflow)
router.post('/closing/execute', authenticate, checkCompanyAccess, executeClosingWorkflow);

// API: Lấy dữ liệu kết chuyển để xem trước
router.get('/closing/data', authenticate, checkCompanyAccess, getClosingPreviewData);

// API: Lấy cấu hình workflow kết chuyển
router.get('/closing/workflow', authenticate, checkCompanyAccess, getWorkflowConfig);

export { router as reportRouter };