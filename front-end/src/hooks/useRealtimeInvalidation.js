import { useCallback, useEffect, useMemo, useRef } from 'react';

const DEFAULT_EVENT_MAP = Object.freeze({
  'voucher:created': ['vouchers'],
  'voucher:updated': ['vouchers'],
  'voucher:deleted': ['vouchers'],
  'voucher:posted': ['vouchers'],
  voucherCreated: ['vouchers'],
  voucherUpdated: ['vouchers'],
  voucherDeleted: ['vouchers'],
  voucherPosted: ['vouchers'],
  'closing:completed': ['reports'],
  closingCompleted: ['reports'],
  'inventory:updated': ['inventory'],
  inventoryUpdated: ['inventory'],
  'partner:updated': ['partners'],
  partnerUpdated: ['partners']
});

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
};

export function useRealtimeInvalidation(refreshers = {}, options = {}) {
  const {
    eventMap = DEFAULT_EVENT_MAP,
    debounceMs = 250,
    onLoopGuardTrip = null,
    maxRefreshPerWindow = 30,
    windowMs = 5000
  } = options;

  const timersRef = useRef(new Map());
  const inFlightRef = useRef(new Set());
  const loopStateRef = useRef({ start: Date.now(), count: 0, blockedUntil: 0 });

  const scheduleRefresh = useCallback((key) => {
    const refresher = refreshers[key];
    if (typeof refresher !== 'function') {
      return;
    }

    const now = Date.now();
    const loopState = loopStateRef.current;
    if (loopState.blockedUntil > now) {
      return;
    }
    if (now - loopState.start > windowMs) {
      loopState.start = now;
      loopState.count = 0;
    }
    loopState.count += 1;
    if (loopState.count > maxRefreshPerWindow) {
      loopState.blockedUntil = now + windowMs;
      if (typeof onLoopGuardTrip === 'function') {
        onLoopGuardTrip({ key, blockedUntil: loopState.blockedUntil });
      }
      return;
    }

    const existingTimer = timersRef.current.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timerId = setTimeout(async () => {
      if (inFlightRef.current.has(key)) {
        return;
      }

      inFlightRef.current.add(key);
      try {
        await refresher();
      } finally {
        inFlightRef.current.delete(key);
      }
    }, debounceMs);

    timersRef.current.set(key, timerId);
  }, [debounceMs, maxRefreshPerWindow, onLoopGuardTrip, refreshers, windowMs]);

  const invalidateKeys = useCallback((keys) => {
    toArray(keys).forEach((key) => scheduleRefresh(key));
  }, [scheduleRefresh]);

  const handlers = useMemo(() => {
    return Object.fromEntries(
      Object.entries(eventMap || {}).map(([eventName, keys]) => [
        eventName,
        () => invalidateKeys(keys)
      ])
    );
  }, [eventMap, invalidateKeys]);

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer);
      }
      timersRef.current.clear();
      inFlightRef.current.clear();
    };
  }, []);

  return {
    handlers,
    invalidateKeys
  };
}
