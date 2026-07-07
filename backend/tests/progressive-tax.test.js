/**
 * Progressive Tax Calculation — Statistical & Property Tests
 * Chuyển đổi từ script console.log sang Jest test suite.
 * Sử dụng các hàm thuần từ accountingEngine.js (không cần DB).
 */
import { calculateProgressiveTax, getTaxRateByRevenue, calculateProfitBeforeTax } from '../utils/accountingEngine.js';
import fc from 'fast-check';

describe('Progressive Tax — Statistical Tests', () => {
  // Test case 1: Doanh thu <= 3 tỷ
  test('Doanh thu 2 tỷ, lợi nhuận 300 triệu -> 15%', () => {
    const result = calculateProgressiveTax(2000000000, 300000000);
    expect(result.totalTax).toBe(45000000); // 300tr * 15%
    expect(result.appliedRate).toBe(0.15);
    expect(result.breakdown.length).toBeGreaterThan(0);
  });

  // Test case 2: Doanh thu 10 tỷ (3-50 tỷ bracket)
  test('Doanh thu 10 tỷ, lợi nhuận 2 tỷ -> progressive rate', () => {
    const result = calculateProgressiveTax(10000000000, 2000000000);
    expect(result.totalTax).toBeGreaterThan(0);
    expect(result.appliedRate).toBeGreaterThan(0.15);
    expect(result.appliedRate).toBeLessThanOrEqual(0.20);
    expect(result.breakdown.length).toBeGreaterThanOrEqual(2);
  });

  // Test case 3: Doanh thu 60 tỷ (vượt 50 tỷ)
  test('Doanh thu 60 tỷ, lợi nhuận 10 tỷ -> highest bracket', () => {
    const result = calculateProgressiveTax(60000000000, 10000000000);
    expect(result.totalTax).toBeGreaterThan(0);
    expect(result.appliedRate).toBeGreaterThan(0.17);
    expect(result.breakdown.length).toBeGreaterThanOrEqual(3);
  });

  // Test case 4: Lỗ
  test('Lợi nhuận <= 0 -> tax = 0', () => {
    const result = calculateProgressiveTax(5000000000, -100000000);
    expect(result.totalTax).toBe(0);
    expect(result.appliedRate).toBe(0);
    expect(result.breakdown).toEqual([]);
  });

  // Test case 5: getTaxRateByRevenue
  test('getTaxRateByRevenue trả về đúng bracket', () => {
    expect(getTaxRateByRevenue(2000000000)).toBe(0.15);
    expect(getTaxRateByRevenue(10000000000)).toBe(0.17);
    expect(getTaxRateByRevenue(60000000000)).toBe(0.20);
  });

  // Property: Thuế lũy tiến luôn >= 0
  test('Property: Thuế lũy tiến luôn >= 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1e12 }),
        fc.integer({ min: -1e9, max: 1e11 }),
        (revenue, profit) => {
          const result = calculateProgressiveTax(revenue, profit);
          expect(result.totalTax).toBeGreaterThanOrEqual(0);
          expect(result.appliedRate).toBeGreaterThanOrEqual(0);
        }
      )
    );
  });

  // Property: Thuế suất trung bình không vượt quá bracket cao nhất
  test('Property: appliedRate <= 0.20', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1e12 }),
        fc.integer({ min: 0, max: 1e11 }),
        (revenue, profit) => {
          const result = calculateProgressiveTax(revenue, profit);
          expect(result.appliedRate).toBeLessThanOrEqual(0.20);
        }
      )
    );
  });

  // Property: Hộ kinh doanh (household) không tính thuế
  test('Property: Household entity type -> tax = 0', () => {
    const result = calculateProgressiveTax(10000000000, 1000000000, 'household');
    expect(result.totalTax).toBe(0);
    expect(result.appliedRate).toBe(0);
  });

  // Property: Hợp tác xã (cooperative) ưu đãi 10%
  test('Property: Cooperative entity type -> 10%', () => {
    const result = calculateProgressiveTax(10000000000, 1000000000, 'cooperative');
    expect(result.totalTax).toBe(100000000); // 1 tỷ * 10%
    expect(result.appliedRate).toBe(0.1);
  });

  // Statistical: Phân phối thuế suất với 1000 mẫu ngẫu nhiên
  test('Statistical: 1000 mẫu ngẫu nhiên, thuế suất trung bình trong [0.15, 0.20]', () => {
    const rates = Array.from({ length: 1000 }, () => {
      const revenue = Math.floor(Math.random() * 1e11);
      const profit = Math.floor(Math.random() * 1e10);
      return calculateProgressiveTax(revenue, profit, 'company').appliedRate;
    }).filter((r) => r > 0);
    const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
    expect(avgRate).toBeGreaterThanOrEqual(0.15);
    expect(avgRate).toBeLessThanOrEqual(0.20);
  });
});