/**
 * AI Services Adapter - Universal integration layer for all AI operations
 * Provides simple, consistent interface for using the AI pool across all services
 * 
 * Usage:
 *   import { callAI, batchAI } from './aiAdapter.service.js';
 *   const result = await callAI({ prompt: '...', provider: 'gemini' });
 */

import aiApiPool from './aiApiPool.service.js';
import logger from '../utils/logger.js';
import { AI_CONFIG } from '../config/aiConfig.js';

/**
 * Get appropriate model for provider
 */
function getDefaultModel(provider = 'gemini') {
  if (provider === 'groq') return AI_CONFIG.GROQ.MODEL || 'mixtral-8x7b-32768';
  if (provider === 'deepseek') return AI_CONFIG.DEEPSEEK.MODEL || 'deepseek-chat';
  return AI_CONFIG.GEMINI.MODEL || 'gemini-2.5-flash';
}

/**
 * Call a single AI provider
 * Simple wrapper around pool methods
 */
export async function callAI(options = {}) {
  const {
    prompt,
    provider = 'gemini',
    model,
    temperature,
    maxTokens,
    context = {},
  } = options;

  if (!prompt) {
    throw new Error('Prompt is required');
  }

  const selectedModel = model || getDefaultModel(provider);

  const callOptions = {
    temperature: temperature || AI_CONFIG.GEMINI.TEMPERATURE,
    maxTokens: maxTokens || AI_CONFIG.GEMINI.MAX_TOKENS,
    ...context,
  };

  try {
    if (provider === 'groq') {
      return await aiApiPool.callGroq(prompt, selectedModel, callOptions);
    } else if (provider === 'deepseek') {
      return await aiApiPool.callDeepSeek(prompt, selectedModel, callOptions);
    } else {
      return await aiApiPool.callGemini(prompt, selectedModel, callOptions);
    }
  } catch (error) {
    logger.error({ provider, error: error.message }, 'AI Call failed');
    throw error;
  }
}

/**
 * Call Gemini specifically
 */
export async function callGemini(prompt, options = {}) {
  const { model, temperature, maxTokens, context } = options;
  return callAI({
    prompt,
    provider: 'gemini',
    model: model || AI_CONFIG.GEMINI.MODEL,
    temperature,
    maxTokens,
    context,
  });
}

/**
 * Call Groq specifically
 */
export async function callGroq(prompt, options = {}) {
  const { model, temperature, maxTokens, context } = options;
  return callAI({
    prompt,
    provider: 'groq',
    model: model || 'mixtral-8x7b-32768',
    temperature,
    maxTokens,
    context,
  });
}

/**
 * Execute multiple AI calls in parallel
 */
export async function batchAI(requests = []) {
  if (!Array.isArray(requests) || requests.length === 0) {
    throw new Error('requests must be a non-empty array');
  }

  const formattedRequests = requests.map(req => ({
    provider: req.provider || 'gemini',
    prompt: req.prompt,
    model: req.model || getDefaultModel(req.provider),
    options: {
      temperature: req.temperature,
      maxTokens: req.maxTokens,
      ...req.context,
    },
  }));

  try {
    const results = await aiApiPool.parallelCalls(formattedRequests);
    return results.map((result, index) => ({
      index,
      request: requests[index],
      success: result.status === 'fulfilled',
      data: result.data,
      error: result.error,
    }));
  } catch (error) {
    logger.error({ error: error.message }, 'Batch AI failed');
    throw error;
  }
}

/**
 * Execute multiple requests and wait for all to complete
 * Returns successful results, throws on first error (configurable)
 */
export async function batchAIWaitAll(requests = [], throwOnError = false) {
  const results = await batchAI(requests);

  if (throwOnError) {
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      throw new Error('AI requests failed');
    }
  }

  return results;
}

/**
 * Sequential AI calls (one after another, with results available for next)
 */
export async function chainAI(requests = []) {
  const results = [];

  for (const request of requests) {
    try {
      const result = await callAI(request);
      results.push({
        success: true,
        request,
        data: result,
      });
    } catch (error) {
      results.push({
        success: false,
        request,
        error,
      });
      // Continue with next even if one fails
    }
  }

  return results;
}

/**
 * Get current AI pool health and statistics
 */
export function getPoolStatus() {
  return aiApiPool.getHealth();
}

/**
 * Get AI pool statistics
 */
export function getPoolStats() {
  return aiApiPool.getStats();
}

export default {
  callAI,
  callGemini,
  callGroq,
  batchAI,
  batchAIWaitAll,
  chainAI,
  getPoolStatus,
  getPoolStats,
  pool: aiApiPool,
};
