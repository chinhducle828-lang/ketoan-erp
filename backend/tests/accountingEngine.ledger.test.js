import { jest } from '@jest/globals';

jest.unstable_mockModule('../config/db.js', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn()
  }
}));

const { calculateBalances, getClosingBalance, getTotalCredit, getTotalDebit } = await import('../utils/accountingEngine.js');

describe('Accounting engine ledger aggregation', () => {
  test('aggregates hermaphroditic account totals across partner-specific ledger entries', () => {
    const ledger = calculateBalances([
      {
        details: [
          { accountCode: '131', entryType: 'DR', amount: 100, partnerId: 1 },
          { accountCode: '131', entryType: 'CR', amount: 40, partnerId: 1 },
          { accountCode: '131', entryType: 'DR', amount: 75, partnerId: 2 },
          { accountCode: '131', entryType: 'CR', amount: 20, partnerId: 2 }
        ]
      }
    ], []);

    expect(getTotalDebit(ledger, '131')).toBe(175);
    expect(getTotalCredit(ledger, '131')).toBe(60);
    expect(getClosingBalance(ledger, '131', 'asset')).toEqual(expect.objectContaining({
      net: 115,
      debit: 175,
      credit: 60
    }));
  });
});
