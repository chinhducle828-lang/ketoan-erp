/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * logger - Pino structured JSON logger
 * Thay thế console.log/error để sẵn sàng đẩy ELK/Datadog
 */

import pino from 'pino';

// Tạo logger instance
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' 
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss DD/MM/yyyy',
          ignore: 'pid,hostname'
        }
      }
    : undefined,
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname
    })
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    app: 'ketoan-erp',
    env: process.env.NODE_ENV || 'development'
  }
});

export default logger;

// Các hàm helper
export const logInfo = (msg, obj = {}) => logger.info(obj, msg);
export const logError = (msg, obj = {}) => logger.error(obj, msg);
export const logWarn = (msg, obj = {}) => logger.warn(obj, msg);
export const logDebug = (msg, obj = {}) => logger.debug(obj, msg);