/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { randomUUID } from 'crypto';

const sagaStore = new Map();
const SAGA_TTL_MS = 24 * 60 * 60 * 1000; // 24 giờ
const MAX_SAGA_STORE_SIZE = 1000;

// Cleanup job chạy mỗi giờ để xóa saga cũ
let sagaCleanupInterval = null;

const cleanupOldSagas = () => {
  const now = Date.now();
  const toDelete = [];
  
  for (const [sagaId, saga] of sagaStore.entries()) {
    // Xóa saga đã hoàn thành hoặc failed quá 24h
    if ((saga.state === 'succeeded' || saga.state === 'failed') && 
        (now - (saga.completedAt || now) > SAGA_TTL_MS)) {
      toDelete.push(sagaId);
    }
  }
  
  toDelete.forEach(id => sagaStore.delete(id));
  
  if (toDelete.length > 0) {
    console.log(`[SagaStore] Đã dọn dẹp ${toDelete.length} saga cũ`);
  }
  
  // Giới hạn kích thước store
  if (sagaStore.size > MAX_SAGA_STORE_SIZE) {
    const entries = Array.from(sagaStore.entries());
    const toRemove = entries.slice(0, entries.length - MAX_SAGA_STORE_SIZE);
    toRemove.forEach(([id]) => sagaStore.delete(id));
    console.log(`[SagaStore] Đã xóa ${toRemove.length} saga để giới hạn kích thước`);
  }
};

export const startSagaCleanup = () => {
  if (sagaCleanupInterval) return;
  
  // Chạy cleanup mỗi 1 giờ
  sagaCleanupInterval = setInterval(cleanupOldSagas, 60 * 60 * 1000);
  console.log('[SagaStore] Đã khởi động cleanup job');
};

export const stopSagaCleanup = () => {
  if (sagaCleanupInterval) {
    clearInterval(sagaCleanupInterval);
    sagaCleanupInterval = null;
    console.log('[SagaStore] Đã dừng cleanup job');
  }
};

export const createSaga = ({ sagaId = randomUUID(), steps = [], compensations = [] } = {}) => ({
  id: sagaId,
  steps,
  compensations,
  state: 'started',
  createdAt: Date.now()
});

export const clearSagaState = () => {
  sagaStore.clear();
};

export const runSaga = async ({ sagaId = randomUUID(), steps = [], compensations = [] }) => {
  const saga = createSaga({ sagaId, steps, compensations });
  sagaStore.set(saga.id, saga);

  try {
    for (const step of steps) {
      if (step?.execute) {
        await step.execute();
      }
    }

    saga.state = 'succeeded';
    saga.completedAt = Date.now();
    sagaStore.set(saga.id, saga);
    return { sagaId: saga.id, status: 'succeeded' };
  } catch (error) {
    saga.state = 'failed';
    saga.error = error.message;
    saga.completedAt = Date.now();
    sagaStore.set(saga.id, saga);

    for (const compensation of compensations) {
      if (compensation?.execute) {
        try {
          await compensation.execute();
        } catch (compensationError) {
          saga.compensationError = compensationError.message;
          sagaStore.set(saga.id, saga);
        }
      }
    }

    return { sagaId: saga.id, status: 'failed', error: error.message };
  }
};

export const getSagaState = (sagaId) => sagaStore.get(sagaId) || null;

// Auto-start cleanup khi module được load
if (import.meta.url === `file://${process.argv[1]}`) {
  startSagaCleanup();
}
