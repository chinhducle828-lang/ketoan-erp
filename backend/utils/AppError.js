/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * AppError - Lỗi chuẩn hoá với errorCode
 * Dùng để trả về thông báo lỗi nhất quán từ toàn bộ hệ thống
 */

/**
 * @typedef {Object} AppErrorParams
 * @property {string} errorCode - Mã lỗi chuẩn (VD: VALIDATION_ERROR, NOT_FOUND, UNAUTHORIZED)
 * @property {string} message - Thông báo lỗi người dùng cuối
 * @property {number} [statusCode=500] - HTTP status code
 * @property {Error} [cause] - Nguyên nhân gốc (optional)
 */

export class AppError extends Error {
  /**
   * @param {string} errorCode - Mã lỗi chuẩn hoá
   * @param {string} message - Thông báo lỗi
   * @param {number} [statusCode=500] - HTTP status code
   * @param {Error} [cause] - Nguyên nhân gốc
   */
  constructor(errorCode, message, statusCode = 500, cause) {
    super(message);
    this.name = 'AppError';
    this.errorCode = errorCode;
    this.statusCode = statusCode;
    this.cause = cause;
    
    // Đảm bảo prototype chain đúng
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// Các mã lỗi thường dùng
export const ErrorCodes = {
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  
  // Authentication & Authorization
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // Resource
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  
  // Database
  DB_ERROR: 'DB_ERROR',
  DB_CONNECTION: 'DB_CONNECTION',
  
  // Business Logic
  BUSINESS_RULE: 'BUSINESS_RULE',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  
  // System
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  
  // Queue
  QUEUE_ERROR: 'QUEUE_ERROR',
  JOB_FAILED: 'JOB_FAILED',
  
  // AI/HITL
  AI_CONFIDENCE_LOW: 'AI_CONFIDENCE_LOW',
  HITL_REVIEW_REQUIRED: 'HITL_REVIEW_REQUIRED',
};

export default AppError;