import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ✅ ĐÃ SỬA: Dùng path.resolve và '../.env' để đi ra ngoài thư mục config/, tìm đúng file .env ở gốc backend/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Khởi tạo database Pool linh hoạt gộp/rời (Giữ nguyên logic gốc của bạn)
export const pool = process.env.DATABASE_URL
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
  : new pg.Pool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      ssl: false
    });

// Kiểm tra cấu hình môi trường an toàn
if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
  console.error('ERROR: Chưa cấu hình Database tại db.js! Vui lòng kiểm tra lại file .env.');
  process.exit(1);
}

// Export một hàm query tiện ích để viết code ở tầng services ngắn gọn hơn
export const query = (text, params) => pool.query(text, params);