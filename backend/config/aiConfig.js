/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * aiConfig.js - Cấu hình AI thresholds & multi-key pool
 */

import {
  getAiGeminiKeys,
  getAiGroqKeys,
  getAiDeepSeekKeys,
  getAiUseCloudflareProxy,
  getAiCloudflareProxyUrl,
  getAiMaxConcurrentRequests,
  getAiRequestTimeout,
  getAiMaxRetries,
  getAiRetryDelay,
  getAiPythonServiceUrl,
  getAiGeminiModel,
  getAiGroqModel,
  getAiDeepSeekModel,
  getAiGeminiApiKey,
  getAiGroqApiKey,
  getAiDeepSeekApiKey,
  getAiGeminiRateLimitRpm,
  getAiGroqRateLimitRpm,
  getAiDeepSeekRateLimitRpm,
} from '../utils/configHelper.js';

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

  // ============================================
  // MULTI-KEY API POOL CONFIGURATION
  // ============================================
  API_POOL: {
    // Parse multiple Gemini API keys from environment
    GEMINI_KEYS: (process.env.GEMINI_KEYS || '')
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0),
    
    // Parse multiple Groq API keys from environment
    GROQ_KEYS: (process.env.GROQ_KEYS || '')
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0),
    
    // Parse multiple DeepSeek API keys from environment
    DEEPSEEK_KEYS: (process.env.DEEPSEEK_KEYS || '')
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0),
    
    // Cloudflare Proxy for IP masking
    USE_CLOUDFLARE_PROXY: process.env.USE_CLOUDFLARE_PROXY === 'true',
    CLOUDFLARE_PROXY_URL: process.env.CLOUDFLARE_PROXY_URL || '',
    
    // Concurrency settings
    MAX_CONCURRENT_REQUESTS: Number(process.env.MAX_CONCURRENT_REQUESTS) || 5,
    AI_REQUEST_TIMEOUT: Number(process.env.AI_REQUEST_TIMEOUT) || 30000,
    AI_MAX_RETRIES: Number(process.env.AI_MAX_RETRIES) || 3,
    AI_RETRY_DELAY: Number(process.env.AI_RETRY_DELAY) || 1000,
    
    // Rate limits (requests per minute)
    GEMINI_RPM: 15,      // Google free tier
    GROQ_RPM: 30,        // Groq free tier
    DEEPSEEK_RPM: 60,    // DeepSeek free tier (10M tokens/month)
  },

  // Gemini AI Configuration (fallback to single key if pool not configured)
  GEMINI: {
    API_KEY: process.env.GEMINI_API_KEY,
    MODEL: 'gemini-2.5-flash', // Using Gemini 2.5 Flash (latest stable)
    MAX_TOKENS: 8192,
    TEMPERATURE: 0.7,
    RATE_LIMIT_RPM: 15, // Free tier: 15 requests per minute
    RATE_LIMIT_TPM: 1000000, // Free tier: 1M tokens per minute
    TIMEOUT: 30000, // 30 seconds
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000, // 1 second
  },

  // DeepSeek AI Configuration (FREE TIER: 10M tokens/month)
  DEEPSEEK: {
    API_KEY: process.env.DEEPSEEK_API_KEY,
    MODEL: 'deepseek-chat', // DeepSeek-V3 model
    MAX_TOKENS: 4096,
    TEMPERATURE: 0.7,
    RATE_LIMIT_RPM: 60, // Free tier: 60 requests per minute
    TIMEOUT: 30000, // 30 seconds
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
  },

  // GROQ AI Configuration
  GROQ: {
    API_KEY: process.env.GROQ_API_KEY,
    MODEL: 'mixtral-8x7b-32768',
    MAX_TOKENS: 8192,
    TEMPERATURE: 0.7,
    RATE_LIMIT_RPM: 30,
    TIMEOUT: 30000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
  },
};

export async function loadAiConfig(companyId = null) {
  try {
    const [
      geminiKeys,
      groqKeys,
      deepSeekKeys,
      useCloudflareProxy,
      cloudflareProxyUrl,
      maxConcurrentRequests,
      requestTimeout,
      maxRetries,
      retryDelay,
      pythonServiceUrl,
      geminiModel,
      groqModel,
      deepSeekModel,
      geminiApiKey,
      groqApiKey,
      deepSeekApiKey,
      geminiRpm,
      groqRpm,
      deepSeekRpm,
    ] = await Promise.all([
      getAiGeminiKeys(companyId),
      getAiGroqKeys(companyId),
      getAiDeepSeekKeys(companyId),
      getAiUseCloudflareProxy(companyId),
      getAiCloudflareProxyUrl(companyId),
      getAiMaxConcurrentRequests(companyId),
      getAiRequestTimeout(companyId),
      getAiMaxRetries(companyId),
      getAiRetryDelay(companyId),
      getAiPythonServiceUrl(companyId),
      getAiGeminiModel(companyId),
      getAiGroqModel(companyId),
      getAiDeepSeekModel(companyId),
      getAiGeminiApiKey(companyId),
      getAiGroqApiKey(companyId),
      getAiDeepSeekApiKey(companyId),
      getAiGeminiRateLimitRpm(companyId),
      getAiGroqRateLimitRpm(companyId),
      getAiDeepSeekRateLimitRpm(companyId),
    ]);

    AI_CONFIG.API_POOL.GEMINI_KEYS = geminiKeys;
    AI_CONFIG.API_POOL.GROQ_KEYS = groqKeys;
    AI_CONFIG.API_POOL.DEEPSEEK_KEYS = deepSeekKeys;
    AI_CONFIG.API_POOL.USE_CLOUDFLARE_PROXY = useCloudflareProxy;
    AI_CONFIG.API_POOL.CLOUDFLARE_PROXY_URL = cloudflareProxyUrl;
    AI_CONFIG.API_POOL.MAX_CONCURRENT_REQUESTS = maxConcurrentRequests;
    AI_CONFIG.API_POOL.AI_REQUEST_TIMEOUT = requestTimeout;
    AI_CONFIG.API_POOL.AI_MAX_RETRIES = maxRetries;
    AI_CONFIG.API_POOL.AI_RETRY_DELAY = retryDelay;
    AI_CONFIG.API_POOL.GEMINI_RPM = geminiRpm;
    AI_CONFIG.API_POOL.GROQ_RPM = groqRpm;
    AI_CONFIG.API_POOL.DEEPSEEK_RPM = deepSeekRpm;
    AI_CONFIG.PYTHON_SERVICE_URL = pythonServiceUrl;
    
    // Only update if the section exists (handle gracefully)
    if (AI_CONFIG.GEMINI) {
      AI_CONFIG.GEMINI.MODEL = geminiModel || AI_CONFIG.GEMINI.MODEL;
      AI_CONFIG.GEMINI.API_KEY = geminiApiKey || AI_CONFIG.GEMINI.API_KEY;
    }
    if (AI_CONFIG.GROQ) {
      AI_CONFIG.GROQ.MODEL = groqModel || AI_CONFIG.GROQ.MODEL;
      AI_CONFIG.GROQ.API_KEY = groqApiKey || AI_CONFIG.GROQ.API_KEY;
    }
    if (AI_CONFIG.DEEPSEEK) {
      AI_CONFIG.DEEPSEEK.MODEL = deepSeekModel || AI_CONFIG.DEEPSEEK.MODEL;
      AI_CONFIG.DEEPSEEK.API_KEY = deepSeekApiKey || AI_CONFIG.DEEPSEEK.API_KEY;
    }

    return AI_CONFIG;
  } catch (error) {
    console.warn('Failed to load AI config from system settings:', error?.message || error);
    return AI_CONFIG;
  }
}

export default AI_CONFIG;