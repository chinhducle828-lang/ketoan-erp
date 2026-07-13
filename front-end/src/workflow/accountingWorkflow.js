/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * Event-driven accounting workflow matrix giữa các phòng ban
 * Multi-tenant: mọi event đều filter by companyId
 */

export const WORKFLOW_EVENTS = Object.freeze({
  VOUCHER_CREATED: 'voucher:created',
  VOUCHER_POSTED: 'voucher:posted',
  VOUCHER_DELETED: 'voucher:deleted',
  CLOSING_COMPLETED: 'closing:completed',
  ORDER_STATUS_CHANGED: 'orderStatusChanged',
  ORDER_CREATED: 'orderCreated',
  INVENTORY_UPDATED: 'inventory:updated',
  PAYROLL_POSTED: 'payroll:posted',
  TAX_CALCULATED: 'tax:calculated',
  PARTNER_UPDATED: 'partner:updated'
});

/**
 * Matrix: event → bút toán liên quan + target views cần invalidate
 */
export const WORKFLOW_MATRIX = {
  [WORKFLOW_EVENTS.VOUCHER_CREATED]: {
    description: 'Phiếu thu/chi mới tạo',
    source: ['finance', 'sales', 'purchasing'],
    target: ['vouchers', 'dashboard'],
    accounts: ['111', '112', '131', '242', '331', '334', '338', '511', '632', '641', '642'],
    after: ['vouchers']
  },
  [WORKFLOW_EVENTS.VOUCHER_POSTED]: {
    description: 'Chứng từ bán hàng/mua hàng được hạch toán',
    source: ['sales', 'purchasing'],
    target: ['vouchers', 'inventory', 'dashboard', 'finance'],
    accounts: ['131', '511', '521', '531', '532', '632', '152', '156', '155', '331', '338', '1331', '3331'],
    after: ['vouchers', 'inventory', 'dashboard']
  },
  [WORKFLOW_EVENTS.CLOSING_COMPLETED]: {
    description: 'Kết chuyển khóa sổ cuối kỳ',
    source: ['finance'],
    target: ['reports', 'dashboard', 'finance', 'sales', 'warehouse', 'hr', 'admin'],
    accounts: ['911', '921', '931', '421', '411', '511', '632', '635', '641', '642', '711', '811', '821', '3334'],
    after: ['reports', 'dashboard']
  },
  [WORKFLOW_EVENTS.ORDER_STATUS_CHANGED]: {
    description: 'Đơn hàng thay đổi trạng thái (logistics)',
    source: ['logistics', 'warehouse'],
    target: ['logistics', 'inventory', 'dashboard', 'vouchers'],
    accounts: ['632', '155', '156', '511', '523'],
    after: ['logistics', 'inventory', 'dashboard']
  },
  [WORKFLOW_EVENTS.ORDER_CREATED]: {
    description: 'Đơn hàng mới tạo',
    source: ['sales'],
    target: ['dashboard', 'orders'],
    accounts: ['131', '511', '632'],
    after: ['dashboard']
  },
  [WORKFLOW_EVENTS.INVENTORY_UPDATED]: {
    description: 'Kho cập nhật số liệu',
    source: ['warehouse'],
    target: ['inventory', 'dashboard', 'finance'],
    accounts: ['151', '152', '153', '155', '156', '157', '158', '154', '632', '621', '622', '627'],
    after: ['inventory', 'dashboard']
  },
  [WORKFLOW_EVENTS.PAYROLL_POSTED]: {
    description: 'Bảng lương đã được duyệt/chốt',
    source: ['hr'],
    target: ['hr', 'vouchers', 'dashboard'],
    accounts: ['334', '3341', '338', '3382', '3383', '3384', '3385', '642', '6421', '6428', '622', '6411'],
    after: ['hr', 'vouchers']
  },
  [WORKFLOW_EVENTS.TAX_CALCULATED]: {
    description: 'Tờ khai thuế tính toán xong',
    source: ['finance'],
    target: ['tax', 'vouchers', 'dashboard'],
    accounts: ['3331', '33311', '3332', '3334', '3335', '3339', '1331', '1332', '511', '521', '811', '821', '8211', '8212'],
    after: ['tax', 'vouchers']
  },
  [WORKFLOW_EVENTS.PARTNER_UPDATED]: {
    description: 'Đối tác KH/NCC thay đổi',
    source: ['sales', 'purchasing'],
    target: ['partners', 'dashboard'],
    accounts: ['131', '331', '511', '632'],
    after: ['partners']
  }
};

/**
 * Tạo workflow middleware cho useRealtimeInvalidation.
 * Dùng trong views để tự động subscribe events phù hợp.
 *
 * @param {Object} options
 * @param {string[]} [options.only] - Danh sách events chỉ lắng nghe
 * @param {string[]} [options.exclude] - Bỏ qua events
 * @param {boolean} [options.enabled=true] - Bật/tắt
 * @param {Function} [options.onBefore] - Hook trước khi emit
 * @param {Function} [options.onAfter] - Hook sau khi invalidate
 * @returns {Object} handlers cho useRealTimeSync / useStorefrontRealtime
 */
export function createWorkflowHandlers(options = {}) {
  const { only, exclude = [], enabled = true, onBefore, onAfter } = options;

  if (!enabled) {
    return {};
  }

  const handlers = {};

  Object.entries(WORKFLOW_MATRIX).forEach(([eventName, config]) => {
    if (only && !only.includes(eventName)) return;
    if (exclude.includes(eventName)) return;

    handlers[eventName] = (payload) => {
      if (typeof onBefore === 'function') {
        onBefore(eventName, payload, config);
      }

      const companyId = payload?.companyId || payload?.company_id;
      if (!companyId) {
        console.warn(`[Workflow] Event ${eventName} thiếu companyId, bỏ qua multi-tenant filter.`);
      }

      if (typeof onAfter === 'function') {
        onAfter(eventName, payload, config, companyId);
      }
    };
  });

  return handlers;
}

/**
 * Lấy danh sách accounts phù hợp với một event.
 * Dùng để preset dropdown account code trong các forms.
 */
export function getAccountsForEvent(eventName) {
  const config = WORKFLOW_MATRIX[eventName];
  if (!config) return [];
  return config.accounts
    .map(code => typeof code === 'string' ? code : String(code))
    .filter(Boolean);
}

/**
 * Lấy danh sách departments tham gia vào event.
 */
export function getDepartmentsForEvent(eventName) {
  const config = WORKFLOW_MATRIX[eventName];
  if (!config) return [];
  return [...new Set((config.source || []).concat(config.target || []))];
}

export default {
  WORKFLOW_EVENTS,
  WORKFLOW_MATRIX,
  createWorkflowHandlers,
  getAccountsForEvent,
  getDepartmentsForEvent
};