/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiQueue.service - Queue xử lý AI job
 * Tích hợp BullMQ cho xử lý bất đồng bộ
 */

import { Queue } from 'bullmq';
import { redis } from '../cache/redis.js';
import logger from '../utils/logger.js';

// Queue cho AI processing
const aiQueue = new Queue('ai-processing', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: 100,
    removeOnFail: 50
  }
});

/**
 * Thêm job xử lý AI vào queue
 * @param {string} type - Loại job: 'ocr', 'proposal', 'analysis'
 * @param {Object} data - Dữ liệu job
 * @param {string} [traceId] - Trace ID
 * @returns {Promise<Object>}
 */
export async function enqueueAIJob(type, data, traceId = null) {
  const job = await aiQueue.add(type, {
    ...data,
    traceId,
    createdAt: new Date().toISOString()
  });

  logger.info({ 
    jobId: job.id, 
    type, 
    traceId 
  }, `AI job enqueued: ${type}`);

  return job;
}

/**
 * Lấy trạng thái job
 * @param {string} jobId - ID job
 * @returns {Promise<Object>}
 */
export async function getAIJobStatus(jobId) {
  const job = await aiQueue.getJob(jobId);
  if (!job) {
    return { status: 'not_found' };
  }

  const state = await job.getState();
  const progress = job.progress;

  return {
    id: job.id,
    type: job.name,
    status: state,
    progress,
    data: job.data,
    attemptsMade: job.attemptsMade,
    finishedOn: job.finishedOn,
    failedReason: job.failedReason
  };
}

/**
 * Lấy danh sách job đang chờ
 * @param {number} [limit=20] - Số lượng
 * @returns {Promise<Array>}
 */
export async function getPendingAIJobs(limit = 20) {
  const jobs = await aiQueue.getJobs('waiting', 0, limit - 1);
  return jobs.map(job => ({
    id: job.id,
    type: job.name,
    data: job.data,
    createdAt: job.data?.createdAt,
    attempts: job.attemptsMade
  }));
}

/**
 * Xóa job
 * @param {string} jobId - ID job
 * @returns {Promise<void>}
 */
export async function removeAIJob(jobId) {
  const job = await aiQueue.getJob(jobId);
  if (job) {
    await job.remove();
    logger.info({ jobId }, 'AI job removed');
  }
}

/**
 * Lấy thống kê queue
 * @returns {Promise<Object>}
 */
export async function getAIQueueStats() {
  const [waiting, active, completed, failed] = await Promise.all([
    aiQueue.getWaitingCount(),
    aiQueue.getActiveCount(),
    aiQueue.getCompletedCount(),
    aiQueue.getFailedCount()
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    total: waiting + active + completed + failed
  };
}

export default {
  enqueueAIJob,
  getAIJobStatus,
  getPendingAIJobs,
  removeAIJob,
  getAIQueueStats
};