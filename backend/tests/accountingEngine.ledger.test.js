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
      credit: 60,
      period: { debit: 175, credit: 60 },
      opening: { debit: 0, credit: 0 }
    }));
  });

  test('getTotalDebit/getTotalCredit do NOT include opening balances', () => {
    const ledger = calculateBalances([
      {
        details: [
          { accountCode: '511', entryType: 'CR', amount: 200000000 }
        ]
      }
    ], [
      { account_code: '511', opening_debit: 0, opening_credit: 500000000 }
    ]);

    // Period debit/credit should NOT include opening
    expect(getTotalDebit(ledger, '511')).toBe(0);       // Chỉ phát sinh Nợ trong kỳ
    expect(getTotalCredit(ledger, '511')).toBe(200000000); // Chỉ phát sinh Có trong kỳ

    // Closing balance SHOULD include opening + period
    // Convention: positive = debit balance, negative = credit balance
    // Revenue account (CREDIT nature): net = -(closingCr - closingDr) = -(700tr - 0) = -700tr
    expect(getClosingBalance(ledger, '511', 'revenue').net).toBe(-700000000); // -(500tr + 200tr)
    expect(getClosingBalance(ledger, '511', 'revenue').opening).toEqual({ debit: 0, credit: 500000000 });
    expect(getClosingBalance(ledger, '511', 'revenue').period).toEqual({ debit: 0, credit: 200000000 });
    expect(getClosingBalance(ledger, '511', 'revenue').debit).toBe(0);       // closingDr
    expect(getClosingBalance(ledger, '511', 'revenue').credit).toBe(700000000); // closingCr
  });

  test('opening balances are stored separately from period movements', () => {
    const ledger = calculateBalances([
      {
        details: [
          { accountCode: '1111', entryType: 'DR', amount: 100000 },
          { accountCode: '1111', entryType: 'CR', amount: 50000 }
        ]
      }
    ], [
      { account_code: '1111', opening_debit: 500000, opening_credit: 200000 }
    ]);

    const entry = ledger['1111'];
    expect(entry.openingDr).toBe(500000);
    expect(entry.openingCr).toBe(200000);
    expect(entry.patsinhDr).toBe(100000);  // Chỉ phát sinh trong kỳ
    expect(entry.patsinhCr).toBe(50000);    // Chỉ phát sinh trong kỳ
    expect(entry.closingDr).toBe(600000);   // openingDr + patsinhDr
    expect(entry.closingCr).toBe(250000);   // openingCr + patsinhCr
  });

  test('works correctly without opening balances (empty array)', () => {
    const ledger = calculateBalances([
      {
        details: [
          { accountCode: '632', entryType: 'DR', amount: 300000 }
        ]
      }
    ], []);

    expect(ledger['632'].openingDr).toBe(0);
    expect(ledger['632'].openingCr).toBe(0);
    expect(ledger['632'].patsinhDr).toBe(300000);
    expect(ledger['632'].patsinhCr).toBe(0);
    expect(ledger['632'].closingDr).toBe(300000);
    expect(ledger['632'].closingCr).toBe(0);
    expect(getTotalDebit(ledger, '632')).toBe(300000);
  });
});