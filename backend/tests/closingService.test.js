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

describe('closing rules with default values', () => {
  test('returns default closing rules when no override', async () => {
    const { getClosingRules } = await loadBusinessRulesModule();
    
    expect(getClosingRules().voucherType).toBe('DauKy');
    expect(getClosingRules().defaultTaxRate).toBe(0.2);
    expect(getClosingRules().accounts.revenue).toBe('511');
    expect(getClosingRules().accounts.cost).toEqual(['632', '641', '642']);
    expect(getClosingRules().accounts.closing).toBe('911');
    expect(getClosingRules().rates.depreciationAnnualRate).toBe(0.2);
    expect(getClosingRules().rates.doubtfulDebtProvisionRate).toBe(0.1);
  });

  test('applies closing rules override from BUSINESS_RULES_JSON', async () => {
    const { getClosingRules } = await loadBusinessRulesModule({
      accounting: {
        closing: {
          voucherType: 'CLOSING',
          defaultTaxRate: 0.25,
          accounts: {
            revenue: '5119',
            cost: ['6329', '6419'],
            closing: '9119'
          },
          rates: {
            depreciationAnnualRate: 0.15,
            doubtfulDebtProvisionRate: 0.08
          }
        }
      }
    });

    expect(getClosingRules().voucherType).toBe('CLOSING');
    expect(getClosingRules().defaultTaxRate).toBe(0.25);
    expect(getClosingRules().accounts.revenue).toBe('5119');
    expect(getClosingRules().accounts.cost).toEqual(['6329', '6419']);
    expect(getClosingRules().accounts.closing).toBe('9119');
    expect(getClosingRules().rates.depreciationAnnualRate).toBe(0.15);
    expect(getClosingRules().rates.doubtfulDebtProvisionRate).toBe(0.08);
  });
});

describe('tax calculation with progressiveTaxBrackets', () => {
  test('calculates tax with custom progressive brackets', async () => {
    const { getTaxRateByRevenue, calculateTax } = await loadAccountingEngineModule({
      accounting: {
        closing: {
          progressiveTaxBrackets: [
            { maxRevenue: 1000000000, rate: 0.1 },
            { maxRevenue: 5000000000, rate: 0.15 },
            { maxRevenue: null, rate: 0.2 }
          ]
        }
      }
    });

    expect(getTaxRateByRevenue(500000000)).toBe(0.1);
    expect(getTaxRateByRevenue(2000000000)).toBe(0.15);
    expect(getTaxRateByRevenue(10000000000)).toBe(0.2);
  });

  test('calculateTax returns zero for negative profit', async () => {
    const { calculateTax } = await loadAccountingEngineModule();
    
    const result = calculateTax(-1000, 1000000000);
    expect(result.taxAmount).toBe(0);
    expect(result.taxRate).toBe(0);
  });

  test('calculateTax returns zero for zero profit', async () => {
    const { calculateTax } = await loadAccountingEngineModule();
    
    const result = calculateTax(0, 1000000000);
    expect(result.taxAmount).toBe(0);
    expect(result.taxRate).toBe(0);
  });

  test('calculateTax calculates correctly for positive profit', async () => {
    const { calculateTax } = await loadAccountingEngineModule({
      accounting: {
        closing: {
          progressiveTaxBrackets: [
            { maxRevenue: 1000, rate: 0.1 }
          ]
        }
      }
    });
    
    const result = calculateTax(1000, 500);
    expect(result.taxRate).toBe(0.1);
    expect(result.taxAmount).toBe(100);
  });
});

describe('closing rules edge cases', () => {
  test('handles missing cost array with fallback', async () => {
    const { getClosingRules } = await loadBusinessRulesModule({
      accounting: {
        closing: {
          accounts: {
            revenue: '5119'
            // Missing cost array
          }
        }
      }
    });

    // Should have fallback
    expect(getClosingRules().accounts.cost).toEqual(['632', '641', '642']);
  });

  test('handles null cost array with fallback', async () => {
    const { getClosingRules } = await loadBusinessRulesModule({
      accounting: {
        closing: {
          accounts: {
            cost: null
          }
        }
      }
    });

    // Should have fallback
    expect(getClosingRules().accounts.cost).toEqual(['632', '641', '642']);
  });
});