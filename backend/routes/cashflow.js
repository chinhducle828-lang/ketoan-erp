/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import express from 'express';
import { authenticate, checkCompanyAccess } from '../middleware/auth.js';
import { getCashFlowData } from '../services/cashFlowEngine.js';

const router = express.Router();

/**
 * GET /api/cashflow?company_id=...&year=...&method=direct|indirect
 * Trả về báo cáo lưu chuyển tiền tệ chuẩn B03-DN tính từ dữ liệu voucher thực tế
 * dựa trên các tài khoản tiền (111, 112) và các tài khoản đối ứng.
 */
router.get('/', authenticate, checkCompanyAccess, async (req, res) => {
  try {
    const targetCompanyId = req.companyId;

    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const method = req.query.method === 'direct' ? 'direct' : 'indirect';

    const data = await getCashFlowData(targetCompanyId, year, method);
    res.json({ success: true, method, year, companyId: targetCompanyId, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { router as cashflowRouter };