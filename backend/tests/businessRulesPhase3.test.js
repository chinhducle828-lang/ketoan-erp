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

async function loadAccountingEngineModule(rulesOverride) {
  if (rulesOverride === undefined) {
    delete process.env.BUSINESS_RULES_JSON;
  } else {
    process.env.BUSINESS_RULES_JSON = JSON.stringify(rulesOverride);
  }

  jest.resetModules();
  return import('../utils/accountingEngine.js');
}

beforeEach(() => {
  delete process.env.BUSINESS_RULES_JSON;
  jest.resetModules();
});

afterEach(() => {
  delete process.env.BUSINESS_RULES_JSON;
});

describe('phase 3 business-rules overrides', () => {
  test('applies inventory/general accounting overrides from BUSINESS_RULES_JSON', async () => {
    const { getInventoryRules, getGeneralAccountingRules } = await loadBusinessRulesModule({
      accounting: {
        general: {
          hermaphroditicAccounts: ['777']
        },
        inventory: {
          inboundVoucherType: 'IN',
          outboundVoucherType: 'OUT',
          allocationVoucherType: 'ALLOC',
          accounts: {
            inventory: '1569',
            logistics: '1568',
            logisticsCost: ['6419'],
            allocationCredit: '6419'
          }
        }
      }
    });

    expect(getGeneralAccountingRules().hermaphroditicAccounts).toEqual(['777']);
    expect(getInventoryRules()).toEqual(expect.objectContaining({
      inboundVoucherType: 'IN',
      outboundVoucherType: 'OUT',
      allocationVoucherType: 'ALLOC',
      accounts: expect.objectContaining({
        inventory: '1569',
        logistics: '1568',
        logisticsCost: ['6419'],
        allocationCredit: '6419'
      })
    }));
  });

  test('uses tax brackets and hermaphroditic list from rules in accounting engine', async () => {
    const { getTaxRateByRevenue, calculateBalances, getClosingBalance } = await loadAccountingEngineModule({
      accounting: {
        general: {
          hermaphroditicAccounts: ['777']
        },
        closing: {
          progressiveTaxBrackets: [
            { maxRevenue: 1000, rate: 0.1 },
            { maxRevenue: null, rate: 0.2 }
          ]
        }
      }
    });

    expect(getTaxRateByRevenue(500)).toBe(0.1);
    expect(getTaxRateByRevenue(5000)).toBe(0.2);

    const ledger = calculateBalances(
      [
        {
          details: [
            { accountCode: '777', partnerId: 42, entryType: 'DR', amount: 150 }
          ]
        }
      ],
      []
    );

    const closing = getClosingBalance(ledger, '777', 'asset', 42);
    expect(closing).toMatchObject({
      debit: 150,
      credit: 0,
      net: 150
    });
  });
});

describe('logistics rules', () => {
  test('returns default sale voucher type when no override', async () => {
    const { getLogisticsRules } = await loadBusinessRulesModule();
    expect(getLogisticsRules().saleVoucherType).toBe('XK');
  });

  test('applies sale voucher type override from BUSINESS_RULES_JSON', async () => {
    const { getLogisticsRules } = await loadBusinessRulesModule({
      voucher: {
        saleVoucherType: 'CUSTOM_SALE'
      }
    });
    expect(getLogisticsRules().saleVoucherType).toBe('CUSTOM_SALE');
  });
});

describe('validation of BUSINESS_RULES_JSON', () => {
  test('validates progressiveTaxBrackets with valid data', async () => {
    const { validateBusinessRules } = await loadBusinessRulesModule();
    const errors = validateBusinessRules({
      accounting: {
        closing: {
          progressiveTaxBrackets: [
            { maxRevenue: 1000, rate: 0.1 },
            { maxRevenue: null, rate: 0.2 }
          ]
        }
      }
    });
    expect(errors).toEqual([]);
  });

  test('validates progressiveTaxBrackets with invalid rate', async () => {
    const { validateBusinessRules } = await loadBusinessRulesModule();
    const errors = validateBusinessRules({
      accounting: {
        closing: {
          progressiveTaxBrackets: [
            { maxRevenue: 1000, rate: 'invalid' }
          ]
        }
      }
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('rate must be a valid number');
  });

  test('validates progressiveTaxBrackets with invalid maxRevenue', async () => {
    const { validateBusinessRules } = await loadBusinessRulesModule();
    const errors = validateBusinessRules({
      accounting: {
        closing: {
          progressiveTaxBrackets: [
            { maxRevenue: 'invalid', rate: 0.1 }
          ]
        }
      }
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('maxRevenue must be a valid number or null');
  });

  test('validates logisticsCost must be array', async () => {
    const { validateBusinessRules } = await loadBusinessRulesModule();
    const errors = validateBusinessRules({
      accounting: {
        inventory: {
          accounts: {
            logisticsCost: 'not-an-array'
          }
        }
      }
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('logisticsCost must be an array');
  });

  test('validates closing cost must be array', async () => {
    const { validateBusinessRules } = await loadBusinessRulesModule();
    const errors = validateBusinessRules({
      accounting: {
        closing: {
          accounts: {
            cost: 'not-an-array'
          }
        }
      }
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('cost must be an array');
  });
});

describe('progressiveTaxBrackets support in accounting engine', () => {
  test('uses progressiveTaxBrackets (new key) for tax calculation', async () => {
    const { getTaxRateByRevenue } = await loadAccountingEngineModule({
      accounting: {
        closing: {
          progressiveTaxBrackets: [
            { maxRevenue: 1000, rate: 0.1 },
            { maxRevenue: null, rate: 0.2 }
          ]
        }
      }
    });

    expect(getTaxRateByRevenue(500)).toBe(0.1);
    expect(getTaxRateByRevenue(5000)).toBe(0.2);
  });

  test('uses default tax rates when no brackets configured', async () => {
    const { getTaxRateByRevenue } = await loadAccountingEngineModule();
    expect(getTaxRateByRevenue(1000000000)).toBe(0.15);
    expect(getTaxRateByRevenue(10000000000)).toBe(0.17);
    expect(getTaxRateByRevenue(100000000000)).toBe(0.20);
  });
});

describe('negative test cases for rule configuration', () => {
  test('handles missing key gracefully in getLogisticsRules', async () => {
    const { getLogisticsRules } = await loadBusinessRulesModule({
      voucher: {}
    });
    expect(getLogisticsRules().saleVoucherType).toBe('XK');
  });

  test('handles null voucher type gracefully', async () => {
    const { getLogisticsRules } = await loadBusinessRulesModule({
      voucher: {
        saleVoucherType: null
      }
    });
    expect(getLogisticsRules().saleVoucherType).toBe('XK');
  });

  test('handles empty string voucher type gracefully', async () => {
    const { getLogisticsRules } = await loadBusinessRulesModule({
      voucher: {
        saleVoucherType: ''
      }
    });
    expect(getLogisticsRules().saleVoucherType).toBe('XK');
  });

  test('handles malformed JSON in BUSINESS_RULES_JSON', async () => {
    process.env.BUSINESS_RULES_JSON = 'not valid json';
    const { getInventoryRules } = await loadBusinessRulesModule();
    // Should use defaults
    expect(getInventoryRules().inboundVoucherType).toBe('NK');
  });
});
