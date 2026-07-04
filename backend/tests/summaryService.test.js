import { describe, expect, test } from '@jest/globals';
import { buildPeriodBalanceSummaryQuery } from '../services/summary.service.js';

describe('summary service', () => {
  test('builds a single SQL aggregation query for multiple accounts', () => {
    const query = buildPeriodBalanceSummaryQuery(['511', '632', '911'], 2026, 7);

    expect(query).toContain('WITH period_balance_summary');
    expect(query).toContain('account_code');
    expect(query).toContain('monthly_balances');
  });
});
