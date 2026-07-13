import { jest } from '@jest/globals';

jest.unstable_mockModule('../config/db.js', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn()
  }
}));

const { calculateBalances, getClosingBalance, getTotalCredit, getTotalDebit } = await import('../utils/accountingEngine.js');

describe('Accounting engine edge cases', () => {
  test('opening balance = 0 with period transactions works correctly', () => {
    const ledger = calculateBalances([
      {
        details: [
          { accountCode: '511', entryType: 'CR', amount: 200000000 }
        ]
      }
    ], [
      { account_code: '511', opening_debit: 0, opening_credit: 0 }
    ]);

    expect(ledger['511'].openingDr).toBe(0);
    expect(ledger['511'].openingCr).toBe(0);
    expect(ledger['511'].patsinhDr).toBe(0);
    expect(ledger['511'].patsinhCr).toBe(200000000);
    expect(ledger['511'].closingDr).toBe(0);
    expect(ledger['511'].closingCr).toBe(200000000);
    expect(getTotalCredit(ledger, '511')).toBe(200000000);
  });

  test('opening balance > 0 with NO period transactions', () => {
    const ledger = calculateBalances([], [
      { account_code: '1111', opening_debit: 500000, opening_credit: 0 }
    ]);

    expect(ledger['1111'].openingDr).toBe(500000);
    expect(ledger['1111'].openingCr).toBe(0);
    expect(ledger['1111'].patsinhDr).toBe(0);   // No period
    expect(ledger['1111'].patsinhCr).toBe(0);   // No period
    expect(ledger['1111'].closingDr).toBe(500000);
    expect(ledger['1111'].closingCr).toBe(0);
    expect(getTotalDebit(ledger, '1111')).toBe(0); // Period only = 0
  });

  test('hermaphroditic account with opening balance per partner', () => {
    const ledger = calculateBalances([
      {
        details: [
          { accountCode: '131', entryType: 'DR', amount: 100000, partnerId: 1 },
          { accountCode: '131', entryType: 'CR', amount: 50000, partnerId: 2 }
        ]
      }
    ], [
      { account_code: '131', opening_debit: 200000, opening_credit: 0, partner_id: 1 },
      { account_code: '131', opening_debit: 0, opening_credit: 100000, partner_id: 2 }
    ]);

    // Partner 1: opening DR 200k + period DR 100k
    expect(ledger['131_1'].openingDr).toBe(200000);
    expect(ledger['131_1'].openingCr).toBe(0);
    expect(ledger['131_1'].patsinhDr).toBe(100000);
    expect(ledger['131_1'].patsinhCr).toBe(0);
    expect(ledger['131_1'].closingDr).toBe(300000);
    expect(ledger['131_1'].closingCr).toBe(0);

    // Partner 2: opening CR 100k + period CR 50k
    expect(ledger['131_2'].openingDr).toBe(0);
    expect(ledger['131_2'].openingCr).toBe(100000);
    expect(ledger['131_2'].patsinhDr).toBe(0);
    expect(ledger['131_2'].patsinhCr).toBe(50000);
    expect(ledger['131_2'].closingDr).toBe(0);
    expect(ledger['131_2'].closingCr).toBe(150000);

    // getTotalDebit/getTotalCredit should aggregate across all partners
    expect(getTotalDebit(ledger, '131')).toBe(100000);   // 100k + 0 = 100k period
    expect(getTotalCredit(ledger, '131')).toBe(50000);    // 0 + 50k = 50k period
  });

  test('negative amount (red reversal) works correctly', () => {
    const ledger = calculateBalances([
      {
        details: [
          { accountCode: '1111', entryType: 'DR', amount: 100000 },
          { accountCode: '1111', entryType: 'CR', amount: -10000 } // Điều chỉnh giảm
        ]
      }
    ], [
      { account_code: '1111', opening_debit: 500000, opening_credit: 0 }
    ]);

    expect(ledger['1111'].openingDr).toBe(500000);
    expect(ledger['1111'].openingCr).toBe(0);
    expect(ledger['1111'].patsinhDr).toBe(100000);
    expect(ledger['1111'].patsinhCr).toBe(-10000);
    expect(ledger['1111'].closingDr).toBe(600000);   // 500k + 100k
    expect(ledger['1111'].closingCr).toBe(-10000);    // 0 + (-10000)
  });

  test('getClosingBalance returns correct result for liability with opening', () => {
    const ledger = calculateBalances([
      {
        details: [
          { accountCode: '331', entryType: 'DR', amount: 50000, partnerId: 1 }, // Trả bớt nợ
          { accountCode: '331', entryType: 'CR', amount: 100000, partnerId: 1 } // Mua thêm chịu
        ]
      }
    ], [
      { account_code: '331', opening_debit: 0, opening_credit: 200000, partner_id: 1 }
    ]);

    const result = getClosingBalance(ledger, '331', 'liability', 1);
    expect(result.type).toBe('hermaphroditic');
    // opening CR 200k, period DR 50k + CR 100k => closing CR = 200k + 100k = 300k, closing DR = 50k
    // net = 50k - 300k = -250k
    expect(result.net).toBe(-250000);
    expect(result.opening).toEqual({ debit: 0, credit: 200000 });
    expect(result.period).toEqual({ debit: 50000, credit: 100000 });
    expect(result.debit).toBe(50000);
    expect(result.credit).toBe(300000);
  });
});