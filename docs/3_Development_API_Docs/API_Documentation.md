# Tài liệu API (API Documentation)
## KETOAN ERP - REST API Reference

**Phiên bản:** 1.0.0  
**Ngày:** 23/07/2026  
**Base URL:** `https://dazzling-grace-production-03a5.up.railway.app/api`

---

## 1. Authentication

### 1.1. Login
```
POST /api/auth/login
```

**Request Body:**
```json
{
  "username": "admin",
  "password": "Admin@123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin",
      "is_root_admin": true
    },
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### 1.2. Refresh Token
```
POST /api/auth/refresh
```

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### 1.3. Logout
```
POST /api/auth/logout
```
**Headers:** `Authorization: Bearer <access_token>`

---

## 2. Authentication Headers

Tất cả API (trừ auth) yêu cầu:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

---

## 3. Core Accounting APIs

### 3.1. Vouchers (Chứng từ)

#### List Vouchers
```
GET /api/vouchers?company_id=1&page=1&limit=50&is_posted=true
```

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| company_id | int | ID công ty (bắt buộc) |
| page | int | Số trang (default: 1) |
| limit | int | Số lượng (default: 50, max: 200) |
| is_posted | boolean | Lọc theo trạng thái ghi sổ |
| voucher_type | string | PT, PC, NK, XK |
| date_from | date | Từ ngày (YYYY-MM-DD) |
| date_to | date | Đến ngày (YYYY-MM-DD) |
| search | string | Tìm kiếm theo số chứng từ/diễn giải |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "company_id": 1,
      "voucher_number": "PT-2026-001",
      "voucher_date": "2026-07-01",
      "voucher_type": "PT",
      "description": "Thu tiền bán hàng",
      "amount": 10000000,
      "is_posted": true,
      "ai_confidence_score": 95.5,
      "created_at": "2026-07-01T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "total_pages": 3
  }
}
```

#### Get Voucher Detail
```
GET /api/vouchers/:id
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "voucher": {
      "id": 1,
      "company_id": 1,
      "voucher_number": "PT-2026-001",
      "voucher_date": "2026-07-01",
      "voucher_type": "PT",
      "description": "Thu tiền bán hàng",
      "currency": "VND",
      "exchange_rate": 1.0000,
      "is_posted": true,
      "posted_at": "2026-07-01T08:30:00Z",
      "created_by": 1
    },
    "details": [
      {
        "id": 1,
        "account_code": "111",
        "entry_type": "DR",
        "amount": 10000000,
        "partner_id": null,
        "item_id": null
      },
      {
        "id": 2,
        "account_code": "511",
        "entry_type": "CR",
        "amount": 10000000,
        "partner_id": null,
        "item_id": null
      }
    ]
  }
}
```

#### Create Voucher
```
POST /api/vouchers
```

**Request Body:**
```json
{
  "company_id": 1,
  "voucher_number": "PT-2026-002",
  "voucher_date": "2026-07-23",
  "voucher_type": "PT",
  "description": "Thu tiền khách hàng A",
  "currency": "VND",
  "details": [
    {
      "account_code": "111",
      "entry_type": "DR",
      "amount": 5000000
    },
    {
      "account_code": "131",
      "entry_type": "CR",
      "amount": 5000000,
      "partner_id": 1
    }
  ]
}
```

**Validation Rules:**
- Tổng Nợ = Tổng Có (bắt buộc)
- Tài khoản phải tồn tại trong COA
- Số chứng từ không trùng trong cùng công ty
- Ngày chứng từ không được trong quá khứ xa (> 1 năm)

#### Update Voucher
```
PUT /api/vouchers/:id
```
Chỉ cho phép sửa khi `is_posted = false`.

#### Delete Voucher
```
DELETE /api/vouchers/:id
```
Chỉ cho phép xóa khi `is_posted = false`.

#### Post Voucher (Ghi sổ)
```
POST /api/vouchers/:id/post
```

### 3.2. Opening Balances (Số dư đầu kỳ)

```
GET    /api/opening-balances?company_id=1&fiscal_year=2026
POST   /api/opening-balances
PUT    /api/opening-balances/:id
DELETE /api/opening-balances/:id
```

### 3.3. Monthly Balances (Số dư tháng)

```
GET /api/accounting/balances?company_id=1&year=2026&month=7
```

### 3.4. Closing (Kết chuyển cuối kỳ)

```
POST /api/accounting/closing/run
```

**Request Body:**
```json
{
  "company_id": 1,
  "year": 2026,
  "month": 7
}
```

---

## 4. Partners & Items APIs

### 4.1. Partners (Đối tác)

```
GET    /api/partners?company_id=1&type=customer
POST   /api/partners
GET    /api/partners/:id
PUT    /api/partners/:id
DELETE /api/partners/:id
```

### 4.2. Items (Hàng hóa)

```
GET    /api/items?company_id=1&search=keyword
POST   /api/items
GET    /api/items/:id
PUT    /api/items/:id
DELETE /api/items/:id
```

---

## 5. Inventory APIs

### 5.1. Inventory Vouchers (Phiếu kho)

```
GET    /api/inventory/vouchers?company_id=1&io_type=IMPORT
POST   /api/inventory/vouchers
GET    /api/inventory/vouchers/:id
```

### 5.2. Stock Reconciliation (Kiểm kê)

```
GET    /api/inventory/reconciliations
POST   /api/inventory/reconciliations
```

### 5.3. Costing Layers (Giá vốn)

```
GET /api/costing/layers?company_id=1&product_id=1
```

---

## 6. AI APIs

### 6.1. AI Copilot (Text-to-SQL)

```
POST /api/ai/query
```

**Request Body:**
```json
{
  "question": "Tổng doanh thu tháng 7 năm 2026 là bao nhiêu?",
  "company_id": 1
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "sql": "SELECT SUM(amount) FROM voucher_details vd JOIN vouchers v ON v.id = vd.voucher_id WHERE v.company_id = 1 AND v.voucher_type = 'PT' AND v.voucher_date BETWEEN '2026-07-01' AND '2026-07-31' AND vd.account_code = '511'",
    "result": [
      { "sum": 150000000 }
    ],
    "answer": "Tổng doanh thu tháng 7 năm 2026 là 150,000,000 VND.",
    "confidence": 95.5,
    "model": "gemini-2.5-flash"
  }
}
```

### 6.2. AI Proposal (Gợi ý hạch toán)

```
POST /api/ai/proposal
```

**Request Body:**
```json
{
  "description": "Thu tiền bán hàng từ khách hàng A, số tiền 10,000,000 VND",
  "company_id": 1
}
```

### 6.3. AI OCR (Xử lý hóa đơn)

```
POST /api/ai/ocr
```

**Request Body:**
```json
{
  "file_url": "https://example.com/invoice.jpg",
  "company_id": 1
}
```

### 6.4. AI Self-Fix

```
POST /api/hitl/self-fix
```

### 6.5. AI Predictions

```
POST /api/ai/predict/closing
POST /api/ai/predict/cashflow
POST /api/ai/predict/salary
```

---

## 7. Report APIs

### 7.1. Balance Sheet (Bảng cân đối kế toán)

```
GET /api/reports/balance-sheet?company_id=1&year=2026&month=7
```

### 7.2. Income Statement (Báo cáo KQKD)

```
GET /api/reports/income-statement?company_id=1&year=2026&month=7
```

### 7.3. Trial Balance (Bảng cân đối tài khoản)

```
GET /api/reports/trial-balance?company_id=1&year=2026&month=7
```

### 7.4. Cash Flow (Báo cáo lưu chuyển tiền tệ)

```
GET /api/cashflow/report?company_id=1&year=2026&month=7
```

### 7.5. Export Excel

```
GET /api/export/excel?type=balance_sheet&company_id=1&year=2026&month=7
```

---

## 8. Storefront APIs

### 8.1. Orders (Đơn hàng)

```
GET    /api/orders?company_id=1&status=pending
POST   /api/orders
GET    /api/orders/:id
PUT    /api/orders/:id
```

### 8.2. Casso Banking

```
POST /api/casso/webhook
GET  /api/casso/transactions?company_id=1
```

---

## 9. Admin APIs

### 9.1. Users

```
GET    /api/users
POST   /api/users
GET    /api/users/:id
PUT    /api/users/:id
DELETE /api/users/:id
```

### 9.2. Companies

```
GET    /api/companies
POST   /api/companies
GET    /api/companies/:id
PUT    /api/companies/:id
```

### 9.3. Audit Logs

```
GET /api/audit-logs?company_id=1&page=1&limit=50
```

### 9.4. System Config

```
GET  /api/settings
PUT  /api/settings
```

---

## 10. WebSocket Events

### 10.1. Connection
```
ws://host:port/socket.io/?token=<jwt_token>
```

### 10.2. Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `voucher:created` | Server → Client | Chứng từ mới được tạo |
| `voucher:updated` | Server → Client | Chứng từ được cập nhật |
| `voucher:posted` | Server → Client | Chứng từ được ghi sổ |
| `notification:new` | Server → Client | Thông báo mới |
| `ai:proposal` | Server → Client | AI đề xuất mới |
| `order:new` | Server → Client | Đơn hàng mới từ storefront |

---

## 11. Error Codes

| HTTP Code | Error Code | Description |
|-----------|-----------|-------------|
| 400 | VALIDATION_ERROR | Dữ liệu không hợp lệ |
| 401 | AUTHENTICATION_ERROR | Token hết hạn hoặc không hợp lệ |
| 403 | AUTHORIZATION_ERROR | Không có quyền truy cập |
| 404 | NOT_FOUND | Resource không tồn tại |
| 409 | CONFLICT | Dữ liệu trùng lặp |
| 422 | BUSINESS_RULE_VIOLATION | Vi phạm nghiệp vụ |
| 429 | RATE_LIMIT_ERROR | Vượt quá giới hạn request |
| 500 | INTERNAL_ERROR | Lỗi server |
| 503 | SERVICE_UNAVAILABLE | Service tạm thời không khả dụng |

---

## 12. Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/*` | 20 requests | 15 phút |
| `/api/*` | 100 requests | 1 phút |
| `/api/ai/*` | 30 requests | 1 phút |
| Upload | 10 requests | 1 phút |

**Response Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1627000000