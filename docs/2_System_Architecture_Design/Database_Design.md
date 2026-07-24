# Tài liệu Thiết kế Cơ sở Dữ liệu (Database Design)
## KETOAN ERP - Database Schema Documentation

**Phiên bản:** 1.0.0  
**Ngày:** 23/07/2026  

---

## 1. Tổng quan

### 1.1. Hệ quản trị CSDL
- **PostgreSQL** >= 14 (khuyến nghị 16)
- **Encoding**: UTF-8
- **Connection Pool**: max 50 connections
- **SSL**: Required cho production (Railway managed)

### 1.2. Nguyên tắc Thiết kế
1. **Normalization**: Tuân thủ 3NF (Third Normal Form) cho core tables
2. **Denormalization**: Có chọn lọc cho performance (JSONB columns)
3. **Naming convention**: `snake_case` cho tất cả identifiers
4. **Indexes**: B-tree cho equality/lookup, GIN cho array/JSONB
5. **Constraints**: FOREIGN KEY, CHECK, UNIQUE đầy đủ
6. **Timestamps**: Mọi bảng có `created_at`, `updated_at` (nếu cần)
7. **Soft delete**: Sử dụng `is_active` boolean flag

---

## 2. Entity Relationship Diagram (ERD)

### 2.1. Core Accounting Entities

```
┌─────────────────────────────────────────────────────────────────┐
│                        COMPANIES                                 │
├─────────────────────────────────────────────────────────────────┤
│ id (PK)           SERIAL                                         │
│ name              VARCHAR(255)     NOT NULL                      │
│ tax_code          VARCHAR(50)      UNIQUE NOT NULL              │
│ address           TEXT                                            │
│ entity_type       VARCHAR(50)      DEFAULT 'company'             │
│ lock_date         DATE             DEFAULT NULL                  │
│ is_active         BOOLEAN          DEFAULT TRUE                  │
│ created_at        TIMESTAMP        DEFAULT NOW()                 │
└──────────┬──────────────────────────────────────────────────────┘
           │ 1
           │
     ┌─────┴──────┐
     │            │
     │ 1          │ N
     ▼            ▼
┌──────────┐  ┌───────────┐
│  USERS   │  │ PARTNERS  │
├──────────┤  ├───────────┤
│ id (PK)  │  │ id (PK)   │
│ username │  │ company_id│
│ password │  │ partner_  │
│ role     │  │  code     │
│ company_ │  │ partner_  │
│  ids[]   │  │  name     │
│ manager_ │  │ type      │
│  id      │  │ phone     │
│ ...      │  │ email     │
└──────────┘  │ address   │
              │ credit_   │
              │  limit    │
              │ is_active │
              └───────────┘
```

### 2.2. Voucher & Accounting Entities

```
COMPANIES 1────N VOUCHERS 1────N VOUCHER_DETAILS
  │                  │                  │
  │                  │                  │ N────1 PARTNERS (optional)
  │                  │                  │ N────1 ITEMS (optional)
  │                  │
  │                  │ N────1 USERS (created_by)
  │                  │ N────1 USERS (posted_by)
  │
  ├────N OPENING_BALANCES
  │        │
  │        └────N PARTNERS (optional, for AR/AP)
  │
  └────N MONTHLY_BALANCES
           │
           ├────N ACCOUNTS
           └────N PARTNERS (optional)
```

### 2.3. Inventory Entities

```
COMPANIES 1────N ITEMS 1────N INVENTORY_VOUCHER_DETAILS
  │                  │                  │
  │                  │                  │ N───┴───1 INVENTORY_VOUCHERS
  │                  │                              │
  │                  │                              ├──1 COMPANIES
  │                  │                              ├──N PARTNERS (optional)
  │                  │                              └──N USERS (created_by)
  │                  │
  │                  ├────N INVENTORY_COSTING_LAYERS
  │                  │
  │                  └────N STOCK_RECONCILIATION_DETAILS
  │                              │
  │                              └───┴──1 STOCK_RECONCILIATIONS
```

### 2.4. AI & Event-Driven Entities

```
COMPANIES 1────N REA_EVENTS
  │                  │
  │                  ├────N VOUCHERS (result)
  │                  └────N USERS (created_by)
  │
  ├────N AI_HITL_LOGS
  │         │
  │         ├────N VOUCHERS
  │         └────N USERS
  │
  ├────N EVENT_STORE
  │
  ├────N ANOMALY_REPORTS
  │
  └────N AI_MONITORING_METRICS
```

### 2.5. Workflow Entities

```
COMPANIES 1────N WORKFLOWS 1────N WORKFLOW_INSTANCES
                        │                  │
                        │                  └────N WORKFLOW_STEP_EXECUTIONS
                        │
                        └────N WORKFLOW_TEMPLATES (system defaults)
```

---

## 3. Bảng Chi tiết (Data Dictionary)

### 3.1. companies
Lưu thông tin doanh nghiệp/tenant.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | SERIAL | PRIMARY KEY | ID tự động |
| name | VARCHAR(255) | NOT NULL | Tên công ty |
| tax_code | VARCHAR(50) | UNIQUE, NOT NULL | Mã số thuế |
| address | TEXT | | Địa chỉ |
| entity_type | VARCHAR(50) | DEFAULT 'company' | Loại hình: company, branch |
| lock_date | DATE | DEFAULT NULL | Ngày khóa sổ kế toán |
| is_active | BOOLEAN | DEFAULT TRUE | Trạng thái hoạt động |
| created_at | TIMESTAMP | DEFAULT NOW() | Ngày tạo |

### 3.2. users
Lưu thông tin người dùng và phân quyền.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | SERIAL | PRIMARY KEY | ID tự động |
| username | VARCHAR(100) | UNIQUE, NOT NULL | Tên đăng nhập |
| password | TEXT | NOT NULL | Bcrypt hash |
| role | VARCHAR(20) | CHECK IN ('admin','ktt','nv','nv_banhang','nv_kho','gd_kinhdoanh') | Vai trò |
| company_ids | INT[] | DEFAULT '{}' | Danh sách công ty truy cập |
| staff_ids | INT[] | DEFAULT '{}' | Nhân viên phụ trách (cho KTT) |
| manager_id | INT | REFERENCES users(id) | Kế toán trưởng quản lý |
| must_change_password | BOOLEAN | DEFAULT FALSE | Bắt buộc đổi mật khẩu |
| is_root_admin | BOOLEAN | DEFAULT FALSE | Root admin |
| preferences | JSONB | DEFAULT '{}' | Tùy chỉnh giao diện |
| notification_preferences | JSONB | DEFAULT '{}' | Tùy chỉnh thông báo |
| department | VARCHAR(50) | DEFAULT 'finance' | Phòng ban |
| clearance_level | INT | DEFAULT 1 | Cấp độ phân quyền |
| created_at | TIMESTAMP | DEFAULT NOW() | Ngày tạo |

**Indexes**: GIN on `company_ids`, GIN on `staff_ids`

### 3.3. vouchers
Bảng chứng từ kế toán (trung tâm của hệ thống).

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | SERIAL | PRIMARY KEY | ID tự động |
| company_id | INT | FK → companies(id), NOT NULL | Công ty |
| voucher_number | VARCHAR(100) | NOT NULL | Số chứng từ |
| voucher_date | DATE | NOT NULL | Ngày chứng từ |
| voucher_type | VARCHAR(10) | NOT NULL | Loại: PT, PC, NK, XK, DauKy |
| description | TEXT | | Diễn giải |
| currency | VARCHAR(10) | DEFAULT 'VND' | Loại tiền |
| exchange_rate | NUMERIC(15,4) | DEFAULT 1.0000 | Tỷ giá |
| created_by | INT | FK → users(id) | Người tạo |
| is_posted | BOOLEAN | DEFAULT FALSE | Đã ghi sổ |
| posted_at | TIMESTAMP | | Ngày ghi sổ |
| posted_by | INT | FK → users(id) | Người ghi sổ |
| loading_status | VARCHAR(20) | DEFAULT 'pending_loading' | Trạng thái xếp hàng |
| truck_id | INT | FK → trucks(id) | Xe giao hàng |
| discount_amount | NUMERIC(15,2) | DEFAULT 0 | Chiết khấu |
| coupon_code | VARCHAR(50) | | Mã giảm giá |
| tax_rate | NUMERIC(5,2) | DEFAULT 0 | Thuế suất |
| tax_amount | NUMERIC(15,2) | DEFAULT 0 | Tiền thuế |
| shipping_fee | NUMERIC(15,2) | DEFAULT 0 | Phí vận chuyển |
| payment_method | VARCHAR(50) | | Phương thức thanh toán |
| payment_status | VARCHAR(20) | DEFAULT 'pending' | Trạng thái thanh toán |
| sales_channel | VARCHAR(50) | DEFAULT 'storefront' | Kênh bán hàng |
| is_reversing | BOOLEAN | DEFAULT FALSE | Là bút toán đảo |
| reversed_from | INT | FK → vouchers(id) | Bút toán gốc bị đảo |
| due_date | DATE | | Ngày đến hạn |
| hitl_status | VARCHAR(20) | | Trạng thái HITL |
| ai_confidence_score | DECIMAL(5,2) | | Điểm tin cậy AI |
| sign_status | VARCHAR(20) | DEFAULT 'unsigned' | Trạng thái ký số |
| amount | NUMERIC(15,2) | DEFAULT 0 | Tổng tiền |
| created_at | TIMESTAMP | DEFAULT NOW() | Ngày tạo |

**Indexes**: 
- `(company_id, voucher_date)` - query theo ngày
- `(company_id, is_posted, voucher_date DESC)` - lọc đã ghi sổ
- `(company_id, voucher_date DESC)` WHERE is_posted = TRUE - chỉ ghi sổ

### 3.4. voucher_details
Chi tiết chứng từ (bút toán Nợ/Có).

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | SERIAL | PRIMARY KEY | ID tự động |
| voucher_id | INT | FK → vouchers(id), NOT NULL, CASCADE | Chứng từ cha |
| account_code | VARCHAR(20) | NOT NULL | Tài khoản kế toán |
| entry_type | VARCHAR(2) | CHECK IN ('DR','CR'), NOT NULL | Nợ/Có |
| amount | NUMERIC(15,2) | CHECK >= 0, NOT NULL | Số tiền (VND) |
| quantity | NUMERIC(15,4) | DEFAULT 0 | Số lượng (cho kho) |
| partner_id | INT | FK → partners(id) | Đối tác (công nợ) |
| item_id | INT | FK → items(id) | Hàng hóa (kho) |
| amount_origin | NUMERIC(15,2) | | Số tiền gốc (ngoại tệ) |
| currency_origin | VARCHAR(10) | DEFAULT 'VND' | Loại tiền gốc |
| is_tax_deductible | BOOLEAN | DEFAULT TRUE | Được khấu trừ thuế |
| dimensions | JSONB | DEFAULT '{}' | Chiều kế toán mở rộng |

**Indexes**: 
- `(voucher_id, account_code, entry_type)` - lookup
- `(account_code, entry_type)` - query theo tài khoản
- `(partner_id, account_code)` WHERE partner_id IS NOT NULL - công nợ

### 3.5. opening_balances
Số dư đầu kỳ.

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | SERIAL | PRIMARY KEY | ID tự động |
| company_id | INT | FK → companies(id), NOT NULL | Công ty |
| fiscal_year | INT | NOT NULL | Năm tài chính |
| account_code | VARCHAR(20) | NOT NULL | Tài khoản |
| opening_debit | NUMERIC(15,2) | DEFAULT 0 | Số dư Nợ đầu kỳ |
| opening_credit | NUMERIC(15,2) | DEFAULT 0 | Số dư Có đầu kỳ |
| partner_id | INT | FK → partners(id) | Đối tác (131, 331) |
| is_locked | BOOLEAN | DEFAULT FALSE | Đã khóa |
| created_at | TIMESTAMP | DEFAULT NOW() | Ngày tạo |

**Unique Index**: `(company_id, account_code, fiscal_year, COALESCE(partner_id, 0))`

### 3.6. monthly_balances
Số dư tổng hợp tháng (CQRS projection).

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | SERIAL | PRIMARY KEY | ID tự động |
| company_id | INT | FK → companies(id), NOT NULL | Công ty |
| account_code | VARCHAR(20) | NOT NULL | Tài khoản |
| partner_id | INT | FK → partners(id) | Đối tác |
| month | INT | CHECK 1-12 | Tháng |
| year | INT | NOT NULL | Năm |
| closing_debit | NUMERIC(18,2) | DEFAULT 0 | Phát sinh Nợ |
| closing_credit | NUMERIC(18,2) | DEFAULT 0 | Phát sinh Có |
| net_balance | NUMERIC(18,2) | DEFAULT 0 | Số dư cuối |
| balance_type | VARCHAR(10) | CHECK IN ('DEBIT','CREDIT') | Loại số dư |

**Unique Index**: `(company_id, account_code, COALESCE(partner_id, 0), month, year)`

### 3.7. partners (Đối tác - Khách hàng/Nhà cung cấp)

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | SERIAL | PRIMARY KEY | ID |
| company_id | INT | FK, NOT NULL | Công ty |
| partner_code | VARCHAR(50) | NOT NULL | Mã đối tác |
| partner_name | VARCHAR(255) | NOT NULL | Tên |
| type | VARCHAR(20) | CHECK ('customer','supplier','both') | Loại |
| phone | VARCHAR(50) | | Điện thoại |
| email | VARCHAR(255) | | Email |
| address | TEXT | | Địa chỉ |
| credit_limit | NUMERIC(15,2) | DEFAULT 0 | Hạn mức tín dụng |
| is_active | BOOLEAN | DEFAULT TRUE | Còn hoạt động |

**Unique**: `(company_id, partner_code)`

### 3.8. items (Hàng hóa / Vật tư)

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | SERIAL | PRIMARY KEY | ID |
| company_id | INT | FK, NOT NULL | Công ty |
| code | VARCHAR(50) | NOT NULL | Mã hàng |
| name | VARCHAR(255) | NOT NULL | Tên hàng |
| description | TEXT | | Mô tả |
| unit | VARCHAR(50) | DEFAULT 'Cái' | Đơn vị tính |
| price_sell | NUMERIC(15,2) | DEFAULT 0 | Giá bán |
| opening_quantity | NUMERIC(15,4) | DEFAULT 0 | Tồn đầu kỳ |
| image_url | TEXT | | Ảnh |
| image_urls | JSONB | DEFAULT '[]' | Nhiều ảnh |

**Unique**: `(company_id, code)`

### 3.9. rea_events (Sự kiện REA)

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | SERIAL | PRIMARY KEY | ID |
| company_id | INT | FK, NOT NULL | Công ty |
| event_type | VARCHAR(50) | NOT NULL | Loại sự kiện |
| event_data | JSONB | NOT NULL | Dữ liệu |
| resources | JSONB | DEFAULT '[]' | Tài nguyên |
| agents | JSONB | DEFAULT '[]' | Tác nhân |
| accounting_entries | JSONB | DEFAULT '[]' | Bút toán sinh ra |
| voucher_id | INT | FK → vouchers(id) | Chứng từ kết quả |
| status | VARCHAR(20) | DEFAULT 'completed' | Trạng thái |
| created_by | INT | FK → users(id) | Người tạo |

### 3.10. ai_hitl_logs (AI Human-in-the-Loop)

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | ID |
| tenant_id | VARCHAR(50) | NOT NULL | Tenant |
| voucher_id | BIGINT | FK → vouchers(id) | Chứng từ |
| ai_confidence_score | DECIMAL(5,2) | CHECK 0-100 | Điểm tin cậy |
| original_ai_proposal | JSONB | NOT NULL | Đề xuất gốc AI |
| final_human_approved | JSONB | NOT NULL | Phê duyệt cuối |
| is_modified | BOOLEAN | DEFAULT FALSE | Người dùng sửa |
| modified_fields | TEXT[] | | Các trường bị sửa |
| user_id | BIGINT | FK → users(id) | Người phê duyệt |
| ai_model_version | VARCHAR(50) | DEFAULT 'v1.0' | Phiên bản AI |
| processing_status | VARCHAR(20) | DEFAULT 'pending' | Trạng thái |
| self_fix_attempts | INTEGER | DEFAULT 0 | Số lần tự sửa |
| ai_fix_history | JSONB | DEFAULT '[]' | Lịch sử sửa |
| is_self_fixed | BOOLEAN | DEFAULT FALSE | Tự sửa thành công |

### 3.11. event_store (Event Store cho CQRS/Audit)

| Column | Type | Constraints | Description |
|--------|------|------------|-------------|
| id | BIGSERIAL | PRIMARY KEY | ID |
| event_type | VARCHAR(100) | NOT NULL | Loại sự kiện |
| category | VARCHAR(50) | NOT NULL | Danh mục |
| company_id | INT | FK, NOT NULL | Công ty |
| event_data | JSONB | NOT NULL | Dữ liệu |
| metadata | JSONB | DEFAULT '{}' | Metadata |
| severity | VARCHAR(20) | CHECK ('info','warning','error','critical') | Mức độ |
| correlation_id | VARCHAR(100) | | ID xuyên suốt |
| created_by | INT | FK → users(id) | Người tạo |

---

## 4. Indexes Chiến lược

### 4.1. Core Indexes
```sql
-- Vouchers
CREATE INDEX idx_vouchers_date_company ON vouchers(company_id, voucher_date);
CREATE INDEX idx_vouchers_posted_status ON vouchers(company_id, is_posted, voucher_date DESC);
CREATE INDEX idx_vouchers_posted_only ON vouchers(company_id, voucher_date DESC) WHERE is_posted = TRUE;

-- Voucher Details
CREATE INDEX idx_voucher_details_lookup ON voucher_details(voucher_id, account_code, entry_type);
CREATE INDEX idx_details_account_entry ON voucher_details(account_code, entry_type);
CREATE INDEX idx_details_partner_account ON voucher_details(partner_id, account_code) WHERE partner_id IS NOT NULL;

-- Monthly Balances
CREATE INDEX idx_monthly_balances_lookup ON monthly_balances(company_id, year, month);
CREATE INDEX idx_monthly_balances_net_balance ON monthly_balances(company_id, year, month, balance_type);

-- Audit Logs
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_company_id ON audit_logs(company_id);
```

### 4.2. AI & Event Indexes
```sql
CREATE INDEX idx_ai_hitl_logs_tenant ON ai_hitl_logs(tenant_id);
CREATE INDEX idx_ai_hitl_logs_confidence ON ai_hitl_logs(ai_confidence_score);
CREATE INDEX idx_ai_hitl_logs_modified ON ai_hitl_logs(is_modified) WHERE is_modified = TRUE;
CREATE INDEX idx_event_store_company ON event_store(company_id, event_type, created_at DESC);
CREATE INDEX idx_rea_events_company ON rea_events(company_id, event_type, created_at DESC);
```

---

## 5. Functions & Triggers

### 5.1. Cleanup expired push subscriptions
```sql
CREATE OR REPLACE FUNCTION cleanup_expired_push_subscriptions()
RETURNS void AS $$
BEGIN
    DELETE FROM push_subscriptions
    WHERE updated_at < NOW() - INTERVAL '90 days'
    AND id NOT IN (SELECT user_id FROM sessions WHERE expires_at > NOW());
END;
$$ LANGUAGE plpgsql;
```

### 5.2. Auto-update timestamp
```sql
CREATE OR REPLACE FUNCTION update_system_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 6. Seed Data (Defaults)

### 6.1. Chart of Accounts (TT200/TT99)
Default accounts seeded trong `schema.sql` gồm 33 tài khoản từ các nhóm:
- **1xx** (Tài sản): 111, 112, 131, 138, 141, 152, 153, 156, 211, 214, 215, 229, 242
- **3xx** (Nợ phải trả): 331, 333, 334, 335, 338, 341
- **4xx** (Vốn chủ sở hữu): 411, 418, 421
- **5xx** (Doanh thu): 511, 515
- **6xx** (Chi phí): 611, 632, 635, 641, 642
- **7xx** (Thu nhập khác): 711, 811, 821
- **9xx** (Xác định KQKD): 911

### 6.2. AI Departments
- **finance**: Phòng Tài chính - Kế toán
- **sales**: Phòng Kinh doanh - Bán hàng
- **warehouse**: Phòng Kho - Logistics
- **hr**: Phòng Nhân sự
- **admin**: Phòng Hành chính - Quản trị

### 6.3. Feature Flags
- `basic-accounting`: Core accounting (enabled)
- `advanced-reports`: Advanced reports (enabled)
- `multi-currency`: Multi-currency (disabled)

---

## 7. Entity Count Summary

| STT | Bảng | Mục đích | Ghi chú |
|-----|------|---------|---------|
| 1 | companies | Công ty/Tenant | Multi-tenant |
| 2 | users | Người dùng | RBAC |
| 3 | user_companies | Liên kết user-company | N-N |
| 4 | sessions | Phiên đăng nhập | JWT + refresh |
| 5 | audit_logs | Lịch sử thay đổi | Audit |
| 6 | partners | Đối tác | KH/NCC |
| 7 | items | Hàng hóa | Inventory |
| 8 | vouchers | Chứng từ | Core |
| 9 | voucher_details | Chi tiết chứng từ | Core |
| 10 | opening_balances | Số dư đầu kỳ | Accounting |
| 11 | monthly_balances | Số dư tháng | CQRS |
| 12 | closing_entries | Kết chuyển | Period close |
| 13 | inventory_vouchers | Phiếu kho | Inventory |
| 14 | inventory_costing_layers | Giá vốn | AVCO/FIFO |
| 15 | stock_reconciliations | Kiểm kê | Inventory |
| 16 | trucks | Xe giao hàng | Logistics |
| 17 | notifications | Thông báo | In-app |
| 18 | push_subscriptions | Push notification | Web Push |
| 19 | e_invoices | Hóa đơn điện tử | E-invoice |
| 20 | rea_events | Sự kiện REA | Event-driven |
| 21 | rea_event_processors | Xử lý sự kiện | Dynamic posting |
| 22 | accounting_posting_rules | Quy tắc hạch toán | Dynamic posting |
| 23 | event_store | Event store | CQRS |
| 24 | ai_hitl_logs | AI HITL logs | RLHF |
| 25 | ai_suggestions | Đề xuất AI | AI |
| 26 | anomaly_reports | Báo cáo bất thường | AI monitoring |
| 27 | workflows | Workflow | Workflow engine |
| 28 | workflow_instances | Instance workflow | Workflow |
| 29 | workflow_step_executions | Bước workflow | Workflow |
| 30 | system_configs | Cấu hình hệ thống | Config |
| 31 | feature_flags | Flag tính năng | Feature toggle |
| 32 | charts_of_accounts | Danh mục tài khoản | COA |
| 33 | casso_transactions | Giao dịch Casso | Banking |
| 34 | credit_trade | Tín dụng thương mại | Credit |
| 35 | + nhiều bảng khác | | |

**Tổng số bảng**: ~60+ tables