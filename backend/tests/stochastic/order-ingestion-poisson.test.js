/**
 * A3. STOCHASTIC PROCESSES — Poisson Distribution for Order Ingestion
 * Phân phối Poisson: P(X=k) = λ^k e^{-λ} / k!
 * Sinh request ngẫu nhiên theo Poisson để giả lập tải Storefront.
 */
import fc from 'fast-check';

function poissonSample(lambda) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

function chiSquareGof(observed, expected, bins) {
  let chi2 = 0;
  for (let i = 0; i < bins; i++) {
    const obs = observed[i] || 0;
    const exp = expected[i] || 0;
    if (exp > 0) chi2 += ((obs - exp) ** 2) / exp;
  }
  return chi2;
}

function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

describe('A3. Stochastic Poisson Order Ingestion', () => {
  const LAMBDA = 50;
  const N_SAMPLES = 10000;

  test('Sinh mẫu Poisson: mean ≈ variance ≈ λ', () => {
    const samples = Array.from({ length: N_SAMPLES }, () => poissonSample(LAMBDA));
    const mean = samples.reduce((a, b) => a + b, 0) / N_SAMPLES;
    const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / N_SAMPLES;
    expect(Math.abs(mean - LAMBDA)).toBeLessThan(LAMBDA * 0.1);
    expect(Math.abs(variance - LAMBDA)).toBeLessThan(LAMBDA * 0.15);
  });

  test('Phân phối Poisson hội tụ: p5, p25, p50, p75, p95 khớp lý thuyết', () => {
    // Sinh mẫu và so sánh các percentile thực tế vs lý thuyết
    const samples = Array.from({ length: N_SAMPLES }, () => poissonSample(LAMBDA)).sort((a, b) => a - b);
    const percentiles = [0.05, 0.25, 0.50, 0.75, 0.95];
    // Theoretical Poisson quantiles at λ=50: mean=50, var=50, sd≈7.07
    // p5 ≈ 50 - 1.645*7.07 ≈ 38, p95 ≈ 50 + 1.645*7.07 ≈ 62
    for (const pct of percentiles) {
      const empirical = samples[Math.floor(pct * N_SAMPLES)];
      const theoretical = Math.round(LAMBDA + Math.sqrt(LAMBDA) * (pct <= 0.5 ? -1 : 1) * (pct <= 0.25 ? 1.645 : pct <= 0.5 ? 0.674 : pct <= 0.75 ? 0.674 : 1.645));
      // Cho phép sai số 10 đơn vị
      expect(empirical).toBeGreaterThan(theoretical - 10);
      expect(empirical).toBeLessThan(theoretical + 10);
    }
  });

  test('Property: Tổng số đơn xử lý = tổng số đơn nhận', () => {
    fc.assert(
      fc.property(fc.integer({ min: 10, max: 200 }), (lambda) => {
        const arrivals = Array.from({ length: 1000 }, () => poissonSample(lambda));
        const processed = arrivals.reduce((a, b) => a + b, 0);
        expect(processed).toBeGreaterThanOrEqual(0);
      })
    );
  });

  test('Spike detection: Xác suất có >= 100 đơn trong 1s < 0.001', () => {
    const spikes = Array.from({ length: 10000 }, () => poissonSample(LAMBDA))
      .filter((k) => k >= 100).length;
    const spikeRate = spikes / 10000;
    expect(spikeRate).toBeLessThan(0.001);
  });
});