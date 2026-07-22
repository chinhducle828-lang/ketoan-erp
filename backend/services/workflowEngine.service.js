/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * workflowEngine.service.js - Workflow Engine Core
 */

import { pool } from '../config/db.js';
import { redis as redisClient, isRedisReadyCheck } from '../cache/redis.js';

const CACHE_TTL = 300;
const WORKFLOW_CACHE_PREFIX = 'workflow:';

// Lấy workflow cho 1 trigger event
async function getWorkflows(triggerEvent, companyId) {
  const cacheKey = `${WORKFLOW_CACHE_PREFIX}${companyId}:${triggerEvent}`;
  if (isRedisReadyCheck()) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {}
  }
  const { rows } = await pool.query(
    `SELECT id, workflow_name, workflow_code, trigger_event, trigger_conditions, steps, variables
     FROM workflows WHERE company_id = $1 AND trigger_event = $2 AND is_active = TRUE ORDER BY priority DESC`,
    [companyId, triggerEvent]
  );
  const workflows = rows.map(r => ({
    ...r,
    trigger_conditions: typeof r.trigger_conditions === 'string' ? JSON.parse(r.trigger_conditions) : r.trigger_conditions,
    steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : r.steps,
    variables: typeof r.variables === 'string' ? JSON.parse(r.variables) : r.variables
  }));
  if (isRedisReadyCheck()) {
    try { await redisClient.setex(cacheKey, CACHE_TTL, JSON.stringify(workflows)); } catch (e) {}
  }
  return workflows;
}

// Đánh giá điều kiện
function evaluateCondition(condition, payload) {
  if (!condition) return true;
  const func = new Function('payload', `
    try { with (payload) { return (${condition}); } } catch (e) { return false; }
  `);
  try { return Boolean(func(payload)); } catch (e) { return false; }
}

// Thực thi action
async function executeAction(actionType, actionConfig, context, companyId) {
  switch (actionType) {
    case 'GENERATE_VOUCHER':
      return { success: true, action: 'GENERATE_VOUCHER', data: { ...actionConfig, company_id: companyId } };
    case 'SEND_EMAIL':
      return { success: true, action: 'SEND_EMAIL', data: actionConfig };
    case 'CALL_API':
      return { success: true, action: 'CALL_API', data: actionConfig };
    case 'SET_VARIABLE':
      return { success: true, action: 'SET_VARIABLE', data: actionConfig };
    default:
      return { success: false, action: actionType, error: 'Action type not supported' };
  }
}

// Tạo workflow instance
async function createWorkflowInstance(workflowId, triggerData, companyId, createdBy = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: workflowRows } = await client.query('SELECT * FROM workflows WHERE id = $1', [workflowId]);
    if (workflowRows.length === 0) throw new Error(`Workflow not found: ${workflowId}`);
    const workflow = workflowRows[0];
    const { rows: instanceRows } = await client.query(
      `INSERT INTO workflow_instances (company_id, workflow_id, trigger_event, trigger_data, context, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [companyId, workflowId, workflow.trigger_event, JSON.stringify(triggerData), '{}', createdBy]
    );
    const instanceId = instanceRows[0].id;
    const steps = typeof workflow.steps === 'string' ? JSON.parse(workflow.steps) : workflow.steps;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      await client.query(
        `INSERT INTO workflow_step_executions (instance_id, workflow_id, step_index, step_name, step_type, action_type, input_data, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [instanceId, workflowId, i, step.name, step.type, step.action || null, JSON.stringify({ condition: step.condition }), 'PENDING']
      );
    }
    await client.query('COMMIT');
    return instanceId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
}

// Xử lý 1 step
async function processStep(step, payload, context, companyId) {
  switch (step.type) {
    case 'CONDITION':
      return { success: evaluateCondition(step.condition, payload), step_type: 'CONDITION', condition: step.condition };
    case 'APPROVAL':
      const { rows } = await pool.query(
        `INSERT INTO workflow_approvals (instance_id, step_execution_id, company_id, approver_role, status)
         VALUES ($1, $2, $3, $4, 'PENDING') RETURNING id`,
        [null, null, companyId, step.approver_role]
      );
      return { success: false, step_type: 'APPROVAL', approval_id: rows[0].id, approver_role: step.approver_role };
    case 'ACTION':
      const actionResult = await executeAction(step.action, step.config, context, companyId);
      return { success: actionResult.success, step_type: 'ACTION', action: step.action, ...actionResult };
    case 'NOTIFICATION':
      return { success: true, step_type: 'NOTIFICATION', message: step.message || 'Workflow notification' };
    case 'DELAY':
      return { success: true, step_type: 'DELAY', delay_ms: step.delay_ms || 0 };
    default:
      return { success: false, step_type: step.type, error: `Unknown step type: ${step.type}` };
  }
}

// Xử lý workflow instance
async function processWorkflowInstance(instanceId) {
  const client = await pool.connect();
  try {
    const { rows: instanceRows } = await client.query(
      `SELECT wi.*, w.steps, w.trigger_event FROM workflow_instances wi
       JOIN workflows w ON w.id = wi.workflow_id WHERE wi.id = $1`,
      [instanceId]
    );
    if (instanceRows.length === 0) throw new Error(`Workflow instance not found: ${instanceId}`);
    const instance = instanceRows[0];
    const steps = typeof instance.steps === 'string' ? JSON.parse(instance.steps) : instance.steps;
    const triggerData = typeof instance.trigger_data === 'string' ? JSON.parse(instance.trigger_data) : instance.trigger_data;
    let context = typeof instance.context === 'string' ? JSON.parse(instance.context) : instance.context;

    for (let i = instance.current_step; i < steps.length; i++) {
      const step = steps[i];
      const stepResult = await processStep(step, triggerData, context, instance.company_id);
      await client.query(
        `UPDATE workflow_step_executions SET status = $1, output_data = $2, completed_at = NOW()
         WHERE instance_id = $3 AND step_index = $4`,
        [stepResult.success ? 'SUCCESS' : 'FAILED', JSON.stringify(stepResult), instanceId, i]
      );
      if (stepResult.context) context = { ...context, ...stepResult.context };
      if (step.type === 'CONDITION') {
        if (stepResult.success) {
          if (step.true_action === 'COMPLETE') {
            await client.query(`UPDATE workflow_instances SET status = 'COMPLETED', completed_at = NOW(), context = $1 WHERE id = $2`,
              [JSON.stringify(context), instanceId]);
            return { success: true, status: 'COMPLETED' };
          }
        } else {
          if (step.false_action === 'CANCEL') {
            await client.query(`UPDATE workflow_instances SET status = 'CANCELLED', completed_at = NOW() WHERE id = $1`, [instanceId]);
            return { success: true, status: 'CANCELLED' };
          }
        }
      }
      await client.query(`UPDATE workflow_instances SET current_step = $1, context = $2 WHERE id = $3`,
        [i + 1, JSON.stringify(context), instanceId]);
    }
    await client.query(`UPDATE workflow_instances SET status = 'COMPLETED', completed_at = NOW() WHERE id = $1`, [instanceId]);
    return { success: true, status: 'COMPLETED' };
  } catch (err) {
    await client.query(`UPDATE workflow_instances SET status = 'FAILED', completed_at = NOW() WHERE id = $1`, [instanceId]);
    throw err;
  } finally { client.release(); }
}

// Trigger workflow từ event
async function triggerWorkflow(triggerEvent, payload, companyId, userId = null) {
  const workflows = await getWorkflows(triggerEvent, companyId);
  if (workflows.length === 0) return { success: true, message: 'No workflow found for this event' };
  const workflow = workflows[0];
  const instanceId = await createWorkflowInstance(workflow.id, payload, companyId, userId);
  const result = await processWorkflowInstance(instanceId);
  return { success: true, workflow_id: workflow.id, workflow_name: workflow.workflow_name, instance_id: instanceId, ...result };
}

// Lấy workflow instances
async function getWorkflowInstances(companyId, options = {}) {
  const { status, limit = 50, offset = 0 } = options;
  let query = `SELECT wi.id, wi.workflow_id, wi.trigger_event, wi.status, wi.current_step,
               wi.trigger_data, wi.context, wi.result, wi.started_at, wi.completed_at,
               w.workflow_name, w.workflow_code
               FROM workflow_instances wi JOIN workflows w ON w.id = wi.workflow_id WHERE wi.company_id = $1`;
  const params = [companyId];
  if (status) { query += ` AND wi.status = $${params.length + 1}`; params.push(status); }
  query += ` ORDER BY wi.started_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);
  const { rows } = await pool.query(query, params);
  return rows.map(r => ({
    ...r,
    trigger_data: typeof r.trigger_data === 'string' ? JSON.parse(r.trigger_data) : r.trigger_data,
    context: typeof r.context === 'string' ? JSON.parse(r.context) : r.context,
    result: typeof r.result === 'string' ? JSON.parse(r.result) : r.result
  }));
}

export {
  getWorkflows,
  evaluateCondition,
  executeAction,
  createWorkflowInstance,
  processWorkflowInstance,
  processStep,
  triggerWorkflow,
  getWorkflowInstances
};