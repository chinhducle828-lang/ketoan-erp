import { useState, useCallback, useEffect } from 'react';
import {
  convertGuestCheckoutToSaleEvent,
  convertProductCreationToPurchaseEvent,
  convertOrderCompletionToCreditEvent,
  validateEventData,
  sendEventToBackend,
  sendBatchEvents,
  getEventStatus,
} from '../services/storefrontEventAdapter';
import { useStorefrontIdempotency } from './useStorefrontIdempotency';

/**
 * Hook quản lý storefront events
 * - Convert storefront actions → REA events
 * - Send events to backend
 * - Handle responses (credit freeze, tax warnings)
 */
export default function useStorefrontEvents() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastEventId, setLastEventId] = useState(null);
  const { generateIdempotencyKey, withIdempotency } = useStorefrontIdempotency();

  // Guest checkout - tạo đơn hàng mới
  const guestCheckout = useCallback(async (orderData) => {
    setLoading(true);
    setError(null);

    try {
      // Convert to REA event
      const event = convertGuestCheckoutToSaleEvent(orderData);

      // Validate
      const validation = validateEventData(event);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Generate idempotency key
      const idempotencyKey = generateIdempotencyKey();

      // Send with idempotency
      const result = await withIdempotency(
        () => sendEventToBackend(event, idempotencyKey),
        idempotencyKey
      );

      setLastEventId(result.event_id);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [generateIdempotencyKey, withIdempotency]);

  // Create product - tạo sản phẩm mới
  const createProduct = useCallback(async (productData) => {
    setLoading(true);
    setError(null);

    try {
      // Convert to REA event
      const event = convertProductCreationToPurchaseEvent(productData);

      // Validate
      const validation = validateEventData(event);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Generate idempotency key
      const idempotencyKey = generateIdempotencyKey();

      // Send with idempotency
      const result = await withIdempotency(
        () => sendEventToBackend(event, idempotencyKey),
        idempotencyKey
      );

      setLastEventId(result.event_id);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [generateIdempotencyKey, withIdempotency]);

  // Complete order with credit - hoàn thành đơn hàng công nợ
  const completeOrderWithCredit = useCallback(async (orderData) => {
    setLoading(true);
    setError(null);

    try {
      // Convert to REA event
      const event = convertOrderCompletionToCreditEvent(orderData);

      // Validate
      const validation = validateEventData(event);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Generate idempotency key
      const idempotencyKey = generateIdempotencyKey();

      // Send with idempotency
      const result = await withIdempotency(
        () => sendEventToBackend(event, idempotencyKey),
        idempotencyKey
      );

      setLastEventId(result.event_id);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [generateIdempotencyKey, withIdempotency]);

  // Batch create products - tạo nhiều sản phẩm cùng lúc
  const batchCreateProducts = useCallback(async (productsData) => {
    setLoading(true);
    setError(null);

    try {
      // Convert all products to events
      const events = productsData.map(product => 
        convertProductCreationToPurchaseEvent(product)
      );

      // Validate all
      events.forEach((event, index) => {
        const validation = validateEventData(event);
        if (!validation.isValid) {
          throw new Error(`Product ${index + 1} validation failed: ${validation.errors.join(', ')}`);
        }
      });

      // Generate idempotency key
      const idempotencyKey = generateIdempotencyKey();

      // Send batch
      const result = await withIdempotency(
        () => sendBatchEvents(events, idempotencyKey),
        idempotencyKey
      );

      setLastEventId(result.batch_id);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [generateIdempotencyKey, withIdempotency]);

  // Get event status
  const checkEventStatus = useCallback(async (eventId) => {
    try {
      const result = await getEventStatus(eventId);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    lastEventId,
    guestCheckout,
    createProduct,
    completeOrderWithCredit,
    batchCreateProducts,
    checkEventStatus,
    clearError,
  };
}

/**
 * Hook cho real-time event updates
 * Poll for event status changes
 */
export function useStorefrontEventRealtime(eventId) {
  const [eventStatus, setEventStatus] = useState(null);
  const [isPolling, setIsPolling] = useState(false);

  // Poll for status updates
  useEffect(() => {
    if (!eventId || !isPolling) return;

    const interval = setInterval(async () => {
      try {
        const result = await getEventStatus(eventId);
        setEventStatus(result);

        // Stop polling if completed or failed
        if (result.status === 'completed' || result.status === 'failed') {
          setIsPolling(false);
        }
      } catch (err) {
        console.error('Failed to fetch event status:', err);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [eventId, isPolling]);

  const startPolling = useCallback(() => {
    setIsPolling(true);
  }, []);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
  }, []);

  return {
    eventStatus,
    isPolling,
    startPolling,
    stopPolling,
  };
}

/**
 * Hook cho storefront credit check
 * Kiểm tra credit limit trước khi tạo đơn hàng
 */
export function useStorefrontCreditCheck() {
  const [creditInfo, setCreditInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check credit limit
  const checkCreditLimit = useCallback(async (customerId, orderTotal) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/credit/check?customer_id=${customerId}&amount=${orderTotal}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setCreditInfo(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Check if order would freeze credit
  const wouldFreezeCredit = useCallback((customerId, orderTotal) => {
    if (!creditInfo) return false;
    return orderTotal > creditInfo.available_credit;
  }, [creditInfo]);

  return {
    creditInfo,
    loading,
    error,
    checkCreditLimit,
    wouldFreezeCredit,
  };
}