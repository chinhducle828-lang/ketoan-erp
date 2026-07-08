/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * correlationId - Middleware gán trace ID cho mỗi request
 * Dùng để theo dõi request từ UI → Worker → DB
 */

import { randomUUID } from 'crypto';

/**
 * Middleware gán correlation ID
 * Ưu tiên lấy từ header 'x-trace-id', nếu không có sẽ tạo mới
 */
export const correlationId = (req, res, next) => {
  // Lấy trace ID từ header hoặc tạo mới
  const traceId = req.headers['x-trace-id'] || 
                  req.headers['x-request-id'] || 
                  randomUUID();
  
  // Gán vào request object
  req.traceId = traceId;
  
  // Gán vào response header để client biết
  res.setHeader('x-trace-id', traceId);
  
  next();
};

export default correlationId;