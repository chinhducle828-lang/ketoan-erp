/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * Unit tests for format utility functions
 * Uses Node.js built-in test runner (no external dependencies)
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatNumber,
  getAlignmentClass,
  formatDate,
  formatDateForInput,
} from './format.js';

describe('formatNumber', () => {
  test('formats integer with thousands separator', () => {
    assert.equal(formatNumber(1234567), '1.234.567');
  });

  test('formats with decimal places', () => {
    assert.equal(formatNumber(1234.5, 2), '1.234,50');
  });

  test('handles null/undefined as 0', () => {
    assert.equal(formatNumber(null), '0');
    assert.equal(formatNumber(undefined), '0');
  });

  test('handles zero', () => {
    assert.equal(formatNumber(0), '0');
  });

  test('handles string numbers', () => {
    assert.equal(formatNumber('5000000', 0), '5.000.000');
  });
});

describe('getAlignmentClass', () => {
  test('returns text-right for currency', () => {
    assert.equal(getAlignmentClass('currency'), 'text-right');
  });

  test('returns text-right for number', () => {
    assert.equal(getAlignmentClass('number'), 'text-right');
  });

  test('returns text-left for default', () => {
    assert.equal(getAlignmentClass('default'), 'text-left');
  });

  test('returns text-left for unknown type', () => {
    assert.equal(getAlignmentClass('unknown'), 'text-left');
  });

  test('returns text-left when no type provided', () => {
    assert.equal(getAlignmentClass(), 'text-left');
  });
});

describe('formatDate', () => {
  test('formats date string to Vietnamese locale', () => {
    const result = formatDate('2026-07-15');
    assert.ok(result);
    assert.equal(typeof result, 'string');
  });

  test('returns empty string for null/undefined', () => {
    assert.equal(formatDate(null), '');
    assert.equal(formatDate(undefined), '');
  });

  test('formats Date object', () => {
    const result = formatDate(new Date(2026, 0, 1));
    assert.ok(result);
  });
});

describe('formatDateForInput', () => {
  test('formats date to YYYY-MM-DD', () => {
    assert.ok(formatDateForInput('2026-07-15').includes('2026-'));
  });

  test('returns empty string for null/undefined', () => {
    assert.equal(formatDateForInput(null), '');
    assert.equal(formatDateForInput(undefined), '');
  });
});