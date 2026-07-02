import express from 'express';
import { authenticate, requireRole, checkCompanyAccess } from '../middleware/auth.js';
import { createSalesInvoice } from '../controllers/sales.controller.js';

const router = express.Router();

/**
 * @route   POST /api/sales
 * @desc    Ghi nhận hóa đơn bán hàng, doanh thu và thuế GTGT đầu ra (Áp dụng TT 99)
 * @access  Private (Admin, Accountant)
 */
router.post(
  '/', 
  authenticate, 
  requireRole(['admin', 'ktt']), 
  checkCompanyAccess, 
  createSalesInvoice // <-- Logic đã được chuyển hoàn toàn sang Controller
);

export default router;

//