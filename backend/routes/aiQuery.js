/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiQuery.route - API endpoints cho Financial Copilot
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  askFinancialCopilot,
  getSuggestedQueries
} from '../services/aiCopilot.service.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';

const router = express.Router();

// Middleware xác thực
router.use(authenticate);

/**
 * POST /api/ai/query
 * Hỏi đáp tài chính bằng ngôn ngữ tự nhiên
 */
router.post('/query', asyncHandler(async (req, res) => {
  const { question } = req.body;
  const companyId = req.companyId || req.body.company_id;

  if (!question) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Thiếu câu hỏi', 400);
  }

  const result = await askFinancialCopilot(question, companyId);

  res.json({
    success: true,
    data: result
  });
}));

/**
 * GET /api/ai/suggested
 * Lấy câu hỏi gợi ý
 */
router.get('/suggested', asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.query.company_id;

  const queries = await getSuggestedQueries(companyId);

  res.json({
    success: true,
    data: queries
  });
}));

/**
 * GET /api/ai/insights
 * Lấy AI insights tổng hợp
 */
router.get('/insights', asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.query.company_id;

  // Tích hợp các insights từ các service
  const [
    { generateAIInsights } = await import('../services/aiJournal.service.js'),
    { predictCashflow } = await import('../services/aiCashflow.service.js'),
    { predictInventoryNeeds } = await import('../services/aiInventory.service.js')
  ] = await Promise.all([
    import('../services/aiJournal.service.js'),
    import('../services/aiCashflow.service.js'),
    import('../services/aiInventory.service.js')
  ]);

  const [journalInsights, cashflow, inventoryAlerts] = await Promise.all([
    generateAIInsights(companyId),
    predictCashflow(companyId),
    predictInventoryNeeds(companyId)
  ]);

  res.json({
    success: true,
    data: {
      journal: journalInsights,
      cashflow: {
        current: cashflow.current_cash,
        alerts: cashflow.alerts
      },
      inventory: {
        alerts: inventoryAlerts.alerts
      }
    }
  });
}));

export { router as aiQueryRouter };
export default router;