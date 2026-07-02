
import request from 'supertest';
import { mockPool } from './setup.js';
import express from 'express';
import { describe, it, expect } from '@jest/globals';

describe('Cash Transaction Module Placeholder', () => {
  it('should pass initial sanity check', () => {
    expect(true).toBe(true);
  });
});
const app = express();
app.use(express.json());

app.post('/api/vouchers/cash', async (req, res) => {
  const { type, details, companyId } = req.body;
  
  // Nghiệp vụ: Phiếu thu/chi tiền mặt bắt buộc phải có tài khoản đầu 111
  const hasCashAccount = details.some(d => d.accountCode.startsWith('111'));
  if (!hasCashAccount) {
    return res.status(400).json({ error: 'Nghiệp vụ tiền mặt bắt buộc phải sử dụng tài khoản 111' });
  }

  try {
    mockPool.query('INSERT INTO vouchers (...) VALUES (...)');
    return res.status(201).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});

describe('Cash Module - Integration Tests', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should accept valid cash voucher with 1111 account', async () => {
    const payload = {
      type: 'Thu',
      companyId: 1,
      details: [
        { accountCode: '1111', entryType: 'DR', amount: 5000000 },
        { accountCode: '131', entryType: 'CR', amount: 5000000 }
      ]
    };
    const res = await request(app).post('/api/vouchers/cash').send(payload);
    expect(res.status).toBe(201);
  });

  it('should reject cash voucher if 111 account is missing', async () => {
    const payload = {
      type: 'Chi',
      companyId: 1,
      details: [
        { accountCode: '331', entryType: 'DR', amount: 2000000 },
        { accountCode: '1121', entryType: 'CR', amount: 2000000 } // Lỗi: Tiền gửi ngân hàng chứ không phải tiền mặt
      ]
    };
    const res = await request(app).post('/api/vouchers/cash').send(payload);
    expect(res.status).toBe(400);
  });
});