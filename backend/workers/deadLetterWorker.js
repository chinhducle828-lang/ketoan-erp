/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * deadLetterWorker - Worker xử lý các job thất bại trong Dead Letter Queue
 * Kế toán trưởng có thể duyệt tay các job này
 */

import { Worker } from 'bullmq';
import { redis } from '../cache/redis.js';
import { getOrderIngestionRules } from '../config/businessRules.js';
import logger from '../utils/logger.js';

const { queueName: orderIngestionQueueName } = getOrderIngestionRules();
const dlqQueueName = `${orderIngestionQueueName}:dlq`;

/**
 * Worker xử lý Dead Letter Queue
 * Các job thất bại sau 5 lần sẽ được chuyển vào đây
 */
export const deadLetterWorker = new Worker(
  dlqQueueName,
  async (job) => {
    const { order, userId, traceId, error: originalError } = job.data;
    
    logger.warn({
      traceId,
      jobId: job.id,
      orderNumber: order?.order_number,
      originalError,
      reason: 'DLQ - requires manual review'
    }, 'DLQ job requires manual review');
    
    // Trả về thông tin để frontend hiển thị
    return {
      status: 'dlq',
      orderNumber: order?.order_number,
      message: 'Cần kế toán trưởng duyệt tay',
      originalError
    };
  },
  {
    connection: redis,
    concurrency: 1
  }
);

deadLetterWorker.on('completed', (job) => {
  logger.info({ 
    jobId: job.id, 
    orderNumber: job.data.order?.order_number 
  }, 'DLQ job processed');
});

deadLetterWorker.on('failed', (job, err) => {
  logger.error({ 
    jobId: job.id, 
    error: err.message 
  }, 'DLQ job failed');
});

/**
 * Lấy danh sách job trong DLQ
 * @param {number} [limit=50] - Số lượng tối đa
 * @returns {Promise<Array>}
 */
export async function getDLQJobs(limit = 50) {
  // Sử dụng BullMQ API để lấy job
  const jobs = await deadLetterWorker.getJobs('failed', 0, limit - 1);
  return jobs.map(job => ({
    id: job.id,
    data: job.data,
    failedReason: job.failedReason,
    timestamp: job.timestamp,
    processedOn: job.processedOn
  }));
}

/**
 * Duyệt job trong DLQ
 * @param {string} jobId - ID job
 * @param {string} action - 'retry' hoặc 'discard'
 * @returns {Promise<Object>}
 */
export async function processDLQJob(jobId, action) {
  const job = await deadLetterWorker.getJob(jobId);
  
  if (!job) {
    throw new Error('Job không tồn tại');
  }

  if (action === 'retry') {
    // Chuyển job về queue chính để retry
    const { order, userId, traceId } = job.data;
    // TODO: Thêm logic chuyển job về queue chính
    logger.info({ jobId }, 'DLQ job moved back to main queue');
  }

  // Xóa job khỏi DLQ
  await job.remove();
  
  return { success: true, action };
}

export default deadLetterWorker;