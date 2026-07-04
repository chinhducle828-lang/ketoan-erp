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
export const getClosingRules = () => getBusinessRules().accounting.closing;
export const getGeneralAccountingRules = () => getBusinessRules().accounting.general;
export const getInventoryRules = () => getBusinessRules().accounting.inventory;
export const getCashFlowRules = () => getBusinessRules().reporting.cashFlow;
export const getBalanceSheetRules = () => getBusinessRules().reporting.balanceSheet;
