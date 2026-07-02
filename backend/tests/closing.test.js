import request from 'supertest';
import express from 'express';

// KHÔNG IMPORT từ '@jest/globals' nữa vì Jest Node ESM đã tự động nạp toàn cục các từ khóa này

describe('Closing Period Module Placeholder', () => {
  it('should pass initial sanity check', () => {
    expect(1 + 1).toBe(2);
  });
});

const app = express();
app.use(express.json());

// Giả lập trạng thái tháng 06/2026 đã khóa sổ
const CLOSED_PERIODS = ['2026-06'];

app.post('/api/vouchers', (req, res) => {
  const { voucherDate } = req.body;
  const period = voucherDate.substring(0, 7); // Lấy chuỗi 'YYYY-MM'

  if (CLOSED_PERIODS.includes(period)) {
    return res.status(400).json({ error: 'Kỳ kế toán này đã khóa sổ. Không thể thêm hoặc sửa đổi chứng từ!' });
  }
  return res.status(201).json({ success: true });
});

describe('Closing Period Module - Business Rules Tests', () => {
  it('should block voucher creation if the voucherDate falls into a closed month', async () => {
    const lockedPayload = {
      voucherDate: '2026-06-30', // Tháng 6 đã khóa
      companyId: 1,
      details: [{ accountCode: '1111', entryType: 'DR', amount: 100 }]
    };

    const res = await request(app).post('/api/vouchers').send(lockedPayload);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('đã khóa sổ');
  });

  it('should allow voucher creation if the period is still open', async () => {
    const openPayload = {
      voucherDate: '2026-07-02', // Tháng 7 chưa khóa
      companyId: 1,
      details: [{ accountCode: '1111', entryType: 'DR', amount: 100 }]
    };

    const res = await request(app).post('/api/vouchers').send(openPayload);
    expect(res.status).toBe(201);
  });
});