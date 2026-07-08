/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { Worker } from 'bullmq';
import { redis } from '../cache/redis.js';
import { getOrderIngestionRules } from '../config/businessRules.js';
import { ingestOrderToVoucher } from '../services/orderIngestion.service.js';

const { queueName: orderIngestionQueueName } = getOrderIngestionRules();

export const orderIngestionWorker = new Worker(
  orderIngestionQueueName,
  async (job) => {
    const { order, userId } = job.data;
    if (!order || !order.company_id || !order.order_number) {
      throw new Error('Dữ liệu job không hợp lệ');
    }

    const result = await ingestOrderToVoucher(order, userId);
    return result;
  },
  {
    connection: redis,
    concurrency: 10
  }
);

orderIngestionWorker.on('completed', (job) => {
  console.log(`✅ Order ingestion job ${job.id} completed for order ${job.data.order.order_number}`);
});

orderIngestionWorker.on('failed', (job, err) => {
  console.error(`❌ Order ingestion job ${job.id} failed for order ${job.data.order.order_number}:`, err.message);
});

export default orderIngestionWorker;
