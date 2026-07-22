/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import Redis from 'ioredis';
import { mtInvalidateCompany, mtGet, mtSet, mtDel } from './redisMultiTenancy.js';

// Tự động nhận diện chuỗi kết nối từ file .env, nếu không tìm thấy mới dùng localhost làm dự phòng
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Biến flag theo dõi trạng thái kết nối Redis
let isRedisReady = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

// Khởi tạo kết nối thực tế tới hệ thống Redis
export const redis = new Redis(redisUrl, {
  retryStrategy: (times) => {
    // Exponential backoff với giới hạn
    if (times > MAX_RECONNECT_ATTEMPTS) {
      console.warn(`[Redis] Đã vượt quá ${MAX_RECONNECT_ATTEMPTS} lần thử kết nối. Dừng retry.`);
      return null; 
    }
    const delay = Math.min(times * 1000, 30000); // Tối đa 30s
    console.log(`[Redis] Thử kết nối lại lần ${times}, chờ ${delay}ms`);
    return delay;
  },
  maxRetriesPerRequest: 3,
  keepAlive: 30000,
  connectTimeout: 10000,
});

// Bọc lỗi kết nối an toàn để không làm sập tiến trình Node.js
redis.on('error', (err) => {
  isRedisReady = false;
  reconnectAttempts++;
  console.error(`⚠️ [Redis] Lỗi kết nối (lần thử ${reconnectAttempts}):`, err.message);
  console.warn('⚠️ Trạng thái: Redis chưa sẵn sàng (Dữ liệu sẽ chạy trực tiếp qua SQL gốc)');
});

redis.on('connect', () => {
  isRedisReady = true;
  reconnectAttempts = 0;
  console.log('🚀 [Redis] Đã kết nối thành công tới máy chủ cơ sở dữ liệu Redis!');
});

redis.on('ready', () => {
  isRedisReady = true;
  reconnectAttempts = 0;
  console.log('✅ [Redis] Redis đã sẵn sàng nhận kết nối');
});

redis.on('reconnecting', (details) => {
  console.log(`🔄 [Redis] Đang kết nối lại... (attempt ${details.attempt || 'unknown'})`);
});

redis.on('end', () => {
  isRedisReady = false;
  console.warn('🔌 [Redis] Kết nối đã đóng');
});

// Helper function để kiểm tra Redis sẵn sàng
export const isRedisReadyCheck = () => isRedisReady;

// Middleware xử lý Cache thực tế cho các request GET
export const cacheMiddleware = (keyPrefix, ttlSeconds = 300) => {
  return async (req, res, next) => {
    // Chỉ cache các yêu cầu lấy dữ liệu (GET), bỏ qua các hành động tạo/sửa/xóa
    if (req.method !== 'GET') {
      return next();
    }

    // Nếu Redis chưa sẵn sàng hoạt động, cho đi thẳng xuống SQL ngay lập tức
    if (!isRedisReadyCheck()) {
      return next();
    }

    // Multi-tenant cache key with companyId if available
    const companyId = req.user?.activeCompanyId || req.query.company_id;
    const cacheKey = companyId 
      ? `company_${companyId}:${keyPrefix}:${req.originalUrl || req.url}`
      : `${keyPrefix}:${req.originalUrl || req.url}`;
    
    try {
      const cachedData = await mtGet(companyId, keyPrefix, req.originalUrl || req.url);
      if (cachedData) {
        // Nếu có sẵn trong RAM Redis, trả về luôn để trang web tải trong tích tắc
        return res.json(JSON.parse(cachedData));
      }
    } catch (err) {
      console.error('Lỗi đọc Cache:', err.message);
    }

    // Nếu chưa có cache, ghi đè tạm thời res.json để tự lưu dữ liệu sau khi SQL truy vấn xong
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode === 200 && isRedisReadyCheck() && companyId) {
        mtSet(companyId, keyPrefix, req.originalUrl || req.url, data, ttlSeconds).catch((err) => {
          console.error('Lỗi ghi Cache:', err.message);
        });
      } else if (res.statusCode === 200 && isRedisReadyCheck() && !companyId) {
        // Fallback to legacy cache for non-company-specific data
        redis.setex(cacheKey, ttlSeconds, JSON.stringify(data)).catch((err) => {
          console.error('Lỗi ghi Cache:', err.message);
        });
      }
      return originalJson(data);
    };

    next();
  };
};

/**
 * Làm sạch cache một cách có chọn lọc (Selective Invalidation)
 * Sử dụng SCAN thay vì KEYS để tránh blocking Redis
 * @param {string} pattern - Pattern để match keys (ví dụ: 'company:1:year:2026:*')
 * @deprecated Use mtInvalidateCompany(companyId, module) instead for multi-tenant safety
 */
export const invalidateCache = async (pattern) => {
  if (!isRedisReadyCheck()) return;
  
  try {
    const keysToDelete = [];
    
    // Sử dụng scanStream để duyệt từng batch, không blocking
    const stream = redis.scanStream({ 
      match: pattern, 
      count: 100 // Xử lý 100 keys mỗi lần
    });
    
    await new Promise((resolve, reject) => {
      stream.on('data', (resultKeys) => {
        keysToDelete.push(...resultKeys);
      });
      
      stream.on('end', async () => {
        if (keysToDelete.length > 0) {
          // Xóa theo batch để tránh quá tải
          const batchSize = 100;
          for (let i = 0; i < keysToDelete.length; i += batchSize) {
            const batch = keysToDelete.slice(i, i + batchSize);
            await redis.del(...batch);
          }
          console.log(`🧹 Đã xóa ${keysToDelete.length} cache keys cho pattern: ${pattern}`);
        }
        resolve();
      });
      
      stream.on('error', reject);
    });
  } catch (err) {
    console.error('Lỗi làm sạch bộ nhớ tạm Cache:', err.message);
  }
};

/**
 * Multi-tenant cache invalidation - SAFER alternative to invalidateCache
 * @param {number} companyId - Company ID
 * @param {string} module - Module name (e.g., 'voucher', 'report', 'dashboard')
 * @param {string} [resource] - Optional resource type
 */
export const invalidateCompanyCache = async (companyId, module, resource = null) => {
  await mtInvalidateCompany(companyId, module, resource);
};

/**
 * Xóa cache selective theo công ty và kỳ kế toán
 * @param {number} companyId - ID công ty
 * @param {number} year - Năm
 * @param {number} month - Tháng (optional)
 * @deprecated Use mtInvalidateCompany(companyId, 'report', {year, month}) instead
 */
export const invalidateSelectiveCache = async (companyId, year, month = null) => {
  if (!isRedisReadyCheck()) return;
  
  try {
    const resource = month ? `year:${year}:month:${month}` : `year:${year}`;
    await mtInvalidateCompany(companyId, 'report', resource);
  } catch (err) {
    console.error('Lỗi xóa cache selective:', err.message);
  }
};

/**
 * Xóa cache khi có thay đổi dữ liệu chứng từ
 * @param {number} companyId - ID công ty
 * @param {string} voucherDate - Ngày chứng từ (YYYY-MM-DD)
 * @deprecated Use mtInvalidateCompany(companyId, 'voucher') instead
 */
export const invalidateVoucherCache = async (companyId, voucherDate) => {
  if (!isRedisReadyCheck()) return;
  
  try {
    await mtInvalidateCompany(companyId, 'voucher');
  } catch (err) {
    console.error('Lỗi xóa voucher cache:', err.message);
  }
};
