import { jest } from '@jest/globals';

// Mock pool
const mockQuery = jest.fn();
jest.unstable_mockModule('../config/db.js', () => ({
  pool: {
    query: mockQuery,
    connect: jest.fn(),
    end: jest.fn()
  }
}));

// We test the accounting engine functions directly (same logic used by /b02 route)
const { calculateBalances, getTotalDebit, getTotalCredit } = await import('../utils/accountingEngine.js');

describe('B02 - Bao cao Ket qua Kinh doanh (Income Statement)', () => {
  /**
   * Mô phỏng logic từ routes/report.js API /b02:
   * 
   * const ledger = calculateBalances(vouchersRes.rows, []);
   * const incomeStatement = {
   *   revenue: getTotalCredit(ledger, '511') + getTotalCredit(ledger, '515'),
   *   cogs: getTotalDebit(ledger, '632'),
   *   operatingExpenses: {
   *     '635': getTotalDebit(ledger, '635'),
   *     '641': getTotalDebit(ledger, '641'),
   *     '642': getTotalDebit(ledger, '642')
   *   },
   *   otherIncome: getTotalCredit(ledger, '711'),
   *   otherExpenses: getTotalDebit(ledger, '811'),
   *   taxExpense: getTotalDebit(ledger, '821')
   * };
   */

  test('B02 revenue should NOT include opening balance', () => {
    // TK 511 có opening CR 500tr + phát sinh CR 200tr trong kỳ
    const ledger = calculateBalances([
      {
        details: [
          { accountCode: '511', entryType: 'CR', amount: 200000000 }
        ]
      }
    ], [
      { account_code: '511', opening_debit: 0, opening_credit: 500000000 }
    ]);

    const revenue = (getTotalCredit(ledger, '511') || 0) + (getTotalCredit(ledger, '515') || 0);
    
    // TRƯỚC KHI SỬA: revenue = 700.000.000 (sai, gộp cả opening)
    // SAU KHI SỬA: revenue = 200.000.000 (đúng, chỉ phát sinh trong kỳ)
    expect(revenue).toBe(200000000);
    expect(revenue).not.toBe(700000000); // Không còn bị lẫn opening
  });

  test('B02 COGS should NOT include opening balance', () => {
    const ledger = calculateBalances([
      {
        details: [
          { accountCode: '632', entryType: 'DR', amount: 150000000 }
        ]
      }
    ], [
      { account_code: '632', opening_debit: 100000000, opening_credit: 0 }
    ]);

    const cogs = getTotalDebit(ledger, '632') || 0;
    
    // TRƯỚC KHI SỬA: cogs = 250.000.000 (sai)
    // SAU KHI SỬA: cogs = 150.000.000 (đúng)
    expect(cogs).toBe(150000000);
    expect(cogs).not.toBe(250000000);
  });

  test('B02 operating expenses should NOT include opening balance', () => {
    const ledger = calculateBalances([
      {
        details: [
          { accountCode: '641', entryType: 'DR', amount: 50000000 },
          { accountCode: '642', entryType: 'DR', amount: 30000000 }
        ]
      }
    ], [
      { account_code: '641', opening_debit: 20000000, opening_credit: 0 },
      { account_code: '642', opening_debit: 10000000, opening_credit: 0 }
    ]);

    const opExps = {
      '641': getTotalDebit(ledger, '641') || 0,
      '642': getTotalDebit(ledger, '642') || 0
    };

    expect(opExps['641']).toBe(50000000);  // Chỉ phát sinh, không gồm opening 20tr
    expect(opExps['642']).toBe(30000000);  // Chỉ phát sinh, không gồm opening 10tr
  });

  test('B02 profitBeforeTax calculation is correct with opening balances', () => {
    // Mô phỏng báo cáo KQKD đầy đủ
    const ledger = calculateBalances([
      {
        details: [
          { accountCode: '511', entryType: 'CR', amount: 200000000 },  // Doanh thu
          { accountCode: '632', entryType: 'DR', amount: 120000000 },  // Giá vốn
          { accountCode: '641', entryType: 'DR', amount: 30000000 },   // CP bán hàng
          { accountCode: '642', entryType: 'DR', amount: 20000000 },   // CP QLDN
          { accountCode: '711', entryType: 'CR', amount: 5000000 },    // TN khác
          { accountCode: '811', entryType: 'DR', amount: 2000000 },    // CP khác
          { accountCode: '821', entryType: 'DR', amount: 10000000 }    // Thuế TNDN
        ]
      }
    ], [
      { account_code: '511', opening_debit: 0, opening_credit: 500000000 },
      { account_code: '632', opening_debit: 50000000, opening_credit: 0 },
      { account_code: '641', opening_debit: 10000000, opening_credit: 0 },
      { account_code: '642', opening_debit: 5000000, opening_credit: 0 }
    ]);

    // Chỉ tính phát sinh trong kỳ (đã fix)
    const revenue = getTotalCredit(ledger, '511') || 0;
    const cogs = getTotalDebit(ledger, '632') || 0;
    const sellingExpenses = getTotalDebit(ledger, '641') || 0;
    const adminExpenses = getTotalDebit(ledger, '642') || 0;
    const otherIncome = getTotalCredit(ledger, '711') || 0;
    const otherExpenses = getTotalDebit(ledger, '811') || 0;
    const taxExpense = getTotalDebit(ledger, '821') || 0;

    const profitBeforeTax = revenue + otherIncome - cogs - sellingExpenses - adminExpenses - otherExpenses;
    const netProfit = profitBeforeTax - taxExpense;

    // Chỉ tính trên số phát sinh: 200tr - 120tr - 30tr - 20tr + 5tr - 2tr = 33tr
    expect(revenue).toBe(200000000);
    expect(cogs).toBe(120000000);
    expect(profitBeforeTax).toBe(33000000);  // 200tr - 120tr - 30tr - 20tr + 5tr - 2tr
    expect(netProfit).toBe(23000000);        // 33tr - 10tr
  });

  test('B02 with NO opening balances still works correctly', () => {
    const ledger = calculateBalances([
      {
        details: [
          { accountCode: '511', entryType: 'CR', amount: 100000000 },
          { accountCode: '632', entryType: 'DR', amount: 60000000 }
        ]
      }
    ], []);

    const revenue = getTotalCredit(ledger, '511') || 0;
    const cogs = getTotalDebit(ledger, '632') || 0;

    expect(revenue).toBe(100000000);
    expect(cogs).toBe(60000000);
  });
});