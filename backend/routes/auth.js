import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool, REFRESH_TOKEN_EXPIRE_DAYS, REFRESH_COOKIE_NAME, cookieOptions, parseCookies, hashToken, createRefreshToken } from '../server.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import {
  registerAdminSchema,
  loginSchema,
  changePasswordSchema,
  adminResetPasswordSchema,
  assignStaffSchema,
  assignCompanySchema,
} from '../validators/index.js';
import { normalizeCompanyIds, syncUserCompanyLinks } from '../services/helpers.js';

const router = express.Router();

// Đăng ký tài khoản Admin hệ thống gốc
router.post('/register-admin', validate(registerAdminSchema), async (req, res) => {
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

// Đăng nhập hệ thống
router.post('/login', validate(loginSchema), async (req, res) => {
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

// API lưu/lấy tùy chỉnh người dùng
router.get('/preferences', authenticate, async (req, res) => {
  try {
    const q = await pool.query('SELECT preferences FROM users WHERE id = $1', [req.user.id]);
    if (q.rows.length === 0) return res.json({});
    const prefs = q.rows[0].preferences || {};
    res.json(typeof prefs === 'string' ? JSON.parse(prefs) : prefs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/preferences', authenticate, async (req, res) => {
  try {
    const prefs = req.body;
    await pool.query('UPDATE users SET preferences = $1 WHERE id = $2', [JSON.stringify(prefs), req.user.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/refresh', async (req, res) => {
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
router.post('/logout', authenticate, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(400).json({ error: 'Thiếu token.' });
    await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions);
    res.json({ success: true, message: 'Đăng xuất thành công.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Thay đổi mật khẩu
router.post('/change-password', authenticate, validate(changePasswordSchema), async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
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

// Admin Reset Mật khẩu
router.post('/admin-reset-password', authenticate, requireRole(['admin']), validate(adminResetPasswordSchema), async (req, res) => {
  try {
    const { userId } = req.body;
    
    const targetUser = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
    if (targetUser.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy tài khoản!' });

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

// Kế toán trưởng tích chọn quản lý nhiều nhân viên
router.post('/assign-staff', authenticate, requireRole(['admin']), validate(assignStaffSchema), async (req, res) => {
  try {
    const { managerId, staffIds } = req.body; 

    const checkManager = await pool.query('SELECT role FROM users WHERE id = $1', [managerId]);
    if (checkManager.rows.length === 0 || checkManager.rows[0].role !== 'ktt') {
      return res.status(400).json({ error: 'Tài khoản nhận quản lý không phải là Kế toán trưởng!' });
    }

    await pool.query('BEGIN');

    await pool.query("UPDATE users SET manager_id = NULL WHERE manager_id = $1 AND role = 'nv'", [managerId]);

    if (staffIds.length > 0) {
      await pool.query(
        "UPDATE users SET manager_id = $1 WHERE id = ANY($2) AND role = 'nv'",
        [managerId, staffIds]
      );
    }

    await pool.query('UPDATE users SET staff_ids = $1 WHERE id = $2', [staffIds, managerId]);

    await pool.query('COMMIT');
    res.json({ success: true, message: 'Cập nhật danh sách nhân viên cho Kế toán trưởng thành công!' });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// Chỉ định nhân viên vào nhiều công ty
router.post('/assign-company', authenticate, requireRole(['admin']), validate(assignCompanySchema), async (req, res) => {
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

export { router as authRouter };