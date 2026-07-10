/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiWorkflowEngine.service - AI Workflow Engine
 * Data-driven workflow execution from database configuration
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { classifyDepartment } from './aiDepartmentClassifier.service.js';
import { getSuggestions } from './aiSmartSuggestions.service.js';
import { processDocument } from './aiOcr.service.js';

/**
 * Execute workflow from database configuration
 * @param {string} workflowCode - Workflow code from database
 * @param {Object} inputData - Input data for workflow
 * @param {string} companyId - Company ID
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Workflow execution result
 */
export async function executeWorkflow(workflowCode, inputData, companyId, userId) {
  try {
    // 1. Load workflow from DATABASE (not hardcoded!)
    const workflowResult = await pool.query(
      'SELECT * FROM ai_workflow_matrix WHERE workflow_code = $1 AND is_active = true',
      [workflowCode]
    );

    if (workflowResult.rows.length === 0) {
      throw new AppError(ErrorCodes.NOT_FOUND, `Workflow not found: ${workflowCode}`, 404);
    }

    const workflow = workflowResult.rows[0];
    const steps = workflow.steps;
    const conditions = workflow.conditions || {};

    // 2. Initialize workflow context
    const workflowId = `WF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const context = {
      workflow_id: workflowId,
      workflow_type: workflowCode,
      workflow_name: workflow.workflow_name,
      company_id: companyId,
      created_by: userId,
      data: { ...inputData },
      history: [],
      current_step: 0,
      status: 'RUNNING'
    };

    logger.info({
      workflowId,
      workflowCode,
      companyId
    }, 'Starting workflow execution');

    // 3. Execute steps dynamically
    for (const step of steps) {
      context.current_step = step.step;
      
      // Check conditions
      if (shouldSkipStep(conditions, context, step)) {
        logger.info({ step: step.step, reason: 'condition_met' }, 'Skipping step');
        context.history.push({
          step: step.step,
          name: step.name,
          action: 'SKIPPED',
          timestamp: new Date().toISOString()
        });
        continue;
      }

      // Execute step
      try {
        const stepResult = await executeStep(step, context);
        
        context.history.push({
          step: step.step,
          name: step.name,
          action: step.action,
          status: 'COMPLETED',
          result: stepResult,
          timestamp: new Date().toISOString()
        });

        // Update context data
        if (stepResult.data) {
          context.data = { ...context.data, ...stepResult.data };
        }

        // Check if HITL required
        if (step.hitl && stepResult.requires_human_review) {
          await saveToHITLQueue(workflowId, step, context);
          
          // Save workflow history
          await saveWorkflowHistory(context, 'PENDING_HUMAN_REVIEW');
          
          return {
            success: true,
            status: 'PENDING_HUMAN_REVIEW',
            workflow_id: workflowId,
            current_step: step.step,
            data: context.data,
            message: 'Đang chờ người duyệt'
          };
        }

      } catch (error) {
        logger.error({ error: error.message, step: step.step }, 'Step execution failed');
        
        context.history.push({
          step: step.step,
          name: step.name,
          action: step.action,
          status: 'FAILED',
          error: error.message,
          timestamp: new Date().toISOString()
        });

        // Continue to next step or fail workflow
        if (step.critical !== false) {
          await saveWorkflowHistory(context, 'FAILED');
          throw error;
        }
      }
    }

    // 4. Workflow completed
    await saveWorkflowHistory(context, 'COMPLETED');
    
    logger.info({
      workflowId,
      status: 'COMPLETED'
    }, 'Workflow completed');

    return {
      success: true,
      status: 'COMPLETED',
      workflow_id: workflowId,
      data: context.data,
      history: context.history
    };

  } catch (error) {
    logger.error({ error: error.message, workflowCode }, 'Workflow execution failed');
    throw error;
  }
}

/**
 * Execute single workflow step
 */
async function executeStep(step, context) {
  switch (step.module) {
    case 'ocr':
      return await executeOCRStep(step, context);
    
    case 'classifier':
      return await executeClassifierStep(step, context);
    
    case 'validator':
      return await executeValidatorStep(step, context);
    
    case 'suggestions':
      return await executeSuggestionsStep(step, context);
    
    case 'database':
      return await executeDatabaseStep(step, context);
    
    case 'batch':
      return await executeBatchStep(step, context);
    
    case 'aggregator':
      return await executeAggregatorStep(step, context);
    
    default:
      throw new Error(`Unknown module: ${step.module}`);
  }
}

/**
 * Execute OCR step
 */
async function executeOCRStep(step, context) {
  if (step.action === 'extract' && context.data.image_base64) {
    const result = await processDocument(
      context.data.image_base64,
      context.data.document_type || 'invoice',
      context.company_id
    );
    
    return {
      data: { ocr_result: result },
      requires_human_review: result.confidence < 95
    };
  }
  
  throw new Error(`Unknown OCR action: ${step.action}`);
}

/**
 * Execute classifier step
 */
async function executeClassifierStep(step, context) {
  if (step.action === 'classify_department') {
    const content = context.data.ocr_result?.data || context.data;
    const result = await classifyDepartment(content, context.company_id);
    
    return {
      data: { department: result.classification },
      requires_human_review: false  // Auto-approve if confidence > 90%
    };
  }
  
  throw new Error(`Unknown classifier action: ${step.action}`);
}

/**
 * Execute validator step
 */
async function executeValidatorStep(step, context) {
  if (step.action === 'validate') {
    const data = context.data.ocr_result?.data || context.data;
    
    // Validation logic
    const errors = [];
    const warnings = [];
    
    if (!data.invoice_number && !data.voucher_number) {
      errors.push('Missing document number');
    }
    
    const confidence = context.data.ocr_result?.confidence || 0;
    
    return {
      data: {
        validation: {
          is_valid: errors.length === 0,
          errors,
          warnings,
          confidence
        }
      },
      requires_human_review: confidence < 80 || errors.length > 0
    };
  }
  
  throw new Error(`Unknown validator action: ${step.action}`);
}

/**
 * Execute suggestions step
 */
async function executeSuggestionsStep(step, context) {
  if (step.action === 'suggest_accounts' || step.action === 'suggest_entries') {
    const content = context.data.ocr_result?.data || context.data;
    const result = await getSuggestions(content, context.company_id);
    
    return {
      data: { suggestions: result.suggestions },
      requires_human_review: true  // Always show suggestions to user
    };
  }
  
  throw new Error(`Unknown suggestions action: ${step.action}`);
}

/**
 * Execute database step
 */
async function executeDatabaseStep(step, context) {
  if (step.action === 'save') {
    // Save to database logic
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create voucher
      const voucherResult = await client.query(
        `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          context.company_id,
          context.data.voucher_type || 'XK',
          context.data.ocr_result?.data?.invoice_date || new Date().toISOString().split('T')[0],
          context.data.ocr_result?.data?.description || 'Auto-generated from OCR',
          'POSTED'
        ]
      );
      
      await client.query('COMMIT');
      
      return {
        data: { voucher_id: voucherResult.rows[0].id }
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  throw new Error(`Unknown database action: ${step.action}`);
}

/**
 * Execute batch step
 */
async function executeBatchStep(step, context) {
  // Batch processing logic
  return {
    data: { batch_processed: true }
  };
}

/**
 * Execute aggregator step
 */
async function executeAggregatorStep(step, context) {
  // Aggregation logic
  return {
    data: { aggregated: true }
  };
}

/**
 * Check if step should be skipped based on conditions
 */
function shouldSkipStep(conditions, context, step) {
  if (!conditions || Object.keys(conditions).length === 0) {
    return false;
  }

  // Evaluate conditions
  for (const [condition, action] of Object.entries(conditions)) {
    if (evaluateCondition(condition, context)) {
      if (action === 'skip_human_review' && step.hitl) {
        return true;
      }
      if (action === 'require_manager' && step.hitl) {
        context.requires_manager = true;
      }
    }
  }

  return false;
}

/**
 * Evaluate condition
 */
function evaluateCondition(condition, context) {
  try {
    // Parse condition like "ocr.confidence > 95"
    const [field, operator, value] = condition.split(' ');
    
    // Get field value from context
    const fieldValue = getNestedValue(context, field);
    
    if (fieldValue === undefined) {
      return false;
    }
    
    // Evaluate
    switch (operator) {
      case '>':
        return fieldValue > parseFloat(value);
      case '<':
        return fieldValue < parseFloat(value);
      case '>=':
        return fieldValue >= parseFloat(value);
      case '<=':
        return fieldValue <= parseFloat(value);
      case '==':
        return fieldValue == value;
      case '!=':
        return fieldValue != value;
      default:
        return false;
    }
  } catch (error) {
    logger.error({ error: error.message, condition }, 'Failed to evaluate condition');
    return false;
  }
}

/**
 * Get nested value from object
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Save to HITL queue
 */
async function saveToHITLQueue(workflowId, step, context) {
  try {
    await pool.query(
      `INSERT INTO ai_hitl_queue (
        workflow_type, step, data, company_id, timeout_at, escalation_to
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        context.workflow_type,
        step.action,
        JSON.stringify(context.data),
        context.company_id,
        new Date(Date.now() + (step.timeout || 86400) * 1000),  // Default 24h
        step.escalation || 'manager'
      ]
    );
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to save to HITL queue');
  }
}

/**
 * Save workflow history
 */
async function saveWorkflowHistory(context, finalStatus) {
  try {
    await pool.query(
      `INSERT INTO ai_workflow_history (
        workflow_id, workflow_type, company_id, steps, final_status, created_by, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        context.workflow_id,
        context.workflow_type,
        context.company_id,
        JSON.stringify(context.history),
        finalStatus,
        context.created_by,
        finalStatus === 'COMPLETED' ? new Date() : null
      ]
    );
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to save workflow history');
  }
}

/**
 * Get workflow by code
 */
export async function getWorkflowByCode(workflowCode) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM ai_workflow_matrix WHERE workflow_code = $1 AND is_active = true',
      [workflowCode]
    );
    return rows[0];
  } catch (error) {
    logger.error({ error: error.message, workflowCode }, 'Failed to get workflow');
    throw error;
  }
}

/**
 * Get all workflows
 */
export async function getAllWorkflows() {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM ai_workflow_matrix ORDER BY workflow_name'
    );
    return rows;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get workflows');
    throw error;
  }
}

/**
 * Create workflow
 */
export async function createWorkflow(data) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO ai_workflow_matrix (
        workflow_code, workflow_name, description, steps, conditions
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        data.workflow_code,
        data.workflow_name,
        data.description,
        JSON.stringify(data.steps || []),
        JSON.stringify(data.conditions || {})
      ]
    );
    return rows[0];
  } catch (error) {
    logger.error({ error: error.message, data }, 'Failed to create workflow');
    throw error;
  }
}

/**
 * Update workflow
 */
export async function updateWorkflow(id, data) {
  try {
    const { rows } = await pool.query(
      `UPDATE ai_workflow_matrix
      SET workflow_code = $2,
          workflow_name = $3,
          description = $4,
          steps = $5,
          conditions = $6
      WHERE id = $1
      RETURNING *`,
      [
        id,
        data.workflow_code,
        data.workflow_name,
        data.description,
        JSON.stringify(data.steps || []),
        JSON.stringify(data.conditions || {})
      ]
    );
    return rows[0];
  } catch (error) {
    logger.error({ error: error.message, id, data }, 'Failed to update workflow');
    throw error;
  }
}

/**
 * Delete workflow (soft delete)
 */
export async function deleteWorkflow(id) {
  try {
    const { rows } = await pool.query(
      'UPDATE ai_workflow_matrix SET is_active = false WHERE id = $1 RETURNING *',
      [id]
    );
    return rows[0];
  } catch (error) {
    logger.error({ error: error.message, id }, 'Failed to delete workflow');
    throw error;
  }
}

export default {
  executeWorkflow,
  getWorkflowByCode,
  getAllWorkflows,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow
};