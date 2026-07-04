import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

async function loadBusinessRulesModule(rulesOverride) {
  if (rulesOverride === undefined) {
    delete process.env.BUSINESS_RULES_JSON;
  } else {
    process.env.BUSINESS_RULES_JSON = JSON.stringify(rulesOverride);
  }

  jest.resetModules();
  return import('../config/businessRules.js');
}

beforeEach(() => {
  delete process.env.BUSINESS_RULES_JSON;
  jest.resetModules();
});

afterEach(() => {
  delete process.env.BUSINESS_RULES_JSON;
});

describe('cash flow rules with default values', () => {
  test('returns default cash flow rules when no override', async () => {
    const { getCashFlowRules } = await loadBusinessRulesModule();
    
    expect(getCashFlowRules().cashAccountPrefixes).toEqual(['111', '112']);
    expect(getCashFlowRules().directMethod.salesCounterpartPrefixes).toEqual(['511', '3331', '131']);
    expect(getCashFlowRules().directMethod.supplierPaymentCounterpartPrefixes).toEqual(['331', '152', '156', '242']);
    expect(getCashFlowRules().indirectMethod.revenuePrefixes).toEqual(['5']);
    expect(getCashFlowRules().indirectMethod.expensePrefixes).toEqual(['6']);
  });

  test('applies cash flow rules override from BUSINESS_RULES_JSON', async () => {
    const { getCashFlowRules } = await loadBusinessRulesModule({
      reporting: {
        cashFlow: {
          cashAccountPrefixes: ['1111', '1121'],
          directMethod: {
            salesCounterpartPrefixes: ['5111', '33311']
          },
          indirectMethod: {
            revenuePrefixes: ['51', '52']
          }
        }
      }
    });

    expect(getCashFlowRules().cashAccountPrefixes).toEqual(['1111', '1121']);
    expect(getCashFlowRules().directMethod.salesCounterpartPrefixes).toEqual(['5111', '33311']);
    expect(getCashFlowRules().indirectMethod.revenuePrefixes).toEqual(['51', '52']);
  });
});

describe('cash flow rules edge cases', () => {
  test('handles missing directMethod with fallback', async () => {
    const { getCashFlowRules } = await loadBusinessRulesModule({
      reporting: {
        cashFlow: {
          cashAccountPrefixes: ['111']
        }
      }
    });

    // Should have fallback for missing directMethod
    expect(getCashFlowRules().directMethod.salesCounterpartPrefixes).toEqual(['511', '3331', '131']);
  });

  test('handles null cashAccountPrefixes with fallback', async () => {
    const { getCashFlowRules } = await loadBusinessRulesModule({
      reporting: {
        cashFlow: {
          cashAccountPrefixes: null
        }
      }
    });

    // Should have fallback
    expect(getCashFlowRules().cashAccountPrefixes).toEqual(['111', '112']);
  });

  test('handles empty cashAccountPrefixes with fallback', async () => {
    const { getCashFlowRules } = await loadBusinessRulesModule({
      reporting: {
        cashFlow: {
          cashAccountPrefixes: []
        }
      }
    });

    // Should have fallback
    expect(getCashFlowRules().cashAccountPrefixes).toEqual(['111', '112']);
  });
});

describe('balance sheet rules with default values', () => {
  test('returns default balance sheet rules when no override', async () => {
    const { getBalanceSheetRules } = await loadBusinessRulesModule();
    
    expect(getBalanceSheetRules().customerDualAccounts.receivable).toBe('131');
    expect(getBalanceSheetRules().customerDualAccounts.customerAdvance).toBe('312');
    expect(getBalanceSheetRules().depreciation.sourcePrefix).toBe('214');
    expect(getBalanceSheetRules().depreciation.displayAccountCode).toBe('223');
    expect(getBalanceSheetRules().taxAccounts).toEqual(['3331', '3334', '3339']);
  });

  test('applies balance sheet rules override from BUSINESS_RULES_JSON', async () => {
    const { getBalanceSheetRules } = await loadBusinessRulesModule({
      reporting: {
        balanceSheet: {
          customerDualAccounts: {
            receivable: '1319',
            customerAdvance: '3129'
          },
          depreciation: {
            sourcePrefix: '2149',
            displayAccountCode: '2239'
          },
          taxAccounts: ['33319', '33349']
        }
      }
    });

    expect(getBalanceSheetRules().customerDualAccounts.receivable).toBe('1319');
    expect(getBalanceSheetRules().customerDualAccounts.customerAdvance).toBe('3129');
    expect(getBalanceSheetRules().depreciation.sourcePrefix).toBe('2149');
    expect(getBalanceSheetRules().depreciation.displayAccountCode).toBe('2239');
    expect(getBalanceSheetRules().taxAccounts).toEqual(['33319', '33349']);
  });
});