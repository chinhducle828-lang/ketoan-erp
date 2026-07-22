/**
 * useIdempotency.js - Hook quản lý Idempotency Keys
 * Ngăn chặn double-click và duplicate API calls
 */

import { useState, useCallback, useRef } from 'react';

// In-memory cache cho pending requests (tránh gọi lại API nếu đang xử lý)
const pendingRequests = new Map();

export function useIdempotency() {
  const [pendingKeys, setPendingKeys] = useState(new Set());
  
  /**
   * Generate unique idempotency key (UUID v4)
   */
  const generateIdempotencyKey = useCallback(() => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }, []);
  
  /**
   * Wrap async function với idempotency check
   * Nếu key đang pending → trả về promise cũ
   * Nếu key mới → tạo promise mới, cache, và cleanup khi xong
   */
  const withIdempotency = useCallback(async (fn, key) => {
    if (!key) {
      key = generateIdempotencyKey();
    }
    
    // Nếu đang pending, trả về promise cũ
    if (pendingRequests.has(key)) {
      return pendingRequests.get(key);
    }
    
    // Tạo promise mới
    const promise = fn().finally(() => {
      // Cleanup khi xong
      pendingRequests.delete(key);
      setPendingKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    });
    
    // Cache promise
    pendingRequests.set(key, promise);
    setPendingKeys(prev => new Set(prev).add(key));
    
    return promise;
  }, [generateIdempotencyKey]);
  
  /**
   * Cleanup tất cả pending keys (dùng khi unmount)
   */
  const cleanup = useCallback(() => {
    pendingRequests.clear();
    setPendingKeys(new Set());
  }, []);
  
  return {
    generateIdempotencyKey,
    withIdempotency,
    cleanup,
    pendingKeys
  };
}

/**
 * Hook đơn giản cho storefront (không cần context)
 */
export function useStorefrontIdempotency() {
  const [pendingKeys, setPendingKeys] = useState(new Set());
  
  const generateIdempotencyKey = useCallback(() => {
    return `storefront_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }, []);
  
  const withIdempotency = useCallback(async (fn, key) => {
    if (!key) {
      key = generateIdempotencyKey();
    }
    
    if (pendingRequests.has(key)) {
      return pendingRequests.get(key);
    }
    
    const promise = fn().finally(() => {
      pendingRequests.delete(key);
      setPendingKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    });
    
    pendingRequests.set(key, promise);
    setPendingKeys(prev => new Set(prev).add(key));
    
    return promise;
  }, [generateIdempotencyKey]);
  
  const cleanup = useCallback(() => {
    pendingRequests.clear();
    setPendingKeys(new Set());
  }, []);
  
  return {
    generateIdempotencyKey,
    withIdempotency,
    cleanup,
    pendingKeys
  };
}