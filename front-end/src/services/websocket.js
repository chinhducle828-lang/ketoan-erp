import { io } from 'socket.io-client';

// WebSocket client configuration
const WS_URL = process.env.REACT_APP_WS_URL || 'http://localhost:5000';

class WebSocketService {
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

    this.socket = io(WS_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      auth: {
        companyId,
        userId
      }
    });

    this.setupEventHandlers();
    return this.socket;
  }

  // Setup event handlers
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

    // Business events
    this.socket.on('voucherCreated', (data) => {
      this.emit('voucherCreated', data);
    });

    this.socket.on('voucherUpdated', (data) => {
      this.emit('voucherUpdated', data);
    });

    this.socket.on('orderStatusChanged', (data) => {
      this.emit('orderStatusChanged', data);
    });

    this.socket.on('inventoryUpdated', (data) => {
      this.emit('inventoryUpdated', data);
    });

    this.socket.on('balanceUpdated', (data) => {
      this.emit('balanceUpdated', data);
    });
  }

  // Join company room
  joinCompany(companyId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('joinCompany', companyId);
    }
  }

  // Leave company room
  leaveCompany(companyId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('leaveCompany', companyId);
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

// Singleton instance
const wsService = new WebSocketService();
export default wsService;