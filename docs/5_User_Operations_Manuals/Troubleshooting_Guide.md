# Hướng dẫn Khắc phục Sự cố (Troubleshooting Guide)
## KETOAN ERP - Troubleshooting & Common Issues

**Phiên bản:** 1.0.0  
**Ngày:** 23/07/2026  

---

## 1. Lỗi Đăng nhập

### 1.1. Sai mật khẩu
**Triệu chứng**: "Tên đăng nhập hoặc mật khẩu không đúng"

**Nguyên nhân**: 
- Sai mật khẩu
- Tài khoản bị khóa
- Session hết hạn

**Xử lý**:
1. Nhấn **Quên mật khẩu** (nếu có)
2. Liên hệ Admin để reset mật khẩu
3. Kiểm tra kết nối Internet

### 1.2. Tài khoản bị khóa
**Triệu chứng**: "Tài khoản đã bị khóa"

**Nguyên nhân**: Đăng nhập sai quá 5 lần

**Xử lý**:
1. Đợi 15 phút để tự động mở khóa
2. Liên hệ Admin để mở khóa ngay

---

## 2. Lỗi Chứng từ

### 2.1. Không thể tạo chứng từ
**Triệu chứng**: Lỗi khi nhấn Lưu

**Nguyên nhân thường gặp**:

| Lỗi | Nguyên nhân | Giải pháp |
|-----|-------------|-----------|
| "Tổng Nợ phải bằng tổng Có" | Nhập sai số tiền | Kiểm tra lại tổng Nợ và tổng Có |
| "Tài khoản không tồn tại" | Sai mã tài khoản | Chọn từ danh mục, không gõ tay |
| "Số chứng từ đã tồn tại" | Trùng số | Hệ thống tự động sinh số hoặc thêm hậu tố |
| "Ngày chứng từ không hợp lệ" | Ngày trong quá khứ xa | Chọn ngày trong vòng 1 năm |
| "Không có quyền tạo chứng từ" | Thiếu quyền | Liên hệ Admin phân quyền |

### 2.2. Chứng từ đã ghi sổ không sửa được
**Triệu chứng**: Nút "Sửa" bị ẩn hoặc không hoạt động

**Nguyên nhân**: Chứng từ đã ghi sổ (`is_posted = true`)

**Xử lý**:
1. Tạo **bút toán đảo** để đảo ngược chứng từ cũ
2. Tạo chứng từ mới với thông tin đúng
3. Chỉ Admin/KTT mới có quyền này

### 2.3. Lỗi tính toán số dư
**Triệu chứng**: Số dư tài khoản không đúng

**Nguyên nhân**:
- Chứng từ chưa được ghi sổ
- Cache chưa được refresh
- Lỗi dữ liệu

**Xử lý**:
1. Đảm bảo chứng từ đã được ghi sổ
2. Refresh trang (F5)
3. Chạy lại báo cáo số dư
4. Nếu vẫn sai: Chạy VACUUM ANALYZE

---

## 3. Lỗi AI

### 3.1. AI không trả lời
**Triệu chứng**: "AI Copilot không khả dụng" hoặc request timeout

**Nguyên nhân**:
- Mất kết nối Internet
- AI API key hết hạn
- Rate limit vượt quá
- Cloudflare Proxy lỗi

**Xử lý**:
```bash
# Kiểm tra AI service health
curl http://localhost:8000/health

# Kiểm tra API keys
node backend/test-all-apis.js

# Kiểm tra logs backend
grep "AI" backend/logs/app.log
```

### 3.2. AI trả lời sai
**Triệu chứng**: Kết quả không chính xác

**Nguyên nhân**:
- Câu hỏi không rõ ràng
- Schema không đầy đủ
- AI model chưa được fine-tune

**Xử lý**:
1. Đặt lại câu hỏi rõ ràng hơn
2. Thêm ngữ cảnh (công ty, thời gian)
3. Kiểm tra confidence score
4. Báo cáo lỗi để cải thiện model

### 3.3. OCR không nhận dạng được
**Triệu chứng**: "Không thể đọc hóa đơn"

**Nguyên nhân**:
- Ảnh mờ, thiếu sáng
- Hóa đơn không chuẩn
- File quá lớn

**Xử lý**:
1. Chụp lại ảnh với ánh sáng tốt
2. Đảm bảo hóa đơn rõ ràng
3. Giảm kích thước file (< 5MB)
4. Thử định dạng JPG thay vì PNG

---

## 4. Lỗi Kho

### 4.1. Tồn kho âm
**Triệu chứng**: Số lượng tồn kho < 0

**Nguyên nhân**:
- Xuất kho nhiều hơn nhập
- Sai số lượng kiểm kê
- Import dữ liệu sai

**Xử lý**:
1. Kiểm tra lịch sử nhập/xuất
2. Điều chỉnh bằng **Kiểm kê kho**
3. Nếu do import sai: Tạo phiếu nhập điều chỉnh

### 4.2. Giá vốn sai
**Triệu chứng**: Giá vốn hàng bán không đúng

**Nguyên nhân**:
- Phương pháp tính giá (AVCO/FIFO) chưa đúng
- Thiếu costing layers
- Nhập kho với đơn giá sai

**Xử lý**:
1. Kiểm tra cấu hình phương pháp tính giá
2. Chạy lại costing engine
3. Điều chỉnh thủ công nếu cần

---

## 5. Lỗi Hệ thống

### 5.1. Server 500 Internal Error
**Triệu chứng**: Màn hình trắng, lỗi 500

**Nguyên nhân**:
- Lỗi code
- Database connection fail
- Memory full

**Xử lý** (Admin):
```bash
# Kiểm tra logs
tail -100 backend/logs/error.log

# Kiểm tra database
curl http://localhost:5000/api/health

# Restart service
pm2 restart ketoan-backend
```

### 5.2. Database Connection Lost
**Triệu chứng**: "Kết nối cơ sở dữ liệu thất bại"

**Nguyên nhân**:
- PostgreSQL service down
- Connection pool exhausted
- Network issue

**Xử lý**:
```bash
# Kiểm tra PostgreSQL
pg_isready

# Kiểm tra connection pool
SELECT count(*) FROM pg_stat_activity;

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### 5.3. Redis Connection Error
**Triệu chứng**: Cache không hoạt động

**Nguyên nhân**:
- Redis service down
- Memory full
- Wrong credentials

**Xử lý**:
```bash
# Kiểm tra Redis
redis-cli ping

# Kiểm tra memory
redis-cli INFO memory

# Restart Redis
sudo systemctl restart redis
```

---

## 6. Lỗi API

### 6.1. CORS Error
**Triệu chứng**: "Access-Control-Allow-Origin" error

**Nguyên nhân**: Origin không được phép

**Xử lý**:
1. Kiểm tra `FRONTEND_URL` trong `.env`
2. Thêm origin vào danh sách cho phép
3. Restart backend

### 6.2. Rate Limited
**Triệu chứng**: "Rate limit exceeded"

**Nguyên nhân**: Vượt quá giới hạn request

**Xử lý**:
1. Đợi 1 phút và thử lại
2. Giảm tần suất gọi API
3. Liên hệ Admin để tăng limit

### 6.3. Token Expired
**Triệu chứng**: "Token has expired"

**Nguyên nhân**: Access token hết hạn (15 phút)

**Xử lý**: 
1. Sử dụng refresh token để lấy token mới
2. Đăng nhập lại

---

## 7. Lỗi Hiệu năng

### 7.1. Ứng dụng chậm
**Triệu chứng**: Load lâu, thao tác chậm

**Nguyên nhân**:
- Nhiều dữ liệu
- Cache không hoạt động
- Network chậm

**Xử lý**:
1. Giảm số lượng bản ghi hiển thị/trang
2. Sử dụng filter để giới hạn dữ liệu
3. Kiểm tra kết nối Internet
4. Báo cáo Admin nếu kéo dài

### 7.2. Báo cáo chậm
**Triệu chứng**: Báo cáo mất > 10 giây để load

**Nguyên nhân**:
- Nhiều năm dữ liệu
- Thiếu index
- Cache chưa được warm

**Xử lý**:
1. Giới hạn phạm vi báo cáo (1 năm)
2. Sử dụng cache (báo cáo sẽ nhanh hơn lần 2)
3. Chạy báo cáo vào giờ thấp điểm

---

## 8. Lỗi Triển khai (Deployment)

### 8.1. Build thất bại
**Triệu chứng**: Railway deploy fail

**Nguyên nhân**:
- Lỗi syntax
- Missing dependencies
- Node version mismatch

**Xử lý**:
```bash
# Kiểm tra build locally
npm run build

# Kiểm tra Node version
node -v  # Phải >= 18

# Clear cache và rebuild
rm -rf node_modules
npm install
npm run build
```

### 8.2. Database Migration lỗi
**Triệu chứng**: Server khởi động nhưng DB lỗi

**Nguyên nhân**: Migration conflict

**Xử lý**:
1. Kiểm tra logs migration
2. Rollback migration gần nhất
3. Fix và chạy lại

---

## 9. Liên hệ Hỗ trợ

### 9.1. Kênh hỗ trợ
| Kênh | Thông tin |
|------|-----------|
| **Email** | support@ketoan-erp.com |
| **GitHub Issues** | https://github.com/chinhducle828-lang/ketoan-erp/issues |

### 9.2. Thông tin cần cung cấp khi báo lỗi
1. **Mô tả lỗi**: Ngắn gọn, rõ ràng
2. **Các bước tái hiện**: Chi tiết từng bước
3. **Kết quả mong đợi**: Điều gì nên xảy ra
4. **Kết quả thực tế**: Điều gì đã xảy ra
5. **Môi trường**: Trình duyệt, OS, version
6. **Logs/Screenshots**: Nếu có
7. **Correlation ID**: Từ response header (nếu có)