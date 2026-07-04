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

const { default: publicRoutes } = await import('../../routes/publicRoutes.js');
const { default: logisticsRoutes } = await import('../../routes/logisticsRoutes.js');

describe('Storefront workflow integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanAccessCompany.mockResolvedValue(true);
  });

  test('POST /api/public/orders creates financial lines + separated logistics qty lines', async () => {
    const client = {
      query: jest.fn(async (sql, params) => {
        const normalized = String(sql).replace(/\s+/g, ' ').trim();

        if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') {
          return { rows: [] };
        }

        if (normalized.includes('SELECT lock_date FROM companies')) {
          return { rows: [{ lock_date: null }] };
        }

        if (normalized.includes('FROM information_schema.columns') && normalized.includes("table_name = 'items'")) {
          return {
            rows: [
              { column_name: 'id' },
              { column_name: 'code' },
              { column_name: 'name' },
              { column_name: 'unit' },
              { column_name: 'price_sell' },
              { column_name: 'opening_quantity' },
              { column_name: 'image_url' },
              { column_name: 'image_urls' },
              { column_name: 'description' },
            ],
          };
        }

        if (normalized.includes('FROM items') && normalized.includes('item_pk')) {
          return {
            rows: [
              {
                item_pk: 101,
                code: 'SP001',
                name: 'San pham 1',
                unit: 'Cai',
                price_sell: 100,
              },
            ],
          };
        }

        if (normalized.includes('FROM information_schema.columns') && normalized.includes("table_name = 'vouchers'")) {
          return {
            rows: [
              { column_name: 'company_id' },
              { column_name: 'voucher_number' },
              { column_name: 'voucher_type' },
              { column_name: 'description' },
            ],
          };
        }

        if (normalized.includes('INSERT INTO vouchers')) {
          return { rows: [{ id: 5001 }] };
        }

        if (normalized.includes('FROM information_schema.columns') && normalized.includes("table_name = 'voucher_details'")) {
          return { rows: [{ column_name: 'quantity' }, { column_name: 'item_id' }] };
        }

        if (normalized.includes('INSERT INTO voucher_details')) {
          return { rows: [] };
        }

        throw new Error(`Unhandled SQL in test: ${normalized}`);
      }),
      release: jest.fn(),
    };

    mockPool.connect.mockResolvedValue(client);

    const app = express();
    app.use(express.json());
    app.use('/api/public', publicRoutes);

    const response = await request(app)
      .post('/api/public/orders')
      .send({
        companyId: 1,
        items: [{ itemId: '101', quantity: 2 }],
        customerName: 'Test Customer',
        phone: '0123456789',
        address: 'HN',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    const detailInsertCalls = client.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO voucher_details'));
    expect(detailInsertCalls.length).toBe(4);

    const logisticsLineCall = detailInsertCalls.find(([, params]) => params?.[1] === '156_OPS');
    expect(logisticsLineCall).toBeDefined();
    expect(logisticsLineCall[1][3]).toBe(0);
    expect(logisticsLineCall[1][4]).toBe(2);
    expect(logisticsLineCall[1][5]).toBe(101);

    expect(client.release).toHaveBeenCalledTimes(1);
  });

  test('POST /api/public/orders resolves legacy account_dr/account_cr from FK table', async () => {
    const client = {
      query: jest.fn(async (sql, params) => {
        const normalized = String(sql).replace(/\s+/g, ' ').trim();

        if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') {
          return { rows: [] };
        }

        if (normalized.includes('SELECT lock_date FROM companies')) {
          return { rows: [{ lock_date: null }] };
        }

        if (normalized.includes('FROM information_schema.columns') && normalized.includes("table_name = 'items'")) {
          return {
            rows: [
              { column_name: 'id' },
              { column_name: 'code' },
              { column_name: 'name' },
              { column_name: 'unit' },
              { column_name: 'price_sell' },
            ],
          };
        }

        if (normalized.includes('FROM items') && normalized.includes('item_pk')) {
          return {
            rows: [
              {
                item_pk: 102,
                code: 'SP002',
                name: 'San pham 2',
                unit: 'Hop',
                price_sell: 200,
              },
            ],
          };
        }

        if (normalized.includes('FROM information_schema.columns') && normalized.includes("table_name = 'vouchers'")) {
          return {
            rows: [
              { column_name: 'company_id' },
              { column_name: 'voucher_type' },
              { column_name: 'account_dr' },
              { column_name: 'account_cr' },
              { column_name: 'amount' },
            ],
          };
        }

        if (normalized.includes('FROM pg_constraint')) {
          const targetColumn = params?.[1];
          if (targetColumn === 'account_dr' || targetColumn === 'account_cr') {
            return { rows: [{ referenced_table: 'public.accounts', referenced_column: 'code' }] };
          }
        }

        if (normalized.includes('FROM "public"."accounts"') && normalized.includes('WHERE "code"::text = $1')) {
          const candidate = String(params?.[0] || '');
          const exists = ['131', '3331'].includes(candidate);
          return { rowCount: exists ? 1 : 0, rows: exists ? [{ ok: 1 }] : [] };
        }

        if (normalized.includes('FROM "public"."accounts"') && normalized.includes('ORDER BY "code"::text')) {
          return { rows: [{ account_code: '131' }] };
        }

        if (normalized.includes('INSERT INTO vouchers')) {
          return { rows: [{ id: 6001 }] };
        }

        if (normalized.includes('FROM information_schema.columns') && normalized.includes("table_name = 'voucher_details'")) {
          return { rows: [{ column_name: 'quantity' }, { column_name: 'item_id' }] };
        }

        if (normalized.includes('INSERT INTO voucher_details')) {
          return { rows: [] };
        }

        throw new Error(`Unhandled SQL in test: ${normalized}`);
      }),
      release: jest.fn(),
    };

    mockPool.connect.mockResolvedValue(client);

    const app = express();
    app.use(express.json());
    app.use('/api/public', publicRoutes);

    const response = await request(app)
      .post('/api/public/orders')
      .send({
        companyId: 1,
        items: [{ itemId: '102', quantity: 1 }],
        customerName: 'Legacy',
        phone: '0999',
        address: 'HCM',
      });

    expect(response.status).toBe(201);

    const voucherInsertCall = client.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO vouchers'));
    expect(voucherInsertCall).toBeDefined();
    // Params: [companyId, voucherType, description, account_dr, account_cr, amount]
    expect(voucherInsertCall[1][3]).toBe('131');
    expect(voucherInsertCall[1][4]).toBe('3331');
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
});
