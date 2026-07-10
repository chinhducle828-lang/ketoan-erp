/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { useEffect, useMemo, useRef } from 'react';
import wsService from '../services/websocket.js';

/**
 * Hook chuẩn hóa realtime cho Storefront.
 * Mirror của useRealTimeSync (ERP) nhưng dùng wsService riêng của storefront.
 * handlers: object { eventName: (payload) => void }
 */
export function useStorefrontRealtime(handlers = {}, options = {}) {
  const {
    enabled = true,
    ignoreSelfEvents = false,
    minIntervalMs = 80
  } = options;

  const lastHandledRef = useRef(new Map());
  const entries = useMemo(() => Object.entries(handlers || {}), [handlers]);

  useEffect(() => {
    if (!enabled || entries.length === 0) {
      return;
    }

    const wrappedHandlers = [];

    entries.forEach(([eventName, handler]) => {
      if (typeof handler === 'function') {
        const wrapped = (payload) => {
          const now = Date.now();
          const lastHandled = lastHandledRef.current.get(eventName) || 0;
          if (now - lastHandled < minIntervalMs) {
            return;
          }
          lastHandledRef.current.set(eventName, now);
          handler(payload);
        };

        wrappedHandlers.push([eventName, wrapped]);
        wsService.on(eventName, wrapped);
      }
    });

    return () => {
      wrappedHandlers.forEach(([eventName, wrapped]) => {
        wsService.off(eventName, wrapped);
      });
    };
  }, [enabled, entries, ignoreSelfEvents, minIntervalMs]);

  return { isConnected: wsService.isConnected };
}

export default useStorefrontRealtime;