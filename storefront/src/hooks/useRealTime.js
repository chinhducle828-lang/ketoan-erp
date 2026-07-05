import { useState, useCallback } from 'react';
import { useRealTimeBase } from './useRealTime-base';
import wsService from '../services/websocket';

// Hook for real-time updates (Storefront-specific)
export function useRealTime(companyId, userId) {
  const [orders, setOrders] = useState([]);

  // Handle order status changed
  const handleOrderStatusChanged = useCallback((order) => {
    setOrders(prev => 
      prev.map(o => o.id === order.id ? { ...o, ...order } : o)
    );
  }, []);

  // Use base hook
  const base = useRealTimeBase(companyId, userId, {
    orderStatusChanged: handleOrderStatusChanged
  });

  return {
    ...base,
    orders,
    setOrders
  };
}

// Hook for order status
export function useOrderStatus() {
  const [orderUpdates, setOrderUpdates] = useState({});

  useEffect(() => {
    const handleOrderStatusChanged = (order) => {
      setOrderUpdates(prev => ({
        ...prev,
        [order.id]: {
          ...order,
          lastUpdate: new Date()
        }
      }));
    };

    wsService.on('orderStatusChanged', handleOrderStatusChanged);

    return () => {
      wsService.off('orderStatusChanged', handleOrderStatusChanged);
    };
  }, []);

  return {
    orderUpdates
  };
}
