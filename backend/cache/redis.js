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

// Hàm làm sạch bộ nhớ đệm khi dữ liệu SQL thay đổi (Thêm/Sửa/Xóa nhân sự, chứng từ...)
export const invalidateCache = async (pattern) => {
  if (redis.status !== 'ready') return;
  
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`🧹 Đã làm mới dữ liệu cache thành công cho khóa: ${pattern}`);
    }
  } catch (err) {
    console.error('Lỗi làm sạch bộ nhớ tạm Cache:', err.message);
  }
};