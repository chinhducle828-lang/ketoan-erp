import { useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Storefront Real-Time Hook
 * Enables real-time order status updates from ERP backend
 */
export function useStorefrontRealTime() {
  const { activeCompany } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [orderUpdates, setOrderUpdates] = useState([]);

  // Initialize socket connection
  useEffect(() => {
    if (!activeCompany?.id) return;

    const socketInstance = io({
      path: '/socket.io',
      transports: ['websocket', 'polling']
    });

    socketInstance.on('connect', () => {
      console.log('Storefront socket connected:', socketInstance.id);
      setConnected(true);
      
      // Join company room
      socketInstance.emit('join-company', activeCompany.id);
    });

    socketInstance.on('disconnect', () => {
      console.log('Storefront socket disconnected');
      setConnected(false);
    });

    // Listen for order status changes
    socketInstance.on('orderStatusChanged', (data) => {
      console.log('Order status changed:', data);
      setOrderUpdates(prev => [...prev, {
        ...data,
        receivedAt: new Date().toISOString()
      }]);
    });

    // Listen for new orders
    socketInstance.on('orderCreated', (data) => {
      console.log('Order created:', data);
      setOrderUpdates(prev => [...prev, {
        ...data,
        type: 'created',
        receivedAt: new Date().toISOString()
      }]);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
      setSocket(null);
    };
  }, [activeCompany?.id]);

  // Clear order updates
  const clearOrderUpdates = useCallback(() => {
    setOrderUpdates([]);
  }, []);

  // Get latest order update
  const getLatestUpdate = useCallback(() => {
    return orderUpdates[orderUpdates.length - 1] || null;
  }, [orderUpdates]);

  return {
    connected,
    orderUpdates,
    clearOrderUpdates,
    getLatestUpdate,
    socket
  };
}

export default useStorefrontRealTime;