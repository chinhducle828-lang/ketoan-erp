/**
 * Queue Service - BullMQ Integration
 * Xử lý bất đồng bộ các tác vụ nặng (FIFO, Closing, etc.)
 */

import { Queue, Worker, QueueScheduler } from 'bullmq';
import { redis } from '../cache/redis.js';

// Tạo queue cho các tác vụ nặng
const fifoQueue = new Queue('fifo-calculation', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: true,
    removeOnFail: 100
  }
});

const closingQueue = new Queue('closing-workflow', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: true,
    removeOnFail: 100
  }
});

const orderIngestionQueue = new Queue('order-ingestion', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: true,
    removeOnFail: 100,
    timeout: 120000
  }
});

// Queue scheduler để xử lý delayed jobs
const fifoScheduler = new QueueScheduler('fifo-calculation', { connection: redis });
const closingScheduler = new QueueScheduler('closing-workflow', { connection: redis });
const orderIngestionScheduler = new QueueScheduler('order-ingestion', { connection: redis });

/**
 * Thêm job nhập đơn hàng vào queue
 * @param {Object} data - { order, userId }
 * @returns {Promise<Job>}
 */
export async function addOrderIngestionJob(data) {
  if (redis.status !== 'ready') {
    throw new Error('Redis chưa sẵn sàng để enqueue job');
  }

  return await orderIngestionQueue.add('ingest-order', data, {
    jobId: `order:${data.order.company_id}:${data.order.order_number}`,
    removeOnComplete: true,
    removeOnFail: 100
  });
}

/**
 * Thêm job tính FIFO vào queue
 * @param {Object} data - { companyId, month, year }
 * @returns {Promise<Job>}
 */
export async function addFifoJob(data) {
  if (redis.status !== 'ready') {
    return null;
  }
  
  return await fifoQueue.add('calculate', data, {
    jobId: `fifo:${data.companyId}:${data.year}:${data.month}`,
    timeout: 300000 // 5 phút
  });
}

/**
 * Thêm job kết chuyển vào queue
 * @param {Object} data - { companyId, month, year }
 * @returns {Promise<Job>}
 */
export async function addClosingJob(data) {
  if (redis.status !== 'ready') {
    return null;
  }
  
  return await closingQueue.add('execute', data, {
    jobId: `closing:${data.companyId}:${data.year}:${data.month}`,
    timeout: 600000 // 10 phút
  });
}

/**
 * Tạo worker xử lý FIFO
 * @param {Function} processor - Hàm xử lý job
 */
export function createFifoWorker(processor) {
  return new Worker('fifo-calculation', processor, {
    connection: redis,
    concurrency: 5
  });
}

/**
 * Tạo worker xử lý closing
 * @param {Function} processor - Hàm xử lý job
 */
export function createClosingWorker(processor) {
  return new Worker('closing-workflow', processor, {
    connection: redis,
    concurrency: 2
  });
}

/**
 * Lấy trạng thái job
 * @param {string} jobId - ID job
 * @returns {Promise<Object>}
 */
export async function getJobStatus(queueName, jobId) {
  const queue = queueName === 'fifo' ? fifoQueue : closingQueue;
  
  try {
    const job = await queue.getJob(jobId);
    if (!job) {
      return { status: 'not_found' };
    }
    
    const state = await job.getState();
    const progress = job.progress;
    
    return {
      id: job.id,
      status: state,
      progress: progress,
      data: job.data,
      result: job.returnvalue,
      failedReason: job.failedReason
    };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

export { fifoQueue, closingQueue };