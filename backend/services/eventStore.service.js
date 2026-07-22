/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * services/eventStore.service.js
 * ====================================================================
 * Event Store - Immutable Audit Trail for All Operations
 * ====================================================================
 * 
 * Nguyên tắc:
 * 1. Mọi thay đổi đều được ghi lại dưới dạng event (immutable)
 * 2. Event KHÔNG BAO GIỜ bị xóa hoặc sửa đổi (chỉ có thể bị compensate)
 * 3. Format chuẩn hóa cho tất cả events
 * 4. Hỗ trợ replay, audit, compliance
 * 5. Company isolation đầy đủ
 * 
 * Event Types:
 * - VOUCHER_CREATED, VOUCHER_UPDATED, VOUCHER_DELETED, VOUCHER_POSTED
 * - ACCOUNT_CLASSIFIED, TAX_CALCULATED, PARTNER_SUGGESTED
 * - AI_SUGGESTION_CREATED, AI_SUGGESTION_APPROVED, AI_SUGGESTION_APPLIED
 * - SYSTEM_CONFIG_CHANGED, USER_ACTION, API_CALLED
 * 
 * ====================================================================
 */

import { pool } from '../config/db.js';
import { redis, isRedisReadyCheck } from '../cache/redis.js';
import { mtAuditLog } from '../cache/redisMultiTenancy.js';

import { getConfigNumber, getConfigString, getConfig } from '../utils/configHelper.js';


// ====================================================================
// Event Store Configuration
// ====================================================================

const EVENT_STORE_CONFIG = {
  // Event categories
  CATEGORIES: {
    VOUCHER: 'voucher',
    ACCOUNTING: 'accounting',
    AI: 'ai',
    SYSTEM: 'system',
    USER: 'user',
    API: 'api',
    COMPLIANCE: 'compliance'
  },
  
  // Event severity levels
  SEVERITY: {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
  },
  
  // TTL cho event cache (giây)
  EVENT_CACHE_TTL: 3600, // 1 giờ
  
  // Batch size cho bulk operations
  BATCH_SIZE: 100
};

// ====================================================================
// Event Store Engine
// ====================================================================

export const EventStore = {
  /**
   * Ghi 1 event vào event store
   * 
   * @param {Object} params - Event parameters
   * @param {string} params.eventType - Event type (e.g., 'VOUCHER_CREATED')
   * @param {string} params.category - Event category
   * @param {number} params.companyId - Company ID
   * @param {number} params.userId - User ID (optional)
   * @param {Object} params.eventData - Event data
   * @param {Object} params.metadata - Additional metadata
   * @param {string} params.severity - Severity level
   * @param {string} params.correlationId - Correlation ID (optional)
   * @returns {Promise<Object>} Event record
   */
  async append({
    eventType,
    category,
    companyId,
    userId = null,
    eventData = {},
    metadata = {},
    severity = EVENT_STORE_CONFIG.SEVERITY.INFO,
    correlationId = null
  }) {
    // Validate required fields
    if (!eventType || !category || !companyId) {
      throw new Error('Thiếu eventType, category, hoặc companyId');
    }
    
    // Validate category
    if (!Object.values(EVENT_STORE_CONFIG.CATEGORIES).includes(category)) {
      throw new Error(`Invalid category: ${category}`);
    }
    
    // Validate severity
    if (!Object.values(EVENT_STORE_CONFIG.SEVERITY).includes(severity)) {
      throw new Error(`Invalid severity: ${severity}`);
    }
    
    // Generate correlation ID if not provided
    const corrId = correlationId || this.generateCorrelationId();
    
    // Create event record
    const event = {
      event_type: eventType,
      category,
      company_id: companyId,
      user_id: userId,
      event_data: eventData,
      metadata: {
        ...metadata,
        user_agent: metadata.user_agent || null,
        ip_address: metadata.ip_address || null,
        source: metadata.source || 'backend'
      },
      severity,
      correlation_id: corrId,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    
    // Save to database (immutable)
    const { rows } = await pool.query(`
      INSERT INTO event_store 
        (event_type, category, company_id, user_id, event_data, metadata, 
         severity, correlation_id, timestamp, version)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      event.event_type,
      event.category,
      event.company_id,
      event.user_id,
      JSON.stringify(event.event_data),
      JSON.stringify(event.metadata),
      event.severity,
      event.correlation_id,
      event.timestamp,
      event.version
    ]);
    
    const savedEvent = rows[0];
    
    // Cache for quick access
    if (isRedisReadyCheck()) {
      const cacheKey = `company_${companyId}:event:${savedEvent.id}`;
      await redis.setex(cacheKey, EVENT_STORE_CONFIG.EVENT_CACHE_TTL, JSON.stringify(savedEvent));
      
      // Also cache by correlation ID for quick lookup
      const corrCacheKey = `company_${companyId}:event:correlation:${corrId}`;
      await redis.setex(corrCacheKey, EVENT_STORE_CONFIG.EVENT_CACHE_TTL, JSON.stringify(savedEvent));
    }
    
    // Audit log
    mtAuditLog('EVENT_APPEND', companyId, `event:${savedEvent.id}`, {
      eventType,
      category,
      severity,
      correlationId: corrId
    });
    
    return savedEvent;
  },
  
  /**
   * Lấy event theo ID
   * 
   * @param {number} eventId - Event ID
   * @param {number} companyId - Company ID (for security)
   * @returns {Promise<Object|null>} Event record
   */
  async getEvent(eventId, companyId) {
    // Try cache first
    if (isRedisReadyCheck()) {
      const cacheKey = `company_${companyId}:event:${eventId}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }
    
    // Query database
    const { rows } = await pool.query(
      'SELECT * FROM event_store WHERE id = $1 AND company_id = $2',
      [eventId, companyId]
    );
    
    if (rows.length === 0) return null;
    
    const event = rows[0];
    
    // Parse JSON fields
    event.event_data = typeof event.event_data === 'string' 
      ? JSON.parse(event.event_data) 
      : event.event_data;
    event.metadata = typeof event.metadata === 'string' 
      ? JSON.parse(event.metadata) 
      : event.metadata;
    
    // Cache for next time
    if (isRedisReadyCheck()) {
      const cacheKey = `company_${companyId}:event:${eventId}`;
      await redis.setex(cacheKey, EVENT_STORE_CONFIG.EVENT_CACHE_TTL, JSON.stringify(event));
    }
    
    return event;
  },
  
  /**
   * Lấy danh sách events theo filters
   * 
   * @param {number} companyId - Company ID
   * @param {Object} filters - Filters
   * @returns {Promise<Array>} List of events
   */
  async getEvents(companyId, filters = {}) {
    const {
      eventType,
      category,
      severity,
      userId,
      correlationId,
      startDate,
      endDate,
      limit = 100,
      offset = 0
    } = filters;
    
    let sql = 'SELECT * FROM event_store WHERE company_id = $1';
    const params = [companyId];
    let paramIdx = 1;
    
    if (eventType) {
      paramIdx++;
      sql += ` AND event_type = $${paramIdx}`;
      params.push(eventType);
    }
    
    if (category) {
      paramIdx++;
      sql += ` AND category = $${paramIdx}`;
      params.push(category);
    }
    
    if (severity) {
      paramIdx++;
      sql += ` AND severity = $${paramIdx}`;
      params.push(severity);
    }
    
    if (userId) {
      paramIdx++;
      sql += ` AND user_id = $${paramIdx}`;
      params.push(userId);
    }
    
    if (correlationId) {
      paramIdx++;
      sql += ` AND correlation_id = $${paramIdx}`;
      params.push(correlationId);
    }
    
    if (startDate) {
      paramIdx++;
      sql += ` AND timestamp >= $${paramIdx}`;
      params.push(startDate);
    }
    
    if (endDate) {
      paramIdx++;
      sql += ` AND timestamp <= $${paramIdx}`;
      params.push(endDate);
    }
    
    sql += ` ORDER BY timestamp DESC LIMIT $${paramIdx + 1} OFFSET $${paramIdx + 2}`;
    params.push(limit, offset);
    
    const { rows } = await pool.query(sql, params);
    
    // Parse JSON fields
    return rows.map(event => ({
      ...event,
      event_data: typeof event.event_data === 'string' ? JSON.parse(event.event_data) : event.event_data,
      metadata: typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata
    }));
  },
  
  /**
   * Lấy events theo correlation ID (để trace 1 luồng xử lý)
   * 
   * @param {string} correlationId - Correlation ID
   * @param {number} companyId - Company ID
   * @returns {Promise<Array>} List of events
   */
  async getEventsByCorrelationId(correlationId, companyId) {
    // Try cache first
    if (isRedisReadyCheck()) {
      const cacheKey = `company_${companyId}:event:correlation:${correlationId}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        return [JSON.parse(cached)];
      }
    }
    
    const { rows } = await pool.query(
      'SELECT * FROM event_store WHERE correlation_id = $1 AND company_id = $2 ORDER BY timestamp ASC',
      [correlationId, companyId]
    );
    
    return rows.map(event => ({
      ...event,
      event_data: typeof event.event_data === 'string' ? JSON.parse(event.event_data) : event.event_data,
      metadata: typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata
    }));
  },
  
  /**
   * Replay events từ 1 điểm nhất định (để recovery hoặc debugging)
   * 
   * @param {number} companyId - Company ID
   * @param {string} fromEventId - Event ID bắt đầu replay
   * @param {Function} handler - Handler function để xử lý từng event
   * @returns {Promise<Object>} Replay result
   */
  async replayEvents(companyId, fromEventId, handler) {
    const { rows } = await pool.query(`
      SELECT * FROM event_store 
      WHERE company_id = $1 
        AND id >= $2 
        AND category IN ('voucher', 'accounting')
      ORDER BY id ASC
    `, [companyId, fromEventId]);
    
    const results = {
      total: rows.length,
      success: 0,
      failed: 0,
      errors: []
    };
    
    for (const event of rows) {
      try {
        await handler(event);
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({
          eventId: event.id,
          eventType: event.event_type,
          error: err.message
        });
      }
    }
    
    return results;
  },
  
  /**
   * Compensate event (không xóa, chỉ thêm event bù)
   * 
   * @param {number} eventId - Event ID cần compensate
   * @param {string} compensationType - Loại compensation
   * @param {Object} compensationData - Data để compensate
   * @param {number} userId - User ID thực hiện
   * @returns {Promise<Object>} Compensation event
   */
  async compensateEvent(eventId, compensationType, compensationData, userId) {
    // Lấy event gốc
    const originalEvent = await this.getEvent(eventId, compensationData.companyId);
    
    if (!originalEvent) {
      throw new Error('Không tìm thấy event gốc');
    }
    
    // Tạo compensation event
    const compensationEvent = await this.append({
      eventType: `${originalEvent.event_type}_COMPENSATED`,
      category: originalEvent.category,
      companyId: originalEvent.company_id,
      userId,
      eventData: {
        original_event_id: eventId,
        original_event_type: originalEvent.event_type,
        compensation_type: compensationType,
        compensation_data: compensationData,
        original_event_data: originalEvent.event_data
      },
      metadata: {
        ...originalEvent.metadata,
        compensation: true,
        original_timestamp: originalEvent.timestamp
      },
      severity: EVENT_STORE_CONFIG.SEVERITY.WARNING,
      correlationId: originalEvent.correlation_id
    });
    
    return compensationEvent;
  },
  
  /**
   * Xóa events cũ (CHỈ cho compliance/retention policy)
   * Lưu ý: Đây là thao tác đặc biệt, cần approval
   * 
   * @param {number} companyId - Company ID
   * @param {string} beforeDate - Xóa events trước ngày này
   * @param {number} userId - User ID thực hiện
   * @returns {Promise<Object>} Deletion result
   */
  async archiveOldEvents(companyId, beforeDate, userId) {
    // Đánh dấu là archived (KHÔNG xóa)
    const { rowCount } = await pool.query(`
      UPDATE event_store 
      SET metadata = jsonb_set(
        COALESCE(metadata, '{}')::jsonb,
        '{archived}',
        'true'::jsonb
      )
      WHERE company_id = $1 
        AND timestamp < $2 
        AND (metadata->>'archived') IS NULL
    `, [companyId, beforeDate]);
    
    // Ghi log hành động này
    await this.append({
      eventType: 'EVENT_STORE_ARCHIVED',
      category: EVENT_STORE_CONFIG.CATEGORIES.SYSTEM,
      companyId,
      userId,
      eventData: {
        archived_count: rowCount,
        before_date: beforeDate
      },
      severity: EVENT_STORE_CONFIG.SEVERITY.INFO
    });
    
    return {
      success: true,
      archived_count: rowCount,
      message: `Đã archive ${rowCount} events`
    };
  },
  
  /**
   * Generate correlation ID
   * @returns {string} Correlation ID
   */
  generateCorrelationId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `corr_${timestamp}_${random}`;
  },
  
  /**
   * Validate event data
   * @param {Object} event - Event data
   * @returns {Object} Validation result
   */
  validateEvent(event) {
    const errors = [];
    
    if (!event.eventType || typeof event.eventType !== 'string') {
      errors.push('eventType is required and must be a string');
    }
    
    if (!event.category || !Object.values(EVENT_STORE_CONFIG.CATEGORIES).includes(event.category)) {
      errors.push('category is required and must be valid');
    }
    
    if (!event.companyId || typeof event.companyId !== 'number') {
      errors.push('companyId is required and must be a number');
    }
    
    if (event.userId && typeof event.userId !== 'number') {
      errors.push('userId must be a number if provided');
    }
    
    if (!event.eventData || typeof event.eventData !== 'object') {
      errors.push('eventData is required and must be an object');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
};

// ====================================================================
// Event Store Helpers - Pre-defined events
// ====================================================================

export const EventHelpers = {
  /**
   * Tạo event cho voucher created
   */
  voucherCreated: async (voucher, userId, metadata = {}) => {
    return EventStore.append({
      eventType: 'VOUCHER_CREATED',
      category: EVENT_STORE_CONFIG.CATEGORIES.VOUCHER,
      companyId: voucher.company_id,
      userId,
      eventData: {
        voucher_id: voucher.id,
        voucher_number: voucher.voucher_number,
        voucher_type: voucher.voucher_type,
        voucher_date: voucher.voucher_date,
        amount: voucher.amount,
        currency: voucher.currency
      },
      metadata,
      severity: EVENT_STORE_CONFIG.SEVERITY.INFO
    });
  },
  
  /**
   * Tạo event cho voucher posted
   */
  voucherPosted: async (voucher, userId, metadata = {}) => {
    return EventStore.append({
      eventType: 'VOUCHER_POSTED',
      category: EVENT_STORE_CONFIG.CATEGORIES.ACCOUNTING,
      companyId: voucher.company_id,
      userId,
      eventData: {
        voucher_id: voucher.id,
        voucher_number: voucher.voucher_number,
        posted_at: new Date().toISOString()
      },
      metadata,
      severity: EVENT_STORE_CONFIG.SEVERITY.INFO
    });
  },
  
  /**
   * Tạo event cho AI suggestion
   */
  aiSuggestionCreated: async (suggestion, userId, metadata = {}) => {
    return EventStore.append({
      eventType: 'AI_SUGGESTION_CREATED',
      category: EVENT_STORE_CONFIG.CATEGORIES.AI,
      companyId: suggestion.company_id,
      userId,
      eventData: {
        suggestion_id: suggestion.id,
        suggestion_type: suggestion.type,
        field: suggestion.field,
        suggested_value: suggestion.suggested_value,
        confidence: suggestion.confidence,
        is_critical: suggestion.is_critical,
        requires_approval: suggestion.requires_approval
      },
      metadata,
      severity: suggestion.is_critical 
        ? EVENT_STORE_CONFIG.SEVERITY.WARNING 
        : EVENT_STORE_CONFIG.SEVERITY.INFO
    });
  },
  
  /**
   * Tạo event cho AI suggestion approved
   */
  aiSuggestionApproved: async (suggestion, approverId, metadata = {}) => {
    return EventStore.append({
      eventType: 'AI_SUGGESTION_APPROVED',
      category: EVENT_STORE_CONFIG.CATEGORIES.AI,
      companyId: suggestion.company_id,
      userId: approverId,
      eventData: {
        suggestion_id: suggestion.id,
        field: suggestion.field,
        approved_value: suggestion.suggested_value
      },
      metadata,
      severity: EVENT_STORE_CONFIG.SEVERITY.INFO
    });
  },
  
  /**
   * Tạo event cho API call
   */
  apiCalled: async (req, responseStatus, metadata = {}) => {
    return EventStore.append({
      eventType: 'API_CALLED',
      category: EVENT_STORE_CONFIG.CATEGORIES.API,
      companyId: req.user?.activeCompanyId || 0,
      userId: req.user?.id,
      eventData: {
        method: req.method,
        path: req.path,
        query: req.query,
        status: responseStatus,
        user_agent: req.get('user-agent')
      },
      metadata: {
        ...metadata,
        ip_address: req.ip || req.connection.remoteAddress,
        source: 'api_gateway'
      },
      severity: responseStatus >= 400 
        ? EVENT_STORE_CONFIG.SEVERITY.ERROR 
        : EVENT_STORE_CONFIG.SEVERITY.INFO
    });
  },
  
  /**
   * Tạo event cho user action
   */
  userAction: async (userId, companyId, action, details = {}, metadata = {}) => {
    return EventStore.append({
      eventType: `USER_${action.toUpperCase()}`,
      category: EVENT_STORE_CONFIG.CATEGORIES.USER,
      companyId,
      userId,
      eventData: details,
      metadata,
      severity: EVENT_STORE_CONFIG.SEVERITY.INFO
    });
  }
};

export default EventStore;