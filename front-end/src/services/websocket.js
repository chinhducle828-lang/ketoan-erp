import { WebSocketBaseService } from './websocket-base.js';

class WebSocketService extends WebSocketBaseService {
  // Setup event handlers - Override to add ERP-specific events
  setupEventHandlers() {
    super.setupEventHandlers();

    const bridgeEvent = (socketEvent, internalEvents = []) => {
      this.socket.on(socketEvent, (data) => {
        const targets = [socketEvent, ...internalEvents];
        targets.forEach((eventName) => this.emit(eventName, data));
      });
    };

    // Voucher events (legacy + new naming)
    bridgeEvent('voucherCreated', ['voucher:created']);
    bridgeEvent('voucherUpdated', ['voucher:updated']);
    bridgeEvent('voucherDeleted', ['voucher:deleted']);
    bridgeEvent('voucherPosted', ['voucher:posted']);
    bridgeEvent('voucher:created', ['voucherCreated']);
    bridgeEvent('voucher:updated', ['voucherUpdated']);
    bridgeEvent('voucher:deleted', ['voucherDeleted']);
    bridgeEvent('voucher:posted', ['voucherPosted']);

    // Closing events
    bridgeEvent('closingCompleted', ['closing:completed']);
    bridgeEvent('closing:completed', ['closingCompleted']);

    // Inventory events
    bridgeEvent('inventoryUpdated', ['inventory:updated']);
    bridgeEvent('inventory:updated', ['inventoryUpdated']);

    // Partner events
    bridgeEvent('partnerUpdated', ['partner:updated']);
    bridgeEvent('partner:updated', ['partnerUpdated']);

    // Existing events
    bridgeEvent('orderStatusChanged');
    bridgeEvent('balanceUpdated');
    bridgeEvent('notification:new');
  }
}

// Singleton instance
const wsService = new WebSocketService();
export default wsService;
