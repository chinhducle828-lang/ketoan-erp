/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * routes/workflows.js - CRUD + Execute cho User-Defined Workflows
 * 
 * Endpoints:
 *   GET    /api/workflows?company_id=X
 *   POST   /api/workflows
 *   PUT    /api/workflows/:id
 *   DELETE /api/workflows/:id
 *   POST   /api/workflows/:id/execute
 *   GET    /api/workflows/instances?company_id=X
 *   POST   /api/workflows/instances/:id/approve
 *   POST   /api/workflows/instances/:id/reject
 */

import { Router } from 'express';
import { pool } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { 
  getWorkflows, 
  createWorkflowInstance, 
  processWorkflowInstance,
  getWorkflowInstances 
} from '../services/workflowEngine.service.js';
import { processPendingInstances, getPendingApprovals } from '../services/workflowExecutor.service.js';

const router = Router();

// GET /api/workflows - Lấy danh sách workflows
router.get('/', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.user?.activeCompanyId;
    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id' });
    }

    const { rows } = await pool.query(
      `SELECT id, workflow_name, workflow_code, trigger_event, trigger_conditions, steps, variables,
              is_active, priority, created_at, updated_at
       FROM workflows
       WHERE company_id = $1
       ORDER BY priority DESC, created_at DESC`,
      [companyId]
    );

    const workflows = rows.map(r => ({
      ...r,
      trigger_conditions: typeof r.trigger_conditions === 'string' ? JSON.parse(r.trigger_conditions) : r.trigger_conditions,
      steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : r.steps,
      variables: typeof r.variables === 'string' ? JSON.parse(r.variables) : r.variables
    }));

    res.json({ success: true, data: workflows });
  } catch (err) {
    console.error('❌ Lỗi lấy workflows:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workflows - Tạo workflow mới
router.post('/', authenticate, requireRole('admin', 'ktt'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { company_id, workflow_name, workflow_code, description, trigger_event, trigger_conditions, steps, variables, priority } = req.body;
    const companyId = company_id || req.user?.activeCompanyId;

    if (!companyId || !workflow_name || !workflow_code || !trigger_event || !steps) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id, workflow_name, workflow_code, trigger_event, steps' });
    }

    const { rows } = await client.query(
      `INSERT INTO workflows (company_id, workflow_name, workflow_code, description, trigger_event, trigger_conditions, steps, variables, priority, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        companyId,
        workflow_name,
        workflow_code,
        description || null,
        trigger_event,
        JSON.stringify(trigger_conditions || {}),
        JSON.stringify(steps),
        JSON.stringify(variables || {}),
        priority || 0,
        req.user?.id
      ]
    );

    res.status(201).json({
      success: true,
      message: `Tạo workflow "${workflow_name}" thành công`,
      data: { id: rows[0].id }
    });
  } catch (err) {
    console.error('❌ Lỗi tạo workflow:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/workflows/:id - Cập nhật workflow
router.put('/:id', authenticate, requireRole('admin', 'ktt'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { workflow_name, workflow_code, description, trigger_event, trigger_conditions, steps, variables, priority, is_active } = req.body;

    const updates = [];
    const params = [];
    let paramCount = 0;

    if (workflow_name !== undefined) { paramCount++; updates.push(`workflow_name = $${paramCount}`); params.push(workflow_name); }
    if (workflow_code !== undefined) { paramCount++; updates.push(`workflow_code = $${paramCount}`); params.push(workflow_code); }
    if (description !== undefined) { paramCount++; updates.push(`description = $${paramCount}`); params.push(description); }
    if (trigger_event !== undefined) { paramCount++; updates.push(`trigger_event = $${paramCount}`); params.push(trigger_event); }
    if (trigger_conditions !== undefined) { paramCount++; updates.push(`trigger_conditions = $${paramCount}`); params.push(JSON.stringify(trigger_conditions)); }
    if (steps !== undefined) { paramCount++; updates.push(`steps = $${paramCount}`); params.push(JSON.stringify(steps)); }
    if (variables !== undefined) { paramCount++; updates.push(`variables = $${paramCount}`); params.push(JSON.stringify(variables)); }
    if (priority !== undefined) { paramCount++; updates.push(`priority = $${paramCount}`); params.push(priority); }
    if (is_active !== undefined) { paramCount++; updates.push(`is_active = $${paramCount}`); params.push(is_active); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'Không có trường nào để cập nhật' });
    }

    paramCount++; updates.push(`updated_at = NOW()`);
    params.push(id);

    await client.query(
      `UPDATE workflows SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      params
    );

    res.json({ success: true, message: 'Cập nhật workflow thành công' });
  } catch (err) {
    console.error('❌ Lỗi cập nhật workflow:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/workflows/:id - Xóa workflow (soft delete)
router.delete('/:id', authenticate, requireRole('admin', 'ktt'), async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      'UPDATE workflows SET is_active = FALSE, updated_at = NOW() WHERE id = $1',
      [id]
    );

    res.json({ success: true, message: 'Đã xóa workflow (soft delete)' });
  } catch (err) {
    console.error('❌ Lỗi xóa workflow:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workflows/:id/execute - Thực thi workflow
router.post('/:id/execute', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { trigger_data } = req.body;
    const companyId = req.query.company_id || req.user?.activeCompanyId;

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id' });
    }

    const instanceId = await createWorkflowInstance(id, trigger_data || {}, companyId, req.user?.id);
    const result = await processWorkflowInstance(instanceId);

    res.json({
      success: true,
      message: 'Workflow executed',
      instance_id: instanceId,
      ...result
    });
  } catch (err) {
    console.error('❌ Lỗi execute workflow:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workflows/instances - Lấy danh sách workflow instances
router.get('/instances', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.user?.activeCompanyId;
    const status = req.query.status;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id' });
    }

    const instances = await getWorkflowInstances(companyId, { status, limit, offset });

    res.json({ success: true, data: instances });
  } catch (err) {
    console.error('❌ Lỗi lấy workflow instances:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workflows/instances/:id/approve - Phê duyệt
router.post('/instances/:id/approve', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    await pool.query(
      `UPDATE workflow_approvals
       SET status = 'APPROVED', approver_id = $1, comments = $2, approved_at = NOW(), updated_at = NOW()
       WHERE id = $3`,
      [req.user?.id, comments || null, id]
    );

    res.json({ success: true, message: 'Đã phê duyệt' });
  } catch (err) {
    console.error('❌ Lỗi approve workflow:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workflows/instances/:id/reject - Từ chối
router.post('/instances/:id/reject', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { comments } = req.body;

    await pool.query(
      `UPDATE workflow_approvals
       SET status = 'REJECTED', approver_id = $1, comments = $2, approved_at = NOW(), updated_at = NOW()
       WHERE id = $3`,
      [req.user?.id, comments || null, id]
    );

    res.json({ success: true, message: 'Đã từ chối' });
  } catch (err) {
    console.error('❌ Lỗi reject workflow:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
