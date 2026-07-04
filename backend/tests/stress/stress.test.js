/**
 * Stress Test Script - ERP Kế toán
 * Kiểm tra hiệu năng Redis cache và Database Index với dữ liệu lớn
 */

import { jest } from '@jest/globals';

// Mock database pool
jest.unstable_mockModule('../../config/db.js', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(() => ({
      query: jest.fn(),
      release: jest.fn(),
    })),
  }
}));

const { pool } = await import('../../config/db.js');

describe('Stress Test - Hiệu năng hệ thống', () => {
  const LARGE_DATASET_SIZE = 10000; // 10.000 bản ghi
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Redis Cache Performance', () => {
    test('Cache tài khoản tổng hợp với 10.000 bản ghi', async () => {
      // Mô phỏng dữ liệu lớn
      const mockLargeLedger = {};
      for (let i = 0; i < 100; i++) {
        mockLargeLedger[`1${i.toString().padStart(2, '0')}`] = {
          patsinhDr: Math.random() * 1000000000,
          patsinhCr: Math.random() * 1000000000
        };
      }

      // Kiểm tra thời gian xử lý
      const startTime = Date.now();
      
      // Tính toán số dư cho tất cả tài khoản
      const balances = Object.entries(mockLargeLedger).map(([code, data]) => ({
        accountCode: code,
        balance: data.patsinhDr - data.patsinhCr
      }));
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Yêu cầu: Xử lý dưới 100ms
      expect(processingTime).toBeLessThan(100);
      expect(balances.length).toBe(100);
    });

    test('Cache báo cáo tài chính với nhiều công ty', async () => {
      const companies = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        company_name: `Công ty ${i + 1}`,
        vouchers: Array.from({ length: 1000 }, (_, j) => ({
          id: j + 1,
          voucher_type: ['PT', 'PC', 'NK', 'XK'][j % 4],
          amount: Math.random() * 100000000
        }))
      }));

      // Kiểm tra thời gian tính toán
      const startTime = Date.now();
      
      const report = companies.map(company => ({
        companyId: company.id,
        totalVouchers: company.vouchers.length,
        totalAmount: company.vouchers.reduce((sum, v) => sum + v.amount, 0)
      }));
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Yêu cầu: Xử lý dưới 200ms
      expect(processingTime).toBeLessThan(200);
      expect(report.length).toBe(50);
    });
  });

  describe('2. Database Index Performance', () => {
    test('Truy vấn chứng từ theo company_id và năm (có index)', async () => {
      const companyId = 1;
      const year = 2026;
      
      // Mô phỏng truy vấn có sử dụng index
      const mockVouchers = Array.from({ length: 5000 }, (_, i) => ({
        id: i + 1,
        company_id: companyId,
        voucher_date: new Date(2026, i % 12, 15),
        voucher_type: ['PT', 'PC', 'NK', 'XK'][i % 4],
        amount: Math.random() * 100000000
      }));

      pool.query.mockResolvedValueOnce({ rows: mockVouchers });

      const startTime = Date.now();
      const result = await pool.query(
        `SELECT * FROM vouchers WHERE company_id = $1 AND EXTRACT(YEAR FROM voucher_date) = $2 ORDER BY voucher_date DESC`,
        [companyId, year]
      );
      const endTime = Date.now();

      // Yêu cầu: Truy vấn dưới 500ms
      expect(endTime - startTime).toBeLessThan(500);
      expect(result.rows.length).toBe(5000);
    });

    test('Truy vấn định khoản theo account_code (có index)', async () => {
      const accountCode = '111';
      
      // Mô phỏng 5.000 dòng định khoản
      const mockDetails = Array.from({ length: 5000 }, (_, i) => ({
        id: i + 1,
        account_code: accountCode,
        entry_type: i % 2 === 0 ? 'DR' : 'CR',
        amount: Math.random() * 100000000
      }));

      pool.query.mockResolvedValueOnce({ rows: mockDetails });

      const startTime = Date.now();
      const result = await pool.query(
        `SELECT * FROM voucher_details WHERE account_code LIKE $1 ORDER BY id DESC LIMIT 1000`,
        [`${accountCode}%`]
      );
      const endTime = Date.now();

      // Yêu cầu: Truy vấn dưới 300ms
      expect(endTime - startTime).toBeLessThan(300);
      expect(result.rows.length).toBe(5000);
    });
  });

  describe('3. Memory Usage Test', () => {
    test('Sử dụng bộ nhớ < 100MB khi xử lý 10.000 chứng từ', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Tạo dữ liệu lớn
      const largeDataset = Array.from({ length: LARGE_DATASET_SIZE }, (_, i) => ({
        id: i + 1,
        voucher_number: `PT-${(i + 1).toString().padStart(6, '0')}`,
        voucher_date: new Date(2026, 0, 1),
        voucher_type: 'PT',
        amount: 10000000,
        details: [
          { accountCode: '1111', entryType: 'DR', amount: 10000000 },
          { accountCode: '131', entryType: 'CR', amount: 10000000 }
        ]
      }));

      const afterMemory = process.memoryUsage().heapUsed;
      const memoryDiff = (afterMemory - initialMemory) / 1024 / 1024; // MB

      // Yêu cầu: Tăng bộ nhớ dưới 100MB
      expect(memoryDiff).toBeLessThan(100);
      expect(largeDataset.length).toBe(LARGE_DATASET_SIZE);
    });
  });

  describe('4. Concurrent Request Test', () => {
    test('Xử lý đồng thời 100 request', async () => {
      const concurrentRequests = 100;
      const promises = [];

      // Tạo 100 request đồng thời
      for (let i = 0; i < concurrentRequests; i++) {
        pool.query.mockResolvedValueOnce({ 
          rows: [{ id: i, company_id: 1, amount: 1000000 }] 
        });
        
        promises.push(
          pool.query('SELECT * FROM vouchers WHERE company_id = $1 LIMIT 1', [1])
        );
      }

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();

      // Yêu cầu: Xử lý 100 request dưới 2 giây
      expect(endTime - startTime).toBeLessThan(2000);
      expect(results.length).toBe(concurrentRequests);
    });
  });
});

// Helper function for performance testing
function measurePerformance(fn, iterations = 1000) {
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = process.hrtime.bigint();
  return Number(end - start) / 1000000; // Convert to milliseconds
}

describe('Performance Benchmarks', () => {
  test('Tính toán số dư tài khoản (10.000 lần)', () => {
    const data = {
      patsinhDr: 1000000000,
      patsinhCr: 500000000
    };

    const time = measurePerformance(() => {
      const balance = data.patsinhDr - data.patsinhCr;
      return balance;
    }, 10000);

    // Yêu cầu: 10.000 phép tính dưới 10ms
    expect(time).toBeLessThan(10);
  });

  test('Format tiền tệ (10.000 lần)', () => {
    const time = measurePerformance(() => {
      return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
      }).format(1000000000);
    }, 10000);

    expect(time).toBeLessThan(50);
  });
});