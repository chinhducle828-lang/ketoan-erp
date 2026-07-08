/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

const OFFLINE_QUEUE_KEY = 'ketoan_offline_queue_v1';
const GET_CACHE_KEY = 'ketoan_get_cache_v1';
const HYBRID_STATE_KEY = 'ketoan_hybrid_state_v1';

const subscribers = new Set();

const safeJsonParse = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const readStorage = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  return safeJsonParse(window.localStorage.getItem(key), fallback);
};

const writeStorage = (key, value) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const nowIso = () => new Date().toISOString();

const getInitialState = () => {
  const saved = readStorage(HYBRID_STATE_KEY, null);
  const pendingCount = getPendingQueueCount();
  return {
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    pendingCount,
    syncing: false,
    lastSyncAt: saved?.lastSyncAt || null,
    lastError: null,
  };
};

let state = getInitialState();

function emitState() {
  state = {
    ...state,
    pendingCount: getPendingQueueCount(),
  };
  writeStorage(HYBRID_STATE_KEY, {
    lastSyncAt: state.lastSyncAt,
  });
  subscribers.forEach((handler) => {
    try {
      handler(state);
    } catch {
      // no-op
    }
  });
}

export function getHybridState() {
  return state;
}

export function subscribeHybridState(handler) {
  subscribers.add(handler);
  handler(state);
  return () => subscribers.delete(handler);
}

export function setHybridOnlineStatus(online) {
  state = {
    ...state,
    online,
  };
  emitState();
}

export function markHybridSyncing(syncing) {
  state = {
    ...state,
    syncing,
  };
  emitState();
}

export function markHybridSynced() {
  state = {
    ...state,
    syncing: false,
    online: true,
    lastError: null,
    lastSyncAt: nowIso(),
  };
  emitState();
}

export function markHybridSyncError(message) {
  state = {
    ...state,
    syncing: false,
    lastError: message || 'Không thể đồng bộ dữ liệu chờ.',
  };
  emitState();
}

export function getPendingQueueCount() {
  const queue = readStorage(OFFLINE_QUEUE_KEY, []);
  return Array.isArray(queue) ? queue.length : 0;
}

export function getOfflineQueue() {
  const queue = readStorage(OFFLINE_QUEUE_KEY, []);
  return Array.isArray(queue) ? queue : [];
}

function setOfflineQueue(queue) {
  writeStorage(OFFLINE_QUEUE_KEY, queue);
  emitState();
}

export function enqueueOfflineRequest(requestConfig) {
  const queue = getOfflineQueue();
  const entry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    url: requestConfig.url,
    method: (requestConfig.method || 'post').toLowerCase(),
    data: requestConfig.data ?? null,
    params: requestConfig.params ?? null,
    headers: requestConfig.headers ?? {},
    enqueuedAt: nowIso(),
    retryCount: 0,
  };

  queue.push(entry);
  setOfflineQueue(queue);
  return entry;
}

const buildCacheKey = (config) => {
  const url = config.url || '';
  const params = config.params ? JSON.stringify(config.params) : '';
  return `${url}::${params}`;
};

export function saveGetCache(config, data) {
  if (!config?.url) return;
  const map = readStorage(GET_CACHE_KEY, {});
  const key = buildCacheKey(config);
  map[key] = {
    data,
    cachedAt: nowIso(),
  };
  writeStorage(GET_CACHE_KEY, map);
}

export function getCachedGet(config) {
  if (!config?.url) return null;
  const map = readStorage(GET_CACHE_KEY, {});
  const key = buildCacheKey(config);
  return map[key]?.data ?? null;
}

let syncInProgress = false;

const isLikelyNetworkError = (error) => {
  if (!error) return false;
  if (error.code === 'ERR_NETWORK') return true;
  if (!error.response && /Network Error/i.test(String(error.message || ''))) return true;
  return false;
};

export async function processOfflineQueue(api, maxBatch = 30) {
  if (syncInProgress) return { processed: 0, remaining: getPendingQueueCount() };
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { processed: 0, remaining: getPendingQueueCount() };

  const queue = getOfflineQueue();
  if (!queue.length) {
    markHybridSynced();
    return { processed: 0, remaining: 0 };
  }

  syncInProgress = true;
  markHybridSyncing(true);

  let processed = 0;
  let remainingQueue = [...queue];

  try {
    const limit = Math.min(maxBatch, remainingQueue.length);
    for (let i = 0; i < limit; i += 1) {
      const item = remainingQueue[0];
      try {
        await api.request({
          url: item.url,
          method: item.method,
          data: item.data,
          params: item.params,
          headers: {
            ...item.headers,
            'X-Offline-Replay': 'true',
          },
          hybridOptions: {
            skipOffline: true,
          },
        });

        remainingQueue.shift();
        processed += 1;
      } catch (error) {
        if (isLikelyNetworkError(error)) {
          break;
        }

        item.retryCount = Number(item.retryCount || 0) + 1;
        item.lastError = error?.response?.data?.message || error?.message || 'Unknown error';

        // Nếu lỗi nghiệp vụ (4xx), bỏ bản ghi khỏi queue để tránh kẹt toàn bộ hàng chờ.
        const status = error?.response?.status;
        if (status >= 400 && status < 500) {
          remainingQueue.shift();
        } else {
          remainingQueue[0] = item;
          break;
        }
      }
    }

    setOfflineQueue(remainingQueue);

    if (remainingQueue.length === 0) {
      markHybridSynced();
    } else {
      markHybridSyncError('Đồng bộ còn gián đoạn, sẽ thử lại khi có mạng ổn định.');
    }

    return { processed, remaining: remainingQueue.length };
  } finally {
    syncInProgress = false;
    markHybridSyncing(false);
  }
}
