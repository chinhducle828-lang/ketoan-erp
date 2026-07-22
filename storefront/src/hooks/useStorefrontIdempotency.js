/**
 * useStorefrontIdempotency.js - Hook quản lý Idempotency Keys cho Storefront
 * Ngăn chặn double-click và duplicate API calls
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { useState, useCallback } from 'react';

// In-memory cache cho pending requests
const pendingRequests = new Map();

export function useStorefrontIdempotency() {
  const [pendingKeys, setPendingKeys] = useState(new Set());
  
  /**
   * Generate unique idempotency key cho storefront
   */
  const generateIdempotencyKey = useCallback(() => {
    return `storefront_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }, []);
  
  /**
   * Wrap async function với idempotency check
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