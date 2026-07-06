import request from 'supertest';
import app from '../server.js';

describe('Accounting API Routes', () => {
  test('GET /api/accounting/tax-rate/:revenue returns flat corporate tax rate', async () => {
    const response = await request(app).get('/api/accounting/tax-rate/123456789');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toMatchObject({
      revenue: 123456789,
      taxRate: 0.2,
      taxRatePercent: 20
    });
  });

  test('GET /api/accounting/tax-rate/:revenue returns 400 for invalid revenue', async () => {
    const response = await request(app).get('/api/accounting/tax-rate/not-a-number');

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error', 'revenue must be a number');
  });
});
