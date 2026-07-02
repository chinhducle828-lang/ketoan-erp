import express from 'express';
import { authenticate, requireRole, checkCompanyAccess } from '../middleware/auth.js';
import { getVATReports, performTaxDeduction } from '../controllers/tax.controller.js';

const router = express.Router();

/**
 * @route   GET /api/tax/reports
 * @desc    Lập bảng kê hóa đơn thuế GTGT đầu vào và đầu ra trong kỳ phục vụ tờ khai thuế
 * @access  Private (Admin, Accountant)
 */
router.get(
  '/reports',
  authenticate,
  checkCompanyAccess,
  getVATReports
);

/**
 * @route   POST /api/tax/deduction
 * @desc    Hạch toán bút toán kết chuyển khấu trừ thuế GTGT tự động cuối kỳ (Ghi Nợ 33311 / Có 133)
 * @access  Private (Admin, Accountant)
 */
router.post(
  '/deduction',
  authenticate,
  requireRole(['admin', 'accountant']),
  checkCompanyAccess,
  performTaxDeduction
);

export default router;