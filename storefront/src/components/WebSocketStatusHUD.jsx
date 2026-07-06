import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * WebSocket Status HUD Component
 * Displays real-time connection status and sync indicators
 * Provides visual feedback for order synchronization with ERP
 * 
 * @param {Object} props
 * @param {boolean} props.isConnected - WebSocket connection status
 * @param {boolean} props.isConnecting - Connection in progress
 * @param {string} props.lastSync - Last sync timestamp
 * @param {number} props.pendingOrders - Count of pending orders
 * @param {Function} props.onReconnect - Reconnect handler
 */
export default function WebSocketStatusHUD({
  isConnected = false,
  isConnecting = false,
  lastSync = null,
  pendingOrders = 0,
  onReconnect
}) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatLastSync = (timestamp) => {
    if (!timestamp) return 'Chưa đồng bộ';
    const date = new Date(timestamp);
    return `Đồng bộ lúc ${date.toLocaleTimeString('vi-VN')}`;
  };

  const getStatusConfig = () => {
    if (isConnecting) {
      return {
        icon: <Loader2 size={16} className="animate-spin" />,
        text: 'Đang kết nối...',
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        border: 'border-amber-200'
      };
    }
    
    if (isConnected) {
      return {
        icon: <Wifi size={16} />,
        text: 'Đã kết nối',
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200'
      };
    }
    
    return {
      icon: <WifiOff size={16} />,
      text: 'Mất kết nối',
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200'
    };
  };

  const status = getStatusConfig();

  return (
    <div className={`fixed bottom-4 left-4 z-40 ${status.bg} ${status.border} border rounded-lg shadow-md p-3 transition-all duration-300`}>
      <div className="flex items-center gap-3">
        {/* Connection Status Icon */}
        <div className={`${status.color}`}>
          {status.icon}
        </div>

        {/* Status Text */}
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold ${status.color}`}>
            {status.text}
          </p>
          <p className="text-[10px] text-slate-600">
            {formatLastSync(lastSync)}
          </p>
        </div>

        {/* Pending Orders Badge */}
        {pendingOrders > 0 && (
          <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
            <AlertCircle size={12} />
            <span className="text-[10px] font-bold">{pendingOrders}</span>
          </div>
        )}

        {/* Reconnect Button */}
        {!isConnected && !isConnecting && onReconnect && (
          <button
            onClick={onReconnect}
            className="touch-target p-1.5 rounded-lg hover:bg-slate-200/50 transition"
            title="Kết nối lại"
          >
            <CheckCircle2 size={14} className="text-slate-600" />
          </button>
        )}
      </div>

      {/* Live Clock */}
      <div className="mt-2 pt-2 border-t border-slate-200/50">
        <p className="text-[10px] text-slate-500 text-center font-mono">
          {currentTime.toLocaleTimeString('vi-VN')}
        </p>
      </div>
    </div>
  );
}

/**
 * WebSocket Status Hook
 * Manages WebSocket connection state and provides status updates
 */
export function useWebSocketStatus(url) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [eventSource, setEventSource] = useState(null);

  const connect = () => {
    if (!url || eventSource) return;

    setIsConnecting(true);
    try {
      const es = new EventSource(url);
      
      es.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setLastSync(new Date().toISOString());
      };

      es.onerror = () => {
        setIsConnected(false);
        setIsConnecting(false);
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastSync(new Date().toISOString());
          
          if (data.pendingOrders !== undefined) {
            setPendingOrders(data.pendingOrders);
          }
        } catch (e) {
          // Ignore parse errors
        }
      };

      setEventSource(es);
    } catch (error) {
      setIsConnected(false);
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
      setIsConnected(false);
    }
  };

  const reconnect = () => {
    disconnect();
    setTimeout(connect, 1000);
  };

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [url]);

  return {
    isConnected,
    isConnecting,
    lastSync,
    pendingOrders,
    connect,
    disconnect,
    reconnect
  };
}