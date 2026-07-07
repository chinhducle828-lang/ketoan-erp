/**
 * Performance regression checker for Ketoan ERP backend.
 *
 * Measures the core micro-benchmarks (shared with the Jest budgeted test via
 * ../tests/perf-baselines/measure.mjs) and compares them against the committed
 * historical baseline (../tests/perf-baselines/baseline.json).
 *
 * A benchmark REGRESSES when its measured time exceeds the baseline by more than
 * the configured tolerance (default 20%, see perf-budgets.json `_ci`).
 *
 * Usage:
 *   node scripts/perf-regression.mjs            # check against baseline
 *   node scripts/perf-regression.mjs --update   # (re)write the baseline file
 *
 * Exit code is non-zero when a regression is detected (so CI fails).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { measure, getTaxRate, calculateBQGQ, calculateFIFOCost, formatCurrency } from '../tests/perf-baselines/measure.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BUDGETS_PATH = path.join(ROOT, 'tests', 'perf-budgets.json');
const BASELINE_PATH = path.join(ROOT, 'tests', 'perf-baselines', 'baseline.json');

const UPDATE = process.argv.includes('--update');
const DEFAULT_TOLERANCE = 0.2;

// ─── Benchmark definitions ───
// Each returns the average duration (ms) for one measurement run.

function benchTaxRate() {
  const revenues = Array.from({ length: 10000 }, () =>
    Math.floor(Math.random() * 100_000_000_000)
  );
  return measure(() => {
    for (const rev of revenues) getTaxRate(rev);
  }, 1);
}

function benchBQGQ() {
  const inventories = Array.from({ length: 10000 }, () =>
    Array.from({ length: 10 }, () => ({
      quantity: Math.floor(Math.random() * 1000) + 1,
      unitPrice: Math.floor(Math.random() * 100000) + 1000,
    }))
  );
  return measure(() => {
    for (const inv of inventories) calculateBQGQ(inv);
  }, 1);
}

function benchFIFO() {
  const batches = Array.from({ length: 10000 }, () => ({
    quantity: Math.floor(Math.random() * 100) + 1,
    unitPrice: Math.floor(Math.random() * 50000) + 1000,
  }));
  return measure(() => calculateFIFOCost(batches, Math.floor(Math.random() * 500)), 10000);
}

function benchFormatCurrency() {
  const amounts = Array.from({ length: 10000 }, () =>
    Math.floor(Math.random() * 100_000_000_000)
  );
  return measure(() => {
    for (const amt of amounts) formatCurrency(amt);
  }, 1);
}

const BENCHMARKS = {
  taxRateTenThousandLookups: benchTaxRate,
  bqgqTenThousandCalculations: benchBQGQ,
  fifoTenThousandCalculations: benchFIFO,
  formatCurrencyTenThousand: benchFormatCurrency,
};

// ─── Load config ───

function loadTolerance() {
  try {
    const raw = fs.readFileSync(BUDGETS_PATH, 'utf-8');
    const cfg = JSON.parse(raw);
    const t = cfg?._ci?.regressionTolerancePct;
    if (typeof t === 'number' && t > 0) return t / 100;
  } catch {
    /* fall through to default */
  }
  return DEFAULT_TOLERANCE;
}

function loadBaseline() {
  try {
    const raw = fs.readFileSync(BASELINE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { values: {} };
  }
}

// ─── Main ───

function main() {
  const tolerance = loadTolerance();
  const baseline = loadBaseline();
  const measured = {};

  console.log('Measuring performance benchmarks...');
  for (const [name, fn] of Object.entries(BENCHMARKS)) {
    measured[name] = fn();
    console.log(`  ${name}: ${measured[name].toFixed(2)}ms`);
  }

  if (UPDATE) {
    const next = {
      _comment: 'Historical performance baseline. Regenerate with: npm run perf:update-baseline',
      lastUpdated: new Date().toISOString(),
      tolerancePct: +(tolerance * 100).toFixed(1),
      values: measured,
    };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n', 'utf-8');
    console.log(`\nBaseline written to ${path.relative(ROOT, BASELINE_PATH)}`);
    return;
  }

  const baseValues = baseline.values || {};
  const hasBaseline = Object.keys(baseValues).length > 0;
  if (!hasBaseline) {
    console.error(
      '\nNo baseline found. Run `npm run perf:update-baseline` first to establish one.'
    );
    process.exit(1);
  }

  console.log(`\nComparing against baseline (tolerance: ${(tolerance * 100).toFixed(0)}%)...`);
  let regressions = 0;
  for (const [name, value] of Object.entries(measured)) {
    const base = baseValues[name];
    if (typeof base !== 'number') {
      console.log(`  ${name}: no baseline entry (skipped)`);
      continue;
    }
    const limit = base * (1 + tolerance);
    const ratio = value / base;
    const status = value <= limit ? 'OK ' : 'FAIL';
    if (value > limit) regressions++;
    console.log(
      `  [${status}] ${name}: ${value.toFixed(2)}ms vs baseline ${base.toFixed(2)}ms ` +
        `(x${ratio.toFixed(2)}, limit ${limit.toFixed(2)}ms)`
    );
  }

  if (regressions > 0) {
    console.error(`\n${regressions} performance regression(s) detected.`);
    process.exit(1);
  }
  console.log('\nNo performance regressions detected.');
}

main();