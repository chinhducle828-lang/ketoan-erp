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
const allowedOrigins = [...new Set(rawFrontend.split(',').map(s => s.trim()).filter(Boolean))];

const normalizeOrigin = (origin) => origin.replace(/\/$/, '');
const normalizedOrigins = allowedOrigins.map(normalizeOrigin);

const wildcardOrigins = normalizedOrigins
  .filter(origin => origin.includes('*'))
  .map(pattern => new RegExp(`^${pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\\\*/g, '.*')}$`));

const allowedRailwayOrigin = normalizedOrigins.some(origin => origin.includes('railway.app') || origin.includes('railway.sh') || origin.includes('railway.com'));

console.log('🔧 CORS config: FRONTEND_URL=', rawFrontend);
console.log('🔧 CORS allowedOrigins=', normalizedOrigins);
console.log('🔧 CORS allow any Railway origin=', allowedRailwayOrigin);

app.use(cors({
  origin: (origin, callback) => {
    // Cho phép request không có origin (Postman, server-to-server, internal health check)
    if (!origin) return callback(null, true);

    if (allowedOrigins.length === 0 || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }

    const normalizedOrigin = normalizeOrigin(origin);
    if (normalizedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    if (wildcardOrigins.some(regex => regex.test(normalizedOrigin))) {
      return callback(null, true);
    }

    if (allowedRailwayOrigin && (
      normalizedOrigin.endsWith('.railway.app') ||
      normalizedOrigin.endsWith('.railway.sh') ||
      normalizedOrigin.endsWith('.railway.com')
    )) {
      return callback(null, true);
    }

    console.error(`🔴 [CORS BLOCKED]: Cửa ngõ bảo mật từ chối kết nối từ tên miền: ${origin}. Danh sách cho phép hiện tại:`, normalizedOrigins);
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
          let migrationSql = fs.readFileSync(path.join(migrationsPath, migrationFile), 'utf8');
          migrationSql = migrationSql.replace(/^\uFEFF/, '').trim();
          if (!migrationSql) {
            console.warn(`⚠️ Bỏ qua migration rỗng: ${migrationFile}`);
            continue;
          }
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
import posRouter from './routes/pos.js';

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
app.use('/api/pos', posRouter);
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