/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * End-to-end test: POST /api/events with workflow trigger events
 */

import request from 'supertest';
import { jest } from '@jest/globals';

const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

const mockPool = {
  query: jest.fn(),
  connect: jest.fn().mockResolvedValue(mockClient),
};

jest.unstable_mockModule('../../config/db.js', () => ({
  pool: mockPool,
}));

jest.unstable_mockModule('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => {
    req.user = { id: 1, role: 'admin', activeCompanyId: 1 };
    next();
  },
  authenticateToken: (req, res, next) => {
    req.user = { id: 1, role: 'admin', activeCompanyId: 1 };
    next();
  },
  requireRole: () => (req, res, next) => next(),
  authorizeAdmin: () => (req, res, next) => next(),
  requireRootAdmin: () => (req, res, next) => next(),
  checkCompanyAccess: (req, res, next) => next(),
}));

const { default: app } = await import('../../server.js');

describe('POST /api/events - Workflow Trigger Events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockPool.query.mockImplementation(async (sql, params) => {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      
      if (normalized.includes('CREATE TABLE') || normalized.includes('INSERT INTO vouchers')) {
        return { rows: [{ id: 1, voucher_number: 'TEST-001' }] };
      }
      
      if (normalized.includes('INSERT INTO rea_events')) {
        return { rows: [{ id: 1 }] };
      }
      
      if (normalized.includes('SELECT') && normalized.includes('rea_events')) {
        return { rows: [] };
      }
      
      return { rows: [] };
    });
    
    mockClient.query.mockImplementation(async (sql, params) => {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      
      if (normalized.includes('BEGIN') || normalized.includes('COMMIT') || normalized.includes('ROLLBACK')) {
        return { rows: [] };
      }
      
      if (normalized.includes('INSERT INTO vouchers')) {
        return { rows: [{ id: 1, voucher_number: 'TEST-001' }] };
      }
      
      if (normalized.includes('INSERT INTO rea_events')) {
        return { rows: [{ id: 1 }] };
      }
      
      return { rows: [] };
    });
  });

  it('should process SALES_ORDER_CREATED event', async () => {
    const response = await request(app)
      .post('/api/events')
      .set('x-user-id', '1')
      .set('x-company-id', '1')
      .send({
        entityType: 'SALES_ORDER_CREATED',
        company_id: 1,
        order_id: 12345,
        customer_id: 999,
        total_amount: 5000000,
        dimensions: {}
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.status).toBe('completed');
    expect(response.body.entityType).toBe('SALES_ORDER_CREATED');
    expect(response.body.data.voucherId).toBeDefined();
  });

  it('should process PURCHASE_REQUISITION_CREATED event', async () => {
    const response = await request(app)
      .post('/api/events')
      .set('x-user-id', '1')
      .set('x-company-id', '1')
      .send({
        entityType: 'PURCHASE_REQUISITION_CREATED',
        company_id: 1,
        requisition_id: 67890,
        supplier_id: 888,
        total_amount: 10000000,
        dimensions: {}
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.entityType).toBe('PURCHASE_REQUISITION_CREATED');
  });

  it('should process INVENTORY_TRANSFER_CREATED event', async () => {
    const response = await request(app)
      .post('/api/events')
      .set('x-user-id', '1')
      .set('x-company-id', '1')
      .send({
        entityType: 'INVENTORY_TRANSFER_CREATED',
        company_id: 1,
        transfer_id: 11111,
        from_warehouse_id: 1,
        to_warehouse_id: 2,
        product_id: 555,
        quantity: 100,
        dimensions: {}
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.entityType).toBe('INVENTORY_TRANSFER_CREATED');
  });

  it('should process PAYMENT_CREATED event', async () => {
    const response = await request(app)
      .post('/api/events')
      .set('x-user-id', '1')
      .set('x-company-id', '1')
      .send({
        entityType: 'PAYMENT_CREATED',
        company_id: 1,
        payment_id: 22222,
        partner_id: 777,
        amount: 3000000,
        payment_method: 'BANK_TRANSFER',
        dimensions: {}
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.entityType).toBe('PAYMENT_CREATED');
  });

  it('should use user activeCompanyId when company_id not in body', async () => {
    const response = await request(app)
      .post('/api/events')
      .set('x-user-id', '1')
      .set('x-company-id', '1')
      .send({
        entityType: 'SALES_ORDER_CREATED',
        order_id: 12345
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  it('should handle event type case-insensitively', async () => {
    const response = await request(app)
      .post('/api/events')
      .set('x-user-id', '1')
      .set('x-company-id', '1')
      .send({
        entityType: 'sales_order_created',
        company_id: 1,
        order_id: 12345,
        dimensions: {}
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });
});
