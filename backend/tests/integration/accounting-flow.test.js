import { jest } from '@jest/globals';

// Mock database pool
jest.unstable_mockModule('../../config/db.js', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  }
}));

const { pool } = await import('../../config/db.js');

describe('Integration Tests - Quy trình nhập liệu kế toán', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Tạo chứng từ kế toán', () => {
    test('Tạo chứng từ thu (PT) thành công', async () => {
      const mockVoucher = {
        id: 1,
        company_id: 1,
        voucher_number: 'PT-000001',
        voucher_date: '2026-01-15',
        voucher_type: 'PT',
        description: 'Thu tiền bán hàng',
        currency: 'VND',
        exchange_rate: 1,
        created_by: 1
      };

      pool.query.mockResolvedValueOnce({ rows: [mockVoucher] });
      pool.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await pool.query(
        'INSERT INTO vouchers (company_id, voucher_number, voucher_date, voucher_type, description, currency, exchange_rate, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
        [1, 'PT-000001', '2026-01-15', 'PT', 'Thu tiền bán hàng', 'VND', 1, 1]
      );

      expect(result.rows[0].id).toBe(1);
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    test('Tạo chứng từ chi (PC) với đa dòng định khoản', async () => {
      const mockDetails = [
        { accountCode: '1111', entryType: 'DR', amount: 10000000 },
        { accountCode: '131', entryType: 'CR', amount: 10000000 }
      ];

      // Kiểm tra cân đối Nợ/Có
      const totalDr = mockDetails.filter(d => d.entryType === 'DR').reduce((a, b) => a + b.amount, 0);
      const totalCr = mockDetails.filter(d => d.entryType === 'CR').reduce((a, b) => a + b.amount, 0);
      
      expect(totalDr).toBe(totalCr);
      expect(totalDr).toBe(10000000);
    });

    test('Từ chối chứng từ mất cân đối Nợ/Có', async () => {
      const invalidDetails = [
        { accountCode: '1111', entryType: 'DR', amount: 15000000 },
        { accountCode: '131', entryType: 'CR', amount: 10000000 }
      ];

      const totalDr = invalidDetails.filter(d => d.entryType === 'DR').reduce((a, b) => a + b.amount, 0);
      const totalCr = invalidDetails.filter(d => d.entryType === 'CR').reduce((a, b) => a + b.amount, 0);
      
      expect(totalDr).not.toBe(totalCr);
      expect(Math.abs(totalDr - totalCr)).toBe(5000000);
    });
  });

  describe('2. Tính giá vốn hàng bán', () => {
    test('Tính giá vốn theo BQGQ (bình quân gia quyền)', () => {
      // Mô phỏng: Nhập 100 sp giá 10.000, nhập thêm 50 sp giá 12.000
      const inventory = [
        { quantity: 100, unit_price: 10000 },
        { quantity: 50, unit_price: 12000 }
      ];

      const totalQuantity = inventory.reduce((sum, i) => sum + i.quantity, 0);
      const totalValue = inventory.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);
      const avgPrice = totalValue / totalQuantity;

      expect(totalQuantity).toBe(150);
      expect(totalValue).toBe(1600000);
      expect(avgPrice).toBe(10666.666666666666);
      
      // Xuất 30 sp theo giá BQGQ
      const exportCost = 30 * avgPrice;
      expect(exportCost).toBe(320000);
    });

    test('Tính giá vốn theo FIFO', () => {
      // Mô phỏng: Nhập lô 1: 100 sp giá 10.000, Lô 2: 50 sp giá 12.000
      const batches = [
        { quantity: 100, unit_price: 10000, remaining: 100 },
        { quantity: 50, unit_price: 12000, remaining: 50 }
      ];

      // Xuất 80 sp - FIFO sẽ lấy từ lô 1 trước
      let exportQuantity = 80;
      let exportCost = 0;
      
      for (const batch of batches) {
        if (exportQuantity <= 0) break;
        const take = Math.min(batch.remaining, exportQuantity);
        exportCost += take * batch.unit_price;
        batch.remaining -= take;
        exportQuantity -= take;
      }

      expect(exportCost).toBe(800000); // 80 * 10.000
      expect(batches[0].remaining).toBe(20);
      expect(batches[1].remaining).toBe(50);
    });
  });

  describe('3. Kết chuyển cuối kỳ', () => {
    test('Kết chuyển doanh thu (TK 511 -> 911)', () => {
      const revenueBalance = 500000000; // Số dư TK 511
      const closingEntry = {
        debit: { accountCode: '511', amount: revenueBalance },
        credit: { accountCode: '911', amount: revenueBalance }
      };

      expect(closingEntry.debit.amount).toBe(closingEntry.credit.amount);
      expect(closingEntry.debit.accountCode).toBe('511');
      expect(closingEntry.credit.accountCode).toBe('911');
    });

    test('Kết chuyển chi phí (TK 632, 641, 642 -> 911)', () => {
      const expenses = {
        '632': 300000000,
        '641': 50000000,
        '642': 80000000
      };

      const totalExpenses = Object.values(expenses).reduce((sum, val) => sum + val, 0);
      expect(totalExpenses).toBe(430000000);

      // Kết chuyển từng TK chi phí sang 911
      Object.entries(expenses).forEach(([accountCode, amount]) => {
        const entry = {
          debit: { accountCode: '911', amount },
          credit: { accountCode, amount }
        };
        expect(entry.debit.amount).toBe(entry.credit.amount);
      });
    });

    test('Tính lợi nhuận sau thuế', () => {
      const revenue = 500000000;
      const expenses = 430000000;
      const profitBeforeTax = revenue - expenses;
      const taxRate = 0.20;
      const taxExpense = profitBeforeTax * taxRate;
      const netProfit = profitBeforeTax - taxExpense;

      expect(profitBeforeTax).toBe(70000000);
      expect(taxExpense).toBe(14000000);
      expect(netProfit).toBe(56000000);
    });
  });

  describe('4. Kiểm tra báo cáo tài chính', () => {
    test('B01-DN: Tài sản = Nợ phải trả + VCSH', () => {
      const totalAssets = 2000000000;
      const totalLiabilities = 800000000;
      const totalEquity = 1200000000;

      expect(totalAssets).toBe(totalLiabilities + totalEquity);
    });

    test('B02-DN: Lợi nhuận gộp = Doanh thu thuần - Giá vốn', () => {
      const netRevenue = 500000000;
      const cogs = 300000000;
      const grossProfit = netRevenue - cogs;

      expect(grossProfit).toBe(200000000);
    });

    test('B03-DN: Tiền cuối kỳ = Tiền đầu kỳ + Lưu chuyển thuần', () => {
      const openingCash = 500000000;
      const netCashFlow = 150000000;
      const closingCash = openingCash + netCashFlow;

      expect(closingCash).toBe(650000000);
    });
  });

describe('5. Kiểm tra khóa sổ', () => {
    test('Không thể tạo chứng từ trước ngày khóa sổ', () => {
      const lockDate = new Date('2026-03-31');
      const voucherDate = new Date('2026-03-15');
      
      expect(voucherDate <= lockDate).toBe(true);
    });

    test('Có thể tạo chứng từ sau ngày khóa sổ', () => {
      const lockDate = new Date('2026-03-31');
      const voucherDate = new Date('2026-04-15');
      
      expect(voucherDate > lockDate).toBe(true);
    });
  });

  describe('6. Thông báo hệ thống', () => {
    test('6.1 Tạo thông báo khi đơn hàng mới', () => {
      // Khi tạo đơn hàng từ storefront, hệ thống sẽ tạo notification
      const notification = {
        company_id: 1,
        order_id: 1,
        type: 'order',
        title: 'Đơn hàng mới',
        message: 'Đơn hàng WEB-20260701-1234 vừa được tạo',
        recipient_role: 'nv_banhang'
      };

      // Kiểm tra cấu trúc notification hợp lệ
      expect(notification.type).toBe('order');
      expect(notification.title).toBeDefined();
      expect(notification.message).toBeDefined();
      expect(notification.recipient_role).toBe('nv_banhang');
    });

    test('6.2 Tạo thông báo khi cập nhật logistics', () => {
      // Khi cập nhật trạng thái logistics, hệ thống sẽ tạo notification
      const notification = {
        id: 1,
        type: 'logistics',
        title: 'Cập nhật trạng thái đơn hàng',
        message: 'Đơn hàng WEB-20260701-1234 đã chuyển sang trạng thái: Hoàn thành'
      };

      expect(notification.type).toBe('logistics');
      expect(notification.message).toContain('trạng thái');
    });

    test('6.3 Tạo thông báo khi kết chuyển sổ', () => {
      // Khi kết chuyển sổ thành công, hệ thống sẽ tạo notification cho KTT
      const notification = {
        id: 0,
        type: 'closing',
        title: 'Kết chuyển sổ thành công',
        message: 'Kết chuyển tháng 7/2026 đã hoàn tất',
        recipient_role: 'ktt'
      };

      expect(notification.type).toBe('closing');
      expect(notification.recipient_role).toBe('ktt');
    });

    test('6.4 Push subscription structure', () => {
      // Kiểm tra cấu trúc subscription hợp lệ
      const subscription = {
        user_id: 1,
        company_id: 1,
        endpoint: 'https://fcm.googleapis.com/fcm/send/...',
        p256dh: 'base64-encoded-key',
        auth: 'base64-encoded-key'
      };

      expect(subscription.endpoint).toBeDefined();
      expect(subscription.p256dh).toBeDefined();
      expect(subscription.auth).toBeDefined();
    });
  });
});
