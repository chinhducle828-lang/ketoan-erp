import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import { mockPool } from './setup.js'; // Pool DB giả lập của dự án
import express from 'express';

// Khởi tạo một phiên bản ứng dụng Express thu nhỏ để cách ly môi trường kiểm thử độc lập
const app = express();
app.use(express.json());

// Gác cổng xác thực: Mock thông tin tài khoản đăng nhập có quyền tại Công ty 1 và Công ty 2
const mockAuth = (req, res, next) => {
  req.user = { id: 99, role: 'ktt', companyIds: [1, 2] }; 
  next();
};

import { createVoucherSchema } from '../validators/index.js';

// Khai báo Router phục vụ API giả định khớp luồng xử lý thực tế của Controller
app.post('/api/vouchers', mockAuth, async (req, res) => {
  // Lớp 1: Kiểm thử cấu trúc Zod Schema
  const parsed = createVoucherSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors });
  }

  // Lớp 2: Kiểm thử logic phân quyền theo phạm vi quản lý Công ty
  if (!req.user.companyIds.includes(req.body.companyId) && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Không có quyền truy cập công ty này' });
  }

  try {
    const { voucherDate, description, type, companyId, details } = req.body;
    
    // Thực thi lưu Master vào Database
    await mockPool.query(
      'INSERT INTO vouchers (voucher_date, description, type, company_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [voucherDate, description, type, companyId]
    );
    const voucherId = 1001; 

    // Thực thi tuần tự lưu danh sách Detail vào Database con
    for (const detail of details) {
      await mockPool.query(
        'INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) VALUES ($1, $2, $3, $4)',
        [voucherId, detail.accountCode, detail.entryType, detail.amount]
      );
    }

    return res.status(201).json({ success: true, voucherId, message: 'Tạo phiếu kế toán thành công!' });
  } catch (err) {
    return res.status(500).json({ error: 'Lỗi hệ thống' });
  }
});

// ==================== BỘ TÍCH HỢP KIỂM THỬ TÀI KHOẢN & SỔ CÁI ====================
describe('Voucher API - Integration Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully create a valid balanced voucher in Database', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1001 }] }); 
    mockPool.query.mockResolvedValue({ rows: [] });

    const validVoucher = {
      voucherDate: '2026-07-02',
      description: 'Chi tiền mặt mua công cụ dụng cụ văn phòng',
      type: 'Chi',
      companyId: 1,
      details: [
        { accountCode: '153', entryType: 'DR', amount: 500000 },
        { accountCode: '1111', entryType: 'CR', amount: 500000 }
      ]
    };

    const response = await request(app).post('/api/vouchers').send(validVoucher);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    // Tổng số lượt gọi DB: 1 dòng Master + 2 dòng Detail = 3
    expect(mockPool.query).toHaveBeenCalledTimes(3);
  });

  it('should successfully process a multi-line rounded payroll voucher (4 rows)', async () => {
    mockPool.query.mockResolvedValueOnce({ rows: [{ id: 1001 }] }); 
    mockPool.query.mockResolvedValue({ rows: [] });

    const validPayrollVoucher = {
      voucherDate: '2026-06-30',
      description: 'Trích chi phí lương gộp và các khoản bảo hiểm bắt buộc theo tỷ lệ 32%',
      type: 'Khac',
      companyId: 2, 
      details: [
        { accountCode: '6422', entryType: 'DR', amount: 20000000 }, // Tổng lương gộp Gross
        { accountCode: '6422', entryType: 'DR', amount: 4300000 },  // Công ty gánh (21.5%)
        { accountCode: '3341', entryType: 'CR', amount: 17900000 }, // Thực trả nhân viên Net (Trừ 10.5%)
        { accountCode: '3383', entryType: 'CR', amount: 6400000 }   // Tổng nộp cơ quan bảo hiểm (32%)
      ]
    };

    const response = await request(app).post('/api/vouchers').send(validPayrollVoucher);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    // Tổng số lượt gọi DB: 1 dòng Master + 4 dòng Detail = 5
    expect(mockPool.query).toHaveBeenCalledTimes(5);
  });

  it('should reject and return 400 if total DR does not equal total CR', async () => {
    const unbalancedVoucher = {
      voucherDate: '2026-07-02',
      description: 'Hệ thống chặn lỗi hạch toán mất cân đối tiền',
      type: 'Thu',
      companyId: 1,
      details: [
        { accountCode: '1111', entryType: 'DR', amount: 1000000 },
        { accountCode: '131', entryType: 'CR', amount: 999999 } // Lệch chân 1 đồng
      ]
    };

    const response = await request(app).post('/api/vouchers').send(unbalancedVoucher);

    expect(response.status).toBe(400);
    // Bị chặn từ lớp kiểm định đầu vào nên DB không chạy
    expect(mockPool.query).toHaveBeenCalledTimes(0);
  });

  it('should reject and return 403 if user tries to create voucher for unauthorized company', async () => {
    const unauthorizedVoucher = {
      voucherDate: '2026-07-02',
      description: 'Hành vi cố tình đẩy dữ liệu vào doanh nghiệp ngoài phạm vi',
      type: 'Chi',
      companyId: 9, // Vượt ngoài phạm vi quản lý [1, 2]
      details: [
        { accountCode: '1111', entryType: 'DR', amount: 200000 },
        { accountCode: '331', entryType: 'CR', amount: 200000 }
      ]
    };

    const response = await request(app).post('/api/vouchers').send(unauthorizedVoucher);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Không có quyền truy cập công ty này');
    expect(mockPool.query).toHaveBeenCalledTimes(0);
  });
}); 