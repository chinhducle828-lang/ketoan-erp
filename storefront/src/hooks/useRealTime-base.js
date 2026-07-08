/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * useRealTime Base Hook
 * Base hook chung cho ERP và Storefront
 * Single source of truth cho real-time updates logic
 */

import { useEffect, useState, useCallback } from 'react';
import { WebSocketBaseService } from '../services/websocket-base';

// Singleton instance
let wsBaseService = null;
const getWsService = () => {
  if (!wsBaseService) {
    wsBaseService = new WebSocketBaseService();
  }
  return wsBaseService;
};

// Base hook for real-time updates
export function useRealTimeBase(companyId, userId, eventHandlers = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Handle connection status
  const handleConnectionStatus = useCallback((data) => {
    setIsConnected(data.connected);
    setConnectionStatus(data.connected ? 'connected' : 'disconnected');
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!companyId || !userId) return;

    const wsService = getWsService();
    wsService.connect(companyId, userId);
    wsService.joinCompany(companyId);

    // Subscribe to connection status
    wsService.on('connectionStatus', handleConnectionStatus);

    // Subscribe to custom event handlers
    Object.entries(eventHandlers).forEach(([event, handler]) => {
      wsService.on(event, handler);
    });

    return () => {
      wsService.off('connectionStatus', handleConnectionStatus);
      
      // Unsubscribe from custom event handlers
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        wsService.off(event, handler);
      });
      
      wsService.leaveCompany(companyId);
    };
  }, [companyId, userId, handleConnectionStatus, eventHandlers]);

  // Manual reconnect
  const reconnect = useCallback(() => {
    if (companyId && userId) {
      const wsService = getWsService();
      wsService.connect(companyId, userId);
    }
  }, [companyId, userId]);

  return {
    isConnected,
    connectionStatus,
    reconnect
  };
}