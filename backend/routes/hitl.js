/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * hitl.route - API endpoints cho Human-In-The-Loop
 */

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { checkCompanyAccess } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  determineProcessingStatus,
  calculateConfidenceScore,
  saveHitlLog,
  updateHitlStatus,
  getHitlLogs,
  getAiLearningStats,
  trySelfFix
} from '../services/hitl.service.js';
import {
  getSelfFixStats,
  rollbackSelfFix
} from '../services/aiSelfFix.service.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';

const router = express.Router();

// Middleware xác thực
router.use(authenticate);

/**
 * GET /api/hitl/logs
 * Lấy danh sách HITL logs
 */
router.get('/logs', asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.query.company_id;
  
  if (!companyId) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Thiếu company_id', 400);
  }

  const logs = await getHitlLogs(companyId, {
    limit: parseInt(req.query.limit) || 50,
    offset: parseInt(req.query.offset) || 0,
    status: req.query.status,
    isModified: req.query.is_modified ? req.query.is_modified === 'true' : null
  });

  res.json({
    success: true,
    data: logs
  });
}));

/**
 * GET /api/hitl/stats
 * Lấy thống kê AI learning
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.query.company_id;
  
  if (!companyId) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Thiếu company_id', 400);
  }

  const stats = await getAiLearningStats(companyId);

  res.json({
    success: true,
    data: stats
  });
}));

/**
 * POST /api/hitl/logs
 * Tạo HITL log mới
 */
router.post('/logs', asyncHandler(async (req, res) => {
  const {
    voucher_id,
    ai_confidence_score,
    original_ai_proposal,
    final_human_approved,
    is_modified,
    modified_fields
  } = req.body;

  const companyId = req.companyId || req.body.company_id;

  if (!companyId || !original_ai_proposal) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Thiếu thông tin bắt buộc', 400);
  }

  // Tính processing status tự động
  const totalAmount = (original_ai_proposal.entries || [])
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const processingStatus = determineProcessingStatus(ai_confidence_score, totalAmount);

  const log = await saveHitlLog({
    tenant_id: companyId,
    voucher_id,
    ai_confidence_score,
    original_ai_proposal,
    final_human_approved: final_human_approved || original_ai_proposal,
    is_modified: is_modified || false,
    modified_fields: modified_fields || [],
    user_id: req.user?.id,
    processing_status: processingStatus
  });

  res.status(201).json({
    success: true,
    data: log
  });
}));

/**
 * PUT /api/hitl/logs/:id/approve
 * Duyệt HITL log
 */
router.put('/logs/:id/approve', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Trạng thái không hợp lệ', 400);
  }

  const log = await updateHitlStatus(id, status, req.user?.id);

  res.json({
    success: true,
    data: log
  });
}));

/**
 * POST /api/hitl/determine-status
 * Xác định trạng thái xử lý dựa trên confidence score
 */
router.post('/determine-status', asyncHandler(async (req, res) => {
  const { confidence_score, amount } = req.body;

  if (confidence_score === undefined || amount === undefined) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Thiếu confidence_score hoặc amount', 400);
  }

  const status = determineProcessingStatus(confidence_score, amount);

  res.json({
    success: true,
    data: { status }
  });
}));

/**
 * POST /api/hitl/self-fix
 * Thử tự sửa AI cho voucher
 */
router.post('/self-fix', asyncHandler(async (req, res) => {
  const { voucher_id } = req.body;
  const companyId = req.companyId || req.body.company_id;

  if (!voucher_id || !companyId) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Thiếu voucher_id hoặc company_id', 400);
  }

  const result = await trySelfFix(voucher_id, companyId);

  res.json({
    success: result.success,
    data: result
  });
}));

/**
 * GET /api/hitl/self-fix/stats
 * Lấy thống kê tự sửa AI
 */
router.get('/self-fix/stats', asyncHandler(async (req, res) => {
  const companyId = req.companyId || req.query.company_id;

  if (!companyId) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Thiếu company_id', 400);
  }

  const stats = await getSelfFixStats(companyId);

  res.json({
    success: true,
    data: stats
  });
}));

/**
 * POST /api/hitl/self-fix/rollback
 * Rollback tự sửa AI
 */
router.post('/self-fix/rollback', asyncHandler(async (req, res) => {
  const { voucher_id } = req.body;
  const companyId = req.companyId || req.body.company_id;

  if (!voucher_id || !companyId) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Thiếu voucher_id hoặc company_id', 400);
  }

  const result = await rollbackSelfFix(voucher_id, companyId);

  res.json({
    success: result.success,
    data: result
  });
}));

export { router as hitlRouter };
export default router;
