/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiBatchProcessor.service - Batch Processing
 * Data-driven batch processing from database configuration
 */

import { pool } from '../config/db.js';
import { AppError, ErrorCodes } from '../utils/AppError.js';
import logger from '../utils/logger.js';
import { processDocument } from './aiOcr.service.js';
import { classifyDepartment } from './aiDepartmentClassifier.service.js';
import { getSuggestions } from './aiSmartSuggestions.service.js';

/**
 * Process batch of documents
 * @param {string} configCode - Batch config code from database
 * @param {Array} documents - Array of documents to process
 * @param {string} companyId - Company ID
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Batch processing result
 */
export async function processBatch(configCode, documents, companyId, userId) {
  try {
    // 1. Load batch config from DATABASE (not hardcoded!)
    const configResult = await pool.query(
      'SELECT * FROM ai_batch_configs WHERE config_code = $1 AND is_active = true',
      [configCode]
    );

    if (configResult.rows.length === 0) {
      throw new AppError(ErrorCodes.NOT_FOUND, `Batch config not found: ${configCode}`, 404);
    }

    const config = configResult.rows[0];

    // 2. Validate batch size
    if (documents.length > config.max_batch_size) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        `Batch size exceeds maximum: ${documents.length} > ${config.max_batch_size}`,
        400
      );
    }

    // 3. Initialize batch
    const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const batchContext = {
      batch_id: batchId,
      config_code: configCode,
      company_id: companyId,
      created_by: userId,
      total_documents: documents.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      pending_review: 0,
      results: [],
      errors: [],
      start_time: new Date().toISOString()
    };

    logger.info({
      batchId,
      configCode,
      totalDocuments: documents.length
    }, 'Starting batch processing');

    // 4. Process documents in parallel
    const workers = [];
    const queue = [...documents];
    const semaphore = new Semaphore(config.parallel_workers);

    for (let i = 0; i < documents.length; i++) {
      await semaphore.acquire();
      
      const processPromise = processDocumentBatch(
        queue[i],
        i,
        config,
        companyId,
        batchContext
      ).finally(() => semaphore.release());
      
      workers.push(processPromise);
    }

    // Wait for all workers to complete
    await Promise.all(workers);

    // 5. Calculate results
    batchContext.end_time = new Date().toISOString();
    batchContext.duration = new Date(batchContext.end_time) - new Date(batchContext.start_time);
    batchContext.success_rate = (batchContext.succeeded / batchContext.total_documents) * 100;

    // 6. Save batch history
    await saveBatchHistory(batchContext);

    // 7. Send notifications
    await sendBatchNotifications(batchContext, config);

    logger.info({
      batchId,
      succeeded: batchContext.succeeded,
      failed: batchContext.failed,
      pending_review: batchContext.pending_review
    }, 'Batch processing completed');

    return {
      success: true,
      batch_id: batchId,
      summary: {
        total: batchContext.total_documents,
        succeeded: batchContext.succeeded,
        failed: batchContext.failed,
        pending_review: batchContext.pending_review,
        success_rate: batchContext.success_rate,
        duration: batchContext.duration
      },
      results: batchContext.results,
      errors: batchContext.errors
    };

  } catch (error) {
    logger.error({ error: error.message, configCode }, 'Batch processing failed');
    throw error;
  }
}

/**
 * Process single document in batch
 */
async function processDocumentBatch(document, index, config, companyId, batchContext) {
  try {
    const docResult = {
      index,
      document_id: document.id || `DOC-${index}`,
      status: 'PROCESSING'
    };

    // Step 1: OCR
    if (document.image_base64) {
      const ocrResult = await processDocument(
        document.image_base64,
        document.document_type || 'invoice',
        companyId
      );

      docResult.ocr = ocrResult;
      docResult.confidence = ocrResult.confidence;

      // Check if needs review
      if (ocrResult.confidence < config.confidence_threshold) {
        docResult.status = 'PENDING_REVIEW';
        docResult.reason = `Low confidence: ${ocrResult.confidence}%`;
        batchContext.pending_review++;
        batchContext.results.push(docResult);
        return;
      }

      // Step 2: Classify department
      const classifyResult = await classifyDepartment(ocrResult.data, companyId);
      docResult.department = classifyResult.classification;

      // Step 3: Get suggestions
      const suggestionsResult = await getSuggestions(ocrResult.data, companyId);
      docResult.suggestions = suggestionsResult.suggestions;

      // Check if auto-approve
      if (ocrResult.confidence >= config.auto_approve_threshold) {
        docResult.status = 'AUTO_APPROVED';
        docResult.auto_approved = true;
        batchContext.succeeded++;
      } else {
        docResult.status = 'PENDING_REVIEW';
        batchContext.pending_review++;
      }

      batchContext.processed++;
      batchContext.results.push(docResult);

    } else {
      throw new Error('Missing image_base64');
    }

  } catch (error) {
    logger.error({ error: error.message, index }, 'Document processing failed');
    
    batchContext.failed++;
    batchContext.errors.push({
      index,
      document_id: document.id || `DOC-${index}`,
      error: error.message
    });

    batchContext.results.push({
      index,
      document_id: document.id || `DOC-${index}`,
      status: 'FAILED',
      error: error.message
    });
  }
}

/**
 * Save batch history
 */
async function saveBatchHistory(batchContext) {
  try {
    await pool.query(
      `INSERT INTO ai_workflow_history (
        workflow_id, workflow_type, company_id, steps, final_status, created_by, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        batchContext.batch_id,
        'batch_ocr',
        batchContext.company_id,
        JSON.stringify(batchContext.results),
        batchContext.failed === 0 ? 'COMPLETED' : 'PARTIAL_FAILURE',
        batchContext.created_by,
        batchContext.end_time
      ]
    );
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to save batch history');
  }
}

/**
 * Send batch notifications
 */
async function sendBatchNotifications(batchContext, config) {
  try {
    const notificationChannels = config.notification_channels || ['email'];
    
    const message = `
Batch Processing Completed

Batch ID: ${batchContext.batch_id}
Total Documents: ${batchContext.total_documents}
Succeeded: ${batchContext.succeeded}
Failed: ${batchContext.failed}
Pending Review: ${batchContext.pending_review}
Success Rate: ${batchContext.success_rate.toFixed(2)}%
Duration: ${batchContext.duration}ms

${batchContext.failed > 0 ? `\nFailed Documents:\n${batchContext.errors.map(e => `- ${e.document_id}: ${e.error}`).join('\n')}` : ''}
${batchContext.pending_review > 0 ? `\nDocuments Pending Review: ${batchContext.pending_review}` : ''}
    `.trim();

    // TODO: Implement actual notification sending
    // For now, just log
    logger.info({ message, channels: notificationChannels }, 'Batch notification');

  } catch (error) {
    logger.error({ error: error.message }, 'Failed to send batch notifications');
  }
}

/**
 * Get batch status
 */
export async function getBatchStatus(batchId, companyId) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM ai_workflow_history
       WHERE workflow_id = $1 AND company_id = $2`,
      [batchId, companyId]
    );

    if (rows.length === 0) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Batch not found', 404);
    }

    return rows[0];
  } catch (error) {
    logger.error({ error: error.message, batchId }, 'Failed to get batch status');
    throw error;
  }
}

/**
 * Get batch history
 */
export async function getBatchHistory(companyId, limit = 50, offset = 0) {
  try {
    const { rows } = await pool.query(
      `SELECT 
        workflow_id as batch_id,
        workflow_type,
        steps,
        final_status,
        created_by,
        completed_at,
        created_at
       FROM ai_workflow_history
       WHERE company_id = $1 AND workflow_type = 'batch_ocr'
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [companyId, limit, offset]
    );

    return rows;
  } catch (error) {
    logger.error({ error: error.message, companyId }, 'Failed to get batch history');
    throw error;
  }
}

/**
 * Retry failed documents
 */
export async function retryFailedDocuments(batchId, companyId, userId) {
  try {
    // Get original batch
    const batch = await getBatchStatus(batchId, companyId);
    const steps = batch.steps;
    
    // Filter failed documents
    const failedDocs = steps.filter(s => s.status === 'FAILED');
    
    if (failedDocs.length === 0) {
      return {
        success: true,
        message: 'No failed documents to retry'
      };
    }

    // Get batch config
    const configResult = await pool.query(
      'SELECT * FROM ai_batch_configs WHERE config_code = $1',
      ['invoice_batch']  // Default config
    );

    const config = configResult.rows[0];

    // Retry failed documents
    const retryResults = [];
    for (const doc of failedDocs) {
      try {
        const result = await processDocumentBatch(
          { id: doc.document_id, image_base64: doc.data?.image_base64 },
          doc.index,
          config,
          companyId,
          userId
        );
        retryResults.push(result);
      } catch (error) {
        retryResults.push({
          document_id: doc.document_id,
          status: 'FAILED',
          error: error.message
        });
      }
    }

    return {
      success: true,
      retried: failedDocs.length,
      results: retryResults
    };

  } catch (error) {
    logger.error({ error: error.message, batchId }, 'Failed to retry batch');
    throw error;
  }
}

/**
 * Get all batch configs (for admin UI)
 */
export async function getAllBatchConfigs() {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM ai_batch_configs ORDER BY config_name'
    );
    return rows;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to get batch configs');
    throw error;
  }
}

/**
 * Get batch config by ID
 */
export async function getBatchConfigById(id) {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM ai_batch_configs WHERE id = $1',
      [id]
    );
    return rows[0];
  } catch (error) {
    logger.error({ error: error.message, id }, 'Failed to get batch config');
    throw error;
  }
}

/**
 * Create batch config
 */
export async function createBatchConfig(data) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO ai_batch_configs (
        config_code, config_name, max_batch_size, parallel_workers,
        confidence_threshold, auto_approve_threshold, hitl_required,
        timeout_minutes, notification_channels
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        data.config_code,
        data.config_name,
        data.max_batch_size || 100,
        data.parallel_workers || 5,
        data.confidence_threshold || 90,
        data.auto_approve_threshold || 95,
        data.hitl_required !== false,
        data.timeout_minutes || 60,
        JSON.stringify(data.notification_channels || ['email'])
      ]
    );
    return rows[0];
  } catch (error) {
    logger.error({ error: error.message, data }, 'Failed to create batch config');
    throw error;
  }
}

/**
 * Update batch config
 */
export async function updateBatchConfig(id, data) {
  try {
    const { rows } = await pool.query(
      `UPDATE ai_batch_configs
      SET config_code = $2,
          config_name = $3,
          max_batch_size = $4,
          parallel_workers = $5,
          confidence_threshold = $6,
          auto_approve_threshold = $7,
          hitl_required = $8,
          timeout_minutes = $9,
          notification_channels = $10
      WHERE id = $1
      RETURNING *`,
      [
        id,
        data.config_code,
        data.config_name,
        data.max_batch_size || 100,
        data.parallel_workers || 5,
        data.confidence_threshold || 90,
        data.auto_approve_threshold || 95,
        data.hitl_required !== false,
        data.timeout_minutes || 60,
        JSON.stringify(data.notification_channels || ['email'])
      ]
    );
    return rows[0];
  } catch (error) {
    logger.error({ error: error.message, id, data }, 'Failed to update batch config');
    throw error;
  }
}

/**
 * Delete batch config (soft delete)
 */
export async function deleteBatchConfig(id) {
  try {
    const { rows } = await pool.query(
      'UPDATE ai_batch_configs SET is_active = false WHERE id = $1 RETURNING *',
      [id]
    );
    return rows[0];
  } catch (error) {
    logger.error({ error: error.message, id }, 'Failed to delete batch config');
    throw error;
  }
}

/**
 * Semaphore for controlling parallel execution
 */
class Semaphore {
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent;
    this.current = 0;
    this.queue = [];
  }

  acquire() {
    return new Promise((resolve) => {
      if (this.current < this.maxConcurrent) {
        this.current++;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release() {
    this.current--;
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      this.current++;
      next();
    }
  }
}

export default {
  processBatch,
  getBatchStatus,
  getBatchHistory,
  retryFailedDocuments,
  getAllBatchConfigs,
  getBatchConfigById,
  createBatchConfig,
  updateBatchConfig,
  deleteBatchConfig
};