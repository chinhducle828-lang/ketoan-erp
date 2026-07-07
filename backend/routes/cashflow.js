import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { canAccessCompany } from '../services/helpers.js';
import { getCashFlowData } from '../services/cashFlowEngine.js';

const router = express.Router();

/**
 * GET /api/cashflow?company_id=...&year=...&method=direct|indirect
 * Trả về báo cáo lưu chuyển tiền tệ chuẩn B03-DN tính từ dữ liệu voucher thực tế
 * dựa trên các tài khoản tiền (111, 112) và các tài khoản đối ứng.
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id;
    if (!targetCompanyId) {
      return res.status(400).json({ error: 'Thiếu tham số company_id' });
    }

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Từ chối quyền truy xuất báo cáo dòng tiền!' });
      }
    }

    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const method = req.query.method === 'direct' ? 'direct' : 'indirect';

    const data = await getCashFlowData(Number(targetCompanyId), year, method);
    res.json({ success: true, method, year, companyId: Number(targetCompanyId), data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { router as cashflowRouter };