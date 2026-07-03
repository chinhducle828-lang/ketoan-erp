import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser'; 
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs'; 
import { fileURLToPath } from 'url';

// 1. Cấu hình PG Pool từ thư mục config
import { pool } from './config/db.js';

// Cấu hình đường dẫn tuyệt đối cho file .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

// KÍCH HOẠT TRUST PROXY: Bắt buộc cấu hình để lấy Real IP của Client qua Proxy bảo mật
app.set('trust proxy', true);

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
  credentials: true, 
}));

app.use(express.json());
app.use(cookieParser()); 

// Constants dùng cho cookie
export const REFRESH_TOKEN_EXPIRE_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRE_DAYS) || 30;
export const REFRESH_COOKIE_NAME = 'refresh_token';

// Khởi tạo Database thông qua đọc file schema.sql bên ngoài
(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('Kết nối đến cơ sở dữ liệu thành công.');
    
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
// ✅ SỬA CHUẨN XÁC TOÀN DIỆN: ĐỒNG BỘ SANG NAMED IMPORT CHO TOÀN BỘ ROUTES
// ====================================================================

import { authRouter } from './routes/auth.js'; 
import { companiesRouter } from './routes/companies.js'; 
import { itemsRouter } from './routes/items.js'; 
import { openingBalancesRouter } from './routes/openingBalances.js'; 
import { dashboardRouter } from './routes/dashboard.js'; 
import { exportRouter } from './routes/export.js'; 
import { importRouter } from './routes/import.js'; 
import { partnerRouter } from './routes/partnerRoute.js'; 
import { usersRouter } from './routes/users.js'; 

// Riêng tệp inventoryRoutes.js của bạn có sẵn lệnh `export default router` ở cuối
import inventoryRoutes from './routes/inventoryRoutes.js';
// ====================================================================
// MOUNT CÁC ROUTES API TẬP TRUNG
// ====================================================================
app.use('/api/auth', authRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/items', itemsRouter); 
app.use('/api/opening-balances', openingBalancesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/export', exportRouter);
app.use('/api/import', importRouter);
app.use('/api/partners', partnerRouter); 
app.use('/api/users', usersRouter); 

// Kích hoạt API lõi: Thuật toán kho O(N) & Sổ cái tổng hợp động dồn tích
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

if (process.env.SEED_DATABASE === 'true') {
  import('./services/seedData.js').then(({ seedDatabase }) => {
    seedDatabase();
  }).catch(err => {
    console.error('Failed to seed database:', err.message);
  });
}

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'front-end', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Máy chủ Kế toán bảo mật đang chạy tại cổng ${PORT}`));