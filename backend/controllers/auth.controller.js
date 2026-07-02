import { pool } from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

/**
 * Đăng ký tài khoản người dùng mới
 */
export const register = async (req, res) => {
  try {
    const { username, password, fullName, role, companyIds } = req.body;

    // Kiểm tra tài khoản đã tồn tại chưa
    const userExist = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ error: 'Tài khoản người dùng đã tồn tại trong hệ thống!' });
    }

    // Mã hóa mật khẩu bảo mật mã nguồn
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Lưu người dùng mới vào CSDL
    const insertUserQuery = `
      INSERT INTO users (username, password, full_name, role, company_ids)
      VALUES ($1, $2, $3, $4, $5) RETURNING id, username, full_name as "fullName", role
    `;
    const result = await pool.query(insertUserQuery, [
      username,
      hashedPassword,
      fullName,
      role || 'staff',
      JSON.stringify(companyIds || []) // Lưu mảng ID công ty được phép truy cập dạng JSON
    ]);

    res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công!',
      user: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Đăng nhập hệ thống & Cấp phát JWT Token
 */
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác!' });
    }

    const user = result.rows[0];

    // Xác thực kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác!' });
    }

    // Tạo mã token mã hóa JWT lưu giữ thông tin phiên làm việc
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      companyIds: typeof user.company_ids === 'string' ? JSON.parse(user.company_ids) : user.company_ids
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'SecretERPKey_TT99', { expiresIn: '24h' });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        companyIds: payload.companyIds
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};