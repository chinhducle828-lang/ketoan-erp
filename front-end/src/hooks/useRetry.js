import { useState, useCallback } from 'react';

/**
 * Custom hook for retry logic with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @param {number} options.backoffFactor - Exponential backoff multiplier (default: 2)
 */
export function useRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2
  } = options;

  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState(null);

  const executeWithRetry = useCallback(async (...args) => {
    let lastError;
    let currentDelay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        setRetryCount(attempt);
        setError(null);
        
        const result = await fn(...args);
        
        // Success - reset state
        setRetryCount(0);
        setIsRetrying(false);
        setError(null);
        
        return result;
      } catch (err) {
        lastError = err;
        
        // Don't retry on client errors (4xx)
        if (err.response?.status >= 400 && err.response?.status < 500) {
          setError(err);
          setIsRetrying(false);
          throw err;
        }

        // If this was the last attempt, throw the error
        if (attempt === maxRetries) {
          setError(err);
          setIsRetrying(false);
          throw err;
        }

        // Wait before retrying
        setIsRetrying(true);
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        
        // Exponential backoff
        currentDelay = Math.min(currentDelay * backoffFactor, maxDelay);
      }
    }

    // Should never reach here, but just in case
    setError(lastError);
    setIsRetrying(false);
    throw lastError;
  }, [fn, maxRetries, initialDelay, maxDelay, backoffFactor]);

  const reset = useCallback(() => {
    setRetryCount(0);
    setIsRetrying(false);
    setError(null);
  }, []);

  return {
    executeWithRetry,
    isRetrying,
    retryCount,
    error,
    reset
  };
}

/**
 * Higher-order function to wrap API calls with retry logic
 */
export function withRetry(fn, options = {}) {
  return async (...args) => {
    const { maxRetries = 3, initialDelay = 1000, maxDelay = 10000, backoffFactor = 2 } = options;
    
    let lastError;
    let currentDelay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn(...args);
      } catch (err) {
        lastError = err;
        
        // Don't retry on client errors (4xx)
        if (err.response?.status >= 400 && err.response?.status < 500) {
          throw err;
        }

        // If this was the last attempt, throw the error
        if (attempt === maxRetries) {
          throw err;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        
        // Exponential backoff
        currentDelay = Math.min(currentDelay * backoffFactor, maxDelay);
      }
    }

    throw lastError;
  };
}

export default useRetry;