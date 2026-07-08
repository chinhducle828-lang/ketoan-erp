/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * errorHandler - Xử lý lỗi tập trung
 * Gắn vào cuối server.js sau tất cả routes
 */

import { AppError } from '../utils/AppError.js';
import logger from '../utils/logger.js';

/**
 * Middleware xử lý lỗi tập trung
 * @param {Error|AppError} err - Lỗi nhận được
 * @param {import('express').Request} req - Request object
 * @param {import('express').Response} res - Response object
 * @param {import('express').NextFunction} next - Next function
 */
export const errorHandler = (err, req, res, next) => {
  // Lấy traceId từ request (nếu có)
  const traceId = req.traceId || 'unknown';
  
  // Log lỗi với cấu trúc
  const errorContext = {
    traceId,
    errorCode: err.errorCode || 'UNKNOWN_ERROR',
    path: req.path,
    method: req.method,
    userId: req.user?.id || null,
    companyId: req.companyId || null,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  };
  
  // Log dựa trên mức độ lỗi
  if (err.statusCode >= 500) {
    logger.error({ ...errorContext, error: err.message, stack: err.stack });
  } else {
    logger.warn({ ...errorContext, error: err.message });
  }
  
  // Xác định status code và error code
  const statusCode = err.statusCode || err.status || 500;
  const errorCode = err.errorCode || 'INTERNAL_ERROR';
  
  // Trả về response chuẩn hoá
  res.status(statusCode).json({
    success: false,
    errorCode,
    message: err.message || 'Lỗi máy chủ nội bộ',
    // Chỉ trả về traceId trong môi trường development
    ...(process.env.NODE_ENV !== 'production' && { traceId })
  });
};

/**
 * Wrapper để bắt lỗi async trong controller
 * @param {Function} fn - Async function
 * @returns {Function} Express middleware
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default errorHandler;