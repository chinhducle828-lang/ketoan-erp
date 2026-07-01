import express from 'express';
import cors from 'cors';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

dotenv.config();
const app = express();
// CORS configuration: allow explicit frontend origins via FRONTEND_URL env (comma-separated)
const rawFrontend = process.env.FRONTEND_URL || '';
const allowedOrigins = rawFrontend.split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    // allow server-to-server or tools without origin
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS policy: origin not allowed'));
  },
  credentials: true,
}));
app.use(express.json());

const REFRESH_TOKEN_EXPIRE_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRE_DAYS) || 30;
const REFRESH_COOKIE_NAME = 'refresh_token';
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
  maxAge: REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000,
};

const parseCookies = (cookieHeader = '') => {
  return cookieHeader.split(';').reduce((acc, cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    if (!name) return acc;
    acc[name] = rest.join('=');
    return acc;
  }, {});
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const createRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const normalizeCompanyIds = (value) => {
  if (Array.isArray(value)) {
    return value
      .filter((id) => id !== null && id !== undefined && id !== '')
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
  }

  if (value === null || value === undefined || value === '') {
    return [];
  }

  return [Number(value)].filter((id) => Number.isInteger(id) && id > 0);
};

const syncUserCompanyLinks = async (userId, companyIds) => {
  const normalized = normalizeCompanyIds(companyIds);
  await pool.query('DELETE FROM user_companies WHERE user_id = $1', [userId]);

  if (normalized.length > 0) {
    for (const companyId of normalized) {
      await pool.query(
        'INSERT INTO user_companies (user_id, company_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, companyId]
      );
    }
  }

  return normalized;
};

const canAccessCompany = async (user, companyId) => {
  if (!companyId) return false;
  if (user.role === 'admin') return true;

  const result = await pool.query(
    'SELECT 1 FROM user_companies WHERE user_id = $1 AND company_id = $2 LIMIT 1',
    [user.id, companyId]
  );

  return result.rows.length > 0;
};

const getCompanyIdsForUser = async (user) => {
  if (user.role === 'admin') return [];

  const result = await pool.query(
    'SELECT company_id FROM user_companies WHERE user_id = $1 ORDER BY company_id',
    [user.id]
  );

  return result.rows.map((row) => Number(row.company_id));
};

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
    
    // Đồng bộ cấu trúc phụ trợ cho bộ ô tích phân quyền đa năng
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS company_ids INTEGER[] DEFAULT '{}'`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_ids INTEGER[] DEFAULT '{}'`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb`);
    await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS refresh_token TEXT`);
    
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

    // 5. Khởi tạo bảng Vouchers (Nhật ký chứng từ hạch toán) chuẩn Thông tư 200
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vouchers (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        voucher_date DATE NOT NULL,
        description TEXT NOT NULL,
        account_dr VARCHAR(50) NOT NULL,
        account_cr VARCHAR(50) NOT NULL,
        amount DECIMAL(18, 2) NOT NULL,
        voucher_type VARCHAR(50) NOT NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // 6. Khởi tạo bảng Số dư đầu kỳ opening_balances hạch toán kép
    await pool.query(`
      CREATE TABLE IF NOT EXISTS opening_balances (
        company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        account_code VARCHAR(50) NOT NULL,
        debit_balance DECIMAL(18, 2) DEFAULT 0.00,
        credit_balance DECIMAL(18, 2) DEFAULT 0.00,
        fiscal_year INTEGER NOT NULL,
        PRIMARY KEY (company_id, account_code, fiscal_year)
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

// Đăng ký tài khoản Admin hệ thống gốc
app.post('/api/auth/register-admin', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const checkAdmin = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    if (checkAdmin.rows.length > 0) {
      return res.status(400).json({ error: 'Hệ thống đã có tài khoản quản trị viên!' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, password, role, company_ids, staff_ids) VALUES ($1, $2, $3, '{}', '{}') RETURNING id, username, role",
      [username, hashed, 'admin']
    );
    res.json({ success: true, user: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Đăng nhập hệ thống (ĐỒNG BỘ ĐỌC TRỰC TIẾP TỪ TRƯỜNG COMPANY_IDS ĐỂ TRÁNH ĐƠ HEADER)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Tài khoản không tồn tại!' });
    
    const user = result.rows[0];
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: 'Mật khẩu không chính xác!' });
    }
    
    const companyIds = user.role === 'admin'
      ? []
      : await syncUserCompanyLinks(user.id, user.company_ids || []);

    await pool.query('UPDATE users SET company_ids = $1 WHERE id = $2', [companyIds, user.id]);
    
    const accessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role, company_ids: companyIds }, 
      process.env.JWT_SECRET, 
      { expiresIn: '15m' }
    );

    const refreshToken = createRefreshToken();
    const hashedRefresh = hashToken(refreshToken);
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000);

    try {
      await pool.query('DELETE FROM sessions WHERE user_id = $1', [user.id]);
      await pool.query(
        'INSERT INTO sessions (user_id, token, refresh_token, created_at, expires_at, ip_address, device_info) VALUES ($1, $2, $3, now(), $4, $5, $6)', 
        [user.id, accessToken, hashedRefresh, refreshExpiresAt.toISOString(), req.ip, req.headers['user-agent'] || null]
      );
    } catch (err) {
      console.error('Không thể lưu session:', err.message);
    }

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions);
    res.json({ 
      accessToken, 
      user: { id: user.id, username: user.username, role: user.role, company_ids: companyIds },
      must_change_password: !!user.must_change_password
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// API lưu/lấy tùy chỉnh người dùng (đồng bộ đa thiết bị)
app.get('/api/auth/preferences', authenticate, async (req, res) => {
  try {
    const q = await pool.query('SELECT preferences FROM users WHERE id = $1', [req.user.id]);
    if (q.rows.length === 0) return res.json({});
    const prefs = q.rows[0].preferences || {};
    res.json(typeof prefs === 'string' ? JSON.parse(prefs) : prefs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/auth/preferences', authenticate, async (req, res) => {
  try {
    const prefs = req.body;
    await pool.query('UPDATE users SET preferences = $1 WHERE id = $2', [JSON.stringify(prefs), req.user.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie || '');
    const refreshToken = cookies[REFRESH_COOKIE_NAME];
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token không tồn tại.' });

    const hashedRefresh = hashToken(refreshToken);
    const session = await pool.query(
      'SELECT s.*, u.username, u.role, u.company_ids, u.must_change_password FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.refresh_token = $1 AND s.expires_at > now() LIMIT 1',
      [hashedRefresh]
    );

    if (session.rows.length === 0) {
      return res.status(401).json({ error: 'Refresh token không hợp lệ hoặc đã hết hạn.' });
    }

    const current = session.rows[0];
    const accessToken = jwt.sign(
      { id: current.user_id, username: current.username, role: current.role, company_ids: current.company_ids },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const newRefreshToken = createRefreshToken();
    const newHashedRefresh = hashToken(newRefreshToken);
    const newRefreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000);

    await pool.query(
      'UPDATE sessions SET token = $1, refresh_token = $2, expires_at = $3, ip_address = $4, device_info = $5 WHERE id = $6',
      [accessToken, newHashedRefresh, newRefreshExpiresAt.toISOString(), req.ip, req.headers['user-agent'] || null, current.id]
    );

    res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, cookieOptions);
    res.json({
      accessToken,
      user: { id: current.user_id, username: current.username, role: current.role, company_ids: current.company_ids },
      must_change_password: !!current.must_change_password
    });
  } catch (err) {
    console.error('Lỗi refresh token:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Đăng xuất
app.post('/api/auth/logout', authenticate, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(400).json({ error: 'Thiếu token.' });
    await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions);
    res.json({ success: true, message: 'Đăng xuất thành công.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Thay đổi mật khẩu
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

// Admin Reset Mật khẩu cho nhân viên
app.post('/api/auth/admin-reset-password', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Thiếu định danh nhân sự.' });
    
    const targetUser = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
    if (targetUser.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy tài khoản!' });

    // BẢO VỆ TUYỆT ĐỐI TÀI KHOẢN MASTER GỐC: Cấm tương tác ngược
    if (targetUser.rows[0].username === 'admin') {
      return res.status(400).json({ error: 'Cấm tuyệt đối tương tác hoặc thay đổi vai trò của tài khoản gốc!' });
    }

    const temp = Math.random().toString(36).slice(-8) + 'A1!';
    const hashed = await bcrypt.hash(temp, 10);
    await pool.query('UPDATE users SET password = $1, must_change_password = true WHERE id = $2', [hashed, userId]);
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    res.json({ success: true, tempPassword: temp, message: 'Đã reset mật khẩu thành công.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Lấy danh sách người dùng (SỬA ĐỂ TRẢ VỀ DỮ LIỆU ĐỒNG BỘ 100% THEO ĐÚNG TRƯỜNG CỦA TAB Ô TÍCH)
app.get('/api/users', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await pool.query(`
        SELECT id, username, role, manager_id,
               COALESCE(company_ids, '{}') as company_ids,
               COALESCE(staff_ids, '{}') as staff_ids,
               CASE WHEN array_length(COALESCE(company_ids, '{}'), 1) IS NULL THEN NULL ELSE COALESCE(company_ids, '{}')[1] END as company_id
        FROM users 
        ORDER BY id DESC
      `);
    } else {
      result = await pool.query(`
        SELECT id, username, role, manager_id,
               COALESCE(company_ids, '{}') as company_ids,
               CASE WHEN array_length(COALESCE(company_ids, '{}'), 1) IS NULL THEN NULL ELSE COALESCE(company_ids, '{}')[1] END as company_id
        FROM users 
        WHERE manager_id = $1 AND role = 'nv'
        ORDER BY username ASC
      `, [req.user.id]);
    }
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Khai báo nhân sự mới từ Admin Form
app.post('/api/users', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { username, password, role, companyIds, companyId, managerId } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ tài khoản, mật khẩu và vai trò!' });
    }

    const userExist = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ error: 'Tên tài khoản này đã tồn tại trên hệ thống!' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const normalizedCompanyIds = role === 'admin' ? [] : normalizeCompanyIds(companyIds ?? companyId);
    const finalManagerId = role === 'nv' ? (managerId || null) : null;

    if (finalManagerId) {
      const managerRes = await pool.query('SELECT role FROM users WHERE id = $1', [finalManagerId]);
      if (managerRes.rows.length === 0 || managerRes.rows[0].role !== 'ktt') {
        return res.status(400).json({ error: 'KTT quản lý không hợp lệ!' });
      }

      const countRes = await pool.query(
        "SELECT COUNT(*) FROM users WHERE manager_id = $1 AND role = 'nv'",
        [finalManagerId]
      );
      if (parseInt(countRes.rows[0].count, 10) >= 15) {
        return res.status(400).json({ error: 'Kế toán trưởng này đã quản lý đủ tối đa 15 nhân viên!' });
      }
    }

    const result = await pool.query(
      "INSERT INTO users (username, password, role, must_change_password, company_ids, staff_ids, manager_id) VALUES ($1, $2, $3, $4, $5, '{}', $6) RETURNING id, username, role, manager_id, company_ids",
      [username, hashed, role, true, normalizedCompanyIds, finalManagerId]
    );

    if (result.rows[0] && normalizedCompanyIds.length > 0) {
      await syncUserCompanyLinks(result.rows[0].id, normalizedCompanyIds);
    }

    if (finalManagerId) {
      const staffRes = await pool.query(
        "SELECT id FROM users WHERE manager_id = $1 AND role = 'nv' ORDER BY id DESC",
        [finalManagerId]
      );
      const currentStaffIds = staffRes.rows.map((row) => row.id);
      await pool.query('UPDATE users SET staff_ids = $1 WHERE id = $2', [currentStaffIds, finalManagerId]);
    }

    res.status(201).json({ success: true, message: 'Thêm nhân sự mới thành công!', user: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Xóa nhân sự (Bảo vệ tuyệt đối Root)
app.delete('/api/users/:id', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const userId = req.params.id;
    if (parseInt(userId, 10) === req.user.id) {
      return res.status(400).json({ error: 'Bạn không thể tự xóa tài khoản chính mình!' });
    }

    const targetUser = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
    if (targetUser.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy tài khoản nhân sự!' });

    // BẢO VỆ BẤT TỬ ADMIN GỐC
    if (targetUser.rows[0].username === 'admin') {
      return res.status(400).json({ error: 'Tài khoản Root hệ thống là bất tử, không thể xóa!' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    res.json({ success: true, message: 'Đã xóa nhân sự khỏi hệ thống thành công!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// --- API PHÂN QUYỀN ĐỒNG BỘ HAI CHIỀU MỚI ---
// ==========================================

// 1. KẾ TOÁN TRƯỞNG TÍCH CHỌN QUẢN LÝ NHIỀU NHÂN VIÊN (ĐỒNG BỘ HAI CHIỀU)
app.post('/api/auth/assign-staff', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { managerId, staffIds } = req.body; 

    if (!managerId) return res.status(400).json({ error: 'Thiếu thông tin Kế toán trưởng!' });
    if (!Array.isArray(staffIds)) return res.status(400).json({ error: 'Danh sách nhân viên phải là một mảng!' });

    if (staffIds.length > 15) {
      return res.status(400).json({ error: 'Một Kế toán trưởng chỉ được quản lý tối đa 15 nhân viên!' });
    }

    const checkManager = await pool.query('SELECT role FROM users WHERE id = $1', [managerId]);
    if (checkManager.rows.length === 0 || checkManager.rows[0].role !== 'ktt') {
      return res.status(400).json({ error: 'Tài khoản nhận quản lý không phải là Kế toán trưởng!' });
    }

    await pool.query('BEGIN');

    // Bỏ manager_id cũ của những nhân sự từng trực thuộc KTT này
    await pool.query("UPDATE users SET manager_id = NULL WHERE manager_id = $1 AND role = 'nv'", [managerId]);

    // Gán manager_id mới cho các nhân sự được tích chọn
    if (staffIds.length > 0) {
      await pool.query(
        "UPDATE users SET manager_id = $1 WHERE id = ANY($2) AND role = 'nv'",
        [managerId, staffIds]
      );
    }

    // CẬP NHẬT TRỰC TIẾP TRƯỜNG staff_ids TRÊN TÀI KHOẢN KTT ĐỂ ĐỒNG BỘ TAB PHÂN QUYỀN
    await pool.query('UPDATE users SET staff_ids = $1 WHERE id = $2', [staffIds, managerId]);

    await pool.query('COMMIT');
    res.json({ success: true, message: 'Cập nhật danh sách nhân viên cho Kế toán trưởng thành công!' });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// 2. CHỈ ĐỊNH NHÂN VIÊN VÀO NHIỀU CÔNG TY & CHỌN KTT PHỤ TRÁCH (ĐỒNG BỘ HAI CHIỀU)
app.post('/api/auth/assign-company', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { userId, companyIds, companyId, role, managerId } = req.body;

    const targetUser = await pool.query('SELECT role, username FROM users WHERE id = $1', [userId]);
    if (targetUser.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy người dùng!' });
    
    if (targetUser.rows[0].username === 'admin') {
      return res.status(400).json({ error: 'Cấm tuyệt đối hành vi tương tác hoặc thay đổi vai trò của tài khoản Root hệ thống!' });
    }

    const userRole = role || 'nv';
    const finalManagerId = userRole === 'nv' ? (managerId || null) : null;
    const normalizedCompanyIds = userRole === 'admin' ? [] : normalizeCompanyIds(companyIds ?? companyId);

    if (finalManagerId) {
      const countRes = await pool.query(
        "SELECT COUNT(*) FROM users WHERE manager_id = $1 AND role = 'nv' AND id != $2",
        [finalManagerId, userId]
      );
      if (parseInt(countRes.rows[0].count, 10) >= 15) {
        return res.status(400).json({ error: 'Kế toán trưởng phụ trách được chọn đã quản lý đủ tối đa 15 nhân viên!' });
      }
    }

    await pool.query('BEGIN');

    await pool.query(
      'UPDATE users SET role = $1, manager_id = $2, company_ids = $3 WHERE id = $4',
      [userRole, finalManagerId, normalizedCompanyIds, userId]
    );

    await syncUserCompanyLinks(userId, normalizedCompanyIds);

    const kttList = await pool.query("SELECT id FROM users WHERE role = 'ktt'");
    for (const ktt of kttList.rows) {
      const staffRes = await pool.query(
        "SELECT id FROM users WHERE manager_id = $1 AND role = 'nv' ORDER BY id DESC",
        [ktt.id]
      );
      const currentStaffIds = staffRes.rows.map((row) => row.id);
      await pool.query('UPDATE users SET staff_ids = $1 WHERE id = $2', [currentStaffIds, ktt.id]);
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

// Thêm mới công ty
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

// Lấy danh sách công ty (ĐỌC ĐỒNG BỘ ĐA PHƯƠNG THỨC)
app.get('/api/companies', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const result = await pool.query('SELECT * FROM companies ORDER BY id DESC');
      return res.json(result.rows);
    }

    const companyIds = await getCompanyIdsForUser(req.user);
    if (companyIds.length === 0) {
      return res.json([]);
    }

    const result = await pool.query(
      'SELECT * FROM companies WHERE id = ANY($1) ORDER BY id DESC',
      [companyIds]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Xóa công ty
app.delete('/api/companies/:id', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const companyId = req.params.id;
    
    const checkUsers = await pool.query('SELECT user_id FROM user_companies WHERE company_id = $1 LIMIT 1', [companyId]);
    if (checkUsers.rows.length > 0) {
      return res.status(400).json({ error: 'Không thể xóa công ty vì còn nhân viên đang được gán quyền làm việc!' });
    }

    await pool.query('DELETE FROM companies WHERE id = $1', [companyId]);
    res.json({ success: true, message: 'Đã xóa công ty thành công!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Export a single company's data (items, vouchers, opening_balances)
app.get('/api/companies/:id/export', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const companyId = Number(req.params.id);
    const comp = await pool.query('SELECT * FROM companies WHERE id = $1', [companyId]);
    if (comp.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy công ty.' });

    const items = await pool.query('SELECT code, name, unit, company_id FROM items WHERE company_id = $1 ORDER BY code', [companyId]);
    const vouchers = await pool.query('SELECT id, company_id, voucher_date, description, account_dr, account_cr, amount, voucher_type, created_by, created_at FROM vouchers WHERE company_id = $1 ORDER BY id', [companyId]);
    const opening = await pool.query('SELECT account_code, debit_balance, credit_balance, fiscal_year FROM opening_balances WHERE company_id = $1 ORDER BY account_code', [companyId]);

    res.json({
      company: comp.rows[0],
      items: items.rows,
      vouchers: vouchers.rows,
      opening_balances: opening.rows
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Import data for a company (admin only). The payload should include arrays for items, vouchers, opening_balances.
app.post('/api/companies/:id/import', authenticate, requireRole(['admin']), async (req, res) => {
  const companyId = Number(req.params.id);
  const { items = [], vouchers = [], opening_balances = [] } = req.body || {};
  try {
    await pool.query('BEGIN');

    // Upsert items (code, company_id)
    for (const it of items) {
      await pool.query(
        'INSERT INTO items (code, name, unit, company_id, created_by, created_at) VALUES ($1, $2, $3, $4, $5, COALESCE($6, now())) ON CONFLICT (code, company_id) DO UPDATE SET name = EXCLUDED.name, unit = EXCLUDED.unit',
        [it.code, it.name, it.unit, companyId, req.user.id, it.created_at || null]
      );
    }

    // Insert opening balances (upsert)
    for (const ob of opening_balances) {
      await pool.query(
        `INSERT INTO opening_balances (company_id, account_code, debit_balance, credit_balance, fiscal_year)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (company_id, account_code, fiscal_year) DO UPDATE SET debit_balance = EXCLUDED.debit_balance, credit_balance = EXCLUDED.credit_balance`,
        [companyId, ob.account_code, ob.debit_balance || 0, ob.credit_balance || 0, ob.fiscal_year || 2026]
      );
    }

    // Insert vouchers: avoid importing IDs to prevent conflicts; created_by set to null
    for (const v of vouchers) {
      await pool.query(
        `INSERT INTO vouchers (company_id, voucher_date, description, account_dr, account_cr, amount, voucher_type, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, COALESCE($8, now()))`,
        [companyId, v.voucher_date, v.description, v.account_dr, v.account_cr, v.amount, v.voucher_type, v.created_at || null]
      );
    }

    await pool.query('COMMIT');
    res.json({ success: true, message: 'Import dữ liệu công ty thành công.' });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// --- API NGHIỆP VỤ HẠCH TOÁN ĐA DOANH NGHIỆP ---
// ==========================================

app.get('/api/vouchers', authenticate, async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id; 
    const year = req.query.year ? Number(req.query.year) : 2026;

    if (!targetCompanyId) return res.json([]);

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Bạn không có quyền truy cập dữ liệu của doanh nghiệp này!' });
    }

    const result = await pool.query(
      `SELECT id, company_id as "companyId", voucher_date as "voucherDate", description, account_dr as "accountDr", account_cr as "accountCr", amount, voucher_type as "type" FROM vouchers 
       WHERE company_id = $1 
         AND EXTRACT(YEAR FROM voucher_date) = $2 
       ORDER BY voucher_date DESC, id DESC`, 
      [targetCompanyId, year]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/vouchers', authenticate, async (req, res) => {
  try {
    const { voucherDate, description, accountDr, accountCr, amount, type, companyId } = req.body;
    const targetCompanyId = companyId;
    
    if (!targetCompanyId) return res.status(400).json({ error: 'Vui lòng xác định rõ doanh nghiệp cần ghi sổ!' });

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Bạn không có quyền ghi sổ tại doanh nghiệp này!' });
    }

    const result = await pool.query(
      `INSERT INTO vouchers (company_id, voucher_date, description, account_dr, account_cr, amount, voucher_type, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, company_id as "companyId", voucher_date as "voucherDate", description, account_dr as "accountDr", account_cr as "accountCr", amount, voucher_type as "type"`,
      [targetCompanyId, voucherDate, description, accountDr, accountCr, amount, type, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/vouchers/:id', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id;
    if (!targetCompanyId) return res.status(400).json({ error: 'Thiếu mã đơn vị cần xóa dữ liệu!' });

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Bạn không có quyền thao tác trên dữ liệu doanh nghiệp này!' });
      await pool.query('DELETE FROM vouchers WHERE id = $1 AND company_id = $2', [req.params.id, targetCompanyId]);
    } else {
      await pool.query('DELETE FROM vouchers WHERE id = $1', [req.params.id]);
    }
    res.json({ success: true, message: 'Xóa chứng từ thành công!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/opening-balances', authenticate, async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id;
    const year = req.query.year ? Number(req.query.year) : 2026;

    if (!targetCompanyId) return res.json([]);

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Quyền truy cập số dư bị từ chối!' });
    }

    const result = await pool.query(
      'SELECT * FROM opening_balances WHERE company_id = $1 AND fiscal_year = $2 ORDER BY account_code ASC', 
      [targetCompanyId, year]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/opening-balances', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const { balances, year, companyId } = req.body;
    const targetCompanyId = companyId;
    const finalYear = year ? Number(year) : 2026;

    if (!targetCompanyId) return res.status(400).json({ error: 'Thông tin công ty không hợp lệ!' });
    if (!balances) return res.status(400).json({ error: 'Dữ liệu số dư trống!' });

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa số dư tại doanh nghiệp này!' });
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

app.get('/api/items', authenticate, async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id;
    if (!targetCompanyId) return res.json([]);

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Từ chối quyền truy xuất danh mục vật tư!' });
    }

    const items = await pool.query(
      'SELECT code, name, unit, company_id FROM items WHERE company_id = $1 ORDER BY code', 
      [targetCompanyId]
    );
    res.json(items.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/items', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const { code, name, unit, companyId } = req.body;
    const targetCompanyId = companyId;

    if (!code || !name || !unit) return res.status(400).json({ error: 'Thiếu mã, tên hoặc đơn vị tính.' });
    if (!targetCompanyId) return res.status(400).json({ error: 'Không xác định được doanh nghiệp cần khai báo vật tư!' });

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Bạn không có quyền khai báo danh mục cho đơn vị này!' });
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

app.delete('/api/items/:code', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const { code } = req.params;
    const targetCompanyId = req.query.company_id;
    
    if (!targetCompanyId) return res.status(400).json({ error: 'Thiếu tham số xác định doanh nghiệp cần xóa!' });

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Quyền thao tác danh mục bị chặn!' });
    }

    const result = await pool.query(
      'DELETE FROM items WHERE code = $1 AND company_id = $2 RETURNING code', 
      [code, targetCompanyId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Vật tư không tìm thấy hoặc không thuộc quyền quản lý của đơn vị.' });
    res.json({ success: true, message: 'Đã xóa vật tư thành công khỏi danh mục.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/items/:code', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const { code } = req.params;
    const { name, unit, companyId } = req.body;
    const targetCompanyId = companyId;

    if (!name || !unit) return res.status(400).json({ error: 'Thiếu tên hoặc đơn vị tính mới.' });
    if (!targetCompanyId) return res.status(400).json({ error: 'Thiếu thông tin xác định doanh nghiệp cần cập nhật!' });

    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Quyền chỉnh sửa danh mục tại đơn vị này bị chặn!' });
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
// --- API DASHBOARD DÒNG TIỀN ---
// ==========================================
app.get('/api/dashboard/cashflow', authenticate, async (req, res) => {
  try {
    const targetCompanyId = req.query.company_id;
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    if (!targetCompanyId) return res.json([]);
    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, targetCompanyId);
      if (!hasAccess) return res.status(403).json({ error: 'Không có quyền truy cập!' });
    }

    // Thống kê thu/chi theo tháng
    const monthly = await pool.query(`
      SELECT 
        EXTRACT(MONTH FROM voucher_date)::int AS month,
        SUM(CASE WHEN voucher_type IN ('Thu','Nhap') THEN amount ELSE 0 END) AS thu,
        SUM(CASE WHEN voucher_type IN ('Chi','Xuat') THEN amount ELSE 0 END) AS chi
      FROM vouchers
      WHERE company_id = $1 AND EXTRACT(YEAR FROM voucher_date) = $2
      GROUP BY month
      ORDER BY month
    `, [targetCompanyId, year]);

    // Tổng số dư tiền mặt (1111, 1121)
    const cashBalances = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN account_dr IN ('1111','1121') THEN amount ELSE 0 END), 0) AS tong_thu_tien,
        COALESCE(SUM(CASE WHEN account_cr IN ('1111','1121') THEN amount ELSE 0 END), 0) AS tong_chi_tien
      FROM vouchers
      WHERE company_id = $1 AND EXTRACT(YEAR FROM voucher_date) = $2
    `, [targetCompanyId, year]);

    // Danh sách giao dịch gần đây nhất (10 cái)
    const recent = await pool.query(`
      SELECT id, voucher_date, description, account_dr, account_cr, amount, voucher_type
      FROM vouchers
      WHERE company_id = $1 AND EXTRACT(YEAR FROM voucher_date) = $2
      ORDER BY voucher_date DESC, id DESC
      LIMIT 10
    `, [targetCompanyId, year]);

    res.json({
      monthly: monthly.rows,
      summary: cashBalances.rows[0],
      recent: recent.rows
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// --- API XUẤT EXCEL THEO TỪNG MODULE ---
// ==========================================

const styleHeader = (ws) => {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E40AF' } };
  row.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
};

const addRows = (ws, rows) => {
  rows.forEach(r => {
    const row = ws.addRow(r);
    row.eachCell(cell => { cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; });
    row.alignment = { vertical: 'middle' };
  });
};

// 1. Xuất Sổ Nhật ký chung (Vouchers)
app.get('/api/export/vouchers', authenticate, async (req, res) => {
  try {
    const { company_id, year } = req.query;
    if (!company_id) return res.status(400).json({ error: 'Thiếu company_id' });
    if (req.user.role !== 'admin' && !(await canAccessCompany(req.user, company_id))) return res.status(403).json({ error: 'Không có quyền!' });

    const result = await pool.query(
      `SELECT voucher_date, id, description, account_dr, account_cr, amount, voucher_type FROM vouchers WHERE company_id = $1 AND EXTRACT(YEAR FROM voucher_date) = $2 ORDER BY voucher_date, id`,
      [company_id, year || 2026]
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('So_Nhat_Ky_Chung');
    ws.columns = [
      { header: 'Ngày', key: 'date', width: 14 },
      { header: 'Số CT', key: 'id', width: 8 },
      { header: 'Diễn giải', key: 'desc', width: 45 },
      { header: 'TK Nợ', key: 'dr', width: 10 },
      { header: 'TK Có', key: 'cr', width: 10 },
      { header: 'Số tiền', key: 'amount', width: 18, style: { numFmt: '#,##0' } },
      { header: 'Loại', key: 'type', width: 10 },
    ];
    styleHeader(ws);
    addRows(ws, result.rows.map(v => ({
      date: v.voucher_date?.slice(0, 10), id: v.id, desc: v.description,
      dr: v.account_dr, cr: v.account_cr, amount: Number(v.amount), type: v.voucher_type
    })));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=So_Nhat_Ky_Chung_${company_id}_${year || 2026}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Xuất Sổ Quỹ tiền mặt
app.get('/api/export/cashbook', authenticate, async (req, res) => {
  try {
    const { company_id, year } = req.query;
    if (!company_id) return res.status(400).json({ error: 'Thiếu company_id' });
    if (req.user.role !== 'admin' && !(await canAccessCompany(req.user, company_id))) return res.status(403).json({ error: 'Không có quyền!' });

    const result = await pool.query(
      `SELECT voucher_date, description, 
              CASE WHEN account_dr IN ('1111','1121') THEN amount ELSE 0 END AS thu,
              CASE WHEN account_cr IN ('1111','1121') THEN amount ELSE 0 END AS chi
       FROM vouchers WHERE company_id = $1 AND EXTRACT(YEAR FROM voucher_date) = $2
       ORDER BY voucher_date, id`,
      [company_id, year || 2026]
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('So_Quy_Tien_Mat');
    ws.columns = [
      { header: 'Ngày', key: 'date', width: 14 },
      { header: 'Diễn giải', key: 'desc', width: 45 },
      { header: 'Thu', key: 'thu', width: 18, style: { numFmt: '#,##0' } },
      { header: 'Chi', key: 'chi', width: 18, style: { numFmt: '#,##0' } },
    ];
    styleHeader(ws);
    addRows(ws, result.rows.map(v => ({
      date: v.voucher_date?.slice(0, 10), desc: v.description,
      thu: Number(v.thu), chi: Number(v.chi)
    })));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=So_Quy_${company_id}_${year || 2026}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Xuất Danh mục vật tư
app.get('/api/export/items', authenticate, async (req, res) => {
  try {
    const { company_id } = req.query;
    if (!company_id) return res.status(400).json({ error: 'Thiếu company_id' });
    if (req.user.role !== 'admin' && !(await canAccessCompany(req.user, company_id))) return res.status(403).json({ error: 'Không có quyền!' });

    const result = await pool.query('SELECT code, name, unit FROM items WHERE company_id = $1 ORDER BY code', [company_id]);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Danh_Muc_Vat_Tu');
    ws.columns = [
      { header: 'Mã hàng', key: 'code', width: 15 },
      { header: 'Tên hàng', key: 'name', width: 40 },
      { header: 'ĐVT', key: 'unit', width: 10 },
    ];
    styleHeader(ws);
    addRows(ws, result.rows);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Danh_Muc_Vat_Tu_${company_id}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. Xuất Số dư đầu kỳ
app.get('/api/export/opening-balances', authenticate, async (req, res) => {
  try {
    const { company_id, year } = req.query;
    if (!company_id) return res.status(400).json({ error: 'Thiếu company_id' });
    if (req.user.role !== 'admin' && !(await canAccessCompany(req.user, company_id))) return res.status(403).json({ error: 'Không có quyền!' });

    const result = await pool.query(
      'SELECT account_code, debit_balance, credit_balance FROM opening_balances WHERE company_id = $1 AND fiscal_year = $2 ORDER BY account_code',
      [company_id, year || 2026]
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('So_Du_Dau_Ky');
    ws.columns = [
      { header: 'Mã TK', key: 'code', width: 12 },
      { header: 'Dư Nợ đầu kỳ', key: 'dr', width: 20, style: { numFmt: '#,##0' } },
      { header: 'Dư Có đầu kỳ', key: 'cr', width: 20, style: { numFmt: '#,##0' } },
    ];
    styleHeader(ws);
    addRows(ws, result.rows.map(r => ({ code: r.account_code, dr: Number(r.debit_balance), cr: Number(r.credit_balance) })));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=So_Du_Dau_Ky_${company_id}_${year || 2026}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. Xuất Danh sách nhân sự
app.get('/api/export/users', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.role, u.manager_id,
             COALESCE(array_agg(c.name) FILTER (WHERE c.name IS NOT NULL), '{}') as companies
      FROM users u
      LEFT JOIN user_companies uc ON uc.user_id = u.id
      LEFT JOIN companies c ON c.id = uc.company_id
      GROUP BY u.id
      ORDER BY u.id
    `);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Nhan_Su_He_Thong');
    ws.columns = [
      { header: 'ID', key: 'id', width: 6 },
      { header: 'Tên đăng nhập', key: 'username', width: 20 },
      { header: 'Vai trò', key: 'role', width: 10 },
      { header: 'Công ty được gán', key: 'companies', width: 40 },
      { header: 'KTT quản lý', key: 'manager', width: 20 },
    ];
    styleHeader(ws);
    addRows(ws, result.rows.map(r => ({
      id: r.id, username: r.username, role: r.role,
      companies: Array.isArray(r.companies) ? r.companies.join(', ') : '',
      manager: r.manager_id ? result.rows.find(u => u.id === r.manager_id)?.username || '' : ''
    })));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Nhan_Su_He_Thong.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 6. Xuất báo cáo Tài sản cố định (211)
app.get('/api/export/fixed-assets', authenticate, async (req, res) => {
  try {
    const { company_id, year } = req.query;
    if (!company_id) return res.status(400).json({ error: 'Thiếu company_id' });
    if (req.user.role !== 'admin' && !(await canAccessCompany(req.user, company_id))) return res.status(403).json({ error: 'Không có quyền!' });

    const result = await pool.query(
      `SELECT voucher_date, description, amount, account_dr, account_cr, voucher_type 
       FROM vouchers 
       WHERE company_id = $1 
         AND EXTRACT(YEAR FROM voucher_date) = $2
         AND (account_dr = '211' OR account_cr = '211')
       ORDER BY voucher_date, id`,
      [company_id, year || 2026]
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Tai_San_Co_Dinh');
    ws.columns = [
      { header: 'Ngày', key: 'date', width: 14 },
      { header: 'Diễn giải', key: 'desc', width: 50 },
      { header: 'TK Nợ', key: 'dr', width: 10 },
      { header: 'TK Có', key: 'cr', width: 10 },
      { header: 'Số tiền', key: 'amount', width: 18, style: { numFmt: '#,##0' } },
      { header: 'Loại', key: 'type', width: 10 },
    ];
    styleHeader(ws);
    addRows(ws, result.rows.map(v => ({
      date: v.voucher_date?.slice(0, 10),
      desc: v.description,
      dr: v.account_dr,
      cr: v.account_cr,
      amount: Number(v.amount),
      type: v.voucher_type
    })));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Tai_San_Co_Dinh_${company_id}_${year || 2026}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 7. Xuất báo cáo Chi phí sản xuất (154, 156)
app.get('/api/export/production-costs', authenticate, async (req, res) => {
  try {
    const { company_id, year } = req.query;
    if (!company_id) return res.status(400).json({ error: 'Thiếu company_id' });
    if (req.user.role !== 'admin' && !(await canAccessCompany(req.user, company_id))) return res.status(403).json({ error: 'Không có quyền!' });

    const result = await pool.query(
      `SELECT voucher_date, description, amount, account_dr, account_cr, voucher_type 
       FROM vouchers 
       WHERE company_id = $1 
         AND EXTRACT(YEAR FROM voucher_date) = $2
         AND (account_dr IN ('154', '156') OR account_cr IN ('154', '156'))
       ORDER BY voucher_date, id`,
      [company_id, year || 2026]
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Chi_Phi_San_Xuat');
    ws.columns = [
      { header: 'Ngày', key: 'date', width: 14 },
      { header: 'Diễn giải', key: 'desc', width: 50 },
      { header: 'TK Nợ', key: 'dr', width: 10 },
      { header: 'TK Có', key: 'cr', width: 10 },
      { header: 'Số tiền', key: 'amount', width: 18, style: { numFmt: '#,##0' } },
      { header: 'Loại', key: 'type', width: 10 },
    ];
    styleHeader(ws);
    addRows(ws, result.rows.map(v => ({
      date: v.voucher_date?.slice(0, 10),
      desc: v.description,
      dr: v.account_dr,
      cr: v.account_cr,
      amount: Number(v.amount),
      type: v.voucher_type
    })));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Chi_Phi_San_Xuat_${company_id}_${year || 2026}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 8. Xuất báo cáo Mua hàng & Nhập kho (156, 331, 1331)
app.get('/api/export/purchases', authenticate, async (req, res) => {
  try {
    const { company_id, year } = req.query;
    if (!company_id) return res.status(400).json({ error: 'Thiếu company_id' });
    if (req.user.role !== 'admin' && !(await canAccessCompany(req.user, company_id))) return res.status(403).json({ error: 'Không có quyền!' });

    const result = await pool.query(
      `SELECT voucher_date, description, amount, account_dr, account_cr, voucher_type 
       FROM vouchers 
       WHERE company_id = $1 
         AND EXTRACT(YEAR FROM voucher_date) = $2
         AND (account_dr IN ('156', '331', '1331') OR account_cr IN ('156', '331', '1331'))
       ORDER BY voucher_date, id`,
      [company_id, year || 2026]
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Mua_Hang_Nhap_Kho');
    ws.columns = [
      { header: 'Ngày', key: 'date', width: 14 },
      { header: 'Diễn giải', key: 'desc', width: 50 },
      { header: 'TK Nợ', key: 'dr', width: 10 },
      { header: 'TK Có', key: 'cr', width: 10 },
      { header: 'Số tiền', key: 'amount', width: 18, style: { numFmt: '#,##0' } },
      { header: 'Loại', key: 'type', width: 10 },
    ];
    styleHeader(ws);
    addRows(ws, result.rows.map(v => ({
      date: v.voucher_date?.slice(0, 10),
      desc: v.description,
      dr: v.account_dr,
      cr: v.account_cr,
      amount: Number(v.amount),
      type: v.voucher_type
    })));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Mua_Hang_Nhap_Kho_${company_id}_${year || 2026}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 9. Xuất báo cáo Bảng lương & Bảo hiểm (6422, 3341, 3383)
app.get('/api/export/payroll', authenticate, async (req, res) => {
  try {
    const { company_id, year } = req.query;
    if (!company_id) return res.status(400).json({ error: 'Thiếu company_id' });
    if (req.user.role !== 'admin' && !(await canAccessCompany(req.user, company_id))) return res.status(403).json({ error: 'Không có quyền!' });

    const result = await pool.query(
      `SELECT voucher_date, description, amount, account_dr, account_cr, voucher_type 
       FROM vouchers 
       WHERE company_id = $1 
         AND EXTRACT(YEAR FROM voucher_date) = $2
         AND (account_dr IN ('6422', '3341', '3383') OR account_cr IN ('6422', '3341', '3383'))
       ORDER BY voucher_date, id`,
      [company_id, year || 2026]
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Bang_Luong_Bao_Hiem');
    ws.columns = [
      { header: 'Ngày', key: 'date', width: 14 },
      { header: 'Diễn giải', key: 'desc', width: 50 },
      { header: 'TK Nợ', key: 'dr', width: 10 },
      { header: 'TK Có', key: 'cr', width: 10 },
      { header: 'Số tiền', key: 'amount', width: 18, style: { numFmt: '#,##0' } },
      { header: 'Loại', key: 'type', width: 10 },
    ];
    styleHeader(ws);
    addRows(ws, result.rows.map(v => ({
      date: v.voucher_date?.slice(0, 10),
      desc: v.description,
      dr: v.account_dr,
      cr: v.account_cr,
      amount: Number(v.amount),
      type: v.voucher_type
    })));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Bang_Luong_Bao_Hiem_${company_id}_${year || 2026}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 10. Xuất báo cáo Dòng tiền Dashboard
app.get('/api/export/dashboard', authenticate, async (req, res) => {
  try {
    const { company_id, year } = req.query;
    if (!company_id) return res.status(400).json({ error: 'Thiếu company_id' });
    if (req.user.role !== 'admin' && !(await canAccessCompany(req.user, company_id))) return res.status(403).json({ error: 'Không có quyền!' });

    const monthly = await pool.query(`
      SELECT 
        EXTRACT(MONTH FROM voucher_date)::int AS month,
        SUM(CASE WHEN voucher_type IN ('Thu','Nhap') THEN amount ELSE 0 END) AS thu,
        SUM(CASE WHEN voucher_type IN ('Chi','Xuat') THEN amount ELSE 0 END) AS chi
      FROM vouchers
      WHERE company_id = $1 AND EXTRACT(YEAR FROM voucher_date) = $2
      GROUP BY month
      ORDER BY month
    `, [company_id, year || 2026]);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Dashboard_Duong_Tien');
    ws.columns = [
      { header: 'Tháng', key: 'month', width: 10 },
      { header: 'Tổng Thu', key: 'thu', width: 20, style: { numFmt: '#,##0' } },
      { header: 'Tổng Chi', key: 'chi', width: 20, style: { numFmt: '#,##0' } },
      { header: 'Số dư', key: 'balance', width: 20, style: { numFmt: '#,##0' } },
    ];
    styleHeader(ws);
    addRows(ws, monthly.rows.map(r => ({
      month: `Tháng ${r.month}`,
      thu: Number(r.thu),
      chi: Number(r.chi),
      balance: Number(r.thu) - Number(r.chi)
    })));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Dashboard_Duong_Tien_${company_id}_${year || 2026}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
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
// Serve frontend static files when in production mode
if (process.env.NODE_ENV === 'production') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const clientDist = path.join(__dirname, '..', 'front-end', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.listen(PORT, () => console.log(`Máy chủ Kế toán bảo mật đang chạy tại cổng ${PORT}`));