/**
 * Shared performance measurement helpers for Ketoan ERP backend.
 *
 * This module is the single source of truth for the micro-benchmarks used by
 * both the Jest budgeted-benchmarks test and the standalone regression script
 * (scripts/perf-regression.mjs). Keeping the logic in one place guarantees that
 * CI budget checks and the historical baseline are measured identically.
 */

/**
 * Measure the average wall-clock duration (ms) of `fn` over `iterations` runs.
 * @param {() => void} fn
 * @param {number} [iterations=1]
 * @returns {number} average milliseconds per iteration
 */
export function measure(fn, iterations = 1) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn(i);
  }
  return (performance.now() - start) / iterations;
}

// ─── Tax Rate Performance ───

/**
 * Progressive corporate income tax rate lookup (Thông tư 99/2025/TT-BTC).
 * @param {number} revenue
 * @returns {number}
 */
export function getTaxRate(revenue) {
  if (revenue <= 3_000_000_000) return 0.15;
  if (revenue <= 50_000_000_000) return 0.17;
  return 0.20;
}

// ─── BQGQ Calculation (Bình quân gia quyền) ───

/**
 * Weighted-average cost calculation.
 * @param {Array<{quantity:number, unitPrice:number}>} inventory
 * @returns {number}
 */
export function calculateBQGQ(inventory) {
  let totalQty = 0;
  let totalVal = 0;
  for (const item of inventory) {
    totalQty += item.quantity;
    totalVal += item.quantity * item.unitPrice;
  }
  return totalQty > 0 ? totalVal / totalQty : 0;
}

// ─── FIFO Calculation ───

/**
 * FIFO cost of goods sold for a given export quantity across price batches.
 * @param {Array<{quantity:number, unitPrice:number}>} batches
 * @param {number} exportQty
 * @returns {number}
 */
export function calculateFIFOCost(batches, exportQty) {
  const layers = batches.map((b) => ({ ...b, remaining: b.quantity }));
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

  return totalCost;
}

// ─── Currency Formatting ───

/**
 * Format a VND amount using the Vietnamese locale.
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}