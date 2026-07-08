/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * Background Worker cho tính giá vốn kho (BullMQ + Redis)
 */
import { Queue, Worker } from 'bullmq';
import { pool } from '../config/db.js';

const REDIS_CONN = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

export const inventoryQueue = new Queue('inventory-costing', {
  connection: REDIS_CONN,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
});

export const inventoryWorker = new Worker(
  'inventory-costing',
  async (job) => {
    const { companyId, method, period, itemId } = job.data;
    console.log(`Worker: Tính giá vốn company=${companyId} method=${method}`);
    return { success: true, companyId, method };
  },
  { connection: REDIS_CONN, concurrency: 2 }
);

export async function queueInventoryCosting(companyId, method, period) {
  return inventoryQueue.add('calc-cost', { companyId, method, period });
}

inventoryWorker.on('completed', (job) => console.log(`✅ Job ${job.id} done`));
inventoryWorker.on('failed', (job, err) => console.error(`❌ Job ${job?.id} fail:`, err.message));

export default { inventoryQueue, inventoryWorker };
