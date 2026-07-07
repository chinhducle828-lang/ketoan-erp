/**
 * Unit tests for storefront formatters utility functions.
 * Uses Vitest globals (configured in vitest.config.js).
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  formatPrice,
  convertPrice,
  t,
  formatDisplayDate,
  parsePriceValue,
  getUnitPrice,
  getUnitPriceWithTax,
  getOrderAmount,
  normalizeAbsoluteUrl,
  resolveMediaUrl,
  buildErpLoginUrl,
  buildBearerConfig,
  isSessionAllowedForRole,
  getRoleDisplayName,
  isExplicitNonAdminRole,
} from './formatters.js';

describe('formatPrice', () => {
  test('formats VND with thousands separator and ₫ symbol', () => {
    expect(formatPrice(1000000)).toBe('1.000.000 ₫');
  });

  test('handles zero and invalid values as 0 ₫', () => {
    expect(formatPrice(0)).toBe('0 ₫');
    expect(formatPrice(null)).toBe('0 ₫');
    expect(formatPrice(undefined)).toBe('0 ₫');
  });

  test('converts to USD when currency is USD and rate provided', () => {
    expect(formatPrice(24000, 'USD', 24000)).toBe('$1.00');
  });

  test('falls back to default exchange rate for USD', () => {
    const result = formatPrice(48000, 'USD');
    expect(result).toBe('$2.00');
  });
});

describe('convertPrice', () => {
  test('returns same value for VND', () => {
    expect(convertPrice(100000, 'VND')).toBe(100000);
  });

  test('converts VND to USD with given rate', () => {
    expect(convertPrice(24000, 'USD', 24000)).toBe(1);
  });

  test('returns original for unknown currency', () => {
    expect(convertPrice(100000, 'XYZ')).toBe(100000);
  });
});

describe('t (translations)', () => {
  test('returns Vietnamese translation by default', () => {
    expect(t('checkout')).toBe('Tạo hóa đơn');
  });

  test('returns English translation when lang=EN', () => {
    expect(t('checkout', 'EN')).toBe('Checkout');
  });

  test('falls back to VI when key missing in requested lang', () => {
    expect(t('nonexistentKey', 'EN')).toBe('nonexistentKey');
  });
});

describe('formatDisplayDate', () => {
  test('returns N/A for empty value', () => {
    expect(formatDisplayDate('')).toBe('N/A');
    expect(formatDisplayDate(null)).toBe('N/A');
  });

  test('returns N/A for invalid date', () => {
    expect(formatDisplayDate('not-a-date')).toBe('N/A');
  });

  test('formats valid date string', () => {
    const result = formatDisplayDate('2026-07-15');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('parsePriceValue', () => {
  test('parses plain number', () => {
    expect(parsePriceValue(1234.5)).toBe(1234.5);
  });

  test('parses VND-style string with dots', () => {
    expect(parsePriceValue('1.234.567')).toBe(1234567);
  });

  test('parses string with comma decimal', () => {
    expect(parsePriceValue('1.234,56')).toBe(1234.56);
  });

  test('returns 0 for empty/invalid', () => {
    expect(parsePriceValue('')).toBe(0);
    expect(parsePriceValue(null)).toBe(0);
    expect(parsePriceValue('abc')).toBe(0);
  });
});

describe('getUnitPrice / getUnitPriceWithTax / getOrderAmount', () => {
  const item = { price_sell: '100.000' };

  test('getUnitPrice parses price_sell', () => {
    expect(getUnitPrice(item)).toBe(100000);
  });

  test('getUnitPriceWithTax applies default 8% VAT', () => {
    expect(getUnitPriceWithTax(item)).toBe(108000);
  });

  test('getUnitPriceWithTax applies custom VAT rate', () => {
    expect(getUnitPriceWithTax(item, 0.1)).toBe(110000);
  });

  test('getOrderAmount multiplies by quantity', () => {
    expect(getOrderAmount(item, 3)).toBe(300000);
  });

  test('getOrderAmount defaults quantity to 1', () => {
    expect(getOrderAmount(item)).toBe(100000);
  });
});

describe('normalizeAbsoluteUrl', () => {
  test('prepends https:// to bare host', () => {
    expect(normalizeAbsoluteUrl('example.com')).toBe('https://example.com');
  });

  test('returns empty string for empty input', () => {
    expect(normalizeAbsoluteUrl('')).toBe('');
  });

  test('keeps existing protocol', () => {
    expect(normalizeAbsoluteUrl('http://example.com/')).toBe('http://example.com');
  });
});

describe('resolveMediaUrl', () => {
  test('returns data/blob URLs unchanged', () => {
    expect(resolveMediaUrl('data:image/png;base64,xxx')).toBe('data:image/png;base64,xxx');
  });

  test('returns absolute http URLs unchanged', () => {
    expect(resolveMediaUrl('https://cdn.example.com/x.png')).toBe('https://cdn.example.com/x.png');
  });

  test('resolves relative path against API base', () => {
    const result = resolveMediaUrl('/uploads/x.png');
    expect(result).toContain('/uploads/x.png');
  });

  test('returns empty string for empty input', () => {
    expect(resolveMediaUrl('')).toBe('');
  });
});

describe('buildErpLoginUrl', () => {
  test('builds login URL with company and role params', () => {
    const url = buildErpLoginUrl('https://erp.example.com', 1, 'admin');
    expect(url).toContain('/login');
    expect(url).toContain('company_id=1');
    expect(url).toContain('role=admin');
  });
});

describe('buildBearerConfig', () => {
  test('returns empty object without token', () => {
    expect(buildBearerConfig()).toEqual({});
  });

  test('returns Authorization header with token', () => {
    expect(buildBearerConfig('abc')).toEqual({ headers: { Authorization: 'Bearer abc' } });
  });
});

describe('isSessionAllowedForRole', () => {
  test('guest target is always allowed', () => {
    expect(isSessionAllowedForRole('guest', null)).toBe(true);
  });

  test('admin requires admin session', () => {
    expect(isSessionAllowedForRole('admin', 'admin')).toBe(true);
    expect(isSessionAllowedForRole('admin', 'nv_banhang')).toBe(false);
  });

  test('warehouse role allowed for nv_kho or admin', () => {
    expect(isSessionAllowedForRole('nv_kho', 'nv_kho')).toBe(true);
    expect(isSessionAllowedForRole('nv_kho', 'admin')).toBe(true);
    expect(isSessionAllowedForRole('nv_kho', 'nv_banhang')).toBe(false);
  });

  test('sales role allowed for nv_banhang or admin', () => {
    expect(isSessionAllowedForRole('nv_banhang', 'nv_banhang')).toBe(true);
    expect(isSessionAllowedForRole('nv_banhang', 'admin')).toBe(true);
  });

  test('missing session role is denied', () => {
    expect(isSessionAllowedForRole('admin', null)).toBe(false);
  });
});

describe('getRoleDisplayName', () => {
  test('maps roles to Vietnamese display names', () => {
    expect(getRoleDisplayName('admin')).toBe('admin');
    expect(getRoleDisplayName('nv_kho')).toBe('nhân viên kho');
    expect(getRoleDisplayName('nv_banhang')).toBe('nhân viên bán hàng');
    expect(getRoleDisplayName('unknown')).toBe('người dùng');
  });
});

describe('isExplicitNonAdminRole', () => {
  test('returns false for empty/admin', () => {
    expect(isExplicitNonAdminRole('')).toBe(false);
    expect(isExplicitNonAdminRole('admin')).toBe(false);
  });

  test('returns true for non-admin role', () => {
    expect(isExplicitNonAdminRole('nv_kho')).toBe(true);
  });
});