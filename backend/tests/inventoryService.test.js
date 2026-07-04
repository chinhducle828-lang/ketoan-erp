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

describe('inventory rules with default values', () => {
  test('returns default inventory rules when no override', async () => {
    const { getInventoryRules } = await loadBusinessRulesModule();
    
    expect(getInventoryRules().inboundVoucherType).toBe('NK');
    expect(getInventoryRules().outboundVoucherType).toBe('XK');
    expect(getInventoryRules().allocationVoucherType).toBe('DauKy');
    expect(getInventoryRules().accounts.inventory).toBe('156');
    expect(getInventoryRules().accounts.logistics).toBe('1562');
    expect(getInventoryRules().accounts.logisticsCost).toEqual(['632', '641', '642']);
  });

  test('applies inventory rules override from BUSINESS_RULES_JSON', async () => {
    const { getInventoryRules } = await loadBusinessRulesModule({
      accounting: {
        inventory: {
          inboundVoucherType: 'INBOUND',
          outboundVoucherType: 'OUTBOUND',
          allocationVoucherType: 'ALLOC',
          accounts: {
            inventory: '1569',
            logistics: '1568',
            logisticsCost: ['6419', '6429'],
            allocationCredit: '6419'
          }
        }
      }
    });

    expect(getInventoryRules().inboundVoucherType).toBe('INBOUND');
    expect(getInventoryRules().outboundVoucherType).toBe('OUTBOUND');
    expect(getInventoryRules().allocationVoucherType).toBe('ALLOC');
    expect(getInventoryRules().accounts.inventory).toBe('1569');
    expect(getInventoryRules().accounts.logistics).toBe('1568');
    expect(getInventoryRules().accounts.logisticsCost).toEqual(['6419', '6429']);
    expect(getInventoryRules().accounts.allocationCredit).toBe('6419');
  });

  test('handles missing accounts gracefully with fallback', async () => {
    const { getInventoryRules } = await loadBusinessRulesModule({
      accounting: {
        inventory: {
          accounts: {
            inventory: '1569'
            // Missing other accounts
          }
        }
      }
    });

    // Should have fallback for missing accounts
    expect(getInventoryRules().accounts.logistics).toBe('1562');
    expect(getInventoryRules().accounts.logisticsCost).toEqual(['632', '641', '642']);
  });
});

describe('inventory rules edge cases', () => {
  test('handles null logisticsCost array', async () => {
    const { getInventoryRules } = await loadBusinessRulesModule({
      accounting: {
        inventory: {
          accounts: {
            logisticsCost: null
          }
        }
      }
    });

    // Should fallback to default
    expect(getInventoryRules().accounts.logisticsCost).toEqual(['632', '641', '642']);
  });

  test('handles empty logisticsCost array', async () => {
    const { getInventoryRules } = await loadBusinessRulesModule({
      accounting: {
        inventory: {
          accounts: {
            logisticsCost: []
          }
        }
      }
    });

    // Should fallback to default
    expect(getInventoryRules().accounts.logisticsCost).toEqual(['632', '641', '642']);
  });
});