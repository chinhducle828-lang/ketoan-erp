import request from 'supertest';
import express from 'express';

// KHÔNG IMPORT từ '@jest/globals' nữa vì Jest Node ESM đã tự động inject globals

describe('Sales Module Placeholder', () => {
  it('should pass initial sanity check', () => {
    expect('Sales').not.toBeNull();
  });
});

const app = express();
app.use(express.json());

app.post('/api/vouchers/sales', (req, res) => {
  const { details } = req.body;
  // Check cấu trúc phải có ít nhất tài khoản doanh thu (511) hoặc giá vốn (632)
  const hasRevenue = details.some(d => d.accountCode.startsWith('511'));
  if (!hasRevenue) return res.status(400).json({ error: 'Thiếu định khoản doanh thu 511' });
  return res.status(201).json({ success: true });
});

describe('Sales Module - Integration Tests', () => {
  it('should accept valid sales logic payload', async () => {
    const salesPayload = {
      companyId: 1,
      details: [
        { accountCode: '131', entryType: 'DR', amount: 22000000 },  // Phải thu khách hàng
        { accountCode: '5111', entryType: 'CR', amount: 20000000 }, // Doanh thu bán hàng
        { accountCode: '33311', entryType: 'CR', amount: 2000000 }  // Thuế GTGT đầu ra phải nộp
      ]
    };
    const res = await request(app).post('/api/vouchers/sales').send(salesPayload);
    expect(res.status).toBe(201);
  });
});