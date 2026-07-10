/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { useState, useCallback, useEffect } from 'react';
import { useStorefrontRealtime } from './useStorefrontRealtime.js';
import wsService from '../services/websocket';
import { authApi } from '../utils/api';

// Hook for real-time updates (Storefront-specific)
export function useRealTime(companyId, userId) {
  const [orders, setOrders] = useState([]);

  // Handle order status changed
  const handleOrderStatusChanged = useCallback((order) => {
    setOrders(prev =>
      prev.map(o => o.id === order.id ? { ...o, ...order } : o)
    );
  }, []);

  // Use standardized realtime hook
  useStorefrontRealtime(
    { orderStatusChanged: handleOrderStatusChanged },
    { enabled: Boolean(companyId) }
  );

  return {
    orders,
    setOrders
  };
}

// Hook for order status
export function useOrderStatus() {
  const [orderUpdates, setOrderUpdates] = useState({});

  const handleOrderStatusChanged = useCallback((order) => {
    setOrderUpdates(prev => ({
      ...prev,
      [order.id]: {
        ...order,
        lastUpdate: new Date()
      }
    }));
  }, []);

  useStorefrontRealtime(
    { orderStatusChanged: handleOrderStatusChanged },
    { enabled: true }
  );

  return {
    orderUpdates
  };
}

// Hook for voucher notifications
export function useVoucherNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await authApi.get('/notifications');
      setNotifications(data.data || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.warn('Failed to fetch notifications:', error);
    }
  }, []);

  // Load notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Listen for real-time notification events via standardized hook
  const handleNewNotification = useCallback((notification) => {
    setNotifications(prev => [notification, ...prev]);
    setUnreadCount(prev => prev + 1);
  }, []);

  useStorefrontRealtime(
    { 'notification:new': handleNewNotification },
    { enabled: true }
  );

  // Mark a notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await authApi.put(`/notifications/${notificationId}/read`);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.warn('Failed to mark notification as read:', error);
    }
  }, []);

  // Clear all notifications
  const clearNotifications = useCallback(async () => {
    try {
      await authApi.put('/notifications/read-all');
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.warn('Failed to clear notifications:', error);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    markAsRead,
    clearNotifications,
    refresh: fetchNotifications
  };
}
