/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * WebSocket Base Service
 * Base class chung cho ERP và Storefront
 * Single source of truth cho WebSocket connection logic
 */

import { io } from 'socket.io-client';
import { getClientInstanceId } from '../utils/clientInstance.js';

// WebSocket client configuration - Use VITE_ prefix for Vite
const WS_URL = import.meta.env.VITE_WS_URL || import.meta.env.REACT_APP_WS_URL || 'http://localhost:5000';

// Ensure wss:// protocol for production (https -> wss)
const getWsUrl = () => {
  const url = WS_URL;
  if (url.startsWith('https://')) {
    return url.replace('https://', 'wss://');
  }
  return url;
};

const WS_URL_FINAL = getWsUrl();

export class WebSocketBaseService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
    this.clientInstanceId = getClientInstanceId();
  }

  // Initialize connection
  connect(companyId, userId) {
    // Nếu đã kết nối, không disconnect để tránh ảnh hưởng component khác
    if (this.socket && this.isConnected) {
      return this.socket;
    }
    if (this.socket) {
      this.disconnect();
    }

    // Get access token for WebSocket authentication
    const accessToken = localStorage.getItem('accessToken');

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
        clientInstanceId: this.clientInstanceId,
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

  getClientInstanceId() {
    return this.clientInstanceId;
  }
}