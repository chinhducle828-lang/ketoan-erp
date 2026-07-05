import { jest } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../server.js';
import { dbInitPromise } from '../server.js';
import { pool } from '../config/db.js';

describe('BỘ KIỂM THỬ TÍCH HỢP CHỨNG TỪ KẾ TOÁN (VOUCHERS INTEGRATION TESTS)', () => {
  jest.setTimeout(120000);
  let authToken;
  let testCompanyId;
  let testAdminId;
  const testAdminUsername = `voucher_admin_${Date.now()}`;
  const testAdminPassword = 'Password123!';

  beforeAll(async () => {
    // Chờ server hoàn tất khởi tạo schema/migration để tránh race condition khi test ghi DB
    await dbInitPromise;

    // 1. Tạo công ty hạch toán thử nghiệm
    const compRes = await pool.query(
      `INSERT INTO companies (name, tax_code, address, lock_date) 
       VALUES ('Doanh nghiệp Kiểm thử ERP', '0110202688-' || floor(random()*1000000), 'Hai Xuan, Ninh Binh', '2026-06-30') 
       RETURNING id`
    );
    testCompanyId = compRes.rows[0].id;

    // 2. Tạo tài khoản admin test độc lập để tránh phụ thuộc dữ liệu local
    const hashed = await bcrypt.hash(testAdminPassword, 10);
    const userRes = await pool.query(
      `INSERT INTO users (username, password, role, company_ids, staff_ids, must_change_password)
       VALUES ($1, $2, 'admin', '{}', '{}', false)
       RETURNING id`,
      [testAdminUsername, hashed]
    );
    testAdminId = userRes.rows[0].id;

    // 3. Đăng nhập tài khoản test và lấy access token hợp lệ theo session hiện tại
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: testAdminUsername, password: testAdminPassword });

    authToken = loginRes.body.accessToken;
    expect(loginRes.status).toBe(200);
    expect(authToken).toBeTruthy();
  });

  afterAll(async () => {
    // Dọn dẹp sạch sẽ rác kiểm thử sau khi hoàn tất
    if (testCompanyId) {
      await pool.query('DELETE FROM companies WHERE id = $1', [testCompanyId]);
    }
    if (testAdminId) {
      await pool.query('DELETE FROM users WHERE id = $1', [testAdminId]);
    }
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

describe('Notification API Tests', () => {
  jest.setTimeout(120000);
  let authToken;
  let testCompanyId;
  let testAdminId;
  const testAdminUsername = `notif_admin_${Date.now()}`;
  const testAdminPassword = 'Password123!';

  beforeAll(async () => {
    await dbInitPromise;

    // Tạo công ty test
    const compRes = await pool.query(
      `INSERT INTO companies (name, tax_code, address) 
       VALUES ('Test Company for Notifications', '0110202699', 'Hanoi') 
       RETURNING id`
    );
    testCompanyId = compRes.rows[0].id;

    // Tạo admin test
    const hashed = await bcrypt.hash(testAdminPassword, 10);
    const userRes = await pool.query(
      `INSERT INTO users (username, password, role, company_ids, staff_ids, must_change_password)
       VALUES ($1, $2, 'admin', '{}', '{}', false)
       RETURNING id`,
      [testAdminUsername, hashed]
    );
    testAdminId = userRes.rows[0].id;

    // Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: testAdminUsername, password: testAdminPassword });

    authToken = loginRes.body.accessToken;
  });

  afterAll(async () => {
    if (testCompanyId) {
      await pool.query('DELETE FROM companies WHERE id = $1', [testCompanyId]);
    }
    if (testAdminId) {
      await pool.query('DELETE FROM users WHERE id = $1', [testAdminId]);
    }
  });

  test('GET /api/notifications - Lấy danh sách thông báo', async () => {
    const response = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ company_id: testCompanyId });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test('POST /api/notifications/subscribe - Đăng ký nhận thông báo', async () => {
    const response = await request(app)
      .post('/api/notifications/subscribe')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        endpoint: 'https://fcm.googleapis.com/test-endpoint',
        p256dh: 'test-p256dh-key',
        auth: 'test-auth-key',
        companyId: testCompanyId
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  test('POST /api/notifications/unsubscribe - Hủy đăng ký', async () => {
    // First subscribe
    await request(app)
      .post('/api/notifications/subscribe')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        endpoint: 'https://fcm.googleapis.com/test-unsubscribe',
        p256dh: 'test-p256dh-key',
        auth: 'test-auth-key',
        companyId: testCompanyId
      });

    // Then unsubscribe
    const response = await request(app)
      .post('/api/notifications/unsubscribe')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        endpoint: 'https://fcm.googleapis.com/test-unsubscribe'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
