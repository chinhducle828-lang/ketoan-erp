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
          taxBracketsByRevenue: [
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
    expect(closing).toEqual(expect.objectContaining({
      type: 'hermaphroditic',
      debit: 150,
      credit: 0,
      net: 150
    }));
  });
});
