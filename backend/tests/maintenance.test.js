import { describe, expect, test } from '@jest/globals';
import { rebuildLedger } from '../services/maintenance.service.js';

describe('maintenance service', () => {
  test('rebuildLedger returns a success payload when called with valid inputs', async () => {
    const result = await rebuildLedger(1, '2026-01-01');
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('monthCount');
  });
});
