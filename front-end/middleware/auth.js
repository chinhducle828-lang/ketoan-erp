import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js'; // Đường dẫn chuẩn xác từ middleware sang config/db.js

// 1. Middleware Xác thực người dùng & Kiểm tra Phiên làm việc
export const authenticate = async (req, res, next) => {
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

// 2. Middleware Phân quyền Chức năng
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện hành động này!' });
    }
    next();
  };
};

// 3. Middleware Cách ly dữ liệu giữa các Công ty (Row-Level Security)
export const checkCompanyAccess = (req, res, next) => {
  const targetCompanyId = req.body.companyId || req.query.company_id || req.params.company_id;
  
  if (!targetCompanyId) {
    return res.status(400).json({ error: 'Yêu cầu không hợp lệ. Thiếu thông tin định danh công ty (companyId)!' });
  }

  if (req.user && req.user.role === 'admin') {
    return next();
  }

  if (!req.user || String(req.user.company_id) !== String(targetCompanyId)) {
    return res.status(403).json({ 
      error: 'Từ chối truy cập! Tài khoản của bạn không có quyền thao tác trên dữ liệu của doanh nghiệp này.' 
    });
  }

  next();
};