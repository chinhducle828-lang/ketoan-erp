import { jest } from '@jest/globals';

// Mock pool.query
const mockQuery = jest.fn();
jest.unstable_mockModule('../config/db.js', () => ({
  pool: {
    query: mockQuery,
    connect: jest.fn(),
    end: jest.fn()
  }
}));

const { getAggregatedBalances } = await import('../utils/accountingEngine.js');

describe('getAggregatedBalances', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  test('throws error for missing companyId', async () => {
    await expect(getAggregatedBalances(null, 2026)).rejects.toThrow('companyId and year are required parameters');
  });

  test('throws error for missing year', async () => {
    await expect(getAggregatedBalances(1, null)).rejects.toThrow('companyId and year are required parameters');
  });

  test('returns correct structure with only opening balances', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        { account_code: '1111', base_debit: '500000', base_credit: '0', period_debit: '0', period_credit: '0', final_debit: '500000', final_credit: '0' },
        { account_code: '331', base_debit: '0', base_credit: '200000', period_debit: '0', period_credit: '0', final_debit: '0', final_credit: '200000' }
      ]
    });

    const ledger = await getAggregatedBalances(1, 2026);

    expect(ledger['1111'].openingDr).toBe(500000);
    expect(ledger['1111'].openingCr).toBe(0);
    expect(ledger['1111'].patsinhDr).toBe(0);
    expect(ledger['1111'].patsinhCr).toBe(0);
    expect(ledger['1111'].closingDr).toBe(500000);
    expect(ledger['1111'].closingCr).toBe(0);

    expect(ledger['331'].openingDr).toBe(0);
    expect(ledger['331'].openingCr).toBe(200000);
    expect(ledger['331'].patsinhDr).toBe(0);
    expect(ledger['331'].patsinhCr).toBe(0);
    expect(ledger['331'].closingDr).toBe(0);
    expect(ledger['331'].closingCr).toBe(200000);
  });

  test('returns correct structure with only period transactions', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        { account_code: '511', base_debit: '0', base_credit: '0', period_debit: '0', period_credit: '200000000', final_debit: '0', final_credit: '200000000' },
        { account_code: '632', base_debit: '0', base_credit: '0', period_debit: '150000000', period_credit: '0', final_debit: '150000000', final_credit: '0' }
      ]
    });

    const ledger = await getAggregatedBalances(1, 2026);

    expect(ledger['511'].openingDr).toBe(0);
    expect(ledger['511'].openingCr).toBe(0);
    expect(ledger['511'].patsinhDr).toBe(0);
    expect(ledger['511'].patsinhCr).toBe(200000000);
    expect(ledger['511'].closingDr).toBe(0);
    expect(ledger['511'].closingCr).toBe(200000000);

    expect(ledger['632'].patsinhDr).toBe(150000000);
    expect(ledger['632'].closingDr).toBe(150000000);
  });

  test('returns correct structure with both opening and period', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        { 
          account_code: '511', 
          base_debit: '0', base_credit: '500000000',
          period_debit: '0', period_credit: '200000000',
          final_debit: '0', final_credit: '700000000'
        }
      ]
    });

    const ledger = await getAggregatedBalances(1, 2026);

    expect(ledger['511'].openingDr).toBe(0);
    expect(ledger['511'].openingCr).toBe(500000000);
    expect(ledger['511'].patsinhDr).toBe(0);
    expect(ledger['511'].patsinhCr).toBe(200000000);
    expect(ledger['511'].closingDr).toBe(0);
    expect(ledger['511'].closingCr).toBe(700000000);
  });

  test('includes month filter when provided', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    
    await getAggregatedBalances(1, 2026, 6);

    // Verify month filter was passed in SQL
    const callQuery = mockQuery.mock.calls[0][0];
    expect(callQuery).toContain('EXTRACT(MONTH FROM v.voucher_date) <= $3');
    
    const callParams = mockQuery.mock.calls[0][1];
    expect(callParams).toEqual([1, 2026, 6]);
  });
});