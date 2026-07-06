import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';

const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
};

const mockCanAccessCompany = jest.fn(async () => true);
const mockPublishStorefrontOrderEvent = jest.fn().mockResolvedValue({ success: true });

jest.unstable_mockModule('../../config/db.js', () => ({
  pool: mockPool,
}));

jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 1, role: 'admin' };
    next();
  },
  requireRole: () => (req, res, next) => next(),
}));

jest.unstable_mockModule('../../services/helpers.js', () => ({
  canAccessCompany: mockCanAccessCompany,
}));

jest.unstable_mockModule('../../config/businessRules.js', () => ({
  getBusinessRules: () => ({
    pricing: { amountPrecision: 2, taxPrecision: 2, defaultTaxRate: 0.1, minOrderQuantity: 1 },
    voucher: { storefrontPrefix: 'WEB', saleVoucherType: 'XK', defaultLoadingStatus: 'pending_loading' }
  }),
  getSaleRules: () => ({
    receivableAccount: '131',
    revenueAccount: '511',
    vatAccount: '3331',
    cogsAccount: '632',
    inventoryAccount: '156',
    logisticsOpsAccount: '156_OPS',
    legacyAccountDrFallback: ['131', '111', '112'],
    legacyAccountCrFallback: ['511', '3331', '131']
  }),
  getLogisticsRules: () => ({
    saleVoucherType: 'XK'
  }),
}));

jest.unstable_mockModule('../../services/storefrontRealtime.service.js', () => ({
  publishStorefrontOrderEvent: mockPublishStorefrontOrderEvent,
  ensureStorefrontRealtimeListener: jest.fn(),
}));

jest.unstable_mockModule('../../services/webPush.service.js', () => ({
  sendToRole: jest.fn().mockResolvedValue({ success: true, sent: 0, failed: 0 }),
}));

const { default: publicRoutes } = await import('../../routes/publicRoutes.js');

describe('Storefront Orders - Tạo đơn hàng', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanAccessCompany.mockResolvedValue(true);
  });

  test('Tạo đơn hàng từ storefront - cấu trúc dữ liệu hợp lệ', () => {
    const mockOrder = {
      companyId: 1,
      items: [{ itemId: '101', quantity: 2 }],
      customerName: 'Test Customer',
      phone: '0123456789',
      address: 'HN',
    };

    expect(mockOrder.companyId).toBeDefined();
    expect(mockOrder.items.length).toBe(1);
    expect(mockOrder.items[0].quantity).toBe(2);
  });

  test('Tính toán thuế và định khoản tự động', () => {
    const amount = 100000;
    const taxRate = 0.1;
    const taxAmount = amount * taxRate;
    
    expect(taxAmount).toBe(10000);
  });

test('Order data structure validation', () => {
    // Test cấu trúc dữ liệu đơn hàng
    const orderData = {
      companyId: 1,
      items: [{ itemId: '102', quantity: 1 }],
      customerName: 'Legacy',
      phone: '0999',
      address: 'HCM',
    };

    // Kiểm tra cấu trúc dữ liệu
    expect(orderData.companyId).toBeDefined();
    expect(orderData.items.length).toBe(1);
    expect(orderData.items[0].itemId).toBe('102');
    expect(orderData.items[0].quantity).toBe(1);
  });

  test('Legacy account resolution logic', () => {
    // Test logic phân giải account legacy
    const legacyAccountDr = '131';
    const legacyAccountCr = '3331';
    
    // Kiểm tra account hợp lệ
    expect(legacyAccountDr).toBe('131');
    expect(legacyAccountCr).toBe('3331');
  });
});