/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiSelfFix.service - AI tự sửa chính mình
 * Cơ chế tự cải thiện với circuit breaker và version control
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { AI_CONFIG } from '../config/aiConfig.js';

const PYTHON_AI_SERVICE_URL = AI_CONFIG.PYTHON_SERVICE_URL;
const AI_INTERNAL_SECRET = process.env.AI_INTERNAL_SECRET || '';

/**
 * Kiểm tra circuit breaker - có cho phép tự sửa không
 * @param {string} tenantId - ID công ty
 * @param {string} modelName - Tên model
 * @returns {Promise<boolean>}
 */
export async function isCircuitOpen(tenantId, modelName = 'ocr') {
  const { rows } = await pool.query(
    `SELECT is_open, opened_at 
     FROM ai_circuit_breaker 
     WHERE tenant_id = $1 AND model_name = $2 
     AND is_open = TRUE 
     AND opened_at >= NOW() - INTERVAL '1 hour'`,
    [tenantId, modelName]
  );

  return rows.length > 0;
}

/**
 * Mở circuit breaker khi có lỗi
 * @param {string} tenantId - ID công ty
 * @param {string} modelName - Tên model
 * @param {string} error - Lỗi
 */
export async function openCircuitBreaker(tenantId, modelName = 'ocr', error = '') {
  const { rows } = await pool.query(
    `INSERT INTO ai_circuit_breaker (
      tenant_id, model_name, failure_count, is_open, opened_at
    ) VALUES ($1, $2, 1, TRUE, NOW())
    ON CONFLICT (tenant_id, model_name) 
    DO UPDATE SET 
      failure_count = ai_circuit_breaker.failure_count + 1,
      is_open = TRUE,
      opened_at = NOW()
    RETURNING *`,
    [tenantId, modelName]
  );

  logger.warn({ 
    tenantId, 
    modelName, 
    error,
    failureCount: rows[0].failure_count
  }, 'Circuit breaker opened for AI self-fix');
}

/**
 * Đóng circuit breaker
 * @param {string} tenantId - ID công ty
 * @param {string} modelName - Tên model
 */
export async function closeCircuitBreaker(tenantId, modelName = 'ocr') {
  await pool.query(
    `UPDATE ai_circuit_breaker 
     SET is_open = FALSE, 
         failure_count = 0,
         opened_at = NULL
     WHERE tenant_id = $1 AND model_name = $2`,
    [tenantId, modelName]
  );

  logger.info({ tenantId, modelName }, 'Circuit breaker closed for AI self-fix');
}

/**
 * Lấy version model đang active
 * @param {string} modelName - Tên model
 * @returns {Promise<string>}
 */
export async function getActiveModelVersion(modelName = 'ocr') {
  const { rows } = await pool.query(
    `SELECT version FROM ai_model_versions 
     WHERE model_name = $1 AND is_active = TRUE 
     ORDER BY deployed_at DESC 
     LIMIT 1`,
    [modelName]
  );

  return rows[0]?.version || 'v1.0';
}

/**
 * Thử tự sửa AI cho voucher
 * @param {number} voucherId - ID voucher
 * @param {string} tenantId - ID công ty
 * @param {Object} originalProposal - Đề xuất gốc
 * @returns {Promise<Object>}
 */
export async function attemptSelfFix(voucherId, tenantId, originalProposal) {
  // Kiểm tra circuit breaker
  if (await isCircuitOpen(tenantId, 'ocr')) {
    throw new AppError(ErrorCodes.SERVICE_UNAVAILABLE, 'AI tự sửa tạm thời bị tạm dừng do lỗi liên tiếp', 503);
  }

  // Lấy số lần đã tự sửa
  const { rows: logRows } = await pool.query(
    `SELECT self_fix_attempts, ai_fix_history 
     FROM ai_hitl_logs 
     WHERE voucher_id = $1 AND tenant_id = $2`,
    [voucherId, tenantId]
  );

  if (logRows.length === 0) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Không tìm thấy HITL log', 404);
  }

  const currentAttempts = logRows[0].self_fix_attempts || 0;
  const fixHistory = logRows[0].ai_fix_history || [];

  // Giới hạn tối đa 3 lần tự sửa
  if (currentAttempts >= 3) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Đã đạt tối đa 3 lần tự sửa', 400);
  }

  try {
    // Gọi Python AI service để tự sửa
    const response = await fetch(`${PYTHON_AI_SERVICE_URL}/api/self-fix`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_INTERNAL_SECRET}`
      },
      body: JSON.stringify({
        voucher_id: voucherId,
        tenant_id: tenantId,
        original_proposal: originalProposal,
        attempt_number: currentAttempts + 1,
        model_version: await getActiveModelVersion('ocr')
      })
    });

    if (!response.ok) {
      throw new AppError(ErrorCodes.SERVICE_UNAVAILABLE, 'AI self-fix service không phản hồi', 503);
    }

    const result = await response.json();
    const newConfidence = result.confidence_score || 0;

    // Cập nhật lịch sử tự sửa
    const newHistory = [
      ...fixHistory,
      {
        attempt: currentAttempts + 1,
        timestamp: new Date().toISOString(),
        confidence_before: originalProposal.confidence_score,
        confidence_after: newConfidence,
        changes: result.changes || [],
        model_version: result.model_version
      }
    ];

    // Cập nhật database
    await pool.query(
      `UPDATE ai_hitl_logs 
       SET self_fix_attempts = $1,
           ai_fix_history = $2,
           is_self_fixed = $3,
           last_self_fix_at = NOW(),
           ai_model_version = $4
       WHERE voucher_id = $5 AND tenant_id = $6`,
      [
        currentAttempts + 1,
        JSON.stringify(newHistory),
        newConfidence >= AI_CONFIG.CONFIDENCE.AUTO_POSTED,
        result.model_version,
        voucherId,
        tenantId
      ]
    );

    // Nếu cải thiện đáng kể, đóng circuit breaker
    if (newConfidence > (originalProposal.confidence_score || 0) + 10) {
      await closeCircuitBreaker(tenantId, 'ocr');
    }

    logger.info({
      voucherId,
      tenantId,
      attempt: currentAttempts + 1,
      confidenceBefore: originalProposal.confidence_score,
      confidenceAfter: newConfidence
    }, 'AI self-fix attempted');

    return {
      success: true,
      confidence: newConfidence,
      changes: result.changes,
      canAutoPost: newConfidence >= AI_CONFIG.CONFIDENCE.AUTO_POSTED,
      fixHistory: newHistory
    };
  } catch (error) {
    // Mở circuit breaker nếu lỗi
    await openCircuitBreaker(tenantId, 'ocr', error.message);
    
    if (error instanceof AppError) throw error;
    throw new AppError(ErrorCodes.SERVICE_UNAVAILABLE, 'Lỗi kết nối AI self-fix service', 503);
  }
}

/**
 * Rollback về version trước khi tự sửa
 * @param {number} voucherId - ID voucher
 * @param {string} tenantId - ID công ty
 * @returns {Promise<Object>}
 */
export async function rollbackSelfFix(voucherId, tenantId) {
  const { rows } = await pool.query(
    `SELECT ai_fix_history, original_ai_proposal 
     FROM ai_hitl_logs 
     WHERE voucher_id = $1 AND tenant_id = $2`,
    [voucherId, tenantId]
  );

  if (rows.length === 0 || !rows[0].ai_fix_history?.length) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Không có lịch sử tự sửa để rollback', 400);
  }

  const history = rows[0].ai_fix_history;
  const previousState = history[history.length - 1];

  // Cập nhật về trạng thái trước
  await pool.query(
    `UPDATE ai_hitl_logs 
     SET self_fix_attempts = 0,
         is_self_fixed = FALSE,
         ai_fix_history = '[]'::jsonb,
         final_human_approved = original_ai_proposal
     WHERE voucher_id = $1 AND tenant_id = $2`,
    [voucherId, tenantId]
  );

  logger.info({ voucherId, tenantId }, 'AI self-fix rolled back');

  return {
    success: true,
    rolledBackTo: previousState
  };
}

/**
 * Lấy thống kê tự sửa AI
 * @param {string} tenantId - ID công ty
 * @returns {Promise<Object>}
 */
export async function getSelfFixStats(tenantId) {
  const { rows } = await pool.query(
    `SELECT 
      COUNT(*) as total_vouchers,
      COUNT(CASE WHEN is_self_fixed = TRUE THEN 1 END) as self_fixed_count,
      AVG(self_fix_attempts) as avg_attempts,
      COUNT(CASE WHEN self_fix_attempts >= 3 THEN 1 END) as max_attempts_reached
    FROM ai_hitl_logs 
    WHERE tenant_id = $1 
    AND created_at >= NOW() - INTERVAL '30 days'`,
    [tenantId]
  );

  const stats = rows[0];
  return {
    totalVouchers: Number(stats.total_vouchers) || 0,
    selfFixedCount: Number(stats.self_fixed_count) || 0,
    avgAttempts: Number(stats.avg_attempts) || 0,
    maxAttemptsReached: Number(stats.max_attempts_reached) || 0,
    successRate: stats.total_vouchers > 0 
      ? (Number(stats.self_fixed_count) / Number(stats.total_vouchers) * 100).toFixed(1)
      : 0
  };
}

export default {
  isCircuitOpen,
  openCircuitBreaker,
  closeCircuitBreaker,
  getActiveModelVersion,
  attemptSelfFix,
  rollbackSelfFix,
  getSelfFixStats
};