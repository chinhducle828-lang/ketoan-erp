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

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ==========================================
// MIDDLEWARE XÁC THỰC VÀ PHÂN QUYỀN (PRIVATE API)
// ==========================================

// Kiểm tra Token hợp lệ
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Truy cập bị từ chối. Vui lòng đăng nhập!' });
  
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn!' });
  }
};

// Kiểm tra quyền hạn (admin / ktt / nv)
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

// Đăng ký tài khoản Admin hệ thống (Chỉ cho phép nếu DB chưa có Admin nào)
app.post('/api/auth/register-admin', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Kiểm tra xem hệ thống đã có Admin chưa để tránh bị lạm dụng tạo tài khoản giả mạo
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

// Đăng nhập hệ thống & Cấp mã Token chứa thông tin công ty quản lý
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Tài khoản không tồn tại!' });
    
    const user = result.rows[0];
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: 'Mật khẩu không chính xác!' });
    }
    
    // Đóng gói thông tin phân quyền và mã công ty vào Token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, company_id: user.company_id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );
    
    res.json({ 
      token, 
      user: { id: user.id, username: user.username, role: user.role, company_id: user.company_id } 
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Lấy danh sách người dùng thuộc nội bộ công ty (Nếu là Admin thì xem hết hệ thống)
app.get('/api/users', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await pool.query('SELECT id, username, role, company_id FROM users ORDER BY id DESC');
    } else {
      result = await pool.query('SELECT id, username, role, company_id FROM users WHERE company_id = $1', [req.user.company_id]);
    }
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// =========================================================
// 🔥 BỔ SUNG: API THÊM MỚI TÀI KHOẢN NHÂN SỰ (DÀNH CHO FRONTEND)
// =========================================================
app.post('/api/users', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { username, password, role, companyId } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Vui lòng điền đầy đủ tài khoản, mật khẩu và vai trò!' });
    }

    // 1. Kiểm tra tài khoản trùng lặp
    const userExist = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ error: 'Tên tài khoản này đã tồn tại trên hệ thống!' });
    }

    // 2. Mã hóa mật khẩu bảo mật
    const hashed = await bcrypt.hash(password, 10);

    // 3. Tiến hành lưu vào bảng dữ liệu (nhận diện cột 'password' chuẩn xác)
    const result = await pool.query(
      'INSERT INTO users (username, password, role, company_id) VALUES ($1, $2, $3, $4) RETURNING id, username, role, company_id',
      [username, hashed, role, companyId || null]
    );

    res.status(201).json({ success: true, message: 'Thêm nhân sự mới thành công!', user: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// =========================================================
// 🔥 BỔ SUNG: API XÓA TÀI KHOẢN NHÂN SỰ (DÀNH CHO CÂU HỎI XÓA ĐƯỢC KHÔNG)
// =========================================================
app.delete('/api/users/:id', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const userId = req.params.id;

    // Ngăn chặn việc Admin tự xóa chính mình gây lỗi hệ thống lock out
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Bạn không thể tự xóa tài khoản chính mình đang đăng nhập!' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    res.json({ success: true, message: 'Đã xóa nhân sự khỏi hệ thống thành công!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ==========================================
// --- API QUẢN LÝ DOANH NGHIỆP (COMPANIES) ---
// ==========================================

// Tạo mới công ty (Chỉ Admin hệ thống mới được phép)
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

// Lấy danh sách công ty (Admin xem tất cả, User chỉ xem thông tin công ty mình thuộc về)
app.get('/api/companies', authenticate, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await pool.query('SELECT * FROM companies ORDER BY id DESC');
    } else {
      result = await pool.query('SELECT * FROM companies WHERE id = $1', [req.user.company_id]);
    }
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Xóa công ty (Chỉ Admin hệ thống mới được phép)
app.delete('/api/companies/:id', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const companyId = req.params.id;
    
    // Kiểm tra xem công ty có nhân viên không
    const checkUsers = await pool.query('SELECT id FROM users WHERE company_id = $1 LIMIT 1', [companyId]);
    if (checkUsers.rows.length > 0) {
      return res.status(400).json({ error: 'Không thể xóa công ty vì còn nhân viên đang gán với công ty này. Vui lòng xóa hoặc chuyển nhân viên trước!' });
    }

    // Kiểm tra xem công ty có chứng từ không
    const checkVouchers = await pool.query('SELECT id FROM vouchers WHERE company_id = $1 LIMIT 1', [companyId]);
    if (checkVouchers.rows.length > 0) {
      return res.status(400).json({ error: 'Không thể xóa công ty vì còn dữ liệu hạch toán. Vui lòng xóa chứng từ trước!' });
    }

    await pool.query('DELETE FROM companies WHERE id = $1', [companyId]);
    res.json({ success: true, message: 'Đã xóa công ty thành công!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Chỉ định/Gán nhân viên vào công ty (Chỉ Admin mới có quyền gán)
app.post('/api/auth/assign-company', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const { userId, companyId, role } = req.body;
    const userRole = role || 'nv';
    await pool.query('UPDATE users SET company_id = $1, role = $2 WHERE id = $3', [companyId, userRole, userId]);
    res.json({ success: true, message: 'Gán công ty và phân quyền thành công!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// --- API NGHIỆP VỤ HẠCH TOÁN ĐA DOANH NGHIỆP ---
// ==========================================

// Lấy danh sách chứng từ (Bảo mật: Ép buộc lọc theo company_id từ Token của user)
app.get('/api/vouchers', authenticate, async (req, res) => {
  try {
    const targetCompanyId = req.user.role === 'admin' ? req.query.company_id : req.user.company_id;
    if (!targetCompanyId) return res.status(400).json({ error: 'Thiếu tham số company_id!' });

    const result = await pool.query(
      'SELECT * FROM vouchers WHERE company_id = $1 ORDER BY voucher_date DESC, id DESC', 
      [targetCompanyId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Thêm mới chứng từ hạch toán
app.post('/api/vouchers', authenticate, async (req, res) => {
  try {
    const { voucherDate, description, accountDr, accountCr, amount, type } = req.body;
    const targetCompanyId = req.user.role === 'admin' ? req.body.companyId : req.user.company_id;
    
    if (!targetCompanyId) return res.status(400).json({ error: 'Tài khoản của bạn chưa được kích hoạt thuộc về công ty nào!' });

    const result = await pool.query(
      `INSERT INTO vouchers (company_id, voucher_date, description, account_dr, account_cr, amount, voucher_type, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [targetCompanyId, voucherDate, description, accountDr, accountCr, amount, type, req.user.id]
    );
    res.json({ success: true, voucher: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Xóa chứng từ (Bảo mật: Chỉ cho phép Kế toán trưởng hoặc Admin, và phải khớp company_id)
app.delete('/api/vouchers/:id', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await pool.query('DELETE FROM vouchers WHERE id = $1', [req.params.id]);
    } else {
      result = await pool.query('DELETE FROM vouchers WHERE id = $1 AND company_id = $2', [req.params.id, req.user.company_id]);
    }
    
    res.json({ success: true, message: 'Xóa chứng từ thành công!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Lấy số dư đầu kỳ tài khoản
app.get('/api/opening-balances', authenticate, async (req, res) => {
  try {
    const targetCompanyId = req.user.role === 'admin' ? req.query.company_id : req.user.company_id;
    if (!targetCompanyId) return res.status(400).json({ error: 'Thiếu tham số company_id!' });

    const result = await pool.query(
      'SELECT * FROM opening_balances WHERE company_id = $1 ORDER BY account_code ASC', 
      [targetCompanyId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Cập nhật số dư đầu kỳ (Hạn chế quyền cho Admin và Kế toán trưởng nhập số dư đầu kỳ)
app.post('/api/opening-balances', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    const { balances } = req.body;
    const targetCompanyId = req.user.role === 'admin' ? req.body.companyId : req.user.company_id;
    const year = 2026;

    if (!targetCompanyId) return res.status(400).json({ error: 'Thông tin công ty không hợp lệ!' });

    for (const [code, val] of Object.entries(balances)) {
      await pool.query(
        `INSERT INTO opening_balances (company_id, account_code, debit_balance, credit_balance, fiscal_year)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (company_id, account_code, fiscal_year)
         DO UPDATE SET debit_balance = $3, credit_balance = $4`,
        [targetCompanyId, code, val.dr || 0, val.cr || 0, year]
      );
    }
    res.json({ success: true, message: 'Cập nhật số dư đầu kỳ thành công!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Máy chủ Kế toán bảo mật đang chạy tại cổng ${PORT}`));