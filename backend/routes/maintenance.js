/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import express from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { rebuildLedger, validateMonthlyBalances } from '../services/maintenance.service.js';

const router = express.Router();

/**
 * POST /api/maintenance/rebuild-ledger/:companyId
 * 
 * Tái lập sổ cái (monthly_balances) với số dư đầu kỳ
 * 
 * Body:
 *   - fiscalYear (number, required): Năm tài chính cần rebuild
 *   - startMonth (number, optional): Tháng bắt đầu rebuild (1-12). Mặc định = 1
 * 
 * Ví dụ:
 *   POST /api/maintenance/rebuild-ledger/1
 *   { "fiscalYear": 2026, "startMonth": 3 }
 *   => Rebuild từ tháng 3 → 12 cho công ty 1, năm 2026
 */
router.post('/rebuild-ledger/:companyId', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { companyId } = req.params;
    const { fiscalYear, startMonth } = req.body;

    if (!fiscalYear) {
      return res.status(400).json({ error: 'Yêu cầu tham số fiscalYear (năm tài chính)' });
    }

    const result = await rebuildLedger(
      Number(companyId),
      Number(fiscalYear),
      startMonth ? Number(startMonth) : null
    );

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/maintenance/validate/:companyId/:year
 * 
 * Kiểm tra tính toàn vẹn dữ liệu monthly_balances
 * 
 * Ví dụ:
 *   GET /api/maintenance/validate/1/2026
 *   => Kiểm tra monthly_balances cho công ty 1, năm 2026
 */
router.get('/validate/:companyId/:year', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { companyId, year } = req.params;

    const result = await validateMonthlyBalances(Number(companyId), Number(year));

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;