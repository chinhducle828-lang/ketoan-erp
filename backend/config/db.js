// FILE_PATH: backend/config/db.js
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chỉ định chính xác đường dẫn đến file .env ở thư mục gốc của dự án backend
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;

// Hybrid Database Configuration
// Priority 1: DATABASE_URL (Railway/Render production)
// Priority 2: Individual DB_* variables (local development)
let poolConfig;

if (process.env.DATABASE_URL) {
  // Production: Parse DATABASE_URL from Railway/Render
  console.log('🌐 Production mode: Using DATABASE_URL');
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  };
} else {
  // Local development: Use individual variables
  console.log('💻 Development mode: Using local database');
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'ketoan_db',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    ssl: false
  };
}

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  console.log('⚡ Hệ thống kết nối thành công Cơ sở dữ liệu PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Lỗi kết nối Pool Database:', err.message);
});

// Export both named and default for compatibility
export { pool };
export default pool;