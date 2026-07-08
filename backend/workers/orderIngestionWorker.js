/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * orderIngestionWorker - Worker xử lý đơn hàng với retry/backoff/DLQ
 */

import { Worker } from 'bullmq';
import { redis } from '../cache/redis.js';
import { getOrderIngestionRules } from '../config/businessRules.js';
import { ingestOrderToVoucher } from '../services/orderIngestion.service.js';
import logger from '../utils/logger.js';

const { queueName: orderIngestionQueueName } = getOrderIngestionRules();

export const orderIngestionWorker = new Worker(
  orderIngestionQueueName,
  async (job) => {
    const { order, userId, traceId } = job.data;
    
    // Log bắt đầu xử lý
    logger.info({ 
      traceId, 
      jobId: job.id, 
      orderNumber: order?.order_number,
      attempt: job.attemptsMade 
    }, 'Order ingestion job started');
    
    if (!order || !order.company_id || !order.order_number) {
      throw new Error('Dữ liệu job không hợp lệ');
    }

    const result = await ingestOrderToVoucher(order, userId);
    return result;
  },
  {
    connection: redis,
    concurrency: 10,
    // Retry tối đa 5 lần
    attempts: 5,
    // Exponential backoff: 2s, 4s, 8s, 16s, 32s
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    // Dead letter queue - không drop tin nhắn
    deadLetterPolicy: {
      maxFailedAttempts: 5
    }
  }
);

orderIngestionWorker.on('completed', (job) => {
  logger.info({ 
    jobId: job.id, 
    orderNumber: job.data.order?.order_number 
  }, 'Order ingestion job completed');
});

orderIngestionWorker.on('failed', (job, err) => {
  logger.error({ 
    jobId: job.id, 
    orderNumber: job.data.order?.order_number,
    error: err.message,
    attemptsMade: job.attemptsMade
  }, 'Order ingestion job failed');
});

orderIngestionWorker.on('error', (err) => {
  logger.error({ error: err.message }, 'Order ingestion worker error');
});

export default orderIngestionWorker;
