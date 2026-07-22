/**
 * formsConfig/index.js - Barrel export cho tất cả UI Schema definitions
 * 
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

// Import tất cả formsConfig files
import simple_purchase from './simple_purchase.js';
import sale from './sale.js';
import manufacturing from './manufacturing.js';
import early_payment from './early_payment.js';
import simple_expense from './simple_expense.js';
import payroll_distribution from './payroll_distribution.js';
import asset_depreciation from './asset_depreciation.js';
import advance_clearing from './advance_clearing.js';
import inventory_audit from './inventory_audit.js';
import purchase_with_fee from './purchase_with_fee.js';
import retroactive_rebate from './retroactive_rebate.js';
import factoring from './factoring.js';
import quad_party_netting from './quad_party_netting.js';
import forex_revaluation from './forex_revaluation.js';
import sales_credit from './sales_credit.js';
import sales_return from './sales_return.js';
import purchase_return from './purchase_return.js';
import transfer from './transfer.js';

/**
 * Registry mapping eventType → UI Schema config
 * Dùng cho DynamicForm và TaskForm
 */
export const FORMS_CONFIG_REGISTRY = {
  simple_purchase,
  sale,
  manufacturing,
  early_payment,
  simple_expense,
  payroll_distribution,
  asset_depreciation,
  advance_clearing,
  inventory_audit,
  purchase_with_fee,
  retroactive_rebate,
  factoring,
  quad_party_netting,
  forex_revaluation,
  sales_credit,
  sales_return,
  purchase_return,
  transfer
};

/**
 * Lấy UI Schema config cho eventType cụ thể
 * @param {string} eventType - Loại nghiệp vụ
 * @returns {Object|undefined} UI Schema config
 */
export const getFormConfig = (eventType) => {
  return FORMS_CONFIG_REGISTRY[eventType];
};

/**
 * Lấy danh sách tất cả eventTypes có sẵn
 * @returns {Array<string>} Danh sách eventTypes
 */
export const getAvailableEventTypes = () => {
  return Object.keys(FORMS_CONFIG_REGISTRY);
};

/**
 * Lấy danh sách eventTypes theo department
 * @param {string} department - Phòng ban ('finance', 'warehouse', 'hr', ...)
 * @returns {Array<string>} Danh sách eventTypes
 */
export const getEventTypesByDepartment = (department) => {
  const departmentMap = {
    finance: [
      'simple_purchase',
      'sale',
      'early_payment',
      'simple_expense',
      'asset_depreciation',
      'advance_clearing',
      'inventory_audit',
      'purchase_with_fee',
      'retroactive_rebate',
      'factoring',
      'quad_party_netting',
      'forex_revaluation',
      'sales_credit',
      'sales_return',
      'purchase_return',
      'transfer'
    ],
    warehouse: [
      'simple_purchase',
      'inventory_audit',
      'transfer',
      'sales_return',
      'purchase_return'
    ],
    hr: [
      'payroll_distribution',
      'advance_clearing'
    ],
    manufacturing: [
      'manufacturing',
      'simple_purchase',
      'sale'
    ]
  };
  
  return departmentMap[department] || [];
};

/**
 * Validate eventType có tồn tại trong registry
 * @param {string} eventType - Loại nghiệp vụ
 * @returns {boolean} True nếu tồn tại
 */
export const isValidEventType = (eventType) => {
  return eventType in FORMS_CONFIG_REGISTRY;
};

// Export tất cả configs individually (for backward compatibility)
export {
  simple_purchase,
  sale,
  manufacturing,
  early_payment,
  simple_expense,
  payroll_distribution,
  asset_depreciation,
  advance_clearing,
  inventory_audit,
  purchase_with_fee,
  retroactive_rebate,
  factoring,
  quad_party_netting,
  forex_revaluation,
  sales_credit,
  sales_return,
  purchase_return,
  transfer
};