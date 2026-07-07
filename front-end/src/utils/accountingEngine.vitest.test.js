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
    expect(ledger['131'].patsinhCr).toBe(100000);
  });

  test('applies opening balances as starting point', () => {
    const opening = [{ accountCode: '1111', opening_debit: 50000 }];
    const ledger = calculateBalances([], opening);
    expect(ledger['1111'].closingDr).toBe(50000);
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

  test('hermaphroditic account returns net object', () => {
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
  });

  test('returns 0 for unknown account', () => {
    expect(getClosingBalance(ledger, '9999', 'asset')).toBe(0);
  });
});

describe('getTotalDebit / getTotalCredit', () => {
  const ledger = calculateBalances([
    {
      details: [
        { accountCode: '1111', entryType: 'DR', amount: 100000 },
        { accountCode: '131', entryType: 'CR', amount: 100000 },
      ],
    },
  ]);

  test('getTotalDebit returns accumulated debit', () => {
    expect(getTotalDebit(ledger, '1111')).toBe(100000);
  });

  test('getTotalCredit returns accumulated credit', () => {
    expect(getTotalCredit(ledger, '131')).toBe(100000);
  });

  test('returns 0 for missing account', () => {
    expect(getTotalDebit(ledger, '0000')).toBe(0);
  });
});