import { describe, it, expect } from '@jest/globals';
import { shouldClearExistingSessions } from '../services/sessionPolicy.js';

describe('session policy', () => {
  it('keeps existing sessions for storefront-only roles', () => {
    expect(shouldClearExistingSessions('nv_banhang')).toBe(false);
    expect(shouldClearExistingSessions('nv_kho')).toBe(false);
  });

  it('clears existing sessions for ERP roles that need a fresh login', () => {
    expect(shouldClearExistingSessions('admin')).toBe(true);
    expect(shouldClearExistingSessions('ktt')).toBe(true);
    expect(shouldClearExistingSessions('nv_banhang')).toBe(false);
  });
});
