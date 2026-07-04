import Redis from 'ioredis';

// Tự động nhận diện chuỗi kết nối từ file .env, nếu không tìm thấy mới dùng localhost làm dự phòng
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Khởi tạo kết nối thực tế tới hệ thống Redis
export const redis = new Redis(redisUrl, {
  retryStrategy: (times) => {
    // Cơ chế phòng vệ: Nếu kết nối thất bại quá 3 lần (như khi chạy local không bật Redis)
    // nó sẽ dừng lại để tránh làm nghẽn hoặc treo đứng toàn bộ server Express của bạn.
    if (times > 3) {
      return null; 
    }
    return Math.min(times * 100, 2000);
  },
  maxRetriesPerRequest: 1,
});

// Bọc lỗi kết nối an toàn để không làm sập tiến trình Node.js
redis.on('error', (err) => {
  console.log('⚠️ Trạng thái: Redis chưa sẵn sàng (Dữ liệu sẽ chạy trực tiếp qua SQL gốc):', err.message);
});

redis.on('connect', () => {
  console.log('🚀 Chúc mừng: Đã kết nối thành công tới máy chủ cơ sở dữ liệu Redis!');
});

// Middleware xử lý Cache thực tế cho các request GET
export const cacheMiddleware = (keyPrefix, ttlSeconds = 300) => {
  return async (req, res, next) => {
    // Chỉ cache các yêu cầu lấy dữ liệu (GET), bỏ qua các hành động tạo/sửa/xóa
    if (req.method !== 'GET') {
      return next();
    }

    // Nếu Redis chưa sẵn sàng hoạt động, cho đi thẳng xuống SQL ngay lập tức
    if (redis.status !== 'ready') {
      return next();
    }

    const cacheKey = `${keyPrefix}:${req.originalUrl || req.url}`;
    
    try {
      const cachedData = await redis.get(cacheKey);
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
      if (res.statusCode === 200 && redis.status === 'ready') {
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
 */
export const invalidateCache = async (pattern) => {
  if (redis.status !== 'ready') return;
  
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
 * Xóa cache selective theo công ty và kỳ kế toán
 * @param {number} companyId - ID công ty
 * @param {number} year - Năm
 * @param {number} month - Tháng (optional)
 */
export const invalidateSelectiveCache = async (companyId, year, month = null) => {
  if (redis.status !== 'ready') return;
  
  try {
    let pattern;
    if (month) {
      pattern = `company:${companyId}:year:${year}:month:${month}:*`;
    } else {
      pattern = `company:${companyId}:year:${year}:*`;
    }
    
    await invalidateCache(pattern);
  } catch (err) {
    console.error('Lỗi xóa cache selective:', err.message);
  }
};

/**
 * Xóa cache khi có thay đổi dữ liệu chứng từ
 * @param {number} companyId - ID công ty
 * @param {string} voucherDate - Ngày chứng từ (YYYY-MM-DD)
 */
export const invalidateVoucherCache = async (companyId, voucherDate) => {
  if (redis.status !== 'ready') return;
  
  try {
    const date = new Date(voucherDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    
    // Chỉ xóa cache của tháng bị ảnh hưởng
    await invalidateSelectiveCache(companyId, year, month);
    
    // Xóa cache danh sách chứng từ
    await invalidateCache(`vouchers:${companyId}:*`);
  } catch (err) {
    console.error('Lỗi xóa voucher cache:', err.message);
  }
};
