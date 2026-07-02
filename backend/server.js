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
// IMPORT CÁC ROUTES HỆ THỐNG (ĐÃ CHUẨN HÓA THEO THƯ MỤC THỰC TẾ)
// ====================================================================
import { authRouter } from './routes/auth.js';
import { companiesRouter } from './routes/companies.js';
import { itemsRouter } from './routes/items.js';
import openingBalancesRouter from './routes/openingBalances.js'; // Default export

// Nhóm định tuyến bổ trợ (Bỏ ngoặc nhọn {} nếu các file này sử dụng default export)
import { dashboardRouter } from './routes/dashboard.js';
import { exportRouter } from './routes/export.js';
import { importRouter } from './routes/import.js';
import { partnerRouter } from './routes/partnerRoute.js'; 

// Phân hệ kho hạch toán đa dòng mới
import inventoryRoutes from './routes/inventoryRoutes.js'; 

// 🆕 TÍCH HỢP TOÀN BỘ CÁC PHÂN HỆ NGHIỆP VỤ KẾ TOÁN MỚI (CHUẨN TT 99/2025/TT-BTC)
import cashRouter from './routes/cash.routes.js';           // Quỹ Tiền mặt & Tiền gửi
import closingRouter from './routes/closing.routes.js';       // Chốt khóa/mở sổ kỳ kế toán
import hrRouter from './routes/hr.routes.js';                 // Chi phí lương & Trích bảo hiểm
import purchasingRouter from './routes/purchasing.routes.js'; // Mua hàng & Công nợ phải trả
import salesRouter from './routes/sales.routes.js';           // Bán hàng & Doanh thu
import { vouchersRouter } from './routes/vouchers.js';        // ĐÃ SỬA: Import dạng Named Export chính xác
import taxRouter from './routes/tax.routes.js';               // Kê khai & Kết chuyển thuế GTGT

// Nếu bạn sử dụng tính năng quản lý nhân viên chi tiết, hãy import usersRouter dưới đây:
import { usersRouter } from './routes/users.js';

// ====================================================================
// MOUNT CÁC ROUTES API (ĐỒNG BỘ KHÔNG TRÙNG LẶP & TRÁNH LỖI REFERENCE ERROR)
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

// Kích hoạt API nghiệp vụ hạch toán đa dòng Kho vật tư
app.use('/api/inventory', inventoryRoutes); 

// 🆕 KÍCH HOẠT ĐỒNG BỘ CÁC PHÂN HỆ NGHIỆP VỤ KẾ TOÁN MỚI
app.use('/api/cash', cashRouter);
app.use('/api/closing', closingRouter);
app.use('/api/hr', hrRouter);
app.use('/api/purchasing', purchasingRouter);
app.use('/api/sales', salesRouter);
app.use('/api/vouchers', vouchersRouter);
app.use('/api/tax', taxRouter);

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