/**
 * Statistical Tests for Tax Distribution Properties
 *
 * Verifies that tax calculations behave correctly across
 * statistical distributions and edge cases.
 */

import { describe, expect, test } from '@jest/globals';

// ─── Tax rate function (mirrors the real progressive tax logic) ───

function getTaxRate(revenue) {
  if (revenue <= 3_000_000_000) return 0.15;
  if (revenue <= 50_000_000_000) return 0.17;
  return 0.20;
}

function calculateTax(profit, revenue) {
  if (profit <= 0) {
    return { taxAmount: 0, taxRate: 0, effectiveRate: 0 };
  }
  const rate = getTaxRate(revenue);
  const taxAmount = Math.round(profit * rate);
  return {
    taxAmount,
    taxRate: rate,
    effectiveRate: profit > 0 ? taxAmount / profit : 0,
  };
}

// ─── Helpers ───

function generateRevenues(count, distribution = 'uniform') {
  const revenues = [];
  for (let i = 0; i < count; i++) {
    switch (distribution) {
      case 'uniform':
        revenues.push(Math.floor(Math.random() * 100_000_000_000));
        break;
      case 'small_business':
        // 80% of businesses have revenue < 3 tỷ
        revenues.push(Math.random() < 0.8
          ? Math.floor(Math.random() * 3_000_000_000)
          : Math.floor(Math.random() * 97_000_000_000) + 3_000_000_000);
        break;
      case 'log_normal':
        // Simulate log-normal distribution (most businesses are small)
        const base = Math.exp(Math.random() * 5 + 10); // range ~exp(10) to exp(15)
        revenues.push(Math.min(Math.floor(base), 100_000_000_000));
        break;
      default:
        revenues.push(Math.floor(Math.random() * 100_000_000_000));
    }
  }
  return revenues;
}

// ─── Tests ───

describe('Statistical: Tax rate distribution properties', () => {
  test('Tax rate is monotonic non-decreasing across full revenue range', () => {
    // Generate 10,000 revenue samples and verify monotonicity
    const revenues = Array.from({ length: 10000 }, () =>
      Math.floor(Math.random() * 100_000_000_000)
    ).sort((a, b) => a - b);

    let prevRate = 0;
    for (const rev of revenues) {
      const rate = getTaxRate(rev);
      expect(rate).toBeGreaterThanOrEqual(prevRate);
      prevRate = rate;
    }
  });

  test('Tax rate distribution matches expected bracket proportions (uniform)', () => {
    const revenues = generateRevenues(10000, 'uniform');
    const bracketCounts = { low: 0, mid: 0, high: 0 };

    for (const rev of revenues) {
      const rate = getTaxRate(rev);
      if (rate === 0.15) bracketCounts.low++;
      else if (rate === 0.17) bracketCounts.mid++;
      else bracketCounts.high++;
    }

    // With uniform distribution over [0, 100B]:
    // Low bracket (0-3B): ~3% of range
    // Mid bracket (3-50B): ~47% of range
    // High bracket (50-100B): ~50% of range
    const total = revenues.length;
    expect(bracketCounts.low / total).toBeGreaterThan(0.01);
    expect(bracketCounts.low / total).toBeLessThan(0.06);
    expect(bracketCounts.mid / total).toBeGreaterThan(0.40);
    expect(bracketCounts.mid / total).toBeLessThan(0.55);
    expect(bracketCounts.high / total).toBeGreaterThan(0.40);
    expect(bracketCounts.high / total).toBeLessThan(0.60);
  });

  test('Small business distribution skews toward low tax bracket', () => {
    const revenues = generateRevenues(10000, 'small_business');
    const bracketCounts = { low: 0, mid: 0, high: 0 };

    for (const rev of revenues) {
      const rate = getTaxRate(rev);
      if (rate === 0.15) bracketCounts.low++;
      else if (rate === 0.17) bracketCounts.mid++;
      else bracketCounts.high++;
    }

    // With small business distribution, most should be in low bracket
    const total = revenues.length;
    expect(bracketCounts.low / total).toBeGreaterThan(0.70);
    expect(bracketCounts.high / total).toBeLessThan(0.20);
  });

  test('Effective tax rate never exceeds nominal rate', () => {
    for (let i = 0; i < 1000; i++) {
      const revenue = Math.floor(Math.random() * 100_000_000_000);
      const profit = Math.floor(Math.random() * 50_000_000_000);
      const result = calculateTax(profit, revenue);

      if (profit > 0) {
        // Allow tolerance for Math.round() rounding up
        expect(result.effectiveRate).toBeLessThanOrEqual(result.taxRate + 1e-6);
      } else {
        expect(result.taxAmount).toBe(0);
      }
    }
  });
});

describe('Statistical: Tax bracket boundary behavior', () => {
  test('Boundary at exactly 3 tỷ is in low bracket', () => {
    expect(getTaxRate(3_000_000_000)).toBe(0.15);
  });

  test('Boundary at exactly 3 tỷ + 1đ is in mid bracket', () => {
    expect(getTaxRate(3_000_000_001)).toBe(0.17);
  });

  test('Boundary at exactly 50 tỷ is in mid bracket', () => {
    expect(getTaxRate(50_000_000_000)).toBe(0.17);
  });

  test('Boundary at exactly 50 tỷ + 1đ is in high bracket', () => {
    expect(getTaxRate(50_000_000_001)).toBe(0.20);
  });

  test('Zero revenue returns lowest rate', () => {
    expect(getTaxRate(0)).toBe(0.15);
  });

  test('Extremely large revenue returns highest rate', () => {
    expect(getTaxRate(1_000_000_000_000)).toBe(0.20);
  });
});

describe('Statistical: Tax calculation edge cases', () => {
  test('Large profit with small revenue uses correct bracket', () => {
    const result = calculateTax(10_000_000_000, 1_000_000_000);
    // Revenue 1B => low bracket (15%)
    expect(result.taxRate).toBe(0.15);
    expect(result.taxAmount).toBe(1_500_000_000);
  });

  test('Small profit with large revenue uses correct bracket', () => {
    const result = calculateTax(1_000_000, 60_000_000_000);
    // Revenue 60B => high bracket (20%)
    expect(result.taxRate).toBe(0.20);
    expect(result.taxAmount).toBe(200_000);
  });

  test('Very small profit (1 VND) calculates correctly', () => {
    const result = calculateTax(1, 1_000_000_000);
    expect(result.taxRate).toBe(0.15);
    // 1 * 0.15 = 0.15, rounded to 0
    expect(result.taxAmount).toBe(0);
  });

  test('Maximum realistic values do not overflow', () => {
    const revenue = 100_000_000_000; // 100 tỷ
    const profit = 50_000_000_000;   // 50 tỷ
    const result = calculateTax(profit, revenue);
    expect(result.taxAmount).toBe(10_000_000_000); // 50 tỷ * 20%
    expect(Number.isFinite(result.taxAmount)).toBe(true);
  });
});

describe('Statistical: Profit margin distribution', () => {
  test('Tax amount is proportional to profit within same bracket', () => {
    const revenue = 10_000_000_000; // Mid bracket (17%)
    const profits = [1_000_000, 10_000_000, 100_000_000, 1_000_000_000];

    const results = profits.map(p => calculateTax(p, revenue));

    // All should have same effective rate (17%)
    for (const r of results) {
      expect(r.taxRate).toBe(0.17);
    }

    // Tax amounts should be strictly increasing with profit
    for (let i = 1; i < results.length; i++) {
      expect(results[i].taxAmount).toBeGreaterThan(results[i - 1].taxAmount);
    }
  });
});