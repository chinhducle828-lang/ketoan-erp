/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * routes/events.js - Endpoint duy nhất cho mọi nghiệp vụ
 * POST /api/events — xử lý: validate → calculate → generateEntries → tạo voucher
 */

import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { getEventProcessor, safeCall } from '../core/rea/reaEventMapper.js';
import { ReaEngine } from '../core/rea/reaEngine.js';
import { VoucherService } from '../services/voucher.service.js';
import { getClientIp } from '../services/auditLog.service.js';
import { generateEntries as dynamicGenerateEntries } from '../services/dynamicPosting.service.js';
import { triggerWorkflow } from '../services/workflowEngine.service.js';
import { projectionEngine } from '../server.js';
import { processEvent as dynamicProcessEvent, getEventProcessorDynamic } from '../core/rea/reaProcessorBridge.js';

const router = Router();

async function processSingleEvent(body, user, ipAddress) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { entityType, company_id, dimensions, ...eventData } = body;
    const companyId = company_id || user?.activeCompanyId;

    if (dimensions && typeof dimensions === 'object') {
      eventData.dimensions = dimensions;
    }

    if (!companyId) {
      await client.query('ROLLBACK');
      return { success: false, status: 400, error: 'Thiếu company_id' };
    }

    // ====================================================================
    // Dynamic Processor (DB-driven) with Legacy Fallback
    // ====================================================================
    let processor, calculated, entries;

    // Ưu tiên dùng dynamic processor engine đọc từ DB
    try {
      const result = await dynamicProcessEvent(entityType, eventData, companyId);
      calculated = result.calculatedData;
      entries = result.entries;
      processor = null; // dynamic, không cần processor object
    } catch (dynamicErr) {
      // Fallback về legacy processor hard-code
      processor = getEventProcessor(entityType);

      const validationResult = safeCall(processor.validate, eventData, companyId);
      if (validationResult && typeof validationResult.then === 'function') {
        await validationResult;
      }

      calculated = safeCall(processor.calculate, eventData) || eventData;

      const useDynamicPosting = process.env.USE_DYNAMIC_POSTING === 'true';
      entries = useDynamicPosting
        ? await dynamicGenerateEntries(entityType, calculated, companyId)
        : processor.generateEntries(calculated);
    }

    const voucherId = await VoucherService.create({
      company_id: companyId,
      voucher_number: `${entityType.toUpperCase().slice(0, 8)}-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 4)}`,
      voucher_date: new Date().toISOString().split('T')[0],
      voucher_type: 'PKT',
      description: `${entityType} - ${JSON.stringify(calculated).slice(0, 100)}`,
      currency: 'VND',
      exchange_rate: 1,
      details: entries,
      is_posted: true
    }, {
      client,
      userId: user?.id,
      ipAddress: ipAddress || '0.0.0.0'
    });

    try {
      await triggerWorkflow(entityType, {
        ...calculated,
        voucher_id: voucherId,
        company_id: companyId
      }, companyId, user?.id);
    } catch (err) {
      console.warn(`[Workflow] Warning: ${err.message}`);
    }

    if (projectionEngine && dimensions && Object.keys(dimensions).length > 0) {
      try {
        projectionEngine.projectVoucher(voucherId).catch(err => {
          console.warn(`[Projection] Warning: Failed to project voucher ${voucherId}:`, err.message);
        });
      } catch (err) {
        console.warn(`[Projection] Warning: ${err.message}`);
      }
    }

    const eventId = await ReaEngine.raiseEvent({
      companyId,
      eventType: entityType,
      eventData: calculated,
      resources: [],
      agents: [],
      accountingEntries: entries,
      voucherId,
      createdBy: user?.id
    }, { client });

    await client.query('COMMIT');

    return {
      success: true,
      status: 'completed',
      event_id: eventId,
      message: `Xử lý nghiệp vụ ${entityType} thành công`,
      data: { voucherId, entries },
      entityType,
      company_id: companyId
    };
  } catch (err) {
    await client.query('ROLLBACK');

    try {
      await ReaEngine.raiseEvent({
        companyId: body.company_id || user?.activeCompanyId,
        eventType: body.entityType || 'unknown',
        eventData: body,
        resources: [],
        agents: [],
        accountingEntries: [],
        voucherId: null,
        createdBy: user?.id
      });
    } catch {
      /* ignore */
    }

    if (err.message === 'CREDIT_LIMIT_EXCEEDED' && err.creditCheck) {
      const cc = err.creditCheck;
      return {
        success: false,
        status: 'REJECTED',
        event: 'sale_request',
        reason: `Credit Limit Exceeded! Limit: ${(cc.creditLimit / 1000000).toFixed(0)}M, Total Expected: ${(cc.totalExpected / 1000000).toFixed(0)}M. Shortage: ${(cc.shortage / 1000000).toFixed(0)}M.`,
        action: 'UI_ALERT_RENDERED',
        creditCheck: {
          creditLimit: cc.creditLimit,
          currentDebt: cc.currentDebt,
          newOrderAmount: cc.newOrderAmount,
          totalExpected: cc.totalExpected,
          shortage: cc.shortage,
          partnerName: cc.partnerName
        },
        entityType: body.entityType,
        company_id: body.company_id || user?.activeCompanyId
      };
    }

    return {
      success: false,
      status: 'FAILED',
      error: err.message || 'Lỗi xử lý nghiệp vụ',
      entityType: body.entityType,
      company_id: body.company_id || user?.activeCompanyId
    };
  } finally {
    client.release();
  }
}

/**
 * POST /api/events
 * Xử lý mọi nghiệp vụ (factoring, intercompany, netting, sale, ...)
 * Body: { entityType: 'factoring', company_id: 1, ...data }
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const result = await processSingleEvent(req.body, req.user, getClientIp(req));

    if (result.success) {
      return res.status(201).json(result);
    }

    const statusCode = typeof result.status === 'number'
      ? result.status
      : result.status === 'REJECTED'
        ? 400
        : 500;

    return res.status(statusCode).json(result);
  } catch (err) {
    console.error(`❌ Lỗi xử lý nghiệp vụ ${req.body.entityType}:`, err.message);
    res.status(400).json({
      success: false,
      error: err.message || 'Lỗi xử lý nghiệp vụ',
      entityType: req.body.entityType
    });
  }
});

router.post('/batch', authenticate, async (req, res) => {
  try {
    const events = Array.isArray(req.body?.events) ? req.body.events : [];

    if (events.length === 0) {
      return res.status(400).json({ success: false, error: 'Thiếu danh sách events' });
    }

    const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const results = [];

    for (const eventBody of events) {
      // Process each event independently so one failure does not cancel the whole batch.
      // eslint-disable-next-line no-await-in-loop
      const result = await processSingleEvent(eventBody, req.user, getClientIp(req));
      results.push(result);
    }

    return res.status(200).json({
      success: true,
      batch_id: batchId,
      status: results.some(item => item.status === 'REJECTED' || item.status === 'FAILED') ? 'partial' : 'completed',
      results
    });
  } catch (err) {
    console.error('❌ Lỗi xử lý batch events:', err.message);
    return res.status(500).json({ success: false, error: err.message || 'Lỗi xử lý batch events' });
  }
});

router.get('/:eventId', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.user?.activeCompanyId;
    const { eventId } = req.params;

    const { rows } = await pool.query(
      'SELECT * FROM rea_events WHERE id = $1 AND company_id = $2',
      [eventId, companyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy event' });
    }

    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/events/:eventId/retry
 * Thử lại xử lý một sự kiện thất bại
 */
router.post('/:eventId/retry', authenticate, async (req, res) => {
  try {
    const companyId = req.user?.activeCompanyId;
    const { eventId } = req.params;

    // Lấy thông tin event
    const { rows: eventRows } = await pool.query(
      'SELECT * FROM rea_events WHERE id = $1 AND company_id = $2',
      [eventId, companyId]
    );

    if (eventRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy event' });
    }

    const event = eventRows[0];

    // Cập nhật trạng thái thành PENDING để worker xử lý lại
    await pool.query(
      'UPDATE rea_events SET status = $1, retry_count = retry_count + 1, error_message = NULL, updated_at = NOW() WHERE id = $2',
      ['PENDING', eventId]
    );

    res.json({ 
      success: true, 
      message: 'Đã đặt lại trạng thái sự kiện, hệ thống sẽ xử lý lại',
      data: { eventId, status: 'PENDING' }
    });
  } catch (err) {
    console.error(`❌ Lỗi retry event ${req.params.eventId}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/events/:eventId
 * Xóa một sự kiện
 */
router.delete('/:eventId', authenticate, async (req, res) => {
  try {
    const companyId = req.user?.activeCompanyId;
    const { eventId } = req.params;

    const { rows } = await pool.query(
      'DELETE FROM rea_events WHERE id = $1 AND company_id = $2 RETURNING id',
      [eventId, companyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy event' });
    }

    res.json({ success: true, message: 'Đã xóa sự kiện thành công' });
  } catch (err) {
    console.error(`❌ Lỗi xóa event ${req.params.eventId}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/events - Lấy lịch sử sự kiện
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.user?.activeCompanyId;
    
    if (!companyId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Thiếu company_id. Vui lòng chọn pháp nhân hạch toán.' 
      });
    }

    const events = await ReaEngine.getEvents(companyId, {
      eventType: req.query.event_type,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    });
    
    res.json({ success: true, data: events });
  } catch (err) {
    console.error('❌ Lỗi lấy danh sách events:', err.message);
    res.status(500).json({ 
      success: false, 
      error: err.message || 'Lỗi lấy danh sách sự kiện' 
    });
  }
});

export default router;