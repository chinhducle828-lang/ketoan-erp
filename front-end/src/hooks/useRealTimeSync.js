/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { useEffect, useMemo, useRef } from 'react';
import { useSocket } from './useSocket.js';

/**
 * Hook tập trung đồng bộ realtime cho các màn hình ERP.
 * handlers: object { eventName: (payload) => void }
 */
export function useRealTimeSync(handlers = {}, options = {}) {
  const { subscribe, unsubscribe, isConnected, companyId, clientInstanceId } = useSocket();
  const {
    enabled = true,
    ignoreSelfEvents = true,
    minIntervalMs = 80
  } = options;

  const lastHandledRef = useRef(new Map());

  const entries = useMemo(() => Object.entries(handlers || {}), [handlers]);

  useEffect(() => {
    if (!enabled || !companyId || entries.length === 0) {
      return;
    }

    const wrappedHandlers = [];

    entries.forEach(([eventName, handler]) => {
      if (typeof handler === 'function') {
        const wrapped = (payload) => {
          const originClientId = payload?.clientInstanceId || payload?.sourceClientId || null;
          if (ignoreSelfEvents && originClientId && originClientId === clientInstanceId) {
            return;
          }

          const now = Date.now();
          const lastHandled = lastHandledRef.current.get(eventName) || 0;
          if (now - lastHandled < minIntervalMs) {
            return;
          }
          lastHandledRef.current.set(eventName, now);

          handler(payload);
        };

        wrappedHandlers.push([eventName, handler, wrapped]);
        subscribe(eventName, wrapped);
      }
    });

    return () => {
      wrappedHandlers.forEach(([eventName, _handler, wrapped]) => {
        unsubscribe(eventName, wrapped);
      });
    };
  }, [enabled, companyId, clientInstanceId, entries, ignoreSelfEvents, minIntervalMs, subscribe, unsubscribe]);

  return { isConnected, companyId };
}
