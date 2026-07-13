import { jest } from '@jest/globals';

jest.unstable_mockModule('../config/db.js', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn()
  }
}));

const { calculateBalances, getClosingBalance, getTotalDebit, getTotalCredit } = await import('../utils/accountingEngine.js');

describe('Accounting engine consumer tests', () => {
  /**
   * Mô phỏng logic WorkInProcess.jsx:
   * const ledger = calculateBalances(vouchers);
   * const materialCosts = ledger['154'] ? ledger['154'].patsinhDr : 0;
   */
  test('WorkInProcess reads patsinhDr for TK 154 (WIP)', () => {
    const ledger = calculateBalances([
      {
        details: [
          { accountCode: '154', entryType: 'DR', amount: 50000000 },  // CP NVL TT
          { accountCode: '154', entryType: 'DR', amount: 20000000 },  // CP NC TT
        ]
      }
    ]);

    // workInProcess.jsx logic: ledger['154'].patsinhDr
    const materialCosts = ledger['154'] ? ledger['154'].patsinhDr : 0;
    expect(materialCosts).toBe(70000000);
    expect(ledger['154'].openingDr).toBe(0);
    expect(ledger['154'].closingDr).toBe(70000000);
  });

  /**
   * TK 154 có opening + phát sinh, WorkInProcess chỉ quan tâm phát sinh
   */
  test('WorkInProcess still reads correct patsinhDr even with opening', () => {
    const ledger = calculateBalances([
      {
        details: [
          { accountCode: '154', entryType: 'DR', amount: 50000000 }
        ]
      }
    ], [
      { account_code: '154', opening_debit: 200000000, opening_credit: 0 }
    ]);

    // workInProcess.jsx: ledger['154'].patsinhDr - chỉ phát sinh
    const materialCosts = ledger['154'] ? ledger['154'].patsinhDr : 0;
    expect(ledger['154'].openingDr).toBe(200000000);
    expect(materialCosts).toBe(50000000);    // Period only
    expect(ledger['154'].closingDr).toBe(250000000); // Opening + period
  });

  /**
   * Mô phỏng logic test-erp-core.js đọc trực tiếp closingDr/closingCr
   */
  test('test-erp-core reads closingCr and closingDr directly', () => {
    const ledger = calculateBalances([
      {
        details: [
          { accountCode: '156', entryType: 'DR', amount: 150000000 },
          { accountCode: '1331', entryType: 'DR', amount: 15000000 },
          { accountCode: '331', entryType: 'CR', amount: 165000000 }
        ]
      }
    ], []);

    // test-erp-core.js dòng 168: acc.closingDr, acc.closingCr
    // test-erp-core.js dòng 172: ledger['331'].closingCr === 165000000
    expect(ledger['331'].closingCr).toBe(165000000);
    expect(ledger['156'].closingDr).toBe(150000000);
  });

  /**
   * getClosingBalance với revenue type trả về số âm cho số dư Có
   */
  test('getClosingBalance with revenue type returns negative for credit balance', () => {
    const ledger = calculateBalances([
      {
        details: [
          { accountCode: '511', entryType: 'CR', amount: 200000000 }
        ]
      }
    ], [
      { account_code: '511', opening_debit: 0, opening_credit: 500000000 }
    ]);

    // Revenue (CREDIT nature): net = balanceType==CREDIT ? -netBalance : netBalance
    // closingDr=0, closingCr=700tr => netBalance=700tr, balanceType=CREDIT => net = -700tr
    const result = getClosingBalance(ledger, '511', 'revenue');
    expect(result.net).toBe(-700000000);
    expect(result.opening).toEqual({ debit: 0, credit: 500000000 });
    expect(result.period).toEqual({ debit: 0, credit: 200000000 });
    expect(result.debit).toBe(0);
    expect(result.credit).toBe(700000000);
  });

  /**
   * Hermaphroditic account returns full object with opening/period/debit/credit/net
   */
  test('hermaphroditic getClosingBalance returns full object structure', () => {
    const ledger = calculateBalances([
      {
        details: [
          { accountCode: '131', entryType: 'DR', amount: 100000, partnerId: 1 }
        ]
      }
    ], [
      { account_code: '131', opening_debit: 200000, opening_credit: 0, partner_id: 1 }
    ]);

    const result = getClosingBalance(ledger, '131', 'asset', 1);
    expect(result).toEqual({
      type: 'hermaphroditic',
      opening: { debit: 200000, credit: 0 },
      period: { debit: 100000, credit: 0 },
      debit: 300000,
      credit: 0,
      net: 300000,
      account_nature: expect.any(String)
    });
  });
});