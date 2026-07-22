/**
 * workflowExecutor.service.js - Workflow Executor
 */

import { pool } from '../config/db.js';
import { triggerWorkflow, getWorkflowInstances } from './workflowEngine.service.js';

async function processPendingInstances(companyId = null) {
  let query = `SELECT id, company_id, workflow_id, trigger_event, trigger_data, context, current_step
    FROM workflow_instances
    WHERE status = 'RUNNING' AND current_step < (
      SELECT COUNT(*) FROM workflow_step_executions WHERE instance_id = workflow_instances.id
    )`;
  const params = [];
  if (companyId) {
    query += ` AND company_id = $${params.length + 1}`;
    params.push(companyId);
  }
  query += ` ORDER BY started_at ASC LIMIT 100`;

  const { rows } = await pool.query(query, params);
  const results = [];

  for (const instance of rows) {
    try {
      const result = await triggerWorkflow(instance.trigger_event, instance.trigger_data, instance.company_id);
      results.push({ instance_id: instance.id, success: true, result });
    } catch (err) {
      results.push({ instance_id: instance.id, success: false, error: err.message });
    }
  }

  return results;
}

async function getPendingApprovals(userId, companyId) {
  const { rows } = await pool.query(
    `SELECT wa.id, wa.instance_id, wa.approver_role, wa.status, wa.comments, wa.created_at,
            w.workflow_name, wi.trigger_data
     FROM workflow_approvals wa
     JOIN workflow_instances wi ON wi.id = wa.instance_id
     JOIN workflows w ON w.id = wi.workflow_id
     WHERE wa.approver_id = $1 AND wa.status = 'PENDING' AND wi.company_id = $2
     ORDER BY wa.created_at DESC`,
    [userId, companyId]
  );
  return rows.map(r => ({
    ...r,
    trigger_data: typeof r.trigger_data === 'string' ? JSON.parse(r.trigger_data) : r.trigger_data
  }));
}

export {
  processPendingInstances,
  getPendingApprovals
};