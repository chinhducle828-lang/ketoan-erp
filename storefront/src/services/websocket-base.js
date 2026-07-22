/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * WebSocket Base Service
 * Base class chung cho ERP và Storefront
 * Single source of truth cho WebSocket connection logic
 */

import { io } from 'socket.io-client';

// Hybrid WebSocket URL resolution:
// 1. Ưu tiên VITE_WS_URL nếu được cấu hình
// 2. Tự động suy từ API base URL (hoạt động cả trên Railway lẫn localhost)
// 3. Fallback cuối cùng: localhost an toàn cho dev
const resolveWsUrl = () => {
  const configuredWsUrl = import.meta.env.VITE_WS_URL || import.meta.env.REACT_APP_WS_URL || '';
  if (configuredWsUrl) {
    // Chuyển https:// -> wss://, giữ nguyên ws:// hoặc http:// -> ws://
    return configuredWsUrl.replace('https://', 'wss://').replace('http://', 'ws://');
  }

  // Suy từ API base URL (storefront tự tính API_URL giống như trong api.js)
  const apiUrl = (() => {
    const configuredUrl = import.meta.env.VITE_API_URL || import.meta.env.REACT_APP_API_URL || import.meta.env.VITE_API_BASE_URL || '';
    if (configuredUrl) {
      const normalized = String(configuredUrl).trim().replace(/\/$/, '');
      return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
    }
    if (typeof window !== 'undefined') {
      const { protocol, hostname, origin } = window.location;
      const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname);
      return isLocalHost ? `${protocol}//${hostname}:5000/api` : `${origin}/api`;
    }
    return 'http://localhost:5000/api';
  })();

  const baseWithoutApi = apiUrl.replace(/\/api$/, '');

  if (!baseWithoutApi || baseWithoutApi === '') {
    return 'ws://localhost:5000';
  }

  return baseWithoutApi.replace('https://', 'wss://').replace('http://', 'ws://');
};

const WS_URL_FINAL = resolveWsUrl();

console.log('[WebSocketBase] Resolved WS URL:', WS_URL_FINAL);

export class WebSocketBaseService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
  }

  // Initialize connection
  connect(companyId, userId) {
    if (this.socket) {
      this.disconnect();
    }

    // Lấy access token từ localStorage (storefront dùng localStorage)
    const accessToken = localStorage.getItem('erp_token') || 
                        localStorage.getItem('storefrontAccessToken') || 
                        localStorage.getItem('accessToken') ||
                        localStorage.getItem('token');

    this.socket = io(WS_URL_FINAL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      auth: {
        companyId,
        userId,
        token: accessToken || undefined
      }
    });

    this.setupEventHandlers();
    return this.socket;
  }

  // Setup event handlers - Override this in subclass
  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('WebSocket connected:', this.socket.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connectionStatus', { connected: true });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.isConnected = false;
      this.emit('connectionStatus', { connected: false, reason });
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('WebSocket reconnected after', attemptNumber, 'attempts');
      this.isConnected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('reconnect_error', (error) => {
      this.reconnectAttempts++;
      console.error('Reconnection error:', error);
    });
  }

  // Join company room
  joinCompany(companyId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join-company', companyId);
    }
  }

  // Leave company room
  leaveCompany(companyId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leave-company', companyId);
    }
  }

  // Subscribe to events
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  // Unsubscribe from events
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  // Emit to listeners
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  // Disconnect
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.listeners.clear();
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}