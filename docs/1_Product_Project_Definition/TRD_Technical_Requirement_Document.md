# Tài liệu Yêu cầu Kỹ thuật (TRD)
## KETOAN ERP - Hệ thống Kế toán Doanh nghiệp

**Phiên bản:** 1.0.0  
**Ngày:** 23/07/2026  

---

## 1. Tổng quan Kiến trúc Kỹ thuật

### 1.1. Kiến trúc Tổng thể
Hệ thống KETOAN ERP được xây dựng theo kiến trúc **Microservices lai** với 4 thành phần chính:

```
┌─────────────────────────────────────────────────────────┐
│                    KETOAN ERP SYSTEM                      │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Frontend   │  │  Storefront  │  │   Mobile     │   │
│  │ (React+Vite) │  │ (React+Vite) │  │ (Future)     │   │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘   │
│         │                │                │            │
│  ┌──────┴────────────────┴────────────────┴───────┐   │
│  │              REST API + WebSocket                 │   │
│  │              (Express.js + Socket.io)              │   │
│  ├──────────────────────────────────────────────────┤   │
│  │              Backend (Node.js)                     │   │
│  │  Auth │ Vouchers │ Partners │ Inventory │ Reports  │   │
│  │  AI Services │ Workflow │ REA │ CQRS │ Posting   │   │
│  ├──────────────────────────────────────────────────┤   │
│  │        PostgreSQL  +  Redis  +  BullMQ            │   │
│  ├──────────────────────────────────────────────────┤   │
│  │      Python AI Service (FastAPI)                   │   │
│  │  OCR │ NLP │ TimeSeries │ SelfFix │ RAG            │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 1.2. Stack Công nghệ Chi tiết

#### Backend (Node.js 20+)
| Thư viện | Phiên bản | Mục đích |
|----------|-----------|----------|
| Express | ^4.19.2 | Web framework |
| pg | ^8.11.5 | PostgreSQL driver |
| ioredis | ^5.11.1 | Redis client |
| jsonwebtoken | ^9.0.2 | JWT auth |
| bcryptjs | ^2.4.3 | Password hashing |
| zod | ^4.4.3 | Schema validation |
| socket.io | ^4.8.3 | Real-time comms |
| bullmq | ^4.18.3 | Job queue |
| pino | ^9.0.0 | Logging |
| helmet | ^8.3.0 | Security headers |
| cors | ^2.8.5 | CORS |
| express-rate-limit | ^8.5.2 | Rate limiting |
| exceljs | ^4.4.0 | Excel export |
| multer | ^2.2.0 | File upload |
| web-push | ^3.6.7 | Push notifications |
| @google/generative-ai | ^0.24.1 | Gemini AI SDK |
| axios | ^1.18.1 | HTTP client |
| p-limit | ^7.3.0 | Concurrency control |

#### Frontend (React 18 + Vite 5)
| Thư viện | Phiên bản | Mục đích |
|----------|-----------|----------|
| react | ^18.2.0 | UI framework |
| react-router-dom | ^7.18.1 | Routing |
| @tanstack/react-query | ^5.101.2 | Data fetching |
| react-hook-form | ^7.81.0 | Form management |
| zod | ^4.4.3 | Validation |
| lucide-react | ^0.368.0 | Icons |
| react-toastify | ^11.0.0 | Toast notifications |
| socket.io-client | ^4.8.3 | WebSocket |
| xlsx | ^0.18.5 | Excel handling |
| tailwindcss | ^3.4.3 | CSS framework |
| axios | ^1.6.8 | HTTP client |

#### Python AI Service (Python 3.11+)
| Thư viện | Mục đích |
|----------|----------|
| fastapi | ^0.110.0 | Web framework |
| uvicorn | ^0.29.0 | ASGI server |
| pydantic | ^2.6.1 | Validation |
| numpy | ^1.26.4 | Numerical computing |
| httpx | ^0.26.0 | Async HTTP |
| python-dotenv | ^1.0.0 | Env management |

---

## 2. Yêu cầu Hệ thống

### 2.1. Môi trường Phát triển

| Thành phần | Yêu cầu |
|-----------|---------|
| OS | Windows 10+, macOS 12+, Linux (Ubuntu 20.04+) |
| Node.js | >= 18.0.0 (khuyến nghị 20.x LTS) |
| npm | >= 9.0.0 |
| Python | >= 3.11 (cho AI Service) |
| PostgreSQL | >= 14 (khuyến nghị 16) |
| Redis | >= 6.x |
| Git | >= 2.30 |

### 2.2. Môi trường Production (Railway)

| Thành phần | Yêu cầu |
|-----------|---------|
| RAM | >= 512 MB per service |
| CPU | >= 1 vCPU |
| Storage | >= 1 GB (PostgreSQL: 10 GB+ khuyến nghị) |
| Node.js | 20.x LTS (xử lý qua nvm) |
| Python | 3.11+ (cho AI service) |

### 2.3. Yêu cầu Mạng

| Service | Port | Protocol |
|---------|------|----------|
| Backend API | 5000 | HTTP/HTTPS |
| Frontend ERP | 3000 | HTTP/HTTPS |
| Storefront | 3001 | HTTP/HTTPS |
| AI Service | 8000 | HTTP/HTTPS |
| PostgreSQL | 5432 | TCP |
| Redis | 6379 | TCP |

---

## 3. Tiêu chuẩn Kỹ thuật

### 3.1. API Design Standards
- **RESTful API** với các phương thức: GET, POST, PUT, PATCH, DELETE
- **JSON** là format dữ liệu chính
- **URL naming**: `/api/{resource}[/{id}][/{action}]`
- **HTTP Status Codes**: 200/201/204 cho success, 400/401/403/404/500 cho errors
- **Versioning**: URL prefix `/api/` (không version number riêng)
- **Authentication**: JWT Bearer token trong header `Authorization`

### 3.2. Database Standards
- **Naming convention**: snake_case cho tất cả tên (tables, columns, indexes)
- **Primary keys**: SERIAL hoặc BIGSERIAL
- **Timestamps**: `created_at`, `updated_at` cho mọi bảng
- **Soft delete**: Sử dụng `is_active` hoặc `deleted_at`
- **Indexes**: Luôn có index cho foreign keys và columns thường query
- **Constraints**: FOREIGN KEY, CHECK, UNIQUE đầy đủ

### 3.3. Code Standards
- **JavaScript**: ES Module (`import/export`), async/await
- **Naming**: camelCase cho variables/functions, PascalCase cho classes
- **Error handling**: Custom AppError class với error codes
- **Logging**: Pino structured logging với correlation ID
- **Validation**: Zod schemas cho mọi input

### 3.4. Security Standards
- **JWT**: Access token 15 phút, Refresh token 30 ngày
- **Password**: bcrypt với salt rounds >= 10
- **CORS**: Chỉ cho phép origins đã config
- **Rate Limiting**: 100 requests/phút/IP cho API (giới hạn thấp hơn cho auth)
- **Helmet**: Đầy đủ HTTP security headers
- **Input validation**: Tất cả input được validate bằng Zod
- **SQL Injection**: Sử dụng parameterized queries (pg driver)

---

## 4. Hiệu suất & Scale

### 4.1. Performance Targets
| Metric | Target | Measurement |
|--------|--------|-------------|
| API Response Time | < 200ms p95 | Jest performance tests |
| Concurrent Users | 500+ | Load testing |
| Transaction Throughput | 1000 tx/min | JMeter/Artillery |
| Database Queries | < 50ms p95 | PG stats |
| AI API Response | < 5s (timeout 30s) | AI provider SLA |
| Report Generation | < 5s (12 tháng) | Report tests |

### 4.2. Scaling Strategy
- **Backend**: Horizontal scaling với nhiều instances
- **Database**: Connection pooling (max 50), read replicas cho reports
- **Cache**: Redis caching cho:
  - Số dư tài khoản (balance_cache)
  - Báo cáo (report_cache)
  - Schema metadata
  - Session tokens
- **AI**: Multi-provider với load balancing + fallback
- **Queue**: BullMQ cho background jobs

---

## 5. Monitoring & Logging

### 5.1. Logging Strategy
| Component | Logger | Format |
|-----------|--------|--------|
| Backend API | Pino | JSON structured |
| AI Service | Python logging | JSON structured |
| Frontend | Console + Error tracking | String |

### 5.2. Health Checks
- `GET /api/health`: Database + server status
- `GET /api/health/workers`: Worker status (queue, cron)
- `GET /health`: AI service health

### 5.3. Metrics
- Request count & duration
- Error rate by endpoint
- AI provider success/fail rate
- Queue job processing time
- Database query performance

---

## 6. CI/CD Pipeline

### 6.1. Development Flow
```
Feature Branch → PR → Code Review → Merge to main → Auto-deploy (Railway)
```

### 6.2. Testing Stages
1. **Unit tests**: Jest (backend), Vitest (frontend)
2. **Integration tests**: Supertest + Jest
3. **Property-based tests**: fast-check
4. **Mutation tests**: Stryker
5. **Performance tests**: Jest performance
6. **Statistical tests**: Jest statistical

### 6.3. Quality Gates
- Code coverage >= 80%
- Mutation score >= 70%
- Zero critical vulnerabilities
- All tests pass
- Lint passes (ESLint)

---

## 7. Dependencies Management

### 7.1. Backend Dependencies (package.json)
- Tổng số dependencies: 16
- Tổng số devDependencies: 7
- Engine lock: Node >= 18

### 7.2. Frontend Dependencies
- Tổng số dependencies: 11
- Tổng số devDependencies: 8
- Engine lock: Node >= 20.19.0

### 7.3. Storefront Dependencies
- Tổng số dependencies: 5
- Tổng số devDependencies: 8
- Engine lock: Node >= 20.19.0

### 7.4. AI Service Dependencies
- Tổng số: 7 (core) + optional ML libraries
- Python version: 3.11+

---

## 8. Database Requirements

### 8.1. PostgreSQL Configuration
- **Version**: >= 14
- **Extensions**: None required (sử dụng tính năng có sẵn)
- **Character set**: UTF-8
- **Connection pool**: max 50 connections
- **SSL**: Required for production (Railway)

### 8.2. Redis Configuration
- **Version**: >= 6.x
- **Use cases**: Session cache, job queue (BullMQ), real-time pub/sub
- **Persistence**: RDB snapshots (mặc định)

---

## 9. API Rate Limiting

| Endpoint Pattern | Limit | Window |
|-----------------|-------|--------|
| `/api/auth/*` | 20 requests | 15 phút |
| `/api/*` (general) | 100 requests | 1 phút |
| `/api/ai/*` | 30 requests | 1 phút |
| Upload endpoints | 10 requests | 1 phút |

---

## 10. Error Handling Standards

### 10.1. Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Mô tả lỗi bằng tiếng Việt",
    "details": [
      { "field": "voucher_date", "message": "Ngày chứng từ không hợp lệ" }
    ]
  }
}
```

### 10.2. Error Codes (AppError)
- `VALIDATION_ERROR`: Lỗi validate dữ liệu
- `AUTHENTICATION_ERROR`: Lỗi xác thực
- `AUTHORIZATION_ERROR`: Không có quyền
- `NOT_FOUND`: Không tìm thấy resource
- `BUSINESS_RULE_VIOLATION`: Vi phạm nghiệp vụ
- `DATABASE_ERROR`: Lỗi database
- `AI_SERVICE_ERROR`: Lỗi AI service
- `RATE_LIMIT_ERROR`: Vượt quá giới hạn

---

## 11. Yêu cầu Bảo mật Bổ sung

### 11.1. WAF (Web Application Firewall)
- **Module**: `middleware/waf.js`
- **Bảo vệ**: SQL injection, XSS, path traversal
- **Block malicious patterns** ở tầng middleware

### 11.2. Audit Trail
- **Module**: `services/auditLog.service.js`
- **Ghi lại**: Mọi hành động CREATE, UPDATE, DELETE
- **Lưu**: old values, new values, IP, user, timestamp

### 11.3. Idempotency
- **Module**: `services/distributedLock.service.js`
- **Key**: company_id + event_type + idempotency_key
- **Tránh duplicate processing** cho webhook và sự kiện

---

## 12. Kiến trúc AI

### 12.1. Multi-Provider AI Pool
```
Backend (Node.js)
  ├── Gemini AI (primary - 6 keys, round-robin)
  ├── Groq (fallback - 4 keys)
  └── DeepSeek (fallback - 3 keys)
      └── Cloudflare Proxy (IP masking)
```

### 12.2. AI Service Modules (Python)
- **OCR**: Xử lý hóa đơn (PaddleOCR integration)
- **NLP**: Text-to-SQL, phân loại, trích xuất
- **TimeSeries**: Dự báo dòng tiền, số dư
- **SelfFix**: RLHF learning từ feedback

### 12.3. AI Confidence Thresholds
- **Auto-post**: AI confidence >= 95% và amount <= 5,000,000 VND
- **Human review**: AI confidence >= 80% và amount <= 50,000,000 VND
- **Full manual**: AI confidence < 80% hoặc amount > 50,000,000 VND