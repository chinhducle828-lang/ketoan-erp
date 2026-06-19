import express from 'express';
import cors from 'cors';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL chưa được cấu hình. Vui lòng thêm biến môi trường DATABASE_URL.');
  process.exit(1);
}

// BẬC THẦY KHỞI TẠO: Kiểm tra và đồng bộ cấu trúc dữ liệu an toàn tuần tự
(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('Kết nối đến cơ sở dữ liệu thành công.');
    
    // 1. Bảng công ty
    await pool.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        tax_code VARCHAR(50),
        address TEXT
      );
    `);

    // 2. Bảng người dùng
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role VARCHAR(50) NOT NULL,
        must_change_password BOOLEAN DEFAULT false
      );
    `);

    // BẢNG TRUNG GIAN ĐA CÔNG TY: Một tài khoản liên kết nhiều công ty
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_companies (
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, company_id)
      );
    `);

    // 3. Khởi tạo bảng phụ thuộc: sessions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        device_info TEXT,
        ip_address TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        expires_at TIMESTAMP WITH TIME ZONE
      );
    `);
    
    // Đồng bộ cấu trúc phụ trợ cho users (Thêm cột đổi mật khẩu và quản lý trực thuộc)
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
    
    // 4. Khởi tạo bảng danh mục vật tư items với KHÓA PHỨC HỢP chuẩn đa doanh nghiệp
    await pool.query(`
      CREATE TABLE IF NOT EXISTS items (
        code VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (code, company_id)
      );
    `);
    
    console.log('Đồng bộ cấu trúc bảng cơ sở dữ liệu hoàn tất.');
  } catch (error) {
    console.error('⚠️ [LỖI KHỞI TẠO DB]:', error.message);
  }
})();

// ==========================================
// MIDDLEWARE XÁC THỰC VÀ PHÂN QUYỀN (PRIVATE API)
// ==========================================

const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Truy cập bị từ chối. Vui lòng đăng nhập!' });
  
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    
    const q = await pool.query(
      'SELECT id FROM sessions WHERE token = $1 AND user_id = $2 AND (expires_at IS NULL OR expires_at > now()) LIMIT 1', 
      [token, req.user.id]
    );
    
    if (q.rows.length === 0) {
      return res.status(401).json({ error: 'Phiên làm việc không hợp lệ hoặc đã bị đăng nhập từ nơi khác.' });
    }
    next();
  } catch {
    res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn!' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện hành động này!' });
    }
    next();
  };
};

// ==========================================
// --- API HỆ THỐNG & AUTHENTICATION ---
// ==========================================

// Đăng ký tài khoản Admin hệ thống gốc (GIỮ NGUYÊN)
app.post('/api/auth/register-admin', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const checkAdmin = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (checkAdmin.rows.length > 0) {
      return res.status(400).json({ error: 'Hệ thống đã có tài khoản quản trị viên!' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [username, hashed, 'admin']
    );
    res.json({ success: true, user: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Đăng nhập hệ thống (NÂNG CẤP ĐA CÔNG TY TRONG JWT)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Tài khoản không tồn tại!' });
    
    const user = result.rows[0];
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: 'Mật khẩu không chính xác!' });
    }
    
    // Lấy toàn bộ danh sách ID công ty được gán cho user này (Nếu không phải Admin)
    let companyIds = [];
    if (user.role !== 'admin') {
      const companiesQuery = await pool.query('SELECT company_id FROM user_companies WHERE user_id = $1', [user.id]);
      companyIds = companiesQuery.rows.map(r => r.company_id);
    }
    
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, company_ids: companyIds }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );

    try {
      await pool.query('DELETE FROM sessions WHERE user_id = $1', [user.id]);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await pool.query(
        'INSERT INTO sessions (user_id, token, created_at, expires_at, ip_address, device_info) VALUES ($1, $2, now(), $3, $4, $5)', 
        [user.id, token, expiresAt.toISOString(), req.ip, req.headers['user-agent'] || null]
      );
    } catch (err) {
      console.error('Không thể lưu session:', err.message);
    }

    res.json({ 
      token, 
      user: { id: user.id, username: user.username, role: user.role, company_ids: companyIds },
      must_change_password: !!user.must_change_password
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Đăng xuất (GIỮ NGUYÊN)
app.post('/api/auth/logout', authenticate, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(400).json({ error: 'Thiếu token.' });
    await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    res.json({ success: true, message: 'Đăng xuất thành công.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Thay đổi mật khẩu (GIỮ NGUYÊN)
app.post('/api/auth/change-password', authenticate, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ error: 'Thiếu mật khẩu mới.' });
    
    const q = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (q.rows.length === 0) return res.status(404).json({ error: 'Người dùng không tồn tại.' });
    
    const user = q.rows[0];
    if (!(await bcrypt.compare(oldPassword || '', user.password))) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng.' });
    }
    
    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1, must_change_password = false WHERE id = $2', [hashed, req.user.id]);
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [req.user.id]);
    res.json({ success: true, message: 'Đổi mật khẩu thành công.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin Reset Mật khẩu cho nhân viên (GIỮ NGUYÊN)
app.post('/api/auth/admin-reset-password', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Thiếu userId.' });
    
    const temp = Math.random().toString(36).slice(-8) + 'A1!';
    const hashed = await bcrypt.hash(temp, 10);
    await pool.query('UPDATE users SET password = $1, must_change_password = true WHERE id = $2', [hashed, userId]);
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    res.json({ success: true, tempPassword: temp, message: 'Đã reset mật khẩu thành công.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Lấy danh sách người dùng (SỬA ĐỂ TRẢ VỀ THÊM CỘT PHỤC VỤ Ô TÍCH CHỌN HÀNG LOẠT)
app.get('/api/users', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await pool.query(`
        SELECT u.id, u.username, u.role, u.manager_id, m.username as manager_name,
               ARRAY_REMOVE(ARRAY_AGG(DISTINCT uc.company_id), NULL) as company_ids,
               ARRAY_REMOVE(ARRAY_AGG(DISTINCT s.id), NULL) as staff_ids
        FROM users u
        LEFT JOIN user_companies uc ON u.id = uc.user_id
        LEFT JOIN users m ON u.manager_id = m.id
        LEFT JOIN users s ON s.manager_id = u.id AND s.role = 'nv'
        GROUP BY u.id, m.username
        ORDER BY u.id DESC
      `);
    } else {
      // Đối với Kế toán trưởng: Chỉ lấy danh sách nhân viên do mình quản lý trực tiếp
      result = await pool.query(`
        SELECT u.id, u.username, u.role, u.manager_id
        FROM users u
        WHERE u.manager_id = $1 AND u.role = 'nv'
        ORDER BY u.username ASC
      `, [req.user.id]);
    }
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Khai báo nhân sự mới từ Admin Form (GIỮ NGUYÊN)
app.post('/api/users', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ tài khoản, mật khẩu và vai trò!' });
    }

    const userExist = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ error: 'Tên tài khoản này đã tồn tại trên hệ thống!' });
    }

    const hashed = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (username, password, role, must_change_password) VALUES ($1, $2, $3, $4) RETURNING id, username, role',
      [username, hashed, role, true]
    );

    res.status(201).json({ success: true, message: 'Thêm nhân sự mới thành công!', user: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Xóa nhân sự (GIỮ NGUYÊN)
app.delete('/api/users/:id', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const userId = req.params.id;
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Bạn không thể tự xóa tài khoản chính mình!' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    res.json({ success: true, message: 'Đã xóa nhân sự khỏi hệ thống thành công!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// --- API MỚI PHÂN QUYỀN & GÁN Ô TÍCH CHỌN HÀNG LOẠT ---
// ==========================================

// 1. API: KẾ TOÁN TRƯỞNG TÍCH CHỌN QUẢN LÝ NHIỀU NHÂN VIÊN (Giới hạn tối đa 15 người)
app.post('/api/auth/assign-staff', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { managerId, staffIds } = req.body; // staffIds gửi lên dạng mảng: [4, 5, 6]

    if (!managerId) return res.status(400).json({ error: 'Thiếu thông tin Kế toán trưởng!' });
    if (!Array.isArray(staffIds)) return res.status(400).json({ error: 'Danh sách nhân viên phải là một mảng!' });

    // Chặn cứng quy tắc nghiệp vụ quản lý không quá 15 người
    if (staffIds.length > 15) {
      return res.status(400).json({ error: 'Một Kế toán trưởng chỉ được quản lý tối đa 15 nhân viên!' });
    }

    // Kiểm tra tính hợp lệ của người nhận quản lý
    const checkManager = await pool.query('SELECT role FROM users WHERE id = $1', [managerId]);
    if (checkManager.rows.length === 0 || checkManager.rows[0].role !== 'ktt') {
      return res.status(400).json({ error: 'Tài khoản nhận quản lý không phải là Kế toán trưởng (ktt)!' });
    }

    // Thực hiện Transaction để đảm bảo tính nhất quán dữ liệu hạch toán nhóm
    await pool.query('BEGIN');

    // Reset những nhân viên cũ đang trực thuộc KTT này về NULL
    await pool.query("UPDATE users SET manager_id = NULL WHERE manager_id = $1 AND role = 'nv'", [managerId]);

    // Tiến hành gán nhóm mới cho toàn bộ ID nhân viên được tích chọn
    if (staffIds.length > 0) {
      await pool.query(
        "UPDATE users SET manager_id = $1 WHERE id = ANY($2) AND role = 'nv'",
        [managerId, staffIds]
      );
    }

    await pool.query('COMMIT');
    res.json({ success: true, message: 'Cập nhật danh sách nhân viên cho Kế toán trưởng thành công!' });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// 2. API: CHỈ ĐỊNH NHÂN VIÊN VÀO NHIỀU CÔNG TY & CHỌN KTT PHỤ TRÁCH TRỰC TIẾP
app.post('/api/auth/assign-company', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { userId, companyIds, role, managerId } = req.body; // companyIds là một mảng: [1, 2, 3]

    const targetUser = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
    if (targetUser.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy người dùng!' });
    if (targetUser.rows[0].role === 'admin') return res.status(400).json({ error: 'Không thể phân quyền cho tài khoản Admin tối cao!' });

    const userRole = role || 'nv';
    const finalManagerId = userRole === 'nv' ? (managerId || null) : null;

    // Nếu gán nhân viên vào nhóm của một KTT nào đó, check xem KTT đó đã đạt giới hạn 15 người chưa
    if (finalManagerId) {
      const countRes = await pool.query(
        "SELECT COUNT(*) FROM users WHERE manager_id = $1 AND role = 'nv' AND id != $2",
        [finalManagerId, userId]
      );
      if (parseInt(countRes.rows[0].count, 10) >= 15) {
        return res.status(400).json({ error: 'Kế toán trưởng phụ trách được chọn đã quản lý đủ tối đa 15 nhân viên!' });
      }
    }

    // Bắt đầu Transaction đồng bộ vai trò và chuỗi doanh nghiệp hạch toán
    await pool.query('BEGIN');

    // Cập nhật chức vụ và người quản lý trực tiếp
    await pool.query('UPDATE users SET role = $1, manager_id = $2 WHERE id = $3', [userRole, finalManagerId, userId]);

    // Xóa sạch dữ liệu phân quyền công ty cũ trong bảng liên kết
    await pool.query('DELETE FROM user_companies WHERE user_id = $1', [userId]);

    // Thêm hàng loạt quyền truy cập công ty mới dựa trên mảng ô tích chọn gửi lên
    if (Array.isArray(companyIds) && companyIds.length > 0) {
      for (const cId of companyIds) {
        await pool.query('INSERT INTO user_companies (user_id, company_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, cId]);
      }
    }

    await pool.query('COMMIT');
    res.json({ success: true, message: 'Cấu hình danh sách chuỗi công ty làm việc thành công!' });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// --- API QUẢN LÝ DOANH NGHIỆP ---
// ==========================================

// Thêm mới công ty (GIỮ NGUYÊN)
app.post('/api/companies', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { name, taxCode, address } = req.body;
    const result = await pool.query(
      'INSERT INTO companies (name, tax_code, address) VALUES ($1, $2, $3) RETURNING *', 
      [name, taxCode, address]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Lấy danh sách công ty (GIỮ NGUYÊN)
app.get('/api/companies', authenticate, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await pool.query('SELECT * FROM companies ORDER BY id DESC');
    } else {
      result = await pool.query(`
        SELECT c.* FROM companies c
        INNER JOIN user_companies uc ON c.id = uc.company_id
        WHERE uc.user_id = $1 ORDER BY c.id DESC
      `, [req.user.id]);
    }
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Xóa công ty (GIỮ NGUYÊN)
app.delete('/api/companies/:id', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const companyId = req.params.id;
    
    const checkUsers = await pool.query('SELECT user_id FROM user_companies WHERE company_id = $1 LIMIT 1', [companyId]);
    if (checkUsers.rows.length > 0) {
      return res.status(400).json({ error: 'Không thể xóa công ty vì còn nhân viên đang được gán quyền làm việc!' });
    }

    const checkVouchers = await pool.query('SELECT id FROM vouchers WHERE company_id = $1 LIMIT 1', [companyId]);
    if (checkVouchers.rows.length > 0) {
      return res.status(400).json({ error: 'Không thể xóa công ty vì còn dữ liệu hạch toán!' });
    }

    await pool.query('DELETE FROM companies WHERE id = $1', [companyId]);
    res.json({ success: true, message: 'Đã xóa công ty thành công!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// --- API NGHIỆP VỤ HẠCH TOÁN ĐA DOANH NGHIỆP & NIÊN ĐỘ ĐỘNG ---
// ==========================================

// Lấy danh sách chứng từ (GIỮ NGUYÊN)
app.get('/api/vouchers', authenticate, async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id; 
    const year = req.query.year ? Number(req.query.year) : 2026;

    if (!targetCompanyId) return res.json([]);

    if (req.user.role !== 'admin') {
      const checkAccess = await pool.query('SELECT 1 FROM user_companies WHERE user_id = $1 AND company_id = $2', [req.user.id, targetCompanyId]);
      if (checkAccess.rows.length === 0) return res.status(403).json({ error: 'Bạn không có quyền truy cập dữ liệu của doanh nghiệp này!' });
    }

    const result = await pool.query(
      `SELECT * FROM vouchers 
       WHERE company_id = $1 
         AND EXTRACT(YEAR FROM voucher_date) = $2 
       ORDER BY voucher_date DESC, id DESC`, 
      [targetCompanyId, year]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Thêm mới chứng từ (GIỮ NGUYÊN)
app.post('/api/vouchers', authenticate, async (req, res) => {
  try {
    const { voucherDate, description, accountDr, accountCr, amount, type, companyId } = req.body;
    const targetCompanyId = companyId;
    
    if (!targetCompanyId) return res.status(400).json({ error: 'Vui lòng xác định rõ doanh nghiệp cần ghi sổ!' });

    if (req.user.role !== 'admin') {
      const checkAccess = await pool.query('SELECT 1 FROM user_companies WHERE user_id = $1 AND company_id = $2', [req.user.id, targetCompanyId]);
      if (checkAccess.rows.length === 0) return res.status(403).json({ error: 'Bạn không có quyền ghi sổ tại doanh nghiệp này!' });
    }

    const result = await pool.query(
      `INSERT INTO vouchers (company_id, voucher_date, description, account_dr, account_cr, amount, voucher_type, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [targetCompanyId, voucherDate, description, accountDr, accountCr, amount, type, req.user.id]
    );
    res.json({ success: true, voucher: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Xóa chứng từ (GIỮ NGUYÊN)
app.delete('/api/vouchers/:id', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id;
    if (!targetCompanyId) return res.status(400).json({ error: 'Thiếu mã đơn vị cần xóa dữ liệu!' });

    if (req.user.role !== 'admin') {
      const checkAccess = await pool.query('SELECT 1 FROM user_companies WHERE user_id = $1 AND company_id = $2', [req.user.id, targetCompanyId]);
      if (checkAccess.rows.length === 0) return res.status(403).json({ error: 'Bạn không có quyền thao tác trên dữ liệu doanh nghiệp này!' });
      await pool.query('DELETE FROM vouchers WHERE id = $1 AND company_id = $2', [req.params.id, targetCompanyId]);
    } else {
      await pool.query('DELETE FROM vouchers WHERE id = $1', [req.params.id]);
    }
    res.json({ success: true, message: 'Xóa chứng từ thành công!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Lấy số dư đầu kỳ (GIỮ NGUYÊN)
app.get('/api/opening-balances', authenticate, async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id;
    const year = req.query.year ? Number(req.query.year) : 2026;

    if (!targetCompanyId) return res.json([]);

    if (req.user.role !== 'admin') {
      const checkAccess = await pool.query('SELECT 1 FROM user_companies WHERE user_id = $1 AND company_id = $2', [req.user.id, targetCompanyId]);
      if (checkAccess.rows.length === 0) return res.status(403).json({ error: 'Quyền truy cập số dư bị từ chối!' });
    }

    const result = await pool.query(
      'SELECT * FROM opening_balances WHERE company_id = $1 AND fiscal_year = $2 ORDER BY account_code ASC', 
      [targetCompanyId, year]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Cập nhật số dư đầu kỳ (GIỮ NGUYÊN)
app.post('/api/opening-balances', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const { balances, year, companyId } = req.body;
    const targetCompanyId = companyId;
    const finalYear = year ? Number(year) : 2026;

    if (!targetCompanyId) return res.status(400).json({ error: 'Thông tin công ty không hợp lệ!' });
    if (!balances) return res.status(400).json({ error: 'Dữ liệu số dư trống!' });

    if (req.user.role !== 'admin') {
      const checkAccess = await pool.query('SELECT 1 FROM user_companies WHERE user_id = $1 AND company_id = $2', [req.user.id, targetCompanyId]);
      if (checkAccess.rows.length === 0) return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa số dư tại doanh nghiệp này!' });
    }

    for (const [code, val] of Object.entries(balances)) {
      await pool.query(
        `INSERT INTO opening_balances (company_id, account_code, debit_balance, credit_balance, fiscal_year)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (company_id, account_code, fiscal_year)
         DO UPDATE SET debit_balance = $3, credit_balance = $4`,
        [targetCompanyId, code, val.dr || 0, val.cr || 0, finalYear]
      );
    }
    res.json({ success: true, message: `Cập nhật số dư đầu kỳ cho năm ${finalYear} thành công!` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// --- API QUẢN LÝ DANH MỤC VẬT TƯ / SẢN PHẨM ---
// ==========================================

// 1. ĐỌC DANH SÁCH VẬT TƯ (GIỮ NGUYÊN)
app.get('/api/items', authenticate, async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id;
    if (!targetCompanyId) return res.json([]);

    if (req.user.role !== 'admin') {
      const checkAccess = await pool.query('SELECT 1 FROM user_companies WHERE user_id = $1 AND company_id = $2', [req.user.id, targetCompanyId]);
      if (checkAccess.rows.length === 0) return res.status(403).json({ error: 'Từ chối quyền truy xuất danh mục vật tư!' });
    }

    const items = await pool.query(
      'SELECT code, name, unit, company_id FROM items WHERE company_id = $1 ORDER BY code', 
      [targetCompanyId]
    );
    res.json(items.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. THÊM MỚI VẬT TƯ (GIỮ NGUYÊN)
app.post('/api/items', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const { code, name, unit, companyId } = req.body;
    const targetCompanyId = companyId;

    if (!code || !name || !unit) return res.status(400).json({ error: 'Thiếu mã, tên hoặc đơn vị tính.' });
    if (!targetCompanyId) return res.status(400).json({ error: 'Không xác định được doanh nghiệp cần khai báo vật tư!' });

    if (req.user.role !== 'admin') {
      const checkAccess = await pool.query('SELECT 1 FROM user_companies WHERE user_id = $1 AND company_id = $2', [req.user.id, targetCompanyId]);
      if (checkAccess.rows.length === 0) return res.status(403).json({ error: 'Bạn không có quyền khai báo danh mục cho đơn vị này!' });
    }

    await pool.query(
      'INSERT INTO items (code, name, unit, company_id, created_by) VALUES ($1, $2, $3, $4, $5)',
      [code.toUpperCase().trim(), name.trim(), unit.trim(), targetCompanyId, req.user.id]
    );
    res.status(201).json({ success: true, message: 'Đã lưu vật tư/sản phẩm mới.' });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Mã vật tư này đã được đăng ký tại doanh nghiệp hiện tại!' });
    res.status(500).json({ error: err.message });
  }
});

// 3. XÓA VẬT TƯ (GIỮ NGUYÊN)
app.delete('/api/items/:code', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const { code } = req.params;
    const targetCompanyId = req.query.company_id;
    
    if (!targetCompanyId) return res.status(400).json({ error: 'Thiếu tham số xác định doanh nghiệp cần xóa!' });

    if (req.user.role !== 'admin') {
      const checkAccess = await pool.query('SELECT 1 FROM user_companies WHERE user_id = $1 AND company_id = $2', [req.user.id, targetCompanyId]);
      if (checkAccess.rows.length === 0) return res.status(403).json({ error: 'Quyền thao tác danh mục bị chặn!' });
    }

    const result = await pool.query(
      'DELETE FROM items WHERE code = $1 AND company_id = $2 RETURNING code', 
      [code, targetCompanyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Vật tư không tìm thấy hoặc không thuộc quyền quản lý của đơn vị.' });
    res.json({ success: true, message: 'Đã xóa vật tư thành công khỏi danh mục.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. CẬP NHẬT THÔNG TIN VẬT TƯ (GIỮ NGUYÊN)
app.put('/api/items/:code', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const { code } = req.params;
    const { name, unit, companyId } = req.body;
    const targetCompanyId = companyId;

    if (!name || !unit) return res.status(400).json({ error: 'Thiếu tên hoặc đơn vị tính mới.' });
    if (!targetCompanyId) return res.status(400).json({ error: 'Thiếu thông tin xác định doanh nghiệp cần cập nhật!' });

    if (req.user.role !== 'admin') {
      const checkAccess = await pool.query('SELECT 1 FROM user_companies WHERE user_id = $1 AND company_id = $2', [req.user.id, targetCompanyId]);
      if (checkAccess.rows.length === 0) return res.status(403).json({ error: 'Quyền chỉnh sửa danh mục tại đơn vị này bị chặn!' });
    }

    const result = await pool.query(
      'UPDATE items SET name = $1, unit = $2 WHERE code = $3 AND company_id = $4 RETURNING code',
      [name.trim(), unit.trim(), code, targetCompanyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Vật tư không tìm thấy hoặc không thuộc quyền quản lý của đơn vị.' });
    res.json({ success: true, message: 'Cập nhật thông tin vật tư thành công.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// --- HEALTH CHECK SYSTEM ---
// ==========================================
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', message: 'Backend chạy tốt' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Lỗi kết nối cơ sở dữ liệu' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Máy chủ Kế toán bảo mật đang chạy tại cổng ${PORT}`));