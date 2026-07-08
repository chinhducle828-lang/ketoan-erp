/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * hitl.service - Service xử lý Human-In-The-Loop
 * Tính confidence score và quyết định luồng xử lý
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { AI_CONFIG } from '../config/aiConfig.js';
import { attemptSelfFix, isCircuitOpen } from './aiSelfFix.service.js';

/**
 * Xác định trạng thái xử lý dựa trên confidence score và giá trị giao dịch
 * @param {number} confidenceScore - Điểm tự tin (0-100)
 * @param {number} amount - Giá trị giao dịch (VND)
 * @returns {string} - AUTO_POSTED | HUMAN_REVIEW | EXPERT_AUDIT
 */
export function determineProcessingStatus(confidenceScore, amount) {
  const confidence = Number(confidenceScore) || 0;
  const value = Number(amount) || 0;

  // AUTO_POSTED: confidence >= threshold AND amount < max
  if (confidence >= AI_CONFIG.CONFIDENCE.AUTO_POSTED && 
      value < AI_CONFIG.AMOUNT.AUTO_POSTED_MAX) {
    return 'AUTO_POSTED';
  }

  // HUMAN_REVIEW: threshold <= confidence < auto_posted OR amount in range
  if ((confidence >= AI_CONFIG.CONFIDENCE.HUMAN_REVIEW && 
       confidence < AI_CONFIG.CONFIDENCE.AUTO_POSTED) || 
      (value >= AI_CONFIG.AMOUNT.AUTO_POSTED_MAX && 
       value < AI_CONFIG.AMOUNT.HUMAN_REVIEW_MAX)) {
    return 'HUMAN_REVIEW';
  }

  // EXPERT_AUDIT: confidence < threshold OR amount >= max
  return 'EXPERT_AUDIT';
}

/**
 * Tính confidence score dựa trên đề xuất AI
 * @param {Object} aiProposal - Đề xuất từ AI
 * @returns {number} - Confidence score (0-100)
 */
export function calculateConfidenceScore(aiProposal) {
  if (!aiProposal) return 0;

  // Logic tính confidence dựa trên:
  // 1. Độ tin cậy của OCR
  // 2. Độ khớp với dữ liệu đối tác
  // 3. Độ cân đối Nợ/Có
  // 4. Độ phù hợp mã tài khoản
  
  let score = 100;
  
  // Trừ điểm nếu thiếu thông tin
  if (!aiProposal.vendor_tax_code) score -= 10;
  if (!aiProposal.items || aiProposal.items.length === 0) score -= 20;
  
  // Trừ điểm nếu không cân đối
  const totalDebit = (aiProposal.entries || [])
    .filter(e => e.entryType === 'DR')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalCredit = (aiProposal.entries || [])
    .filter(e => e.entryType === 'CR')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  
  if (Math.abs(totalDebit - totalCredit) > 1000) {
    score -= 30; // Sai lệch > 1000 VND
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Lưu log HITL
 * @param {Object} logData - Dữ liệu log
 * @returns {Promise<Object>}
 */
export async function saveHitlLog(logData) {
  const {
    tenant_id,
    voucher_id,
    ai_confidence_score,
    original_ai_proposal,
    final_human_approved,
    is_modified = false,
    modified_fields = [],
    user_id,
    ai_model_version = 'v1.0',
    processing_status = 'pending'
  } = logData;

  const result = await pool.query(
    `INSERT INTO ai_hitl_logs (
      tenant_id, voucher_id, ai_confidence_score, original_ai_proposal,
      final_human_approved, is_modified, modified_fields, user_id,
      ai_model_version, processing_status, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    RETURNING *`,
    [
      tenant_id,
      voucher_id,
      ai_confidence_score,
      JSON.stringify(original_ai_proposal),
      JSON.stringify(final_human_approved),
      is_modified,
      modified_fields,
      user_id,
      ai_model_version,
      processing_status
    ]
  );

  logger.info({
    action: 'hitl_log_created',
    voucher_id,
    confidence: ai_confidence_score,
    status: processing_status
  }, 'HITL log saved');

  return result.rows[0];
}

/**
 * Cập nhật trạng thái HITL
 * @param {number} logId - ID log
 * @param {string} status - Trạng thái mới (approved/rejected)
 * @param {number} [approvedBy] - ID người duyệt
 * @returns {Promise<Object>}
 */
export async function updateHitlStatus(logId, status, approvedBy = null) {
  const result = await pool.query(
    `UPDATE ai_hitl_logs 
     SET processing_status = $1, 
         approved_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [status, logId]
  );

  return result.rows[0];
}

/**
 * Lấy danh sách HITL logs
 * @param {string} tenantId - ID tenant
 * @param {Object} options - Tùy chọn lọc
 * @returns {Promise<Array>}
 */
export async function getHitlLogs(tenantId, options = {}) {
  const { 
    limit = 50, 
    offset = 0, 
    status = null,
    isModified = null,
    days = 7
  } = options;

  let whereClause = 'WHERE tenant_id = $1';
  const params = [tenantId];
  let paramCount = 1;

  if (status) {
    paramCount++;
    whereClause += ` AND processing_status = $${paramCount}`;
    params.push(status);
  }

  if (isModified !== null) {
    paramCount++;
    whereClause += ` AND is_modified = $${paramCount}`;
    params.push(isModified);
  }

  if (days) {
    paramCount++;
    whereClause += ` AND created_at >= NOW() - INTERVAL '$${paramCount} days'`;
    params.push(days);
  }

  const { rows } = await pool.query(
    `SELECT * FROM ai_hitl_logs
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
    [...params, limit, offset]
  );

  return rows;
}

/**
 * Lấy thống kê AI learning
 * @param {string} tenantId - ID tenant
 * @returns {Promise<Object>}
 */
export async function getAiLearningStats(tenantId) {
  const { rows } = await pool.query(
    `SELECT 
      COUNT(*) as total_proposals,
      COUNT(CASE WHEN is_modified = TRUE THEN 1 END) as modified_count,
      AVG(ai_confidence_score) as avg_confidence,
      COUNT(CASE WHEN processing_status = 'approved' THEN 1 END) as approved_count,
      COUNT(CASE WHEN processing_status = 'rejected' THEN 1 END) as rejected_count
    FROM ai_hitl_logs
    WHERE tenant_id = $1
    AND created_at >= NOW() - INTERVAL '30 days'`,
    [tenantId]
  );

  const stats = rows[0];
  return {
    totalProposals: Number(stats.total_proposals) || 0,
    modifiedCount: Number(stats.modified_count) || 0,
    avgConfidence: Number(stats.avg_confidence) || 0,
    approvedCount: Number(stats.approved_count) || 0,
    rejectedCount: Number(stats.rejected_count) || 0,
    accuracyRate: stats.total_proposals > 0 
      ? ((stats.total_proposals - stats.modified_count) / stats.total_proposals * 100).toFixed(1)
      : 0
  };
}

/**
 * Thử tự sửa AI khi confidence thấp
 * Chỉ áp dụng cho HUMAN_REVIEW status
 * @param {number} voucherId - ID voucher
 * @param {string} tenantId - ID công ty
 * @returns {Promise<Object>}
 */
export async function trySelfFix(voucherId, tenantId) {
  // Kiểm tra circuit breaker
  if (await isCircuitOpen(tenantId)) {
    return { 
      success: false, 
      reason: 'circuit_open',
      message: 'AI tự sửa tạm dừng do lỗi liên tiếp' 
    };
  }

  // Lấy HITL log hiện tại
  const { rows: logRows } = await pool.query(
    `SELECT id, original_ai_proposal, ai_confidence_score, self_fix_attempts
     FROM ai_hitl_logs 
     WHERE voucher_id = $1 AND tenant_id = $2`,
    [voucherId, tenantId]
  );

  if (logRows.length === 0) {
    return { success: false, reason: 'not_found' };
  }

  const log = logRows[0];
  const currentAttempts = log.self_fix_attempts || 0;

  // Giới hạn tối đa 3 lần tự sửa
  if (currentAttempts >= 3) {
    return { 
      success: false, 
      reason: 'max_attempts',
      message: 'Đã đạt tối đa 3 lần tự sửa' 
    };
  }

  // Thử tự sửa
  const fixResult = await attemptSelfFix(voucherId, tenantId, {
    ...log.original_ai_proposal,
    confidence_score: log.ai_confidence_score
  });

  return fixResult;
}

export default {
  determineProcessingStatus,
  calculateConfidenceScore,
  saveHitlLog,
  updateHitlStatus,
  getHitlLogs,
  getAiLearningStats,
  trySelfFix
};
