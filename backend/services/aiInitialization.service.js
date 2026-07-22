/**
 * AI Service Initialization & Integration Hub
 * Provides unified interface for all AI operations with pool management
 */

import aiApiPool from './aiApiPool.service.js';
import logger from '../utils/logger.js';
import { AI_CONFIG, loadAiConfig } from '../config/aiConfig.js';

/**
 * Initialize AI Services on startup
 * - Validates pool configuration
 * - Checks API key availability
 * - Logs pool status
 */
export async function initializeAIServices() {
  try {
    logger.info('🤖 Initializing AI Services...');

    await loadAiConfig();
    aiApiPool.reloadConfig();

    // Get pool health
    const health = aiApiPool.getHealth();
    
    // Log pool configuration
    logger.info({
      geminiKeys: health.geminiKeys,
      groqKeys: health.groqKeys,
      cloudflareProxy: health.cloudflareProxy,
    }, '✅ AI Pool Health Status');
    
    // Validate configuration
    const stats = aiApiPool.getStats();
    if (stats.geminiKeysAvailable === 0 && stats.groqKeysAvailable === 0) {
      logger.warn('⚠️ No AI API keys configured. AI features will be limited.');
      return false;
    }
    
    logger.info({
      gemini: stats.geminiKeysAvailable,
      groq: stats.groqKeysAvailable,
      maxConcurrent: AI_CONFIG.API_POOL.MAX_CONCURRENT_REQUESTS,
      cloudflareEnabled: AI_CONFIG.API_POOL.USE_CLOUDFLARE_PROXY,
    }, '🎯 AI Services Ready');
    
    return true;
  } catch (error) {
    logger.error({ error: error.message }, '❌ Failed to initialize AI Services');
    return false;
  }
}

/**
 * Get current AI pool status
 */
export function getAIPoolStatus() {
  return {
    health: aiApiPool.getHealth(),
    stats: aiApiPool.getStats(),
    timestamp: new Date(),
  };
}

/**
 * Unified wrapper for all AI operations
 * Routes to appropriate provider based on configuration
 */
export async function callAI(options) {
  const {
    prompt,
    provider = 'gemini',
    model,
    context = {},
    maxRetries = AI_CONFIG.API_POOL.AI_MAX_RETRIES,
  } = options;

  try {
    logger.debug({ provider, model, context }, '📤 AI Service Call');
    
    let response;
    
    if (provider === 'groq') {
      response = await aiApiPool.callGroq(prompt, model, context);
    } else {
      // Default to Gemini
      response = await aiApiPool.callGemini(prompt, model, context);
    }
    
    logger.debug({ provider, tokens: response.promptTokens + response.outputTokens }, '✅ AI Service Response');
    
    return response;
  } catch (error) {
    logger.error({ provider, error: error.message }, '❌ AI Service Call Failed');
    throw error;
  }
}

/**
 * Batch AI operations with parallel execution
 */
export async function batchAI(requests) {
  try {
    const formattedRequests = requests.map(req => ({
      provider: req.provider || 'gemini',
      prompt: req.prompt,
      model: req.model,
      options: req.options || {},
    }));
    
    const results = await aiApiPool.parallelCalls(formattedRequests);
    return results;
  } catch (error) {
    logger.error({ error: error.message }, '❌ Batch AI Failed');
    throw error;
  }
}

export default {
  initializeAIServices,
  getAIPoolStatus,
  callAI,
  batchAI,
  pool: aiApiPool,
};
