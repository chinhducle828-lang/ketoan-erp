import { publishToCompany } from './websocket.service.js';

const EVENT_NAME_MAP = {
  created: ['voucher:created', 'voucherCreated'],
  updated: ['voucher:updated', 'voucherUpdated'],
  deleted: ['voucher:deleted', 'voucherDeleted'],
  posted: ['voucher:posted', 'voucherPosted'],
  closing_completed: ['closing:completed', 'closingCompleted'],
  inventory_updated: ['inventory:updated', 'inventoryUpdated'],
  partner_updated: ['partner:updated', 'partnerUpdated']
};

const toNumberOrNull = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function publishCompanyEvents(companyId, eventNames, payload) {
  if (!companyId || !Array.isArray(eventNames) || eventNames.length === 0) {
    return;
  }

  for (const eventName of eventNames) {
    publishToCompany(companyId, eventName, payload);
  }
}

export function emitVoucherRealtime(action, payload = {}) {
  const eventNames = EVENT_NAME_MAP[action] || [];
  const companyId = toNumberOrNull(payload.companyId || payload.company_id);
  const eventPayload = {
    timestamp: Date.now(),
    action,
    ...payload,
    companyId,
    company_id: companyId
  };

  publishCompanyEvents(companyId, eventNames, eventPayload);
}

export function emitInventoryRealtime(payload = {}) {
  emitVoucherRealtime('inventory_updated', payload);
}

export function emitClosingRealtime(payload = {}) {
  emitVoucherRealtime('closing_completed', payload);
}

export function emitPartnerRealtime(payload = {}) {
  emitVoucherRealtime('partner_updated', payload);
}
