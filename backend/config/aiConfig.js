/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiConfig.js - Cấu hình AI thresholds
 */

// Cấu hình từ environment variables
export const AI_CONFIG = {
  // Confidence score thresholds
  CONFIDENCE: {
    AUTO_POSTED: Number(process.env.AI_CONFIDENCE_AUTO_POSTED) || 95,
    HUMAN_REVIEW: Number(process.env.AI_CONFIDENCE_HUMAN_REVIEW) || 80,
  },

  // Số tiền thresholds (VND)
  AMOUNT: {
    AUTO_POSTED_MAX: Number(process.env.AI_AMOUNT_AUTO_POSTED_MAX) || 5000000,
    HUMAN_REVIEW_MAX: Number(process.env.AI_AMOUNT_HUMAN_REVIEW_MAX) || 50000000,
  },

  // Cashflow thresholds
  CASHFLOW: {
    LARGE_TRANSACTION: Number(process.env.AI_CASHFLOW_LARGE) || 100000000,
    SHORTAGE_ALERT_DAYS: Number(process.env.AI_CASHFLOW_SHORTAGE_DAYS) || 30,
  },

  // Inventory thresholds
  INVENTORY: {
    LOW_STOCK_DAYS: Number(process.env.AI_INVENTORY_LOW_STOCK_DAYS) || 7,
    OVERSTOCK_DAYS: Number(process.env.AI_INVENTORY_OVERSTOCK_DAYS) || 90,
  },

  // Aging thresholds
  AGING: {
    OVER_30_DAYS: 30,
    OVER_60_DAYS: 60,
    OVER_90_DAYS: 90,
  },

  // Python AI service
  PYTHON_SERVICE_URL: process.env.PYTHON_AI_SERVICE_URL || '',

  // Gemini AI Configuration
  GEMINI: {
    API_KEY: process.env.GEMINI_API_KEY,
    MODEL: 'gemini-2.0-flash-exp',
    MAX_TOKENS: 8192,
    TEMPERATURE: 0.7,
    RATE_LIMIT_RPM: 15, // Free tier: 15 requests per minute
    RATE_LIMIT_TPM: 1000000, // Free tier: 1M tokens per minute
    TIMEOUT: 30000, // 30 seconds
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000, // 1 second
  },
};

export default AI_CONFIG;