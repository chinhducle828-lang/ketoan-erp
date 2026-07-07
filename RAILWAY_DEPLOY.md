# Hướng dẫn Deploy lên Railway

## Cấu trúc deploy

Dự án dùng **3 Dockerfile riêng biệt** (mỗi service một file), mỗi file chỉ `COPY` đúng thư mục của nó:
- **Backend** → `Dockerfile.backend` (port 5000) - API + WebSocket
- **Frontend ERP** → `Dockerfile.frontend` (port 3000) - React SPA
- **Storefront** → `Dockerfile.storefront` (port 3001) - Cửa hàng trực tuyến

> Mỗi service là một Railway service riêng, build từ cùng repo nhưng dùng Dockerfile khác nhau.
> Việc tách riêng giúp tránh lỗi build do Railway gửi snapshot tăng dần (incremental) chỉ chứa thư mục bị thay đổi.

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
  FRONTEND_URL=https://ketoanonline.up.railway.app,https://banhang.up.railway.app
  SERVE_STATIC_FRONTEND=false
  ```
- Railway tự động đọc `railway.json` để build Docker (`dockerfilePath: Dockerfile.backend`, watch `backend/**`)

### 5. Cấu hình Frontend Service
- Tạo service mới từ cùng repo
- Settings → Build → Custom Dockerfile → Dockerfile path: `Dockerfile.frontend`
- Settings → Deploy → Start Command: `npm start` (WORKDIR đã là `/app`, không cần `cd`)
- Settings → Deploy → Watch / Build filter (nếu có): `front-end/**`
- Variables: `PORT=3000`, `VITE_API_BASE_URL=https://dazzling-grace-production-03a5.up.railway.app`
- `VITE_API_BASE_URL` đã được set sẵn trong `Dockerfile.frontend` (trỏ về backend), nhưng có thể ghi đè ở đây nếu cần.

### 6. Cấu hình Storefront Service
- Tương tự frontend nhưng:
- Dockerfile path: `Dockerfile.storefront`
- Start Command: `npm start`
- Watch / Build filter: `storefront/**`
- Variables: `PORT=3001`, `VITE_API_BASE_URL=https://dazzling-grace-production-03a5.up.railway.app`
- `VITE_API_BASE_URL` đã được set sẵn trong `Dockerfile.storefront` (trỏ về backend), nhưng có thể ghi đè ở đây nếu cần.

> **Lưu ý quan trọng:** Vite chỉ đọc biến `VITE_*` lúc **build** (`npm run build`), không lúc runtime.
> Do đó `VITE_API_BASE_URL` phải được set TRƯỚC bước build (đã làm trong Dockerfile) hoặc truyền qua biến môi trường build của Railway, không phải chỉ lúc chạy `vite preview`.

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
- Nếu gặp lỗi `"/storefront": not found` (hoặc `"/front-end": not found`):
  - Nguyên nhân: Dockerfile cũ gộp chung 3 service, Railway gửi snapshot tăng dần chỉ chứa thư mục bị đổi → thiếu thư mục khác.
  - Khắc phục: dùng đúng Dockerfile riêng (`Dockerfile.backend` / `Dockerfile.frontend` / `Dockerfile.storefront`), mỗi file chỉ COPY thư mục của nó.
  - Hoặc trigger rebuild sạch (Clear cache / Redeploy) để Railway gửi toàn bộ repo.
