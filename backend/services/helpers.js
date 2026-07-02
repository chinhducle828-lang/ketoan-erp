import crypto from 'crypto'; // ✅ BẮT BUỘC: Thêm thư viện mã hóa gốc của Node.js
import { pool } from '../config/db.js';

// --- CÁC HÀM XỬ LÝ DOANH NGHIỆP CỦA BẠN (GIỮ NGUYÊN TỐT) ---

export const normalizeCompanyIds = (value) => {
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

export const syncUserCompanyLinks = async (userId, companyIds) => {
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

export const canAccessCompany = async (user, companyId) => {
  if (!companyId) return false;
  if (user.role === 'admin') return true;

  const result = await pool.query(
    'SELECT 1 FROM user_companies WHERE user_id = $1 AND company_id = $2 LIMIT 1',
    [user.id, companyId]
  );

  return result.rows.length > 0;
};

export const getCompanyIdsForUser = async (user) => {
  if (user.role === 'admin') return [];

  const result = await pool.query(
    'SELECT company_id FROM user_companies WHERE user_id = $1 ORDER BY company_id',
    [user.id]
  );

  return result.rows.map((row) => Number(row.company_id));
};


// ====================================================================
// 🚀 BỔ SUNG: BỘ TỨ CÔNG CỤ QUẢN LÝ COOKIE & TOKEN CHO AUTH.JS
// ====================================================================

// 1. Cấu hình cookie HttpOnly an toàn chống tấn công XSS
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // Chỉ kích hoạt HTTPS bảo mật khi lên production
  sameSite: 'lax',
  maxAge: (Number(process.env.REFRESH_TOKEN_EXPIRE_DAYS) || 30) * 24 * 60 * 60 * 1000 // Hạn dùng đồng bộ theo file .env
};

// 2. Hàm bóc tách cookie từ chuỗi raw string của Header request
export const parseCookies = (cookieString) => {
  if (!cookieString) return {};
  return cookieString
    .split(';')
    .reduce((res, c) => {
      const n = c.split('=');
      if (n.length === 2) res[n[0].trim()] = n[1].trim();
      return res;
    }, {});
};

// 3. Hàm băm SHA-256 (Chỉ lưu chuỗi hash token vào DB để bảo mật cao nhất)
export const hashToken = (token) => {
  if (!token) return '';
  return crypto.createHash('sha256').update(token).digest('hex');
};

// 4. Hàm sinh chuỗi Refresh Token ngẫu nhiên có độ dài lớn siêu an toàn
export const createRefreshToken = () => {
  return crypto.randomBytes(40).toString('hex');
};