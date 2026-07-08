/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ✅ Lấy kết nối database gốc từ file config
import { pool } from '../config/db.js';

// ❌ XÓA HOẶC SỬA DÒNG IMPORT TỪ SERVER.JS THÀNH GÁN TRỰC TIẾP DƯỚI ĐÂY:
const REFRESH_TOKEN_EXPIRE_DAYS = 30; 
const REFRESH_COOKIE_NAME = 'jid'; // Tên cookie Refresh Token chuẩn hệ thống của bạn

// ✅ Lấy các hàm băm token và cấu hình cookie từ helpers.js
import { 
  normalizeCompanyIds, 
  syncUserCompanyLinks, 
  cookieOptions, 
  parseCookies, 
  hashToken, 
  createRefreshToken 
} from '../services/helpers.js';

import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { shouldClearExistingSessions } from '../services/sessionPolicy.js';
import {
  registerAdminSchema,
  loginSchema,
  changePasswordSchema,
  adminResetPasswordSchema,
  assignStaffSchema,
  assignCompanySchema,
} from '../validators/index.js';
import { logAction, getClientIp } from '../services/auditLog.service.js';

const router = express.Router();
const EMPLOYEE_ROLES = ['nv', 'nv_banhang', 'nv_kho'];

// ====================================================================
// 🛠️ HÀM TRỢ GIÚP: Bỏ qua kiểm định Zod nếu là yêu cầu tiền trạm OPTIONS
// ====================================================================
const safeValidate = (schema) => (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  return validate(schema)(req, res, next);
};

// Đăng ký tài khoản Admin hệ thống gốc
router.post('/register-admin', safeValidate(registerAdminSchema), async (req, res) => {
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

// Đăng nhập hệ thống - ✅ ĐÃ SỬA: Không chặn các Preflight Request của trình duyệt
router.post('/login', safeValidate(loginSchema), async (req, res) => {
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

    // Insert ERP session token (accessToken)
    try {
      if (shouldClearExistingSessions(user.role)) {
        await pool.query('DELETE FROM sessions WHERE user_id = $1', [user.id]);
      }
      await pool.query(
        'INSERT INTO sessions (user_id, token, refresh_token, created_at, expires_at, ip_address, device_info) VALUES ($1, $2, $3, now(), $4, $5, $6)', 
        [user.id, accessToken, hashedRefresh, refreshExpiresAt.toISOString(), req.ip, req.headers['user-agent'] || null]
      );
    } catch (err) {
      console.error('Không thể lưu session:', err.message);
    }

    // If user is a storefront-only role, also mint a long-lived storefront token immediately
    let storefrontToken = null;
    if (['nv_banhang', 'nv_kho'].includes(String(user.role || '').trim())) {
      try {
        const STOREFRONT_TOKEN_EXPIRE_DAYS = 7;
        storefrontToken = jwt.sign(
          { id: user.id, username: user.username, role: user.role, storefront_role: user.role, company_ids: companyIds },
          process.env.JWT_SECRET,
          { expiresIn: `${STOREFRONT_TOKEN_EXPIRE_DAYS}d` }
        );

        const storefrontRefresh = createRefreshToken();
        const storefrontHashed = hashToken(storefrontRefresh);
        const storefrontExpiresAt = new Date(Date.now() + STOREFRONT_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000);

        await pool.query(
          'INSERT INTO sessions (user_id, token, refresh_token, created_at, expires_at, ip_address, device_info) VALUES ($1, $2, $3, now(), $4, $5, $6)',
          [user.id, storefrontToken, storefrontHashed, storefrontExpiresAt.toISOString(), req.ip, `storefront:${req.headers['user-agent'] || 'unknown'}`]
        );
      } catch (err) {
        console.error('Không thể tạo session storefront:', err.message);
        storefrontToken = null;
      }
    }

// GHI AUDIT LOG: Theo dõi lịch sử đăng nhập hệ thống
    try {
      await logAction({
        userId: user.id,
        action: 'LOGIN',
        entityType: 'USERS',
        newValues: {
          username: user.username,
          role: user.role,
          company_ids: companyIds
        },
        ipAddress: getClientIp(req)
      });
    } catch (err) {
      console.error('Không thể ghi audit log:', err.message);
    }

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions);
    res.json({ 
      accessToken, 
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        company_ids: companyIds,
        must_change_password: !!user.must_change_password,
        is_root_admin: !!user.is_root_admin,
        web_scope: user.role === 'admin' ? 'both' : (['nv_banhang', 'nv_kho'].includes(user.role) ? 'storefront' : 'erp')
      },
      storefrontOnlyRole: ['nv_banhang', 'nv_kho'].includes(user.role),
      message: ['nv_banhang', 'nv_kho'].includes(user.role)
        ? 'Tài khoản này chỉ sử dụng trên web bán hàng (Storefront).'
        : undefined,
      fiscal_year: new Date().getFullYear(),
      must_change_password: !!user.must_change_password
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ✅ Lấy thông tin người dùng hiện tại từ token
router.get('/me', authenticate, async (req, res) => {
  try {
    const q = await pool.query('SELECT id, username, role, company_ids, must_change_password, is_root_admin FROM users WHERE id = $1', [req.user.id]);
    if (q.rows.length === 0) return res.status(404).json({ error: 'Người dùng không tồn tại.' });
    
    const user = q.rows[0];
    res.json({ 
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        company_ids: user.company_ids,
        must_change_password: user.must_change_password,
        is_root_admin: !!user.is_root_admin
      },
      fiscal_year: new Date().getFullYear()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

// Làm mới Access Token thông qua HttpOnly Cookie Refresh Token
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
      user: {
        id: current.user_id,
        username: current.username,
        role: current.role,
        company_ids: current.company_ids,
        must_change_password: !!current.must_change_password
      },
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
router.post('/change-password', authenticate, safeValidate(changePasswordSchema), async (req, res) => {
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

// Ghi nhận sự đồng ý chính sách (click-wrap)
router.post('/consent', authenticate, async (req, res) => {
  try {
    const { policyType, policyVersion } = req.body;
    if (!policyType || !policyVersion) {
      return res.status(400).json({ error: 'Thiếu policyType hoặc policyVersion' });
    }

    const allowed = ['privacy', 'terms', 'marketing'];
    if (!allowed.includes(String(policyType))) {
      return res.status(400).json({ error: 'Loại chính sách không hợp lệ' });
    }

    await pool.query(
      `INSERT INTO consents (user_id, policy_type, policy_version, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, policy_type, policy_version) DO UPDATE
         SET agreed_at = EXCLUDED.agreed_at,
             ip_address = EXCLUDED.ip_address,
             user_agent = EXCLUDED.user_agent`,
      [
        req.user.id,
        policyType,
        policyVersion,
        req.ip,
        req.headers['user-agent'] || null
      ]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Reset Mật khẩu
router.post('/admin-reset-password', authenticate, requireRole(['admin']), safeValidate(adminResetPasswordSchema), async (req, res) => {
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

// Check if a session role is allowed for a target storefront role
const isSessionAllowedForStorefrontRole = (targetRole, sessionRole) => {
  if (!targetRole || targetRole === 'guest') return true;
  if (!sessionRole) return false;
  if (targetRole === 'admin') return sessionRole === 'admin';
  if (targetRole === 'nv_kho') return sessionRole === 'nv_kho' || sessionRole === 'admin';
  if (targetRole === 'nv_banhang') return sessionRole === 'nv_banhang' || sessionRole === 'admin';
  return false;
};

// External login: accept an erp_token (JWT) from storefront and create a dedicated storefront session
router.post('/external-login', async (req, res) => {
  try {
    const { erp_token, company_id, role } = req.body;
    if (!erp_token) return res.status(400).json({ error: 'Missing erp_token' });

    // Verify token: expect it to be a JWT issued by this ERP (signed with same JWT_SECRET)
    let payload;
    try {
      payload = jwt.verify(erp_token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid erp_token' });
    }

    // Validate role match: the role in the URL/request must be compatible with the token's role
    const requestedRole = role || 'guest';
    if (!isSessionAllowedForStorefrontRole(requestedRole, payload.role)) {
      return res.status(403).json({ 
        error: `Tài khoản ${payload.role} không phù hợp với quyền ${requestedRole} trên storefront` 
      });
    }

    // Create a dedicated storefront JWT with 7-day expiry (not reusing the 15-min ERP token)
    const STOREFRONT_TOKEN_EXPIRE_DAYS = 7;
    const storefrontToken = jwt.sign(
      { 
        id: payload.id, 
        username: payload.username, 
        role: payload.role,
        storefront_role: requestedRole,
        company_ids: payload.company_ids || []
      },
      process.env.JWT_SECRET,
      { expiresIn: `${STOREFRONT_TOKEN_EXPIRE_DAYS}d` }
    );

    // Create a session with the long-lived storefront token
    // Do NOT delete existing sessions (preserves other active storefront tabs)
    const refreshToken = createRefreshToken();
    const hashedRefresh = hashToken(refreshToken);
    const storefrontExpiresAt = new Date(Date.now() + STOREFRONT_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000);

    try {
      await pool.query(
        'INSERT INTO sessions (user_id, token, refresh_token, created_at, expires_at, ip_address, device_info) VALUES ($1,$2,$3,now(),$4,$5,$6)',
        [payload.id, storefrontToken, hashedRefresh, storefrontExpiresAt.toISOString(), req.ip, `storefront:${req.headers['user-agent'] || 'unknown'}`]
      );
    } catch (err) {
      console.error('Failed to save storefront session:', err.message);
      return res.status(500).json({ error: 'Failed to create session' });
    }

// Log audit entry
    try {
      await logAction({
        userId: payload.id,
        action: 'STOREFRONT_LOGIN',
        entityType: 'USERS',
        newValues: {
          company_id,
          role: requestedRole
        },
        ipAddress: getClientIp(req)
      });
    } catch (e) {
      console.warn('Failed to write audit log for storefront login:', e.message);
    }

    return res.json({ success: true, storefrontToken });
  } catch (err) {
    console.error('External login error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Kế toán trưởng tích chọn quản lý nhiều nhân viên
router.post('/assign-staff', authenticate, requireRole(['admin']), safeValidate(assignStaffSchema), async (req, res) => {
  try {
    const { managerId, staffIds } = req.body; 

    const checkManager = await pool.query('SELECT role FROM users WHERE id = $1', [managerId]);
    if (checkManager.rows.length === 0 || checkManager.rows[0].role !== 'ktt') {
      return res.status(400).json({ error: 'Tài khoản nhận quản lý không phải là Kế toán trưởng!' });
    }

    await pool.query('BEGIN');

    await pool.query("UPDATE users SET manager_id = NULL WHERE manager_id = $1 AND role = ANY($2::text[])", [managerId, EMPLOYEE_ROLES]);

    if (staffIds.length > 0) {
      await pool.query(
        "UPDATE users SET manager_id = $1 WHERE id = ANY($2) AND role = ANY($3::text[])",
        [managerId, staffIds, EMPLOYEE_ROLES]
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
// ĐÃ SỬA: Chỉ root admin (username='admin' hoặc is_root_admin=true) mới được phép thay đổi role admin
router.post('/assign-company', authenticate, async (req, res) => {
  try {
    const { userId, companyIds, companyId, role, managerId } = req.body;

    // Kiểm tra quyền root admin
    const currentUser = await pool.query('SELECT username, role, is_root_admin FROM users WHERE id = $1', [req.user.id]);
    const isRootAdmin = currentUser.rows[0]?.username === 'admin' || currentUser.rows[0]?.is_root_admin === true;
    
    if (!isRootAdmin) {
      return res.status(403).json({ error: 'Chỉ Root Admin mới có quyền thay đổi vai trò Admin!' });
    }

    const targetUser = await pool.query('SELECT role, username FROM users WHERE id = $1', [userId]);
    if (targetUser.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy người dùng!' });
    
    if (targetUser.rows[0].username === 'admin') {
      return res.status(400).json({ error: 'Cấm tuyệt đối hành vi tương tác hoặc thay đổi vai trò của tài khoản Root hệ thống!' });
    }

    const userRole = role || targetUser.rows[0].role || 'nv_banhang';
    const finalManagerId = EMPLOYEE_ROLES.includes(userRole) ? (managerId || null) : null;
    const normalizedCompanyIds = userRole === 'admin' ? [] : normalizeCompanyIds(companyIds ?? companyId);

    if (finalManagerId) {
      const countRes = await pool.query(
        "SELECT COUNT(*) FROM users WHERE manager_id = $1 AND role = ANY($2::text[]) AND id != $3",
        [finalManagerId, EMPLOYEE_ROLES, userId]
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
        "SELECT id FROM users WHERE manager_id = $1 AND role = ANY($2::text[]) ORDER BY id DESC",
        [ktt.id, EMPLOYEE_ROLES]
      );
      const currentStaffIds = staffRes.rows.map((row) => row.id);
      await pool.query('UPDATE users SET staff_ids = $1::integer[] WHERE id = $2', [currentStaffIds, ktt.id]);
    }

    await pool.query('COMMIT');
    res.json({ success: true, message: 'Cấu hình danh sách chuỗi công ty làm việc thành công!' });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// ✅ API LẤY DANH SÁCH TOÀN BỘ NGƯỜI DÙNG
router.get('/users', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, role, company_ids, manager_id, staff_ids FROM users ORDER BY id DESC'
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error("Lỗi API GET /api/auth/users:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export { router as authRouter };