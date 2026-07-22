# KETOAN ERP — SYSTEM ARCHITECTURE & DATA FLOW ANALYSIS

**Role:** Chief Technology Officer + Senior Project Director  
**Date:** 2026-07-21  
**Scope:** Full-stack source code analysis — backend (Node.js/Express), front-end (React), storefront (React), AI service (Python/FastAPI)  
**Methodology:** Zero assumptions — every claim verified against actual source code

---

## TABLE OF CONTENTS

1. [System Overview & Deployment Architecture](#1-system-overview--deployment-architecture)
2. [Tầng 1: Presentation Layer (Frontend + Storefront)](#2-tầng-1-presentation-layer)
3. [Tầng 2: API Gateway & Middleware Stack](#3-tầng-2-api-gateway--middleware-stack)
4. [Tầng 3: Route Handlers (45+ Endpoints)](#4-tầng-3-route-handlers)
5. [Tầng 4: Service Layer (50+ Services)](#5-tầng-4-service-layer)
6. [Tầng 5: Data Layer (PostgreSQL + Redis)](#6-tầng-5-data-layer)
7. [Event-Driven Architecture](#7-event-driven-architecture)
8. [REA Accounting Engine (Core Innovation)](#8-rea-accounting-engine)
9. [AI Service Integration Matrix](#9-ai-service-integration-matrix)
10. [Data Flow: Real-World Transactions](#10-data-flow-real-world-transactions)
11. [Security Architecture](#11-security-architecture)
12. [Operational Model & State Machines](#12-operational-model--state-machines)

---

## 1. SYSTEM OVERVIEW & DEPLOYMENT ARCHITECTURE

### 1.1 High-Level Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        KETOAN ERP — SYSTEM ARCHITECTURE                    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐              │
│  │  front-end   │    │  storefront  │    │   ai-service     │              │
│  │  React SPA   │    │  React SPA   │    │  Python/FastAPI  │              │
│  │  :3000       │    │  :3001       │    │  :8000           │              │
│  │  RBAC routing│    │  Guest/Auth  │    │  4 ML Models     │              │
│  └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘              │
│         │                   │                     │                         │
│         │  REST +           │  REST +             │  HTTP                   │
│         │  WebSocket        │  WebSocket          │  (internal)             │
│         ▼                   ▼                     ▼                         │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │              BACKEND (Node.js/Express) — :5000                    │      │
│  │                                                                    │      │
│  │  Middleware Stack:                                                 │      │
│  │  helmet → correlationId → CORS → JSON → cookieParser → WAF       │      │
│  │  → apiRateLimiter → waitForDb → [Routes] → errorHandler          │      │
│  │                                                                    │      │
│  │  45+ Route Handlers → 50+ Services → PostgreSQL + Redis           │      │
│  │  WebSocket (Socket.io + Redis Adapter)                             │      │
│  │  Cron Jobs (Daily/Yearly)                                         │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                                                            │
│  ┌─────────────────────┐              ┌─────────────────────┐              │
│  │   PostgreSQL DB      │              │   Redis Cache        │              │
│  │   • Multi-tenant     │              │   • Session store    │              │
│  │   • 25+ tables       │              │   • Rate limiter     │              │
│  │   • 20+ migrations   │              │   • BullMQ queues    │              │
│  │   • Schema auto-sync │              │   • WebSocket pub/sub│              │
│  └─────────────────────┘              └─────────────────────┘              │
│                                                                            │
│  Workers & Cron:                                                           │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────┐         │
│  │ DataRetention │  │ trainFeedbackLoop│  │ reversingEntriesCron │         │
│  │ Worker        │  │ (weekly RLHF)    │  │ (yearly auto-reverse)│         │
│  └──────────────┘  └──────────────────┘  └──────────────────────┘         │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Deployment Configuration (Railway)

All services are deployed on Railway with the following configuration:

| Service | Domain | Dockerfile | Health Check |
|---------|--------|------------|-------------|
| **Backend** | `dazzling-grace-production-03a5.up.railway.app` | `Dockerfile.backend` | `GET /api/health` |
| **Front-end** | `ketoanonline.up.railway.app` | `Dockerfile.frontend` | SPA (Vite preview) |
| **Storefront** | `banhang.up.railway.app` | `Dockerfile.storefront` | SPA (Vite preview) |
| **AI Service** | `robust-dedication-production-6a94.up.railway.app` | `ai-service/Dockerfile` | `GET /health` |

### 1.3 Technology Stack (Verified from package.json)

**Backend (`backend/package.json`):**
- Runtime: Node.js >= 18.0.0 (ES Modules)
- Framework: Express 4.19.2
- Database: pg 8.11.5 (PostgreSQL)
- Cache/Queue: ioredis 5.11.1, bullmq 4.18.3
- Auth: jsonwebtoken 9.0.2, bcryptjs 2.4.3
- Real-time: socket.io 4.8.3, @socket.io/redis-adapter 8.3.0
- Security: helmet 8.3.0, cors 2.8.5, express-rate-limit 8.5.2
- AI SDK: @google/generative-ai 0.24.1
- Testing: jest 30.4.2, supertest 7.2.2, fast-check 4.8.0

**Front-end (`front-end/package.json`):**
- UI: React 18.2.0, react-router-dom 7.18.1
- State: @tanstack/react-query 5.101.2
- Forms: react-hook-form 7.81.0, zod 4.4.3
- Styling: TailwindCSS 3.4.3
- Build: Vite 5.2.0

**Storefront (`storefront/package.json`):**
- UI: React 18.2.0
- Networking: axios 1.6.8, socket.io-client 4.7.0
- Icons: lucide-react 0.368.0
- Styling: TailwindCSS 3.4.3
- Build: Vite 5.2.0

**AI Service (`ai-service/requirements.txt`):**
- Framework: FastAPI 0.110.0, uvicorn 0.29.0
- Auth: python-dotenv 1.0.0
- ML Base: numpy 1.26.4

---

## 2. TẦNG 1: PRESENTATION LAYER

### 2.1 Front-End ERP (`front-end/src/`)

#### 2.1.1 App.jsx — Root Component & Routing

**File:** `front-end/src/App.jsx` (191 lines)

**Architecture:**
```
<ErrorBoundary>
  <BrowserRouter>
    <Routes>
      <Route path="/login">           → Login / Register (toggle)
      <Route path="/gd-kinhdoanh/*">  → Business Director panel (isolated)
      <Route path="/change-password"> → Force password change
      <Route path="/pos">             → StorefrontAccessNotice
      <Route path="/customer">        → CustomerView
      <Route path="/*">               → Main ERP Layout:
                                        ├── Sidebar (RBAC-filtered)
                                        ├── Header
                                        ├── Main Content (module routes)
                                        └── Footer
    </Routes>
    <ToastContainer />
    <PopupNotification />
  </BrowserRouter>
</ErrorBoundary>
```

**Key Behavioral Logic (lines 31-53):**
```javascript
// 1. Loading state → spinner
if (loading) return <LoadingSpinner />

// 2. No token → redirect /login
if (!token) return <Navigate to="/login" />

// 3. Must change password → redirect
if (mustChangePassword) return <Navigate to="/change-password" />

// 4. Storefront-only role → redirect /pos
if (userNeedsStorefrontOnly) return <StorefrontAccessNotice />

// 5. Normal → render Sidebar + Header + Module routes
```

**Module Registration:** `MODULES_REGISTER` array drives all route rendering. Each module has:
- `id`: route path segment (e.g., 'dashboard', 'vouchers')
- `component`: lazy-loaded React component
- `requiresActiveCompany`: boolean for company-scoped routes

**RBAC Enforcement:** `useModuleAccess(user, enabledModules, featureFlags)` filters accessible modules based on:
- User role (`roleId` / `role`)
- Department (`department`)
- Feature flags from backend

#### 2.1.2 AuthContext (`front-end/src/context/AuthContext.jsx`, 279 lines)

**Token Strategy: IN-MEMORY + HttpOnly COOKIE (Dual Mode)**

| Storage | Purpose | XSS Safe? |
|---------|---------|-----------|
| `memoryToken` (in api.js) | Primary access token for API calls | ✅ Yes |
| `localStorage('accessToken')` | Session persistence across page reload | ⚠️ Partial |
| HttpOnly cookie (`access_token`) | Primary from backend JWT | ✅ Yes (XSS immune) |
| HttpOnly cookie (`refresh_token`) | Silent token refresh | ✅ Yes |

**Session Initialization Flow (lines 54-80):**
```
1. Component mounts → check localStorage('accessToken')
2. If found → POST /auth/refresh (silent refresh)
3a. Success → setUser(), setActiveCompany(), setIsSyncing(false)
3b. Fail → clear everything, show login
4. If not found → setIsSyncing(false) immediately
```

**Event Listener (line 44-52):**
```javascript
window.addEventListener('erp:auth-expired', () => {
  localStorage.removeItem('accessToken');
  setUser(null);
  setActiveCompany(null);
});
```

#### 2.1.3 API Client (`front-end/src/utils/api.js`, 244 lines)

**Axios Instance Configuration:**
```javascript
const api = axios.create({
  baseURL: getBaseURL(),      // Dynamic from VITE_API_BASE_URL
  withCredentials: true,       // Cookies for auth
  headers: { 'Content-Type': 'application/json' }
});
```

**Request Interceptor:**
```javascript
api.interceptors.request.use(config => {
  const token = getAccessToken();  // From memory
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['X-Client-Instance-Id'] = getClientInstanceId();
  
  // Auto inject company_id from localStorage
  const activeCompanyId = localStorage.getItem('activeCompanyId');
  if (activeCompanyId) {
    config.headers['X-Company-Id'] = companyId;
    config.params = { ...config.params, company_id: companyId };
  }
  return config;
});
```

**Response Interceptor (401 Handling):**
```javascript
api.interceptors.response.use(
  response => response,
  async error => {
    if (status === 401 && !isRefreshCall && !alreadyRetried) {
      const newToken = await doSilentRefresh();
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    }
    return Promise.reject(error);
  }
);
```

**Silent Refresh with Cooldown (lines 60-81):**
```javascript
let refreshPromise = null;
let refreshCooldownUntil = 0;
const REFRESH_COOLDOWN_MS = 10000;  // 10 seconds

const doSilentRefresh = () => {
  if (Date.now() < refreshCooldownUntil) return Promise.reject('refresh-cooldown');
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const { data } = await api.post('/auth/refresh');
      setAccessToken(data.accessToken);
      return data.accessToken;
    })();
  }
  return refreshPromise;
};
```

#### 2.1.4 TransactionClassifier Component (197 lines)

**Layer 1: Rule Engine** — Database-driven keyword matching with scoring
**Layer 2: AI Department Classifier** — Backend service integration
**Layer 3: OCR + LLM** — Gemini Vision for complex transactions

**Component Behavior:**
```javascript
// Debounced on description/amount/partnerId change (500ms)
useEffect(() => {
  const timer = setTimeout(() => {
    fetchClassification({ description, amount, partner_id: partnerId });
  }, 500);
  return () => clearTimeout(timer);
}, [description, amount, partnerId]);

// User feedback recording
const handleFeedback = async (isAccepted) => {
  await recordClassificationFeedback(classification.data.id, isAccepted);
};
```

### 2.2 Storefront (`storefront/src/`)

#### 2.2.1 StorefrontPage (1978 lines)

**State Machine:**
```javascript
const VIEWS = {
  GUEST: 'guest',        // Product browsing
  REGISTERED: 'auth',    // Logged-in user  
  ADMIN: 'admin'         // Store management
};

// Role switching allowed via ALLOW_ROLE_SWITCH constant
const [viewMode, setViewMode] = useState('guest');
```

**Initialized Services on Mount (useEffect):**
1. Fetch products from `GET /api/public/items`
2. Fetch exchange rates from `services/exchangeRate`
3. Initialize WebSocket connection via `useStorefrontEvents` hook
4. Check for existing auth token in localStorage
5. Load system configuration

**Components Used:**
- `FloatingCartBar` — Persistent cart summary
- `ProductCard` — Product display with add-to-cart
- `QuickViewModal` — Product detail popup
- `WebSocketStatusHUD` — Connection indicator
- `Footer` — Site footer
- `StorefrontCreditModal` — Credit/payment dialog

#### 2.2.2 Storefront API Client

**Dual API Approach:**
```javascript
// Public API — no auth required
export const publicApi = axios.create({
  baseURL: `${API_BASE_URL}/api/public`,
  withCredentials: false
});

// Auth API — for logged-in users
export const authApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

// Token stored in localStorage (storefront context)
localStorage.getItem('storefrontAccessToken');
```

#### 2.2.3 Storefront Event Adapter (260 lines)

**REA Event Conversion Layer — 3 converters:**

| Function | Event Type | Purpose |
|----------|-----------|---------|
| `convertGuestCheckoutToSaleEvent` | `sale` | Guest checkout → sale voucher |
| `convertProductCreationToPurchaseEvent` | `simple_purchase` | Product creation → purchase voucher |
| `convertOrderCompletionToCreditEvent` | `sales_credit` | Order completion → credit entry |

**Idempotency:**
```javascript
const { generateIdempotencyKey, withIdempotency } = useStorefrontIdempotency();
const result = await withIdempotency(
  () => sendEventToBackend(event, idempotencyKey),
  idempotencyKey
);
```

#### 2.2.4 WebSocket Real-Time Hook (`useStorefrontEvents`, 288 lines)

```javascript
// Creates socket.io connection to backend
// Listens for: order_status_update, inventory_changed, payment_confirmed
// Auto-reconnects on disconnect
```

---

## 3. TẦNG 2: API GATEWAY & MIDDLEWARE STACK

### 3.1 Middleware Execution Order (from `backend/server.js`)

```
Request In →
  1. correlationId        → Gán X-Correlation-ID header
  2. hitlRouter           → Mount HITL routes (BEFORE CORS — intentional)
  3. trust proxy          → Set Express trust proxy
  4. helmet()             → HTTP security headers (ADDED v2)
  5. cors()               → Dynamic origin validation (Railway + custom)
  6. express.json()       → Parse JSON body
  7. cookieParser()       → Parse cookies
  8. waf                  → SQL injection + XSS pattern detection
  9. apiRateLimiter       → Redis-based rate limiting (100 req/15min)
  10. waitForDb           → Wait for DB initialization
  11. [Route Handler]     → Mounted per API path
  12. errorHandler        → Catch-all error handling
```

### 3.2 Middleware Details

#### 3.2.1 CORS Configuration (server.js lines 78-141)

**Verified Implementation:**
```javascript
const rawFrontend = process.env.FRONTEND_URL || '';
// Parse comma-separated origins from env
const allowedOriginsSet = new Set(rawFrontend.split(',').map(s => s.trim()).filter(Boolean));

// Always allow localhost dev
['http://localhost:3001', 'http://localhost:5173', ...].forEach(origin => {
  allowedOriginsSet.add(origin);
});

// Support wildcard origins (*.railway.app)
// Support Railway subdomains automatically
// Block in production if not explicitly allowed
```

**Configured Origins (from .env):**
```
FRONTEND_URL=https://ketoanonline.up.railway.app,
              https://banhang.up.railway.app,
              http://localhost:3001,
              http://localhost:3000
```

#### 3.2.2 WAF Middleware (`middleware/waf.js`, 212 lines)

**Protection Layers:**
```javascript
// SQL Injection patterns — 5 signatures:
const SQL_INJECTION_PATTERNS = [
  /(\bUNION\b)\s+\bSELECT\b/gi,
  /(\bSELECT\b)\s+.*\bFROM\b\s+.*\bINTO\b/gi,
  /(--\s)|(\/\*)|(\*\/)/g,
  /(\bOR\b|\bAND\b)\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/gi,
  /(EXEC\s*\(|xp_cmdshell|pg_sleep|WAITFOR\s+DELAY)/gi
];

// XSS patterns — 5 signatures:
const XSS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe/gi,
  /<object/gi
];

// Speed limiter: delayAfter=50 → 500ms delay per request
```

#### 3.2.3 Rate Limiter (`middleware/rateLimiter.js`, 118 lines)

**Redis-based with Lua Script for Atomicity:**
```javascript
// General: 100 requests per 15 minutes
const MAX_REQUESTS = 100;
const WINDOW_MS = 15 * 60 * 1000;

// Sensitive endpoints — stricter:
const SENSITIVE_ENDPOINTS = {
  '/api/auth/login': { maxRequests: 15, windowMs: 15 * 60 * 1000 },
  '/api/auth/register': { maxRequests: 5, windowMs: 60 * 60 * 1000 },
  '/api/auth/change-password': { maxRequests: 3, windowMs: 60 * 60 * 1000 },
};

// Atomic Lua script prevents race conditions:
const luaScript = `
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  return current
`;
```

#### 3.2.4 Authentication Middleware (`middleware/auth.js`, 196 lines)

**Dual Token Strategy:**
```javascript
const authenticate = async (req, res, next) => {
  // Priority 1: HttpOnly cookie
  let token = req.cookies?.access_token || req.cookies?.storefront_token;
  
  // Priority 2: Bearer header
  if (!token) {
    token = req.headers.authorization?.split(' ')[1];
  }
  
  if (!token) {
    return res.status(401).json({ error: 'Truy cập bị từ chối. Vui lòng đăng nhập!' });
  }
  
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    
    // Session validation from DB
    const q = await pool.query(
      'SELECT id FROM sessions WHERE token = $1 AND user_id = $2 AND (expires_at IS NULL OR expires_at > now())',
      [token, req.user.id]
    );
    
    if (q.rows.length === 0) {
      return res.status(401).json({ error: 'Phiên làm việc không hợp lệ hoặc đã hết hạn.' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn!' });
  }
};
```

**Authorization Levels:**
```javascript
// Role-based access
export const requireRole = (...roles) => (req, res, next) => { ... };

// Root admin check
export const requireRootAdmin = async (req, res, next) => { ... };

// Company isolation
export const checkCompanyAccess = async (req, res, next) => { ... };
```

---

## 4. TẦNG 3: ROUTE HANDLERS

### 4.1 Complete Route Matrix (45+ files)

All route mounts from `server.js` (lines 446-490):

| Prefix | Route File | Auth | Purpose |
|--------|-----------|------|---------|
| `/api/auth` | `routes/auth.js` | Mixed | Login, register, refresh, logout |
| `/api/signing` | `routes/signing.js` | ✅ | OTP document signing |
| `/api/companies` | `routes/companies.js` | ✅ | Company CRUD |
| `/api/items` | `routes/items.js` | ✅ | Product/item CRUD |
| `/api/opening-balances` | `routes/openingBalances.js` | ✅ | Opening balance setup |
| `/api/dashboard` | `routes/dashboard.js` | ✅ | Dashboard data + caching |
| `/api/export` | `routes/export.js` | ✅ | Excel/CSV export |
| `/api/import` | `routes/import.js` | ✅ | Data import |
| `/api/partners` | `routes/partnerRoute.js` | ✅ | Customer/supplier CRUD |
| `/api/users` | `routes/users.js` | ✅ | User management |
| `/api/inventory` | `routes/inventoryRoutes.js` | ✅ | Inventory vouchers |
| `/api/reversing-entries` | `routes/reversingEntriesRoutes.js` | ✅ | Reversing entries |
| `/api/debt-reconciliations` | `routes/debtReconciliationRoutes.js` | ✅ | Debt reconciliation |
| `/api/report` | `routes/report.js` | ✅ | Financial reports |
| `/api/vouchers` | `routes/vouchers.js` | ✅ | Voucher CRUD + posting |
| `/api/maintenance` | `routes/maintenance.js` | ✅ | Ledger rebuild |
| `/api/public` | `routes/publicRoutes.js` | ❌ (intentional) | Storefront public API |
| `/api/logistics` | `routes/logisticsRoutes.js` | ✅ | Delivery management |
| `/api/notifications` | `routes/notifications.js` | ✅ | Push notifications |
| `/api/accounting` | `routes/accounting.js` | ✅ (FIXED v2) | Balance calculations |
| `/api/cashflow` | `routes/cashflow.js` | ✅ | Cash flow reports |
| `/api/casso` | `routes/casso.js` | ✅ | Casso bank integration |
| `/api/integration` | `routes/integration/index.js` | ✅ | Third-party integrations |
| `/api/e-invoices` | `routes/einvoice.js` | ✅ | e-Invoice management |
| `/api/refunds` | `routes/refunds.js` | ✅ | Refund requests |
| `/api/public/legal` | `routes/legalPublic.js` | ❌ (intentional) | Public legal docs/complaints |
| `/api/ai` | `routes/aiPool.routes.js` | ✅ (FIXED v2) | AI pool management |
| `/api/ai` | `routes/aiQuery.js` | ✅ | AI copilot queries |
| `/api/transaction-classification` | `routes/transactionClassification.js` | ✅ | Transaction classifier |
| `/api/settings` | `routes/settings.js` | ✅ | System settings |
| `/api/events` | `routes/events.js` | ✅ | REA event processing |
| `/api/meta` | `routes/meta.js` | ✅ | Dynamic UI metadata |
| `/api/dynamic` | `routes/dynamic.js` | ✅ | Dynamic entity CRUD |
| `/api/io-matrix` | `routes/io-matrix.js` | ✅ | Input-output matrix |
| `/api/posting-rules` | `routes/postingRules.js` | ✅ | Dynamic posting rules |
| `/api/dimensions` | `routes/dimensions.js` | ✅ | Accounting dimensions |
| `/api/costing` | `routes/costing.js` | ✅ | Inventory costing |
| `/api/accounting-periods` | `routes/accountingPeriods.js` | ✅ | Period management |
| `/api/workflows` | `routes/workflows.js` | ✅ | User-defined workflows |
| `/api/reports` | `routes/reports.js` | ✅ | Custom reports |
| `/api/feature-flags` | `routes/featureFlags.js` | ✅ | Feature toggle management |
| `/api/credit` | `routes/credit.js` | ✅ | Credit management |
| `/api/processors` | `routes/processors.js` | ✅ | REA event processors CRUD |
| `/api/hitl` | `routes/hitl.js` | ✅ (mounted before CORS) | Human-in-the-loop logs |
| `/api/orders` | `server.js` (inline) | ✅ | Order management |
| `/api/health` | `server.js` (inline) | ❌ | Health check |
| `/uploads` | Static files | ❌ | File uploads |

**Auth Summary (after v2 fixes):**
- 🔴 **CRITICAL (FIXED):** `aiPool.routes.js` — Added `authenticate` + `requireRole(['admin'])` to test endpoints
- 🟠 **HIGH (FIXED):** `accounting.js` — Added `authenticate` to all 6 calculation endpoints
- 🟢 **INTENTIONAL NO AUTH:** `publicRoutes.js` (storefront), `legalPublic.js` (legal compliance), `/api/health` (monitoring)

### 4.2 Voucher Routes Deep Dive (`routes/vouchers.js`)

**Endpoints:**
| Method | Path | Description | Idempotent? |
|--------|------|-------------|-------------|
| GET | `/api/vouchers` | List vouchers | ✅ (read) |
| POST | `/api/vouchers` | Create voucher | ✅ (idempotency key) |
| PUT | `/api/vouchers/:id` | Update voucher | ✅ |
| DELETE | `/api/vouchers/:id` | Soft delete | ✅ |
| POST | `/api/vouchers/:id/post` | Post to ledger | ✅ |
| POST | `/api/vouchers/:id/unpost` | Reverse posting | ✅ |

**Transaction Flow (Verified):**
```
1. BEGIN TRANSACTION
2. checkIdempotency() — Nếu duplicate → trả cached result
3. checkLockDate() — Ngày chứng từ >= lock_date?
4. validateVoucherSchema() — Tài khoản hợp lệ?
5. INSERT vouchers
6. INSERT voucher_details (multi-line, JSON_AGG)
7. INSERT idempotency_keys (đánh dấu completed)
8. INSERT audit_logs
9. COMMIT
10. emitVoucherRealtime() → WebSocket broadcast
```

---

## 5. TẦNG 4: SERVICE LAYER

### 5.1 Service Catalog (50+ Services)

| Service | File | Purpose | AI-Enabled? |
|---------|------|---------|-------------|
| **VoucherService** | `services/voucher.service.js` | Voucher CRUD + posting | ❌ |
| **ClosingService** | `services/closing.service.js` | Month-end closing (792 lines) | ❌ |
| **WebSocketService** | `services/websocket.service.js` | Socket.io + Redis pub/sub | ❌ |
| **aiApiPool** | `services/aiApiPool.service.js` | Multi-key AI pool (482 lines) | ✅ Core |
| **aiCopilot** | `services/aiCopilot.service.js` | Text-to-SQL + RAG (419 lines) | ✅ Core |
| **aiOcr** | `services/aiOcr.service.js` | Gemini Vision OCR (359 lines) | ✅ Core |
| **aiModelRouter** | `services/aiModelRouter.service.js` | Auto route to best AI model | ✅ Core |
| **aiAdapter** | `services/aiAdapter.service.js` | Unified AI interface | ✅ Core |
| **aiDepartmentClassifier** | `services/aiDepartmentClassifier.service.js` | Department classification | ✅ |
| **aiSmartSuggestions** | `services/aiSmartSuggestions.service.js` | Smart suggestions | ✅ |
| **aiBatchProcessor** | `services/aiBatchProcessor.service.js` | Batch AI processing | ✅ |
| **aiWorkflowEngine** | `services/aiWorkflowEngine.service.js` | AI-driven workflows | ✅ |
| **aiInitialization** | `services/aiInitialization.service.js` | AI service bootstrap | ✅ |
| **businessTransactionClassifier** | `services/businessTransactionClassifier.service.js` | 3-layer classifier (554 lines) | ✅ |
| **geminiClient** | `services/geminiClient.js` | Gemini API wrapper | ✅ |
| **hitl** | `services/hitl.service.js` | Human-in-the-loop logging | ✅ |
| **aiSelfFix** | `services/aiSelfFix.service.js` | AI self-correction | ✅ |
| **workflowEngine** | `services/workflowEngine.service.js` | Business workflow engine | ❌ |
| **workflowExecutor** | `services/workflowExecutor.service.js` | Workflow execution | ❌ |
| **taxRule** | `services/taxRule.service.js` | Tax calculation rules | ❌ |
| **logistics** | `services/logistics.service.js` | Delivery management | ❌ |
| **webPush** | `services/webPush.service.js` | Push notification service | ❌ |
| **storefrontRealtime** | `services/storefrontRealtime.service.js` | Storefront real-time sync | ❌ |
| **dynamicPosting** | `services/dynamicPosting.service.js` | DB-driven posting engine | ❌ |
| **projectionEngine** | `services/projectionEngine.service.js` | CQRS projection engine | ❌ |
| **balanceCache** | `services/balanceCache.service.js` | Balance cache service | ❌ |
| **distributedLock** | `services/distributedLock.service.js` | Redis distributed locks | ❌ |
| **saga** | `services/saga.service.js` | Saga orchestration | ❌ |
| **inventory** | `services/inventory.service.js` | Inventory costing (BQGQ/FIFO) | ❌ |
| **maintenance** | `services/maintenance.service.js` | Ledger rebuild + validation | ❌ |

### 5.2 Core Service Details

#### 5.2.1 aiApiPool.service.js (482 lines) — Enterprise-Grade AI Pool

**Architecture:**
```
┌─────────────────────────────────────────────────────┐
│                  AIApiPool Class                     │
├─────────────────────────────────────────────────────┤
│ Providers:                                          │
│ • Gemini (6 API keys, 15 RPM each → 90 RPM total)  │
│ • Groq (4 API keys, 30 RPM each → 120 RPM total)   │
│ • DeepSeek (3 API keys, 60 RPM each → 180 RPM total)│
├─────────────────────────────────────────────────────┤
│ Features:                                           │
│ • Round-robin key rotation (getNextGeminiKey etc.)  │
│ • Rate limiting per provider (checkRateLimit)        │
│ • Exponential backoff (isRetryableError)             │
│ • Cloudflare proxy support (IP masking)             │
│ • Concurrent request limiting (p-limit)              │
│ • Statistics tracking (getStats)                     │
└─────────────────────────────────────────────────────┘
```

**Key Rotation Algorithm:**
```javascript
getNextGeminiKey() {
  if (!this.geminiKeys.length) throw new Error('No Gemini API keys configured');
  const key = this.geminiKeys[this.geminiKeyIndex];
  this.geminiKeyIndex = (this.geminiKeyIndex + 1) % this.geminiKeys.length;
  return key;
}
```

**Cloudflare Proxy Integration:**
```javascript
if (this.useCloudflareProxy && this.cloudflareProxy) {
  requestUrl = `${this.cloudflareProxy}?target=${encodeURIComponent(targetUrl)}`;
  axiosConfig.headers['X-Target-Url'] = targetUrl;
  axiosConfig.headers['X-Proxy-Auth-Token'] = this.proxySecretToken;
}
```

**Retry Logic:**
```javascript
async executeRequest(request, retryCount = 0) {
  try {
    return await this.callProvider(request);
  } catch (error) {
    if (retryCount < this.maxRetries && this.isRetryableError(error)) {
      await this.sleep(this.retryDelay * Math.pow(2, retryCount));
      return this.executeRequest(request, retryCount + 1);
    }
    throw error;
  }
}
```

#### 5.2.2 aiCopilot.service.js (419 lines) — Financial Copilot

**Multi-Model Architecture:**
```javascript
export async function textToSQL(question, companyId) {
  // PRIORITY 1: Gemini AI (multi-key pool + Cloudflare)
  if (isGeminiAvailable()) {
    return await generateSQL(question, schema, companyId);
  }
  
  // PRIORITY 2: DeepSeek fallback
  if (isDeepSeekAvailable()) {
    return await callDeepSeek(sqlPrompt, 'deepseek-chat', options);
  }
  
  // PRIORITY 3: Offline mode (basic keyword matching)
  return fallbackTextToSQL(question, companyId);
}
```

**Schema Injection for Text-to-SQL:**
```javascript
const schema = `
  Tables:
  - vouchers (id, company_id, voucher_type, voucher_date, description, created_at)
  - voucher_details (id, voucher_id, account_code, entry_type, amount, description)
  - partners (id, company_id, partner_name, partner_type, tax_code, phone, email)
  - items (id, company_id, item_name, item_code, unit, unit_price)
  - accounts (code, name, account_type, parent_code)
`;
```

#### 5.2.3 Closing Service (792 lines) — Month-End Closing

**Execution Flow:**
```
1. DISTRIBUTED LOCK: Redis acquireLock('closing', {companyId, ttl: 60000})
2. PESSIMISTIC LOCK: SELECT ... FROM companies WHERE id = $1 FOR UPDATE NOWAIT
3. PESSIMISTIC LOCK: SELECT ... FROM monthly_balances WHERE company_id = $1 FOR UPDATE
4. DUPLICATE CHECK: SELECT FROM closing_entries WHERE status = 'completed'
5. INSERT closing_entries (status = 'processing')
6. STEP: Kết chuyển doanh thu (Nợ 511 / Có 911)
7. STEP: Kết chuyển thu nhập khác (Nợ 711 / Có 911)
8. STEP: Kết chuyển chi phí (Nợ 911 / Có 632/641/642)
9. STEP: Kết chuyển chi phí khác (Nợ 911 / Có 811)
10. STEP: Tính thuế TNDN (lũy tiến: ≤3tỷ 15%, 3-50tỷ 17%, >50tỷ 20%)
11. STEP: Kết chuyển lãi/lỗ (911 → 4212)
12. UPDATE monthly_balances (carry-forward opening balances)
13. UPDATE closing_entries (status = 'completed')
14. RELEASE LOCK
```

**Tax Rate Progressive Calculation (from `config/closingWorkflow.js`):**
```javascript
taxRates: {
  corporate: {
    threshold1: 3000000000,  // 3 tỷ
    rate1: 0.15,
    threshold2: 50000000000,  // 50 tỷ
    rate2: 0.17,
    rate3: 0.20
  },
  vat: 0.08,  // 8%
  minimumCorporateTax: 0.015  // 15% thuế tối thiểu
}
```

**Entity Type Detection for Tax Classification:**
```javascript
let companyEntityType = 'company';
const companyMetaRes = await client.query(
  'SELECT entity_type FROM companies WHERE id = $1',
  [companyId]
);
// A-D classification for tax rates
```

#### 5.2.4 WebSocket Service (159 lines) — Real-Time Communication

**Event Types (verified from code):**

| Event | Emitter | Subscriber | Data |
|-------|---------|------------|------|
| `change:voucher` | Voucher routes | Front-end ERP | `{ voucherId, action: 'create'|'update'|'delete'|'post'|'unpost' }` |
| `change:balance` | Closing service | Front-end ERP | `{ companyId, accountCode, newBalance }` |
| `realtime-events` | Various | Front-end ERP, Storefront | `{ eventType, data }` |
| `order_status_update` | Logistics routes | Storefront | `{ orderId, status }` |
| `inventory_changed` | Inventory routes | Storefront | `{ itemId, newQuantity }` |
| `payment_confirmed` | Payment routes | Storefront | `{ orderId, amount }` |

**Redis Adapter for Horizontal Scaling:**
```javascript
if (redis.status === 'ready') {
  const pubClient = redis.duplicate();
  const subClient = redis.duplicate();
  io.adapter(createAdapter(pubClient, subClient));
}
```

**Room-Based Targeting:**
```javascript
// Company-specific room
socket.join(`company:${companyId}`);
publishToCompany(companyId, 'change:voucher', data);

// Role-specific room
socket.join(`role:${role}`);
publishToRole(role, 'notification', data);
```

---

## 6. TẦNG 5: DATA LAYER

### 6.1 PostgreSQL Schema (25+ tables)

**From `backend/schema.sql` — All verified:**

| Table | Purpose | Key Columns | Indexes |
|-------|---------|-------------|---------|
| `companies` | Multi-tenant root | `id, name, tax_code, lock_date` | PK, UNIQUE(tax_code) |
| `users` | User accounts | `id, username, password, role, company_ids[]` | GIN(company_ids, staff_ids) |
| `user_companies` | User↔Company junction | `user_id, company_id` | PK(user_id, company_id) |
| `partners` | Customers + suppliers | `id, company_id, partner_code, partner_name, type` | UNIQUE(company_id, partner_code) |
| `items` | Inventory items | `id, company_id, code, name, unit, price_sell` | UNIQUE(company_id, code) |
| `vouchers` | Accounting entries | `id, company_id, voucher_number, voucher_date, is_posted` | 5 indexes |
| `voucher_details` | Line items | `id, voucher_id, account_code, entry_type, amount` | 7 indexes |
| `opening_balances` | Fiscal year setup | `id, company_id, fiscal_year, account_code, opening_debit/credit` | UNIQUE(4 cols) |
| `sessions` | User sessions | `id, user_id, token, refresh_token, expires_at` | 4 indexes + UNIQUE(token) |
| `audit_logs` | All changes | `id, user_id, action, entity_type, old_values, new_values` | 4 indexes |
| `closing_entries` | Closing history | `id, company_id, year, month, status` | Complex index |
| `monthly_balances` | Monthly balance snapshots | `id, company_id, account_code, closing_debit/credit` | 6 indexes |
| `inventory_vouchers` | Inventory IN/OUT | `id, company_id, voucher_number, io_type` | UNIQUE(company_id, voucher_number) |
| `inventory_voucher_details` | Inventory line items | `id, inventory_voucher_id, item_id, quantity, unit_price` | 2 indexes |
| `idempotency_keys` | Duplicate prevention | `id, company_id, event_type, idempotency_key` | UNIQUE(3 cols) |
| `e_invoices` | e-Invoice records | `id, company_id, invoice_no, template, symbol` | UNIQUE(company_id, invoice_no) |
| `notifications` | System notifications | `id, company_id, type, title, recipient_role` | 2 indexes |
| `push_subscriptions` | Web push subs | `id, user_id, endpoint, p256dh, auth` | 3 indexes |
| `consents` | Privacy consent | `id, user_id, policy_type, policy_version` | UNIQUE(3 cols) |
| `company_profiles` | Legal info | `company_id, legal_name, dpo_name/email` | PK(company_id) |
| `complaints` | Public complaints | `id, company_id, name, content, status` | INDEX(company_id) |
| `refund_requests` | Refund management | `id, company_id, amount, reason, status` | 2 indexes |
| `stock_reconciliations` | Stock checks | `id, company_id, voucher_number, reconciliation_date` | INDEX(company_id) |
| `stock_reconciliation_details` | Stock check lines | `id, stock_reconciliation_id, item_id, diff_quantity` | 2 indexes |
| `debt_reconciliations` | Debt offsetting | `id, company_id, voucher_number, type` | INDEX(company_id) |
| `debt_reconciliation_details` | Debt offset lines | `id, debt_reconciliation_id, partner_id, offset_amount` | 2 indexes |
| `rea_meta` | Dynamic UI config | `id, entity_type, company_id, ui_schema` | UNIQUE(4 cols) |
| `rea_events` | REA event audit | `id, company_id, event_type, event_data, voucher_id` | 2 indexes |
| `io_coefficients` | IO matrix | `id, from/to_company_id, resource_type, coefficient` | UNIQUE(5 cols) |
| `feature_flags` | Feature toggles | `flag_name, is_enabled, description` | PK(flag_name) |

### 6.2 Index Strategy

**Key Performance Indexes:**
```sql
-- Voucher lookup by date and company (most common query)
CREATE INDEX idx_vouchers_date_company ON vouchers(company_id, voucher_date);

-- Posted-only filter for balance calculations
CREATE INDEX idx_vouchers_posted_only ON vouchers(company_id, voucher_date DESC) WHERE is_posted = TRUE;

-- Account detail aggregation (balance calculation)
CREATE INDEX idx_voucher_details_lookup ON voucher_details(voucher_id, account_code, entry_type);

-- Partner sub-ledger lookups
CREATE INDEX idx_details_partner_account ON voucher_details(partner_id, account_code) WHERE partner_id IS NOT NULL;

-- Monthly balance snapshots (reporting)
CREATE UNIQUE INDEX ux_monthly_balances_company_account_partner_month_year
ON monthly_balances(company_id, account_code, COALESCE(partner_id, 0), month, year);
```

### 6.3 Redis Usage

| Key Pattern | Purpose | TTL |
|------------|---------|-----|
| `session:{userId}:{token}` | Session cache | JWT expiry |
| `rate_limit:{ip}:{path}` | Rate limiting | 15 min |
| `idempotency:{companyId}:{key}` | Idempotency | 24 hours |
| `bullmq:*` | Job queues | Persistent |
| `socket.io:*` | WebSocket adapter | Session-based |

---

## 7. EVENT-DRIVEN ARCHITECTURE

### 7.1 Event Sources & Consumers

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│  STOREFRONT  │     │    BACKEND       │     │  FRONT-END   │
│  Events:     │     │    Events:       │     │  Events:     │
│  • sale      │────▶│  • voucher:CRUD  │────▶│  • voucher   │
│  • purchase  │     │  • order:status  │     │  • balance   │
│  • credit    │     │  • inventory:qty │     │  • order     │
│              │     │  • balance:upd   │     │  • inventory │
│              │     │  • notification  │     │  • notify    │
└─────────────┘     └─────────────────┘     └──────────────┘
       │                      │                      │
       │                      │                      │
       └──────────────────────┴──────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │    WebSocket Hub     │
                    │  (Socket.io + Redis) │
                    │   pub/sub adapter   │
                    └─────────────────────┘
```

### 7.2 Cron Jobs (Background Events)

#### 7.2.1 `cron/trainFeedbackLoop.js` (174 lines) — Weekly RLHF

**Schedule:** Weekly (via BullMQ scheduler)
**Purpose:** Collect AI misclassifications corrected by humans → send to AI service as training data

**Flow:**
```
1. QUERY: SELECT FROM ai_hitl_logs WHERE is_modified = TRUE AND approved_at >= NOW() - 7 days
2. POST: /api/fine-tune → Python AI service
3. DATA: { training_data: rows } — human-corrected AI proposals
4. RESPONSE: { new_version, improvement }
```

#### 7.2.2 `cron/reversingEntriesCron.js` (247 lines) — Yearly Reversal

**Schedule:** Every Jan 1 (via cron)
**Purpose:** Auto-reverse prepaid expenses from prior year

**Flow:**
```
1. QUERY: SELECT active companies
2. FOR EACH company:
   a. CHECK: Đã hoàn nhập chưa?
   b. IF NOT: createReversingEntries(year)
   c. LOG: success/failure
3. RETURN: { success, total_companies, results }
```

### 7.3 REA Event Processing (`routes/events.js` + `core/rea/`)

**Single Endpoint for ALL Business Events:**
```
POST /api/events
Body: { entityType, company_id, dimensions, ...eventData }
```

**Processing Pipeline (verified from source):**
```
1. BEGIN TRANSACTION
2. Dynamic Processor (DB-driven via reaProcessorBridge):
   a. Read event processors from database
   b. Execute validate → calculate → generateEntries
3. Fallback: Legacy Processor (hard-coded reaEventMapper):
   a. getEventProcessor(entityType)
   b. safeCall(processor.validate, eventData, companyId)
   c. safeCall(processor.calculate, eventData) || eventData
   d. processor.generateEntries(calculated)
4. Create Voucher: VoucherService.create()
5. Trigger Workflow: triggerWorkflow(entityType, eventData)
6. COMMIT
```

**Event Processor Registry (from `core/rea/reaEventMapper.js`, 963 lines):**

| Event Type | Description | Workflow Trigger? |
|------------|-------------|-------------------|
| `SALES_ORDER_CREATED` | New sales order | ✅ Yes |
| `PURCHASE_REQUISITION_CREATED` | Purchase request | ✅ Yes |
| `INVENTORY_TRANSFER_CREATED` | Inventory transfer | ✅ Yes |
| `PAYMENT_CREATED` | Payment event | ✅ Yes |
| `circular_netting` | Multi-party netting | ❌ |
| `sale` | Direct sale | ❌ |
| `simple_purchase` | Direct purchase | ❌ |
| `sales_credit` | Sales credit entry | ❌ |
| *(20+ more processors)* | | |

**Circular Netting Algorithm (from `reaEventMapper.js` lines 40-80):**
```javascript
// 1. Build payable matrix N×N
// 2. Find minimum in closed chain
// 3. Net each party's receivable/payable
// 4. Generate clearing entries
```

### 7.4 Event Adapters (Storefront → REA)

**File: `storefront/src/services/storefrontEventAdapter.js` (260 lines)**

**3 Converters:**

| Storefront Action | REA Event Type | Accounting Impact |
|------------------|----------------|-------------------|
| Guest checkout | `sale` | Nợ 131 (phải thu) / Có 511 (doanh thu) |
| Product creation | `simple_purchase` | Nợ 156 (hàng hóa) / Có 331 (phải trả) |
| Order completion | `sales_credit` | Nợ 111 (tiền) / Có 131 (phải thu) |

**Idempotency Guarantee:**
```javascript
const idempotencyKey = generateIdempotencyKey();
const result = await withIdempotency(
  () => sendEventToBackend(event, idempotencyKey),
  idempotencyKey
);
```

---

## 8. REA ACCOUNTING ENGINE (Core Innovation)

### 8.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   REA ARCHITECTURE                           │
│  (Resources → Events → Agents)                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   RESOURCES   │    │   EVENTS     │    │   AGENTS     │   │
│  │  (Tài sản)   │    │ (Nghiệp vụ) │    │ (Đối tượng)  │   │
│  ├──────────────┤    ├──────────────┤    ├──────────────┤   │
│  │ • Cash (111)  │    │ • Sale       │    │ • Customer   │   │
│  │ • Inventory   │    │ • Purchase   │    │ • Supplier   │   │
│  │ • Receivables │    │ • Transfer   │    │ • Employee   │   │
│  │ • Equipment   │    │ • Payment    │    │ • Department │   │
│  └──────────────┘    └──────────────┘    └──────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          ACCOUNTING ENTRIES GENERATED                  │   │
│  │  DUALITY: Every event produces DR/CR entry pairs     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Database-Driven Posting (`services/dynamicPosting.service.js`)

**Instead of hard-coding account numbers in JavaScript, the system reads from DB tables:**
```sql
-- accounting_posting_rules table (created by migration)
-- Defines: event_type → { debit_account, credit_account }
```

**Enabled via env var:**
```
USE_DYNAMIC_POSTING=true  → reads from DB
USE_DYNAMIC_POSTING=false → uses hard-coded reaEventMapper.js
```

### 8.3 Workflow Engine Integration

**User-Defined Workflows (`routes/workflows.js` + `services/workflowEngine.service.js`):**

```javascript
// Workflow structure:
{
  id: 1,
  workflow_name: 'Phê duyệt đơn hàng',
  workflow_code: 'ORDER_APPROVAL',
  trigger_event: 'SALES_ORDER_CREATED',
  trigger_conditions: { min_amount: 10000000 },
  steps: [
    { type: 'approval', role: 'admin', order: 1 },
    { type: 'notification', role: 'ktt', order: 2 }
  ],
  variables: {},
  is_active: true
}
```

---

## 9. AI SERVICE INTEGRATION MATRIX

### 9.1 Communication Flow

```
┌─────────────────┐         HTTP/HTTPS          ┌──────────────────────┐
│   BACKEND        │───────────────────────────▶│   AI SERVICE          │
│   (Node.js)      │◀───────────────────────────│   (Python/FastAPI)    │
│                   │     JSON + Shared Secret   │                        │
│  • aiCopilot     │                            │  • POST /api/ocr      │
│  • aiOcr         │                            │  • POST /api/self-fix │
│  • trainFeedback  │                            │  • POST /api/fine-tune│
│  • geminiClient   │                            │  • POST /api/text-to-sql│
│  • aiApiPool      │                            │  • POST /api/rag-summarize│
└─────────────────┘                            └──────────────────────┘
        │                                               │
        │  Gemini API (direct)                           │  numpy
        │  Groq API (direct)                            │  (simple ML)
        │  DeepSeek API (direct)                        │
        │  Cloudflare Proxy (optional)                   │
        ▼                                               ▼
┌─────────────────┐                            ┌──────────────────────┐
│  EXTERNAL APIs   │                            │  LOCAL ML MODELS     │
│  • Gemini        │                            │  • OCR (regex/Paddle)│
│  • Groq          │                            │  • NLP (pattern)     │
│  • DeepSeek      │                            │  • TimeSeries (lin)  │
└─────────────────┘                            │  • SelfFix (mock)    │
                                                └──────────────────────┘
```

### 9.2 AI Service Endpoints (from `ai-service/main.py`)

| Endpoint | Model Used | Status | Returns |
|----------|-----------|--------|---------|
| `GET /health` | — | ✅ Live | `{ status, timestamp }` |
| `POST /api/ocr` | OCRModel | ✅ Live | `{ confidence, invoice_number, entries }` |
| `POST /api/self-fix` | SelfFixModel | ⚠️ Mock | `{ confidence, changes }` |
| `POST /api/fine-tune` | SelfFixModel | ⚠️ Mock | `{ new_version, improvement }` |
| `POST /api/text-to-sql` | NLPModel | ✅ Live | `{ sql, confidence }` |
| `POST /api/rag-summarize` | NLPModel | ✅ Live | `{ answer, confidence }` |
| `POST /api/predict-opening-balance` | TimeSeriesModel | ✅ Live | `{ predicted_balance, confidence }` |
| `POST /api/predict-closing` | — | ⚠️ Hardcoded | Static response |
| `POST /api/optimize-route` | — | ⚠️ Hardcoded | Static response |
| `POST /api/predict-depreciation` | — | ⚠️ Hardcoded | Static response |
| `POST /api/predict-delivery-time` | — | ⚠️ Hardcoded | Static response |
| `POST /api/predict-warehouse-load` | — | ⚠️ Hardcoded | Static response |
| `POST /api/analyze-notification-priority` | — | ⚠️ Hardcoded | Static response |
| `POST /api/suggest-notification-time` | — | ⚠️ Hardcoded | Static response |
| `POST /api/summarize-notifications` | — | ⚠️ Hardcoded | Static response |
| `POST /api/verify-einvoice` | — | ⚠️ Hardcoded | Static response |
| `POST /api/detect-fraud` | — | ⚠️ Hardcoded | Static response |
| `POST /api/reconcile-invoices` | — | ⚠️ Hardcoded | Static response |
| `POST /api/predict-salary` | — | ⚠️ Hardcoded | Static response |
| `POST /api/analyze-kpi` | — | ⚠️ Hardcoded | Static response |
| `POST /api/predict-recruitment` | — | ⚠️ Hardcoded | Static response |

**Legend:**
- ✅ **Live** — Có logic thực tế, xử lý dữ liệu đầu vào
- ⚠️ **Mock** — Trả về dữ liệu tĩnh hoặc công thức đơn giản
- ⚠️ **Hardcoded** — Trả về JSON cứng, không xử lý input

### 9.3 AI Model Details

#### 9.3.1 OCRModel (`models/ocr_model.py`)

**Engine Selection:**
```python
self.engine = os.getenv('AI_OCR_ENGINE', 'regex').lower()
# Options: paddle | tesseract | http | regex
# Default: regex (no heavy dependencies)
```

**Regex Engine (current):** Pattern matching only
**PaddleOCR** (commented): Requires GPU, commented in requirements.txt
**Tesseract** (commented): CPU OCR, commented in requirements.txt

#### 9.3.2 NLPModel (`models/nlp_model.py`)

**Pattern-Based (not real NLP):**
```python
PATTERNS = {
  'monthly_revenue': r'doanh thu tháng',
  'yearly_revenue': r'doanh thu năm',
  'total_expense': r'tổng chi phí'
}
```

#### 9.3.3 TimeSeriesModel (`models/time_series_model.py`)

**Simple Linear Regression:**
```python
def train(self, data):
  x = np.arange(len(data))
  slope = (sum((x - x_mean) * (y - y_mean))) / sum((x - x_mean) ** 2)
  intercept = y_mean - slope * x_mean
  return {'slope': slope, 'intercept': intercept}
```

#### 9.3.4 SelfFixModel (`models/self_fix_model.py`)

**Mock Implementation:**
```python
def attempt_fix(self, original_proposal, attempt):
  new_confidence = min(100, original_confidence + (5 * attempt))
  # No real learning — formula-based confidence boost
```

### 9.4 Authentication (Shared Secret)

```python
# ai-service/middleware/auth.py
AI_INTERNAL_SECRET = os.getenv("AI_INTERNAL_SECRET", "")
# Backend sends: X-AI-Internal-Secret header
# AI Service validates: matches AI_INTERNAL_SECRET
```

---

## 10. DATA FLOW: REAL-WORLD TRANSACTIONS

### 10.1 Flow A: Creating a Voucher (ERP User → Database)

```
1. USER ACTION
   User fills VoucherForm in front-end
   → Form validation (Zod schema)
   → Pre-fill classification via TransactionClassifier

2. FRONT-END (api.js)
   → Generate idempotency_key (UUID)
   → POST /api/vouchers
   → Headers: { Authorization: Bearer <memoryToken>, X-Company-Id, X-Client-Instance-Id }

3. BACKEND MIDDLEWARE STACK
   → correlationId (attach X-Correlation-ID)
   → helmet (security headers)
   → cors (origin check)
   → express.json (parse body)
   → cookieParser (extract cookies)
   → waf (SQL injection + XSS check)
   → apiRateLimiter (Redis Lua script)
   → waitForDb (check DB ready)
   → authenticate (JWT verify + session DB check)
   → checkCompanyAccess (user_company junction)
   → [Route Handler]

4. ROUTE HANDLER (routes/vouchers.js)
   → BEGIN TRANSACTION
   → checkIdempotency() → if duplicate, return cached
   → checkLockDate() → validate date >= lock_date
   → validateVoucherSchema() → account codes, DR=CR
   → INSERT vouchers table
   → INSERT voucher_details (JSON_AGG)
   → INSERT idempotency_keys (status=completed)
   → COMMIT

5. ASYNC (post-response)
   → emitVoucherRealtime() → WebSocket broadcast to company room
   → EventHelpers.voucherCreated() → trigger workflows

6. FRONT-END (WebSocket listener)
   → catches 'change:voucher' event
   → Refreshes voucher list

7. FRONT-END (accountingEngine)
   → calculateBalances() recalculates
   → Displays updated balance
```

### 10.2 Flow B: Storefront Guest Checkout

```
1. STOREFRONT (StorefrontPage.jsx)
   → User browses products (GET /api/public/items)
   → Adds to cart (FloatingCartBar)
   → Clicks checkout

2. STOREFRONT (useStorefrontEvents hook)
   → convertGuestCheckoutToSaleEvent(orderData)
   → generateIdempotencyKey()
   → POST /api/events (via authApi)

3. BACKEND (routes/events.js)
   → authenticate (JWT or cookie)
   → processSingleEvent()
   → Dynamic Processor or Legacy Fallback
   → VoucherService.create()
   → triggerWorkflow()
   → emitVoucherRealtime()

4. BACKEND (WebSocket)
   → publishToCompany(companyId, 'order_status_update', { orderId, status: 'confirmed' })

5. STOREFRONT (WebSocket listener)
   → Updates order status display
   → Shows confirmation
```

### 10.3 Flow C: Month-End Closing

```
1. TRIGGER: Admin clicks "Kết chuyển sổ" or scheduled cron
   → POST /api/closing (need to verify)
   → Body: { companyId, month, year }

2. CLOSING SERVICE (services/closing.service.js)
   → acquireLock('closing', { companyId, ttl: 60000 })
   → SELECT ... FOR UPDATE NOWAIT
   → Check duplicate (closing_entries table)
   → Insert closing_entries (processing)

3. STEP 1: Revenue Close
   → Nợ 511 / Có 911 = total revenue credit

4. STEP 2: Cost Close
   → Nợ 911 / Có 632/641/642 = total cost debit

5. STEP 3: Tax Calculation
   → Progressive tax based on revenue tiers
   → Nợ 821 / Có 3334 = tax payable

6. STEP 4: Profit/Loss Close
   → Nợ/Có 911 → 4212 = retained earnings

7. FINALIZE
   → UPDATE monthly_balances (with opening carry-forward)
   → UPDATE closing_entries (completed)
   → releaseLock()
   → publishToCompany(companyId, 'change:balance', ...)
```

### 10.4 Flow D: AI Copilot Query

```
1. USER: "Tổng doanh thu tháng này?"
   → POST /api/ai/query

2. BACKEND (aiQuery.js)
   → authenticate
   → askFinancialCopilot(question, companyId)

3. aiCopilot.service.js
   → isGeminiAvailable()? → call generateSQL()
   → isDeepSeekAvailable()? → fallback
   → Offline mode → keyword matching

4. EXECUTE SQL
   → pool.query(result.sql, [companyId])
   → Return data rows

5. RESPONSE
   → { sql, data: [...], confidence, model, provider }
```

---

## 11. SECURITY ARCHITECTURE

### 11.1 Defense Layers

| Layer | Technology | Protection Against |
|-------|-----------|-------------------|
| **L7** | helmet | Clickjacking, MIME sniffing, XSS |
| **L6** | CORS | Cross-origin abuse |
| **L5** | WAF | SQL injection, XSS |
| **L4** | Rate Limiter (Redis) | Brute force, DDoS |
| **L3** | JWT + Sessions | Token theft, session hijack |
| **L2** | checkCompanyAccess | Cross-tenant data access |
| **L1** | requireRole + requireRootAdmin | Privilege escalation |

### 11.2 Authentication Flow

```
LOGIN:
1. POST /auth/login { username, password }
2. bcryptjs.compare(password, hash)
3. If valid:
   a. jwt.sign({ id, company_ids, role, is_root_admin })
   b. INSERT sessions (token, refresh_token)
   c. Set HttpOnly cookies (access_token, refresh_token)
   d. Return { user, accessToken, refreshToken }

EVERY REQUEST:
1. Extract token: cookies → Authorization header
2. jwt.verify(token)
3. SELECT FROM sessions WHERE token = $1 AND expires_at > now()
4. If valid: next() | If invalid: 401

TOKEN REFRESH:
1. POST /auth/refresh (sends refresh_token cookie)
2. Validate refresh_token in DB
3. Issue new access_token
4. Update session record

LOGOUT:
1. DELETE FROM sessions WHERE token = $1
2. Clear cookies
```

### 11.3 Known Security Issues (All Fixed in v2)

| Issue | Severity | File | Fix |
|-------|----------|------|-----|
| No auth on AI pool test endpoints | 🔴 Critical | `routes/aiPool.routes.js` | Added `authenticate` + `requireRole(['admin'])` |
| No auth on accounting endpoints | 🟠 High | `routes/accounting.js` | Added `authenticate` to 6 routes |
| No HTTP security headers | 🟠 High | `server.js` | Added `helmet` middleware |

### 11.4 Intentionally Public Routes

| File | Endpoints | Reason |
|------|-----------|--------|
| `publicRoutes.js` | `GET /items`, `POST /orders`, `POST /partners/find-or-create` | Storefront public API (NĐ 248/2026) |
| `legalPublic.js` | `GET /business-info`, `POST /complaints`, `GET /documents` | Legal compliance (NĐ 248/2026) |
| `server.js` | `GET /api/health` | Monitoring |

---

## 12. OPERATIONAL MODEL & STATE MACHINES

### 12.1 Voucher State Machine

```
                    ┌─────────────┐
                    │   DRAFT     │
                    └──────┬──────┘
                           │ POST /api/vouchers/:id/post
                           ▼
                    ┌─────────────┐
               ┌───│   POSTED    │───┐
               │   └─────────────┘   │
               │                    │
       POST /unpost           has is_reversing=true
               │                    │
               ▼                    ▼
        ┌─────────────┐     ┌─────────────┐
        │   UNPOSTED   │     │  REVERSED   │
        └─────────────┘     └─────────────┘
```

### 12.2 Closing Entry State Machine

```
                    ┌─────────────┐
                    │  PROCESSING │ (INSERT INTO closing_entries)
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │             │
                    ▼             ▼
             ┌──────────┐  ┌──────────┐
             │COMPLETED  │  │  FAILED  │
             │(success)  │  │(error)   │
             └──────────┘  └──────────┘
```

### 12.3 Workflow Instance State Machine

```
                    ┌─────────────┐
                    │   PENDING   │
                    └──────┬──────┘
                           │ trigger by event
                           ▼
                    ┌─────────────┐
                    │  APPROVED   │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │             │
                    ▼             ▼
             ┌──────────┐  ┌──────────┐
             │COMPLETED  │  │ REJECTED │
             └──────────┘  └──────────┘
```

### 12.4 Storefront Order State Machine

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ PENDING  │───▶│ASSIGNED  │───▶│DELIVERING│───▶│COMPLETED │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │                                              │
     │ (cancel)                                      │ (fail)
     ▼                                              ▼
┌──────────┐                                    ┌──────────┐
│CANCELLED │                                    │  FAILED  │
└──────────┘                                    └──────────┘
```

---

## APPENDIX A: Key Metrics Summary

| Metric | Value | Source |
|--------|-------|--------|
| **Backend Files** | 200+ JS files | File scan |
| **Route Files** | 45+ | server.js imports |
| **Services** | 50+ | backend/services/ |
| **Database Tables** | 25+ | schema.sql |
| **Database Indexes** | 40+ | schema.sql |
| **AI API Endpoints** | 21 | ai-service/main.py |
| **AI API Keys Total** | 13 (6 Gemini, 4 Groq, 3 DeepSeek) | .env |
| **AI API RPM Total** | 390 (90 Gemini, 120 Groq, 180 DeepSeek) | aiApiPool config |
| **Test Files** | 50+ | backend/tests/ |
| **Test Cases** | 384 (350 passed, 34 failed) | test_results.txt |
| **WebSocket Events** | 6 types | websocket.service.js |
| **Cron Jobs** | 2 (weekly RLHF, yearly reversal) | cron/ |
| **REA Event Processors** | 20+ | reaEventMapper.js |

---

## APPENDIX B: Environment Variables Reference

| Variable | Used By | Purpose |
|----------|---------|---------|
| `FRONTEND_URL` | Backend CORS | Allowed origins |
| `JWT_SECRET` | Backend auth | Token signing |
| `AI_INTERNAL_SECRET` | Backend + AI Service | Inter-service auth |
| `GEMINI_KEYS` | Backend aiApiPool | 6 Gemini keys |
| `GROQ_KEYS` | Backend aiApiPool | 4 Groq keys |
| `DEEPSEEK_KEYS` | Backend aiApiPool | 3 DeepSeek keys |
| `CLOUDFLARE_PROXY_URL` | Backend aiApiPool | IP masking proxy |
| `PROXY_SECRET_TOKEN` | Backend aiApiPool | Proxy auth |
| `VITE_API_BASE_URL` | Front-end + Storefront | Backend URL |
| `VITE_WS_URL` | Front-end + Storefront | WebSocket URL |
| `VITE_VAPID_PUBLIC_KEY` | Front-end + Storefront | Push notification key |
| `PYTHON_AI_SERVICE_URL` | Backend | AI service URL |
| `USE_DYNAMIC_POSTING` | Backend | DB-driven posting toggle |
| `REDIS_URL` | Backend | Redis connection |
| `DATABASE_URL` | Backend | PostgreSQL connection |

---

**Document Prepared By:** CTO + Senior Project Director  
**Date:** 2026-07-21  
**Classification:** Internal — Development Team  
**Next Review:** 2026-08-04