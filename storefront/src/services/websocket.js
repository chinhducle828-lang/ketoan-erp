/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { WebSocketBaseService } from './websocket-base.js';

class WebSocketService extends WebSocketBaseService {
  // Setup event handlers - Override to add Storefront-specific events
  setupEventHandlers() {
    super.setupEventHandlers();

    // Storefront-specific business events
    this.socket.on('orderStatusChanged', (data) => {
      this.emit('orderStatusChanged', data);
    });

    this.socket.on('inventoryUpdated', (data) => {
      this.emit('inventoryUpdated', data);
    });
  }
}

// Singleton instance
const wsService = new WebSocketService();
export default wsService;
