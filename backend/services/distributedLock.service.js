/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * Distributed Lock Service
 * Sử dụng Redis để triển khai thuật toán Redlock
 * Đảm bảo chỉ một process xử lý cho mỗi resource tại một thời điểm
 */

import { redis } from '../cache/redis.js';
import { randomBytes } from 'crypto';

const DEFAULT_LOCK_TTL = 30000; // 30 giây
const DEFAULT_RETRY_DELAY = 100; // 100ms
const DEFAULT_RETRY_COUNT = 3;

/**
 * Tạo lock key duy nhất
 * @param {string} resource - Tên resource
 * @param {string} companyId - ID công ty (optional)
 * @returns {string}
 */
function buildLockKey(resource, companyId = null) {
  return companyId ? `lock:${resource}:${companyId}` : `lock:${resource}`;
}

/**
 * Lấy distributed lock
 * @param {string} resource - Tên resource cần khóa
 * @param {Object} options - Tùy chọn
 * @param {number} options.ttl - Thời gian lock (ms)
 * @param {number} options.retryCount - Số lần thử lại
 * @param {number} options.retryDelay - Thời gian chờ giữa các lần thử (ms)
 * @param {number} options.companyId - ID công ty (optional)
 * @returns {Promise<Object|null>} - { key, value } hoặc null nếu không lấy được
 */
export async function acquireLock(resource, options = {}) {
  const {
    ttl = DEFAULT_LOCK_TTL,
    retryCount = DEFAULT_RETRY_COUNT,
    retryDelay = DEFAULT_RETRY_DELAY,
    companyId = null
  } = options;

  if (redis.status !== 'ready') {
    return null;
  }

  const lockKey = buildLockKey(resource, companyId);
  const lockValue = randomBytes(16).toString('hex');

  for (let attempt = 0; attempt < retryCount; attempt++) {
    try {
      // Sử dụng SET NX PX để atomic
      const result = await redis.set(lockKey, lockValue, 'NX', 'PX', ttl);
      
      if (result === 'OK' || result === 'ok') {
        return { key: lockKey, value: lockValue };
      }

      // Chờ trước khi thử lại
      if (attempt < retryCount - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    } catch (err) {
      console.error('Lỗi khi lấy lock:', err.message);
    }
  }

  return null;
}

/**
 * Giải phóng distributed lock
 * @param {Object} lock - { key, value } từ acquireLock
 * @returns {Promise<boolean>}
 */
export async function releaseLock(lock) {
  if (!lock || redis.status !== 'ready') {
    return false;
  }

  try {
    // Sử dụng Lua script để đảm bảo chỉ xóa được lock do chính mình tạo
    const luaScript = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;
    
    const result = await redis.eval(luaScript, 1, lock.key, lock.value);
    return result === 1;
  } catch (err) {
    console.error('Lỗi khi giải phóng lock:', err.message);
    return false;
  }
}

/**
 * Thực thi hàm với lock bảo vệ
 * @param {string} resource - Tên resource
 * @param {Function} fn - Hàm cần thực thi
 * @param {Object} options - Tùy chọn lock
 * @returns {Promise<any>} - Kết quả từ hàm fn
 */
export async function withLock(resource, fn, options = {}) {
  const lock = await acquireLock(resource, options);
  
  if (!lock) {
    throw new Error(`Không thể lấy lock cho resource: ${resource}`);
  }

  try {
    return await fn();
  } finally {
    await releaseLock(lock);
  }
}

/**
 * Kiểm tra lock có tồn tại không
 * @param {string} resource - Tên resource
 * @param {number} companyId - ID công ty (optional)
 * @returns {Promise<boolean>}
 */
export async function isLocked(resource, companyId = null) {
  if (redis.status !== 'ready') {
    return false;
  }

  const lockKey = buildLockKey(resource, companyId);
  
  try {
    const exists = await redis.exists(lockKey);
    return exists === 1;
  } catch (err) {
    console.error('Lỗi kiểm tra lock:', err.message);
    return false;
  }
}