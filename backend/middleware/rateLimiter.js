/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * Rate Limiter Middleware - Redis-based
 * Giới hạn số lượng request từ một IP trong khoảng thời gian nhất định
 * Bảo vệ các endpoint nhạy cảm khỏi brute force và DDoS
 * Sử dụng Redis thay vì Map để đồng bộ giữa các server
 */

import { redis } from '../cache/redis.js';

const WINDOW_MS = 15 * 60 * 1000; // 15 phút
const MAX_REQUESTS = 100; // Tối đa 100 request trong 15 phút

// Cấu hình riêng cho các endpoint nhạy cảm
const SENSITIVE_ENDPOINTS = {
  '/api/auth/login': { maxRequests: 10, windowMs: 15 * 60 * 1000 }, // 10 lần/15 phút
  '/api/auth/register': { maxRequests: 5, windowMs: 60 * 60 * 1000 }, // 5 lần/giờ
  '/api/auth/change-password': { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 lần/giờ
};

/**
 * Middleware rate limiting tổng quát - Redis based
 */
export async function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  
  // Fallback nếu Redis không sẵn sàng
  if (redis.status !== 'ready') {
    return next();
  }

  // Kiểm tra cấu hình đặc biệt cho endpoint nhạy cảm
  const sensitiveConfig = Object.entries(SENSITIVE_ENDPOINTS).find(([path]) => 
    req.path.startsWith(path)
  );
  
  const config = sensitiveConfig 
    ? { maxRequests: sensitiveConfig[1].maxRequests, windowMs: sensitiveConfig[1].windowMs }
    : { maxRequests: MAX_REQUESTS, windowMs: WINDOW_MS };

  const key = `rate_limit:${ip}:${req.path}`;
  const windowSec = Math.ceil(config.windowMs / 1000);
  
  try {
    // Sử dụng Redis atomic increment
    const current = await redis.incr(key);
    
    if (current === 1) {
      // Set TTL lần đầu
      await redis.expire(key, windowSec);
    }
    
    if (current > config.maxRequests) {
      const ttl = await redis.ttl(key);
      console.warn(`⚠️ Rate limit exceeded for IP: ${ip} on ${req.path}`);
      return res.status(429).json({
        error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
        retryAfter: ttl
      });
    }
  } catch (err) {
    console.error('Rate limit error:', err);
  }
  
  next();
}

/**
 * Middleware rate limiting cho API endpoints
 * Sử dụng: app.use('/api', apiRateLimiter);
 */
export async function apiRateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const method = String(req.method || 'GET').toUpperCase();
  const path = String(req.path || req.originalUrl || '/');
  
  // Fallback nếu Redis không sẵn sàng
  if (redis.status !== 'ready') {
    return next();
  }

  // SSE stream giữ kết nối mở lâu dài, không nên tính vào bucket burst ngắn.
  if (method === 'GET' && path.startsWith('/logistics/stream')) {
    return next();
  }

  const key = `rate_limit:api:${ip}:${method}:${path}`;
  const windowSec = 1; // 1 giây
  
  try {
    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, windowSec);
    }
    
    if (current > 30) { // Tối đa 30 request/giây
      return res.status(429).json({
        error: 'Quá nhiều yêu cầu API. Vui lòng giảm tần suất.'
      });
    }
  } catch (err) {
    console.error('API rate limit error:', err);
  }
  
  next();
}

export default rateLimiter;
