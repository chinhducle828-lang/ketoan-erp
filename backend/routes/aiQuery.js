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
  getSuggestedQueries,
  solveMathProblem,
  analyzeWorkflow,
  saveQueryToKnowledgeBase
} from '../services/aiCopilot.service.js';
import { executeWorkflow, getProactiveInsights, analyzeCrossModule } from '../services/aiOrchestrator.service.js';
import { processDocument, saveOCRResult, getPendingOCRInvoices, approveOCRResult, rejectOCRResult } from '../services/aiOcr.service.js';
import { classifyDepartment, getAllDepartments, getDepartmentById, createDepartment, updateDepartment, deleteDepartment } from '../services/aiDepartmentClassifier.service.js';
import { getSuggestions, getAllSuggestionRules, getSuggestionRuleById, createSuggestionRule, updateSuggestionRule, deleteSuggestionRule, getSuggestionStats } from '../services/aiSmartSuggestions.service.js';
import { processBatch, getAllBatchConfigs, getBatchConfigById, createBatchConfig, updateBatchConfig, deleteBatchConfig, getBatchStatus, getBatchHistory } from '../services/aiBatchProcessor.service.js';
import { executeWorkflow as executeDataDrivenWorkflow, getAllWorkflows, getWorkflowByCode, createWorkflow, updateWorkflow, deleteWorkflow } from '../services/aiWorkflowEngine.service.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import { AI_CONFIG } from '../config/aiConfig.js';
import { isGeminiAvailable } from '../services/geminiClient.js';

const router = express.Router();
const PYTHON_AI_SERVICE_URL = AI_CONFIG.PYTHON_SERVICE_URL;

const fetchWithTimeout = async (url, options = {}, timeoutMs = 4000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
};

// Middleware xác thực
router.use(authenticate);

/**
 * GET /api/ai/status
 * Trạng thái kết nối AI thực tế
 */
router.get('/status', asyncHandler(async (req, res) => {
  let pythonReachable = false;

  if (PYTHON_AI_SERVICE_URL) {
    try {
      const response = await fetchWithTimeout(`${PYTHON_AI_SERVICE_URL.replace(/\/$/, '')}/health`, { method: 'GET' }, 3500);
      pythonReachable = response.ok;
    } catch {
      pythonReachable = false;
    }
  }

  const geminiReady = Boolean(AI_CONFIG.GEMINI.API_KEY) && isGeminiAvailable();
  const pythonConfigured = Boolean(PYTHON_AI_SERVICE_URL);
  const ready = geminiReady || pythonConfigured;
  const mode = geminiReady ? 'gemini' : pythonConfigured ? 'python-fallback' : 'offline';

  res.json({
    success: true,
    data: {
      gemini: {
        configured: Boolean(AI_CONFIG.GEMINI.API_KEY),
        available: geminiReady,
        model: AI_CONFIG.GEMINI.MODEL,
      },
      pythonService: {
        configured: pythonConfigured,
        reachable: pythonReachable,
        url: PYTHON_AI_SERVICE_URL || null,
      },
      ready,
      mode,
      knowledgeBase: {
        enabled: true,
        table: 'ai_copilot_kb'
      }
    }
  });
}));

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

  if (result?.answer && companyId && question) {
    try {
      await saveQueryToKnowledgeBase(question, companyId, result.answer);
    } catch (error) {
      // Knowledge base persistence must never block the AI response.
      console.warn('[AI] Failed to save query to knowledge base:', error.message);
    }
  }

  res.json({
    success: true,
    data: result
  });
}));

/**
 * POST /api/ai/knowledge-base
 * Lưu cặp câu hỏi - trả lời vào kho tri thức AI
 */
router.post('/knowledge-base', asyncHandler(async (req, res) => {
  const { question, answer } = req.body;
  const companyId = req.companyId || req.body.company_id;

  if (!question || !answer) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Thiếu question hoặc answer', 400);
  }

  await saveQueryToKnowledgeBase(question, companyId, answer);

  res.json({
    success: true,
    data: {
      saved: true,
      companyId,
      question
    }
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

/**
 * POST /api/ai/math
 * Giải bài toán đại số/tài chính
 */
router.post('/math', asyncHandler(async (req, res) => {
  const { problem, context } = req.body;
  const companyId = req.companyId;

  if (!problem) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Thiếu bài toán', 400);
  }

  try {
    const result = await solveMathProblem(problem, context || 'financial');
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error({ error: error.message, problem, companyId }, 'Math solve failed');
    res.json({
      success: false,
      data: {
        solution: `Không thể giải bài toán: ${error.message}. Vui lòng thử lại sau.`,
        confidence: 0
      }
    });
  }
}));

/**
 * POST /api/ai/workflow/execute
 * Thực thi workflow với AI
 */
router.post('/workflow/execute', asyncHandler(async (req, res) => {
  const { workflowType, context } = req.body;
  const companyId = req.companyId;

  if (!workflowType) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Thiếu loại workflow', 400);
  }

  const result = await executeWorkflow(workflowType, companyId, context || {});

  res.json({
    success: true,
    data: result
  });
}));

/**
 * GET /api/ai/proactive-insights
 * Lấy proactive insights từ tất cả modules
 */
router.get('/proactive-insights', asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.query.company_id;

  const result = await getProactiveInsights(companyId);

  res.json({
    success: true,
    data: result
  });
}));

/**
 * POST /api/ai/cross-module
 * Phân tích cross-module
 */
router.post('/cross-module', asyncHandler(async (req, res) => {
  const { question } = req.body;
  const companyId = req.companyId;

  if (!question) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Thiếu câu hỏi', 400);
  }

  const result = await analyzeCrossModule(companyId, question);

  res.json({
    success: true,
    data: result
  });
}));

/**
 * POST /api/ai/ocr/process
 * Xử lý OCR tài liệu
 */
router.post('/ocr/process', asyncHandler(async (req, res) => {
  const { image_base64, document_type } = req.body;
  const companyId = req.companyId;

  if (!image_base64) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Thiếu hình ảnh', 400);
  }

  const result = await processDocument(image_base64, document_type || 'invoice', companyId);

  res.json({
    success: true,
    data: result
  });
}));

/**
 * POST /api/ai/ocr/save
 * Lưu kết quả OCR vào database
 */
router.post('/ocr/save', asyncHandler(async (req, res) => {
  const { ocr_result, document_type } = req.body;
  const companyId = req.companyId;

  if (!ocr_result) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Thiếu kết quả OCR', 400);
  }

  const result = await saveOCRResult(ocr_result, companyId, document_type || 'invoice');

  res.json({
    success: true,
    data: result
  });
}));

/**
 * GET /api/ai/ocr/pending
 * Lấy danh sách tài liệu OCR chờ duyệt
 */
router.get('/ocr/pending', asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.query.company_id;

  const result = await getPendingOCRInvoices(companyId);

  res.json({
    success: true,
    data: result
  });
}));

/**
 * POST /api/ai/ocr/approve
 * Duyệt kết quả OCR
 */
router.post('/ocr/approve', asyncHandler(async (req, res) => {
  const { ocr_id, corrections } = req.body;
  const companyId = req.companyId;

  if (!ocr_id) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Thiếu OCR ID', 400);
  }

  const result = await approveOCRResult(ocr_id, companyId, corrections || {});

  res.json({
    success: true,
    data: result
  });
}));

/**
 * POST /api/ai/ocr/reject
 * Từ chối kết quả OCR
 */
router.post('/ocr/reject', asyncHandler(async (req, res) => {
  const { ocr_id, reason } = req.body;
  const companyId = req.companyId;

  if (!ocr_id) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Thiếu OCR ID', 400);
  }

  const result = await rejectOCRResult(ocr_id, companyId, reason || 'Không đạt yêu cầu');

  res.json({
    success: true,
    data: result
  });
}));

// ==================== DEPARTMENT CLASSIFICATION ====================

/**
 * POST /api/ai/classify-department
 * Phân loại phòng ban tự động
 */
router.post('/classify-department', asyncHandler(async (req, res) => {
  const { content } = req.body;
  const companyId = req.companyId;

  if (!content) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Thiếu nội dung', 400);
  }

  const result = await classifyDepartment(content, companyId);

  res.json({
    success: true,
    data: result
  });
}));

/**
 * GET /api/ai/departments
 * Lấy danh sách phòng ban
 */
router.get('/departments', asyncHandler(async (req, res) => {
  const departments = await getAllDepartments();

  res.json({
    success: true,
    data: departments
  });
}));

/**
 * GET /api/ai/departments/:id
 * Lấy chi tiết phòng ban
 */
router.get('/departments/:id', asyncHandler(async (req, res) => {
  const department = await getDepartmentById(req.params.id);

  res.json({
    success: true,
    data: department
  });
}));

/**
 * POST /api/ai/departments
 * Tạo phòng ban mới
 */
router.post('/departments', asyncHandler(async (req, res) => {
  const department = await createDepartment(req.body);

  res.json({
    success: true,
    data: department
  });
}));

/**
 * PUT /api/ai/departments/:id
 * Cập nhật phòng ban
 */
router.put('/departments/:id', asyncHandler(async (req, res) => {
  const department = await updateDepartment(req.params.id, req.body);

  res.json({
    success: true,
    data: department
  });
}));

/**
 * DELETE /api/ai/departments/:id
 * Xóa phòng ban (soft delete)
 */
router.delete('/departments/:id', asyncHandler(async (req, res) => {
  const department = await deleteDepartment(req.params.id);

  res.json({
    success: true,
    data: department
  });
}));

// ==================== SMART SUGGESTIONS ====================

/**
 * POST /api/ai/suggest
 * Lấy smart suggestions
 */
router.post('/suggest', asyncHandler(async (req, res) => {
  const { content } = req.body;
  const companyId = req.companyId;

  if (!content) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Thiếu nội dung', 400);
  }

  const result = await getSuggestions(content, companyId);

  res.json({
    success: true,
    data: result
  });
}));

/**
 * GET /api/ai/suggestion-rules
 * Lấy danh sách suggestion rules
 */
router.get('/suggestion-rules', asyncHandler(async (req, res) => {
  const rules = await getAllSuggestionRules();

  res.json({
    success: true,
    data: rules
  });
}));

/**
 * GET /api/ai/suggestion-rules/:id
 * Lấy chi tiết suggestion rule
 */
router.get('/suggestion-rules/:id', asyncHandler(async (req, res) => {
  const rule = await getSuggestionRuleById(req.params.id);

  res.json({
    success: true,
    data: rule
  });
}));

/**
 * POST /api/ai/suggestion-rules
 * Tạo suggestion rule mới
 */
router.post('/suggestion-rules', asyncHandler(async (req, res) => {
  const rule = await createSuggestionRule(req.body);

  res.json({
    success: true,
    data: rule
  });
}));

/**
 * PUT /api/ai/suggestion-rules/:id
 * Cập nhật suggestion rule
 */
router.put('/suggestion-rules/:id', asyncHandler(async (req, res) => {
  const rule = await updateSuggestionRule(req.params.id, req.body);

  res.json({
    success: true,
    data: rule
  });
}));

/**
 * DELETE /api/ai/suggestion-rules/:id
 * Xóa suggestion rule (soft delete)
 */
router.delete('/suggestion-rules/:id', asyncHandler(async (req, res) => {
  const rule = await deleteSuggestionRule(req.params.id);

  res.json({
    success: true,
    data: rule
  });
}));

/**
 * GET /api/ai/suggestion-stats
 * Lấy thống kê suggestions
 */
router.get('/suggestion-stats', asyncHandler(async (req, res) => {
  const stats = await getSuggestionStats();

  res.json({
    success: true,
    data: stats
  });
}));

// ==================== BATCH PROCESSING ====================

/**
 * POST /api/ai/batch/process
 * Xử lý batch documents
 */
router.post('/batch/process', asyncHandler(async (req, res) => {
  const { config_code, documents } = req.body;
  const companyId = req.companyId;
  const userId = req.user?.id;

  if (!config_code || !documents || !Array.isArray(documents)) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Thiếu config_code hoặc documents', 400);
  }

  const result = await processBatch(config_code, documents, companyId, userId);

  res.json({
    success: true,
    data: result
  });
}));

/**
 * GET /api/ai/batch/:batchId
 * Lấy trạng thái batch
 */
router.get('/batch/:batchId', asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  const companyId = req.companyId;

  const result = await getBatchStatus(batchId, companyId);

  res.json({
    success: true,
    data: result
  });
}));

/**
 * GET /api/ai/batch/history
 * Lấy lịch sử batch processing
 */
router.get('/batch/history', asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.query.company_id;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  const result = await getBatchHistory(companyId, limit, offset);

  res.json({
    success: true,
    data: result
  });
}));

/**
 * POST /api/ai/batch/:batchId/retry
 * Retry failed documents
 */
router.post('/batch/:batchId/retry', asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  const companyId = req.companyId;
  const userId = req.user?.id;

  const result = await retryFailedDocuments(batchId, companyId, userId);

  res.json({
    success: true,
    data: result
  });
}));

/**
 * GET /api/ai/batch-configs
 * Lấy danh sách batch configs
 */
router.get('/batch-configs', asyncHandler(async (req, res) => {
  const configs = await getAllBatchConfigs();

  res.json({
    success: true,
    data: configs
  });
}));

/**
 * GET /api/ai/batch-configs/:id
 * Lấy chi tiết batch config
 */
router.get('/batch-configs/:id', asyncHandler(async (req, res) => {
  const config = await getBatchConfigById(req.params.id);

  res.json({
    success: true,
    data: config
  });
}));

/**
 * POST /api/ai/batch-configs
 * Tạo batch config mới
 */
router.post('/batch-configs', asyncHandler(async (req, res) => {
  const config = await createBatchConfig(req.body);

  res.json({
    success: true,
    data: config
  });
}));

/**
 * PUT /api/ai/batch-configs/:id
 * Cập nhật batch config
 */
router.put('/batch-configs/:id', asyncHandler(async (req, res) => {
  const config = await updateBatchConfig(req.params.id, req.body);

  res.json({
    success: true,
    data: config
  });
}));

/**
 * DELETE /api/ai/batch-configs/:id
 * Xóa batch config (soft delete)
 */
router.delete('/batch-configs/:id', asyncHandler(async (req, res) => {
  const config = await deleteBatchConfig(req.params.id);

  res.json({
    success: true,
    data: config
  });
}));

// ==================== WORKFLOW ENGINE ====================

/**
 * POST /api/ai/workflow/execute-data-driven
 * Thực thi workflow từ database
 */
router.post('/workflow/execute-data-driven', asyncHandler(async (req, res) => {
  const { workflow_code, input_data } = req.body;
  const companyId = req.companyId;
  const userId = req.user?.id;

  if (!workflow_code) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Thiếu workflow_code', 400);
  }

  const result = await executeDataDrivenWorkflow(workflow_code, input_data || {}, companyId, userId);

  res.json({
    success: true,
    data: result
  });
}));

/**
 * GET /api/ai/workflows
 * Lấy danh sách workflows
 */
router.get('/workflows', asyncHandler(async (req, res) => {
  const workflows = await getAllWorkflows();

  res.json({
    success: true,
    data: workflows
  });
}));

/**
 * GET /api/ai/workflows/:code
 * Lấy chi tiết workflow
 */
router.get('/workflows/:code', asyncHandler(async (req, res) => {
  const workflow = await getWorkflowByCode(req.params.code);

  res.json({
    success: true,
    data: workflow
  });
}));

/**
 * POST /api/ai/workflows
 * Tạo workflow mới
 */
router.post('/workflows', asyncHandler(async (req, res) => {
  const workflow = await createWorkflow(req.body);

  res.json({
    success: true,
    data: workflow
  });
}));

/**
 * PUT /api/ai/workflows/:id
 * Cập nhật workflow
 */
router.put('/workflows/:id', asyncHandler(async (req, res) => {
  const workflow = await updateWorkflow(req.params.id, req.body);

  res.json({
    success: true,
    data: workflow
  });
}));

/**
 * DELETE /api/ai/workflows/:id
 * Xóa workflow (soft delete)
 */
router.delete('/workflows/:id', asyncHandler(async (req, res) => {
  const workflow = await deleteWorkflow(req.params.id);

  res.json({
    success: true,
    data: workflow
  });
}));

export { router as aiQueryRouter };
export default router;
