import { describe, expect, test } from '@jest/globals';
import { normalizePostingState, buildPostedOnlyClause, buildPostingUpdateValues } from '../services/voucherStatus.js';

describe('voucher posting status helpers', () => {
  test('normalizePostingState converts explicit posted values to boolean', () => {
    expect(normalizePostingState(true)).toBe(true);
    expect(normalizePostingState('true')).toBe(true);
    expect(normalizePostingState('false')).toBe(false);
    expect(normalizePostingState(undefined)).toBe(false);
  });

  test('buildPostedOnlyClause adds posted-only SQL filter', () => {
    expect(buildPostedOnlyClause('WHERE v.company_id = $1')).toContain('AND v.is_posted = TRUE');
  });

  test('buildPostingUpdateValues returns posted audit fields for posting action', () => {
    const values = buildPostingUpdateValues(true, 7, new Date('2026-07-04T00:00:00.000Z'));
    expect(values.is_posted).toBe(true);
    expect(values.posted_by).toBe(7);
    expect(values.posted_at).toBeInstanceOf(Date);
  });
});
