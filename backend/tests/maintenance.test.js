import { describe, expect, test } from '@jest/globals';
import { rebuildLedger, validateMonthlyBalances } from '../services/maintenance.service.js';

describe('maintenance service', () => {
  test('rebuildLedger returns a success payload when called with valid inputs', async () => {
    const result = await rebuildLedger(1, 2026, 1);
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('monthCount');
    expect(result).toHaveProperty('details');
    expect(Array.isArray(result.details)).toBe(true);
  });

  test('rebuildLedger with startMonth=6 only processes months 6-12', async () => {
    const result = await rebuildLedger(1, 2026, 6);
    expect(result).toHaveProperty('success', true);
    // Should only have 7 months (June=6 to December=12)
    expect(result.details.length).toBeLessThanOrEqual(7);
    // First detail should be month 6
    if (result.details.length > 0) {
      expect(result.details[0].month).toBe(6);
    }
  });

  test('validateMonthlyBalances returns validation result', async () => {
    const result = await validateMonthlyBalances(1, 2026);
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('details');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});