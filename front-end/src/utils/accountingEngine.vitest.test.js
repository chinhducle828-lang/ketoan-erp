/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * Vitest-based unit tests for the frontend accounting engine.
 * These complement the pre-existing node:test suites and run under Vitest/CI.
 */

import { describe, test, expect } from 'vitest';
import {
  calculateBalances,
  getClosingBalance,
  getTotalDebit,
  getTotalCredit,
} from './accountingEngine.js';

describe('calculateBalances', () => {
  test('accumulates DR/CR from voucher details', () => {
    const vouchers = [
      {
        details: [
          { accountCode: '1111', entryType: 'DR', amount: 100000 },
          { accountCode: '131', entryType: 'CR', amount: 100000 },
        ],
      },
    ];
    const ledger = calculateBalances(vouchers);
    expect(ledger['1111'].patsinhDr).toBe(100000);
    expect(ledger['1111'].patsinhCr).toBe(0);
    expect(ledger['1111'].openingDr).toBe(0);
    expect(ledger['1111'].openingCr).toBe(0);
    expect(ledger['1111'].closingDr).toBe(100000);
    expect(ledger['131'].patsinhCr).toBe(100000);
    expect(ledger['131'].patsinhDr).toBe(0);
  });

  test('applies opening balances as starting point - stored separately', () => {
    const opening = [{ accountCode: '1111', opening_debit: 50000 }];
    const ledger = calculateBalances([], opening);
    // Opening goes to openingDr, NOT patsinhDr
    expect(ledger['1111'].openingDr).toBe(50000);
    expect(ledger['1111'].patsinhDr).toBe(0);  // No period transactions
    expect(ledger['1111'].closingDr).toBe(50000);
  });

  test('opening + period = closing, patsinh is period only', () => {
    const opening = [{ accountCode: '1111', opening_debit: 100000, opening_credit: 0 }];
    const vouchers = [
      {
        details: [
          { accountCode: '1111', entryType: 'DR', amount: 50000 },
          { accountCode: '1111', entryType: 'CR', amount: 30000 },
        ],
      },
    ];
    const ledger = calculateBalances(vouchers, opening);
    expect(ledger['1111'].openingDr).toBe(100000);
    expect(ledger['1111'].openingCr).toBe(0);
    expect(ledger['1111'].patsinhDr).toBe(50000);   // Period only
    expect(ledger['1111'].patsinhCr).toBe(30000);    // Period only
    expect(ledger['1111'].closingDr).toBe(150000);   // 100000 + 50000
    expect(ledger['1111'].closingCr).toBe(30000);    // 0 + 30000
  });

  test('handles hermaphroditic accounts with partner_id separately', () => {
    const vouchers = [
      {
        details: [
          { accountCode: '131', entryType: 'DR', amount: 200000, partnerId: 1 },
          { accountCode: '131', entryType: 'CR', amount: 50000, partnerId: 2 },
        ],
      },
    ];
    const ledger = calculateBalances(vouchers);
    expect(ledger['131_1'].patsinhDr).toBe(200000);
    expect(ledger['131_2'].patsinhCr).toBe(50000);
    expect(ledger['131_1'].openingDr).toBe(0);
    expect(ledger['131_2'].openingCr).toBe(0);
  });

  test('ignores vouchers without details array', () => {
    const ledger = calculateBalances([{ id: 1 }]);
    expect(Object.keys(ledger).length).toBe(0);
  });
});

describe('getClosingBalance', () => {
  const vouchers = [
    {
      details: [
        { accountCode: '1111', entryType: 'DR', amount: 300000 },
        { accountCode: '511', entryType: 'CR', amount: 300000 },
      ],
    },
  ];
  const ledger = calculateBalances(vouchers);

  test('asset account returns DR - CR', () => {
    expect(getClosingBalance(ledger, '1111', 'asset')).toBe(300000);
  });

  test('revenue account returns CR - DR', () => {
    expect(getClosingBalance(ledger, '511', 'revenue')).toBe(300000);
  });

  test('hermaphroditic account returns net object with opening/period', () => {
    const hermLedger = calculateBalances([
      {
        details: [
          { accountCode: '131', entryType: 'DR', amount: 200000, partnerId: 1 },
          { accountCode: '131', entryType: 'CR', amount: 50000, partnerId: 1 },
        ],
      },
    ]);
    const result = getClosingBalance(hermLedger, '131', 'asset', 1);
    expect(result.type).toBe('hermaphroditic');
    expect(result.net).toBe(150000);
    expect(result.opening).toEqual({ debit: 0, credit: 0 });
    expect(result.period).toEqual({ debit: 200000, credit: 50000 });
    expect(result.debit).toBe(200000);
    expect(result.credit).toBe(50000);
  });

  test('returns 0 for unknown account', () => {
    expect(getClosingBalance(ledger, '9999', 'asset')).toBe(0);
  });
});

describe('getTotalDebit / getTotalCredit', () => {
  test('getTotalDebit returns period debit only, not opening', () => {
    const ledger = calculateBalances([
      {
        details: [
          { accountCode: '1111', entryType: 'DR', amount: 100000 },
        ],
      },
    ], [
      { accountCode: '1111', opening_debit: 500000 },
    ]);
    // patsinhDr = 100000 (period only), openingDr = 500000
    expect(getTotalDebit(ledger, '1111')).toBe(100000);
  });

  test('getTotalCredit returns period credit only, not opening', () => {
    const ledger = calculateBalances([
      {
        details: [
          { accountCode: '511', entryType: 'CR', amount: 200000 },
        ],
      },
    ], [
      { accountCode: '511', opening_credit: 500000 },
    ]);
    // patsinhCr = 200000 (period only), openingCr = 500000
    expect(getTotalCredit(ledger, '511')).toBe(200000);
  });

  test('getTotalDebit returns accumulated debit', () => {
    const ledger = calculateBalances([
      {
        details: [
          { accountCode: '1111', entryType: 'DR', amount: 100000 },
          { accountCode: '131', entryType: 'CR', amount: 100000 },
        ],
      },
    ]);
    expect(getTotalDebit(ledger, '1111')).toBe(100000);
  });

  test('getTotalCredit returns accumulated credit', () => {
    const ledger = calculateBalances([
      {
        details: [
          { accountCode: '1111', entryType: 'DR', amount: 100000 },
          { accountCode: '131', entryType: 'CR', amount: 100000 },
        ],
      },
    ]);
    expect(getTotalCredit(ledger, '131')).toBe(100000);
  });

  test('returns 0 for missing account', () => {
    const ledger = calculateBalances([]);
    expect(getTotalDebit(ledger, '0000')).toBe(0);
    expect(getTotalCredit(ledger, '0000')).toBe(0);
  });
});