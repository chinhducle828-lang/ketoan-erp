# Production Readiness Checklist

Tài liệu này cung cấp checklist toàn diện để đảm bảo hệ thống Ketoan ERP sẵn sàng cho production.

## Mục lục
1. [Tổng quan](#tổng-quan)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Build Configuration](#build-configuration)
4. [Deployment Verification](#deployment-verification)
5. [Post-Deployment Testing](#post-deployment-testing)
6. [Monitoring Setup](#monitoring-setup)
7. [Rollback Plan](#rollback-plan)

---

## Tổng quan

Checklist này đảm bảo tất cả các thành phần đã được chuẩn bị đầy đủ trước khi đưa hệ thống lên production.

**Trạng thái hiện tại:**
- ✅ Environment configuration files reviewed
- ✅ Dockerfiles optimized for production
- ✅ Security hardening implemented
- ✅ Production deployment guide created
- ✅ Sensitive data handling verified
- ⏳ Build configuration testing (in progress)

---

## Pre-Deployment Checklist

### ✅ Code Quality

- [x] **No console.log in production code**
  - Backend uses Pino structured logger
  - Test scripts may use console.log (acceptable)
  - Status: Verified - no critical console.log in production paths

- [x] **Error handling implemented**
  - Centralized error handler in `backend/middleware/errorHandler.js`
  - Stack traces hidden in production
  - Standardized error responses

- [x] **Input validation**
  - Zod schemas for all endpoints
  - SQL injection prevention (parameterized queries)
  - XSS prevention

- [x] **Authentication & Authorization**
  - JWT tokens with secure secret
  - Session validation in database
  - Role-based access control

### ✅ Security

- [x] **Secrets Management**
  - JWT_SECRET: Must be 32+ characters, random
  - AI_INTERNAL_SECRET: Generated with crypto
  - ADMIN_PASSWORD: Changed from default
  - All secrets in environment variables
  - No hardcoded secrets in code
  - `.env` files in `.gitignore`

- [x] **HTTPS/SSL**
  - Railway provides automatic SSL
  - HSTS enabled via Helmet.js
  - Secure cookies in production

- [x] **CORS**
  - Whitelist-based origin control
  - Only production domains in FRONTEND_URL
  - Credentials enabled

- [x] **Rate Limiting**
  - Redis-based rate limiting
  - Sensitive endpoints have stricter limits
  - Lua scripts for atomic operations

- [x] **Security Headers**
  - Helmet.js configured
  - X-Frame-Options: SAMEORIGIN
  - X-Content-Type-Options: nosniff
  - X-XSS-Protection: 1; mode=block
  - HSTS enabled

- [x] **Database Security**
  - Connection pooling configured
  - SSL enabled in production
  - Parameterized queries
  - Minimal user permissions

### ✅ Dependencies

- [x] **Backend dependencies** (`backend/package.json`)
  - Node.js >= 18.0.0
  - All dependencies up to date
  - No critical vulnerabilities

- [x] **Frontend dependencies** (`front-end/package.json`)
  - Node.js >= 20.19.0
  - React 18.2.0
  - Vite 5.2.0

- [x] **Storefront dependencies** (`storefront/package.json`)
  - Node.js >= 20.19.0
  - React 18.2.0
  - Vite 5.2.0

### ✅ Configuration Files

- [x] **Environment files**
  - `backend/.env.example` - Complete
  - `front-end/.env.example` - Complete
  - `storefront/.env.example` - Complete

- [x] **Dockerfiles**
  - `Dockerfile.backend` - Optimized with non-root user
  - `Dockerfile.frontend` - Multi-stage build with nginx
  - `Dockerfile.storefront` - Multi-stage build with nginx

- [x] **Nginx configurations**
  - `front-end/nginx.conf` - Created
  - `storefront/nginx.conf` - Created

- [x] **Gitignore**
  - Comprehensive `.gitignore` created
  - All `.env` files ignored
  - Secrets and keys ignored

### ✅ Documentation

- [x] **Config Management** (`docs/CONFIG_MANAGEMENT.md`)
  - How to set config values
  - SQL examples
  - API examples
  - Admin UI instructions

- [x] **Production Deployment** (`docs/PRODUCTION_DEPLOYMENT.md`)
  - Environment variables setup
  - Railway deployment steps
  - Health check procedures
  - Monitoring setup

- [x] **Security Hardening** (`docs/SECURITY_HARDENING.md`)
  - Security measures implemented
  - Best practices
  - Vulnerability scanning
  - Incident response

---

## Build Configuration

### Backend Build

**File: `Dockerfile.backend`**

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

**Build command:**
```bash
docker build -f Dockerfile.backend -t ketoan-backend .
```

**Expected image size:** ~200-300MB (optimized with alpine)

### Frontend Build

**File: `Dockerfile.frontend`**

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

**Build command:**
```bash
docker build -f Dockerfile.frontend -t ketoan-frontend .
```

**Expected image size:** ~50-100MB (nginx alpine + static files)

### Storefront Build

**File: `Dockerfile.storefront`**

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

**Build command:**
```bash
docker build -f Dockerfile.storefront -t ketoan-storefront .
```

**Expected image size:** ~50-100MB (nginx alpine + static files)

### Build Testing

#### Test Backend Build

```bash
# Build image
docker build -f Dockerfile.backend -t ketoan-backend:test .

# Run container
docker run -d -p 5000:5000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e JWT_SECRET=test_secret_123456789012345678901234567890 \
  -e NODE_ENV=production \
  --name ketoan-backend-test \
  ketoan-backend:test

# Check logs
docker logs ketoan-backend-test

# Test health endpoint
curl http://localhost:5000/api/health

# Cleanup
docker stop ketoan-backend-test
docker rm ketoan-backend-test
docker rmi ketoan-backend:test
```

**Expected output:**
```json
{
  "status": "ok",
  "message": "Backend chạy tốt",
  "isDatabaseReady": true,
  "timestamp": "2026-07-21T10:00:00.000Z"
}
```

#### Test Frontend Build

```bash
# Build image
docker build -f Dockerfile.frontend -t ketoan-frontend:test .

# Run container
docker run -d -p 3000:3000 --name ketoan-frontend-test ketoan-frontend:test

# Check logs
docker logs ketoan-frontend-test

# Test HTTP response
curl -I http://localhost:3000

# Cleanup
docker stop ketoan-frontend-test
docker rm ketoan-frontend-test
docker rmi ketoan-frontend:test
```

**Expected output:**
```
HTTP/1.1 200 OK
Server: nginx
Content-Type: text/html
```

#### Test Storefront Build

```bash
# Build image
docker build -f Dockerfile.storefront -t ketoan-storefront:test .

# Run container
docker run -d -p 3001:3001 --name ketoan-storefront-test ketoan-storefront:test

# Check logs
docker logs ketoan-storefront-test

# Test HTTP response
curl -I http://localhost:3001

# Cleanup
docker stop ketoan-storefront-test
docker rm ketoan-storefront-test
docker rmi ketoan-storefront:test
```

**Expected output:**
```
HTTP/1.1 200 OK
Server: nginx
Content-Type: text/html
```

---

## Deployment Verification

### Railway Deployment Checklist

#### 1. Backend Service

- [ ] **Service created**
  - Name: `backend`
  - Dockerfile: `Dockerfile.backend`
  - Port: 5000

- [ ] **Environment variables set**
  ```
  NODE_ENV=production
  JWT_SECRET=<generated_secret>
  AI_INTERNAL_SECRET=<generated_secret>
  DATABASE_URL=${{Postgres.DATABASE_URL}}
  REDIS_URL=${{Redis.REDIS_URL}}
  FRONTEND_URL=https://ketoanonline.up.railway.app,https://banhang.up.railway.app
  BACKEND_URL=https://dazzling-grace-production-03a5.up.railway.app
  ADMIN_USERNAME=admin
  ADMIN_PASSWORD=<secure_password>
  GEMINI_KEYS=<your_keys>
  GROQ_KEYS=<your_keys>
  VAPID_PUBLIC_KEY=<your_key>
  VAPID_PRIVATE_KEY=<your_key>
  ```

- [ ] **Health check configured**
  - Path: `/api/health`
  - Timeout: 100s

- [ ] **Deployment successful**
  - No errors in logs
  - Health check passing

#### 2. Frontend Service

- [ ] **Service created**
  - Name: `frontend`
  - Dockerfile: `Dockerfile.frontend`
  - Port: 3000

- [ ] **Environment variables set**
  ```
  VITE_API_BASE_URL=https://dazzling-grace-production-03a5.up.railway.app/api
  VITE_BASE_URL=/
  VITE_STOREFRONT_URL=https://banhang.up.railway.app
  VITE_WS_URL=https://dazzling-grace-production-03a5.up.railway.app
  VITE_VAPID_PUBLIC_KEY=<your_key>
  VITE_ENV=production
  ```

- [ ] **Health check configured**
  - Path: `/`
  - Timeout: 100s

- [ ] **Deployment successful**
  - No errors in logs
  - Site loads correctly

#### 3. Storefront Service

- [ ] **Service created**
  - Name: `storefront`
  - Dockerfile: `Dockerfile.storefront`
  - Port: 3001

- [ ] **Environment variables set**
  ```
  VITE_API_BASE_URL=https://dazzling-grace-production-03a5.up.railway.app/api
  VITE_WS_URL=https://dazzling-grace-production-03a5.up.railway.app
  VITE_STOREFRONT_URL=https://banhang.up.railway.app
  VITE_ERP_URL=https://ketoanonline.up.railway.app
  VITE_VAPID_PUBLIC_KEY=<your_key>
  VITE_ENV=production
  ```

- [ ] **Health check configured**
  - Path: `/`
  - Timeout: 100s

- [ ] **Deployment successful**
  - No errors in logs
  - Site loads correctly

#### 4. Database

- [ ] **PostgreSQL service created**
  - Database name: `railway` (or custom)
  - Connection string available

- [ ] **Schema initialized**
  - `schema.sql` executed successfully
  - All tables created
  - Indexes created

- [ ] **Database migrations run**
  - All migration files executed
  - No errors

- [ ] **Root admin created**
  - Admin user exists
  - Password changed from default

#### 5. Redis (Optional)

- [ ] **Redis service created**
  - Connection string available

- [ ] **Connection tested**
  - Backend can connect to Redis
  - Caching working

---

## Post-Deployment Testing

### 1. Health Checks

```bash
# Backend health
curl https://dazzling-grace-production-03a5.up.railway.app/api/health

# Expected: {"status":"ok","isDatabaseReady":true,...}

# Database health
curl https://dazzling-grace-production-03a5.up.railway.app/api/health/db

# Expected: {"status":"ok","database":"connected"}
```

### 2. Authentication

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

### 3. API Endpoints

```bash
# Test config endpoint (with token)
TOKEN=<your_token>
curl https://dazzling-grace-production-03a5.up.railway.app/api/settings/config \
  -H "Authorization: Bearer $TOKEN"

# Expected: Config data in JSON format
```

### 4. Frontend

- [ ] **Site loads**
  - Navigate to `https://ketoanonline.up.railway.app`
  - No console errors
  - No 404s for static assets

- [ ] **Login works**
  - Enter credentials
  - Successfully authenticated
  - Redirected to dashboard

- [ ] **Navigation works**
  - All menu items accessible
  - No broken links

- [ ] **WebSocket connection**
  - Real-time updates working
  - No connection errors

### 5. Storefront

- [ ] **Site loads**
  - Navigate to `https://banhang.up.railway.app`
  - No console errors
  - No 404s for static assets

- [ ] **EventSource connection**
  - Real-time updates working
  - No connection errors

- [ ] **API proxy**
  - API calls working through nginx proxy
  - No CORS errors

### 6. Security Tests

```bash
# Test CORS
curl -H "Origin: https://malicious-site.com" \
  -H "Access-Control-Request-Method: POST" \
  -X OPTIONS \
  https://dazzling-grace-production-03a5.up.railway.app/api/auth/login

# Expected: CORS blocked (no Access-Control-Allow-Origin header)

# Test rate limiting
for i in {1..20}; do
  curl -X POST https://dazzling-grace-production-03a5.up.railway.app/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test"}'
done

# Expected: 429 Too Many Requests after 15 requests

# Test security headers
curl -I https://dazzling-grace-production-03a5.up.railway.app

# Expected headers:
# X-Frame-Options: SAMEORIGIN
# X-Content-Type-Options: nosniff
# X-XSS-Protection: 1; mode=block
# Strict-Transport-Security: max-age=31536000
```

---

## Monitoring Setup

### 1. Railway Metrics

- [ ] **CPU/Memory monitoring**
  - Check Railway dashboard
  - Set alerts for high usage

- [ ] **Network traffic**
  - Monitor request count
  - Monitor response times

- [ ] **Error rates**
  - Monitor 4xx/5xx errors
  - Set alerts for spikes

### 2. Application Logs

- [ ] **Log collection**
  - Logs visible in Railway dashboard
  - No sensitive data in logs

- [ ] **Log levels**
  - Production: info or warn
  - Development: debug

### 3. Uptime Monitoring

- [ ] **UptimeRobot / Pingdom**
  - Monitor backend: `https://dazzling-grace-production-03a5.up.railway.app/api/health`
  - Monitor frontend: `https://ketoanonline.up.railway.app`
  - Monitor storefront: `https://banhang.up.railway.app`

- [ ] **Alerts configured**
  - Email notifications
  - SMS notifications (optional)

### 4. Database Monitoring

- [ ] **Connection pool**
  - Monitor active connections
  - Monitor connection wait time

- [ ] **Query performance**
  - Monitor slow queries
  - Add indexes if needed

- [ ] **Backups**
  - Automated backups enabled
  - Backup retention configured

---

## Rollback Plan

### 1. Railway Rollback

```bash
# Via Railway CLI
railway rollback --service backend

# Or via Railway dashboard
# Deployments → Select previous deployment → Redeploy
```

### 2. Git Rollback

```bash
# Revert last commit
git revert HEAD
git push origin main

# Or reset to specific commit
git reset --hard <commit-hash>
git push origin main --force
```

### 3. Database Rollback

```bash
# Restore from backup
gunzip -c backup_20260721_020000.sql.gz | psql $DATABASE_URL

# Verify restore
psql $DATABASE_URL -c "SELECT COUNT(*) FROM invoices;"
```

### 4. Emergency Contacts

- **Railway Support**: https://railway.app/support
- **Database Admin**: [Your DBA contact]
- **DevOps Team**: [Your DevOps contact]

---

## Performance Targets

### API Response Times

| Endpoint | Target | Acceptable |
|----------|--------|------------|
| Health check | <100ms | <200ms |
| Login | <500ms | <1000ms |
| List invoices | <300ms | <500ms |
| Create invoice | <500ms | <1000ms |
| Reports | <2000ms | <3000ms |

### Frontend Performance

| Metric | Target | Acceptable |
|--------|--------|------------|
| First Contentful Paint | <1.5s | <2.5s |
| Largest Contentful Paint | <2.5s | <4.0s |
| Time to Interactive | <3.5s | <5.0s |
| Cumulative Layout Shift | <0.1 | <0.25 |

### Database Performance

| Metric | Target | Acceptable |
|--------|--------|------------|
| Connection pool usage | <80% | <90% |
| Query execution time | <100ms | <500ms |
| Slow queries | 0 | <10 |

---

## Final Sign-Off

### Technical Lead

- [ ] Code review completed
- [ ] Security review completed
- [ ] Performance testing completed
- [ ] Documentation reviewed

**Signed:** ____________________
**Date:** ____________________

### DevOps

- [ ] Infrastructure ready
- [ ] Deployment pipeline tested
- [ ] Monitoring configured
- [ ] Backup strategy implemented

**Signed:** ____________________
**Date:** ____________________

### Product Owner

- [ ] Features verified
- [ ] User acceptance testing passed
- [ ] Documentation complete

**Signed:** ____________________
**Date:** ____________________

---

## Appendix: Quick Reference

### Environment Variables Checklist

**Backend:**
- [ ] NODE_ENV=production
- [ ] JWT_SECRET (32+ chars, random)
- [ ] AI_INTERNAL_SECRET (generated with crypto)
- [ ] DATABASE_URL (from Railway)
- [ ] REDIS_URL (from Railway, optional)
- [ ] FRONTEND_URL (production domains only)
- [ ] BACKEND_URL (Railway URL)
- [ ] ADMIN_USERNAME=admin
- [ ] ADMIN_PASSWORD (secure, changed from default)
- [ ] GEMINI_KEYS (comma-separated)
- [ ] GROQ_KEYS (comma-separated)
- [ ] VAPID_PUBLIC_KEY
- [ ] VAPID_PRIVATE_KEY
- [ ] FCM_SERVER_KEY (optional)
- [ ] CASSO_API_KEY (optional)

**Frontend:**
- [ ] VITE_API_BASE_URL
- [ ] VITE_BASE_URL=/
- [ ] VITE_STOREFRONT_URL
- [ ] VITE_WS_URL
- [ ] VITE_VAPID_PUBLIC_KEY
- [ ] VITE_ENV=production

**Storefront:**
- [ ] VITE_API_BASE_URL
- [ ] VITE_WS_URL
- [ ] VITE_STOREFRONT_URL
- [ ] VITE_ERP_URL
- [ ] VITE_VAPID_PUBLIC_KEY
- [ ] VITE_ENV=production

### Important URLs

- **Backend API**: https://dazzling-grace-production-03a5.up.railway.app
- **Frontend**: https://ketoanonline.up.railway.app
- **Storefront**: https://banhang.up.railway.app
- **Railway Dashboard**: https://railway.app
- **Database**: Railway PostgreSQL service
- **Redis**: Railway Redis service (optional)

### Support Resources

- **Documentation**: `docs/` folder
- **Config Management**: `docs/CONFIG_MANAGEMENT.md`
- **Deployment Guide**: `docs/PRODUCTION_DEPLOYMENT.md`
- **Security Guide**: `docs/SECURITY_HARDENING.md`
- **GitHub Issues**: https://github.com/chinhducle828-lang/ketoan-erp/issues

---

**Last Updated**: 2026-07-21
**Version**: 1.0.0
**Status**: Ready for Production Deployment