/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * Unit tests for frontend accounting engine
 * Uses Node.js built-in test runner (no external dependencies)
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBalances,
  getClosingBalance,
  getTotalDebit,
  getTotalCredit,
} from './accountingEngine.js';

describe('calculateBalances', () => {
  test('returns empty ledger for empty inputs', () => {
    const result = calculateBalances([], []);
    assert.deepEqual(result, {});
  });

  test('processes vouchers with DR/CR entries correctly', () => {
    const vouchers = [
      {
        details: [
          { accountCode: '1111', entryType: 'DR', amount: 100000 },
          { accountCode: '131', entryType: 'CR', amount: 100000 },
        ],
      },
    ];

    const result = calculateBalances(vouchers);
    assert.equal(result['1111'].patsinhDr, 100000);
    assert.equal(result['1111'].patsinhCr, 0);
    assert.equal(result['1111'].openingDr, 0);
    assert.equal(result['1111'].openingCr, 0);
    assert.equal(result['1111'].closingDr, 100000);
    assert.equal(result['1111'].closingCr, 0);
    assert.equal(result['131'].patsinhCr, 100000);
    assert.equal(result['131'].patsinhDr, 0);
  });

  test('aggregates multiple vouchers correctly', () => {
    const vouchers = [
      { details: [{ accountCode: '1111', entryType: 'DR', amount: 50000 }] },
      { details: [{ accountCode: '1111', entryType: 'DR', amount: 30000 }] },
      { details: [{ accountCode: '1111', entryType: 'CR', amount: 10000 }] },
    ];

    const result = calculateBalances(vouchers);
    assert.equal(result['1111'].patsinhDr, 80000);
    assert.equal(result['1111'].patsinhCr, 10000);
    assert.equal(result['1111'].closingDr, 80000);
    assert.equal(result['1111'].closingCr, 10000);
  });

  test('handles opening balances - stored separately from patsinh', () => {
    const openingBalances = [
      { accountCode: '1111', opening_debit: 500000, opening_credit: 0 },
      { accountCode: '331', opening_debit: 0, opening_credit: 200000 },
    ];

    const result = calculateBalances([], openingBalances);
    // Opening balances go to openingDr/openingCr, NOT patsinhDr/patsinhCr
    assert.equal(result['1111'].openingDr, 500000);
    assert.equal(result['1111'].openingCr, 0);
    assert.equal(result['1111'].patsinhDr, 0);  // No period transactions
    assert.equal(result['1111'].patsinhCr, 0);
    assert.equal(result['1111'].closingDr, 500000);
    assert.equal(result['1111'].closingCr, 0);
    
    assert.equal(result['331'].openingCr, 200000);
    assert.equal(result['331'].patsinhCr, 0);  // No period transactions
    assert.equal(result['331'].closingCr, 200000);
  });

  test('combines opening balances with voucher data - patsinh is period only', () => {
    const openingBalances = [
      { accountCode: '1111', opening_debit: 1000000, opening_credit: 0 },
    ];
    const vouchers = [
      { details: [{ accountCode: '1111', entryType: 'CR', amount: 200000 }] },
    ];

    const result = calculateBalances(vouchers, openingBalances);
    // patsinhDr/patsinhCr = period only (no opening)
    assert.equal(result['1111'].patsinhDr, 0);        // No DR in period
    assert.equal(result['1111'].patsinhCr, 200000);    // CR in period
    // openingDr/openingCr = opening only
    assert.equal(result['1111'].openingDr, 1000000);
    assert.equal(result['1111'].openingCr, 0);
    // closingDr/closingCr = opening + period
    assert.equal(result['1111'].closingDr, 1000000);   // 1000000 + 0
    assert.equal(result['1111'].closingCr, 200000);    // 0 + 200000
  });

  test('handles hermaphroditic accounts per partner', () => {
    const vouchers = [
      {
        details: [
          { accountCode: '131', entryType: 'DR', amount: 50000, partnerId: 1 },
          { accountCode: '131', entryType: 'DR', amount: 30000, partnerId: 2 },
        ],
      },
    ];

    const result = calculateBalances(vouchers);
    assert.equal(result['131_1'].patsinhDr, 50000);
    assert.equal(result['131_2'].patsinhDr, 30000);
    assert.equal(result['131'], undefined);
  });

  test('skips voucher with no details', () => {
    const vouchers = [{}];
    const result = calculateBalances(vouchers);
    assert.deepEqual(result, {});
  });

  test('skips detail with no accountCode', () => {
    const vouchers = [
      { details: [{ entryType: 'DR', amount: 100000 }] },
    ];
    const result = calculateBalances(vouchers);
    assert.deepEqual(result, {});
  });

  test('handles string amounts by parsing them', () => {
    const vouchers = [
      { details: [{ accountCode: '1111', entryType: 'DR', amount: '50000' }] },
    ];
    const result = calculateBalances(vouchers);
    assert.equal(result['1111'].patsinhDr, 50000);
  });

  test('handles snake_case field names', () => {
    const vouchers = [
      {
        details: [
          { account_code: '1111', entry_type: 'DR', amount: 75000 },
        ],
      },
    ];
    const result = calculateBalances(vouchers);
    assert.equal(result['1111'].patsinhDr, 75000);
  });

  test('handles opening balance with snake_case fields - stored in openingDr/openingCr', () => {
    const openingBalances = [
      { account_code: '1111', opening_debit: 300000, opening_credit: 0 },
    ];
    const result = calculateBalances([], openingBalances);
    assert.equal(result['1111'].openingDr, 300000);
    assert.equal(result['1111'].patsinhDr, 0);  // No period transactions
    assert.equal(result['1111'].closingDr, 300000);
  });
});

describe('getClosingBalance', () => {
  test('returns 0 for unknown account', () => {
    assert.equal(getClosingBalance({}, '9999'), 0);
  });

  test('returns debit minus credit for asset accounts (using closingDr/closingCr)', () => {
    const ledger = { '1111': { openingDr: 500000, openingCr: 0, patsinhDr: 0, patsinhCr: 200000, closingDr: 500000, closingCr: 200000 } };
    assert.equal(getClosingBalance(ledger, '1111', 'asset'), 300000);
  });

  test('returns credit minus debit for liability accounts', () => {
    const ledger = { '3341': { openingDr: 0, openingCr: 100000, patsinhDr: 100000, patsinhCr: 400000, closingDr: 100000, closingCr: 500000 } };
    assert.equal(getClosingBalance(ledger, '3341', 'liability'), 400000);
  });

  test('returns credit minus debit for equity accounts', () => {
    const ledger = { '411': { openingDr: 0, openingCr: 0, patsinhDr: 0, patsinhCr: 1000000, closingDr: 0, closingCr: 1000000 } };
    assert.equal(getClosingBalance(ledger, '411', 'equity'), 1000000);
  });

  test('returns debit minus credit for expense accounts', () => {
    const ledger = { '632': { openingDr: 0, openingCr: 0, patsinhDr: 300000, patsinhCr: 0, closingDr: 300000, closingCr: 0 } };
    assert.equal(getClosingBalance(ledger, '632', 'expense'), 300000);
  });

  test('returns hermaphroditic object for 131/331 accounts', () => {
    const ledger = { '131_1': { openingDr: 0, openingCr: 0, patsinhDr: 50000, patsinhCr: 20000, closingDr: 50000, closingCr: 20000 } };
    const result = getClosingBalance(ledger, '131', 'asset', 1);
    assert.equal(result.type, 'hermaphroditic');
    assert.equal(result.debit, 50000);
    assert.equal(result.credit, 20000);
    assert.equal(result.net, 30000);
    assert.deepEqual(result.opening, { debit: 0, credit: 0 });
    assert.deepEqual(result.period, { debit: 50000, credit: 20000 });
  });

  test('retrieves by combined key for hermaphroditic with partner', () => {
    const ledger = { '331_42': { openingDr: 0, openingCr: 0, patsinhDr: 10000, patsinhCr: 60000, closingDr: 10000, closingCr: 60000 } };
    const result = getClosingBalance(ledger, '331', 'liability', 42);
    assert.equal(result.type, 'hermaphroditic');
    assert.equal(result.net, -50000);
  });
});

describe('getTotalDebit / getTotalCredit', () => {
  test('getTotalDebit returns patsinhDr for known account', () => {
    const ledger = { '1111': { openingDr: 500000, openingCr: 0, patsinhDr: 750000, patsinhCr: 200000, closingDr: 1250000, closingCr: 200000 } };
    assert.equal(getTotalDebit(ledger, '1111'), 750000);  // Only period, not opening
  });

  test('getTotalDebit returns 0 for unknown account', () => {
    assert.equal(getTotalDebit({}, '9999'), 0);
  });

  test('getTotalCredit returns patsinhCr for known account', () => {
    const ledger = { '331': { openingDr: 0, openingCr: 500000, patsinhDr: 0, patsinhCr: 450000, closingDr: 0, closingCr: 950000 } };
    assert.equal(getTotalCredit(ledger, '331'), 450000);  // Only period, not opening
  });

  test('getTotalCredit returns 0 for unknown account', () => {
    assert.equal(getTotalCredit({}, '9999'), 0);
  });

  test('getTotalDebit does NOT include opening balance', () => {
    const ledger = { '511': { openingDr: 0, openingCr: 500000000, patsinhDr: 0, patsinhCr: 200000000, closingDr: 0, closingCr: 700000000 } };
    assert.equal(getTotalCredit(ledger, '511'), 200000000);  // 200tr period, NOT 700tr
    assert.equal(getTotalDebit(ledger, '511'), 0);
  });
});