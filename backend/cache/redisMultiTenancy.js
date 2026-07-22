/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * cache/redisMultiTenancy.js
 * ====================================================================
 * Redis Multi-Tenancy Security Layer
 * ====================================================================
 * 
 * Đảm bảo mọi thao tác Redis đều có company_id prefix để:
 * 1. Ngăn chặn data leakage giữa các công ty
 * 2. Cho phép xóa cache theo company_id một cách an toàn
 * 3. Audit trail đầy đủ cho mọi Redis operation
 * 
 * Nguyên tắc:
 * - KHÔNG BAO GIỜ dùng Redis key mà không có company_id prefix
 * - Tất cả operations đều đi qua layer này
 * - Pattern: company_{companyId}:{module}:{resource}:{id}
 * ====================================================================
 */

import { redis, isRedisReadyCheck } from './redis.js';

// ====================================================================
// Key Builder - Tạo Redis key chuẩn hóa với company_id prefix
// ====================================================================
export const RedisKeyBuilder = {
  /**
   * Tạo key cho voucher cache
   * @param {number} companyId - ID công ty
   * @param {string} voucherId - ID chứng từ
   * @returns {string} Redis key
   */
  voucher: (companyId, voucherId) => 
    `company_${companyId}:voucher:${voucherId}`,

  /**
   * Tạo key pattern cho danh sách voucher theo ngày
   * @param {number} companyId - ID công ty
   * @param {string} date - Ngày (YYYY-MM-DD)
   * @returns {string} Redis key pattern
   */
  voucherByDate: (companyId, date) => 
    `company_${companyId}:vouchers:date:${date}:*`,

  /**
   * Tạo key cho balance cache
   * @param {number} companyId - ID công ty
   * @param {number} year - Năm
   * @param {number} month - Tháng (optional)
   * @param {string} accountCode - Mã tài khoản (optional)
   * @returns {string} Redis key
   */
  balance: (companyId, year, month = null, accountCode = null) => {
    let key = `company_${companyId}:balance:${year}`;
    if (month !== null) key += `:month:${month}`;
    if (accountCode) key += `:account:${accountCode}`;
    return key;
  },

  /**
   * Tạo key pattern cho tất cả balance của 1 công ty
   * @param {number} companyId - ID công ty
   * @returns {string} Redis key pattern
   */
  allBalances: (companyId) => 
    `company_${companyId}:balance:*`,

  /**
   * Tạo key cho report cache
   * @param {number} companyId - ID công ty
   * @param {string} reportType - Loại báo cáo
   * @param {string} reportKey - Key của báo cáo
   * @returns {string} Redis key
   */
  report: (companyId, reportType, reportKey) => 
    `company_${companyId}:report:${reportType}:${reportKey}`,

  /**
   * Tạo key pattern cho tất cả reports của 1 công ty
   * @param {number} companyId - ID công ty
   * @returns {string} Redis key pattern
   */
  allReports: (companyId) => 
    `company_${companyId}:report:*`,

  /**
   * Tạo key cho dashboard cache
   * @param {number} companyId - ID công ty
   * @param {string} dashboardType - Loại dashboard
   * @returns {string} Redis key
   */
  dashboard: (companyId, dashboardType) => 
    `company_${companyId}:dashboard:${dashboardType}`,

  /**
   * Tạo key cho workflow cache
   * @param {number} companyId - ID công ty
   * @param {string} triggerEvent - Trigger event
   * @returns {string} Redis key
   */
  workflow: (companyId, triggerEvent) => 
    `company_${companyId}:workflow:${triggerEvent}`,

  /**
   * Tạo key cho REA event processor cache
   * @param {number} companyId - ID công ty (0 for global)
   * @param {string} eventType - Loại event
   * @returns {string} Redis key
   */
  reaProcessor: (companyId, eventType) => 
    `company_${companyId}:rea_processor:${eventType}`,

  /**
   * Tạo key cho session cache
   * @param {number} companyId - ID công ty
   * @param {string} userId - ID user
   * @returns {string} Redis key
   */
  session: (companyId, userId) => 
    `company_${companyId}:session:${userId}`,

  /**
   * Tạo key cho tenant info cache
   * @param {number} companyId - ID công ty
   * @returns {string} Redis key
   */
  tenantInfo: (companyId) => 
    `company_${companyId}:tenant:info`,

  /**
   * Tạo key cho rate limiting
   * @param {number} companyId - ID công ty
   * @param {string} ip - IP address
   * @param {string} endpoint - Endpoint path
   * @returns {string} Redis key
   */
  rateLimit: (companyId, ip, endpoint) => 
    `company_${companyId}:ratelimit:${ip}:${endpoint}`,

  /**
   * Tạo key cho distributed lock
   * @param {number} companyId - ID công ty
   * @param {string} resource - Resource name
   * @returns {string} Redis key
   */
  lock: (companyId, resource) => 
    `company_${companyId}:lock:${resource}`,

  /**
   * Tạo key pattern để xóa tất cả cache của 1 công ty
   * @param {number} companyId - ID công ty
   * @returns {string} Redis key pattern
   */
  companyPrefix: (companyId) => 
    `company_${companyId}:*`
};

// ====================================================================
// Multi-Tenant Cache Operations
// ====================================================================

/**
 * Lấy giá trị từ cache với company_id isolation
 * @param {number} companyId - ID công ty
 * @param {string} key - Redis key (không cần prefix)
 * @returns {Promise<any|null>} Giá trị cache hoặc null
 */
export async function mtGet(companyId, key) {
  if (!isRedisReadyCheck()) return null;
  
  try {
    const fullKey = typeof key === 'string' && key.startsWith('company_') 
      ? key 
      : RedisKeyBuilder[Object.keys(RedisKeyBuilder).find(k => 
          typeof RedisKeyBuilder[k] === 'function' && 
          RedisKeyBuilder[k](companyId, '').includes(key)
        )]?.(companyId, key) || `company_${companyId}:${key}`;
    
    const cached = await redis.get(fullKey);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.error(`[RedisMultiTenancy] Lỗi đọc cache cho company ${companyId}:`, err.message);
    return null;
  }
}

/**
 * Lưu giá trị vào cache với company_id isolation
 * @param {number} companyId - ID công ty
 * @param {string} key - Redis key (không cần prefix)
 * @param {any} value - Giá trị cần cache
 * @param {number} ttlSeconds - Thời gian sống (giây)
 */
export async function mtSet(companyId, key, value, ttlSeconds = 300) {
  if (!isRedisReadyCheck()) return;
  
  try {
    const fullKey = typeof key === 'string' && key.startsWith('company_')
      ? key
      : `company_${companyId}:${key}`;
    
    await redis.setex(fullKey, ttlSeconds, JSON.stringify(value));
  } catch (err) {
    console.error(`[RedisMultiTenancy] Lỗi ghi cache cho company ${companyId}:`, err.message);
  }
}

/**
 * Xóa 1 key cụ thể của 1 công ty
 * @param {number} companyId - ID công ty
 * @param {string} key - Redis key
 */
export async function mtDel(companyId, key) {
  if (!isRedisReadyCheck()) return;
  
  try {
    const fullKey = typeof key === 'string' && key.startsWith('company_')
      ? key
      : `company_${companyId}:${key}`;
    
    await redis.del(fullKey);
  } catch (err) {
    console.error(`[RedisMultiTenancy] Lỗi xóa cache cho company ${companyId}:`, err.message);
  }
}

/**
 * Xóa tất cả cache của 1 công ty theo pattern
 * @param {number} companyId - ID công ty
 * @param {string} pattern - Pattern bổ sung (optional, ví dụ: 'balance:*')
 */
export async function mtInvalidateCompany(companyId, pattern = '*') {
  if (!isRedisReadyCheck()) return;
  
  try {
    const fullPattern = `company_${companyId}:${pattern}`;
    const keysToDelete = [];
    
    // Sử dụng scanStream để tránh blocking Redis
    const stream = redis.scanStream({ 
      match: fullPattern, 
      count: 100 
    });
    
    await new Promise((resolve, reject) => {
      stream.on('data', (resultKeys) => {
        keysToDelete.push(...resultKeys);
      });
      
      stream.on('end', async () => {
        if (keysToDelete.length > 0) {
          const batchSize = 100;
          for (let i = 0; i < keysToDelete.length; i += batchSize) {
            const batch = keysToDelete.slice(i, i + batchSize);
            await redis.del(...batch);
          }
          console.log(`🧹 [RedisMultiTenancy] Đã xóa ${keysToDelete.length} cache keys cho company ${companyId}`);
        }
        resolve();
      });
      
      stream.on('error', reject);
    });
  } catch (err) {
    console.error(`[RedisMultiTenancy] Lỗi xóa cache cho company ${companyId}:`, err.message);
  }
}

/**
 * Kiểm tra xem key có thuộc về company_id không
 * @param {number} companyId - ID công ty
 * @param {string} key - Redis key
 * @returns {boolean}
 */
export function mtIsCompanyKey(companyId, key) {
  return key.startsWith(`company_${companyId}:`);
}

/**
 * Lấy danh sách tất cả keys của 1 công ty (chỉ để debug/monitoring)
 * @param {number} companyId - ID công ty
 * @returns {Promise<string[]>} Danh sách keys
 */
export async function mtGetCompanyKeys(companyId, limit = 1000) {
  if (!isRedisReadyCheck()) return [];
  
  try {
    const pattern = RedisKeyBuilder.companyPrefix(companyId);
    const keys = [];
    
    // Sử dụng SCAN để lấy keys an toàn
    let cursor = 0;
    const scanCount = 100;
    
    do {
      const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', scanCount);
      cursor = parseInt(result[0]);
      const foundKeys = result[1];
      keys.push(...foundKeys);
      
      if (keys.length >= limit) {
        return keys.slice(0, limit);
      }
    } while (cursor !== 0);
    
    return keys;
  } catch (err) {
    console.error(`[RedisMultiTenancy] Lỗi lấy keys cho company ${companyId}:`, err.message);
    return [];
  }
}

/**
 * Đếm số lượng keys của 1 công ty (để monitoring)
 * @param {number} companyId - ID công ty
 * @returns {Promise<number>} Số lượng keys
 */
export async function mtCountCompanyKeys(companyId) {
  if (!isRedisReadyCheck()) return 0;
  
  try {
    const keys = await mtGetCompanyKeys(companyId, 10000);
    return keys.length;
  } catch (err) {
    console.error(`[RedisMultiTenancy] Lỗi đếm keys cho company ${companyId}:`, err.message);
    return 0;
  }
}

// ====================================================================
// Audit Logging - Ghi log mọi thao tác Redis quan trọng
// ====================================================================

/**
 * Ghi log audit cho Redis operation
 * @param {string} operation - Tên operation (GET, SET, DEL, etc.)
 * @param {number} companyId - ID công ty
 * @param {string} key - Redis key
 * @param {any} metadata - Metadata bổ sung
 */
export function mtAuditLog(operation, companyId, key, metadata = {}) {
  // Chỉ log các operation quan trọng (không log GET để tránh quá nhiều)
  const importantOps = ['SET', 'DEL', 'INVALIDATE', 'LOCK', 'UNLOCK'];
  if (!importantOps.includes(operation.toUpperCase())) return;
  
  const auditEntry = {
    timestamp: new Date().toISOString(),
    operation,
    companyId,
    key: key.substring(0, 100), // Giới hạn độ dài key
    keyPrefix: key.split(':').slice(0, 2).join(':'), // Lấy prefix để dễ đọc
    ...metadata
  };
  
  // Log to console (có thể chuyển sang DB hoặc file sau)
  console.log(`[RedisAudit] ${JSON.stringify(auditEntry)}`);
  
  // TODO: Có thể lưu vào DB hoặc gửi đến logging service
}

// ====================================================================
// Migration Helper - Chuyển đổi từ keys cũ sang keys mới
// ====================================================================

/**
 * Kiểm tra xem key có phải là key cũ (không có prefix) không
 * @param {string} key - Redis key
 * @returns {boolean}
 */
export function mtIsLegacyKey(key) {
  // Keys cũ thường không có pattern company_{id}:
  return !key.startsWith('company_') && 
         !key.startsWith('tenant_') && 
         !key.startsWith('lock:');
}

/**
 * Migration: Sao chép giá trị từ key cũ sang key mới (có prefix)
 * @param {number} companyId - ID công ty
 * @param {string} oldKey - Key cũ
 * @param {string} newKey - Key mới (có prefix)
 */
export async function mtMigrateKey(companyId, oldKey, newKey) {
  if (!isRedisReadyCheck()) return false;
  
  try {
    const value = await redis.get(oldKey);
    if (value) {
      await redis.setex(newKey, 3600, value); // Cache 1 giờ
      console.log(`[RedisMultiTenancy] Đã migrate key từ "${oldKey}" sang "${newKey}"`);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`[RedisMultiTenancy] Lỗi migrate key:`, err.message);
    return false;
  }
}

export default {
  RedisKeyBuilder,
  mtGet,
  mtSet,
  mtDel,
  mtInvalidateCompany,
  mtIsCompanyKey,
  mtGetCompanyKeys,
  mtCountCompanyKeys,
  mtAuditLog,
  mtIsLegacyKey,
  mtMigrateKey
};