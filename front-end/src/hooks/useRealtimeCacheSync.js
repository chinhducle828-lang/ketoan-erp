/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * Hook để đồng bộ cache React Query với WebSocket events
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from './useSocket.js';

/**
 * Hook tự động invalidate React Query cache khi có WebSocket events
 * 
 * @param {Object} options - Cấu hình cache invalidation
 * @param {string[]} options.queries - Danh sách query keys cần invalidate
 * @param {string[]} options.events - Danh sách WebSocket events cần listen
 * @param {boolean} options.enabled - Bật/tắt hook (mặc định: true)
 * 
 * @example
 * useRealtimeCacheSync({
 *   queries: [['balances'], ['vouchers']],
 *   events: ['voucher:posted', 'closing:completed']
 * });
 */
export function useRealtimeCacheSync({ queries = [], events = [], enabled = true }) {
  const queryClient = useQueryClient();
  const { subscribe, unsubscribe, companyId } = useSocket();

  const handleEvent = useCallback(() => {
    if (!companyId) return;

    // Invalidate tất cả queries được chỉ định
    queries.forEach((queryKey) => {
      queryClient.invalidateQueries({ queryKey });
    });

    // Log để debug (có thể bỏ sau khi test xong)
    console.log(`[CacheSync] Invalidated queries:`, queries);
  }, [queryClient, queries, companyId]);

  if (!enabled) {
    return { isActive: false };
  }

  // Subscribe to all events
  events.forEach((eventName) => {
    subscribe(eventName, handleEvent);
  });

  return {
    isActive: true,
    invalidateAll: () => {
      queryClient.invalidateQueries();
    },
    invalidateByKey: (queryKey) => {
      queryClient.invalidateQueries({ queryKey });
    },
  };
}

/**
 * Hook đặc biệt cho voucher operations
 * Tự động invalidate cache khi voucher thay đổi
 */
export function useVoucherCacheSync() {
  return useRealtimeCacheSync({
    queries: [
      ['vouchers'],
      ['balances'],
      ['accountBalances'],
    ],
    events: [
      'voucher:created',
      'voucher:updated',
      'voucher:deleted',
      'voucher:posted',
    ],
  });
}

/**
 * Hook đặc biệt cho closing operations
 * Tự động invalidate cache khi có closing mới
 */
export function useClosingCacheSync() {
  return useRealtimeCacheSync({
    queries: [
      ['balances'],
      ['accountBalances'],
      ['closingHistory'],
    ],
    events: [
      'closing:completed',
      'closing:reopened',
    ],
  });
}

/**
 * Hook đặc biệt cho account operations
 * Tự động invalidate cache khi account thay đổi
 */
export function useAccountCacheSync() {
  return useRealtimeCacheSync({
    queries: [
      ['accounts'],
      ['balances'],
      ['accountBalances'],
    ],
    events: [
      'account:created',
      'account:updated',
      'account:deleted',
    ],
  });
}