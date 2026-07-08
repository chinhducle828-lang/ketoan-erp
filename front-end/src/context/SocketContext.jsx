/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.jsx';
import wsService from '../services/websocket.js';

const SocketContext = createContext(null);

const normalizeCompanyId = (activeCompany) => {
  if (!activeCompany) return null;
  if (typeof activeCompany === 'object') return activeCompany.id || null;
  return activeCompany;
};

export function SocketProvider({ children }) {
  const { user, activeCompany } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const companyId = normalizeCompanyId(activeCompany);

  useEffect(() => {
    if (!companyId || !user?.id) {
      return;
    }

    const handleConnectionStatus = (data) => {
      const connected = Boolean(data?.connected);
      setIsConnected(connected);
      setConnectionStatus(connected ? 'connected' : 'disconnected');
      if (connected) {
        wsService.joinCompany(companyId);
      }
    };

    wsService.connect(companyId, user.id);
    wsService.joinCompany(companyId);
    wsService.on('connectionStatus', handleConnectionStatus);

    return () => {
      wsService.off('connectionStatus', handleConnectionStatus);
      wsService.leaveCompany(companyId);
    };
  }, [companyId, user?.id]);

  const subscribe = useCallback((eventName, handler) => {
    wsService.on(eventName, handler);
  }, []);

  const unsubscribe = useCallback((eventName, handler) => {
    wsService.off(eventName, handler);
  }, []);

  const value = useMemo(() => ({
    isConnected,
    connectionStatus,
    companyId,
    clientInstanceId: wsService.getClientInstanceId(),
    subscribe,
    unsubscribe
  }), [isConnected, connectionStatus, companyId, subscribe, unsubscribe]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket phải được dùng bên trong SocketProvider');
  }
  return context;
}
