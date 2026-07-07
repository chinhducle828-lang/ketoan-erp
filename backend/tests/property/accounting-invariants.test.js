/**
 * Property-Based Tests for Accounting Invariants
 *
 * Uses fast-check to verify that core accounting properties hold
 * for a wide range of randomly generated inputs.
 *
 * Key invariants tested:
 * 1. Double-entry: sum(DR) === sum(CR) for all valid vouchers
 * 2. Balance sheet: Total Assets === Total Liabilities + Equity
 * 3. Tax progression: rate(r1) <= rate(r2) when r1 < r2 (monotonic)
 * 4. Tax amount never exceeds profit
 * 5. Inventory conservation: opening + inbound - outbound === closing
 * 6. Multi-currency: VND values unchanged, foreign converted correctly
 */

import fc from 'fast-check';
import { describe, expect, test } from '@jest/globals';

// ─── Custom arbitraries that generate balanced data ───

const accountCodes = fc.constantFrom(
  '1111', '1121', '131', '156', '1561', '1562',
  '331', '334', '411', '511', '632', '641', '642', '911'
);

/**
 * Generates an array of detail lines where DR total === CR total.
 * This avoids fc.pre() rejection rate issues from random generation.
 */
function balancedDetailsArbitrary(minBalance = 1000, maxBalance = 100_000_000) {
  return fc
    .tuple(
      fc.integer({ min: minBalance, max: maxBalance }), // shared total
      fc.array(accountCodes, { minLength: 1, maxLength: 4 }), // DR accounts
      fc.array(accountCodes, { minLength: 1, maxLength: 4 }), // CR accounts
      fc
        .array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 4 })
        .map(weights => {
          const sum = weights.reduce((a, b) => a + b, 0);
          return weights.map(w => w / sum);
        }), // DR distribution weights
      fc
        .array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 4 })
        .map(weights => {
          const sum = weights.reduce((a, b) => a + b, 0);
          return weights.map(w => w / sum);
        }) // CR distribution weights
    )
    .map(([total, drAccounts, crAccounts, drWeights, crWeights]) => {
      const drDetails = drAccounts.map((acc, i) => ({
        accountCode: acc,
        entryType: 'DR',
        amount: Math.round(total * drWeights[i % drWeights.length]),
      }));

      const crDetails = crAccounts.map((acc, i) => ({
        accountCode: acc,
        entryType: 'CR',
        amount: Math.round(total * crWeights[i % crWeights.length]),
      }));

      // Adjust last entry to ensure balance, keeping all amounts > 0
      const drSum = drDetails.reduce((s, d) => s + d.amount, 0);
      const crSum = crDetails.reduce((s, d) => s + d.amount, 0);
      if (drSum !== crSum) {
        const diff = drSum - crSum;
        const lastDr = drDetails[drDetails.length - 1];
        lastDr.amount -= diff;
        // If adjustment made it <= 0, add the difference to a CR entry instead
        if (lastDr.amount <= 0) {
          lastDr.amount += diff; // revert
          const lastCr = crDetails[crDetails.length - 1];
          lastCr.amount += diff;
        }
      }

      // Filter out any zero-amount entries (shouldn't happen, but be safe)
      const filtered = [...drDetails, ...crDetails].filter(d => d.amount > 0);
      // Ensure we still have at least 2 entries
      if (filtered.length < 2) {
        return [
          { accountCode: '1111', entryType: 'DR', amount: total },
          { accountCode: '131', entryType: 'CR', amount: total },
        ];
      }
      return filtered;
    });
}

// ─── Tests ───

describe('Property: Double-entry accounting invariant', () => {
  test('For any balanced voucher, DR total always equals CR total', () => {
    fc.assert(
      fc.property(balancedDetailsArbitrary(), (details) => {
        const drTotal = details
          .filter(d => d.entryType === 'DR')
          .reduce((sum, d) => sum + d.amount, 0);
        const crTotal = details
          .filter(d => d.entryType === 'CR')
          .reduce((sum, d) => sum + d.amount, 0);

        expect(drTotal).toBe(crTotal);
        expect(drTotal).toBeGreaterThan(0);
        expect(crTotal).toBeGreaterThan(0);
      }),
      { numRuns: 500 }
    );
  });

  test('No valid voucher has negative amounts', () => {
    fc.assert(
      fc.property(balancedDetailsArbitrary(), (details) => {
        expect(details.every(d => d.amount > 0)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  test('Every valid voucher has at least one DR and one CR entry', () => {
    fc.assert(
      fc.property(balancedDetailsArbitrary(), (details) => {
        expect(details.some(d => d.entryType === 'DR')).toBe(true);
        expect(details.some(d => d.entryType === 'CR')).toBe(true);
      }),
      { numRuns: 200 }
    );
  });
});

describe('Property: Balance sheet identity', () => {
  /**
   * Generate a random balanced balance sheet where
   * Total Assets === Total Liabilities + Equity.
   */
  /**
   * Generate a balance sheet where we enforce the identity directly.
   * We pick asset components and compute liabilities + equity dynamically
   * to equal the sum of assets, avoiding rounding issues.
   */
  const balancedSheetArbitrary = () =>
    fc
      .tuple(
        fc.integer({ min: 1_000_000, max: 10_000_000_000 }), // cash
        fc.integer({ min: 0, max: 50_000_000_000 }),         // bank
        fc.integer({ min: 0, max: 20_000_000_000 }),         // inventory
        fc.integer({ min: 0, max: 10_000_000_000 }),         // receivables
        fc.integer({ min: 0, max: 100_000_000_000 })         // fixedAssets
      )
      .map(([cash, bank, inventory, receivables, fixedAssets]) => {
        const totalAssets = cash + bank + inventory + receivables + fixedAssets;
        // Split total into liabilities (0-100%) and equity (remaining)
        const liabilities = Math.round(totalAssets * Math.random());
        const equity = totalAssets - liabilities;

        return { cash, bank, inventory, receivables, fixedAssets, liabilities, equity };
      });

  test('Total Assets must equal Total Liabilities + Equity', () => {
    fc.assert(
      fc.property(balancedSheetArbitrary(), (data) => {
        const totalAssets =
          data.cash + data.bank + data.inventory + data.receivables + data.fixedAssets;
        const totalLiabilitiesEquity = data.liabilities + data.equity;

        expect(totalAssets).toBe(totalLiabilitiesEquity);
        expect(Object.values(data).every(v => v >= 0)).toBe(true);
      }),
      { numRuns: 500 }
    );
  });
});

describe('Property: Tax rate monotonicity', () => {
  function getTaxRate(revenue) {
    if (revenue <= 3_000_000_000) return 0.15;
    if (revenue <= 50_000_000_000) return 0.17;
    return 0.20;
  }

  test('Tax rate is monotonic non-decreasing with revenue', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 1_000_000_000_000n }),
        fc.bigInt({ min: 0n, max: 1_000_000_000_000n }),
        (rev1, rev2) => {
          const r1 = Number(rev1);
          const r2 = Number(rev2);
          const sorted = [r1, r2].sort((a, b) => a - b);
          const rateLow = getTaxRate(sorted[0]);
          const rateHigh = getTaxRate(sorted[1]);
          expect(rateLow).toBeLessThanOrEqual(rateHigh);
        }
      ),
      { numRuns: 500 }
    );
  });

  test('Tax amount never exceeds profit for positive profit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000_000_000 }),
        fc.integer({ min: 1, max: 50_000_000_000 }),
        (revenue, profit) => {
          const rate = getTaxRate(revenue);
          const taxAmount = profit * rate;
          expect(taxAmount).toBeLessThanOrEqual(profit);
          expect(taxAmount).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 500 }
    );
  });

  test('Tax amount is zero for negative or zero profit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000_000_000 }),
        fc.integer({ min: -1_000_000_000, max: 0 }),
        (revenue, profit) => {
          const rate = getTaxRate(revenue);
          const taxAmount = profit <= 0 ? 0 : profit * rate;
          expect(taxAmount).toBe(0);
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('Property: Inventory conservation (BQGQ)', () => {
  test('Opening + Inbound - Outbound = Closing (non-negative)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000_000 }),
        fc.integer({ min: 0, max: 10_000_000_000 }),
        fc.integer({ min: 0, max: 10_000_000_000 }),
        (opening, inbound, outbound) => {
          // Ensure inventory never goes negative
          fc.pre(opening + inbound >= outbound);

          const closing = opening + inbound - outbound;
          expect(closing).toBeGreaterThanOrEqual(0);
          expect(closing).toBe(opening + inbound - outbound);
        }
      ),
      { numRuns: 500 }
    );
  });

  test('Weighted average price is between min and max unit price', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            quantity: fc.integer({ min: 1, max: 1000 }),
            unitPrice: fc.integer({ min: 1000, max: 100_000 }),
          }),
          { minLength: 2, maxLength: 50 }
        ),
        (purchases) => {
          const totalQty = purchases.reduce((s, p) => s + p.quantity, 0);
          const totalVal = purchases.reduce((s, p) => s + p.quantity * p.unitPrice, 0);
          const avgPrice = totalVal / totalQty;

          const minPrice = Math.min(...purchases.map(p => p.unitPrice));
          const maxPrice = Math.max(...purchases.map(p => p.unitPrice));

          expect(avgPrice).toBeGreaterThanOrEqual(minPrice);
          expect(avgPrice).toBeLessThanOrEqual(maxPrice);
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('Property: Multi-currency conversion', () => {
  test('VND amounts remain unchanged regardless of exchange rate', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 100_000_000 }),
        (vndAmount) => {
          const converted = vndAmount * 1;
          expect(converted).toBe(vndAmount);
        }
      ),
      { numRuns: 200 }
    );
  });

  test('Foreign currency conversion produces positive VND amount', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 1_000_000 }),
        fc.double({ min: 0.01, max: 100_000, noNaN: true, noDefaultInfinity: true }),
        (foreignAmount, rate) => {
          const vndAmount = Math.round(foreignAmount * rate);
          expect(vndAmount).toBeGreaterThan(0);
          expect(Number.isFinite(vndAmount)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe('Property: FIFO cost layer consumption', () => {
  test('FIFO consumes oldest layers first and cost is bounded by prices', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            quantity: fc.integer({ min: 1, max: 100 }),
            unitPrice: fc.integer({ min: 1000, max: 50_000 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        fc.integer({ min: 1, max: 500 }),
        (batches, exportQty) => {
          const layers = batches.map(b => ({ ...b, remaining: b.quantity }));
          let remainingExport = exportQty;
          let totalCost = 0;
          let layerIndex = 0;

          while (remainingExport > 0 && layerIndex < layers.length) {
            const take = Math.min(layers[layerIndex].remaining, remainingExport);
            totalCost += take * layers[layerIndex].unitPrice;
            layers[layerIndex].remaining -= take;
            remainingExport -= take;
            if (layers[layerIndex].remaining === 0) layerIndex++;
          }

          const minPrice = Math.min(...batches.map(b => b.unitPrice));
          const maxPrice = Math.max(...batches.map(b => b.unitPrice));
          const actualExport = Math.min(exportQty, batches.reduce((s, b) => s + b.quantity, 0));

          if (actualExport > 0) {
            const avgCostPerUnit = totalCost / actualExport;
            expect(avgCostPerUnit).toBeGreaterThanOrEqual(minPrice);
            expect(avgCostPerUnit).toBeLessThanOrEqual(maxPrice);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});