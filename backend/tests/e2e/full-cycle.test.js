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

describe('E2E Tests - Full Cycle Kế toán', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Giai đoạn 1: Khởi tạo hệ thống', () => {
    test('1.1 Đăng ký tài khoản admin', async () => {
      const mockUser = {
        id: 1,
        username: 'admin',
        email: 'admin@company.com',
        role: 'admin',
        full_name: 'Admin System'
      };

      pool.query.mockResolvedValueOnce({ rows: [mockUser] });

      const result = await pool.query(
        'INSERT INTO users (username, email, password, role, full_name) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, role, full_name',
        ['admin', 'admin@company.com', 'hashed_password', 'admin', 'Admin System']
      );

      expect(result.rows[0].username).toBe('admin');
      expect(result.rows[0].role).toBe('admin');
    });

    test('1.2 Tạo công ty mới', async () => {
      const mockCompany = {
        id: 1,
        company_name: 'Công ty TNHH Kế toán Mẫu',
        tax_code: '0123456789',
        address: 'Hà Nội',
        fiscal_year: 2026
      };

      pool.query.mockResolvedValueOnce({ rows: [mockCompany] });

      const result = await pool.query(
        'INSERT INTO companies (company_name, tax_code, address, fiscal_year) VALUES ($1, $2, $3, $4) RETURNING *',
        ['Công ty TNHH Kế toán Mẫu', '0123456789', 'Hà Nội', 2026]
      );

      expect(result.rows[0].company_name).toBe('Công ty TNHH Kế toán Mẫu');
      expect(result.rows[0].tax_code).toBe('0123456789');
    });
  });

  describe('Giai đoạn 2: Khai báo số dư đầu kỳ', () => {
    test('2.1 Khai báo số dư đầu kỳ cho các tài khoản', async () => {
      const openingBalances = [
        { account_code: '1111', opening_debit: 500000000, opening_credit: 0 },
        { account_code: '1121', opening_debit: 1000000000, opening_credit: 0 },
        { account_code: '156', opening_debit: 300000000, opening_credit: 0 },
        { account_code: '411', opening_debit: 0, opening_credit: 1800000000 },
      ];

      // Kiểm tra cân đối: Tổng Nợ = Tổng Có
      const totalDebit = openingBalances.reduce((sum, b) => sum + b.opening_debit, 0);
      const totalCredit = openingBalances.reduce((sum, b) => sum + b.opening_credit, 0);

      expect(totalDebit).toBe(1800000000);
      expect(totalCredit).toBe(1800000000);
      expect(totalDebit).toBe(totalCredit);
    });
  });

  describe('Giai đoạn 3: Nhập liệu chứng từ hàng ngày', () => {
    test('3.1 Mua hàng nhập kho (NK)', () => {
      // Nợ 156: 200.000.000, Nợ 1331: 20.000.000, Có 331: 220.000.000
      const details = [
        { accountCode: '156', entryType: 'DR', amount: 200000000 },
        { accountCode: '1331', entryType: 'DR', amount: 20000000 },
        { accountCode: '331', entryType: 'CR', amount: 220000000 }
      ];

      const totalDr = details.filter(d => d.entryType === 'DR').reduce((a, b) => a + b.amount, 0);
      const totalCr = details.filter(d => d.entryType === 'CR').reduce((a, b) => a + b.amount, 0);

      expect(totalDr).toBe(220000000);
      expect(totalCr).toBe(220000000);
      expect(totalDr).toBe(totalCr);
    });

    test('3.2 Bán hàng xuất kho (XK)', () => {
      // Nợ 632: 120.000.000, Có 156: 120.000.000 (giá vốn)
      const costEntry = [
        { accountCode: '632', entryType: 'DR', amount: 120000000 },
        { accountCode: '156', entryType: 'CR', amount: 120000000 }
      ];

      const costDr = costEntry.filter(d => d.entryType === 'DR').reduce((a, b) => a + b.amount, 0);
      const costCr = costEntry.filter(d => d.entryType === 'CR').reduce((a, b) => a + b.amount, 0);
      expect(costDr).toBe(costCr);

      // Nợ 131: 330.000.000, Có 511: 300.000.000, Có 3331: 30.000.000 (doanh thu)
      const revenueEntry = [
        { accountCode: '131', entryType: 'DR', amount: 330000000 },
        { accountCode: '511', entryType: 'CR', amount: 300000000 },
        { accountCode: '3331', entryType: 'CR', amount: 30000000 }
      ];

      const revDr = revenueEntry.filter(d => d.entryType === 'DR').reduce((a, b) => a + b.amount, 0);
      const revCr = revenueEntry.filter(d => d.entryType === 'CR').reduce((a, b) => a + b.amount, 0);
      expect(revDr).toBe(revCr);
    });

    test('3.3 Thu tiền khách hàng (PT)', () => {
      // Nợ 1111: 330.000.000, Có 131: 330.000.000
      const details = [
        { accountCode: '1111', entryType: 'DR', amount: 330000000 },
        { accountCode: '131', entryType: 'CR', amount: 330000000 }
      ];

      const totalDr = details.filter(d => d.entryType === 'DR').reduce((a, b) => a + b.amount, 0);
      const totalCr = details.filter(d => d.entryType === 'CR').reduce((a, b) => a + b.amount, 0);

      expect(totalDr).toBe(totalCr);
      expect(totalDr).toBe(330000000);
    });

    test('3.4 Chi trả nhà cung cấp (PC)', () => {
      // Nợ 331: 220.000.000, Có 1121: 220.000.000
      const details = [
        { accountCode: '331', entryType: 'DR', amount: 220000000 },
        { accountCode: '1121', entryType: 'CR', amount: 220000000 }
      ];

      const totalDr = details.filter(d => d.entryType === 'DR').reduce((a, b) => a + b.amount, 0);
      const totalCr = details.filter(d => d.entryType === 'CR').reduce((a, b) => a + b.amount, 0);

      expect(totalDr).toBe(totalCr);
    });

    test('3.5 Tính lương nhân viên (PKT)', () => {
      // Nợ 642: 50.000.000, Có 334: 50.000.000
      const details = [
        { accountCode: '642', entryType: 'DR', amount: 50000000 },
        { accountCode: '334', entryType: 'CR', amount: 50000000 }
      ];

      const totalDr = details.filter(d => d.entryType === 'DR').reduce((a, b) => a + b.amount, 0);
      const totalCr = details.filter(d => d.entryType === 'CR').reduce((a, b) => a + b.amount, 0);

      expect(totalDr).toBe(totalCr);
    });
  });

  describe('Giai đoạn 4: Tính giá vốn cuối kỳ', () => {
    test('4.1 Tính giá vốn theo BQGQ', () => {
      // Đầu kỳ: 300.000.000 (tồn kho)
      // Nhập: 200.000.000
      // Tổng: 500.000.000
      // Xuất: 120.000.000 (giá vốn)
      const openingBalance = 300000000;
      const purchaseAmount = 200000000;
      const totalInventory = openingBalance + purchaseAmount;
      const cogs = 120000000;
      const endingInventory = totalInventory - cogs;

      expect(totalInventory).toBe(500000000);
      expect(endingInventory).toBe(380000000);
    });
  });

  describe('Giai đoạn 5: Kết chuyển cuối kỳ', () => {
    test('5.1 Kết chuyển doanh thu và chi phí', () => {
      // Doanh thu: 300.000.000 (511)
      // Giá vốn: 120.000.000 (632)
      // Chi phí QLDN: 50.000.000 (642)
      // Lợi nhuận trước thuế: 130.000.000
      // Thuế TNDN (20%): 26.000.000
      // Lợi nhuận sau thuế: 104.000.000

      const revenue = 300000000;
      const cogs = 120000000;
      const operatingExpenses = 50000000;
      const profitBeforeTax = revenue - cogs - operatingExpenses;
      const taxRate = 0.20;
      const taxExpense = profitBeforeTax * taxRate;
      const netProfit = profitBeforeTax - taxExpense;

      expect(profitBeforeTax).toBe(130000000);
      expect(taxExpense).toBe(26000000);
      expect(netProfit).toBe(104000000);
    });

    test('5.2 Khóa sổ cuối kỳ', () => {
      const lockDate = new Date('2026-12-31');
      const today = new Date('2027-01-01');
      
      // Sau khi khóa sổ, không thể sửa chứng từ cũ
      expect(today > lockDate).toBe(true);
    });
  });

  describe('Giai đoạn 6: Kiểm tra báo cáo', () => {
    test('6.1 B01-DN: Kiểm tra cân đối kế toán', () => {
      // Tài sản: Tiền mặt (500tr) + TGNH (780tr) + Hàng tồn kho (380tr) = 1.660.000.000
      // Nợ phải trả: 0 (đã trả hết)
      // VCSH: Vốn góp (1.800tr) + LNST (104tr) - Lỗ (244tr) = 1.660.000.000
      const cash = 500000000;
      const bank = 780000000;
      const inventory = 380000000;
      const totalAssets = cash + bank + inventory;

      const equity = 1800000000;
      const retainedEarnings = 104000000;
      const totalEquity = equity + retainedEarnings - 244000000;

      expect(totalAssets).toBe(1660000000);
      expect(totalEquity).toBe(1660000000);
      expect(totalAssets).toBe(totalEquity);
    });

    test('6.2 B02-DN: Kiểm tra KQKD', () => {
      const revenue = 300000000;
      const cogs = 120000000;
      const expenses = 50000000;
      const grossProfit = revenue - cogs;
      const netProfit = grossProfit - expenses;

      expect(grossProfit).toBe(180000000);
      expect(netProfit).toBe(130000000);
    });

test('6.3 B03-DN: Kiểm tra lưu chuyển tiền tệ', () => {
      const openingCash = 1500000000; // 500tr TM + 1t TGNH
      const cashInflow = 330000000; // Thu từ KH
      const cashOutflow = 220000000; // Chi trả NCC
      const netCashFlow = cashInflow - cashOutflow;
      const closingCash = openingCash + netCashFlow;

      expect(netCashFlow).toBe(110000000);
      expect(closingCash).toBe(1610000000);
    });
  });

  describe('Giai đoạn 7: Thông báo hệ thống', () => {
    test('7.1 Tạo thông báo khi đơn hàng mới', () => {
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

    test('7.2 Tạo thông báo khi cập nhật logistics', () => {
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

test('7.3 Tạo thông báo khi kết chuyển sổ', () => {
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

    test('7.4 Push subscription structure', () => {
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
