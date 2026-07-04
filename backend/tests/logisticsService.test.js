import { describe, expect, test } from '@jest/globals';
import { buildOrderNumber, calculateTaxAmount, buildAccountingEntries } from '../services/logistics.service.js';

describe('logistics service helpers', () => {
  test('builds a public order number with prefix', () => {
    const number = buildOrderNumber('WEB');
    expect(number).toContain('WEB-');
  });

  test('calculates tax amount from a revenue amount', () => {
    expect(calculateTaxAmount(100000, 0.1)).toBe(10000);
  });

  test('builds accounting entries for confirm-loaded flow', () => {
    const entries = buildAccountingEntries({ amount: 100000, costAmount: 70000, taxAmount: 10000 });
    expect(entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ accountCode: '131', entryType: 'DR' }),
      expect.objectContaining({ accountCode: '511', entryType: 'CR' }),
      expect.objectContaining({ accountCode: '3331', entryType: 'CR' }),
      expect.objectContaining({ accountCode: '632', entryType: 'DR' }),
      expect.objectContaining({ accountCode: '156', entryType: 'CR' }),
    ]));
  });
});
