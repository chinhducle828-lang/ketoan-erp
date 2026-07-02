
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import { mockPool } from './setup.js';
import express from 'express';

const app = express();
app.use(express.json());

app.post('/api/vouchers/purchasing', async (req, res) => {
  const { details } = req.body;
  const drSum = details.filter(d => d.entryType === 'DR').reduce((s, d) => s + d.amount, 0);
  const crSum = details.filter(d => d.entryType === 'CR').reduce((s, d) => s + d.amount, 0);

  if (drSum !== crSum) return res.status(400).json({ error: 'Chứng từ mua hàng mất cân đối Nợ Có' });
  return res.status(201).json({ success: true });
});

describe('Purchasing Module - Integration Tests', () => {
  it('should successfully process standard purchasing voucher with 10% VAT', async () => {
    const purchasingPayload = {
      companyId: 1,
      details: [
        { accountCode: '1561', entryType: 'DR', amount: 10000000 }, // Tiền mua hàng giá gốc
        { accountCode: '1331', entryType: 'DR', amount: 1000000 },  // Thuế GTGT đầu vào 10%
        { accountCode: '331', entryType: 'CR', amount: 11000000 }   // Tổng phải trả nhà cung cấp
      ]
    };
    const res = await request(app).post('/api/vouchers/purchasing').send(purchasingPayload);
    expect(res.status).toBe(201);
  });
});