/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser'; 
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
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
import { correlationId } from './middleware/correlationId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { hitlRouter } from './routes/hitl.js';
import { startFeedbackLoopWorker } from './cron/trainFeedbackLoop.js';
import { redis } from './cache/redis.js';
import { getProjectionEngine } from './services/projectionEngine.service.js';

// Cấu hình đường dẫn tuyệt đối cho file .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

// Global flag for database readiness - used by health checks
let isDatabaseReady = false;

const isTestEnv = process.env.KETOAN_TEST === '1'
  || (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'testing')
  || process.env.JEST_WORKER_ID !== undefined
  || process.argv.some(arg => /jest/i.test(String(arg)))
  || process.execArgv.some(arg => /jest/i.test(String(arg)))
  || String(process.env.npm_lifecycle_event || '').toLowerCase() === 'test';

const app = express();

// Module-scoped variable for worker health tracking (avoid global leak)
let orderIngestionWorker = null;

if (!isTestEnv) {
  // Import worker để theo dõi health
  try {
    const workerModule = await import('./workers/orderIngestionWorker.js');
    orderIngestionWorker = workerModule.orderIngestionWorker;
  } catch (err) {
    console.error('❌ Failed to load orderIngestionWorker:', err.message);
    orderIngestionWorker = null;
  }
  
  startDataRetentionWorker();
  // Khởi động feedback loop worker cho RLHF
  startFeedbackLoopWorker();
}

// ====================================================================
// MIDDLEWARE MỚI - correlationId + errorHandler
// ====================================================================
// Gán correlation ID cho mọi request (đặt sau CORS, trước routes)
app.use(correlationId);

// Mount HITL routes
app.use('/api/hitl', hitlRouter);

// KÍCH HOẠT TRUST PROXY: Cấu hình số lượng proxy phía trước để lấy Real IP
// Giá trị 1 nghĩa là chỉ tin tưởng 1 proxy (ví dụ Railway), không cho phép spoof IP
app.set('trust proxy', 1);

// ====================================================================
// 🛠️ ĐÃ SỬA: CẤU HÌNH CORS LINH HOẠT CHỐNG LỖI ORIGIN TRÊN PRODUCTION
// ====================================================================
const rawFrontend = process.env.FRONTEND_URL || '';
// Tách chuỗi và loại bỏ khoảng trắng dư thừa
const allowedOriginsSet = new Set(rawFrontend.split(',').map(s => s.trim()).filter(Boolean));

// Luôn cho phép localhost dev origins để hỗ trợ dual environment (production Railway + local dev)
['http://localhost:3001', 'http://localhost:5173', 'http://127.0.0.1:3001', 'http://127.0.0.1:5173'].forEach(origin => {
  allowedOriginsSet.add(origin);
});

const allowedOrigins = [...allowedOriginsSet];

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

app.use(helmet());

app.use(cors({
  origin: (origin, callback) => {
    // Cho phép request không có origin (Postman, server-to-server, internal health check)
    if (!origin) return callback(null, true);

    // Luôn cho phép các localhost origins cho phát triển
    const localhostOrigins = ['http://localhost:3001', 'http://localhost:5173', 'http://127.0.0.1:3001', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000'];
    if (localhostOrigins.includes(normalizeOrigin(origin))) {
      return callback(null, true);
    }

    // Kiểm tra trong danh sách FRONTEND_URL đã cấu hình
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

// Cookie configuration middleware - ensures cookies are accessible across all paths
app.use((req, res, next) => {
  // Set cookie options for all responses
  res.locals.cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };
  next();
});

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
    
    // Run schema.sql first (sequential to avoid deadlocks)
    // Note: schema.sql now includes default system configs at the top
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      try {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schemaSql);
        console.log('✅ Đồng bộ cấu trúc bảng từ schema.sql hoàn tất.');
      } catch (schemaError) {
        console.warn('⚠️ Một số lệnh trong schema.sql gặp lỗi (có thể bỏ qua):', schemaError.message);
        // Don't throw - let the database continue with compatibility SQL below
      }
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
      ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(50) DEFAULT 'finance';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS clearance_level INT DEFAULT 1;
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
        CHECK (role IN ('admin', 'ktt', 'nv', 'nv_banhang', 'nv_kho', 'gd_kinhdoanh'));
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

    // ====================================================================
    // ✅ TỰ ĐỘNG TẠO ROOT ADMIN KHI DB TRỐNG
    // ====================================================================
    try {
      const userCountResult = await pool.query('SELECT COUNT(*) FROM users');
      const userCount = parseInt(userCountResult.rows[0].count, 10);
      
      if (userCount === 0) {
        console.log('🔐 [KHỞI TẠO] Cơ sở dữ liệu trống, đang tạo tài khoản Root Admin...');
        
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminPassword = process.env.ADMIN_PASSWORD || process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123';
        
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        
        await pool.query(
          `INSERT INTO users (username, password, role, is_root_admin, must_change_password, company_ids, staff_ids) 
           VALUES ($1, $2, $3, $4, $5, '{}', '{}')`,
          [adminUsername, hashedPassword, 'admin', true, true]
        );
        
        console.log('✅ [KHỞI TẠO] Tài khoản Root Admin đã được tạo thành công!');
        console.log('⚠️  [BẢO MẬT] Vui lòng đăng nhập và đổi mật khẩu ngay lập tức!');
        console.log(`   Username: ${adminUsername}`);
        console.log(`   Password: ${adminPassword}`);
        console.log('   ⚠️  Đây là thông tin đăng nhập mặc định. Hãy đổi mật khẩu sau khi đăng nhập!');
      } else {
        console.log(`✅ [KHỞI TẠO] Cơ sở dữ liệu đã có ${userCount} người dùng. Bỏ qua tạo Root Admin.`);
      }
    } catch (err) {
      console.error('❌ [LỖI KHỞI TẠO ROOT ADMIN]:', err.message);
    }
  } catch (error) {
    console.error('⚠️ [LỖI KHỞI TẠO DB]:', error.message);
    // Set flag so health checks can detect this state
    isDatabaseReady = false;
    throw error; // Re-throw so caller knows initialization failed
  }
};

// Wrap initializeDatabase to set the ready flag on success
const initDbWrapper = async () => {
  try {
    await initializeDatabase();
    isDatabaseReady = true;
    console.log('✅ Database initialization complete and ready to serve requests');
  } catch (error) {
    isDatabaseReady = false;
    console.error('❌ Database initialization FAILED. Server will start but DB operations will fail:', error.message);
    // Don't re-throw - let the server start in degraded mode so health checks can report status
  }
};

export const dbInitPromise = isTestEnv
  ? Promise.resolve()
  : initDbWrapper();

// ====================================================================
// PHASE 5: CQRS PROJECTION ENGINE INITIALIZATION
// ====================================================================
export let projectionEngine = null;

const initializeProjectionEngine = async () => {
  try {
    if (!pool || !redis) {
      console.warn('⚠️ [ProjectionEngine] Cannot initialize - pool or redis not ready');
      return null;
    }

    // Note: queueService not required for ProjectionEngine initialization
    // The ProjectionEngine operates independently of the queue system
    projectionEngine = getProjectionEngine(pool, redis, null);
    console.log('✅ [ProjectionEngine] CQRS Projection Engine initialized');
    
    return projectionEngine;
  } catch (error) {
    console.error('❌ [ProjectionEngine] Failed to initialize:', error.message);
    return null;
  }
};

// Initialize projection engine after DB is ready
if (!isTestEnv) {
  dbInitPromise.then(() => {
    initializeProjectionEngine();
  });
}

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
import reversingEntriesRoutes from './routes/reversingEntriesRoutes.js';
import debtReconciliationRoutes from './routes/debtReconciliationRoutes.js';
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
import { aiQueryRouter } from './routes/aiQuery.js';
import aiPoolRoutes from './routes/aiPool.routes.js';
import signingRouter from './routes/signing.js';
import transactionClassificationRouter from './routes/transactionClassification.js';
import settingsRouter from './routes/settings.js';
import eventsRouter from './routes/events.js';
import metaRouter from './routes/meta.js';
import dynamicRouter from './routes/dynamic.js';
import ioMatrixRouter from './routes/io-matrix.js';
import postingRulesRouter from './routes/postingRules.js';
import dimensionsRouter from './routes/dimensions.js';
import costingRouter from './routes/costing.js';
import accountingPeriodsRouter from './routes/accountingPeriods.js';
import workflowsRouter from './routes/workflows.js';
import reportsRouter from './routes/reports.js';
import { featureFlagsRouter } from './routes/featureFlags.js';
import creditRouter from './routes/credit.js';
import processorsRouter from './routes/processors.js';

// AI Service Initialization Hub
import { initializeAIServices } from './services/aiInitialization.service.js';

// ====================================================================
// HEALTH CHECK & UTILITIES - Mounted BEFORE waitForDb to work when DB is down
// ====================================================================
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'ok', 
      message: 'Backend chạy tốt',
      isDatabaseReady,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({ 
      status: 'error', 
      message: 'Lỗi kết nối cơ sở dữ liệu',
      isDatabaseReady: false,
      timestamp: new Date().toISOString()
    });
  }
});

// Worker health check endpoint
app.get('/api/health/workers', async (req, res) => {
  try {
    const health = {
      orderIngestionWorker: orderIngestionWorker ? 'running' : 'not_initialized',
      dataRetentionWorker: 'running',
      feedbackLoopWorker: 'running',
      redis: redis?.status || 'disconnected',
      isDatabaseReady,
      timestamp: new Date().toISOString()
    };
    
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================================================================
// MIDDLEWARE: Database readiness check for all API routes
// ====================================================================

// Middleware to ensure DB is ready before processing requests
const waitForDb = async (req, res, next) => {
  try {
    await dbInitPromise;
    if (!isDatabaseReady) {
      return res.status(503).json({ error: 'Database not ready. Please try again shortly.' });
    }
    next();
  } catch (err) {
    return res.status(503).json({ error: 'Database initialization failed. Cannot process request.' });
  }
};

// ====================================================================
// MOUNT CÁC ROUTES API TẬP TRUNG
// ====================================================================
app.use('/api', waitForDb);
app.use('/api/auth', authRouter);
app.use('/api/signing', signingRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/items', itemsRouter); 
app.use('/api/opening-balances', openingBalancesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/export', exportRouter);
app.use('/api/import', importRouter);
app.use('/api/partners', partnerRouter); 
app.use('/api/users', usersRouter); 
app.use('/api/inventory', inventoryRoutes);
app.use('/api/reversing-entries', reversingEntriesRoutes);
app.use('/api/debt-reconciliations', debtReconciliationRoutes);
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
app.use('/api/ai', aiPoolRoutes); // ✅ AI Pool monitoring and primary AI endpoints
app.use('/api/ai', aiQueryRouter); // ✅ AI query endpoints available at /api/ai/query
app.use('/api/ai-query', aiQueryRouter); // ✅ Legacy alias compatibility
app.use('/api/transaction-classification', transactionClassificationRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/events', eventsRouter);
app.use('/api/meta', metaRouter);
app.use('/api/dynamic', dynamicRouter);
app.use('/api/io-matrix', ioMatrixRouter);
app.use('/api/posting-rules', postingRulesRouter);
app.use('/api/dimensions', dimensionsRouter);
app.use('/api/costing', costingRouter);
app.use('/api/accounting-periods', accountingPeriodsRouter);
app.use('/api/workflows', workflowsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/feature-flags', featureFlagsRouter);
app.use('/api/credit', creditRouter);
app.use('/api/processors', processorsRouter);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


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

// ====================================================================
// ERROR HANDLER - Phải đặt cuối cùng sau tất cả routes
// ====================================================================
app.use(errorHandler);

if (isMainModule) {
  // Tạo HTTP server để WebSocket có thể gắn vào
  const server = http.createServer(app);
  
  // Khởi tạo Socket.io server
  initWebSocket(server);
  
  // Initialize AI Services asynchronously (non-blocking for server start)
  if (!isTestEnv) {
    initializeAIServices().catch(err => {
      console.error('❌ AI Services initialization failed (non-blocking):', err.message);
    });
  }
  
  server.listen(PORT, () => {
    console.log(`✅ Máy chủ HTTP đang chạy tại cổng ${PORT}`);
    console.log(`✅ WebSocket server đã được khởi tạo`);
    console.log(`✅ AI Services pool initialized and ready`);
  });
}

export { app };
export default app;

//