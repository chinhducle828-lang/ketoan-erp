/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

// Account Nature Configuration - Dynamic Chart of Accounts
export const ACCOUNT_NATURES = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
  BOTH: 'BOTH'
};

// ====================================================================
// SYSTEM_ACCOUNTS - Central Chart of Accounts Mapping
// ====================================================================
export const SYSTEM_ACCOUNTS = {
  CASH: '1111',
  BANK: '1121',
  BANK_FC: '1122',
  AR: '131',
  AR_INTERNAL: '1368',
  ADVANCE: '141',
  RAW_MATERIAL: '152',
  WIP: '154',
  FINISHED_GOODS: '155',
  MERCHANDISE: '1561',
  TAX_IN: '1331',
  TAX_OUT: '33311',
  AP: '331',
  AP_INTERNAL: '3368',
  PAYROLL: '334',
  INSURANCE: '338',
  UNEARNED_REV: '3387',
  HOLDBACK: '1388',
  ASSET_MISSING: '1381',
  SHORT_TERM_BORROW: '341',
  FOREX_DIFF: '4131',
  REVENUE: '5111',
  FIN_REVENUE: '515',
  COGS: '632',
  FIN_EXPENSE: '635',
  SALES_EXPENSE: '641',
  ADMIN_EXPENSE: '6422',
  DEPRECIATION: '2141',
  DEPRECIATION_EXPENSE: '6274',
  MATERIAL_COST: '621',
  LABOR_COST: '622',
  OVERHEAD_COST: '627',
  OTHER_INCOME: '711',
  REBATE: '521',
  BAD_DEBT_PROVISION: '2293'
};

// ====================================================================
// eventAccountRegistry - Account mapping cho 18 processors
// ====================================================================
export const EVENT_ACCOUNT_REGISTRY = {
  factoring: {
    with_recourse: { debit: ['BANK', 'FIN_EXPENSE', 'TAX_IN'], credit: ['SHORT_TERM_BORROW'] },
    without_recourse: { debit: ['BANK', 'HOLDBACK', 'FIN_EXPENSE', 'TAX_IN'], credit: ['AR'] }
  },
  intercompany: {
    exec: { debit: ['AR_INTERNAL'], credit: ['BANK'] },
    forex_loss: { debit: ['FIN_EXPENSE'], credit: ['AR_INTERNAL'] },
    forex_gain: { debit: ['AR_INTERNAL'], credit: ['FIN_REVENUE'] }
  },
  'quad-party-netting': {
    exec: { debit: ['AP'], credit: ['AR'] }
  },
  'forex-revaluation': {
    asset_gain: { debit: ['*'], credit: ['FOREX_DIFF'] },
    asset_loss: { debit: ['FOREX_DIFF'], credit: ['*'] },
    liability_gain: { debit: ['*'], credit: ['FOREX_DIFF'] },
    liability_loss: { debit: ['FOREX_DIFF'], credit: ['*'] },
    settle_loss: { debit: ['FIN_EXPENSE'], credit: ['FOREX_DIFF'] },
    settle_gain: { debit: ['FOREX_DIFF'], credit: ['FIN_REVENUE'] }
  },
  sale: { revenue: { debit: ['AR'], credit: ['REVENUE', 'TAX_OUT'] } },
  'retroactive-rebate': { exec: { debit: ['REBATE'], credit: ['AR'] } },
  simple_sale: {
    revenue: { debit: ['BANK'], credit: ['REVENUE', 'TAX_OUT'] },
    cogs: { debit: ['COGS'], credit: ['FINISHED_GOODS'] }
  },
  simple_purchase: {
    merchandise: { debit: ['MERCHANDISE', 'TAX_IN'], credit: ['AP'] },
    raw_material: { debit: ['RAW_MATERIAL', 'TAX_IN'], credit: ['AP'] }
  },
  simple_expense: { exec: { debit: ['ADMIN_EXPENSE', 'TAX_IN'], credit: ['CASH'] } },
  sales_credit: {
    revenue: { debit: ['AR'], credit: ['REVENUE', 'TAX_OUT'] },
    cogs: { debit: ['COGS'], credit: ['FINISHED_GOODS'] }
  },
  purchase_with_fee: { exec: { debit: ['MERCHANDISE', 'TAX_IN'], credit: ['AP'] } },
  inventory_transfer: { internal: { debit: ['MERCHANDISE'], credit: ['MERCHANDISE'] } },
  inventory_audit: {
    shortage: { debit: ['ASSET_MISSING'], credit: ['MERCHANDISE'] },
    surplus: { debit: ['MERCHANDISE'], credit: ['OTHER_INCOME'] }
  },
  payroll_distribution: {
    company_share: { debit: ['ADMIN_EXPENSE'], credit: ['PAYROLL', 'INSURANCE'] },
    deduct_worker: { debit: ['PAYROLL'], credit: ['INSURANCE'] }
  },
  manufacturing_cogs: {
    wip_collect: { debit: ['WIP'], credit: ['RAW_MATERIAL', 'PAYROLL', 'OVERHEAD_COST'] },
    finish: { debit: ['FINISHED_GOODS'], credit: ['WIP'] }
  },
  asset_depreciation: { monthly: { debit: ['DEPRECIATION_EXPENSE'], credit: ['DEPRECIATION'] } },
  advance_clearing: {
    request: { debit: ['ADVANCE'], credit: ['CASH'] },
    settle: { debit: ['ADMIN_EXPENSE', 'CASH'], credit: ['ADVANCE'] }
  },
  'early_payment': {
    exec: { debit: ['BANK', 'FIN_EXPENSE'], credit: ['AR'] }
  }
};

export function resolveAccount(key) {
  return SYSTEM_ACCOUNTS[key] || key;
}

export function resolveAccounts(keys) {
  return keys.map(k => resolveAccount(k));
}

export const chartOfAccountsConfig = {
  rules: [
    { prefix: '1', nature: ACCOUNT_NATURES.DEBIT, name: 'Tài sản ngắn hạn' },
    { prefix: '2', nature: ACCOUNT_NATURES.DEBIT, name: 'Tài sản dài hạn' },
    { prefix: '3', nature: ACCOUNT_NATURES.CREDIT, name: 'Nợ phải trả' },
    { prefix: '4', nature: ACCOUNT_NATURES.CREDIT, name: 'Vốn chủ sở hữu' },
    { prefix: '5', nature: ACCOUNT_NATURES.CREDIT, name: 'Doanh thu' },
    { prefix: '6', nature: ACCOUNT_NATURES.DEBIT, name: 'Chi phí sản xuất, kinh doanh' },
    { prefix: '7', nature: ACCOUNT_NATURES.CREDIT, name: 'Thu nhập khác' },
    { prefix: '8', nature: ACCOUNT_NATURES.DEBIT, name: 'Chi phí khác' },
    { prefix: '9', nature: ACCOUNT_NATURES.DEBIT, name: 'Tài khoản ngoài bảng' }
  ],
  exceptions: {
    '131': { nature: ACCOUNT_NATURES.BOTH, name: 'Phải thu của khách hàng' },
    '331': { nature: ACCOUNT_NATURES.BOTH, name: 'Phải trả cho người bán' },
    '138': { nature: ACCOUNT_NATURES.BOTH, name: 'Phải thu khác' },
    '338': { nature: ACCOUNT_NATURES.BOTH, name: 'Phải trả, phải nộp khác' },
    '214': { nature: ACCOUNT_NATURES.CREDIT, name: 'Hao mòn tài sản cố định' },
    '229': { nature: ACCOUNT_NATURES.CREDIT, name: 'Dự phòng tổn thất tài sản' },
    '419': { nature: ACCOUNT_NATURES.DEBIT, name: 'Cổ phiếu quỹ' },
    '521': { nature: ACCOUNT_NATURES.DEBIT, name: 'Chiết khấu thương mại' },
    '531': { nature: ACCOUNT_NATURES.DEBIT, name: 'Hàng bán bị trả lại' },
    '532': { nature: ACCOUNT_NATURES.DEBIT, name: 'Giảm giá hàng bán' },
    '611': { nature: ACCOUNT_NATURES.DEBIT, name: 'Chi phí mua hàng' }
  }
};

export const getAccountNature = (accountCode) => {
  if (!accountCode) return ACCOUNT_NATURES.DEBIT;
  const codeStr = accountCode.toString().trim();
  if (chartOfAccountsConfig.exceptions[codeStr]) return chartOfAccountsConfig.exceptions[codeStr].nature;
  for (let len = codeStr.length; len >= 3; len--) {
    const subCode = codeStr.substring(0, len);
    if (chartOfAccountsConfig.exceptions[subCode]) return chartOfAccountsConfig.exceptions[subCode].nature;
  }
  const matchedRule = chartOfAccountsConfig.rules
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find(rule => codeStr.startsWith(rule.prefix));
  if (matchedRule) return matchedRule.nature;
  return ACCOUNT_NATURES.DEBIT;
};

const DEFAULT_BUSINESS_RULES = {
  pricing: {
    amountPrecision: 2, taxPrecision: 2, defaultTaxRate: 0.08, minOrderQuantity: 1,
    taxRules: [
      { entityType: 'company', annualRevenueBand: 'under_1b', category: 'retail', taxRate: 0.08, priceMode: 'net' },
      { entityType: 'company', annualRevenueBand: '1b_3b', category: 'retail', taxRate: 0.08, priceMode: 'net' },
      { entityType: 'company', annualRevenueBand: 'over_3b', category: 'retail', taxRate: 0.08, priceMode: 'net' },
      { entityType: 'household', annualRevenueBand: 'under_1b', category: 'retail', taxRate: 0, priceMode: 'net' },
      { entityType: 'household', annualRevenueBand: '1b_3b', category: 'retail', taxRate: 0.08, priceMode: 'net' },
      { entityType: 'household', annualRevenueBand: 'over_3b', category: 'retail', taxRate: 0.08, priceMode: 'net' },
      { entityType: 'cooperative', annualRevenueBand: '', category: 'retail', taxRate: 0.08, priceMode: 'net' },
      { entityType: 'company', annualRevenueBand: '', category: 'service', taxRate: 0.1, priceMode: 'net' },
      { entityType: 'household', annualRevenueBand: '', category: 'service', taxRate: 0.08, priceMode: 'net' },
    ]
  },
  voucher: { storefrontPrefix: 'WEB', saleVoucherType: 'XK', defaultLoadingStatus: 'pending_loading' },
  legal: { privacyPolicyVersion: '2.0', termsVersion: '2.0', paymentProceduresVersion: '2.0', refundPolicyVersion: '2.0', dpoName: '[TÊN DPO]', dpoEmail: '[EMAIL DPO]', dpoPhone: '[SỐ ĐIỆN THOẠI DPO]', dataRetentionDays: 3650, complaintProcessingDays: 15 },
  integration: { orderIngestion: { queueName: 'order-ingestion', sagaPrefix: 'order-ingestion', defaultCurrency: 'VND' } },
  accounting: {
    general: { hermaphroditicAccounts: ['131', '331', '138', '338', '3334', '3335', '3381'] },
    sale: { receivableAccount: '131', revenueAccount: '511', vatAccount: '3331', cogsAccount: '632', inventoryAccount: '156', logisticsOpsAccount: '156_OPS', legacyAccountDrFallback: ['131', '111', '112'], legacyAccountCrFallback: ['511', '3331', '33311', '131'], excludeFinancialEntriesForStorefront: [] },
    closing: {
      voucherType: 'DauKy', defaultTaxRate: 0.2,
      progressiveTaxBrackets: [{ maxRevenue: 3000000000, rate: 0.15 }, { maxRevenue: 50000000000, rate: 0.17 }, { maxRevenue: null, rate: 0.2 }],
      accounts: { revenue: '511', cost: ['632', '641', '642'], otherIncome: '711', otherExpense: '811', taxExpense: '821', closing: '911', corporateTaxPayable: '3334', retainedEarnings: '4212', prepaidExpense: '242', prepaidExpenseAllocation: '642', fixedAsset: '211', depreciationExpense: '611', accumulatedDepreciation: '214', receivable: '131', provisionExpense: '635', doubtfulDebtProvision: '335', biologicalAsset: '215', biologicalProvision: '2295', personalIncomeTaxPayable: '3331', vatPayable: '33311', taxPaymentOffset: '331' },
      rates: { depreciationAnnualRate: 0.2, doubtfulDebtProvisionRate: 0.1, biologicalProvisionRate: 0.05 }
    },
    inventory: { inboundVoucherType: 'NK', outboundVoucherType: 'XK', allocationVoucherType: 'DauKy', accounts: { inventory: '156', logistics: '1562', logisticsCost: ['632', '641', '642'], allocationCredit: '632' } }
  },
  reporting: {
    cashFlow: {
      cashAccountPrefixes: ['111', '112'],
      directMethod: { salesCounterpartPrefixes: ['511', '3331', '131'], supplierPaymentCounterpartPrefixes: ['331', '152', '156', '242'], salaryCounterpartPrefixes: ['334'] },
      indirectMethod: { revenuePrefixes: ['5'], expensePrefixes: ['6'], otherIncomePrefixes: ['7'], otherExpensePrefixes: ['8'], depreciationPrefixes: ['214'], provisionPrefixes: ['2293', '2294', '2295'], accountsReceivablePrefixes: ['131'], inventoryPrefixes: ['152'], accountsPayablePrefixes: ['331'], financingPrefixes: ['341'] }
    },
    balanceSheet: {
      customerDualAccounts: { receivable: '131', customerAdvance: '312', payable: '331' },
      depreciation: { sourcePrefix: '214', displayAccountCode: '223' },
      taxAccounts: ['3331', '3334', '3339'],
      taxAccountNames: { '3331': 'Thuế GTGT', '3334': 'Thuế TNDN', '3339': 'Thuế môn bài' },
      accountGroups: { assetPrefixes: ['1', '2'], liabilityPrefixes: ['3'], equityPrefixes: ['4'], excludeAssetPrefixes: ['214', '223'] }
    }
  }
};

const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const deepMerge = (base, override) => {
  if (!isObject(base)) return override;
  if (!isObject(override)) return base;
  const output = { ...base };
  for (const [key, overrideValue] of Object.entries(override)) {
    const baseValue = output[key];
    if (isObject(baseValue) && isObject(overrideValue)) {
      output[key] = deepMerge(baseValue, overrideValue);
    } else {
      output[key] = overrideValue;
    }
  }
  return output;
};

let cachedRules = null;

const parseRulesFromEnv = () => {
  const raw = process.env.BUSINESS_RULES_JSON;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return isObject(parsed) ? parsed : {};
  } catch { return {}; }
};

export const getBusinessRules = () => {
  if (cachedRules) return cachedRules;
  const envRules = parseRulesFromEnv();
  cachedRules = deepMerge(DEFAULT_BUSINESS_RULES, envRules);
  return cachedRules;
};

export const resetBusinessRulesCache = () => { cachedRules = null; };
export const getSaleRules = () => getBusinessRules().accounting.sale;
export const getAccountDictionary = () => ({
  '111': 'Tiền mặt tại quỹ', '112': 'Tiền gửi Ngân hàng', '131': 'Phải thu của khách hàng',
  '138': 'Phải thu khác', '141': 'Tạm ứng', '152': 'Nguyên liệu, vật liệu tồn kho',
  '153': 'Công cụ, dụng cụ', '156': 'Hàng hóa kho tổng', '211': 'Tài sản cố định hữu hình',
  '214': 'Hao mòn tài sản cố định', '215': 'Tài sản sinh học', '229': 'Dự phòng tổn thất tài sản',
  '331': 'Phải trả cho người bán', '333': 'Thuế và các khoản phải nộp Nhà nước',
  '334': 'Phải trả người lao động', '338': 'Phải trả, phải nộp khác', '341': 'Vay và nợ thuê tài chính',
  '411': 'Vốn đầu tư của chủ sở hữu', '418': 'Quỹ đầu tư phát triển', '421': 'Lợi nhuận sau thuế chưa phân phối',
  '511': 'Doanh thu bán hàng', '515': 'Doanh thu hoạt động tài chính', '632': 'Giá vốn hàng bán',
  '635': 'Chi phí bán hàng', '641': 'Chi phí quản lý doanh nghiệp', '642': 'Chi phí sản xuất, kinh doanh',
  '711': 'Thu nhập khác', '811': 'Chi phí khác', '821': 'Chi phí thuế TNDN'
});

export const getOrderIngestionRules = () => ({
  queueName: getBusinessRules().integration?.orderIngestion?.queueName || 'order-ingestion',
  sagaPrefix: getBusinessRules().integration?.orderIngestion?.sagaPrefix || 'order-ingestion',
  defaultCurrency: getBusinessRules().integration?.orderIngestion?.defaultCurrency || 'VND'
});

export const getClosingRules = () => {
  const rules = getBusinessRules().accounting.closing;
  if (!rules?.accounts?.cost || !Array.isArray(rules.accounts.cost) || rules.accounts.cost.length === 0) {
    return { ...rules, accounts: { ...rules?.accounts, cost: ['632', '641', '642'] } };
  }
  return rules;
};

export const getGeneralAccountingRules = () => getBusinessRules().accounting.general;
export const getInventoryRules = () => {
  const rules = getBusinessRules().accounting.inventory;
  if (!rules?.accounts?.logisticsCost || !Array.isArray(rules.accounts.logisticsCost) || rules.accounts.logisticsCost.length === 0) {
    return { ...rules, accounts: { ...rules?.accounts, logisticsCost: ['632', '641', '642'] } };
  }
  return rules;
};

export const getCashFlowRules = () => {
  const rules = getBusinessRules().reporting.cashFlow;
  if (!rules?.cashAccountPrefixes || !Array.isArray(rules.cashAccountPrefixes) || rules.cashAccountPrefixes.length === 0) {
    return { ...rules, cashAccountPrefixes: ['111', '112'] };
  }
  return rules;
};

export const getBalanceSheetRules = () => getBusinessRules().reporting.balanceSheet;

export const getLogisticsRules = () => {
  const rules = getBusinessRules();
  return { saleVoucherType: rules.voucher?.saleVoucherType || 'XK' };
};

export const validateBusinessRules = (rules) => {
  const errors = [];
  if (rules?.accounting?.closing?.progressiveTaxBrackets) {
    const brackets = rules.accounting.closing.progressiveTaxBrackets;
    if (!Array.isArray(brackets)) { errors.push('accounting.closing.progressiveTaxBrackets must be an array'); }
    else {
      brackets.forEach((bracket, idx) => {
        if (typeof bracket.rate !== 'number' || !Number.isFinite(bracket.rate)) { errors.push(`brackets[${idx}].rate must be a valid number`); }
        if (bracket.maxRevenue !== null && bracket.maxRevenue !== undefined && (typeof bracket.maxRevenue !== 'number' || !Number.isFinite(bracket.maxRevenue))) { errors.push(`brackets[${idx}].maxRevenue must be a valid number or null`); }
      });
    }
  }
  if (rules?.accounting?.inventory?.accounts) {
    if (rules.accounting.inventory.accounts.logisticsCost && !Array.isArray(rules.accounting.inventory.accounts.logisticsCost)) { errors.push('accounting.inventory.accounts.logisticsCost must be an array'); }
  }
  if (rules?.accounting?.closing?.accounts) {
    if (rules.accounting.closing.accounts.cost && !Array.isArray(rules.accounting.closing.accounts.cost)) { errors.push('accounting.closing.accounts.cost must be an array'); }
  }
  return errors;
};

// ====================================================================
// UI Schema Configuration
// ====================================================================
export const getUISchemaConfig = () => ({
  rea_subtypes: {
    'factoring': {
      layout: { columns: 2, sections: ['Thông tin chung', 'Chi tiết tài chính', 'Hạch toán'] },
      fields: [
        { id: 'partner_id', label: 'Ngân hàng', type: 'SELECT', section: 'Thông tin chung', required: true, dataSource: { api: '/api/partners', filter: { type: 'FACTORING_BANK' } } },
        { id: 'invoice_amount', label: 'Giá trị hóa đơn', type: 'CURRENCY', section: 'Chi tiết tài chính', required: true, min: 0 },
        { id: 'advance_rate', label: 'Tỷ lệ ứng trước (%)', type: 'PERCENT', section: 'Chi tiết tài chính', dependsOn: { field: 'partner_id', action: 'fetchPartnerRate' }, defaultValue: 0.8 },
        { id: 'fee_rate', label: 'Phí factoring (%)', type: 'PERCENT', section: 'Chi tiết tài chính', defaultValue: 0.01 },
        { id: 'recourse', label: 'Có truy đòi', type: 'RADIO', section: 'Hạch toán', options: [{ value: true, label: 'Có truy đòi' }, { value: false, label: 'Không truy đòi' }] }
      ]
    },
    'intercompany': {
      layout: { columns: 2, sections: ['Thông tin giao dịch', 'Hạch toán'] },
      fields: [
        { id: 'from_entity', label: 'Công ty chuyển', type: 'SELECT_COMPANY', required: true, section: 'Thông tin giao dịch' },
        { id: 'to_entity', label: 'Công ty nhận', type: 'SELECT_COMPANY', required: true, section: 'Thông tin giao dịch' },
        { id: 'amount', label: 'Số tiền', type: 'CURRENCY', required: true, section: 'Thông tin giao dịch', min: 0 },
        { id: 'currency', label: 'Loại tiền', type: 'SELECT_CURRENCY', required: true, section: 'Thông tin giao dịch', options: [{ value: 'VND', label: 'VND' }, { value: 'USD', label: 'USD' }] }
      ]
    },
    'sale': {
      layout: { columns: 2, sections: ['Thông tin bán hàng', 'Hạch toán'] },
      fields: [
        { id: 'partner_id', label: 'Khách hàng', type: 'SELECT', section: 'Thông tin bán hàng', required: true, dataSource: { api: '/api/partners', filter: { type: 'customer' } } },
        { id: 'items', label: 'Sản phẩm', type: 'SUB_GRID', section: 'Thông tin bán hàng', subFields: [
          { id: 'item_id', label: 'Mặt hàng', type: 'SELECT_ITEM', required: true },
          { id: 'quantity', label: 'Số lượng', type: 'NUMBER', required: true, min: 1 },
          { id: 'unit_price', label: 'Đơn giá', type: 'CURRENCY', required: true }
        ] },
        { id: 'vat_rate', label: 'Thuế GTGT', type: 'PERCENT', defaultValue: 0.08 }
      ]
    },
    'simple_sale': {
      layout: { columns: 2, sections: ['Thông tin bán hàng', 'Hạch toán'] },
      fields: [
        { id: 'partner_id', label: 'Khách hàng', type: 'SELECT', required: true, dataSource: { api: '/api/partners', filter: { type: 'customer' } } },
        { id: 'items', label: 'Sản phẩm', type: 'SUB_GRID', subFields: [
          { id: 'name', label: 'Tên', type: 'TEXT', required: true },
          { id: 'quantity', label: 'SL', type: 'NUMBER', required: true, min: 1 },
          { id: 'unit_price', label: 'Đơn giá', type: 'CURRENCY', required: true },
          { id: 'cost_price', label: 'Giá vốn', type: 'CURRENCY', required: true }
        ] },
        { id: 'vat_rate', label: 'Thuế GTGT', type: 'PERCENT', defaultValue: 0.1 }
      ]
    },
    'dynamic': {
      layout: { columns: 2, sections: ['Thông tin chung'] },
      fields: [
        { id: 'description', label: 'Mô tả', type: 'TEXT', section: 'Thông tin chung', required: false },
        { id: 'amount', label: 'Số tiền', type: 'CURRENCY', section: 'Thông tin chung', required: false, min: 0 },
        { id: 'partner_id', label: 'Đối tác', type: 'SELECT', section: 'Thông tin chung', required: false, dataSource: { api: '/api/partners' } },
        { id: 'notes', label: 'Ghi chú', type: 'TEXT', section: 'Thông tin chung', required: false }
      ]
    }
  }
});

export const getAccountingRules = () => ({
  factoring: { feeAccount: '635', vatAccount: '1331', advanceAccount: '1121', loanAccount: '341', arAccount: '131', holdbackAccount: '1388', feeRateSource: 'pricing.defaultTaxRate', vatRateSource: 'pricing.defaultTaxRate' },
  netting: { algorithm: 'circular', receivableAccount: '131', payableAccount: '331', minMethod: 'chain_min' },
  forex: {
    rateTypeMapping: [
      { accountPrefix: '112', rateType: 'buy', nature: 'ASSET' },
      { accountPrefix: '131', rateType: 'buy', nature: 'ASSET' },
      { accountPrefix: '331', rateType: 'sell', nature: 'LIABILITY' }
    ],
    intermediateAccount: '4131', lossAccount: '635', gainAccount: '515'
  },
  creditConfig: {
    defaultLimit: 500000000,
    frozenStatus: 'Frozen',
    approvedStatus: 'Approved',
    arAccount: '131'
  },
  earlyPayment: {
    discountRate: 0.02,
    bankAccount: '1121',
    expenseAccount: '635',
    arAccount: '131',
    minEarlyDays: 15
  }
});
