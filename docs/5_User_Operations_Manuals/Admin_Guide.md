# Tài liệu Quản trị Hệ thống (Admin Guide)
## KETOAN ERP - System Administration

**Phiên bản:** 1.0.0  
**Ngày:** 23/07/2026  

---

## 1. Quản lý Người dùng

### 1.1. Tạo Người dùng Mới
1. Vào **Quản trị** → **Người dùng** → **Tạo mới**
2. Nhập thông tin:
   - **Username**: Tên đăng nhập (duy nhất)
   - **Password**: Mật khẩu mặc định
   - **Vai trò**: admin, ktt, nv, nv_banhang, nv_kho, gd_kinhdoanh
   - **Công ty**: Chọn công ty được truy cập
   - **Phòng ban**: Tài chính, Kinh doanh, Kho,...
3. Nhấn **Lưu**

### 1.2. Phân quyền
| Vai trò | Mô tả | Quyền hạn |
|---------|-------|-----------|
| **admin** | Quản trị hệ thống | Toàn quyền, audit logs, cấu hình |
| **ktt** | Kế toán trưởng | Duyệt chứng từ, khóa sổ, báo cáo |
| **nv** | Nhân viên kế toán | Nhập chứng từ, xem sổ sách |
| **nv_banhang** | Bán hàng | POS, đơn hàng |
| **nv_kho** | Thủ kho | Nhập/xuất kho, kiểm kê |
| **gd_kinhdoanh** | Giám đốc KD | Dashboard, báo cáo doanh thu |

### 1.3. Reset Mật khẩu
1. Vào **Quản trị** → **Người dùng**
2. Chọn người dùng cần reset
3. Nhấn **Reset mật khẩu**
4. Nhập mật khẩu mới (tự động yêu cầu đổi khi đăng nhập)

---

## 2. Quản lý Công ty

### 2.1. Tạo Công ty Mới
1. Vào **Quản trị** → **Công ty** → **Tạo mới**
2. Nhập:
   - **Tên công ty**
   - **Mã số thuế** (duy nhất)
   - **Địa chỉ**
   - **Loại hình**: Công ty / Chi nhánh
3. Nhấn **Lưu**

### 2.2. Khóa sổ Công ty
1. Vào **Công ty** → Chọn công ty
2. Nhấn **Cài đặt**
3. **Ngày khóa sổ**: Ngày chặn sửa/xóa dữ liệu quá khứ
4. Nhấn **Lưu**

---

## 3. Cấu hình Hệ thống

### 3.1. System Configs
Cấu hình hệ thống được lưu trong bảng `system_configs`:

| Config Key | Mô tả | Giá trị mặc định |
|-----------|-------|-----------------|
| `tax.standard_rate` | Thuế GTGT chuẩn | 8 |
| `company.default_tax_rate` | Thuế mặc định | 8 |
| `currency.default` | Tiền tệ mặc định | VND |
| `order.payment_methods` | Phương thức thanh toán | ["cod","bank_transfer","casso"] |

### 3.2. Feature Flags
Bật/tắt tính năng qua bảng `feature_flags`:

| Flag | Mô tả | Mặc định |
|------|-------|---------|
| `basic-accounting` | Kế toán cơ bản | TRUE |
| `advanced-reports` | Báo cáo nâng cao | TRUE |
| `multi-currency` | Đa tiền tệ | FALSE |

---

## 4. Cấu hình AI

### 4.1. AI Providers
Cấu hình trong `backend/.env`:

```bash
# Gemini (chính)
GEMINI_API_KEY=your_key
GEMINI_KEYS=key1,key2,key3,key4,key5,key6
GEMINI_MODEL=gemini-2.5-flash

# Groq (dự phòng)
GROQ_KEYS=key1,key2,key3,key4

# DeepSeek (dự phòng)
DEEPSEEK_KEYS=key1,key2,key3

# Cloudflare Proxy
USE_CLOUDFLARE_PROXY=true
CLOUDFLARE_PROXY_URL=https://nvoice-ai-proxy.progefa.workers.dev/
```

### 4.2. AI Thresholds
| Threshold | Giá trị | Mô tả |
|-----------|---------|-------|
| AI_CONFIDENCE_AUTO_POSTED | 95 | Tự động ghi sổ nếu confidence >= 95% |
| AI_CONFIDENCE_HUMAN_REVIEW | 80 | Cần duyệt thủ công nếu confidence >= 80% |
| AI_AMOUNT_AUTO_POSTED_MAX | 5,000,000 | Số tiền tối đa auto-post |
| AI_AMOUNT_HUMAN_REVIEW_MAX | 50,000,000 | Số tiền tối đa human review |

### 4.3. AI Service Health
```bash
# Kiểm tra AI pool status
curl http://localhost:5000/api/ai/health

# Kiểm tra Python AI service
curl http://localhost:8000/health
```

---

## 5. Audit Logs

### 5.1. Xem Audit Logs
1. Vào **Quản trị** → **Audit Logs**
2. Lọc theo:
   - **Người dùng**
   - **Hành động**: CREATE, UPDATE, DELETE, LOGIN
   - **Loại đối tượng**: VOUCHERS, USERS, PARTNERS,...
   - **Khoảng thời gian**

### 5.2. Audit Log Format
```json
{
  "user_id": 1,
  "action": "CREATE",
  "entity_type": "VOUCHERS",
  "old_values": null,
  "new_values": { "voucher_number": "PT-2026-001" },
  "ip_address": "192.168.1.1",
  "company_id": 1,
  "created_at": "2026-07-23T08:00:00Z"
}
```

---

## 6. Monitoring

### 6.1. Health Checks
```bash
# Backend health
GET /api/health
# Response: {"status":"ok","isDatabaseReady":true}

# Worker health
GET /api/health/workers
# Response: {"orderIngestionWorker":"running","redis":"ready"}

# AI Service health
GET /health
# Response: {"status":"ok"}
```

### 6.2. Metrics cần theo dõi
- **API Response Time**: Trung bình < 200ms
- **Error Rate**: < 1%
- **AI Success Rate**: > 90%
- **Database Connections**: < 80% pool
- **Redis Memory**: < 70%

---

## 7. Backup & Restore

### 7.1. Database Backup
Railway tự động backup hàng ngày. Backup thủ công:
```bash
# Export
pg_dump -U postgres ketoan_db > backup_20260723.sql

# Restore
psql -U postgres ketoan_db < backup_20260723.sql
```

### 7.2. .env Backup
Lưu trữ file `.env` an toàn (không commit lên Git):
- Backend: `backend/.env`
- AI Service: `ai-service/.env`
- Frontend: `front-end/.env.production`
- Storefront: `storefront/.env`

---

## 8. Xử lý Sự cố

### 8.1. Backend Crash
```bash
# Kiểm tra logs
journalctl -u backend -n 100

# Restart
pm2 restart ketoan-backend

# Kiểm tra memory
pm2 monit
```

### 8.2. Database Full
```bash
# Kiểm tra dung lượng
SELECT pg_size_pretty(pg_database_size('ketoan_db'));

# Xóa dữ liệu cũ (event_store)
DELETE FROM event_store WHERE created_at < NOW() - INTERVAL '90 days';

# Vacuum
VACUUM ANALYZE;
```

### 8.3. Redis Full
```bash
# Kiểm tra memory
INFO memory

# Xóa cache cũ
redis-cli FLUSHDB

# Cấu hình maxmemory
redis-cli CONFIG SET maxmemory 256mb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

---

## 9. Security Configuration

### 9.1. CORS
Cấu hình trong `backend/.env`:
```bash
FRONTEND_URL=https://ketoanonline.up.railway.app,https://banhang.up.railway.app
```

### 9.2. Rate Limiting
| Endpoint | Limit | Window |
|----------|-------|--------|
| Auth | 20 requests | 15 phút |
| General | 100 requests | 1 phút |
| AI | 30 requests | 1 phút |

### 9.3. Firewall (WAF)
WAF middleware tự động chặn:
- SQL injection patterns
- XSS attacks
- Path traversal
- Known malicious IPs

---

## 10. Upgrade & Maintenance

### 10.1. Update Backend
```bash
cd backend
git pull
npm install
pm2 restart ketoan-backend
```

### 10.2. Database Migration
Migration files trong `backend/migrations/` tự động chạy khi server khởi động.
Thêm migration mới: tạo file `.sql` trong thư mục `migrations/`.

### 10.3. Scheduled Maintenance
| Task | Frequency | Description |
|------|-----------|-------------|
| DB Cleanup | Daily | Xóa push subscriptions hết hạn |
| Cache Refresh | Hourly | Refresh report cache |
| AI Model Training | Weekly | Fine-tune từ HITL logs |
| Backup | Daily | Database backup (Railway auto) |