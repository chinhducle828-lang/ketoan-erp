/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser'; 
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs'; 
import { fileURLToPath } from 'url';
import http from 'http';

// 1. Cấu hình PG Pool từ thư mục config
import { pool } from './config/db.js';
import { validateBusinessRules } from './config/businessRules.js';
import { initWebSocket } from './services/websocket.service.js';
import { authenticate } from './middleware/auth.js';
import { waf } from './middleware/waf.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { startDataRetentionWorker } from './workers/dataRetentionWorker.js';

// Cấu hình đường dẫn tuyệt đối cho file .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const isTestEnv = process.env.KETOAN_TEST === '1'
  || (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'testing')
  || process.env.JEST_WORKER_ID !== undefined
  || process.argv.some(arg => /jest/i.test(String(arg)))
  || process.execArgv.some(arg => /jest/i.test(String(arg)))
  || String(process.env.npm_lifecycle_event || '').toLowerCase() === 'test';

const app = express();

if (!isTestEnv) {
  import('./workers/orderIngestionWorker.js');
  startDataRetentionWorker();
}

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

// P9: Trong production, chỉ cho phép origins đã cấu hình rõ ràng (không cho phép tất cả)
const isProduction = process.env.NODE_ENV === 'production';

console.log('🔧 CORS config: FRONTEND_URL=', rawFrontend);
console.log('🔧 CORS allowedOrigins=', normalizedOrigins);
console.log('🔧 CORS allow any Railway origin=', allowedRailwayOrigin);
console.log('🔧 CORS production strict mode=', isProduction);

app.use(cors({
  origin: (origin, callback) => {
    // Cho phép request không có origin (Postman, server-to-server, internal health check)
    if (!origin) return callback(null, true);

    // P9: Trong production, bắt buộc phải cấu hình FRONTEND_URL rõ ràng
    if (allowedOrigins.length === 0) {
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      console.error(`🔴 [CORS BLOCKED]: Production mode yêu cầu FRONTEND_URL phải được cấu hình. Origin bị từ chối: ${origin}`);
      return callback(new Error('CORS policy: origin not allowed in production'));
    }

    if (process.env.NODE_ENV !== 'production') {
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

// WAF & Rate Limiting (P2)
app.use(waf);
app.use('/api', apiRateLimiter);

// Constants dùng cho cookie
export const REFRESH_TOKEN_EXPIRE_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRE_DAYS) || 30;
export const REFRESH_COOKIE_NAME = 'refresh_token';

// Validate BUSINESS_RULES_JSON on startup
const validateRulesOnStartup = () => {
  if (process.env.BUSINESS_RULES_JSON) {
    try {
      const parsed = JSON.parse(process.env.BUSINESS_RULES_JSON);
      const errors = validateBusinessRules(parsed);
      if (errors.length > 0) {
        console.warn('⚠️ [CẢNH BÁO] Cấu hình BUSINESS_RULES_JSON có lỗi:');
        errors.forEach(err => console.warn(`  - ${err}`));
      } else {
        console.log('✅ [XÁC NHẬN] BUSINESS_RULES_JSON hợp lệ.');
      }
    } catch (e) {
      console.error('❌ [LỖI] BUSINESS_RULES_JSON không phải định dạng JSON hợp lệ:', e.message);
    }
  }
};

// Khởi tạo Database thông qua đọc file schema.sql bên ngoài
const initializeDatabase = async () => {
  try {
    // Validate rules first
    validateRulesOnStartup();
    
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
};

export const dbInitPromise = isTestEnv
  ? Promise.resolve()
  : initializeDatabase();

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
import notificationsRouter from './routes/notifications.js';
import accountingRouter from './routes/accounting.js';
import { cashflowRouter } from './routes/cashflow.js';
import { cassoRouter } from './routes/casso.js';
import integrationRouter from './routes/integration/index.js';
import { einvoiceRouter } from './routes/einvoice.js';
import { refundsRouter } from './routes/refunds.js';
import { legalPublicRouter } from './routes/legalPublic.js';

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
app.use('/api/notifications', notificationsRouter);
app.use('/api/accounting', accountingRouter);
app.use('/api/cashflow', cashflowRouter);
app.use('/api/casso', cassoRouter);
app.use('/api/integration', integrationRouter);
app.use('/api/e-invoices', einvoiceRouter);
app.use('/api/refunds', refundsRouter);
app.use('/api/public/legal', legalPublicRouter);
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

// ====================================================================
// ORDERS API - Lấy danh sách đơn hàng (ĐÃ BẢO VỆ)
// ====================================================================
app.get('/api/orders', authenticate, async (req, res) => {
  try {
    const { company_id, status, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params = [];
    let paramCount = 0;
    
    if (company_id) {
      paramCount++;
      query += ` AND company_id = $${paramCount}`;
      params.push(company_id);
    }
    
    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }
    
    paramCount++;
    query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
    params.push(parseInt(limit));
    
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(parseInt(offset));
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (err) {
    console.error('Lỗi lấy danh sách đơn hàng:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Lỗi lấy danh sách đơn hàng',
      error: err.message 
    });
  }
});

// Lấy chi tiết đơn hàng theo ID (ĐÃ BẢO VỆ)
app.get('/api/orders/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn hàng'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Lỗi lấy chi tiết đơn hàng:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy chi tiết đơn hàng',
      error: err.message
    });
  }
});

if (process.env.SERVE_STATIC_FRONTEND === 'true') {
  const possiblePaths = [
    path.join(__dirname, '..', 'front-end', 'dist'),
    path.join(__dirname, '..', 'dist'),
    path.join(__dirname, '..', 'storefront', 'dist'),
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
  // Tạo HTTP server để WebSocket có thể gắn vào
  const server = http.createServer(app);
  
  // Khởi tạo Socket.io server
  initWebSocket(server);
  
  server.listen(PORT, () => {
    console.log(`✅ Máy chủ HTTP đang chạy tại cổng ${PORT}`);
    console.log(`✅ WebSocket server đã được khởi tạo`);
  });
}

export { app };
export default app;

//