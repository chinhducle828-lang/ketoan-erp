import { useState, useCallback } from 'react';
import { useRealTimeBase } from './useRealTime-base';
import wsService from '../services/websocket';

// Hook for real-time updates (ERP-specific)
export function useRealTime(companyId, userId) {
  const [vouchers, setVouchers] = useState([]);
  const [orders, setOrders] = useState([]);

  // Handle voucher created
  const handleVoucherCreated = useCallback((voucher) => {
    setVouchers(prev => [voucher, ...prev]);
  }, []);

  // Handle voucher updated
  const handleVoucherUpdated = useCallback((updatedVoucher) => {
    setVouchers(prev => 
      prev.map(v => v.id === updatedVoucher.id ? updatedVoucher : v)
    );
  }, []);

  // Handle order status changed
  const handleOrderStatusChanged = useCallback((order) => {
    setOrders(prev => 
      prev.map(o => o.id === order.id ? { ...o, ...order } : o)
    );
  }, []);

  // Use base hook
  const base = useRealTimeBase(companyId, userId, {
    voucherCreated: handleVoucherCreated,
    voucherUpdated: handleVoucherUpdated,
    orderStatusChanged: handleOrderStatusChanged
  });

  return {
    ...base,
    vouchers,
    orders,
    setVouchers,
    setOrders
  };
}

// Hook for voucher notifications
export function useVoucherNotifications() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const handleVoucherCreated = (voucher) => {
      const notification = {
        id: Date.now(),
        type: 'voucher',
        title: 'Chứng từ mới',
        message: `Chứng từ ${voucher.voucherNumber} đã được tạo`,
        timestamp: new Date(),
        read: false
      };
      setNotifications(prev => [notification, ...prev.slice(0, 9)]);
    };

    wsService.on('voucherCreated', handleVoucherCreated);

    return () => {
      wsService.off('voucherCreated', handleVoucherCreated);
    };
  }, []);

  const markAsRead = (id) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  return {
    notifications,
    markAsRead,
    clearNotifications
  };
}

// Hook for balance updates
export function useBalanceUpdates() {
  const [balanceUpdates, setBalanceUpdates] = useState({});

  useEffect(() => {
    const handleBalanceUpdated = (data) => {
      setBalanceUpdates(prev => ({
        ...prev,
        [data.accountCode]: {
          ...data,
          lastUpdate: new Date()
        }
      }));
    };

    wsService.on('balanceUpdated', handleBalanceUpdated);

    return () => {
      wsService.off('balanceUpdated', handleBalanceUpdated);
    };
  }, []);

  return {
    balanceUpdates
  };
}
