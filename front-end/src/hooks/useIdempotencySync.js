import { useEffect, useCallback, useRef } from 'react';
import { useIdempotencyContext } from '../context/IdempotencyContext';

/**
 * Hook để sync idempotency keys giữa các tabs/windows
 * Sử dụng BroadcastChannel API (fallback to localStorage events)
 */
export default function useIdempotencySync() {
  const { pendingRequests, completedRequests, clearAll } = useIdempotencyContext();
  const channelRef = useRef(null);
  const isInitialized = useRef(false);

  // Initialize BroadcastChannel
  useEffect(() => {
    if (isInitialized.current) return;

    try {
      // Try BroadcastChannel first (modern browsers)
      if ('BroadcastChannel' in window) {
        channelRef.current = new BroadcastChannel('idempotency_sync');
        
        channelRef.current.onmessage = (event) => {
          const { type, key, result } = event.data;

          switch (type) {
            case 'REQUEST_COMPLETED':
              // Another tab completed a request, cache the result
              if (result && !completedRequests.has(key)) {
                // We can't directly modify context state here
                // But we can log it for debugging
                console.log('Request completed in another tab:', key);
              }
              break;

            case 'CLEAR_ALL':
              // Another tab logged out, clear local state
              clearAll();
              break;

            default:
              break;
          }
        };

        isInitialized.current = true;
      }
    } catch (error) {
      console.warn('BroadcastChannel not supported, falling back to localStorage events');
    }

    return () => {
      if (channelRef.current) {
        channelRef.current.close();
        channelRef.current = null;
      }
      isInitialized.current = false;
    };
  }, [completedRequests, clearAll]);

  // Listen for localStorage events (fallback for older browsers)
  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key === 'idempotency_clear' && event.newValue === 'true') {
        // Another tab triggered clear
        clearAll();
        
        // Clean up
        localStorage.removeItem('idempotency_clear');
      }

      if (event.key && event.key.startsWith('idempotency_result_')) {
        const key = event.key.replace('idempotency_result_', '');
        const result = JSON.parse(event.newValue);
        
        // Cache the result from another tab
        console.log('Received idempotency result from another tab:', key);
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [clearAll]);

  // Broadcast request completion to other tabs
  const broadcastCompletion = useCallback((key, result) => {
    try {
      if (channelRef.current) {
        channelRef.current.postMessage({
          type: 'REQUEST_COMPLETED',
          key,
          result,
        });
      }

      // Also store in localStorage for fallback
      localStorage.setItem(`idempotency_result_${key}`, JSON.stringify(result));
      
      // Clean up after 1 hour
      setTimeout(() => {
        localStorage.removeItem(`idempotency_result_${key}`);
      }, 60 * 60 * 1000);
    } catch (error) {
      console.error('Failed to broadcast completion:', error);
    }
  }, []);

  // Broadcast clear all to other tabs
  const broadcastClearAll = useCallback(() => {
    try {
      if (channelRef.current) {
        channelRef.current.postMessage({
          type: 'CLEAR_ALL',
        });
      }

      // Also set localStorage flag for fallback
      localStorage.setItem('idempotency_clear', 'true');
      
      // Clean up after 5 seconds
      setTimeout(() => {
        localStorage.removeItem('idempotency_clear');
      }, 5000);
    } catch (error) {
      console.error('Failed to broadcast clear all:', error);
    }
  }, []);

  return {
    broadcastCompletion,
    broadcastClearAll,
  };
}

/**
 * Hook để detect duplicate submissions across tabs
 */
export function useCrossTabIdempotency() {
  const { executeWithIdempotency, generateKey } = useIdempotencyContext();
  const currentKeyRef = useRef(null);

  // Listen for new keys generated in other tabs
  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key && event.key.startsWith('idempotency_key_')) {
        const key = event.key.replace('idempotency_key_', '');
        const timestamp = parseInt(event.newValue);

        // If key was generated in last 5 seconds, it might be a duplicate
        if (Date.now() - timestamp < 5000) {
          console.warn('Potential duplicate request detected from another tab:', key);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Execute with cross-tab idempotency check
  const executeWithCrossTabCheck = useCallback(async (fn) => {
    const key = generateKey();
    currentKeyRef.current = key;

    // Broadcast key generation
    try {
      localStorage.setItem(`idempotency_key_${key}`, Date.now().toString());
      
      // Clean up after 5 seconds
      setTimeout(() => {
        localStorage.removeItem(`idempotency_key_${key}`);
      }, 5000);
    } catch (error) {
      console.error('Failed to broadcast key:', error);
    }

    // Execute with idempotency
    const result = await executeWithIdempotency(key, fn);

    // Broadcast completion
    if (result) {
      try {
        if ('BroadcastChannel' in window) {
          const channel = new BroadcastChannel('idempotency_sync');
          channel.postMessage({
            type: 'REQUEST_COMPLETED',
            key,
            result,
          });
          channel.close();
        }
      } catch (error) {
        console.error('Failed to broadcast completion:', error);
      }
    }

    return result;
  }, [executeWithIdempotency, generateKey]);

  return {
    executeWithCrossTabCheck,
    currentKey: currentKeyRef.current,
  };
}