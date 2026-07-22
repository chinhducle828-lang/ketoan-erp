import axios from 'axios';
import pLimit from 'p-limit';
import { EventEmitter } from 'events';
import logger from '../utils/logger.js';
import { AI_CONFIG } from '../config/aiConfig.js';

/**
 * AI API Pool Service - Multi-threaded AI API calls with Cloudflare proxy
 * Manages multiple Google Gemini and Groq API keys with load balancing
 * Supports parallel async calls to avoid rate limiting and IP blocking
 */
class AIApiPool extends EventEmitter {
  constructor(config = {}) {
    super();

    this.reloadConfig();
    
    // Statistics
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retriedRequests: 0,
      lastResetTime: Date.now(),
      geminiRequestsThisMin: 0,
      groqRequestsThisMin: 0,
      deepSeekRequestsThisMin: 0,
    };
    
    // Key rotation
    this.geminiKeyIndex = 0;
    this.groqKeyIndex = 0;
    this.deepSeekKeyIndex = 0;
    
    // Per-provider concurrency limiters (isolated to prevent one provider blocking others)
    this.geminiLimiter = pLimit(5);
    this.groqLimiter = pLimit(5);
    this.deepSeekLimiter = pLimit(5);
    
    // Reset rate limits every minute
    setInterval(() => this.resetRateLimits(), 60000);
    
    logger.info({
      geminiKeys: this.geminiKeys.length,
      groqKeys: this.groqKeys.length,
      deepSeekKeys: this.deepSeekKeys.length,
      cloudflareProxy: this.useCloudflareProxy ? '✓' : '✗',
      maxConcurrent: this.maxConcurrentRequests,
      maxRetries: this.maxRetries,
    }, '🤖 AIApiPool initialized');
  }

  reloadConfig() {
    this.geminiKeys = Array.isArray(AI_CONFIG.API_POOL.GEMINI_KEYS)
      ? AI_CONFIG.API_POOL.GEMINI_KEYS
      : [];
    this.groqKeys = Array.isArray(AI_CONFIG.API_POOL.GROQ_KEYS)
      ? AI_CONFIG.API_POOL.GROQ_KEYS
      : [];
    this.deepSeekKeys = Array.isArray(AI_CONFIG.API_POOL.DEEPSEEK_KEYS)
      ? AI_CONFIG.API_POOL.DEEPSEEK_KEYS
      : [];

    this.cloudflareProxy = AI_CONFIG.API_POOL.CLOUDFLARE_PROXY_URL;
    this.useCloudflareProxy = AI_CONFIG.API_POOL.USE_CLOUDFLARE_PROXY;
    this.proxySecretToken = process.env.PROXY_SECRET_TOKEN || '';

    const desiredMaxConcurrent = Number(AI_CONFIG.API_POOL.MAX_CONCURRENT_REQUESTS) || 5;
    if (desiredMaxConcurrent !== this.maxConcurrentRequests) {
      this.maxConcurrentRequests = desiredMaxConcurrent;
      this.limiter = pLimit(this.maxConcurrentRequests);
      // Also update per-provider limiters
      this.geminiLimiter = pLimit(this.maxConcurrentRequests);
      this.groqLimiter = pLimit(this.maxConcurrentRequests);
      this.deepSeekLimiter = pLimit(this.maxConcurrentRequests);
    }

    this.requestTimeout = Number(AI_CONFIG.API_POOL.AI_REQUEST_TIMEOUT) || 30000;
    this.maxRetries = Number(AI_CONFIG.API_POOL.AI_MAX_RETRIES) || 3;
    this.retryDelay = Number(AI_CONFIG.API_POOL.AI_RETRY_DELAY) || 1000;

    this.geminiRPM = Number(AI_CONFIG.API_POOL.GEMINI_RPM) || 15;
    this.groqRPM = Number(AI_CONFIG.API_POOL.GROQ_RPM) || 30;
    this.deepSeekRPM = Number(AI_CONFIG.API_POOL.DEEPSEEK_RPM) || 60;
  }

  async callGemini(prompt, model = 'gemini-2.5-flash', options = {}) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      logger.debug({ requestId, model }, '📤 Calling Gemini');
      
      await this.checkRateLimit('gemini');
      
      let lastError = null;
      for (let attempt = 0; attempt < this.geminiKeys.length; attempt++) {
        try {
          const key = this.getNextGeminiKey();
          const response = await this.callGeminiWithKey(key, prompt, model, options, requestId);
          
          this.stats.successfulRequests++;
          this.stats.geminiRequestsThisMin++;
          
          const duration = Date.now() - startTime;
          logger.debug({ requestId, duration }, '✅ Gemini success');
          
          return response;
        } catch (error) {
          lastError = error;
          logger.warn({ requestId, attempt: attempt + 1, totalKeys: this.geminiKeys.length, error: error.message }, '⚠️ Gemini key failed');
          
          if (attempt < this.geminiKeys.length - 1) {
            await this.sleep(this.retryDelay);
          }
        }
      }
      
      throw lastError;
    } catch (error) {
      this.stats.failedRequests++;
      logger.error({ requestId, error: error.message }, '❌ Gemini failed');
      throw error;
    }
  }

  async callDeepSeek(prompt, model = 'deepseek-chat', options = {}) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      logger.debug({ requestId, model }, '📤 Calling DeepSeek');
      
      await this.checkRateLimit('deepseek');
      
      let lastError = null;
      for (let attempt = 0; attempt < this.deepSeekKeys.length; attempt++) {
        try {
          const key = this.getNextDeepSeekKey();
          const response = await this.callDeepSeekWithKey(key, prompt, model, options, requestId);
          
          this.stats.successfulRequests++;
          this.stats.deepSeekRequestsThisMin++;
          
          const duration = Date.now() - startTime;
          logger.debug({ requestId, duration }, '✅ DeepSeek success');
          
          return response;
        } catch (error) {
          lastError = error;
          logger.warn({ requestId, attempt: attempt + 1, totalKeys: this.deepSeekKeys.length, error: error.message }, '⚠️ DeepSeek key failed');
          
          if (attempt < this.deepSeekKeys.length - 1) {
            await this.sleep(this.retryDelay);
          }
        }
      }
      
      throw lastError;
    } catch (error) {
      this.stats.failedRequests++;
      logger.error({ requestId, error: error.message }, '❌ DeepSeek failed');
      throw error;
    }
  }

  async callGroq(prompt, model = 'mixtral-8x7b-32768', options = {}) {
    const requestId = this.generateRequestId();
    const startTime = Date.now();
    
    try {
      logger.debug({ requestId, model }, '📤 Calling Groq');
      
      await this.checkRateLimit('groq');
      
      let lastError = null;
      for (let attempt = 0; attempt < this.groqKeys.length; attempt++) {
        try {
          const key = this.getNextGroqKey();
          const response = await this.callGroqWithKey(key, prompt, model, options, requestId);
          
          this.stats.successfulRequests++;
          this.stats.groqRequestsThisMin++;
          
          const duration = Date.now() - startTime;
          logger.debug({ requestId, duration }, '✅ Groq success');
          
          return response;
        } catch (error) {
          lastError = error;
          logger.warn({ requestId, attempt: attempt + 1, totalKeys: this.groqKeys.length, error: error.message }, '⚠️ Groq key failed');
          
          if (attempt < this.groqKeys.length - 1) {
            await this.sleep(this.retryDelay);
          }
        }
      }
      
      throw lastError;
    } catch (error) {
      this.stats.failedRequests++;
      logger.error({ requestId, error: error.message }, '❌ Groq failed');
      throw error;
    }
  }

  async parallelCalls(requests) {
    logger.info({ count: requests.length, limit: this.maxConcurrentRequests }, '🔄 Processing parallel AI requests');
    
    const startTime = Date.now();
    
    try {
      const promises = requests.map(req => 
        this.limiter(() => this.executeRequest(req))
      );
      
      const results = await Promise.allSettled(promises);
      
      const duration = Date.now() - startTime;
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      logger.info({ duration, successCount, failureCount, total: requests.length }, '📊 Parallel requests completed');
      
      return results.map((result, index) => ({
        index,
        request: requests[index],
        status: result.status,
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null,
      }));
    } catch (error) {
      logger.error({ error: error.message }, '❌ Parallel calls error');
      throw error;
    }
  }

  async executeRequest(request, retryCount = 0) {
    this.stats.totalRequests++;
    const { provider, prompt, model, options = {} } = request;
    
    try {
      // Use per-provider limiters to prevent one provider from blocking others
      if (provider === 'gemini') {
        return await this.geminiLimiter(() => this.callGemini(prompt, model, options));
      } else if (provider === 'groq') {
        return await this.groqLimiter(() => this.callGroq(prompt, model, options));
      } else if (provider === 'deepseek') {
        return await this.deepSeekLimiter(() => this.callDeepSeek(prompt, model, options));
      } else {
        throw new Error(`Unknown provider: ${provider}`);
      }
    } catch (error) {
      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        logger.info({ retryCount: retryCount + 1, maxRetries: this.maxRetries }, '🔁 Retrying request');
        this.stats.retriedRequests++;
        await this.sleep(this.retryDelay * Math.pow(2, retryCount));
        return this.executeRequest(request, retryCount + 1);
      }
      throw error;
    }
  }

  async callGeminiWithKey(apiKey, prompt, model, options, requestId) {
    const baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const targetUrl = `${baseUrl}?key=${encodeURIComponent(apiKey)}`;

    const axiosConfig = {
      timeout: options.timeout || this.requestTimeout,
      headers: { 'Content-Type': 'application/json' },
    };

    let requestUrl = targetUrl;
    if (this.useCloudflareProxy && this.cloudflareProxy) {
      logger.debug({ requestId, proxy: this.cloudflareProxy }, '🌐 Using Cloudflare proxy for Gemini request');
      requestUrl = `${this.cloudflareProxy}?target=${encodeURIComponent(targetUrl)}`;
      axiosConfig.headers['X-Target-Url'] = targetUrl;
      if (this.proxySecretToken) {
        axiosConfig.headers['X-Proxy-Auth-Token'] = this.proxySecretToken;
      }
    }

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.maxTokens || 8192,
        topP: options.topP || 0.95,
        topK: options.topK || 40,
      },
    };

    if (options.imageBase64) {
      const imageData = options.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      payload.contents.push({
        inlineData: {
          mimeType: options.mimeType || 'image/jpeg',
          data: imageData,
        },
      });
    }

    const response = await axios.post(requestUrl, payload, axiosConfig);

    if (!response.data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid Gemini response format');
    }

    return {
      provider: 'gemini',
      model,
      content: response.data.candidates[0].content.parts[0].text,
      promptTokens: response.data.usageMetadata?.promptTokenCount || 0,
      outputTokens: response.data.usageMetadata?.candidatesTokenCount || 0,
      timestamp: new Date(),
    };
  }

  async callGroqWithKey(apiKey, prompt, model, options, requestId) {
    const url = 'https://api.groq.com/openai/v1/chat/completions';

    const axiosConfig = {
      timeout: options.timeout || this.requestTimeout,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    };

    let requestUrl = url;
    if (this.useCloudflareProxy && this.cloudflareProxy) {
      logger.debug({ requestId, proxy: this.cloudflareProxy }, '🌐 Using Cloudflare proxy for Groq request');
      requestUrl = `${this.cloudflareProxy}?target=${encodeURIComponent(url)}`;
      axiosConfig.headers['X-Target-Url'] = url;
      if (this.proxySecretToken) {
        axiosConfig.headers['X-Proxy-Auth-Token'] = this.proxySecretToken;
      }
    }

    const payload = {
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 8192,
      top_p: options.topP || 0.95,
      top_k: options.topK || 40,
    };

    const response = await axios.post(requestUrl, payload, axiosConfig);

    if (!response.data.choices?.[0]?.message?.content) {
      throw new Error('Invalid Groq response format');
    }

    return {
      provider: 'groq',
      model,
      content: response.data.choices[0].message.content,
      promptTokens: response.data.usage?.prompt_tokens || 0,
      outputTokens: response.data.usage?.completion_tokens || 0,
      timestamp: new Date(),
    };
  }

  async callDeepSeekWithKey(apiKey, prompt, model, options, requestId) {
    const url = 'https://api.deepseek.com/v1/chat/completions';

    const axiosConfig = {
      timeout: options.timeout || this.requestTimeout,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    };

    // DeepSeek: Use Cloudflare proxy with authentication
    let requestUrl = url;
    if (this.useCloudflareProxy && this.cloudflareProxy) {
      logger.debug({ requestId, proxy: this.cloudflareProxy }, '🌐 Using Cloudflare proxy for DeepSeek request');
      requestUrl = `${this.cloudflareProxy}?target=${encodeURIComponent(url)}`;
      axiosConfig.headers['X-Target-Url'] = url;
      // Add authentication token for Cloudflare Worker
      if (this.proxySecretToken) {
        axiosConfig.headers['X-Proxy-Auth-Token'] = this.proxySecretToken;
      }
    }

    const payload = {
      model: model || 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 4096,
      top_p: options.topP || 0.95,
    };

    const response = await axios.post(requestUrl, payload, axiosConfig);

    if (!response.data.choices?.[0]?.message?.content) {
      throw new Error('Invalid DeepSeek response format');
    }

    return {
      provider: 'deepseek',
      model: response.data.model,
      content: response.data.choices[0].message.content,
      promptTokens: response.data.usage?.prompt_tokens || 0,
      outputTokens: response.data.usage?.completion_tokens || 0,
      timestamp: new Date(),
    };
  }

  async checkRateLimit(provider) {
    if (provider === 'gemini' && this.stats.geminiRequestsThisMin >= this.geminiRPM) {
      const waitTime = 60000 - (Date.now() - this.stats.lastResetTime);
      logger.warn({ waitTime }, '⏳ Gemini rate limit reached');
      await this.sleep(waitTime);
    } else if (provider === 'groq' && this.stats.groqRequestsThisMin >= this.groqRPM) {
      const waitTime = 60000 - (Date.now() - this.stats.lastResetTime);
      logger.warn({ waitTime }, '⏳ Groq rate limit reached');
      await this.sleep(waitTime);
    } else if (provider === 'deepseek' && this.stats.deepSeekRequestsThisMin >= this.deepSeekRPM) {
      const waitTime = 60000 - (Date.now() - this.stats.lastResetTime);
      logger.warn({ waitTime }, '⏳ DeepSeek rate limit reached');
      await this.sleep(waitTime);
    }
  }

  isRetryableError(error) {
    if (!error.response) return true;
    const status = error.response.status;
    return status === 429 || status === 500 || status === 502 || status === 503;
  }

  getNextGeminiKey() {
    if (!this.geminiKeys.length) throw new Error('No Gemini API keys configured');
    const key = this.geminiKeys[this.geminiKeyIndex];
    this.geminiKeyIndex = (this.geminiKeyIndex + 1) % this.geminiKeys.length;
    return key;
  }

  getNextGroqKey() {
    if (!this.groqKeys.length) throw new Error('No Groq API keys configured');
    const key = this.groqKeys[this.groqKeyIndex];
    this.groqKeyIndex = (this.groqKeyIndex + 1) % this.groqKeys.length;
    return key;
  }

  getNextDeepSeekKey() {
    if (!this.deepSeekKeys.length) throw new Error('No DeepSeek API keys configured');
    const key = this.deepSeekKeys[this.deepSeekKeyIndex];
    this.deepSeekKeyIndex = (this.deepSeekKeyIndex + 1) % this.deepSeekKeys.length;
    return key;
  }

  resetRateLimits() {
    this.stats.geminiRequestsThisMin = 0;
    this.stats.groqRequestsThisMin = 0;
    this.stats.deepSeekRequestsThisMin = 0;
    this.stats.lastResetTime = Date.now();
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateRequestId() {
    return `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
  }

  getStats() {
    return {
      ...this.stats,
      geminiKeysAvailable: this.geminiKeys.length,
      groqKeysAvailable: this.groqKeys.length,
      deepSeekKeysAvailable: this.deepSeekKeys.length,
      cloudflareProxyEnabled: this.useCloudflareProxy,
    };
  }

  getHealth() {
    return {
      status: 'healthy',
      geminiKeys: this.geminiKeys.length > 0 ? '✓' : '✗',
      groqKeys: this.groqKeys.length > 0 ? '✓' : '✗',
      deepSeekKeys: this.deepSeekKeys.length > 0 ? '✓' : '✗',
      cloudflareProxy: this.useCloudflareProxy ? '✓' : '✗',
      stats: this.getStats(),
    };
  }
}

export default new AIApiPool();
