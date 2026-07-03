import express from 'express';
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

export { router as reportRouter };