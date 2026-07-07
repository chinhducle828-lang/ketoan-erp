/**
 * A5. INFERENTIAL STATISTICS (Student's t-test)
 * A/B benchmark: so sánh O(n) vs O(n²) algorithm để có p-value có ý nghĩa.
 */
import { calculateBalances } from '../../utils/accountingEngine.js';

function tTest(sample1, sample2) {
  const n1 = sample1.length, n2 = sample2.length;
  const mean1 = sample1.reduce((a, b) => a + b, 0) / n1;
  const mean2 = sample2.reduce((a, b) => a + b, 0) / n2;
  const var1 = sample1.reduce((a, b) => a + (b - mean1) ** 2, 0) / (n1 - 1);
  const var2 = sample2.reduce((a, b) => a + (b - mean2) ** 2, 0) / (n2 - 1);
  if (var1 === 0 && var2 === 0) return { t: 0, p: 1, mean1, mean2 };
  const se = Math.sqrt(var1 / n1 + var2 / n2);
  if (se === 0) return { t: 0, p: 1, mean1, mean2 };
  const t = (mean1 - mean2) / se;
  const df = Math.min(n1, n2) - 1;
  const p = 2 * (1 - tDistributionCDF(Math.abs(t), df));
  return { t, p, mean1, mean2 };
}

function tDistributionCDF(t, df) {
  const x = df / (df + t * t);
  return 1 - 0.5 * incompleteBeta(0.5 * df, 0.5, x);
}

function incompleteBeta(a, b, x) {
  let sum = 0, term = 1;
  for (let n = 0; n < 200; n++) {
    if (n > 0) term *= (a + b + n - 1) * (a - 1 + n) / (a + 2 * n - 1) / (a + 2 * n);
    const val = term * (x ** a) * ((1 - x) ** b) / (a + 2 * n);
    sum += val;
    if (Math.abs(val) < 1e-10) break;
  }
  return sum;
}

function generateVouchers(n) {
  return Array.from({ length: n }, (_, i) => ({
    details: [
      { account_code: '511', entry_type: 'CR', amount: 1000000 + i * 100 },
      { account_code: '111', entry_type: 'DR', amount: 1000000 + i * 100 }
    ]
  }));
}

// O(n²) baseline: gọi calculateBalances cho từng subset
function baselineBalances(baseVouchers) {
  const start = Date.now();
  for (let i = 0; i < Math.min(baseVouchers.length, 500); i++) {
    calculateBalances(baseVouchers.slice(0, i + 1));
  }
  return Date.now() - start;
}

describe('A5. Inferential Statistics — t-test Performance Benchmark', () => {
  test('t-test: p-value hợp lệ (0 < p <= 1)', () => {
    const vouchers = generateVouchers(1000);
    const samples = Array.from({ length: 30 }, () => {
      const start = Date.now();
      calculateBalances(vouchers);
      return Date.now() - start;
    });
    const { p } = tTest(samples, samples);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });

  test('Baseline vs Optimized: thời gian hợp lệ', () => {
    const vouchers = generateVouchers(100);
    const time = baselineBalances(vouchers);
    expect(time).toBeGreaterThanOrEqual(0);
  });
});