# Hướng dẫn Triển khai Production (Production Deployment Guide)

Tài liệu này hướng dẫn chi tiết cách chuẩn bị và triển khai hệ thống Ketoan ERP lên môi trường production.

## Mục lục
1. [Kiểm tra danh sách trước khi triển khai](#kiểm-tra-danh-sách-trước-khi-triển-khai)
2. [Chuẩn bị Environment Variables](#chuẩn-bị-environment-variables)
3. [Tối ưu Dockerfiles](#tối-ưu-dockerfiles)
4. [Bảo mật (Security Hardening)](#bảo-mật-security-hardening)
5. [Triển khai lên Railway](#triển-khai-lên-railway)
6. [Kiểm tra sau khi triển khai](#kiểm-tra-sau-khi-triển-khai)
7. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Kiểm tra danh sách trước khi triển khai

### ✅ Checklist bắt buộc

- [ ] **Database**
  - [ ] PostgreSQL database đã được tạo (Railway/Render/AWS RDS)
  - [ ] DATABASE_URL đã được cấu hình đúng
  - [ ] Database schema đã được khởi tạo (schema.sql)
  - [ ] Database user có quyền CREATE, SELECT, INSERT, UPDATE, DELETE

- [ ] **Authentication & Security**
  - [ ] JWT_SECRET đã được thay đổi (không dùng giá trị mặc định)
  - [ ] AI_INTERNAL_SECRET đã được tạo
  - [ ] ADMIN_PASSWORD đã được thay đổi (không dùng Admin@123)
  - [ ] CORS origins đã được cấu hình đúng (chỉ cho phép domain thật)
  - [ ] HTTPS đã được bật (SSL/TLS certificates)

- [ ] **API Keys & External Services**
  - [ ] Gemini API keys đã được thêm (GEMINI_KEYS)
  - [ ] Groq API keys đã được thêm (GROQ_KEYS)
  - [ ] Casso API key đã được cấu hình (nếu dùng thanh toán online)
  - [ ] Firebase FCM key đã được cấu hình (nếu dùng push notification)
  - [ ] VAPID keys đã được tạo (cho web push notifications)

- [ ] **Configuration**
  - [ ] Cấu hình system_configs đã được thiết lập (tax rates, currency, company info)
  - [ ] Feature flags đã được bật/tắt theo yêu cầu
  - [ ] Redis URL đã được cấu hình (nếu dùng caching)

- [ ] **Code & Dependencies**
  - [ ] Không có console.log thừa trong production code
  - [ ] Không có debug flags bật
  - [ ] Dependencies đã được cập nhật và kiểm tra lỗ hổng bảo mật
  - [ ] Tests đã pass

---

## Chuẩn bị Environment Variables

### 1. Backend (.env)

Tạo file `.env` trong thư mục `backend/` với các biến môi trường production:

```env
# ============================================
# SERVER CONFIGURATION
# ============================================
PORT=5000
NODE_ENV=production

# ============================================
# DATABASE CONFIGURATION
# ============================================
# Railway sẽ cung cấp DATABASE_URL tự động
DATABASE_URL=postgresql://postgres:password@host:port/railway

# Hoặc dùng individual variables nếu không dùng Railway
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=ketoan_db
# DB_USER=postgres
# DB_PASSWORD=your_secure_password
# DB_SSL=true

# ============================================
# SECURITY & AUTHENTICATION
# ============================================
# ⚠️ QUAN TRỌNG: Thay đổi JWT_SECRET thành giá trị ngẫu nhiên, dài và phức tạp
# Generate với: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your_very_long_and_random_secret_key_here_at_least_32_characters

# AI Service Internal Authentication
AI_INTERNAL_SECRET=your_ai_internal_secret_here_generate_with_crypto

# ============================================
# REDIS (Optional - for caching)
# ============================================
# Railway sẽ cung cấp REDIS_URL tự động
REDIS_URL=redis://localhost:6379

# ============================================
# CORS CONFIGURATION
# ============================================
# ⚠️ Chỉ cho phép domain thật của bạn
FRONTEND_URL=https://ketoanonline.up.railway.app,https://banhang.up.railway.app

# ============================================
# BACKEND URL CONFIGURATION
# ============================================
BACKEND_URL=https://dazzling-grace-production-03a5.up.railway.app

# ============================================
# ROOT ADMIN CREDENTIALS
# ============================================
# ⚠️ Thay đổi admin password ngay sau khi deploy lần đầu
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourSecurePassword123!@#

# ============================================
# CASSO OPEN BANKING (Optional)
# ============================================
CASSO_API_KEY=your_casso_api_key
PUBLIC_APP_URL=https://dazzling-grace-production-03a5.up.railway.app

# ============================================
# FIREBASE CLOUD MESSAGING (Optional)
# ============================================
FCM_SERVER_KEY=your_fcm_server_key

# ============================================
# WEB PUSH NOTIFICATIONS (VAPID)
# ============================================
# Generate với: node generate-vapid-keys.mjs
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:admin@ketoan-erp.com

# ============================================
# AI CONFIGURATION
# ============================================
# Gemini API Keys (comma-separated)
GEMINI_API_KEY=your_gemini_api_key
GEMINI_KEYS=key1,key2,key3

# Groq API Keys (comma-separated)
GROQ_KEYS=key1,key2,key3

# Cloudflare Proxy (recommended for production)
USE_CLOUDFLARE_PROXY=true
CLOUDFLARE_PROXY_URL=https://nvoice-ai-proxy.progefa.workers.dev/

# AI Concurrency & Retry
MAX_CONCURRENT_REQUESTS=5
AI_REQUEST_TIMEOUT=30000
AI_MAX_RETRIES=3
AI_RETRY_DELAY=1000

# Confidence Score Thresholds
AI_CONFIDENCE_AUTO_POSTED=95
AI_CONFIDENCE_HUMAN_REVIEW=80

# Amount Thresholds (VND)
AI_AMOUNT_AUTO_POSTED_MAX=5000000
AI_AMOUNT_HUMAN_REVIEW_MAX=50000000

# Cashflow Thresholds
AI_CASHFLOW_LARGE=100000000
AI_CASHFLOW_SHORTAGE_DAYS=30

# Inventory Thresholds
AI_INVENTORY_LOW_STOCK_DAYS=7
AI_INVENTORY_OVERSTOCK_DAYS=90

# Python AI Service URL
PYTHON_AI_SERVICE_URL=https://robust-dedication-production-6a94.up.railway.app
```

### 2. Frontend (.env)

Tạo file `.env` trong thư mục `front-end/`:

```env
# Production API URL
VITE_API_BASE_URL=https://dazzling-grace-production-03a5.up.railway.app/api

# Frontend URL
VITE_BASE_URL=/

# Storefront URL
VITE_STOREFRONT_URL=https://banhang.up.railway.app

# WebSocket Configuration
VITE_WS_URL=https://dazzling-grace-production-03a5.up.railway.app

# Web Push VAPID Public Key (must match backend)
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key_here

# Application Environment
VITE_ENV=production
```

### 3. Storefront (.env)

Tạo file `.env` trong thư mục `storefront/`:

```env
# API Configuration
VITE_API_BASE_URL=https://dazzling-grace-production-03a5.up.railway.app/api

# WebSocket Configuration
VITE_WS_URL=https://dazzling-grace-production-03a5.up.railway.app

# Storefront URL
VITE_STOREFRONT_URL=https://banhang.up.railway.app

# ERP URL for redirects
VITE_ERP_URL=https://ketoanonline.up.railway.app

# VAPID Public Key (must match backend)
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key_here

# Application Environment
VITE_ENV=production
```

---

## Tối ưu Dockerfiles

### 1. Backend Dockerfile (Dockerfile.backend)

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY backend/ .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })" || exit 1

# Start application
CMD ["node", "server.js"]
```

**Cải tiến:**
- ✅ Chạy với non-root user (bảo mật)
- ✅ Xóa npm cache để giảm image size
- ✅ Healthcheck sử dụng Node.js thay vì wget (không cần wget trong alpine)

### 2. Frontend Dockerfile (Dockerfile.frontend)

```dockerfile
FROM node:20.19-alpine AS builder

WORKDIR /app

# Copy package files
COPY front-end/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY front-end/ .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY front-end/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 3000

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

**Cải tiến:**
- ✅ Multi-stage build (giảm image size)
- ✅ Sử dụng nginx để serve static files (nhanh hơn node server)
- ✅ Không cần node_modules trong production

**Tạo file `front-end/nginx.conf`:**

```nginx
server {
    listen 3000;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Handle React Router (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy (optional, if needed)
    location /api/ {
        proxy_pass https://dazzling-grace-production-03a5.up.railway.app/api/;
        proxy_ssl_verify off;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 3. Storefront Dockerfile (Dockerfile.storefront)

```dockerfile
FROM node:20.19-alpine AS builder

WORKDIR /app

# Copy package files
COPY storefront/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY storefront/ .

# Build application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY storefront/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 3001

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

**Tạo file `storefront/nginx.conf`:**

```nginx
server {
    listen 3001;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Handle React Router (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass https://dazzling-grace-production-03a5.up.railway.app/api/;
        proxy_ssl_verify off;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## Bảo mật (Security Hardening)

### 1. Backend Security

#### a. Helmet.js Configuration

Đảm bảo `helmet` đã được cấu hình đúng trong `backend/server.js`:

```javascript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://dazzling-grace-production-03a5.up.railway.app"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false, // Cho phép embed từ domain khác nếu cần
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

#### b. Rate Limiting

```javascript
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100, // Giới hạn 100 requests mỗi IP trong 15 phút
  message: { error: 'Quá nhiều requests, vui lòng thử lại sau' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Slow down repeated requests
const slowDown = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50, // Sau 50 requests
  delayMs: 500 // Thêm 500ms delay cho mỗi request
});

app.use('/api/', slowDown);
```

#### c. Input Validation

Đảm bảo tất cả inputs đều được validate bằng `zod`:

```javascript
import { z } from 'zod';

// Example: Validate request body
const createInvoiceSchema = z.object({
  customer_id: z.number().positive(),
  amount: z.number().positive(),
  tax_rate: z.number().min(0).max(100),
  due_date: z.string().datetime()
});

app.post('/api/invoices', async (req, res) => {
  try {
    const validatedData = createInvoiceSchema.parse(req.body);
    // Process validated data
  } catch (error) {
    res.status(400).json({ error: 'Invalid input', details: error.errors });
  }
});
```

### 2. Database Security

#### a. Connection Pooling

```javascript
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
```

#### b. SQL Injection Prevention

Luôn sử dụng parameterized queries:

```javascript
// ✅ GOOD
const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

// ❌ BAD
const result = await pool.query(`SELECT * FROM users WHERE id = ${userId}`);
```

### 3. Environment Variables Security

#### a. Không commit .env files

Đảm bảo `.env` có trong `.gitignore`:

```gitignore
# Environment variables
.env
.env.local
.env.production
.env.*.local
```

#### b. Sử dụng strong secrets

```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate AI_INTERNAL_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate VAPID keys
node generate-vapid-keys.mjs
```

---

## Triển khai lên Railway

### 1. Chuẩn bị Railway Project

#### a. Tạo Railway Project

1. Đăng nhập [Railway.app](https://railway.app)
2. Tạo New Project
3. Chọn "Deploy from GitHub repo"
4. Connect repository của bạn

#### b. Thêm PostgreSQL Database

1. Trong Railway Project, click "New"
2. Chọn "Database" → "PostgreSQL"
3. Railway sẽ tự động tạo database và cung cấp `DATABASE_URL`

#### c. Thêm Redis (Optional)

1. Click "New"
2. Chọn "Database" → "Redis"
3. Railway sẽ cung cấp `REDIS_URL`

### 2. Cấu hình Environment Variables trên Railway

#### Backend Service

1. Click vào Backend service
2. Vào tab "Variables"
3. Thêm các biến môi trường:

```
NODE_ENV=production
JWT_SECRET=your_generated_secret_here
AI_INTERNAL_SECRET=your_generated_secret_here
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourSecurePassword123!@#
FRONTEND_URL=https://ketoanonline.up.railway.app
BACKEND_URL=https://dazzling-grace-production-03a5.up.railway.app
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
GEMINI_KEYS=key1,key2,key3
GROQ_KEYS=key1,key2,key3
USE_CLOUDFLARE_PROXY=true
CLOUDFLARE_PROXY_URL=https://nvoice-ai-proxy.progefa.workers.dev/
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:admin@ketoan-erp.com
FCM_SERVER_KEY=your_fcm_server_key
CASSO_API_KEY=your_casso_api_key
PUBLIC_APP_URL=https://dazzling-grace-production-03a5.up.railway.app
PYTHON_AI_SERVICE_URL=https://robust-dedication-production-6a94.up.railway.app
```

**Lưu ý:** Railway tự động inject `DATABASE_URL` và `REDIS_URL` từ các service đã tạo.

#### Frontend Service

1. Click vào Frontend service
2. Vào tab "Variables"
3. Thêm các biến môi trường:

```
VITE_API_BASE_URL=https://dazzling-grace-production-03a5.up.railway.app/api
VITE_BASE_URL=/
VITE_STOREFRONT_URL=https://banhang.up.railway.app
VITE_WS_URL=https://dazzling-grace-production-03a5.up.railway.app
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
VITE_ENV=production
```

#### Storefront Service

1. Click vào Storefront service
2. Vào tab "Variables"
3. Thêm các biến môi trường:

```
VITE_API_BASE_URL=https://dazzling-grace-production-03a5.up.railway.app/api
VITE_WS_URL=https://dazzling-grace-production-03a5.up.railway.app
VITE_STOREFRONT_URL=https://banhang.up.railway.app
VITE_ERP_URL=https://ketoanonline.up.railway.app
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key
VITE_ENV=production
```

### 3. Deploy

1. Railway sẽ tự động deploy khi bạn push code lên GitHub
2. Hoặc click "Deploy" button trong Railway dashboard
3. Theo dõi logs để đảm bảo không có lỗi

### 4. Custom Domains (Optional)

1. Vào service → "Settings" → "Domains"
2. Click "Add Domain"
3. Nhập domain của bạn (VD: `ketoan.yourcompany.com`)
4. Railway sẽ cung cấp DNS records để cấu hình

---

## Kiểm tra sau khi triển khai

### 1. Health Checks

```bash
# Backend health check
curl https://dazzling-grace-production-03a5.up.railway.app/api/health

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2026-07-21T10:00:00.000Z",
#   "uptime": 12345
# }
```

### 2. Database Connection

```bash
# Test database connection
curl https://dazzling-grace-production-03a5.up.railway.app/api/health/db

# Expected response:
# {
#   "status": "ok",
#   "database": "connected"
# }
```

### 3. Authentication

```bash
# Test login
curl -X POST https://dazzling-grace-production-03a5.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "YourSecurePassword123!@#"
  }'

# Expected: JWT token in response
```

### 4. API Endpoints

```bash
# Test config endpoint
curl https://dazzling-grace-production-03a5.up.railway.app/api/settings/config \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test invoices endpoint
curl https://dazzling-grace-production-03a5.up.railway.app/api/invoices \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Frontend

1. Mở browser và truy cập `https://ketoanonline.up.railway.app`
2. Kiểm tra:
   - [ ] Trang load không có lỗi
   - [ ] Login hoạt động
   - [ ] Các module chính hoạt động (Invoices, Accounting, etc.)
   - [ ] WebSocket connection thành công (kiểm tra console logs)

### 6. Storefront

1. Truy cập `https://banhang.up.railway.app`
2. Kiểm tra:
   - [ ] Trang load không có lỗi
   - [ ] EventSource connection thành công
   - [ ] Real-time updates hoạt động

---

## Monitoring & Maintenance

### 1. Logs

#### Railway Logs

```bash
# Xem logs real-time
railway logs --service backend

# Xem logs của frontend
railway logs --service frontend

# Xem logs của storefront
railway logs --service storefront
```

#### Application Logs

Backend sử dụng `pino` cho logging. Đảm bảo cấu hình log level đúng:

```javascript
// backend/server.js
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'production' 
    ? { target: 'pino-pretty' } 
    : { target: 'pino-pretty', options: { colorize: true } }
});
```

### 2. Metrics

#### Railway Metrics

1. Vào Railway dashboard
2. Chọn service → "Metrics"
3. Theo dõi:
   - CPU usage
   - Memory usage
   - Network traffic
   - Request count
   - Response time

#### Application Metrics

Thêm metrics tracking vào backend:

```javascript
// Track API response times
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`
    });
  });
  next();
});
```

### 3. Database Maintenance

#### Backup Database

```bash
# Backup từ Railway
railway connect postgres
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Hoặc dùng Railway CLI
railway run pg_dump $DATABASE_URL > backup.sql
```

#### Restore Database

```bash
psql $DATABASE_URL < backup.sql
```

#### Database Migration

Khi có schema changes:

```bash
# Tạo migration file
# backend/migrations/001_add_new_column.sql

ALTER TABLE invoices ADD COLUMN new_column VARCHAR(255);

# Chạy migration
railway run psql $DATABASE_URL -f backend/migrations/001_add_new_column.sql
```

### 4. Updates & Deployment

#### Update Backend

```bash
# Push code lên GitHub
git add .
git commit -m "feat: add new feature"
git push origin main

# Railway sẽ tự động deploy
```

#### Rollback nếu có lỗi

```bash
# Railway sẽ giữ các deployment trước
# Vào Railway dashboard → Deployments → Chọn deployment cũ → "Redeploy"
```

### 5. Monitoring Alerts

#### Railway Alerts

1. Vào Railway dashboard → "Notifications"
2. Cấu hình alerts cho:
   - Deployment failures
   - High CPU/Memory usage
   - Database connection errors
   - Health check failures

#### Uptime Monitoring

Sử dụng dịch vụ như:
- [UptimeRobot](https://uptimerobot.com)
- [Pingdom](https://www.pingdom.com)
- [StatusCake](https://www.statuscake.com)

Cấu hình monitors cho:
- Backend: `https://dazzling-grace-production-03a5.up.railway.app/api/health`
- Frontend: `https://ketoanonline.up.railway.app`
- Storefront: `https://banhang.up.railway.app`

---

## Troubleshooting Production Issues

### 1. Application won't start

```bash
# Check logs
railway logs --service backend

# Common issues:
# - Missing environment variables
# - Database connection failed
# - Port already in use
```

### 2. Database connection errors

```bash
# Verify DATABASE_URL
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check database logs
railway logs --service postgres
```

### 3. High memory usage

```bash
# Check memory usage
railway logs --service backend | grep -i "memory"

# Solutions:
# - Increase memory in Railway settings
# - Optimize database queries
# - Add Redis caching
```

### 4. Slow API responses

```bash
# Check database query performance
railway run psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE state = 'active'"

# Add indexes
railway run psql $DATABASE_URL -c "CREATE INDEX idx_invoices_date ON invoices(date)"
```

---

## Security Checklist

### Pre-deployment

- [ ] JWT_SECRET đã được thay đổi (32+ characters, random)
- [ ] AI_INTERNAL_SECRET đã được tạo
- [ ] ADMIN_PASSWORD đã được thay đổi
- [ ] HTTPS đã được bật (SSL/TLS)
- [ ] CORS chỉ cho phép domain thật
- [ ] Environment variables không được commit vào git
- [ ] Database credentials được bảo vệ
- [ ] API keys được lưu trong environment variables (không hardcode)
- [ ] Rate limiting đã được bật
- [ ] Input validation đã được implement
- [ ] SQL injection đã được phòng chống (parameterized queries)
- [ ] XSS protection đã được bật (helmet.js)
- [ ] CSRF protection đã được implement (nếu cần)

### Post-deployment

- [ ] Health check endpoint hoạt động
- [ ] HTTPS redirect hoạt động
- [ ] CORS headers đúng
- [ ] Security headers đúng (HSTS, CSP, etc.)
- [ ] Logs không chứa thông tin nhạy cảm
- [ ] Error messages không expose stack traces
- [ ] Database backups đã được cấu hình
- [ ] Monitoring alerts đã được setup

---

## Performance Optimization

### 1. Database

```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_invoices_date ON invoices(date);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_journal_entries_date ON journal_entries(date);
CREATE INDEX idx_users_email ON users(email);

-- Analyze tables for query optimization
ANALYZE invoices;
ANALYZE journal_entries;
ANALYZE users;
```

### 2. Caching

```javascript
// Sử dụng Redis cho caching
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Cache config values
async function getConfig(key, defaultValue) {
  const cached = await redis.get(`config:${key}`);
  if (cached) return cached;
  
  const value = await db.query('SELECT config_value FROM system_configs WHERE config_key = $1', [key]);
  const configValue = value.rows[0]?.config_value || defaultValue;
  
  await redis.setex(`config:${key}`, 3600, configValue); // Cache 1 hour
  return configValue;
}
```

### 3. API Response Compression

```javascript
import compression from 'compression';

app.use(compression({
  threshold: 1024, // Chỉ compress responses > 1KB
  level: 6 // Compression level (1-9)
}));
```

---

## Backup & Recovery

### 1. Automated Backups

#### Railway Automated Backups

1. Vào PostgreSQL service → "Backups"
2. Bật "Automated Backups"
3. Cấu hình retention period (7 days, 30 days, etc.)

#### Custom Backup Script

Tạo `backend/scripts/backup-db.sh`:

```bash
#!/bin/bash

# Database backup script
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"
BACKUP_FILE="$BACKUP_DIR/ketoan_db_$DATE.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
pg_dump $DATABASE_URL > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Delete backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

Chạy backup hàng ngày qua cron:

```bash
# Thêm vào crontab
0 2 * * * /path/to/ketoan/backend/scripts/backup-db.sh
```

### 2. Recovery

```bash
# Restore từ backup
gunzip -c ketoan_db_20260721_020000.sql.gz | psql $DATABASE_URL

# Verify restore
psql $DATABASE_URL -c "SELECT COUNT(*) FROM invoices;"
```

---

## Support & Documentation

- **Documentation**: https://docs.ketoan-erp.com
- **GitHub Issues**: https://github.com/chinhducle828-lang/ketoan-erp/issues
- **Email Support**: support@ketoan-erp.com
- **Railway Status**: https://railway.app/status

---

## Appendix: Environment Variables Reference

### Backend Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `NODE_ENV` | Yes | Environment mode | `production` |
| `PORT` | No | Server port | `5000` |
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://...` |
| `JWT_SECRET` | **Yes** | JWT signing secret (32+ chars) | `abc123...` |
| `AI_INTERNAL_SECRET` | **Yes** | AI service auth secret | `xyz789...` |
| `REDIS_URL` | No | Redis connection string | `redis://...` |
| `FRONTEND_URL` | **Yes** | Allowed CORS origins | `https://...` |
| `BACKEND_URL` | **Yes** | Backend API URL | `https://...` |
| `ADMIN_USERNAME` | No | Root admin username | `admin` |
| `ADMIN_PASSWORD` | No | Root admin password | `SecurePass123` |
| `GEMINI_KEYS` | No | Gemini API keys (comma-separated) | `key1,key2` |
| `GROQ_KEYS` | No | Groq API keys (comma-separated) | `key1,key2` |
| `VAPID_PUBLIC_KEY` | No | Web push public key | `BJVoG...` |
| `VAPID_PRIVATE_KEY` | No | Web push private key | `MgMCn...` |
| `FCM_SERVER_KEY` | No | Firebase Cloud Messaging key | `BD_5I...` |

### Frontend Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_API_BASE_URL` | **Yes** | Backend API URL | `https://.../api` |
| `VITE_BASE_URL` | Yes | Frontend base URL | `/` |
| `VITE_STOREFRONT_URL` | Yes | Storefront URL | `https://...` |
| `VITE_WS_URL` | **Yes** | WebSocket URL | `https://...` |
| `VITE_VAPID_PUBLIC_KEY` | No | Web push public key | `BJVoG...` |
| `VITE_ENV` | Yes | Environment mode | `production` |

### Storefront Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_API_BASE_URL` | **Yes** | Backend API URL | `https://.../api` |
| `VITE_WS_URL` | **Yes** | WebSocket URL | `https://...` |
| `VITE_STOREFRONT_URL` | Yes | Storefront URL | `https://...` |
| `VITE_ERP_URL` | No | ERP URL for redirects | `https://...` |
| `VITE_VAPID_PUBLIC_KEY` | No | Web push public key | `BJVoG...` |
| `VITE_ENV` | Yes | Environment mode | `production` |

---

**Last Updated**: 2026-07-21
**Version**: 1.0.0
**Maintained By**: Ketoan ERP Team