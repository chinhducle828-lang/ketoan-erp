const DEFAULT_BUSINESS_RULES = {
  pricing: {
    amountPrecision: 2,
    taxPrecision: 2,
    defaultTaxRate: 0.1,
    minOrderQuantity: 1
  },
  voucher: {
    storefrontPrefix: 'WEB',
    saleVoucherType: 'XK',
    defaultLoadingStatus: 'pending_loading'
  },
  integration: {
    orderIngestion: {
      queueName: 'order-ingestion',
      sagaPrefix: 'order-ingestion',
      defaultCurrency: 'VND'
    }
  },
  accounting: {
    general: {
      hermaphroditicAccounts: ['131', '331', '138', '338', '3334', '3335', '3381']
    },
    sale: {
      receivableAccount: '131',
      revenueAccount: '511',
      vatAccount: '3331',
      cogsAccount: '632',
      inventoryAccount: '156',
      logisticsOpsAccount: '156_OPS',
      legacyAccountDrFallback: ['131', '111', '112'],
      legacyAccountCrFallback: ['511', '3331', '33311', '131'],
      excludeFinancialEntriesForStorefront: ['632', '156']
    },
    closing: {
      voucherType: 'DauKy',
      defaultTaxRate: 0.2,
      progressiveTaxBrackets: [
        { maxRevenue: 3000000000, rate: 0.15 },
        { maxRevenue: 50000000000, rate: 0.17 },
        { maxRevenue: null, rate: 0.2 }
      ],
      accounts: {
        revenue: '511',
        cost: ['632', '641', '642'],
        otherIncome: '711',
        otherExpense: '811',
        taxExpense: '821',
        closing: '911',
        corporateTaxPayable: '3334',
        retainedEarnings: '4212',
        prepaidExpense: '242',
        prepaidExpenseAllocation: '642',
        fixedAsset: '211',
        depreciationExpense: '611',
        accumulatedDepreciation: '214',
        receivable: '131',
        provisionExpense: '635',
        doubtfulDebtProvision: '335',
        biologicalAsset: '215',
        biologicalProvision: '2295',
        personalIncomeTaxPayable: '3331',
        vatPayable: '33311',
        taxPaymentOffset: '331'
      },
      rates: {
        depreciationAnnualRate: 0.2,
        doubtfulDebtProvisionRate: 0.1,
        biologicalProvisionRate: 0.05
      }
    },
    inventory: {
      inboundVoucherType: 'NK',
      outboundVoucherType: 'XK',
      allocationVoucherType: 'DauKy',
      accounts: {
        inventory: '156',
        logistics: '1562',
        logisticsCost: ['632', '641', '642'],
        allocationCredit: '632'
      }
    }
  },
  reporting: {
    cashFlow: {
      cashAccountPrefixes: ['111', '112'],
      directMethod: {
        salesCounterpartPrefixes: ['511', '3331', '131'],
        supplierPaymentCounterpartPrefixes: ['331', '152', '156', '242'],
        salaryCounterpartPrefixes: ['334']
      },
      indirectMethod: {
        revenuePrefixes: ['5'],
        expensePrefixes: ['6'],
        otherIncomePrefixes: ['7'],
        otherExpensePrefixes: ['8'],
        depreciationPrefixes: ['214'],
        provisionPrefixes: ['2293', '2294', '2295'],
        accountsReceivablePrefixes: ['131'],
        inventoryPrefixes: ['152'],
        accountsPayablePrefixes: ['331'],
        financingPrefixes: ['341']
      }
    },
    balanceSheet: {
      customerDualAccounts: {
        receivable: '131',
        customerAdvance: '312',
        payable: '331'
      },
      depreciation: {
        sourcePrefix: '214',
        displayAccountCode: '223'
      },
      taxAccounts: ['3331', '3334', '3339'],
      taxAccountNames: {
        '3331': 'Thuế GTGT',
        '3334': 'Thuế TNDN',
        '3339': 'Thuế môn bài'
      },
      accountGroups: {
        assetPrefixes: ['1', '2'],
        liabilityPrefixes: ['3'],
        equityPrefixes: ['4'],
        excludeAssetPrefixes: ['214', '223']
      }
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
  } catch {
    return {};
  }
};

export const getBusinessRules = () => {
  if (cachedRules) return cachedRules;
  const envRules = parseRulesFromEnv();
  cachedRules = deepMerge(DEFAULT_BUSINESS_RULES, envRules);
  return cachedRules;
};

export const resetBusinessRulesCache = () => {
  cachedRules = null;
};

export const getSaleRules = () => getBusinessRules().accounting.sale;

/**
 * Get dynamic account dictionary for chart of accounts
 * FIX 3: Centralized account mapping for scalability
 */
export const getAccountDictionary = () => ({
  '111': 'Tiền mặt tại quỹ',
  '112': 'Tiền gửi Ngân hàng',
  '131': 'Phải thu của khách hàng',
  '138': 'Phải thu khác',
  '141': 'Tạm ứng',
  '152': 'Nguyên liệu, vật liệu tồn kho',
  '153': 'Công cụ, dụng cụ',
  '156': 'Hàng hóa kho tổng',
  '211': 'Tài sản cố định hữu hình',
  '214': 'Hao mòn tài sản cố định',
  '215': 'Tài sản sinh học',
  '229': 'Dự phòng tổn thất tài sản',
  '331': 'Phải trả cho người bán',
  '333': 'Thuế và các khoản phải nộp Nhà nước',
  '334': 'Phải trả người lao động',
  '338': 'Phải trả, phải nộp khác',
  '341': 'Vay và nợ thuê tài chính',
  '411': 'Vốn đầu tư của chủ sở hữu',
  '418': 'Quỹ đầu tư phát triển',
  '421': 'Lợi nhuận sau thuế chưa phân phối',
  '511': 'Doanh thu bán hàng',
  '515': 'Doanh thu hoạt động tài chính',
  '632': 'Giá vốn hàng bán',
  '635': 'Chi phí bán hàng',
  '641': 'Chi phí quản lý doanh nghiệp',
  '642': 'Chi phí sản xuất, kinh doanh',
  '711': 'Thu nhập khác',
  '811': 'Chi phí khác',
  '821': 'Chi phí thuế TNDN'
});
export const getOrderIngestionRules = () => ({
  queueName: getBusinessRules().integration?.orderIngestion?.queueName || 'order-ingestion',
  sagaPrefix: getBusinessRules().integration?.orderIngestion?.sagaPrefix || 'order-ingestion',
  defaultCurrency: getBusinessRules().integration?.orderIngestion?.defaultCurrency || 'VND'
});
export const getClosingRules = () => {
  const rules = getBusinessRules().accounting.closing;
  // Apply fallback for cost if null/empty
  if (!rules?.accounts?.cost || !Array.isArray(rules.accounts.cost) || rules.accounts.cost.length === 0) {
    return {
      ...rules,
      accounts: {
        ...rules?.accounts,
        cost: ['632', '641', '642']
      }
    };
  }
  return rules;
};
export const getGeneralAccountingRules = () => getBusinessRules().accounting.general;
export const getInventoryRules = () => {
  const rules = getBusinessRules().accounting.inventory;
  // Apply fallback for logisticsCost if null/empty
  if (!rules?.accounts?.logisticsCost || !Array.isArray(rules.accounts.logisticsCost) || rules.accounts.logisticsCost.length === 0) {
    return {
      ...rules,
      accounts: {
        ...rules?.accounts,
        logisticsCost: ['632', '641', '642']
      }
    };
  }
  return rules;
};
export const getCashFlowRules = () => {
  const rules = getBusinessRules().reporting.cashFlow;
  // Apply fallback for cashAccountPrefixes if null/empty
  if (!rules?.cashAccountPrefixes || !Array.isArray(rules.cashAccountPrefixes) || rules.cashAccountPrefixes.length === 0) {
    return {
      ...rules,
      cashAccountPrefixes: ['111', '112']
    };
  }
  return rules;
};
export const getBalanceSheetRules = () => getBusinessRules().reporting.balanceSheet;

// Logistics rules - for voucher type configuration
export const getLogisticsRules = () => {
  const rules = getBusinessRules();
  return {
    saleVoucherType: rules.voucher?.saleVoucherType || 'XK'
  };
};

// Validation for BUSINESS_RULES_JSON configuration
export const validateBusinessRules = (rules) => {
  const errors = [];
  
  // Validate progressiveTaxBrackets
  if (rules?.accounting?.closing?.progressiveTaxBrackets) {
    const brackets = rules.accounting.closing.progressiveTaxBrackets;
    if (!Array.isArray(brackets)) {
      errors.push('accounting.closing.progressiveTaxBrackets must be an array');
    } else {
      brackets.forEach((bracket, idx) => {
        if (typeof bracket.rate !== 'number' || !Number.isFinite(bracket.rate)) {
          errors.push(`accounting.closing.progressiveTaxBrackets[${idx}].rate must be a valid number`);
        }
        if (bracket.maxRevenue !== null && bracket.maxRevenue !== undefined && 
            (typeof bracket.maxRevenue !== 'number' || !Number.isFinite(bracket.maxRevenue))) {
          errors.push(`accounting.closing.progressiveTaxBrackets[${idx}].maxRevenue must be a valid number or null`);
        }
      });
    }
  }
  
  // Validate inventory accounts
  if (rules?.accounting?.inventory?.accounts) {
    const accounts = rules.accounting.inventory.accounts;
    if (accounts.logisticsCost && !Array.isArray(accounts.logisticsCost)) {
      errors.push('accounting.inventory.accounts.logisticsCost must be an array');
    }
  }
  
  // Validate closing accounts
  if (rules?.accounting?.closing?.accounts) {
    const accounts = rules.accounting.closing.accounts;
    if (accounts.cost && !Array.isArray(accounts.cost)) {
      errors.push('accounting.closing.accounts.cost must be an array');
    }
  }
  
  return errors;
};
