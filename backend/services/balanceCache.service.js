/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * Balance Cache Service
 * Cache số dư tài khoản qua Redis để đồng bộ giữa các server
 * Sử dụng Redis thay vì Map trong RAM để tránh race condition
 */

import { redis } from '../cache/redis.js';

const DEFAULT_TTL = 300; // 5 phút

/**
 * Lấy balance từ cache hoặc tính toán từ database
 * @param {number} companyId - ID công ty
 * @param {string} year - Năm
 * @param {string} month - Tháng
 * @returns {Promise<Object|null>} - Balance data hoặc null
 */
export async function getBalance(companyId, year, month = null) {
  if (redis.status !== 'ready') {
    return null;
  }

  const cacheKey = month 
    ? `balances:${companyId}:${year}:${month}`
    : `balances:${companyId}:${year}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.error('Lỗi đọc balance cache:', err.message);
  }

  return null;
}

/**
 * Lưu balance vào cache
 * @param {number} companyId - ID công ty
 * @param {string} year - Năm
 * @param {string} month - Tháng (optional)
 * @param {Object} balanceData - Dữ liệu balance
 * @param {number} ttl - Thời gian hết hạn (giây)
 */
export async function setBalance(companyId, year, balanceData, month = null, ttl = DEFAULT_TTL) {
  if (redis.status !== 'ready') {
    return;
  }

  const cacheKey = month 
    ? `balances:${companyId}:${year}:${month}`
    : `balances:${companyId}:${year}`;

  try {
    await redis.setex(cacheKey, ttl, JSON.stringify(balanceData));
  } catch (err) {
    console.error('Lỗi ghi balance cache:', err.message);
  }
}

/**
 * Xóa cache balance khi có thay đổi dữ liệu
 * @param {number} companyId - ID công ty
 * @param {string} year - Năm
 * @param {string} month - Tháng (optional)
 */
export async function invalidateBalance(companyId, year, month = null) {
  if (redis.status !== 'ready') {
    return;
  }

  const pattern = month 
    ? `balances:${companyId}:${year}:${month}`
    : `balances:${companyId}:${year}:*`;

  try {
    const stream = redis.scanStream({
      match: pattern,
      count: 100
    });

    const keysToDelete = [];
    await new Promise((resolve, reject) => {
      stream.on('data', (keys) => keysToDelete.push(...keys));
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    if (keysToDelete.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < keysToDelete.length; i += batchSize) {
        const batch = keysToDelete.slice(i, i + batchSize);
        await redis.del(...batch);
      }
      console.log(`🧹 Đã xóa ${keysToDelete.length} balance cache keys`);
    }
  } catch (err) {
    console.error('Lỗi xóa balance cache:', err.message);
  }
}

/**
 * Xóa toàn bộ cache của một công ty
 * @param {number} companyId - ID công ty
 */
export async function invalidateAllBalances(companyId) {
  if (redis.status !== 'ready') {
    return;
  }

  try {
    await redis.del(`balances:${companyId}:*`);
  } catch (err) {
    console.error('Lỗi xóa toàn bộ balance cache:', err.message);
  }
}