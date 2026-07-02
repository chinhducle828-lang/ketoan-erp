import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import { mockPool } from './setup.js'; // Sử dụng Pool đã được mock từ trước

// Giả lập một Express App để test API độc lập không cần chạy toàn bộ server
import express from 'express';
const app = express();
app.use(express.json());

// Giả lập một Middleware giả để tiêm user vào req (bỏ qua bước xác thực JWT thực tế khi test)
const mockAuth = (req, res, next) => {
  req.user = { id: 99, role: 'ktt', companyIds: [1, 2] }; // User có quyền ở công ty 1 và 2
  next();
};

// Route giả lập để test Controller xử lý phiếu kế toán (Master-Detail)
import { createVoucherSchema } from '../validators/index.js';
app.post('/api/vouchers', mockAuth, async (req, res) => {
  // 1. Chạy qua lớp gác cổng Validator
  const parsed = createVoucherSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors });
  }

  // 2. Chạy qua lớp phân quyền công ty (User ktt chỉ được tạo ở công ty thuộc quyền quản lý)
  if (!req.user.companyIds.includes(req.body.companyId) && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Không có quyền truy cập công ty này' });
  }

  try {
    // 3. Giả lập Transaction ghi vào DB (Bảng Vouchers - Master)
    const { voucherDate, description, type, companyId, details } = req.body;
    
    // Ghi vào bảng cha
    const masterResult = await mockPool.query(
      'INSERT INTO vouchers (...) VALUES (...) RETURNING id',
      [voucherDate, description, type, companyId]
    );
    const voucherId = 1001; // Giả định ID sinh ra từ DB

    // Ghi vào bảng con (Voucher Details) bằng vòng lặp
    for (const detail of details) {
      await mockPool.query(
        'INSERT INTO voucher_details (...) VALUES (...)',
        [voucherId, detail.accountCode, detail.entryType, detail.amount]
      );
    }

    return res.status(201).json({ success: true, voucherId, message: 'Tạo phiếu kế toán thành công!' });
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});

// ==================== BỘ UNIT TEST & INTEGRATION TEST ====================
describe('Voucher API - Integration Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully create a valid balanced voucher in Database', async () => {
    // Giả lập kết quả trả về khi INSERT bảng cha thành công
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1001 }] }); 
    // Giả lập các lượt INSERT bảng con tiếp theo
    mockPool.query.mockResolvedValue({ rows: [] });

    const validVoucher = {
      voucherDate: '2026-07-02',
      description: 'Chi tiền mặt mua công cụ dụng cụ',
      type: 'Chi',
      companyId: 1, // Thuộc quyền của KTT (companyIds: [1, 2])
      details: [
        { accountCode: '153', entryType: 'DR', amount: 500000 },
        { accountCode: '1111', entryType: 'CR', amount: 500000 }
      ]
    };

    const response = await request(app)
      .post('/api/vouchers')
      .send(validVoucher);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.voucherId).toBe(1001);
    
    // Kiểm tra xem DB có được gọi đúng số lần không (1 lần bảng cha + 2 lần cho 2 dòng details = 3 lần)
    expect(mockPool.query).toHaveBeenCalledTimes(3);
  });

  it('should reject and return 400 if total DR does not equal total CR', async () => {
    const unbalancedVoucher = {
      voucherDate: '2026-07-02',
      description: 'Phiếu lỗi định khoản lệch tiền',
      type: 'Thu',
      companyId: 1,
      details: [
        { accountCode: '1111', entryType: 'DR', amount: 1000000 }, // Nợ 1 triệu
        { accountCode: '131', entryType: 'CR', amount: 900000 }    // Có 900k -> Lệch!
      ]
    };

    const response = await request(app)
      .post('/api/vouchers')
      .send(unbalancedVoucher);

    expect(response.status).toBe(400);
    // Hệ thống chặn từ vòng Validator nên Database không được gọi lần nào
    expect(mockPool.query).toHaveBeenCalledTimes(0);
  });

  it('should reject and return 403 if user tries to create voucher for unauthorized company', async () => {
    const unauthorizedVoucher = {
      voucherDate: '2026-07-02',
      description: 'Phiếu gian lận công ty khác',
      type: 'Chi',
      companyId: 9, // Công ty ID 9 không nằm trong danh sách [1, 2] của user này
      details: [
        { accountCode: '1111', entryType: 'DR', amount: 200000 },
        { accountCode: '331', entryType: 'CR', amount: 200000 }
      ]
    };

    const response = await request(app)
      .post('/api/vouchers')
      .send(unauthorizedVoucher);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Không có quyền truy cập công ty này');
    expect(mockPool.query).toHaveBeenCalledTimes(0);
  });
});