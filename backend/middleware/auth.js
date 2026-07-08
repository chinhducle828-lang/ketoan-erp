/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js'; // Đường dẫn chuẩn xác từ middleware sang config/db.js

const normalizeCompanyId = (companyId) => {
  if (Array.isArray(companyId)) return companyId[0];
  return companyId;
};

// 1. Middleware Xác thực người dùng & Kiểm tra Phiên làm việc
export const authenticate = async (req, res, next) => {
  const tokenFromHeader = req.headers.authorization?.split(' ')[1];
  const tokenFromQuery = req.query?.access_token || req.query?.token;
  const token = tokenFromHeader || tokenFromQuery;
  if (!token) return res.status(401).json({ error: 'Truy cập bị từ chối. Vui lòng đăng nhập!' });
  
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    
    const q = await pool.query(
      'SELECT id FROM sessions WHERE token = $1 AND user_id = $2 AND (expires_at IS NULL OR expires_at > now()) LIMIT 1', 
      [token, req.user.id]
    );
    
    if (q.rows.length === 0) {
      // Diagnostic: check if a session exists but expired or missing
      try {
        const diag = await pool.query('SELECT id, created_at, expires_at, ip_address, device_info FROM sessions WHERE token = $1 LIMIT 1', [token]);
        if (diag.rows.length > 0) {
          const s = diag.rows[0];
          console.warn(`Session rejected for user=${req.user.id} token present but invalid/expired. sessionId=${s.id} expires_at=${s.expires_at} device=${s.device_info}`);
        } else {
          console.warn(`Session missing for user=${req.user.id} token not found in sessions table.`);
        }
      } catch (e) {
        console.warn('Session diagnostic query failed:', e?.message || e);
      }

      return res.status(401).json({ error: 'Phiên làm việc không hợp lệ hoặc đã bị đăng nhập từ nơi khác.' });
    }
    next();
  } catch {
    res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn!' });
  }
};

// 2. Middleware Phân quyền Chức năng
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện hành động này!' });
    }
    next();
  };
};

// 2.1 Middleware Kiểm tra Root Admin (Dựa trên flag is_root_admin trong DB)
export const requireRootAdmin = async (req, res, next) => {
  try {
    // Lấy thông tin đầy đủ của user từ database để kiểm tra flag is_root_admin
    const userResult = await pool.query(
      'SELECT username, role, is_root_admin FROM users WHERE id = $1 LIMIT 1',
      [req.user.id]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(403).json({ error: 'Tài khoản không tồn tại!' });
    }
    
    const { username, role, is_root_admin } = userResult.rows[0];
    
    // Cho phép cả role='admin' HOẶC is_root_admin=true
    // Điều này đảm bảo admin luôn có quyền truy cập audit logs
    if (role !== 'admin' && !is_root_admin) {
      return res.status(403).json({ 
        error: `Chỉ tài khoản Root Admin mới có quyền truy cập! Tài khoản hiện tại: ${username}` 
      });
    }
    
    next();
  } catch (error) {
    console.error('Lỗi kiểm tra root admin:', error);
    res.status(500).json({ error: 'Lỗi xác thực quyền truy cập' });
  }
};

// 3. Middleware Cách ly dữ liệu giữa các Công ty (Row-Level Security)
export const checkCompanyAccess = async (req, res, next) => {
  const targetCompanyId = normalizeCompanyId(
    req.body.companyId ||
    req.body.company_id ||
    req.query.company_id ||
    req.query.companyId ||
    req.params.company_id ||
    req.params.companyId
  );
  
  if (!targetCompanyId) {
    return res.status(400).json({ error: 'Yêu cầu không hợp lệ. Thiếu thông tin định danh công ty (companyId)!' });
  }

  if (req.user && req.user.role === 'admin') {
    return next();
  }

  try {
    if (!req.user?.id) {
      return res.status(403).json({
        error: 'Từ chối truy cập! Tài khoản của bạn không có quyền thao tác trên dữ liệu của doanh nghiệp này.'
      });
    }

    const access = await pool.query(
      'SELECT 1 FROM user_companies WHERE user_id = $1 AND company_id = $2 LIMIT 1',
      [req.user.id, Number(targetCompanyId)]
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