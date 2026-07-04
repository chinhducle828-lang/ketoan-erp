import { describe, expect, test } from '@jest/globals';
import { buildMultiCurrencyDetail } from '../services/multiCurrency.service.js';

describe('multi-currency helpers', () => {
  test('converts foreign currency amounts to VND using voucher exchange rate', () => {
    const detail = buildMultiCurrencyDetail({ amountOrigin: 100, currencyOrigin: 'USD' }, 25);

    expect(detail.amount).toBe(2500);
    expect(detail.amountOrigin).toBe(100);
    expect(detail.currencyOrigin).toBe('USD');
  });

  test('keeps VND values unchanged when currency is VND', () => {
    const detail = buildMultiCurrencyDetail({ amountOrigin: 500000, currencyOrigin: 'VND' }, 1);

    expect(detail.amount).toBe(500000);
    expect(detail.amountOrigin).toBe(500000);
    expect(detail.currencyOrigin).toBe('VND');
  });
});
