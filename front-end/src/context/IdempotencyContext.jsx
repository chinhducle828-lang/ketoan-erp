import { createContext, useContext, useState, useCallback } from 'react';

/**
 * Idempotency Context
 * Quản lý idempotency keys toàn cục cho toàn bộ ứng dụng
 * Cho phép các form khác nhau share idempotency state
 */
const IdempotencyContext = createContext(null);

export function IdempotencyProvider({ children }) {
  const [pendingRequests, setPendingRequests] = useState(new Map());
  const [completedRequests, setCompletedRequests] = useState(new Map());

  // Generate new idempotency key
  const generateKey = useCallback(() => {
    return `idem_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }, []);

  // Check if request is pending
  const isPending = useCallback((key) => {
    return pendingRequests.has(key);
  }, [pendingRequests]);

  // Check if request is completed
  const isCompleted = useCallback((key) => {
    return completedRequests.has(key);
  }, [completedRequests]);

  // Mark request as pending
  const markPending = useCallback((key, promise) => {
    setPendingRequests(prev => new Map(prev).set(key, promise));
    
    // Auto-cleanup after 5 minutes
    setTimeout(() => {
      setPendingRequests(prev => {
        const next = new Map(prev);
        if (next.get(key) === promise) {
          next.delete(key);
        }
        return next;
      });
    }, 5 * 60 * 1000);
  }, []);

  // Mark request as completed
  const markCompleted = useCallback((key, result) => {
    setCompletedRequests(prev => new Map(prev).set(key, {
      result,
      timestamp: Date.now(),
    }));

    // Cleanup after 1 hour
    setTimeout(() => {
      setCompletedRequests(prev => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    }, 60 * 60 * 1000);
  }, []);

  // Execute with idempotency
  const executeWithIdempotency = useCallback(async (key, fn) => {
    // Check if already completed
    if (isCompleted(key)) {
      const cached = completedRequests.get(key);
      if (cached) {
        console.log('Returning cached result for key:', key);
        return cached.result;
      }
    }

    // Check if already pending
    if (isPending(key)) {
      console.log('Request already pending for key:', key);
      return pendingRequests.get(key);
    }

    // Execute new request
    const promise = fn();
    markPending(key, promise);

    try {
      const result = await promise;
      markCompleted(key, result);
      setPendingRequests(prev => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      return result;
    } catch (error) {
      setPendingRequests(prev => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      throw error;
    }
  }, [isPending, isCompleted, pendingRequests, completedRequests, markPending, markCompleted]);

  // Clear all state (for logout)
  const clearAll = useCallback(() => {
    setPendingRequests(new Map());
    setCompletedRequests(new Map());
  }, []);

  const value = {
    pendingRequests,
    completedRequests,
    generateKey,
    isPending,
    isCompleted,
    markPending,
    markCompleted,
    executeWithIdempotency,
    clearAll,
  };

  return (
    <IdempotencyContext.Provider value={value}>
      {children}
    </IdempotencyContext.Provider>
  );
}

// Hook để sử dụng context
export function useIdempotencyContext() {
  const context = useContext(IdempotencyContext);
  if (!context) {
    throw new Error('useIdempotencyContext must be used within IdempotencyProvider');
  }
  return context;
}

// HOC để wrap component với idempotency context
export function withIdempotency(WrappedComponent) {
  return function IdempotencyWrapper(props) {
    return (
      <IdempotencyProvider>
        <WrappedComponent {...props} />
      </IdempotencyProvider>
    );
  };
}