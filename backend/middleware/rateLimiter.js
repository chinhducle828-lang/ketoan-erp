/**
 * Rate Limiter Middleware
 * Giới hạn số lượng request từ một IP trong khoảng thời gian nhất định
 * Bảo vệ các endpoint nhạy cảm khỏi brute force và DDoS
 */

const requestCounts = new Map();
const WINDOW_MS = 15 * 60 * 1000; // 15 phút
const MAX_REQUESTS = 100; // Tối đa 100 request trong 15 phút

// Cấu hình riêng cho các endpoint nhạy cảm
const SENSITIVE_ENDPOINTS = {
  '/api/auth/login': { maxRequests: 10, windowMs: 15 * 60 * 1000 }, // 10 lần/15 phút
  '/api/auth/register': { maxRequests: 5, windowMs: 60 * 60 * 1000 }, // 5 lần/giờ
  '/api/auth/change-password': { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3 lần/giờ
};

/**
 * Middleware rate limiting tổng quát
 */
export function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  // Kiểm tra cấu hình đặc biệt cho endpoint nhạy cảm
  const sensitiveConfig = Object.entries(SENSITIVE_ENDPOINTS).find(([path]) => 
    req.path.startsWith(path)
  );
  
  const config = sensitiveConfig 
    ? { maxRequests: sensitiveConfig[1].maxRequests, windowMs: sensitiveConfig[1].windowMs }
    : { maxRequests: MAX_REQUESTS, windowMs: WINDOW_MS };

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }

  const timestamps = requestCounts.get(ip).filter(ts => now - ts < config.windowMs);
  
  if (timestamps.length >= config.maxRequests) {
    const retryAfter = Math.ceil((config.windowMs - (now - timestamps[0])) / 1000);
    console.warn(`⚠️ Rate limit exceeded for IP: ${ip} on ${req.path}`);
    return res.status(429).json({
      error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
      retryAfter: retryAfter,
      retryAfterSeconds: retryAfter
    });
  }

  timestamps.push(now);
  requestCounts.set(ip, timestamps);

  // Dọn dẹp entries cũ mỗi 15 phút
  if (Math.random() < 0.01) { // 1% probability để tránh overhead
    for (const [key, value] of requestCounts.entries()) {
      const validTimestamps = value.filter(ts => now - ts < WINDOW_MS);
      if (validTimestamps.length === 0) {
        requestCounts.delete(key);
      } else {
        requestCounts.set(key, validTimestamps);
      }
    }
  }

  next();
}

/**
 * Middleware rate limiting cho API endpoints
 * Sử dụng: app.use('/api', apiRateLimiter);
 */
export function apiRateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!requestCounts.has(`api:${ip}`)) {
    requestCounts.set(`api:${ip}`, []);
  }

  const timestamps = requestCounts.get(`api:${ip}`).filter(ts => now - ts < 1000); // 1 giây
  
  if (timestamps.length >= 30) { // Tối đa 30 request/giây
    return res.status(429).json({
      error: 'Quá nhiều yêu cầu API. Vui lòng giảm tần suất.'
    });
  }

  timestamps.push(now);
  requestCounts.set(`api:${ip}`, timestamps);
  next();
}

export default rateLimiter;