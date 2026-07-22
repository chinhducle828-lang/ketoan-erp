/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * AI Service Authentication Middleware
 * Xác thực nội bộ giữa Backend và AI Service
 */

/**
 * Middleware xác thực yêu cầu từ AI Service
 * Sử dụng Shared Secret để xác thực
 */
export const requireAIAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Yêu cầu xác thực. Thiếu Authorization header!' 
    });
  }
  
  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const expectedSecret = process.env.AI_INTERNAL_SECRET;
  
  if (!expectedSecret) {
    console.error('[aiAuth] AI_INTERNAL_SECRET not configured in environment');
    return res.status(500).json({ 
      error: 'Lỗi cấu hình máy chủ nội bộ!' 
    });
  }
  
  if (token !== expectedSecret) {
    console.warn('[aiAuth] Invalid AI service token attempt from IP:', req.ip);
    return res.status(403).json({ 
      error: 'Truy cập bị từ chối. Token xác thực AI Service không hợp lệ!' 
    });
  }
  
  next();
};

/**
 * Middleware xác thực khi Backend gọi AI Service
 * Thêm Authorization header vào request
 */
export const addAIAuthHeader = (headers = {}) => {
  const secret = process.env.AI_INTERNAL_SECRET;
  if (secret) {
    return {
      ...headers,
      'Authorization': `Bearer ${secret}`
    };
  }
  return headers;
};

export default { requireAIAuth, addAIAuthHeader };