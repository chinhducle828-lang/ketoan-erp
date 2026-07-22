/**
 * AI Model Router - Tự động chọn provider/model tốt nhất
 * Dựa trên task type, availability, và performance
 * 
 * Usage:
 *   import { callWithAutoRouting } from './aiModelRouter.service.js';
 *   const result = await callWithAutoRouting({ prompt: 'Tìm tổng doanh thu' });
 */

import { AI_CONFIG } from '../config/aiConfig.js';
import { isGeminiAvailable, isDeepSeekAvailable } from './geminiClient.js';
import logger from '../utils/logger.js';
import aiApiPool from './aiApiPool.service.js';
import { callAI } from './aiAdapter.service.js';

/**
 * Task routing configuration
 * Mỗi task type có primary provider + fallback chain
 */
const TASK_ROUTING = {
  'sql': {
    primary: 'gemini',
    fallbacks: ['deepseek', 'groq'],
    reason: 'Gemini tốt nhất cho SQL generation'
  },
  'math': {
    primary: 'deepseek',
    fallbacks: ['gemini', 'groq'],
    reason: 'DeepSeek mạnh về reasoning và toán học'
  },
  'chat': {
    primary: 'groq',
    fallbacks: ['gemini', 'deepseek'],
    reason: 'Groq nhanh nhất cho chat tổng quát'
  },
  'ocr': {
    primary: 'gemini',
    fallbacks: [],
    reason: 'Chỉ Gemini hỗ trợ vision/OCR'
  },
  'classification': {
    primary: 'deepseek',
    fallbacks: ['groq', 'gemini'],
    reason: 'DeepSeek rẻ và nhanh cho classification'
  },
  'insights': {
    primary: 'gemini',
    fallbacks: ['deepseek', 'groq'],
    reason: 'Gemini tốt nhất cho phân tích dữ liệu sâu'
  }
};

/**
 * Provider availability check functions
 */
const AVAILABILITY_CHECK = {
  'gemini': () => isGeminiAvailable(),
  'groq': () => AI_CONFIG.API_POOL.GROQ_KEYS.length > 0,
  'deepseek': () => isDeepSeekAvailable()
};

/**
 * Phát hiện task type từ prompt và options
 * @param {string} prompt - Câu hỏi/input từ user
 * @param {Object} options - Options có thể chứa taskType, imageBase64, etc.
 * @returns {string} Task type: 'sql' | 'math' | 'chat' | 'ocr' | 'classification' | 'insights'
 */
export function detectTaskType(prompt, options = {}) {
  if (!prompt) return 'chat';
  
  // Nếu có ảnh → OCR
  if (options.imageBase64 || options.taskType === 'ocr') {
    return 'ocr';
  }
  
  // Nếu user chỉ định task type
  if (options.taskType && TASK_ROUTING[options.taskType]) {
    return options.taskType;
  }
  
  const lowerPrompt = prompt.toLowerCase();
  
  // Insights/Analysis detection - MUST come before math to avoid "doanh thu" conflict
  if (/phân tích|đánh giá|nhận xét|dự đoán|xu hướng|insight|so sánh|chênh lệch|tương quan|biến động/.test(lowerPrompt)) {
    return 'insights';
  }
  
  // "Chỉ báo" detection
  if (/chỉ báo|chỉ số|KPI|hiệu suất/.test(lowerPrompt)) {
    return 'insights';
  }
  
  // SQL/Data query detection
  if (/tìm|hiển thị|liệt kê|báo cáo|số liệu|thống kê|danh sách|tổng|bao nhiêu|dữ liệu|bảng|record/.test(lowerPrompt)) {
    return 'sql';
  }
  
  // Math/Finance detection
  if (/tính|giải|toán|phần trăm|%|\d+\s*[+\-*/]\s*\d+|lãi|lợi nhuận|khấu hao|thuế|chi phí|doanh thu/.test(lowerPrompt)) {
    return 'math';
  }
  
  // Classification detection
  if (/phân loại|nhóm|danh mục|loại|category|classify/.test(lowerPrompt)) {
    return 'classification';
  }
  
  // Default: chat
  return 'chat';
}

/**
 * Chọn provider phù hợp nhất dựa trên task type
 * Tự động fallback nếu provider chính không available
 * @param {string} taskType - Loại task
 * @param {string|null} preferredProvider - Provider ưu tiên (nếu có)
 * @returns {string} Provider name: 'gemini' | 'groq' | 'deepseek'
 */
export function selectProvider(taskType, preferredProvider = null) {
  // Nếu user chỉ định provider cụ thể và nó available
  if (preferredProvider && AVAILABILITY_CHECK[preferredProvider]?.()) {
    return preferredProvider;
  }
  
  const routing = TASK_ROUTING[taskType] || TASK_ROUTING.chat;
  
  // Check primary provider
  if (AVAILABILITY_CHECK[routing.primary]?.()) {
    return routing.primary;
  }
  
  // Check fallbacks
  for (const fallback of routing.fallbacks) {
    if (AVAILABILITY_CHECK[fallback]?.()) {
      logger.info({ 
        taskType, 
        primary: routing.primary, 
        fallback,
        reason: routing.reason 
      }, `⚠️ ${routing.primary} not available, falling back to ${fallback}`);
      return fallback;
    }
  }
  
  // Ultimate fallback: try any available provider
  for (const [provider, check] of Object.entries(AVAILABILITY_CHECK)) {
    if (check()) {
      logger.warn({ taskType, provider }, '⚠️ Using last resort provider');
      return provider;
    }
  }
  
  return 'gemini'; // Default
}

/**
 * Gọi AI với tự động routing - function chính
 * Tự động phát hiện task type, chọn provider, và gọi API
 * 
 * @param {Object} options
 * @param {string} options.prompt - Câu hỏi/input
 * @param {string} [options.taskType] - Loại task (tự động detect nếu không có)
 * @param {string} [options.provider] - Provider ưu tiên (tự động chọn nếu không có)
 * @param {string} [options.model] - Model cụ thể (dùng default nếu không có)
 * @param {number} [options.temperature] - Nhiệt độ
 * @param {number} [options.maxTokens] - Max tokens
 * @param {string} [options.imageBase64] - Ảnh base64 (cho OCR)
 * @returns {Promise<Object>} Kết quả từ AI provider
 */
export async function callWithAutoRouting(options = {}) {
  const { 
    prompt, 
    taskType: explicitTaskType, 
    provider: preferredProvider,
    model,
    temperature,
    maxTokens,
    imageBase64,
    ...rest 
  } = options;
  
  if (!prompt) {
    throw new Error('Prompt is required');
  }
  
  // 1. Detect task type
  const taskType = explicitTaskType || detectTaskType(prompt, { imageBase64 });
  
  // 2. Select best provider
  const provider = selectProvider(taskType, preferredProvider);
  
  logger.info({ 
    taskType, 
    provider, 
    routing: TASK_ROUTING[taskType]?.reason || 'default',
    model: model || 'auto'
  }, '🤖 Auto-routing AI request');
  
  // 3. Gọi AI với provider đã chọn
  try {
    const response = await callAI({
      prompt,
      provider,
      model,
      temperature,
      maxTokens,
      context: { ...rest, imageBase64 }
    });
    
    // Thêm metadata về routing
    return {
      ...response,
      routing: {
        taskType,
        provider,
        model: response.model || model || 'auto',
        reason: TASK_ROUTING[taskType]?.reason || 'default'
      }
    };
  } catch (error) {
    // Nếu provider chính lỗi, thử fallback
    const routing = TASK_ROUTING[taskType] || TASK_ROUTING.chat;
    const fallbacks = routing.fallbacks.filter(f => f !== provider);
    
    for (const fallback of fallbacks) {
      if (AVAILABILITY_CHECK[fallback]?.()) {
        logger.warn({ 
          taskType, 
          failedProvider: provider, 
          fallback,
          error: error.message 
        }, '🔄 Primary failed, trying fallback provider');
        
        try {
          const response = await callAI({
            prompt,
            provider: fallback,
            model,
            temperature,
            maxTokens,
            context: { ...rest, imageBase64 }
          });
          
          return {
            ...response,
            routing: {
              taskType,
              provider: fallback,
              model: response.model || model || 'auto',
              reason: `Fallback from ${provider} to ${fallback}`
            }
          };
        } catch (fallbackError) {
          logger.error({ fallback, error: fallbackError.message }, '❌ Fallback also failed');
        }
      }
    }
    
    // All providers failed
    throw error;
  }
}

export default {
  detectTaskType,
  selectProvider,
  callWithAutoRouting,
  TASK_ROUTING
};