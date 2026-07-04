import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser'; // Xử lý Refresh Token cookie bảo mật cao
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs'; // Đọc file SQL hạch toán
import { fileURLToPath } from 'url';

// ✅ Cấu hình PG Pool từ thư mục config
import { pool } from './config/db.js';

// Cấu hình đường dẫn tuyệt đối cho file .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

// CORS Configuration
const rawFrontend = process.env.FRONTEND_URL || '';
const allowedOrigins = rawFrontend.split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS policy: origin not allowed'));
  },
  credentials: true, // Cho phép trao đổi Token lai / Cookie bảo mật
}));

app.use(express.json());
app.use(cookieParser()); // Bật cookie-parser để giải mã HttpOnly Cookie

// Constants
export const REFRESH_TOKEN_EXPIRE_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRE_DAYS) || 30;
export const REFRESH_COOKIE_NAME = 'refresh_token';

// Khởi tạo Database thông qua đọc file schema.sql bên ngoài
(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('Kết nối đến cơ sở dữ liệu thành công.');
    
    // ĐỌC VÀ THỰC THI SCRIPT TỪ SCHEMA.SQL
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schemaSql);
      console.log('Đồng bộ cấu trúc bảng từ schema.sql hoàn tất.');
    } else {
      console.warn('⚠️ Cảnh báo: Không tìm thấy file schema.sql tại thư mục backend.');
    }
  } catch (error) {
    console.error('⚠️ [LỖI KHỞI TẠO DB]:', error.message);
  }
})();

// ====================================================================
// IMPORT CÁC ROUTES HỆ THỐNG
// ====================================================================
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { companiesRouter } from './routes/companies.js';
import { vouchersRouter } from './routes/vouchers.js';
import { itemsRouter } from './routes/items.js';
import { openingBalancesRouter } from './routes/openingBalances.js';
import { dashboardRouter } from './routes/dashboard.js';
import { exportRouter } from './routes/export.js';
import { importRouter } from './routes/import.js';
import { partnerRouter } from './routes/partnerRoute.js'; 

// ✅ Tích hợp phân hệ hạch toán đa dòng Nhập/Xuất kho mới
import inventoryRoutes from './routes/inventoryRoutes.js'; 

// ====================================================================
// MOUNT CÁC ROUTES API (ĐÃ LỌC TRÙNG LẶP)
// ====================================================================
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/vouchers', vouchersRouter);
app.use('/api/items', itemsRouter); // Cổng danh mục vật tư gốc của bạn
app.use('/api/opening-balances', openingBalancesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/export', exportRouter);
app.use('/api/import', importRouter);
app.use('/api/partners', partnerRouter); 

// ✅ Kích hoạt API nghiệp vụ hạch toán đa dòng Kho vật tư
app.use('/api/inventory', inventoryRoutes); 

// ====================================================================
// HEALTH CHECK & UTILITIES
// ====================================================================
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
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'front-end', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Máy chủ Kế toán bảo mật đang chạy tại cổng ${PORT}`));