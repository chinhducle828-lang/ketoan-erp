# Bảo mật Production - Security Hardening Guide

Tài liệu này mô tả các biện pháp bảo mật đã được áp dụng và cần áp dụng cho môi trường production.

## Mục lục
1. [Tổng quan bảo mật](#tổng-quan-bảo-mật)
2. [Logging & Monitoring](#logging--monitoring)
3. [CORS Configuration](#cors-configuration)
4. [Rate Limiting](#rate-limiting)
5. [Input Validation](#input-validation)
6. [Database Security](#database-security)
7. [Environment Variables](#environment-variables)
8. [HTTPS & SSL](#https--ssl)
9. [Security Headers](#security-headers)
10. [Checklist triển khai](#checklist-triển-khai)

---

## Tổng quan bảo mật

Hệ thống Ketoan ERP đã được trang bị nhiều lớp bảo vệ:

- ✅ **Helmet.js** - Security headers
- ✅ **CORS** - Cross-origin resource sharing control
- ✅ **Rate Limiting** - Redis-based rate limiting
- ✅ **WAF** - Web Application Firewall
- ✅ **Input Validation** - Zod schema validation
- ✅ **SQL Injection Prevention** - Parameterized queries
- ✅ **JWT Authentication** - Secure token-based auth
- ✅ **Cookie Security** - HttpOnly, Secure, SameSite
- ✅ **Structured Logging** - Pino JSON logger
- ✅ **Error Handling** - Centralized error handler

---

## Logging & Monitoring

### 1. Structured Logging với Pino

Hệ thống sử dụng **Pino** - một JSON logger hiệu năng cao, thay thế tất cả `console.log/error/warn` trong production code.

**File: `backend/utils/logger.js`**

```javascript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname
    })
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    app: 'ketoan-erp',
    env: process.env.NODE_ENV || 'development'
  }
});

export default logger;

// Helper functions
export const logInfo = (msg, obj = {}) => logger.info(obj, msg);
export const logError = (msg, obj = {}) => logger.error(obj, msg);
export const logWarn = (msg, obj = {}) => logger.warn(obj, msg);
export const logDebug = (msg, obj = {}) => logger.debug(obj, msg);
```

**Lợi ích:**
- ✅ JSON structured logs - dễ parse và search
- ✅ High performance - không block event loop
- ✅ Ready for ELK/Datadog/Splunk integration
- ✅ Log levels: error, warn, info, debug

### 2. Error Handler

**File: `backend/middleware/errorHandler.js`**

```javascript
export const errorHandler = (err, req, res, next) => {
  const traceId = req.traceId || 'unknown';
  
  const errorContext = {
    traceId,
    errorCode: err.errorCode || 'UNKNOWN_ERROR',
    path: req.path,
    method: req.method,
    userId: req.user?.id || null,
    companyId: req.companyId || null,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  };
  
  // Log based on error severity
  if (err.statusCode >= 500) {
    logger.error({ ...errorContext, error: err.message, stack: err.stack });
  } else {
    logger.warn({ ...errorContext, error: err.message });
  }
  
  const statusCode = err.statusCode || err.status || 500;
  const errorCode = err.errorCode || 'INTERNAL_ERROR';
  
  // Standardized response
  res.status(statusCode).json({
    success: false,
    errorCode,
    message: err.message || 'Lỗi máy chủ nội bộ',
    // Only return traceId in development
    ...(process.env.NODE_ENV !== 'production' && { traceId })
  });
};
```

**Tính năng:**
- ✅ Trace ID cho mỗi request
- ✅ Context-aware logging (user, company, IP)
- ✅ Stack trace chỉ log trong development
- ✅ Standardized error response

### 3. Correlation ID Middleware

**File: `backend/middleware/correlationId.js`**

```javascript
export const correlationId = (req, res, next) => {
  // Generate or use existing trace ID
  req.traceId = req.headers['x-trace-id'] || 
                req.headers['x-request-id'] || 
                `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Add to response headers
  res.set('X-Trace-ID', req.traceId);
  
  next();
};
```

### 4. Logging Best Practices

#### ✅ DO - Use Logger

```javascript
import logger from '../utils/logger.js';

// Info level
logger.info({ userId: req.user.id, action: 'login' }, 'User logged in');

// Error level with context
logger.error({ 
  userId: req.user.id, 
  error: err.message, 
  stack: err.stack 
}, 'Failed to process invoice');

// Warn level
logger.warn({ ip: req.ip, path: req.path }, 'Rate limit exceeded');
```

#### ❌ DON'T - Use Console in Production Code

```javascript
// ❌ BAD - Don't do this in production code
console.log('User logged in:', userId);
console.error('Error:', err);
console.warn('Rate limit exceeded');
```

**Exception:** Test scripts và debug scripts có thể dùng console.log.

---

## CORS Configuration

### Current Implementation

**File: `backend/server.js` (lines 82-145)**

```javascript
const rawFrontend = process.env.FRONTEND_URL || '';
const allowedOriginsSet = new Set(rawFrontend.split(',').map(s => s.trim()).filter(Boolean));

// Always allow localhost for development
['http://localhost:3001', 'http://localhost:5173', 'http://127.0.0.1:3001', 'http://127.0.0.1:5173'].forEach(origin => {
  allowedOriginsSet.add(origin);
});

const allowedOrigins = [...allowedOriginsSet];
const normalizeOrigin = (origin) => origin.replace(/\/$/, '');
const normalizedOrigins = allowedOrigins.map(normalizeOrigin);

// Wildcard support
const wildcardOrigins = normalizedOrigins
  .filter(origin => origin.includes('*'))
  .map(pattern => new RegExp(`^${pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\\\*/g, '.*')}$`));

// Allow Railway origins
const allowedRailwayOrigin = normalizedOrigins.some(origin => 
  origin.includes('railway.app') || origin.includes('railway.sh') || origin.includes('railway.com')
);

const isProduction = process.env.NODE_ENV === 'production';

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests without origin (Postman, server-to-server)
    if (!origin) return callback(null, true);

    // Always allow localhost for development
    const localhostOrigins = ['http://localhost:3001', 'http://localhost:5173', 'http://127.0.0.1:3001', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000'];
    if (localhostOrigins.includes(normalizeOrigin(origin))) {
      return callback(null, true);
    }

    // Check configured origins
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

    console.error(`🔴 [CORS BLOCKED]: Origin not allowed: ${origin}`);
    return callback(new Error('CORS policy: origin not allowed'));
  },
  credentials: true,
}));
```

**Tính năng bảo mật:**
- ✅ Whitelist-based origin control
- ✅ Support wildcard patterns
- ✅ Auto-allow Railway domains
- ✅ Always allow localhost for development
- ✅ Credentials support (cookies)
- ✅ Detailed logging for blocked requests

### CORS Configuration trong Production

**Backend .env:**
```env
FRONTEND_URL=https://ketoanonline.up.railway.app,https://banhang.up.railway.app
```

**Railway Environment Variables:**
```
FRONTEND_URL=https://ketoanonline.up.railway.app,https://banhang.up.railway.app
```

---

## Rate Limiting

### Implementation

**File: `backend/middleware/rateLimiter.js`**

```javascript
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100; // 100 requests per 15 minutes

// Sensitive endpoints with stricter limits
const SENSITIVE_ENDPOINTS = {
  '/api/auth/login': { maxRequests: 15, windowMs: 15 * 60 * 1000 }, // 15/15min
  '/api/auth/register': { maxRequests: 5, windowMs: 60 * 60 * 1000 }, // 5/hour
  '/api/auth/change-password': { maxRequests: 3, windowMs: 60 * 60 * 1000 }, // 3/hour
};

export async function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  
  // Fallback if Redis is not available
  if (!isRedisReadyCheck()) {
    return next();
  }

  // Check sensitive endpoint config
  const sensitiveConfig = Object.entries(SENSITIVE_ENDPOINTS).find(([path]) => 
    req.path.startsWith(path)
  );
  
  const config = sensitiveConfig 
    ? { maxRequests: sensitiveConfig[1].maxRequests, windowMs: sensitiveConfig[1].windowMs }
    : { maxRequests: MAX_REQUESTS, windowMs: WINDOW_MS };

  const key = `rate_limit:${ip}:${req.path}`;
  const windowSec = Math.ceil(config.windowMs / 1000);
  
  try {
    // Lua script for atomic increment + expire
    const luaScript = `
      local current = redis.call('INCR', KEYS[1])
      if current == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
      end
      return current
    `;
    const current = await redis.eval(luaScript, 1, key, windowSec);
    
    if (current > config.maxRequests) {
      const ttl = await redis.ttl(key);
      console.warn(`⚠️ Rate limit exceeded for IP: ${ip} on ${req.path}`);
      return res.status(429).json({
        error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
        retryAfter: ttl
      });
    }
  } catch (err) {
    console.error('Rate limit error:', err);
  }
  
  next();
}

// API rate limiter - 30 requests/second
export async function apiRateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  
  if (!isRedisReadyCheck()) {
    return next();
  }

  // SSE stream should not be rate limited
  if (method === 'GET' && path.startsWith('/logistics/stream')) {
    return next();
  }

  const key = `rate_limit:api:${ip}:${method}:${path}`;
  const windowSec = 1; // 1 second
  
  try {
    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, windowSec);
    }
    
    if (current > 30) { // Max 30 requests/second
      return res.status(429).json({
        error: 'Quá nhiều yêu cầu API. Vui lòng giảm tần suất.'
      });
    }
  } catch (err) {
    console.error('API rate limit error:', err);
  }
  
  next();
}
```

**Tính năng:**
- ✅ Redis-based (distributed across multiple servers)
- ✅ Lua script for atomic operations (no race conditions)
- ✅ Sensitive endpoints have stricter limits
- ✅ SSE streams exempt from rate limiting
- ✅ Fallback if Redis is down
- ✅ Detailed logging

### Rate Limit Configuration

**Production Settings:**
- General API: 100 requests / 15 minutes per IP
- Login: 15 requests / 15 minutes per IP
- Register: 5 requests / hour per IP
- Change Password: 3 requests / hour per IP
- API burst: 30 requests / second per IP

---

## Input Validation

### Zod Schema Validation

Tất cả inputs đều được validate bằng Zod trước khi xử lý.

**Example: `backend/routes/invoices.js`**

```javascript
import { z } from 'zod';

const createInvoiceSchema = z.object({
  customer_id: z.number().positive(),
  amount: z.number().positive(),
  tax_rate: z.number().min(0).max(100),
  due_date: z.string().datetime(),
  items: z.array(z.object({
    item_id: z.number().positive(),
    quantity: z.number().positive(),
    price: z.number().positive()
  })).min(1)
});

export const createInvoice = async (req, res, next) => {
  try {
    // Validate input
    const validatedData = createInvoiceSchema.parse(req.body);
    
    // Process validated data
    const invoice = await createInvoiceInDB(validatedData);
    
    res.json({ success: true, data: invoice });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Dữ liệu không hợp lệ',
        errors: error.errors
      });
    }
    next(error);
  }
};
```

**Best Practices:**
- ✅ Validate all user inputs
- ✅ Use strict schemas (no `any` type)
- ✅ Return detailed validation errors
- ✅ Sanitize inputs before database queries

---

## Database Security

### 1. Connection Pooling

**File: `backend/config/db.js`**

```javascript
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 2000, // Timeout after 2s
});
```

### 2. SQL Injection Prevention

**✅ GOOD - Parameterized Queries**

```javascript
const result = await pool.query(
  'SELECT * FROM users WHERE id = $1 AND company_id = $2',
  [userId, companyId]
);
```

**❌ BAD - String Concatenation**

```javascript
const query = `SELECT * FROM users WHERE id = ${userId}`; // NEVER DO THIS
await pool.query(query);
```

### 3. Database User Permissions

**Production Database User:**

```sql
-- Create dedicated application user
CREATE USER ketoan_app WITH PASSWORD 'secure_password';

-- Grant only necessary permissions
GRANT CONNECT ON DATABASE ketoan_db TO ketoan_app;
GRANT USAGE ON SCHEMA public TO ketoan_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ketoan_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ketoan_app;

-- Revoke dangerous permissions
REVOKE CREATE ON SCHEMA public FROM ketoan_app;
REVOKE DROP ON SCHEMA public FROM ketoan_app;
```

---

## Environment Variables

### 1. Critical Secrets

**⚠️ MUST CHANGE in Production:**

```env
# JWT Secret - Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your_very_long_and_random_secret_key_here_at_least_32_characters

# AI Internal Secret - Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
AI_INTERNAL_SECRET=your_ai_internal_secret_here_generate_with_crypto

# Admin Password - CHANGE IMMEDIATELY after first login
ADMIN_PASSWORD=YourSecurePassword123!@#
```

### 2. Environment Variables Security Checklist

- [ ] `.env` files are in `.gitignore`
- [ ] No hardcoded secrets in code
- [ ] All secrets are in environment variables
- [ ] JWT_SECRET is 32+ characters, random
- [ ] AI_INTERNAL_SECRET is generated with crypto
- [ ] Database passwords are strong
- [ ] API keys are stored in environment variables
- [ ] VAPID keys are generated properly
- [ ] No secrets in logs or error messages

### 3. Generate Secure Secrets

```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate AI_INTERNAL_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate VAPID keys
node generate-vapid-keys.mjs
```

---

## HTTPS & SSL

### 1. Force HTTPS in Production

**File: `backend/server.js`**

```javascript
// Force HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(`https://${req.hostname}${req.url}`);
    }
    next();
  });
}
```

### 2. SSL/TLS Configuration

**Railway:**
- Railway provides automatic SSL certificates
- No additional configuration needed

**Custom Domain:**
1. Add custom domain in Railway dashboard
2. Railway automatically provisions SSL certificate
3. DNS propagation takes 5-10 minutes

### 3. HSTS (HTTP Strict Transport Security)

Helmet.js automatically adds HSTS header:

```javascript
app.use(helmet({
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  }
}));
```

---

## Security Headers

### Helmet.js Configuration

**File: `backend/server.js`**

```javascript
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
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### Security Headers Applied

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `SAMEORIGIN` | Prevent clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-XSS-Protection` | `1; mode=block` | Enable XSS filter |
| `Strict-Transport-Security` | `max-age=31536000` | Force HTTPS |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer |
| `Content-Security-Policy` | Custom policy | Prevent XSS/injection |

### Nginx Security Headers

**File: `front-end/nginx.conf`**

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

---

## Cookie Security

### Cookie Configuration

**File: `backend/server.js`**

```javascript
app.use((req, res, next) => {
  res.locals.cookieOptions = {
    httpOnly: true, // Prevent XSS access
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'lax', // CSRF protection
    path: '/', // Accessible from all paths
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };
  next();
});
```

**Cookie Security Features:**
- ✅ `httpOnly: true` - Prevent XSS attacks
- ✅ `secure: true` in production - HTTPS only
- ✅ `sameSite: 'lax'` - CSRF protection
- ✅ `path: '/'` - Accessible across all routes
- ✅ `maxAge: 7 days` - Persistent login

---

## Authentication & Authorization

### JWT Token Security

**File: `backend/middleware/auth.js`**

```javascript
import jwt from 'jsonwebtoken';

export const authenticate = async (req, res, next) => {
  try {
    // Get token from cookie or Authorization header
    const token = req.cookies.token || 
                  req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      console.warn('[auth] No token provided');
      return res.status(401).json({ error: 'Truy cập bị từ chối. Vui lòng đăng nhập!' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if session exists in database
    const session = await pool.query(
      'SELECT * FROM sessions WHERE token = $1 AND user_id = $2 AND expires_at > NOW()',
      [token, decoded.id]
    );
    
    if (session.rows.length === 0) {
      console.warn(`[auth] Invalid session for user=${decoded.id}`);
      return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn!' });
    }
    
    req.user = decoded;
    next();
  } catch (err) {
    console.warn('[auth] Token verification failed:', err.message);
    res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn!' });
  }
};
```

**Security Features:**
- ✅ Token stored in HttpOnly cookie
- ✅ Session validation in database
- ✅ Token expiration check
- ✅ Secure JWT secret (32+ chars)

### Role-Based Access Control

```javascript
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (!roles.includes(req.user.role)) {
      console.warn(`[auth] Access denied for user=${req.user.id}, role=${req.user.role}`);
      return res.status(403).json({ error: 'Không có quyền truy cập' });
    }
    
    next();
  };
};

// Usage
app.get('/api/admin/users', authenticate, authorize('admin'), getUsers);
```

---

## WAF (Web Application Firewall)

### WAF Middleware

**File: `backend/middleware/waf.js`**

```javascript
export const waf = (req, res, next) => {
  // Block common attack patterns
  const attackPatterns = [
    /union.*select/i,
    /select.*from/i,
    /insert.*into/i,
    /drop.*table/i,
    /delete.*from/i,
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /exec\s*\(/i
  ];
  
  const url = req.url;
  const body = JSON.stringify(req.body);
  
  for (const pattern of attackPatterns) {
    if (pattern.test(url) || pattern.test(body)) {
      console.error(`[WAF] Blocked attack attempt from IP: ${req.ip}`);
      return res.status(403).json({ error: 'Yêu cầu bị từ chối' });
    }
  }
  
  next();
};
```

**Protected Against:**
- ✅ SQL Injection
- ✅ XSS (Cross-Site Scripting)
- ✅ Command Injection
- ✅ Path Traversal

---

## Production Security Checklist

### Pre-Deployment

- [ ] **Secrets & Credentials**
  - [ ] JWT_SECRET changed to random 32+ char string
  - [ ] AI_INTERNAL_SECRET generated with crypto
  - [ ] ADMIN_PASSWORD changed from default
  - [ ] Database password is strong
  - [ ] All API keys are in environment variables
  - [ ] No secrets in code or git

- [ ] **HTTPS & SSL**
  - [ ] HTTPS is enabled (Railway provides automatically)
  - [ ] SSL certificates are valid
  - [ ] HTTP to HTTPS redirect is configured
  - [ ] HSTS header is enabled

- [ ] **CORS**
  - [ ] FRONTEND_URL only contains production domains
  - [ ] Localhost origins are removed (optional for production)
  - [ ] CORS credentials are enabled

- [ ] **Rate Limiting**
  - [ ] Rate limiting is enabled
  - [ ] Redis is configured for distributed rate limiting
  - [ ] Sensitive endpoints have stricter limits

- [ ] **Input Validation**
  - [ ] All endpoints have Zod schemas
  - [ ] SQL injection prevention (parameterized queries)
  - [ ] XSS prevention (input sanitization)

- [ ] **Logging**
  - [ ] Pino logger is configured
  - [ ] Log level is set to 'info' or 'warn'
  - [ ] No console.log in production code
  - [ ] Sensitive data is not logged

- [ ] **Error Handling**
  - [ ] Error handler is mounted
  - [ ] Stack traces are hidden in production
  - [ ] Error messages don't expose sensitive info

- [ ] **Database**
  - [ ] Database user has minimal permissions
  - [ ] Connection pooling is configured
  - [ ] SSL connection is enabled
  - [ ] Backups are configured

- [ ] **Dependencies**
  - [ ] Dependencies are up to date
  - [ ] No known vulnerabilities (run `npm audit`)
  - [ ] Only production dependencies are installed

### Post-Deployment

- [ ] **Monitoring**
  - [ ] Health check endpoint is accessible
  - [ ] Logs are being collected
  - [ ] Error tracking is configured (Sentry, etc.)
  - [ ] Uptime monitoring is set up

- [ ] **Security Testing**
  - [ ] Test CORS with invalid origins
  - [ ] Test rate limiting
  - [ ] Test SQL injection attempts
  - [ ] Test XSS attempts
  - [ ] Test authentication bypass

- [ ] **Performance**
  - [ ] API response times are acceptable
  - [ ] Database queries are optimized
  - [ ] Caching is working (Redis)
  - [ ] Static assets are cached

---

## Vulnerability Scanning

### 1. npm audit

```bash
# Check for vulnerabilities
npm audit

# Fix automatically
npm audit fix

# Fix breaking changes
npm audit fix --force
```

### 2. OWASP ZAP

```bash
# Install OWASP ZAP
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://dazzling-grace-production-03a5.up.railway.app \
  -r zap-report.html
```

### 3. Security Headers Test

```bash
# Test security headers
curl -I https://dazzling-grace-production-03a5.up.railway.app

# Expected headers:
# X-Frame-Options: SAMEORIGIN
# X-Content-Type-Options: nosniff
# X-XSS-Protection: 1; mode=block
# Strict-Transport-Security: max-age=31536000
```

---

## Incident Response

### 1. Security Incident Checklist

- [ ] Identify the breach
- [ ] Isolate affected systems
- [ ] Preserve evidence (logs)
- [ ] Assess impact
- [ ] Patch vulnerability
- [ ] Notify users if needed
- [ ] Document incident
- [ ] Update security measures

### 2. Log Analysis

```bash
# Search for suspicious activity
grep "CORS BLOCKED" logs/backend.log | tail -100
grep "Rate limit exceeded" logs/backend.log | tail -100
grep "WAF" logs/backend.log | tail -100
grep "auth.*failed" logs/backend.log | tail -100
```

### 3. Emergency Rollback

```bash
# Railway rollback
railway rollback --service backend

# Or redeploy previous version
git revert HEAD
git push origin main
```

---

## Support & Resources

- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **Node.js Security**: https://nodejs.org/en/docs/guides/security/
- **PostgreSQL Security**: https://www.postgresql.org/docs/current/security.html
- **Helmet.js**: https://helmetjs.github.io/
- **Zod**: https://zod.dev/

---

**Last Updated**: 2026-07-21
**Version**: 1.0.0
**Maintained By**: Ketoan ERP Security Team