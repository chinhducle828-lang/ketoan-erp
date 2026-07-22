/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import crypto from 'crypto'; // ✅ BẮT BUỘC: Thêm thư viện mã hóa gốc của Node.js
import { pool } from '../config/db.js'; // Sửa lại thành named import nếu config/db.js xuất dạng { pool }

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
  
  // Use a transaction for atomicity - prevents partial updates
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query('DELETE FROM user_companies WHERE user_id = $1', [userId]);

    if (normalized.length > 0) {
      // Batch insert for efficiency
      const values = [];
      const params = [];
      let idx = 1;
      
      for (const companyId of normalized) {
        values.push(`($${idx}, $${idx + 1})`);
        params.push(userId, companyId);
        idx += 2;
      }
      
      await client.query(
        `INSERT INTO user_companies (user_id, company_id) VALUES ${values.join(', ')} ON CONFLICT DO NOTHING`,
        params
      );
    }
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Lỗi đồng bộ user_companies:', error.message);
    throw error; // Re-throw so caller knows the operation failed
  } finally {
    client.release();
  }

  return normalized;
};

export const canAccessCompany = async (user, companyId) => {
  if (!companyId) return false;
  if (user.role === 'admin') return true;

  // If the token payload already contains company_ids (e.g. storefront long-lived token),
  // allow access based on that payload to avoid unnecessary DB lookups and to support
  // external-login flows which may not have synced user_companies rows yet.
  if (Array.isArray(user.company_ids) && user.company_ids.length > 0) {
    try {
      const normalized = user.company_ids.map((c) => Number(c));
      if (normalized.includes(Number(companyId))) return true;
    } catch {
      // fall through to DB check on parse errors
    }
  }

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
// 🚀 ĐÃ SỬA: BỘ TỨ CÔNG CỤ QUẢN LÝ COOKIE & TOKEN CHO AUTH.JS
// ====================================================================

// 1. Cấu hình cookie HttpOnly an toàn chống tấn công XSS (Đã sửa lỗi SameSite)
export const cookieOptions = {
  httpOnly: true,
  // Khi chạy local (development) thì false, khi lên Railway (production) bắt buộc phải true vì chạy HTTPS
  secure: process.env.NODE_ENV === 'production', 
  // 🔴 SỬA TẠI ĐÂY: 
  // - Production: 'none' để cross-domain (Railway subdomains) hoạt động
  // - Development: 'lax' vì localhost không cần cross-site cookies (tất cả đều là same-site)
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: (Number(process.env.REFRESH_TOKEN_EXPIRE_DAYS) || 30) * 24 * 60 * 60 * 1000, // Hạn dùng đồng bộ theo file .env
  // Set domain to allow cookies across Railway subdomains (production only)
  // Development: undefined (browser default) - works fine for localhost
  domain: process.env.NODE_ENV === 'production' ? '.railway.app' : undefined
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