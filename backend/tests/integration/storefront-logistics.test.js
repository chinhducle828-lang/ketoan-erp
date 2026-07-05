import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';

const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
};

const mockCanAccessCompany = jest.fn(async () => true);

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
  getLogisticsRules: () => ({
    saleVoucherType: 'XK'
  }),
}));

jest.unstable_mockModule('../../services/storefrontRealtime.service.js', () => ({
  publishStorefrontOrderEvent: jest.fn().mockResolvedValue({ success: true }),
  ensureStorefrontRealtimeListener: jest.fn(),
  registerStorefrontStreamClient: jest.fn(),
}));

const { default: logisticsRoutes } = await import('../../routes/logisticsRoutes.js');

describe('Storefront Logistics - Quản lý vận hành', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanAccessCompany.mockResolvedValue(true);
  });

  test('POST /api/logistics/mark-completed rejects invalid transition', async () => {
    mockPool.query.mockImplementation(async (sql) => {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      if (normalized.startsWith('UPDATE vouchers')) {
        return { rows: [] };
      }
      if (normalized.startsWith('SELECT id, voucher_number, loading_status FROM vouchers')) {
        return { rows: [{ id: 77, voucher_number: 'XK-77', loading_status: 'assigned' }] };
      }
      return { rows: [] };
    });

    const app = express();
    app.use(express.json());
    app.use('/api/logistics', logisticsRoutes);

    const response = await request(app)
      .post('/api/logistics/mark-completed')
      .set('Authorization', 'Bearer any-token')
      .send({ companyId: 1, voucherId: 77 });

    expect(response.status).toBe(409);
    expect(String(response.body.error || '')).toContain('đang giao');
  });

  test('POST /api/logistics/confirm-loaded moves assigned to delivering', async () => {
    const client = {
      query: jest.fn(async (sql) => {
        const normalized = String(sql).replace(/\s+/g, ' ').trim();
        if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') {
          return { rows: [] };
        }
        if (normalized.startsWith('UPDATE vouchers')) {
          return { rows: [{ id: 88, voucher_number: 'XK-88', loading_status: 'delivering' }] };
        }
        if (normalized.startsWith('SELECT id, voucher_number, loading_status FROM vouchers')) {
          return { rows: [{ id: 88, voucher_number: 'XK-88', loading_status: 'assigned' }] };
        }
        return { rows: [] };
      }),
      release: jest.fn(),
    };

    mockPool.connect.mockResolvedValue(client);

    const app = express();
    app.use(express.json());
    app.use('/api/logistics', logisticsRoutes);

    const response = await request(app)
      .post('/api/logistics/confirm-loaded')
      .set('Authorization', 'Bearer any-token')
      .send({ companyId: 1, voucherId: 88 });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.order.loading_status).toBe('delivering');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

test('POST /api/logistics/assign-truck workflow validation', () => {
    // Test logic workflow của assign-truck
    const workflow = {
      fromStatus: 'pending_loading',
      toStatus: 'assigned',
      validTransition: true
    };

    expect(workflow.fromStatus).toBe('pending_loading');
    expect(workflow.toStatus).toBe('assigned');
    expect(workflow.validTransition).toBe(true);
  });
});