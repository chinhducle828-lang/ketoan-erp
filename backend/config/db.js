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

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => {
  console.log('⚡ Hệ thống kết nối thành công Cơ sở dữ liệu PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Lỗi kết nối Pool Database:', err.message);
});

// Export both named and default for compatibility
export { pool };
export default pool;