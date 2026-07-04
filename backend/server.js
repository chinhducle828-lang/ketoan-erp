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

// ====================================================================
// 🛠️ ĐÃ SỬA: CẤU HÌNH CORS LINH HOẠT CHỐNG LỖI ORIGIN TRÊN PRODUCTION
// ====================================================================
const rawFrontend = process.env.FRONTEND_URL || '';
// Tách chuỗi và loại bỏ khoảng trắng dư thừa
const allowedOrigins = rawFrontend.split(',').map(s => s.trim()).filter(Boolean);

// Xử lý thông minh: Tự động thêm cả bản có dấu '/' ở cuối và bản không có để tránh lỗi cấu hình sai trên Railway
if (allowedOrigins.length > 0) {
  const dynamicOrigins = [];
  allowedOrigins.forEach(origin => {
    if (origin.endsWith('/')) {
      dynamicOrigins.push(origin.slice(0, -1));
    } else {
      dynamicOrigins.push(origin + '/');
    }
  });
  allowedOrigins.push(...dynamicOrigins);
}

app.use(cors({
  origin: (origin, callback) => {
    // 1. Cho phép các request không có origin (Ví dụ: Postman, Mobile App, hoặc server internal check)
    if (!origin) return callback(null, true);
    
    // 2. Chế độ an toàn: Nếu chạy local (Development) hoặc quên chưa cấu hình biến môi trường, tự động cho phép
    if (allowedOrigins.length === 0 || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // 3. Khớp chính xác danh sách domain được cấu hình
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Log ra terminal lỗi chi tiết để khi debug trên Railway có thể nhìn thấy domain nào đang bị từ chối
    console.error(`🔴 [CORS BLOCKED]: Cửa ngõ bảo mật từ chối kết nối từ tên miền: ${origin}. Danh sách cho phép hiện tại:`, allowedOrigins);
    return callback(new Error('CORS policy: origin not allowed'));
  },
  credentials: true, // Bắt buộc: Giữ true để truyền tải cookie bảo mật HttpOnly (refresh_token)
}));

app.use(express.json());
app.use(cookieParser()); 

// Constants dùng cho cookie
export const REFRESH_TOKEN_EXPIRE_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRE_DAYS) || 30;
export const REFRESH_COOKIE_NAME = 'refresh_token';

// Khởi tạo Database thông qua đọc file schema.sql bên ngoài
const dbInitPromise = (async () => {
  try {
    await pool.query('SELECT 1');
    console.log('Kết nối đến cơ sở dữ liệu thành công.');
    
    // Run schema.sql first
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schemaSql);
      console.log('Đồng bộ cấu trúc bảng từ schema.sql hoàn tất.');
    } else {
      console.warn('⚠️ Cảnh báo: Không tìm thấy file schema.sql tại thư mục backend.');
    }

    const compatibilitySql = `
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS lock_date DATE DEFAULT NULL;
      ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS is_posted BOOLEAN DEFAULT FALSE;
      ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS posted_at TIMESTAMP DEFAULT NULL;
      ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS posted_by INT REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS loading_status VARCHAR(20) DEFAULT 'pending_loading';
      ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS truck_id INT DEFAULT NULL;
      ALTER TABLE items ADD COLUMN IF NOT EXISTS price_sell NUMERIC(15,2) DEFAULT 0;
      ALTER TABLE items ADD COLUMN IF NOT EXISTS opening_quantity NUMERIC(15,4) DEFAULT 0;
      ALTER TABLE items ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE items ADD COLUMN IF NOT EXISTS description TEXT;
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          WHERE t.relname = 'users' AND c.conname = 'users_role_check'
        ) THEN
          ALTER TABLE users DROP CONSTRAINT users_role_check;
        END IF;

        ALTER TABLE users
        ADD CONSTRAINT users_role_check
        CHECK (role IN ('admin', 'ktt', 'nv', 'nv_banhang', 'nv_kho'));
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `;
    await pool.query(compatibilitySql);
    console.log('Đã áp dụng các ALTER TABLE tương thích cho schema hiện tại.');
    
    // Run migrations if they exist
    const migrationsPath = path.join(__dirname, 'migrations');
    if (fs.existsSync(migrationsPath)) {
      const migrationFiles = fs.readdirSync(migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();
      
      for (const migrationFile of migrationFiles) {
        try {
          const migrationSql = fs.readFileSync(path.join(migrationsPath, migrationFile), 'utf8');
          await pool.query(migrationSql);
          console.log(`✅ Đã chạy migration: ${migrationFile}`);
        } catch (err) {
          console.error(`❌ Lỗi migration ${migrationFile}:`, err.message);
        }
      }
    }
  } catch (error) {
    console.error('⚠️ [LỖI KHỞI TẠO DB]:', error.message);
  }
})();

// ====================================================================
// ✅ ĐỒNG BỘ SANG NAMED IMPORT CHO TOÀN BỘ ROUTES
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
import inventoryRoutes from './routes/inventoryRoutes.js';
import { reportRouter } from './routes/report.js';
import vouchersRouter from './routes/vouchers.js';
import maintenanceRouter from './routes/maintenance.js';
import publicRoutes from './routes/publicRoutes.js';
import logisticsRoutes from './routes/logisticsRoutes.js';

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
app.use('/api/inventory', inventoryRoutes);
app.use('/api/report', reportRouter);
app.use('/api/vouchers', vouchersRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/public', publicRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

if (process.env.SERVE_STATIC_FRONTEND === 'true') {
  const possiblePaths = [
    path.join(__dirname, '..', 'front-end', 'dist'),
    path.join(__dirname, '..', 'dist'),
    path.join(__dirname, 'dist'),
    '/front-end/dist',
    '/app/front-end/dist'
  ];
  
  let clientDist = null;
  for (const distPath of possiblePaths) {
    if (fs.existsSync(distPath)) {
      clientDist = distPath;
      console.log(`✅ Found frontend dist at: ${clientDist}`);
      break;
    }
  }
  
  if (clientDist) {
    app.use(express.static(clientDist));
    app.get('*', (req, res) => {
      try {
        res.sendFile(path.join(clientDist, 'index.html'));
      } catch (err) {
        console.error('Error serving index.html:', err);
        res.status(500).json({ error: 'Failed to serve frontend' });
      }
    });
  } else {
    console.warn('⚠️ Frontend dist not found in any expected location. API-only mode.');
  }
} else {
  console.log('ℹ️ Running in API-only mode. Static frontend will not be served by backend.');
}

const PORT = process.env.PORT || 5000;
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isMainModule) {
  app.listen(PORT, () => console.log(`Máy chủ Kế toán bảo mật đang chạy tại cổng ${PORT}`));
}

export { app, dbInitPromise };
export default app;

//