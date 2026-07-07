/**
 * Budgeted Performance Benchmarks
 *
 * Tests that core operations stay within defined performance budgets.
 * Budgets are loaded from perf-budgets.json and can be compared against
 * historical baselines for regression detection.
 *
 * Measurement logic is shared with scripts/perf-regression.mjs via
 * ../perf-baselines/measure.mjs so CI budget checks and the baseline agree.
 */

import { describe, expect, test } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { measure, getTaxRate, calculateBQGQ, calculateFIFOCost, formatCurrency } from '../perf-baselines/measure.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadBudgets() {
  const budgetPath = path.resolve(__dirname, '../perf-budgets.json');
  const raw = fs.readFileSync(budgetPath, 'utf-8');
  return JSON.parse(raw);
}

// ─── Tests ───

describe('Performance: Budgeted benchmarks', () => {
  const budgets = loadBudgets();
  const b = budgets.budgets;

  test(`Tax rate lookup (10,000 iterations) < ${b.taxRateTenThousandLookups}ms`, () => {
    const revenues = Array.from({ length: 10000 }, (_, i) =>
      Math.floor(Math.random() * 100_000_000_000)
    );

    const elapsed = measure(() => {
      for (const rev of revenues) {
        getTaxRate(rev);
      }
    }, 1);

    expect(elapsed).toBeLessThan(b.taxRateTenThousandLookups);
    console.log(`  Tax rate: ${elapsed.toFixed(2)}ms (budget: ${b.taxRateTenThousandLookups}ms)`);
  });

  test(`BQGQ calculation (10,000 iterations) < ${b.bqgqTenThousandCalculations}ms`, () => {
    const inventories = Array.from({ length: 10000 }, () =>
      Array.from({ length: 10 }, () => ({
        quantity: Math.floor(Math.random() * 1000) + 1,
        unitPrice: Math.floor(Math.random() * 100000) + 1000,
      }))
    );

    const elapsed = measure(() => {
      for (const inv of inventories) {
        calculateBQGQ(inv);
      }
    }, 1);

    expect(elapsed).toBeLessThan(b.bqgqTenThousandCalculations);
    console.log(`  BQGQ: ${elapsed.toFixed(2)}ms (budget: ${b.bqgqTenThousandCalculations}ms)`);
  });

  test(`FIFO calculation (10,000 iterations) < ${b.fifoTenThousandCalculations}ms`, () => {
    const batches = Array.from({ length: 10000 }, () => ({
      quantity: Math.floor(Math.random() * 100) + 1,
      unitPrice: Math.floor(Math.random() * 50000) + 1000,
    }));

    const elapsed = measure(() => {
      calculateFIFOCost(batches, Math.floor(Math.random() * 500));
    }, 10000);

    expect(elapsed).toBeLessThan(b.fifoTenThousandCalculations);
    console.log(`  FIFO: ${elapsed.toFixed(2)}ms (budget: ${b.fifoTenThousandCalculations}ms)`);
  });

  test(`Currency formatting (10,000 iterations) < ${b.formatCurrencyTenThousand}ms`, () => {
    const amounts = Array.from({ length: 10000 }, () =>
      Math.floor(Math.random() * 100_000_000_000)
    );

    const elapsed = measure(() => {
      for (const amt of amounts) {
        formatCurrency(amt);
      }
    }, 1);

    expect(elapsed).toBeLessThan(b.formatCurrencyTenThousand);
    console.log(`  Format currency: ${elapsed.toFixed(2)}ms (budget: ${b.formatCurrencyTenThousand}ms)`);
  });

  test('Budget registry file is valid JSON', () => {
    expect(budgets).toHaveProperty('version');
    expect(budgets).toHaveProperty('budgets');
    expect(budgets).toHaveProperty('_baseline');

    // All budget values (not metadata keys starting with _) should be positive numbers
    for (const [key, value] of Object.entries(budgets.budgets)) {
      if (key.startsWith('_')) continue;
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThan(0);
    }
  });
});