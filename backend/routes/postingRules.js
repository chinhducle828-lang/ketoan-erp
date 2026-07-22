/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * routes/postingRules.js - CRUD + Validate cho Dynamic Posting Engine
 * 
 * Endpoints:
 *   GET    /api/posting-rules/:eventType?company_id=X  — Lấy rules
 *   POST   /api/posting-rules                          — Tạo rule mới
 *   PUT    /api/posting-rules/:id                      — Cập nhật rule
 *   DELETE /api/posting-rules/:id                      — Xóa rule
 *   POST   /api/posting-rules/validate                 — Validate + test rule
 *   POST   /api/posting-rules/test                     — Test rule với sample data
 */

import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { 
  getRules, 
  invalidateRulesCache, 
  invalidateAllRulesCache,
  resolveAccount,
  validateRule,
  testRule
} from '../services/dynamicPosting.service.js';

const router = Router();

/**
 * GET /api/posting-rules/:eventType
 * Lấy tất cả rules cho 1 event_type + company_id
 */
router.get('/:eventType', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.user?.activeCompanyId;
    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id' });
    }

    const rules = await getRules(req.params.eventType, companyId);
    res.json({ success: true, data: rules });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/posting-rules
 * Tạo rule mới
 */
router.post('/', authenticate, requireRole('admin', 'ktt'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { company_id, event_type, rule_name, rule_condition, priority, debits, credits, metadata } = req.body;
    const companyId = company_id || req.user?.activeCompanyId;

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id' });
    }
    if (!event_type) {
      return res.status(400).json({ success: false, error: 'Thiếu event_type' });
    }
    if (!rule_name) {
      return res.status(400).json({ success: false, error: 'Thiếu rule_name' });
    }
    if (!debits || !Array.isArray(debits) || debits.length === 0) {
      return res.status(400).json({ success: false, error: 'Phải có ít nhất 1 debit entry' });
    }
    if (!credits || !Array.isArray(credits) || credits.length === 0) {
      return res.status(400).json({ success: false, error: 'Phải có ít nhất 1 credit entry' });
    }

    // Validate rule trước khi lưu
    const sampleData = req.body.sample_data;
    const errors = await validateRule({
      event_type,
      debits,
      credits,
      rule_condition,
      sample_data: sampleData
    }, companyId);

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const { rows } = await client.query(
      `INSERT INTO accounting_posting_rules 
       (company_id, event_type, rule_name, rule_condition, priority, debits, credits, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        companyId,
        event_type,
        rule_name,
        rule_condition ? JSON.stringify(rule_condition) : null,
        priority || 0,
        JSON.stringify(debits),
        JSON.stringify(credits),
        metadata ? JSON.stringify(metadata) : '{}',
        req.user?.id
      ]
    );

    // Invalidate cache
    await invalidateRulesCache(event_type, companyId);

    res.status(201).json({
      success: true,
      message: `Tạo rule "${rule_name}" cho event "${event_type}" thành công`,
      data: { id: rows[0].id }
    });
  } catch (err) {
    console.error('❌ Lỗi tạo posting rule:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/posting-rules/:id
 * Cập nhật rule
 */
router.put('/:id', authenticate, requireRole('admin', 'ktt'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { rule_name, rule_condition, priority, debits, credits, metadata, is_active } = req.body;

    // Lấy rule cũ để biết event_type + company_id (invalidate cache sau)
    const oldRule = await client.query(
      'SELECT event_type, company_id FROM accounting_posting_rules WHERE id = $1',
      [id]
    );
    if (oldRule.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy rule' });
    }

    const updates = [];
    const params = [];
    let paramCount = 0;

    if (rule_name !== undefined) {
      paramCount++; updates.push(`rule_name = $${paramCount}`); params.push(rule_name);
    }
    if (rule_condition !== undefined) {
      paramCount++; updates.push(`rule_condition = $${paramCount}`); params.push(JSON.stringify(rule_condition));
    }
    if (priority !== undefined) {
      paramCount++; updates.push(`priority = $${paramCount}`); params.push(priority);
    }
    if (debits !== undefined) {
      paramCount++; updates.push(`debits = $${paramCount}`); params.push(JSON.stringify(debits));
    }
    if (credits !== undefined) {
      paramCount++; updates.push(`credits = $${paramCount}`); params.push(JSON.stringify(credits));
    }
    if (metadata !== undefined) {
      paramCount++; updates.push(`metadata = $${paramCount}`); params.push(JSON.stringify(metadata));
    }
    if (is_active !== undefined) {
      paramCount++; updates.push(`is_active = $${paramCount}`); params.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'Không có trường nào để cập nhật' });
    }

    paramCount++; updates.push(`updated_at = NOW()`);
    params.push(id);
    paramCount++;

    await client.query(
      `UPDATE accounting_posting_rules SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      params
    );

    // Invalidate cache
    await invalidateRulesCache(oldRule.rows[0].event_type, oldRule.rows[0].company_id);

    res.json({ success: true, message: 'Cập nhật rule thành công' });
  } catch (err) {
    console.error('❌ Lỗi cập nhật posting rule:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/posting-rules/:id
 * Xóa rule (soft delete: set is_active = false)
 */
router.delete('/:id', authenticate, requireRole('admin', 'ktt'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    // Lấy thông tin rule để invalidate cache
    const rule = await client.query(
      'SELECT event_type, company_id FROM accounting_posting_rules WHERE id = $1',
      [id]
    );
    if (rule.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy rule' });
    }

    await client.query(
      'UPDATE accounting_posting_rules SET is_active = FALSE, updated_at = NOW() WHERE id = $1',
      [id]
    );

    // Invalidate cache
    await invalidateRulesCache(rule.rows[0].event_type, rule.rows[0].company_id);

    res.json({ success: true, message: 'Đã xóa rule (soft delete)' });
  } catch (err) {
    console.error('❌ Lỗi xóa posting rule:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/posting-rules/validate
 * Validate rule trước khi lưu (không cần ID)
 */
router.post('/validate', authenticate, async (req, res) => {
  try {
    const companyId = req.body.company_id || req.user?.activeCompanyId;
    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id' });
    }

    const errors = await validateRule(req.body, companyId);

    res.json({
      success: errors.length === 0,
      errors,
      is_valid: errors.length === 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/posting-rules/test
 * Test rule với sample data, trả về entries dự kiến
 */
router.post('/test', authenticate, async (req, res) => {
  try {
    const companyId = req.body.company_id || req.user?.activeCompanyId;
    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id' });
    }

    const { rule, sample_data } = req.body;
    if (!rule) {
      return res.status(400).json({ success: false, error: 'Thiếu rule cần test' });
    }
    if (!sample_data) {
      return res.status(400).json({ success: false, error: 'Thiếu sample_data' });
    }

    const result = await testRule(rule, sample_data, companyId);

    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/posting-rules/resolvers/:resolverName
 * Lấy thông tin 1 resolver
 */
router.get('/resolvers/:resolverName', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.user?.activeCompanyId;
    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id' });
    }

    const accountCode = await resolveAccount(req.params.resolverName, companyId);
    res.json({ success: true, data: { resolver_name: req.params.resolverName, resolved_to: accountCode } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;