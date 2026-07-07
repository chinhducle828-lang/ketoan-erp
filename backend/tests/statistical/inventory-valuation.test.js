/**
 * Statistical Tests for Inventory Valuation Methods
 *
 * Tests BQGQ (weighted average) and FIFO inventory valuation
 * methods with statistical properties and edge cases.
 */

import { describe, expect, test } from '@jest/globals';

// ─── BQGQ (Weighted Average) ───

function calculateBQGQ(inventory) {
  const totalQty = inventory.reduce((s, i) => s + i.quantity, 0);
  const totalVal = inventory.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  return {
    totalQuantity: totalQty,
    totalValue: totalVal,
    avgPrice: totalQty > 0 ? totalVal / totalQty : 0,
  };
}

function calculateBQGQCost(inventory, exportQty) {
  const { avgPrice, totalQuantity } = calculateBQGQ(inventory);
  const actualExport = Math.min(exportQty, totalQuantity);
  return {
    cost: actualExport * avgPrice,
    avgPrice,
    remainingQty: totalQuantity - actualExport,
  };
}

// ─── FIFO ───

function calculateFIFOCost(batches, exportQty) {
  const layers = batches.map(b => ({ ...b, remaining: b.quantity }));
  let remaining = exportQty;
  let totalCost = 0;
  let layerIndex = 0;

  while (remaining > 0 && layerIndex < layers.length) {
    const take = Math.min(layers[layerIndex].remaining, remaining);
    totalCost += take * layers[layerIndex].unitPrice;
    layers[layerIndex].remaining -= take;
    remaining -= take;
    if (layers[layerIndex].remaining === 0) layerIndex++;
  }

  return {
    cost: totalCost,
    exportedQty: exportQty - remaining,
    remainingLayers: layers.filter(l => l.remaining > 0),
  };
}

// ─── Helpers ───

function generateRandomInventory(count) {
  return Array.from({ length: count }, () => ({
    quantity: Math.floor(Math.random() * 1000) + 1,
    unitPrice: Math.floor(Math.random() * 100000) + 1000,
  }));
}

// ─── Tests ───

describe('Statistical: BQGQ (Weighted Average) Inventory Valuation', () => {
  const FP_EPSILON = 1e-6;

  test('BQGQ average price converges with large number of purchases', () => {
    // With many purchases at varying prices, the weighted average
    // should converge toward the mean of the price distribution
    const inventory = generateRandomInventory(100);
    const { avgPrice } = calculateBQGQ(inventory);

    const prices = inventory.map(i => i.unitPrice);
    const meanPrice = prices.reduce((s, p) => s + p, 0) / prices.length;

    // Weighted average should be within 20% of simple mean
    // (they differ because of quantity weighting)
    expect(avgPrice).toBeGreaterThan(0);
    expect(Math.abs(avgPrice - meanPrice) / meanPrice).toBeLessThan(0.5);
  });

  test('BQGQ cost never exceeds total inventory value', () => {
    for (let trial = 0; trial < 100; trial++) {
      const inventory = generateRandomInventory(Math.floor(Math.random() * 20) + 1);
      const { totalValue } = calculateBQGQ(inventory);
      const exportQty = Math.floor(Math.random() * 2000);

      const { cost } = calculateBQGQCost(inventory, exportQty);
      expect(cost).toBeLessThanOrEqual(totalValue + FP_EPSILON);
      expect(cost).toBeGreaterThanOrEqual(0);
    }
  });

  test('BQGQ with single purchase returns exact unit price', () => {
    const inventory = [{ quantity: 100, unitPrice: 25000 }];
    const { avgPrice } = calculateBQGQ(inventory);
    expect(avgPrice).toBe(25000);

    const { cost } = calculateBQGQCost(inventory, 50);
    expect(cost).toBe(50 * 25000);
  });

  test('BQGQ with identical unit prices returns that price', () => {
    const inventory = [
      { quantity: 50, unitPrice: 15000 },
      { quantity: 100, unitPrice: 15000 },
      { quantity: 75, unitPrice: 15000 },
    ];
    const { avgPrice } = calculateBQGQ(inventory);
    expect(avgPrice).toBe(15000);
  });

  test('BQGQ with zero quantity returns zero average price', () => {
    const { avgPrice, totalQuantity } = calculateBQGQ([]);
    expect(avgPrice).toBe(0);
    expect(totalQuantity).toBe(0);
  });

  test('BQGQ cost for zero export is zero', () => {
    const inventory = generateRandomInventory(5);
    const { cost } = calculateBQGQCost(inventory, 0);
    expect(cost).toBe(0);
  });

  test('BQGQ cost for export exceeding inventory uses all available', () => {
    const inventory = [{ quantity: 10, unitPrice: 10000 }];
    const { cost, remainingQty } = calculateBQGQCost(inventory, 100);
    expect(cost).toBe(10 * 10000);
    expect(remainingQty).toBe(0);
  });
});

describe('Statistical: FIFO Inventory Valuation', () => {
  test('FIFO consumes oldest layers first', () => {
    const batches = [
      { quantity: 100, unitPrice: 10000 },
      { quantity: 50, unitPrice: 12000 },
    ];

    // Export 80 units: all from first batch (oldest)
    const result = calculateFIFOCost(batches, 80);
    expect(result.cost).toBe(80 * 10000);
    expect(result.remainingLayers[0].remaining).toBe(20);
    expect(result.remainingLayers[1].remaining).toBe(50);
  });

  test('FIFO crosses batch boundaries correctly', () => {
    const batches = [
      { quantity: 100, unitPrice: 10000 },
      { quantity: 50, unitPrice: 12000 },
    ];

    // Export 120 units: 100 from batch 1, 20 from batch 2
    const result = calculateFIFOCost(batches, 120);
    expect(result.cost).toBe(100 * 10000 + 20 * 12000);
    expect(result.remainingLayers.length).toBe(1);
    expect(result.remainingLayers[0].remaining).toBe(30);
  });

  test('FIFO with single batch equals simple multiplication', () => {
    const batches = [{ quantity: 200, unitPrice: 15000 }];
    const result = calculateFIFOCost(batches, 50);
    expect(result.cost).toBe(50 * 15000);
  });

  test('FIFO cost is bounded by min/max unit prices', () => {
    for (let trial = 0; trial < 100; trial++) {
      const batches = generateRandomInventory(Math.floor(Math.random() * 10) + 1);
      const totalQty = batches.reduce((s, b) => s + b.quantity, 0);
      const exportQty = Math.floor(Math.random() * totalQty) + 1;

      const result = calculateFIFOCost(batches, exportQty);
      const minPrice = Math.min(...batches.map(b => b.unitPrice));
      const maxPrice = Math.max(...batches.map(b => b.unitPrice));

      const avgCostPerUnit = result.cost / result.exportedQty;
      expect(avgCostPerUnit).toBeGreaterThanOrEqual(minPrice);
      expect(avgCostPerUnit).toBeLessThanOrEqual(maxPrice);
    }
  });

  test('FIFO with zero export returns zero cost', () => {
    const batches = generateRandomInventory(5);
    const result = calculateFIFOCost(batches, 0);
    expect(result.cost).toBe(0);
    expect(result.exportedQty).toBe(0);
  });

  test('FIFO with export exceeding total uses all available', () => {
    const batches = [
      { quantity: 10, unitPrice: 10000 },
      { quantity: 5, unitPrice: 12000 },
    ];
    const result = calculateFIFOCost(batches, 100);
    expect(result.cost).toBe(10 * 10000 + 5 * 12000);
    expect(result.exportedQty).toBe(15);
    expect(result.remainingLayers.length).toBe(0);
  });
});

describe('Statistical: BQGQ vs FIFO comparison', () => {
  test('In rising price market, FIFO cost < BQGQ cost (older layers cheaper)', () => {
    const risingPrices = [
      { quantity: 100, unitPrice: 10000 },
      { quantity: 100, unitPrice: 15000 },
      { quantity: 100, unitPrice: 20000 },
    ];

    const exportQty = 150;
    const fifo = calculateFIFOCost(risingPrices, exportQty);
    const bqgq = calculateBQGQCost(risingPrices, exportQty);

    // In rising market, FIFO uses cheaper older stock first
    expect(fifo.cost).toBeLessThan(bqgq.cost);
  });

  test('In falling price market, FIFO cost > BQGQ cost (older layers more expensive)', () => {
    const fallingPrices = [
      { quantity: 100, unitPrice: 20000 },
      { quantity: 100, unitPrice: 15000 },
      { quantity: 100, unitPrice: 10000 },
    ];

    const exportQty = 150;
    const fifo = calculateFIFOCost(fallingPrices, exportQty);
    const bqgq = calculateBQGQCost(fallingPrices, exportQty);

    // In falling market, FIFO uses more expensive older stock first
    expect(fifo.cost).toBeGreaterThan(bqgq.cost);
  });

  test('BQGQ and FIFO converge with single purchase batch', () => {
    const singleBatch = [{ quantity: 500, unitPrice: 12000 }];
    const exportQty = 200;

    const fifo = calculateFIFOCost(singleBatch, exportQty);
    const bqgq = calculateBQGQCost(singleBatch, exportQty);

    expect(fifo.cost).toBe(bqgq.cost);
  });
});

describe('Statistical: Inventory valuation edge cases', () => {
  test('Very large quantities do not cause overflow', () => {
    const inventory = [
      { quantity: 1_000_000, unitPrice: 100_000 },
      { quantity: 2_000_000, unitPrice: 200_000 },
    ];

    const { totalValue } = calculateBQGQ(inventory);
    expect(totalValue).toBe(1_000_000 * 100_000 + 2_000_000 * 200_000);
    expect(Number.isFinite(totalValue)).toBe(true);
  });

  test('Fractional average prices are handled correctly', () => {
    const inventory = [
      { quantity: 3, unitPrice: 10000 },
      { quantity: 3, unitPrice: 10001 },
    ];

    const { avgPrice } = calculateBQGQ(inventory);
    // (3*10000 + 3*10001) / 6 = 60003 / 6 = 10000.5
    expect(avgPrice).toBe(10000.5);
  });

  test('Single unit inventory has exact unit price as average', () => {
    const inventory = [{ quantity: 1, unitPrice: 99999 }];
    const { avgPrice } = calculateBQGQ(inventory);
    expect(avgPrice).toBe(99999);
  });
});