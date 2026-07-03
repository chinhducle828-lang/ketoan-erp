import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = pg;

// 🚀 TỐI ƯU HÓA: Tự động dùng DATABASE_URL của Railway nếu tồn tại
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false } // Bắt buộc phải có để kết nối an toàn qua Cloud công khai
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    };

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  console.log('⚡ Hệ thống kết nối thành công Cơ sở dữ liệu PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Lỗi kết nối Pool Database:', err.message);
});

export { pool };
export default pool;