# Hướng dẫn Cài đặt (Installation Guide)
## KETOAN ERP - Setup & Deployment Guide

**Phiên bản:** 1.0.0  
**Ngày:** 23/07/2026  

---

## 1. Yêu cầu Hệ thống

### 1.1. Phát triển (Local)

| Thành phần | Yêu cầu tối thiểu | Khuyến nghị |
|-----------|------------------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Disk | 10 GB | 20 GB SSD |
| OS | Windows 10 / macOS 12 / Ubuntu 20.04 | Windows 11 / macOS 14 |
| Node.js | >= 18.0.0 | 20.x LTS |
| npm | >= 9.0.0 | 10.x |
| Python | >= 3.11 | 3.12 |
| PostgreSQL | >= 14 | 16 |
| Redis | >= 6.x | 7.x |
| Git | >= 2.30 | Latest |

### 1.2. Production (Railway)

| Thành phần | Yêu cầu |
|-----------|---------|
| Backend | Node.js 20, 512MB RAM |
| Frontend | Static files, Nginx |
| AI Service | Python 3.11, 512MB RAM |
| Database | PostgreSQL 16, 1GB+ |
| Cache | Redis 7, 256MB |

---

## 2. Cài đặt Môi trường Phát triển

### 2.1. Clone Repository
```bash
git clone https://github.com/chinhducle828-lang/ketoan-erp.git
cd ketoan-erp
```

### 2.2. Cài đặt Backend
```bash
# Di chuyển vào thư mục backend
cd backend

# Cài đặt dependencies
npm install

# Copy file .env.example thành .env
cp .env.example .env

# Chỉnh sửa .env với thông tin của bạn
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=ketoan_db
# DB_USER=postgres
# DB_PASSWORD=your_password
```

### 2.3. Cài đặt Frontend
```bash
# Di chuyển vào thư mục front-end
cd front-end

# Cài đặt dependencies
npm install

# Copy file .env.example thành .env.local
cp .env.example .env.local
```

### 2.4. Cài đặt Storefront
```bash
# Di chuyển vào thư mục storefront
cd storefront

# Cài đặt dependencies
npm install

# Copy file .env.example thành .env.local
cp .env.example .env.local
```

### 2.5. Cài đặt AI Service
```bash
# Di chuyển vào thư mục ai-service
cd ai-service

# Tạo virtual environment
python -m venv venv

# Kích hoạt virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Cài đặt dependencies
pip install -r requirements.txt

# Copy file .env.example thành .env
cp .env.example .env
```

---

## 3. Cấu hình Cơ sở Dữ liệu

### 3.1. Tạo Database PostgreSQL
```bash
# Đăng nhập vào PostgreSQL
psql -U postgres

# Tạo database
CREATE DATABASE ketoan_db;

# Kiểm tra kết nối
\c ketoan_db

# Thoát
\q
```

### 3.2. Chạy Schema
Backend tự động chạy `schema.sql` khi khởi động lần đầu:
```bash
cd backend
npm start
```

Hoặc chạy thủ công:
```bash
psql -U postgres -d ketoan_db -f schema.sql
```

### 3.3. Cấu hình Redis
```bash
# Kiểm tra Redis đang chạy
redis-cli ping
# Kết quả: PONG

# Cấu hình trong .env
REDIS_URL=redis://localhost:6379
```

---

## 4. Cấu hình AI

### 4.1. API Keys
Lấy API keys từ các provider:

1. **Google Gemini**: https://aistudio.google.com/app/apikey
2. **Groq**: https://console.groq.com/keys
3. **DeepSeek**: https://platform.deepseek.com/api_keys

### 4.2. Cấu hình trong .env
```bash
# backend/.env
GEMINI_API_KEY=your_gemini_key
GEMINI_KEYS=key1,key2,key3,key4,key5,key6
GROQ_KEYS=key1,key2,key3,key4
DEEPSEEK_KEYS=key1,key2,key3
USE_CLOUDFLARE_PROXY=true
CLOUDFLARE_PROXY_URL=https://nvoice-ai-proxy.progefa.workers.dev/
```

### 4.3. Kiểm tra kết nối AI
```bash
cd backend
node test-all-apis.js
```

---

## 5. Chạy Ứng dụng (Development)

### 5.1. Khởi động Backend
```bash
cd backend
npm run dev
# Server chạy tại http://localhost:5000
```

### 5.2. Khởi động Frontend
```bash
cd front-end
npm run dev
# Server chạy tại http://localhost:3000
```

### 5.3. Khởi động Storefront
```bash
cd storefront
npm run dev
# Server chạy tại http://localhost:3001
```

### 5.4. Khởi động AI Service
```bash
cd ai-service
python main.py
# Server chạy tại http://localhost:8000
```

---

## 6. Truy cập Hệ thống

### 6.1. URL
| Service | URL |
|---------|-----|
| Frontend ERP | http://localhost:3000 |
| Storefront | http://localhost:3001 |
| Backend API | http://localhost:5000 |
| AI Service | http://localhost:8000 |
| Health Check | http://localhost:5000/api/health |

### 6.2. Tài khoản Mặc định
| Vai trò | Username | Password |
|---------|----------|----------|
| Admin | admin | Admin@123 |

> **Lưu ý**: Đổi mật khẩu ngay sau khi đăng nhập lần đầu!

---

## 7. Deploy lên Railway

### 7.1. Chuẩn bị
```bash
# Cài đặt Railway CLI
npm install -g @railway/cli

# Đăng nhập
railway login
```

### 7.2. Deploy Backend
```bash
cd backend
railway init
railway up
```

### 7.3. Deploy Frontend
```bash
cd front-end
railway init
railway up
```

### 7.4. Cấu hình Environment Variables trên Railway
```bash
railway variables set JWT_SECRET=your-secret
railway variables set GEMINI_API_KEY=your-key
railway variables set DATABASE_URL=postgresql://...
```

### 7.5. Add Plugins
```bash
railway add postgresql
railway add redis
```

---

## 8. Kiểm tra Hệ thống

### 8.1. Health Check
```bash
curl http://localhost:5000/api/health
# {"status":"ok","isDatabaseReady":true}
```

### 8.2. Test API
```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123"}'

# Get vouchers (sau khi có token)
curl http://localhost:5000/api/vouchers?company_id=1 \
  -H "Authorization: Bearer <token>"
```

### 8.3. Test AI Connection
```bash
cd backend
node test-all-apis.js
node test-gemini-connection.js
node test-deepseek-connection.js
```

---

## 9. Xử lý Sự cố Thường gặp

### 9.1. Database Connection Error
```
Lỗi: connect ECONNREFUSED 127.0.0.1:5432
```
**Giải pháp:**
```bash
# Kiểm tra PostgreSQL đang chạy
pg_isready

# Khởi động PostgreSQL
# Windows: net start postgresql-x64-16
# macOS: brew services start postgresql@16
# Linux: sudo systemctl start postgresql
```

### 9.2. Redis Connection Error
```
Lỗi: connect ECONNREFUSED 127.0.0.1:6379
```
**Giải pháp:**
```bash
# Khởi động Redis
# Windows: redis-server
# macOS: brew services start redis
# Linux: sudo systemctl start redis
```

### 9.3. Port Already in Use
```
Lỗi: listen EADDRINUSE :::5000
```
**Giải pháp:**
```bash
# Tìm process đang dùng port
netstat -ano | findstr :5000

# Kill process
# Windows: taskkill /PID <PID> /F
# macOS/Linux: kill -9 <PID>
```

### 9.4. AI API Key Error
```
Lỗi: AI provider not available
```
**Giải pháp:**
- Kiểm tra API key trong .env
- Chạy `node test-all-apis.js` để kiểm tra
- Đảm bảo có ít nhất 1 provider hoạt động