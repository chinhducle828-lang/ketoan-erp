/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * services/aiSandbox.service.js
 * ====================================================================
 * AI Sandbox - Suggestion Only Mode with Approval Workflow
 * ====================================================================
 * 
 * Nguyên tắc an toàn:
 * 1. AI CHỈ được phép gợi ý (suggest), KHÔNG được tự động áp dụng
 * 2. Tất cả suggestions đều có confidence score
 * 3. Confidence < 90%: BẮT BUỘC phải có human approval
 * 4. Confidence >= 90%: Có thể tự động apply cho non-critical fields
 * 5. Các trường CRITICAL (account_code, tax_amount, partner_id) luôn cần approval
 * 
 * Mục đích: Ngăn chặn AI hallucination gây thiệt hại tài chính
 * ====================================================================
 */

import { pool } from '../config/db.js';
import { redis, isRedisReadyCheck } from '../cache/redis.js';

// ====================================================================
// Configuration - Database-driven (KHÔNG hard-code)
// ====================================================================

const AI_SANDBOX_CONFIG = {
  // Confidence thresholds
  HIGH_CONFIDENCE: 90,      // >= 90%: Có thể auto-apply (non-critical only)
  MEDIUM_CONFIDENCE: 70,    // >= 70%: Có thể suggest, cần approval
  LOW_CONFIDENCE: 0,        // < 70%: Chỉ để tham khảo
  
  // TTL cho suggestions (giây)
  SUGGESTION_TTL: 86400,    // 24 giờ
  
  // Critical fields - LUÔN cần approval
  CRITICAL_FIELDS: [
    'account_code',
    'tax_amount',
    'partner_id',
    'debit_account',
    'credit_account',
    'vat_rate',
    'currency',
    'exchange_rate'
  ],
  
  // Non-critical fields - Có thể auto-apply nếu confidence cao
  NON_CRITICAL_FIELDS: [
    'description',
    'notes',
    'reference_number',
    'category',
    'tags',
    'due_date'
  ]
};

// ====================================================================
// AI Suggestion Types
// ====================================================================

/**
 * Suggestion types
 */
export const SUGGESTION_TYPES = {
  ACCOUNT_CLASSIFICATION: 'account_classification',
  TAX_CALCULATION: 'tax_calculation',
  PARTNER_SUGGESTION: 'partner_suggestion',
  CATEGORY_SUGGESTION: 'category_suggestion',
  DUPLICATE_DETECTION: 'duplicate_detection',
  ANOMALY_DETECTION: 'anomaly_detection',
  PREDICTION: 'prediction'
};

/**
 * Suggestion status
 */
export const SUGGESTION_STATUS = {
  PENDING: 'pending',           // Chờ approval
  APPROVED: 'approved',         // Đã approved, chờ apply
  APPLIED: 'applied',           // Đã apply vào data
  REJECTED: 'rejected',         // Bị reject
  EXPIRED: 'expired'            // Hết hạn
};

// ====================================================================
// AI Sandbox Engine
// ====================================================================

export const AISandbox = {
  /**
   * Tạo suggestion từ AI model
   * 
   * @param {Object} params - Parameters
   * @param {string} params.type - Suggestion type
   * @param {number} params.companyId - Company ID
   * @param {Object} params.inputData - Input data
   * @param {Object} params.aiResult - AI prediction result
   * @param {string} params.userId - User ID (optional)
   * @returns {Promise<Object>} Suggestion object
   */
  async createSuggestion({ type, companyId, inputData, aiResult, userId = null }) {
    const confidence = aiResult.confidence || 0;
    const field = aiResult.field || 'unknown';
    const suggestedValue = aiResult.suggested_value;
    
    // Determine if this is a critical field
    const isCritical = AI_SANDBOX_CONFIG.CRITICAL_FIELDS.includes(field);
    
    // Determine if auto-apply is allowed
    const canAutoApply = !isCritical && confidence >= AI_SANDBOX_CONFIG.HIGH_CONFIDENCE;
    
    // Determine if approval is required
    const requiresApproval = isCritical || confidence < AI_SANDBOX_CONFIG.HIGH_CONFIDENCE;
    
    const suggestion = {
      type,
      companyId,
      userId,
      field,
      current_value: inputData[field],
      suggested_value: suggestedValue,
      confidence,
      is_critical: isCritical,
      requires_approval: requiresApproval,
      can_auto_apply: canAutoApply,
      status: requiresApproval ? SUGGESTION_STATUS.PENDING : SUGGESTION_STATUS.APPROVED,
      input_data: inputData,
      ai_metadata: aiResult.metadata || {},
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + AI_SANDBOX_CONFIG.SUGGESTION_TTL * 1000).toISOString()
    };
    
    // Save to database
    const saved = await this.saveSuggestion(suggestion);
    
    // Cache for quick access
    if (isRedisReadyCheck()) {
      const cacheKey = `company_${companyId}:ai_suggestion:${saved.id}`;
      await redis.setex(cacheKey, AI_SANDBOX_CONFIG.SUGGESTION_TTL, JSON.stringify(saved));
    }
    
    // Emit real-time notification if approval required
    if (requiresApproval) {
      await this.emitApprovalNotification(saved);
    }
    
    return saved;
  },
  
  /**
   * Lưu suggestion vào database
   */
  async saveSuggestion(suggestion) {
    const { rows } = await pool.query(`
      INSERT INTO ai_suggestions 
        (type, company_id, user_id, field, current_value, suggested_value, 
         confidence, is_critical, requires_approval, can_auto_apply, 
         status, input_data, ai_metadata, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      suggestion.type,
      suggestion.companyId,
      suggestion.userId,
      suggestion.field,
      suggestion.current_value,
      suggestion.suggested_value,
      suggestion.confidence,
      suggestion.is_critical,
      suggestion.requires_approval,
      suggestion.can_auto_apply,
      suggestion.status,
      JSON.stringify(suggestion.input_data),
      JSON.stringify(suggestion.ai_metadata),
      suggestion.expires_at
    ]);
    
    return rows[0];
  },
  
  /**
   * Apply suggestion vào data (CHỈ khi đã approved)
   * 
   * @param {number} suggestionId - Suggestion ID
   * @param {number} userId - User ID (người approve)
   * @returns {Promise<Object>} Applied result
   */
  async applySuggestion(suggestionId, userId) {
    // Lấy suggestion từ DB
    const { rows } = await pool.query(
      'SELECT * FROM ai_suggestions WHERE id = $1',
      [suggestionId]
    );
    
    if (rows.length === 0) {
      throw new Error('Không tìm thấy suggestion');
    }
    
    const suggestion = rows[0];
    
    // Validate status
    if (suggestion.status !== SUGGESTION_STATUS.APPROVED) {
      throw new Error(`Suggestion có status "${suggestion.status}" không thể apply. Cần approved trước.`);
    }
    
    // Check expiration
    if (new Date(suggestion.expires_at) < new Date()) {
      throw new Error('Suggestion đã hết hạn');
    }
    
    // Update status to APPLIED
    await pool.query(`
      UPDATE ai_suggestions 
      SET status = $1, approved_by = $2, applied_at = NOW()
      WHERE id = $3
    `, [SUGGESTION_STATUS.APPLIED, userId, suggestionId]);
    
    // Invalidate cache
    if (isRedisReadyCheck()) {
      const cacheKey = `company_${suggestion.company_id}:ai_suggestion:${suggestionId}`;
      await redis.del(cacheKey);
    }
    
    return {
      success: true,
      suggestion_id: suggestionId,
      field: suggestion.field,
      applied_value: suggestion.suggested_value,
      message: `Đã apply suggestion cho trường "${suggestion.field}"`
    };
  },
  
  /**
   * Approve suggestion
   * 
   * @param {number} suggestionId - Suggestion ID
   * @param {number} approverId - User ID (người approve)
   * @returns {Promise<Object>} Approval result
   */
  async approveSuggestion(suggestionId, approverId) {
    const { rows } = await pool.query(
      'SELECT * FROM ai_suggestions WHERE id = $1',
      [suggestionId]
    );
    
    if (rows.length === 0) {
      throw new Error('Không tìm thấy suggestion');
    }
    
    const suggestion = rows[0];
    
    if (suggestion.status !== SUGGESTION_STATUS.PENDING) {
      throw new Error(`Suggestion có status "${suggestion.status}" không thể approve`);
    }
    
    // Update status to APPROVED
    await pool.query(`
      UPDATE ai_suggestions 
      SET status = $1, approved_by = $2, approved_at = NOW()
      WHERE id = $3
    `, [SUGGESTION_STATUS.APPROVED, approverId, suggestionId]);
    
    // Invalidate cache
    if (isRedisReadyCheck()) {
      const cacheKey = `company_${suggestion.company_id}:ai_suggestion:${suggestionId}`;
      await redis.del(cacheKey);
    }
    
    return {
      success: true,
      suggestion_id: suggestionId,
      message: 'Suggestion đã được approve'
    };
  },
  
  /**
   * Reject suggestion
   * 
   * @param {number} suggestionId - Suggestion ID
   * @param {number} userId - User ID (người reject)
   * @param {string} reason - Lý do reject
   * @returns {Promise<Object>} Rejection result
   */
  async rejectSuggestion(suggestionId, userId, reason = '') {
    const { rows } = await pool.query(
      'SELECT * FROM ai_suggestions WHERE id = $1',
      [suggestionId]
    );
    
    if (rows.length === 0) {
      throw new Error('Không tìm thấy suggestion');
    }
    
    await pool.query(`
      UPDATE ai_suggestions 
      SET status = $1, rejected_by = $2, rejected_at = NOW(), rejection_reason = $3
      WHERE id = $4
    `, [SUGGESTION_STATUS.REJECTED, userId, reason, suggestionId]);
    
    // Invalidate cache
    if (isRedisReadyCheck()) {
      const cacheKey = `company_${rows[0].company_id}:ai_suggestion:${suggestionId}`;
      await redis.del(cacheKey);
    }
    
    return {
      success: true,
      suggestion_id: suggestionId,
      message: 'Suggestion đã bị reject'
    };
  },
  
  /**
   * Lấy danh sách suggestions cần approval
   * 
   * @param {number} companyId - Company ID
   * @param {Object} filters - Filters
   * @returns {Promise<Array>} List of suggestions
   */
  async getPendingSuggestions(companyId, filters = {}) {
    const { type, limit = 50, offset = 0 } = filters;
    
    let sql = `
      SELECT * FROM ai_suggestions 
      WHERE company_id = $1 
        AND status = $2
        AND expires_at > NOW()
    `;
    const params = [companyId, SUGGESTION_STATUS.PENDING];
    
    if (type) {
      params.push(type);
      sql += ` AND type = $${params.length}`;
    }
    
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const { rows } = await pool.query(sql, params);
    
    return rows.map(s => ({
      ...s,
      input_data: typeof s.input_data === 'string' ? JSON.parse(s.input_data) : s.input_data,
      ai_metadata: typeof s.ai_metadata === 'string' ? JSON.parse(s.ai_metadata) : s.ai_metadata
    }));
  },
  
  /**
   * Emit real-time notification cho approval workflow
   */
  async emitApprovalNotification(suggestion) {
    // TODO: Emit WebSocket event để notify admin
    // Có thể dùng socket.io hoặc web push
    console.log(`[AISandbox] 📢 Cần approval cho suggestion #${suggestion.id}:`, {
      type: suggestion.type,
      field: suggestion.field,
      confidence: suggestion.confidence,
      companyId: suggestion.companyId
    });
  },
  
  /**
   * Cleanup expired suggestions
   */
  async cleanupExpiredSuggestions() {
    const { rowCount } = await pool.query(`
      UPDATE ai_suggestions 
      SET status = $1 
      WHERE status = $2 
        AND expires_at < NOW()
    `, [SUGGESTION_STATUS.EXPIRED, SUGGESTION_STATUS.PENDING]);
    
    if (rowCount > 0) {
      console.log(`[AISandbox] Đã cleanup ${rowCount} expired suggestions`);
    }
    
    return rowCount;
  }
};

// ====================================================================
// AI Service Wrapper - Đảm bảo tất cả AI calls đều đi qua sandbox
// ====================================================================

/**
 * Wrapper cho AI predictions - đảm bảo suggestions được tạo đúng cách
 * 
 * @param {Function} aiPredictFn - AI prediction function
 * @param {Object} params - Parameters
 * @returns {Promise<Object>} Prediction result với suggestion
 */
export async function predictWithSandbox(aiPredictFn, params) {
  const { type, companyId, inputData, userId } = params;
  
  try {
    // Gọi AI model
    const aiResult = await aiPredictFn(inputData);
    
    // Tạo suggestion qua sandbox
    const suggestion = await AISandbox.createSuggestion({
      type,
      companyId,
      inputData,
      aiResult,
      userId
    });
    
    return {
      success: true,
      prediction: aiResult,
      suggestion,
      message: suggestion.requires_approval
        ? `AI gợi ý: ${aiResult.suggested_value} (confidence: ${aiResult.confidence}%). Cần approval.`
        : `AI tự động áp dụng: ${aiResult.suggested_value} (confidence: ${aiResult.confidence}%)`
    };
  } catch (err) {
    console.error('[AISandbox] Lỗi khi predict:', err.message);
    return {
      success: false,
      error: err.message
    };
  }
}

export default AISandbox;