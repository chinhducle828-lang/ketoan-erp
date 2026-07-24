# Tài liệu Thiết kế Kiến trúc Hệ thống (SAD)
## KETOAN ERP - System Architecture Document

**Phiên bản:** 1.0.0  
**Ngày:** 23/07/2026  

---

## 1. Tổng quan Kiến trúc

### 1.1. Kiến trúc Tổng thể (High-Level Architecture)

KETOAN ERP sử dụng kiến trúc **Microservices lai (Hybrid Microservices)** với 4 service chính:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        KETOAN ERP SYSTEM                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────┐    ┌─────────────────────┐                 │
│  │   FRONTEND (ERP)    │    │   STOREFRONT (POS)  │                 │
│  │   React 18 + Vite   │    │   React 18 + Vite   │                 │
│  │   Port: 3000        │    │   Port: 3001        │                 │
│  └─────────┬───────────┘    └──────────┬──────────┘                 │
│            │                           │                            │
│            └──────────┬────────────────┘                            │
│                       │                                             │
│              ┌────────▼────────┐                                    │
│              │   REVERSE PROXY  │                                    │
│              │   (Railway)     │                                    │
│              └────────┬────────┘                                    │
│                       │                                             │
│         ┌─────────────┼─────────────┐                               │
│         │             │             │                               │
│  ┌──────▼──────┐ ┌────▼────┐ ┌─────▼──────┐                        │
│  │  BACKEND    │ │  REDIS  │ │ AI SERVICE │                        │
│  │  Node.js    │ │  Cache  │ │  Python     │                        │
│  │  Express    │ │  Queue  │ │  FastAPI    │                        │
│  │  Port: 5000 │ │  :6379  │ │  Port: 8000 │                        │
│  └──────┬──────┘ └─────────┘ └────────────┘                        │
│         │                                                           │
│  ┌──────▼──────┐                                                    │
│  │ POSTGRESQL  │                                                    │
│  │  Database   │                                                    │
│  │  :5432      │                                                    │
│  └─────────────┘                                                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2. Nguyên tắc Kiến trúc (Architecture Principles)

| Nguyên tắc | Mô tả |
|-----------|-------|
| **Separation of Concerns** | Mỗi service có trách nhiệm riêng biệt |
| **API-First** | Mọi chức năng đều có REST API |
| **Event-Driven** | REA (Resources-Events-Agents) pattern cho nghiệp vụ |
| **CQRS** | Tách biệt Command (ghi) và Query (đọc) |
| **Idempotency** | Xử lý trùng lặp an toàn |
| **Graceful Degradation** | Hoạt động khi mất kết nối AI |
| **Security by Design** | Bảo mật từ thiết kế |

---

## 2. Kiến trúc Backend (Node.js)

### 2.1. Cấu trúc Thư mục

```
backend/
├── server.js              # Entry point, Express app setup
├── config/                # Configuration files
│   ├── db.js              # PostgreSQL pool config
│   ├── aiConfig.js        # AI provider configuration
│   └── businessRules.js   # Business rules validation
├── middleware/             # Express middleware
│   ├── auth.js            # JWT authentication
│   ├── waf.js             # Web application firewall
│   ├── rateLimiter.js     # Rate limiting
│   ├── correlationId.js   # Request tracing
│   └── errorHandler.js    # Global error handler
├── routes/                # API route definitions (45+ files)
│   ├── auth.js            # Authentication routes
│   ├── vouchers.js        # Voucher CRUD
│   ├── companies.js       # Company management
│   ├── items.js           # Item/Product management
│   ├── partners.js        # Partner management
│   ├── inventoryRoutes.js # Inventory operations
│   ├── report.js          # Financial reports
│   ├── aiQuery.js         # AI Copilot queries
│   ├── hitl.js            # Human-in-the-loop
│   └── ...                # 35+ additional route files
├── controllers/           # Business logic controllers
├── services/              # Business logic services (60+ files)
│   ├── aiCopilot.service.js      # AI Financial Copilot
│   ├── aiOrchestrator.service.js # AI Workflow Orchestrator
│   ├── aiApiPool.service.js      # Multi-provider AI pool
│   ├── aiModelRouter.service.js  # Auto model routing
│   ├── aiSelfFix.service.js      # RLHF self-fix
│   ├── aiProposal.service.js     # AI proposal generation
│   ├── closing.service.js        # Period closing
│   ├── voucher.service.js        # Voucher operations
│   ├── inventory.service.js      # Inventory management
│   ├── projectionEngine.service.js # CQRS projections
│   ├── workflowEngine.service.js # Workflow engine
│   └── ...                # 50+ additional service files
├── repositories/          # Data access layer
├── validators/            # Zod validation schemas
├── utils/                 # Utility functions
├── workers/               # Background workers (BullMQ)
├── cron/                  # Scheduled tasks
├── cache/                 # Redis cache layer
├── migrations/            # Database migrations
├── tests/                 # Test files
└── docs/                  # Documentation
```

### 2.2. Request Lifecycle

```
Client Request
    │
    ▼
1. Correlation ID Middleware (gán request ID)
    │
    ▼
2. WAF Middleware (kiểm tra malicious patterns)
    │
    ▼
3. Rate Limiter Middleware (kiểm tra quota)
    │
    ▼
4. CORS Middleware (kiểm tra origin)
    │
    ▼
5. Auth Middleware (JWT verification) [nếu cần]
    │
    ▼
6. Route Handler
    │
    ▼
7. Controller / Service Layer
    │
    ▼
8. Repository / Database
    │
    ▼
9. Response (JSON)
    │
    ▼
10. Error Handler (nếu có lỗi)
```

### 2.3. Authentication Flow

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  Client  │         │  Backend │         │    DB    │
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │
     │  POST /api/auth/login                   │
     │  {username, password}                   │
     │──────────────────►│                    │
     │                    │  SELECT * FROM users
     │                    │  WHERE username=?  │
     │                    │───────────────────►│
     │                    │◄───────────────────│
     │                    │                    │
     │                    │  bcrypt.compare()  │
     │                    │                    │
     │                    │  INSERT INTO sessions
     │                    │  (token, refresh)  │
     │                    │───────────────────►│
     │                    │◄───────────────────│
     │                    │                    │
     │  {access_token,    │                    │
     │   refresh_token}   │                    │
     │◄──────────────────│                    │
     │                    │                    │
     │  GET /api/vouchers (with Bearer token)  │
     │──────────────────►│                    │
     │                    │  Verify JWT        │
     │                    │  Check session     │
     │                    │  Check permissions │
     │                    │                    │
     │  {vouchers data}   │                    │
     │◄──────────────────│                    │
```

---

## 3. Kiến trúc Database

### 3.1. Entity Relationship Diagram (ERD) - Tổng quan

```
┌───────────┐     ┌───────────┐     ┌───────────┐
│ companies │─────│   users   │─────│ sessions  │
└───────────┘     └───────────┘     └───────────┘
      │                                  │
      │     ┌───────────┐     ┌───────────┐
      ├─────│ partners  │     │audit_logs │
      │     └───────────┘     └───────────┘
      │
      │     ┌───────────┐     ┌───────────┐
      ├─────│  items    │─────│inventory_ │
      │     └───────────┘     │vouchers   │
      │                       └───────────┘
      │     ┌───────────┐     ┌───────────┐
      ├─────│ vouchers  │─────│voucher_   │
      │     └───────────┘     │details    │
      │                       └───────────┘
      │     ┌───────────┐     ┌───────────┐
      ├─────│opening_   │     │monthly_   │
      │     │balances   │     │balances   │
      │     └───────────┘     └───────────┘
      │
      │     ┌───────────┐     ┌───────────┐
      ├─────│rea_events │─────│rea_event_ │
      │     └───────────┘     │processors │
      │                       └───────────┘
      │     ┌───────────┐     ┌───────────┐
      ├─────│ai_hitl_   │     │event_store│
      │     │logs       │     └───────────┘
      │     └───────────┘
      │     ┌───────────┐
      └─────│workflows  │
            └───────────┘
```

### 3.2. Core Tables

#### companies
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Mã công ty |
| name | VARCHAR(255) | Tên công ty |
| tax_code | VARCHAR(50) UNIQUE | Mã số thuế |
| address | TEXT | Địa chỉ |
| entity_type | VARCHAR(50) | Loại hình (company/branch) |
| lock_date | DATE | Ngày khóa sổ |
| is_active | BOOLEAN | Trạng thái hoạt động |

#### users
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Mã người dùng |
| username | VARCHAR(100) UNIQUE | Tên đăng nhập |
| password | TEXT | Mật khẩu (bcrypt hash) |
| role | VARCHAR(20) | Vai trò (admin/ktt/nv/...) |
| company_ids | INT[] | Danh sách công ty được truy cập |
| is_root_admin | BOOLEAN | Root admin flag |
| department | VARCHAR(50) | Phòng ban |
| clearance_level | INT | Cấp độ phân quyền |

#### vouchers
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Mã chứng từ |
| company_id | INT FK | Công ty |
| voucher_number | VARCHAR(100) | Số chứng từ |
| voucher_date | DATE | Ngày chứng từ |
| voucher_type | VARCHAR(10) | Loại (PT/PC/NK/XK) |
| description | TEXT | Diễn giải |
| is_posted | BOOLEAN | Đã ghi sổ |
| ai_confidence_score | DECIMAL(5,2) | Điểm tin cậy AI |
| sign_status | VARCHAR(20) | Trạng thái ký số |

#### voucher_details
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Mã chi tiết |
| voucher_id | INT FK | Chứng từ cha |
| account_code | VARCHAR(20) | Tài khoản kế toán |
| entry_type | VARCHAR(2) | Nợ (DR) / Có (CR) |
| amount | NUMERIC(15,2) | Số tiền |
| partner_id | INT FK | Đối tác (công nợ) |
| item_id | INT FK | Hàng hóa (kho) |

### 3.3. AI & Event Tables

#### ai_hitl_logs
| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL PK | Mã log |
| tenant_id | VARCHAR(50) | Tenant ID |
| voucher_id | BIGINT FK | Chứng từ liên quan |
| ai_confidence_score | DECIMAL(5,2) | Điểm tin cậy AI |
| original_ai_proposal | JSONB | Đề xuất gốc của AI |
| final_human_approved | JSONB | Phê duyệt cuối của người |
| is_modified | BOOLEAN | Người dùng có sửa không |
| self_fix_attempts | INTEGER | Số lần AI tự sửa |
| is_self_fixed | BOOLEAN | AI đã tự sửa thành công |

#### rea_events
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Mã sự kiện |
| company_id | INT FK | Công ty |
| event_type | VARCHAR(50) | Loại sự kiện |
| event_data | JSONB | Dữ liệu sự kiện |
| resources | JSONB | Tài nguyên liên quan |
| agents | JSONB | Tác nhân liên quan |
| accounting_entries | JSONB | Bút toán kế toán sinh ra |
| voucher_id | INT FK | Chứng từ kết quả |

---

## 4. Kiến trúc AI

### 4.1. Multi-Provider AI Pool

```
┌─────────────────────────────────────────────────────────────┐
│                    AI API POOL (Node.js)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   GEMINI     │  │    GROQ      │  │  DEEPSEEK    │       │
│  │  6 keys      │  │  4 keys      │  │  3 keys      │       │
│  │  Round-robin │  │  Round-robin │  │  Round-robin │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │                │
│         └─────────┬───────┴─────────┬───────┘                │
│                   │                 │                        │
│          ┌────────▼────────┐  ┌─────▼──────┐                 │
│          │  Cloudflare     │  │  Direct    │                 │
│          │  Proxy (IP mask)│  │  API Call  │                 │
│          └─────────────────┘  └────────────┘                 │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              AI Model Router                          │    │
│  │  SQL → Gemini │ Math → DeepSeek │ Chat → Groq        │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              Circuit Breaker                          │    │
│  │  Tự động chuyển provider khi API fail > threshold     │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2. AI Service Modules (Python)

```
┌─────────────────────────────────────────────────────────────┐
│              PYTHON AI SERVICE (FastAPI)                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                  │
│  │   OCR Model      │  │   NLP Model      │                  │
│  │  - PaddleOCR     │  │  - Text-to-SQL   │                  │
│  │  - Invoice parse │  │  - Classification │                  │
│  │  - Confidence    │  │  - Entity extract │                  │
│  └──────────────────┘  └──────────────────┘                  │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                  │
│  │  TimeSeries Model│  │  SelfFix Model   │                  │
│  │  - Cashflow pred │  │  - RLHF learning │                  │
│  │  - Closing pred  │  │  - Fine-tuning   │                  │
│  │  - Salary pred   │  │  - Feedback loop │                  │
│  └──────────────────┘  └──────────────────┘                  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              API Endpoints                             │    │
│  │  /api/ocr │ /api/self-fix │ /api/fine-tune            │    │
│  │  /api/text-to-sql │ /api/rag-summarize                │    │
│  │  /api/predict-* (closing, salary, cashflow, ...)      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.3. AI Workflow Orchestrator

```
┌─────────────────────────────────────────────────────────────┐
│              AI ORCHESTRATOR                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  WORKFLOW: Period Closing                                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Step 1: Check Revenue (AI Journal)                    │    │
│  │ Step 2: Check Expenses (AI Journal)                   │    │
│  │ Step 3: Reconcile AR/AP (AI Copilot)                  │    │
│  │ Step 4: Inventory Check (AI Inventory)                │    │
│  │ Step 5: Cashflow Review (AI Cashflow)                 │    │
│  │ Step 6: Generate Closing Entries (AI Closing)         │    │
│  │ Step 7: Generate Reports (AI Report)                  │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  WORKFLOW: Invoice Processing                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Step 1: OCR Scan (Python AI)                         │    │
│  │ Step 2: Classify (AI Department Classifier)          │    │
│  │ Step 3: Suggest Entries (AI Proposal)                │    │
│  │ Step 4: Human Review (HITL)                          │    │
│  │ Step 5: Self-Fix if rejected (AI SelfFix)            │    │
│  │ Step 6: Post to Ledger (Auto or Manual)              │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Kiến trúc REA (Resources-Events-Agents)

### 5.1. REA Pattern

KETOAN ERP sử dụng mô hình REA (Resources-Events-Agents) làm nền tảng cho xử lý nghiệp vụ:

```
┌─────────────────────────────────────────────────────────────┐
│                    REA MODEL                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐             │
│  │ RESOURCE │◄────│  EVENT   │────►│  AGENT   │             │
│  └──────────┘     └──────────┘     └──────────┘             │
│       │               │               │                      │
│       │               │               │                      │
│       ▼               ▼               ▼                      │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐             │
│  │  Items   │     │  Sale    │     │Customer  │             │
│  │  Cash    │     │ Purchase │     │Supplier  │             │
│  │  Inventory│    │  Payment │     │Employee  │             │
│  └──────────┘     └──────────┘     └──────────┘             │
│                                                              │
│  Event → Accounting Entries (Dynamic Posting Rules)          │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ rea_events → accounting_posting_rules → voucher_details│   │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2. Event Flow

```
1. User Action (e.g., Create Sale Invoice)
       │
       ▼
2. rea_events.insert({event_type: 'sale_invoice', ...})
       │
       ▼
3. rea_event_processors lookup (match event_type + company)
       │
       ▼
4. Generate accounting entries from posting rules
       │
       ▼
5. Create voucher + voucher_details
       │
       ▼
6. CQRS Projection: Update account_dimension_balances
       │
       ▼
7. WebSocket: Notify connected clients
       │
       ▼
8. Event Store: Log to event_store for audit
```

---

## 6. Kiến trúc CQRS (Command Query Responsibility Segregation)

### 6.1. CQRS Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    CQRS ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐      ┌──────────────────┐              │
│  │   COMMAND SIDE   │      │    QUERY SIDE    │              │
│  │   (Write)        │      │    (Read)        │              │
│  ├──────────────────┤      ├──────────────────┤              │
│  │                  │      │                  │              │
│  │  POST /vouchers  │      │  GET /vouchers   │              │
│  │  POST /rea-events│      │  GET /balances   │              │
│  │  PATCH /items    │      │  GET /reports    │              │
│  │                  │      │                  │              │
│  └────────┬─────────┘      └────────▲─────────┘              │
│           │                        │                          │
│           ▼                        │                          │
│  ┌──────────────────┐      ┌───────┴────────┐                │
│  │   PostgreSQL     │      │  Redis Cache   │                │
│  │   (Normalized)   │      │  (Projections) │                │
│  └──────────────────┘      └────────────────┘                │
│           │                        ▲                          │
│           │     Projection Engine  │                          │
│           └────────────────────────┘                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.2. Projection Engine

```
Event (voucher posted)
    │
    ▼
Projection Engine
    │
    ├──► account_dimension_balances (cập nhật số dư)
    │
    ├──► monthly_balances (cập nhật số dư tháng)
    │
    ├──► report_cache (invalidate cache)
    │
    └──► WebSocket broadcast (thông báo realtime)
```

---

## 7. Luồng Dữ liệu (Data Flow)

### 7.1. Luồng Xử lý Chứng từ

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  INPUT   │───►│  VALIDATE│───►│ PROCESS  │───►│  OUTPUT  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │
     ▼               ▼               ▼               ▼
  User/OCR/     Zod Schema      Accounting      Voucher +
  AI Import     Validation      Engine          Ledger
```

### 7.2. Luồng AI Processing

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  OCR     │───►│  CLASSIFY│───►│  PROPOSE │───►│  REVIEW  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │
     ▼               ▼               ▼               ▼
  Python AI     AI Dept        AI Proposal     HITL UI
  Service       Classifier     Service         (Human)
                                                    │
                                                    ▼
                                            ┌──────────┐
                                            │  POST /  │
                                            │  SELF-FIX│
                                            └──────────┘
```

### 7.3. Luồng Real-time (WebSocket)

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  Backend │         │  Redis   │         │  Client  │
│  (Socket)│         │  Pub/Sub │         │ (Browser)│
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │
     │  Voucher Created   │                    │
     │──────────────────►│                    │
     │                    │  Publish event     │
     │                    │──────────────────►│
     │                    │                    │
     │                    │  Socket.io emit    │
     │                    │──────────────────►│
     │                    │                    │
     │                    │  Update UI         │
     │                    │  (React Query)     │
     │                    │◄──────────────────│
```

---

## 8. Bảo mật (Security Architecture)

### 8.1. Security Layers

```
Layer 1: WAF (middleware/waf.js)
    - Block SQL injection, XSS, path traversal
    - Block known malicious IPs

Layer 2: Rate Limiting (middleware/rateLimiter.js)
    - 100 req/min/IP for general API
    - 20 req/15min for auth endpoints

Layer 3: CORS
    - Whitelist allowed origins only
    - Block unknown origins

Layer 4: Helmet
    - HTTP security headers
    - Content Security Policy

Layer 5: Authentication (middleware/auth.js)
    - JWT access token (15 min)
    - Refresh token (30 days)
    - Session validation

Layer 6: Authorization (RBAC)
    - Role-based access control
    - Company-level isolation

Layer 7: Input Validation (Zod)
    - Schema validation for all inputs
    - SQL injection prevention (parameterized queries)

Layer 8: Audit Trail
    - All CRUD operations logged
    - IP, user, timestamp, old/new values
```

### 8.2. Data Encryption

| Data Type | Encryption | Method |
|-----------|-----------|--------|
| Passwords | bcrypt hash | salt rounds ≥ 10 |
| JWT Tokens | HMAC-SHA256 | JWT_SECRET |
| API Keys | Environment variables | .env / Railway secrets |
| Database | SSL/TLS | rejectUnauthorized: false |
| Network | HTTPS | Railway SSL termination |

---

## 9. Deployment Architecture (Railway)

### 9.1. Railway Services

```
┌─────────────────────────────────────────────────────────────┐
│                    RAILWAY DEPLOYMENT                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┐    ┌─────────────────────┐          │
│  │  Backend Service    │    │  Frontend Service   │          │
│  │  Node.js 20         │    │  Nginx + Static     │          │
│  │  Port: 5000         │    │  Port: 3000         │          │
│  │  CMD: node server.js│    │  CMD: serve dist    │          │
│  └──────────┬──────────┘    └─────────────────────┘          │
│             │                                                 │
│  ┌──────────▼──────────┐    ┌─────────────────────┐          │
│  │  PostgreSQL Plugin  │    │  Storefront Service │          │
│  │  Railway managed    │    │  Nginx + Static     │          │
│  │  Auto-backup        │    │  Port: 3001         │          │
│  └─────────────────────┘    └─────────────────────┘          │
│                                                              │
│  ┌─────────────────────┐    ┌─────────────────────┐          │
│  │  Redis Plugin       │    │  AI Service         │          │
│  │  Railway managed    │    │  Python 3.11        │          │
│  │  Cache + Queue      │    │  Port: 8000         │          │
│  └─────────────────────┘    └─────────────────────┘          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 9.2. Environment Variables

| Variable | Service | Description |
|----------|---------|-------------|
| PORT | Backend | Server port (5000) |
| DATABASE_URL | Backend | PostgreSQL connection string |
| REDIS_URL | Backend | Redis connection string |
| JWT_SECRET | Backend | JWT signing secret |
| GEMINI_API_KEY | Backend | Gemini AI API key |
| GEMINI_KEYS | Backend | Multiple Gemini keys (comma-separated) |
| GROQ_KEYS | Backend | Multiple Groq keys |
| DEEPSEEK_KEYS | Backend | Multiple DeepSeek keys |
| CLOUDFLARE_PROXY_URL | Backend | Cloudflare worker URL |
| AI_INTERNAL_SECRET | Both | Shared secret for inter-service auth |
| FRONTEND_URL | Backend | Allowed CORS origins |
| VITE_API_BASE_URL | Frontend | Backend API URL |
| VITE_WS_URL | Frontend | WebSocket URL |

---

## 10. Monitoring & Observability

### 10.1. Health Check Endpoints

| Endpoint | Service | Checks |
|----------|---------|--------|
| `GET /api/health` | Backend | DB connection, server status |
| `GET /api/health/workers` | Backend | Queue workers, Redis |
| `GET /health` | AI Service | Service status |

### 10.2. Logging Strategy

- **Backend**: Pino structured JSON logs
- **AI Service**: Python logging module
- **Correlation ID**: Mỗi request có ID duy nhất để trace
- **Log Levels**: error, warn, info, debug

### 10.3. Metrics

- Request count, duration, error rate
- AI provider success/failure rate
- Queue job processing time
- Database query performance
- WebSocket connection count