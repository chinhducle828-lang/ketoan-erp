import request from 'supertest';
import { app } from '../server.js';
import { pool } from '../config/db.js';

describe('BỘ KIỂM THỬ TÍCH HỢP CHỨNG TỪ KẾ TOÁN (VOUCHERS INTEGRATION TESTS)', () => {
  let authToken;
  let testCompanyId;

  beforeAll(async () => {
    // 1. Tạo công ty hạch toán thử nghiệm
    const compRes = await pool.query(
      `INSERT INTO companies (name, tax_code, address, lock_date) 
       VALUES ('Doanh nghiệp Kiểm thử ERP', '0110202688', 'Hai Xuan, Ninh Binh', '2026-06-30') 
       RETURNING id`
    );
    testCompanyId = compRes.rows[0].id;

    // 2. Tạo tài khoản hạch toán thử nghiệm và lấy jwt token
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password123' }); // Giả định tài khoản admin mẫu

    authToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    // Dọn dẹp sạch sẽ rác kiểm thử sau khi hoàn tất
    await pool.query('DELETE FROM companies WHERE id = $1', [testCompanyId]);
    await pool.end();
  });

  test('TẠO CHỨNG TỪ: Hệ thống phải lưu thành công với định dạng snake_case cân đối Nợ/Có', async () => {
    const response = await request(app)
      .post('/api/vouchers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        company_id: testCompanyId,
        voucher_number: 'VOUCHER-TEST-001',
        voucher_date: '2026-07-03',
        voucher_type: 'NK',
        details: [
          { account_code: '1561', entry_type: 'DR', amount: 50000000 }, // Nợ TK 1561: 50,000,000 VND
          { account_code: '331', entry_type: 'CR', amount: 50000000 }   // Có TK 331: 50,000,000 VND
        ]
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  test('LỖI ĐỊNH KHOẢN: Hệ thống từ chối lưu chứng từ bất cân đối Nợ/Có (Double-entry check)', async () => {
    const response = await request(app)
      .post('/api/vouchers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        company_id: testCompanyId,
        voucher_number: 'VOUCHER-TEST-ERR',
        voucher_date: '2026-07-03',
        voucher_type: 'PT',
        details: [
          { account_code: '1111', entry_type: 'DR', amount: 10000000 }, // Nợ TK 1111: 10,000,000 VND
          { account_code: '131', entry_type: 'CR', amount: 9500000 }    // Có TK 131: 9,500,000 VND -> Bất cân đối!
        ]
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Lỗi định khoản bất cân đối');
  });

  test('BẢO VỆ KHÓA SỔ: Hệ thống chặn can thiệp sửa/xóa dữ liệu nằm trong kỳ đã khóa (lock_date)', async () => {
    const response = await request(app)
      .post('/api/vouchers')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        company_id: testCompanyId,
        voucher_number: 'VOUCHER-CLOSED-ERR',
        voucher_date: '2026-05-15', // Ngày 15/05/2026 nằm trong kỳ đã khóa (lock_date: 30/06/2026)
        voucher_type: 'PC',
        details: [
          { account_code: '1111', entry_type: 'CR', amount: 2000000 },
          { account_code: '152', entry_type: 'DR', amount: 2000000 }
        ]
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('đã khóa sổ');
  });
});