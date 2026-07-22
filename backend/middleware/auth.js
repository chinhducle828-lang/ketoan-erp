/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../config/db.js';

const normalizeCompanyId = (companyId) => {
  if (Array.isArray(companyId)) return companyId[0];
  return companyId;
};

/**
 * Hash a token using SHA-256 for secure DB storage
 * This prevents raw JWT tokens from being stored in the sessions table
 */
const hashToken = (token) => {
  if (!token) return '';
  return crypto.createHash('sha256').update(token).digest('hex');
};

// 1. Middleware Xác thực người dùng & Kiểm tra Phiên làm việc
export const authenticate = async (req, res, next) => {
  // Ưu tiên Authorization header (Bearer token từ memory - mới hơn), fallback sang cookie
  let token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    token = req.cookies?.access_token || req.cookies?.storefront_token || null;
  }
  if (!token) {
    // NOTE: Query string token is intentionally disabled for security.
    // Tokens via URL can leak via server logs, browser history, and referrer headers.
    // EventSource/SSE should use EventSource with Authorization header or cookie instead.
    console.warn('[auth] No token provided');
    return res.status(401).json({ error: 'Truy cập bị từ chối. Vui lòng đăng nhập!' });
  }
  
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    
    // Look up session using SHA-256 hash of the token (tokens are stored hashed in DB)
    const hashedToken = hashToken(token);
    const q = await pool.query(
      'SELECT id FROM sessions WHERE token = $1 AND user_id = $2 AND (expires_at IS NULL OR expires_at > now()) LIMIT 1', 
      [hashedToken, req.user.id]
    );
    
    if (q.rows.length === 0) {
      // Diagnostic: check if session exists but expired
      try {
        const diag = await pool.query(
          'SELECT id, created_at, expires_at, ip_address, device_info FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', 
          [req.user.id]
        );
        if (diag.rows.length > 0) {
          const s = diag.rows[0];
          const isExpired = s.expires_at && new Date(s.expires_at) < new Date();
          if (isExpired) {
            console.warn(`[auth] Session expired for user=${req.user.id}. Expired at: ${s.expires_at}`);
          } else {
            console.warn(`[auth] Session token mismatch for user=${req.user.id}. Token may have been rotated.`);
          }
        } else {
          console.warn(`[auth] No sessions found for user=${req.user.id}`);
        }
      } catch (e) {
        console.warn('[auth] Session diagnostic query failed:', e?.message || e);
      }

      return res.status(401).json({ error: 'Phiên làm việc không hợp lệ hoặc đã hết hạn.' });
    }
    next();
  } catch (err) {
    console.warn('[auth] Token verification failed:', err.message);
    res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn!' });
  }
};

// Alias for backward compatibility
export const authenticateToken = authenticate;

// 2. Middleware Phân quyền Chức năng
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện hành động này!' });
    }
    next();
  };
};

// Alias for backward compatibility
export const authorizeAdmin = requireRole;

// 2.1 Middleware Kiểm tra Root Admin (Dựa trên flag is_root_admin trong DB)
export const requireRootAdmin = async (req, res, next) => {
  try {
    // Use is_root_admin from JWT payload first to avoid DB round-trip
    if (req.user.is_root_admin === true || req.user.role === 'admin') {
      // Verify from DB for sensitive operations
      const userResult = await pool.query(
        'SELECT username, role, is_root_admin FROM users WHERE id = $1 LIMIT 1',
        [req.user.id]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(403).json({ error: 'Tài khoản không tồn tại!' });
      }
      
      const { username, role, is_root_admin } = userResult.rows[0];
      
      if (role === 'admin' || is_root_admin) {
        return next();
      }
    }
    
    return res.status(403).json({ error: 'Chỉ tài khoản Root Admin mới có quyền truy cập!' });
  } catch (error) {
    console.error('Lỗi kiểm tra root admin:', error);
    res.status(500).json({ error: 'Lỗi xác thực quyền truy cập' });
  }
};

// 3. Middleware Cách ly dữ liệu giữa các Công ty (Row-Level Security)
export const checkCompanyAccess = async (req, res, next) => {
  const rawCompanyId = normalizeCompanyId(
    req.body.companyId ||
    req.body.company_id ||
    req.query.company_id ||
    req.query.companyId ||
    req.params.company_id ||
    req.params.companyId
  );
  
  if (!rawCompanyId) {
    return res.status(400).json({ error: 'Yêu cầu không hợp lệ. Thiếu thông tin định danh công ty (companyId)!' });
  }

  // Validate that companyId is a positive integer to prevent SQL injection
  const targetCompanyId = Number(rawCompanyId);
  if (!Number.isInteger(targetCompanyId) || targetCompanyId <= 0) {
    return res.status(400).json({ error: 'Mã công ty không hợp lệ!' });
  }

  // Store validated companyId on request for downstream use
  req.companyId = targetCompanyId;

  try {
    if (!req.user?.id) {
      return res.status(403).json({
        error: 'Từ chối truy cập! Tài khoản của bạn không có quyền thao tác trên dữ liệu của doanh nghiệp này.'
      });
    }

    if (req.user.role === 'admin') {
      // Admin users must also be checked against user_companies for multi-tenant isolation
      // unless they are root admin (is_root_admin = true)
      const adminAccess = await pool.query(
        'SELECT 1 FROM user_companies WHERE user_id = $1 AND company_id = $2 LIMIT 1',
        [req.user.id, targetCompanyId]
      );
      
      if (adminAccess.rows.length === 0) {
        // Admin without explicit company access - check if they are root admin
        const rootCheck = await pool.query(
          'SELECT is_root_admin FROM users WHERE id = $1 LIMIT 1',
          [req.user.id]
        );
        
        if (rootCheck.rows.length === 0 || !rootCheck.rows[0].is_root_admin) {
          return res.status(403).json({
            error: 'Từ chối truy cập! Tài khoản của bạn không có quyền thao tác trên dữ liệu của doanh nghiệp này.'
          });
        }
        // Root admin bypasses company check - log for audit
        console.log(`[AUDIT] Root admin ${req.user.id} accessing company ${targetCompanyId}`);
      }
      return next();
    }

    const access = await pool.query(
      'SELECT 1 FROM user_companies WHERE user_id = $1 AND company_id = $2 LIMIT 1',
      [req.user.id, targetCompanyId]
    );

    if (access.rows.length === 0) {
      return res.status(403).json({
        error: 'Từ chối truy cập! Tài khoản của bạn không có quyền thao tác trên dữ liệu của doanh nghiệp này.'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi xác thực quyền doanh nghiệp' });
  }
};