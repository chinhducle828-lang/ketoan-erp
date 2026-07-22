# Quản lý Cấu hình Hệ thống (System Config Management)

Tài liệu này hướng dẫn cách thiết lập và quản lý các giá trị cấu hình trong hệ thống Ketoan ERP.

## Mục lục
1. [Tổng quan](#tổng-quan)
2. [Cấu trúc bảng system_configs](#cấu-trúc-bảng-system_configs)
3. [Các phương pháp thiết lập cấu hình](#các-phương-pháp-thiết-lập-cấu-hình)
   - [Phương pháp 1: SQL trực tiếp](#phương-pháp-1-sql-trực-tiếp)
   - [Phương pháp 2: API Endpoint](#phương-pháp-2-api-endpoint)
   - [Phương pháp 3: Admin UI](#phương-pháp-3-admin-ui)
4. [Các cấu hình quan trọng](#các-cấu-hình-quan-trọng)
5. [Kiểm tra cấu hình hiện tại](#kiểm-tra-cấu-hình-hiện-tại)

---

## Tổng quan

Hệ thống sử dụng bảng `system_configs` để lưu trữ các giá trị cấu hình động. Các cấu hình này bao gồm:
- Thuế suất mặc định (tax.standard_rate)
- Đơn vị tiền tệ (currency.default)
- Tên công ty (company.name)
- Các tính năng bật/tắt (feature_flags)
- Cấu hình AI (ai_departments, ai_batch_configs)

**Lưu ý quan trọng**: Trong môi trường production, các giá trị cấu hình được thiết lập thủ công hoặc qua API, **không** có seed data tự động.

---

## Cấu trúc bảng system_configs

```sql
CREATE TABLE system_configs (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value TEXT,
    value_type VARCHAR(50) DEFAULT 'string',
    category VARCHAR(100),
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Các trường quan trọng:**
- `config_key`: Tên duy nhất của cấu hình (VD: `tax.standard_rate`)
- `config_value`: Giá trị cấu hình (lưu dưới dạng text)
- `value_type`: Kiểu dữ liệu (`string`, `number`, `boolean`, `json`)
- `category`: Phân loại cấu hình (VD: `tax`, `currency`, `company`)
- `is_encrypted`: Đánh dấu nếu giá trị cần mã hóa

---

## Các phương pháp thiết lập cấu hình

### Phương pháp 1: SQL trực tiếp

Sử dụng psql hoặc bất kỳ công cụ PostgreSQL nào để chạy các câu lệnh SQL.

#### 1.1. Thêm cấu hình mới

```sql
INSERT INTO system_configs (config_key, config_value, value_type, category, description)
VALUES (
    'tax.standard_rate',
    '8',
    'number',
    'tax',
    'Thuế suất VAT mặc định (%)'
)
ON CONFLICT (config_key) 
DO UPDATE SET 
    config_value = EXCLUDED.config_value,
    updated_at = CURRENT_TIMESTAMP;
```

#### 1.2. Cập nhật cấu hình hiện có

```sql
UPDATE system_configs 
SET 
    config_value = '10',
    updated_at = CURRENT_TIMESTAMP
WHERE config_key = 'tax.standard_rate';
```

#### 1.3. Xem tất cả cấu hình

```sql
SELECT 
    config_key,
    config_value,
    value_type,
    category,
    description,
    updated_at
FROM system_configs
ORDER BY category, config_key;
```

#### 1.4. Xem cấu hình theo category

```sql
-- Xem cấu hình thuế
SELECT * FROM system_configs WHERE category = 'tax';

-- Xem cấu hình tiền tệ
SELECT * FROM system_configs WHERE category = 'currency';

-- Xem cấu hình công ty
SELECT * FROM system_configs WHERE category = 'company';
```

---

### Phương pháp 2: API Endpoint

Hệ thống cung cấp API endpoint để quản lý cấu hình.

#### 2.1. Lấy tất cả cấu hình

```bash
GET /api/settings/config
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tax.standard_rate": "8",
    "currency.default": "VND",
    "company.name": "Công ty ABC"
  }
}
```

#### 2.2. Lấy cấu hình theo category

```bash
GET /api/settings/config?category=tax
Authorization: Bearer <token>
```

#### 2.3. Cập nhật cấu hình

```bash
POST /api/settings/config
Authorization: Bearer <token>
Content-Type: application/json

{
  "config_key": "tax.standard_rate",
  "config_value": "10",
  "value_type": "number",
  "category": "tax",
  "description": "Thuế suất VAT mặc định (%)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cấu hình đã được cập nhật",
  "data": {
    "id": 1,
    "config_key": "tax.standard_rate",
    "config_value": "10",
    "value_type": "number",
    "category": "tax",
    "updated_at": "2026-07-21T12:00:00.000Z"
  }
}
```

#### 2.4. Cập nhật nhiều cấu hình cùng lúc

```bash
POST /api/settings/config/batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "configs": [
    {
      "config_key": "tax.standard_rate",
      "config_value": "10"
    },
    {
      "config_key": "currency.default",
      "config_value": "VND"
    },
    {
      "config_key": "company.name",
      "config_value": "Công ty ABC"
    }
  ]
}
```

---

### Phương pháp 3: Admin UI

Nếu module Admin UI đã được triển khai:

1. Đăng nhập với tài khoản admin
2. Vào mục **Cài đặt** → **Cấu hình hệ thống**
3. Chọn category cần cấu hình (Tax, Currency, Company, etc.)
4. Chỉnh sửa giá trị và lưu

---

## Các cấu hình quan trọng

### 1. Cấu hình Thuế (Tax)

```sql
-- Thuế suất VAT mặc định
INSERT INTO system_configs (config_key, config_value, value_type, category, description)
VALUES ('tax.standard_rate', '8', 'number', 'tax', 'Thuế suất VAT mặc định (%)')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;

-- Thuế suất giảm
INSERT INTO system_configs (config_key, config_value, value_type, category, description)
VALUES ('tax.reduced_rate', '5', 'number', 'tax', 'Thuế suất VAT giảm (%)')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;

-- Thuế suất tăng
INSERT INTO system_configs (config_key, config_value, value_type, category, description)
VALUES ('tax.increased_rate', '10', 'number', 'tax', 'Thuế suất VAT tăng (%)')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;
```

### 2. Cấu hình Tiền tệ (Currency)

```sql
-- Đơn vị tiền tệ mặc định
INSERT INTO system_configs (config_key, config_value, value_type, category, description)
VALUES ('currency.default', 'VND', 'string', 'currency', 'Đơn vị tiền tệ mặc định')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;

-- Tỷ giá USD/VND
INSERT INTO system_configs (config_key, config_value, value_type, category, description)
VALUES ('currency.usd_rate', '24500', 'number', 'currency', 'Tỷ giá USD sang VND')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;
```

### 3. Cấu hình Công ty (Company)

```sql
-- Tên công ty
INSERT INTO system_configs (config_key, config_value, value_type, category, description)
VALUES ('company.name', 'Công ty TNHH ABC', 'string', 'company', 'Tên công ty')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;

-- Mã số thuế
INSERT INTO system_configs (config_key, config_value, value_type, category, description)
VALUES ('company.tax_code', '0123456789', 'string', 'company', 'Mã số thuế')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;

-- Địa chỉ
INSERT INTO system_configs (config_key, config_value, value_type, category, description)
VALUES ('company.address', '123 Đường ABC, Quận 1, TP.HCM', 'string', 'company', 'Địa chỉ công ty')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;

-- Số điện thoại
INSERT INTO system_configs (config_key, config_value, value_type, category, description)
VALUES ('company.phone', '028-1234-5678', 'string', 'company', 'Số điện thoại')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;
```

### 4. Cấu hình Feature Flags

```sql
-- Bật/tắt module AI
INSERT INTO system_configs (config_key, config_value, value_type, category, description)
VALUES ('feature.ai_enabled', 'true', 'boolean', 'features', 'Bật module AI')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;

-- Bật/tắt module Logistics
INSERT INTO system_configs (config_key, config_value, value_type, category, description)
VALUES ('feature.logistics_enabled', 'true', 'boolean', 'features', 'Bật module Logistics')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;

-- Bật/tắt báo cáo tài chính
INSERT INTO system_configs (config_key, config_value, value_type, category, description)
VALUES ('feature.financial_reports', 'true', 'boolean', 'features', 'Bật báo cáo tài chính')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;
```

### 5. Cấu hình AI

```sql
-- Phòng ban sử dụng AI
INSERT INTO system_configs (config_key, config_value, value_type, category, description)
VALUES ('ai.departments', '["accounting", "hr", "sales"]', 'json', 'ai', 'Danh sách phòng ban sử dụng AI')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;

-- Kích thước batch xử lý AI
INSERT INTO system_configs (config_key, config_value, value_type, category, description)
VALUES ('ai.batch_size', '50', 'number', 'ai', 'Số lượng hồ sơ xử lý mỗi batch')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;

-- Thời gian chờ giữa các batch (giây)
INSERT INTO system_configs (config_key, config_value, value_type, category, description)
VALUES ('ai.batch_delay', '5', 'number', 'ai', 'Thời gian chờ giữa các batch (giây)')
ON CONFLICT (config_key) DO UPDATE SET config_value = EXCLUDED.config_value;
```

---

## Kiểm tra cấu hình hiện tại

### 1. Kiểm tra qua SQL

```sql
-- Xem tất cả cấu hình
SELECT config_key, config_value, value_type, category 
FROM system_configs 
ORDER BY category, config_key;

-- Kiểm tra cấu hình cụ thể
SELECT * FROM system_configs WHERE config_key = 'tax.standard_rate';

-- Đếm số cấu hình
SELECT COUNT(*) as total_configs FROM system_configs;

-- Kiểm tra cấu hình thiếu (quan trọng)
SELECT 
    'tax.standard_rate' as missing_config
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE config_key = 'tax.standard_rate')
UNION ALL
SELECT 'currency.default'
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE config_key = 'currency.default')
UNION ALL
SELECT 'company.name'
WHERE NOT EXISTS (SELECT 1 FROM system_configs WHERE config_key = 'company.name');
```

### 2. Kiểm tra qua API

```bash
# Lấy tất cả cấu hình
curl -X GET http://localhost:3000/api/settings/config \
  -H "Authorization: Bearer YOUR_TOKEN"

# Lấy cấu hình cụ thể
curl -X GET http://localhost:3000/api/settings/config?key=tax.standard_rate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Kiểm tra trong code

```javascript
// Backend
const configService = require('./services/configService');

// Lấy cấu hình
const taxRate = await configService.get('tax.standard_rate');
console.log('Tax rate:', taxRate); // Output: 8

// Lấy cấu hình với giá trị mặc định
const currency = await configService.get('currency.default', 'VND');
console.log('Currency:', currency); // Output: VND
```

---

## Script khởi tạo cấu hình ban đầu

Tạo file `backend/scripts/init-config.js` để khởi tạo cấu hình ban đầu:

```javascript
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ketoan_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

const defaultConfigs = [
  // Tax
  {
    config_key: 'tax.standard_rate',
    config_value: '8',
    value_type: 'number',
    category: 'tax',
    description: 'Thuế suất VAT mặc định (%)'
  },
  {
    config_key: 'tax.reduced_rate',
    config_value: '5',
    value_type: 'number',
    category: 'tax',
    description: 'Thuế suất VAT giảm (%)'
  },
  {
    config_key: 'tax.increased_rate',
    config_value: '10',
    value_type: 'number',
    category: 'tax',
    description: 'Thuế suất VAT tăng (%)'
  },
  
  // Currency
  {
    config_key: 'currency.default',
    config_value: 'VND',
    value_type: 'string',
    category: 'currency',
    description: 'Đơn vị tiền tệ mặc định'
  },
  {
    config_key: 'currency.usd_rate',
    config_value: '24500',
    value_type: 'number',
    category: 'currency',
    description: 'Tỷ giá USD sang VND'
  },
  
  // Company
  {
    config_key: 'company.name',
    config_value: 'Công ty ABC',
    value_type: 'string',
    category: 'company',
    description: 'Tên công ty'
  },
  {
    config_key: 'company.tax_code',
    config_value: '0123456789',
    value_type: 'string',
    category: 'company',
    description: 'Mã số thuế'
  },
  
  // Features
  {
    config_key: 'feature.ai_enabled',
    config_value: 'true',
    value_type: 'boolean',
    category: 'features',
    description: 'Bật module AI'
  },
  {
    config_key: 'feature.logistics_enabled',
    config_value: 'true',
    value_type: 'boolean',
    category: 'features',
    description: 'Bật module Logistics'
  },
  
  // AI
  {
    config_key: 'ai.batch_size',
    config_value: '50',
    value_type: 'number',
    category: 'ai',
    description: 'Số lượng hồ sơ xử lý mỗi batch'
  }
];

async function initConfigs() {
  const client = await pool.connect();
  
  try {
    console.log('Đang khởi tạo cấu hình hệ thống...\n');
    
    for (const config of defaultConfigs) {
      const query = `
        INSERT INTO system_configs (config_key, config_value, value_type, category, description)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (config_key) 
        DO UPDATE SET 
          config_value = EXCLUDED.config_value,
          value_type = EXCLUDED.value_type,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      
      const result = await client.query(query, [
        config.config_key,
        config.config_value,
        config.value_type,
        config.category,
        config.description
      ]);
      
      const action = result.rows[0].created_at === result.rows[0].updated_at ? 'THÊM MỚI' : 'CẬP NHẬT';
      console.log(`[${action}] ${config.config_key} = ${config.config_value}`);
    }
    
    console.log('\n✅ Khởi tạo cấu hình hoàn tất!');
    
  } catch (error) {
    console.error('❌ Lỗi khi khởi tạo cấu hình:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

initConfigs();
```

### Chạy script khởi tạo

```bash
cd backend
node scripts/init-config.js
```

---

## Best Practices

1. **Không hardcode giá trị**: Luôn lấy cấu hình từ database hoặc environment variables
2. **Sử dụng giá trị mặc định**: Luôn có giá trị fallback nếu cấu hình không tồn tại
3. **Kiểm tra kiểu dữ liệu**: Đảm bảo config_value phù hợp với value_type
4. **Mã hóa thông tin nhạy cảm**: Đặt is_encrypted = true cho API keys, passwords
5. **Audit trail**: Theo dõi thay đổi cấu hình qua updated_at
6. **Backup trước khi thay đổi**: Luôn backup database trước khi cập nhật cấu hình quan trọng

---

## Troubleshooting

### Cấu hình không được cập nhật

```sql
-- Kiểm tra xem cấu hình có tồn tại không
SELECT * FROM system_configs WHERE config_key = 'your_config_key';

-- Nếu không tồn tại, thêm mới
INSERT INTO system_configs (config_key, config_value, value_type, category)
VALUES ('your_config_key', 'your_value', 'string', 'general');
```

### API trả về 404

- Kiểm tra route đã được đăng ký trong server.js
- Kiểm tra authentication middleware
- Xem logs để tìm lỗi chi tiết

### Giá trị cấu hình không đúng

```sql
-- Xem giá trị hiện tại
SELECT config_value, updated_at FROM system_configs WHERE config_key = 'tax.standard_rate';

-- Cập nhật lại
UPDATE system_configs 
SET config_value = '8', updated_at = CURRENT_TIMESTAMP 
WHERE config_key = 'tax.standard_rate';
```

---

## Liên hệ hỗ trợ

Nếu cần hỗ trợ, vui lòng liên hệ:
- Email: support@ketoan-erp.com
- Documentation: https://docs.ketoan-erp.com