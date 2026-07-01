import express from 'express';
import cors from 'cors';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();
const app = express();

// CORS configuration
const rawFrontend = process.env.FRONTEND_URL || '';
const allowedOrigins = rawFrontend.split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS policy: origin not allowed'));
  },
  credentials: true,
}));
app.use(express.json());

// Constants
export const REFRESH_TOKEN_EXPIRE_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRE_DAYS) || 30;
export const REFRESH_COOKIE_NAME = 'refresh_token';
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/',
  maxAge: REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60 * 1000,
};

// Database pool
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Utility functions
export const parseCookies = (cookieHeader = '') => {
  return cookieHeader.split(';').reduce((acc, cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    if (!name) return acc;
    acc[name] = rest.join('=');
    return acc;
  }, {});
};

export const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const createRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

// Check database connection and initialize schema
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL chưa được cấu hình. Vui lòng thêm biến môi trường DATABASE_URL.');
  process.exit(1);
}

// Initialize database schema
(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('Kết nối đến cơ sở dữ liệu thành công.');
    
    // Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        tax_code VARCHAR(50),
        address TEXT
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role VARCHAR(50) NOT NULL,
        must_change_password BOOLEAN DEFAULT false
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_companies (
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, company_id)
      );
    `);

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
    
    // Add columns if they don't exist
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(id) ON DELETE SET NULL`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS company_ids INTEGER[] DEFAULT '{}'`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_ids INTEGER[] DEFAULT '{}'`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb`);
    await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS refresh_token TEXT`);
    
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

// Import routes
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { companiesRouter } from './routes/companies.js';
import { vouchersRouter } from './routes/vouchers.js';
import { itemsRouter } from './routes/items.js';
import { openingBalancesRouter } from './routes/openingBalances.js';
import { dashboardRouter } from './routes/dashboard.js';
import { exportRouter } from './routes/export.js';
import { importRouter } from './routes/import.js';

// Mount routes
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/vouchers', vouchersRouter);
app.use('/api/items', itemsRouter);
app.use('/api/opening-balances', openingBalancesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/export', exportRouter);
app.use('/api/import', importRouter);

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', message: 'Backend chạy tốt' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Lỗi kết nối cơ sở dữ liệu' });
  }
});

// Seed database with test data if enabled
if (process.env.SEED_DATABASE === 'true') {
  import('./services/seedData.js').then(({ seedDatabase }) => {
    seedDatabase();
  }).catch(err => {
    console.error('Failed to seed database:', err.message);
  });
}

// Serve frontend static files when in production mode
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'front-end', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Máy chủ Kế toán bảo mật đang chạy tại cổng ${PORT}`));
