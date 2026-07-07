# Hướng dẫn Deploy lên Railway

## Cấu trúc deploy

Dự án sử dụng **Dockerfile multi-stage** để build 3 services:
- **Backend** (port 5000) - API + WebSocket
- **Frontend ERP** (port 3000) - React SPA
- **Storefront** (port 3001) - Cửa hàng trực tuyến

## Cách 1: Deploy qua Railway Dashboard (Khuyên dùng)

### 1. Tạo project mới
- Vào [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
- Chọn repo `ketoan-erp`

### 2. Thêm PostgreSQL
- Project → New → Database → PostgreSQL
- Railway tự động inject `DATABASE_URL` vào backend service

### 3. Thêm Redis (tùy chọn)
- Project → New → Database → Redis
- Railway tự động inject `REDIS_URL`

### 4. Cấu hình Backend Service
- Chọn backend service → Settings → Variables
- Thêm các biến từ `.env.example`:
  ```
  NODE_ENV=production
  PORT=5000
  JWT_SECRET=<chuỗi-bảo-mật-dài>
  FRONTEND_URL=https://<frontend-url>.railway.app,https://<storefront-url>.railway.app
  SERVE_STATIC_FRONTEND=false
  ```
- Railway tự động đọc `railway.json` để build Docker

### 5. Cấu hình Frontend Service
- Tạo service mới từ cùng repo
- Settings → Build → Custom Dockerfile → Dockerfile path: `Dockerfile`
- Settings → Deploy → Start Command: `cd /app/front-end && npm start`
- Variables: `PORT=3000`, `VITE_API_BASE_URL=https://<backend-url>.railway.app`

### 6. Cấu hình Storefront Service
- Tương tự frontend nhưng:
- Start Command: `cd /app/storefront && npm start`
- Variables: `PORT=3001`, `VITE_API_BASE_URL=https://<backend-url>.railway.app`

## Cách 2: Deploy qua Railway CLI

```bash
# Cài Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy
railway up
```

## Biến môi trường quan trọng

| Variable | Mô tả | Mặc định |
|----------|-------|----------|
| `PORT` | Cổng chạy server | 5000 |
| `NODE_ENV` | Môi trường | production |
| `DATABASE_URL` | PostgreSQL connection string (Railway auto) | - |
| `REDIS_URL` | Redis connection (Railway auto) | - |
| `JWT_SECRET` | Secret cho JWT | Bắt buộc đổi |
| `FRONTEND_URL` | CORS whitelist (comma-separated) | - |
| `SERVE_STATIC_FRONTEND` | Phục vụ SPA từ backend | false |
| `SEED_DATABASE` | Auto-seed khi bảng rỗng | false |

## Health Check

Backend có endpoint `/api/health` để Railway monitor:
```json
{ "status": "ok", "message": "Backend chạy tốt" }
```

## Migrations

Khi backend khởi động, `server.js` tự động:
1. Chạy `schema.sql` để tạo bảng
2. Chạy tất cả file trong `backend/migrations/*.sql` theo thứ tự

Không cần chạy migration thủ công.

## Troubleshooting

### Lỗi CORS
- Kiểm tra `FRONTEND_URL` có chứa đúng URL frontend không
- Railway tự động allow `*.railway.app` origins

### Lỗi kết nối DB
- Đảm bảo `DATABASE_URL` được Railway inject (kiểm tra Variables)
- SSL được bật tự động khi dùng `DATABASE_URL`

### Lỗi build Docker
- Kiểm tra `.dockerignore` đã loại trừ `.env` chưa
- Đảm bảo `npm ci` thành công local trước khi deploy