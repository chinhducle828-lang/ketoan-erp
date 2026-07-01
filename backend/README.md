# Backend Kế Toán ERP

Backend hạch toán kế toán kép theo Thông tư 200 với kiến trúc modular và scalable.

## Cấu trúc thư mục

```
backend/
├── server.js                 # Entry point, khởi tạo DB và middleware
├── package.json              # Dependencies và scripts
├── .env.example              # Environment variables template
├── schema.sql                # Database schema
│
├── routes/                   # API Routes - Đã tách thành files riêng
│   ├── auth.js              # Authentication & Authorization
│   ├── users.js             # Quản lý người dùng
│   ├── companies.js         # Quản lý công ty
│   ├── vouchers.js          # Quản lý chứng từ hạch toán
│   ├── items.js             # Quản lý danh mục vật tư
│   ├── openingBalances.js   # Số dư đầu kỳ
│   ├── dashboard.js         # Dashboard & thống kê
│   ├── export.js            # Xuất Excel các báo cáo
│   └── import.js            # Nhập Excel
│
├── middleware/               # Custom middleware
│   ├── auth.js              # Xác thực JWT và phân quyền
│   └── validation.js        # Zod validation middleware
│
├── validators/               # Zod schemas cho validation
│   └── index.js             # Tất cả validation schemas
│
├── services/                 # Business logic & helpers
│   └── helpers.js           # Helper functions (normalize, sync, access)
│
├── cache/                    # Redis caching
│   └── redis.js             # Redis client & cache middleware
│
└── tests/                    # Unit tests
    ├── setup.js             # Test configuration
    ├── validators.test.js   # Validation tests
    └── helpers.test.js      # Helper function tests
```

## Cài đặt

### 1. Clone repository
```bash
git clone <repository-url>
cd ketoan/backend
```

### 2. Cài đặt dependencies
```bash
npm install
```

### 3. Cấu hình environment variables
```bash
cp .env.example .env
# Chỉnh sửa file .env với thông tin database và JWT secret
```

### 4. Cài đặt Redis (optional - để sử dụng caching)
```bash
# Windows (sử dụng WSL hoặc Docker)
docker run -d -p 6379:6379 redis:alpine

# Hoặc cài đặt Redis locally
# Mac: brew install redis && brew services start redis
# Ubuntu: sudo apt install redis-server && sudo systemctl start redis
```

### 5. Chạy database migrations
File `server.js` sẽ tự động tạo tables khi khởi động.

### 6. Seed database với test data (optional)

**Để có dữ liệu test:**
Mở file `.env` và sửa:
```env
SEED_DATABASE=true
```

Server sẽ tự động tạo:
- Admin user: `admin` / `admin123`
- 2 KTT users: `ktt1`, `ktt2` / `ktt123`
- 2 NV users: `nv1`, `nv2` / `nv123`
- 2 công ty test
- 4 vật tư
- 5 số dư đầu kỳ
- 7 chứng từ test

**Để web trống (không có dữ liệu):**
Mở file `.env` và sửa:
```env
SEED_DATABASE=false
```

Hoặc xóa dòng `SEED_DATABASE` đi cũng được.

Sau khi thay đổi, restart server:
```bash
# Nhấn Ctrl+C để dừng server, rồi chạy lại:
npm run dev
```

### 7. Chạy server

Development mode (với nodemon):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Server sẽ chạy tại `http://localhost:5000`

## Testing

### Unit Tests (Jest)
Tests chạy độc lập, không cần database hay seed data:

```bash
# Chạy tất cả tests
npm test

# Watch mode
npm run test:watch
```

**Lưu ý**: Unit tests chỉ test validators và helpers, không cần `SEED_DATABASE=true`.

### Test Data cho Web (Seed Database)
Đây là dữ liệu để bạn test thủ công trên web, không liên quan đến unit tests:

**Có dữ liệu test:**
```env
SEED_DATABASE=true
```

**Web trống:**
```env
SEED_DATABASE=false
```

## API Endpoints

### Authentication
- `POST /api/auth/register-admin` - Đăng ký admin đầu tiên
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/logout` - Đăng xuất
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/change-password` - Đổi mật khẩu
- `POST /api/auth/admin-reset-password` - Reset mật khẩu (admin only)
- `GET /api/auth/preferences` - Lấy preferences
- `PUT /api/auth/preferences` - Cập nhật preferences
- `POST /api/auth/assign-staff` - Phân công nhân viên (admin)
- `POST /api/auth/assign-company` - Phân công công ty (admin)

### Users
- `GET /api/users` - Danh sách người dùng
- `POST /api/users` - Tạo người dùng mới (admin)
- `DELETE /api/users/:id` - Xóa người dùng (admin)

### Companies
- `GET /api/companies` - Danh sách công ty
- `POST /api/companies` - Tạo công ty (admin)
- `DELETE /api/companies/:id` - Xóa công ty (admin)
- `GET /api/companies/:id/export` - Export dữ liệu công ty
- `POST /api/companies/:id/import` - Import dữ liệu công ty

### Vouchers
- `GET /api/vouchers` - Danh sách chứng từ
- `POST /api/vouchers` - Tạo chứng từ mới
- `DELETE /api/vouchers/:id` - Xóa chứng từ

### Items
- `GET /api/items` - Danh sách vật tư
- `POST /api/items` - Thêm vật tư mới
- `PUT /api/items/:code` - Cập nhật vật tư
- `DELETE /api/items/:code` - Xóa vật tư

### Opening Balances
- `GET /api/opening-balances` - Số dư đầu kỳ
- `POST /api/opening-balances` - Cập nhật số dư đầu kỳ
- `GET /api/opening-balances/status` - Kiểm tra trạng thái số dư

### Dashboard
- `GET /api/dashboard/cashflow` - Dashboard dòng tiền (có Redis cache)

### Export (Excel)
- `GET /api/export/vouchers` - Sổ nhật ký chung
- `GET /api/export/cashbook` - Sổ quỹ tiền mặt
- `GET /api/export/items` - Danh mục vật tư
- `GET /api/export/opening-balances` - Số dư đầu kỳ
- `GET /api/export/users` - Danh sách nhân sự
- `GET /api/export/fixed-assets` - Tài sản cố định (211)
- `GET /api/export/production-costs` - Chi phí sản xuất (154, 156)
- `GET /api/export/purchases` - Mua hàng & nhập kho (156, 331, 1331)
- `GET /api/export/payroll` - Bảng lương & bảo hiểm (6422, 3341, 3383)
- `GET /api/export/dashboard` - Dashboard dòng tiền

### Import (Excel)
- `POST /api/import/items` - Nhập danh mục vật tư
- `POST /api/import/opening-balances` - Nhập số dư đầu kỳ
- `POST /api/import/vouchers` - Nhập chứng từ hạch toán

### Health Check
- `GET /api/health` - Kiểm tra trạng thái server

## Caching với Redis

Dashboard cashflow được cache với TTL 5 phút (300s). Cache sẽ tự động invalidate khi:
- Tạo chứng từ mới
- Xóa chứng từ
- Cập nhật số dư đầu kỳ
- Nhập chứng từ từ Excel

Để disable Redis caching, không cần cấu hình `REDIS_URL` trong `.env`.

## Validation

Tất cả input data được validate bằng Zod schemas:
- Type checking
- Required fields
- Min/max lengths
- Enum values
- Custom validation messages

## Testing

### Unit Tests
- **Validators**: Test các Zod schemas
- **Helpers**: Test các helper functions

### Integration Tests (cần thêm)
- Auth routes
- Voucher CRUD
- Company management

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 5000) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing secret |
| `REDIS_URL` | No | Redis connection string (for caching) |
| `FRONTEND_URL` | No | Comma-separated allowed CORS origins |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | Refresh token expiration (default: 30) |
| `NODE_ENV` | No | Environment (development/production) |

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Cache**: Redis (ioredis)
- **Validation**: Zod
- **Authentication**: JWT (jsonwebtoken)
- **Testing**: Jest + Supertest
- **Excel**: ExcelJS
- **Security**: bcryptjs

## Security Features

- JWT-based authentication
- Refresh token rotation
- HttpOnly cookies for refresh tokens
- Role-based access control (admin, ktt, nv)
- Session management
- Password hashing with bcrypt
- CORS configuration
- SQL injection prevention (parameterized queries)

## Contributing

1. Tạo feature branch
2. Viết tests cho new features
3. Chạy `npm test` để đảm bảo tests pass
4. Submit pull request

## License

Private - All rights reserved