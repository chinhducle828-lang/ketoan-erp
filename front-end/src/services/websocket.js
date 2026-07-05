import { WebSocketBaseService } from './websocket-base.js';

class WebSocketService extends WebSocketBaseService {
  // Setup event handlers - Override to add ERP-specific events
  setupEventHandlers() {
    super.setupEventHandlers();

    // ERP-specific business events
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

    this.socket.on('notification:new', (data) => {
      this.emit('notification:new', data);
    });
  }
}

// Singleton instance
const wsService = new WebSocketService();
export default wsService;
