# AI Tự Sửa Chính Mình (Self-Improving AI)

## Tổng quan

Hệ thống AI tự sửa chính mình là cơ chế cho phép AI tự cải thiện độ chính xác thông qua:
- **Circuit Breaker**: Phòng ngừa infinite loop khi AI gặp lỗi
- **Version Control**: Theo dõi các phiên bản model AI
- **Rollback Mechanism**: Khôi phục lại trạng thái trước khi tự sửa
- **HITL Integration**: Kết hợp với hệ thống Human-In-The-Loop

## Kiến trúc

```
┌─────────────────┐
│  AI Proposal     │
│  (confidence < 95%)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│  Circuit        │────▶│  is_open?        │
│  Breaker        │     │  (1h timeout)    │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         │                       ▼
         │             ┌─────────────────┐
         │             │  Stop self-fix  │
         │             └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│  Check attempts   │────▶│  >= 3?          │
│  (max 3)        │     │  → EXPERT_AUDIT │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Call Python    │
│  /api/self-fix  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Update         │
│  ai_hitl_logs   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│  New confidence   │────▶│  >= 95%?         │
│  >= 95%?        │     └────────┬─────────┘
└─────────────────┘              │
                                 ▼
         ┌─────────────────────────┴─────────────────────────┐
         │                                                   │
         ▼                                                   ▼
┌─────────────────┐                               ┌─────────────────┐
│  AUTO_POSTED    │                               │  HUMAN_REVIEW   │
│  (Success)      │                               │  (Continue)     │
└─────────────────┘                               └─────────────────┘
```

## API Endpoints

### 1. Thử tự sửa AI

```
POST /api/hitl/self-fix
Content-Type: application/json

{
  "voucher_id": 123,
  "company_id": 1
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "confidence": 92,
    "changes": ["Sửa mã tài khoản", "Cập nhật số tiền"],
    "canAutoPost": false,
    "fixHistory": [...]
  }
}
```

### 2. Lấy thống kê tự sửa

```
GET /api/hitl/self-fix/stats?company_id=1
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalVouchers": 100,
    "selfFixedCount": 25,
    "avgAttempts": 1.2,
    "maxAttemptsReached": 3,
    "successRate": 25.0
  }
}
```

### 3. Rollback tự sửa

```
POST /api/hitl/self-fix/rollback
Content-Type: application/json

{
  "voucher_id": 123,
  "company_id": 1
}
```

## Cấu hình môi trường (.env)

```bash
# Python AI Service URL
PYTHON_AI_SERVICE_URL=http://localhost:8000

# Confidence thresholds
AI_CONFIDENCE_AUTO_POSTED=95
AI_CONFIDENCE_HUMAN_REVIEW=80

# Amount thresholds (VND)
AI_AMOUNT_AUTO_POSTED_MAX=5000000
AI_AMOUNT_HUMAN_REVIEW_MAX=50000000
```

## Cơ chế bảo vệ

### 1. Circuit Breaker
- Tự động mở khi có lỗi API
- Timeout 1 giờ
- Tự động đóng khi AI cải thiện đáng kể (>10 điểm)

### 2. Giới hạn số lần tự sửa
- Tối đa 3 lần tự sửa cho mỗi voucher
- Sau 3 lần sẽ chuyển sang EXPERT_AUDIT

### 3. Version Control
- Mỗi lần tự sửa ghi lại model version
- Lưu lịch sử các thay đổi
- Cho phép rollback về bất kỳ version nào

## Database Schema

### Bảng ai_hitl_logs (cập nhật)
```sql
ALTER TABLE ai_hitl_logs 
ADD COLUMN self_fix_attempts INTEGER DEFAULT 0,
ADD COLUMN ai_model_version VARCHAR(20) DEFAULT 'v1.0',
ADD COLUMN ai_fix_history JSONB DEFAULT '[]',
ADD COLUMN is_self_fixed BOOLEAN DEFAULT FALSE,
ADD COLUMN last_self_fix_at TIMESTAMP;
```

### Bảng ai_model_versions (mới)
```sql
CREATE TABLE ai_model_versions (
  id SERIAL PRIMARY KEY,
  model_name VARCHAR(50) NOT NULL,
  version VARCHAR(20) NOT NULL,
  accuracy_score NUMERIC(5,2) DEFAULT 0,
  training_data_count INTEGER DEFAULT 0,
  deployed_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);
```

### Bảng ai_circuit_breaker (mới)
```sql
CREATE TABLE ai_circuit_breaker (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  model_name VARCHAR(50) NOT NULL,
  failure_count INTEGER DEFAULT 0,
  last_failure_at TIMESTAMP DEFAULT NOW(),
  is_open BOOLEAN DEFAULT FALSE,
  opened_at TIMESTAMP DEFAULT NULL
);
```

## Luồng hoạt động chi tiết

### Bước 1: AI OCR tạo đề xuất
1. Người dùng tải lên hóa đơn
2. AI OCR xử lý và tạo đề xuất
3. Confidence score được tính tự động

### Bước 2: Xác định trạng thái
- Confidence >= 95% + số tiền < 5 triệu → AUTO_POSTED
- Confidence 80-94% hoặc số tiền 5-50 triệu → HUMAN_REVIEW
- Confidence < 80% hoặc số tiền >= 50 triệu → EXPERT_AUDIT

### Bước 3: Tự sửa (nếu HUMAN_REVIEW)
1. Kiểm tra circuit breaker
2. Kiểm tra số lần tự sửa còn lại
3. Gọi Python AI service `/api/self-fix`
4. Cập nhật kết quả vào database
5. Nếu cải thiện > 10 điểm, đóng circuit breaker

### Bước 4: RLHF Training
1. Cronjob chạy hàng ngày
2. Thu thập dữ liệu từ `ai_hitl_logs`
3. Gửi tới Python AI service `/api/fine-tune`
4. Model được cập nhật và triển khai mới

## Lưu ý quan trọng

1. **Chỉ áp dụng cho HUMAN_REVIEW**: AI tự sửa chỉ khi voucher ở trạng thái cần kiểm duyệt
2. **Không tự sửa vô hạn**: Giới hạn 3 lần để tránh infinite loop
3. **Circuit breaker tự động**: Hệ thống tự dừng khi có lỗi liên tiếp
4. **Có thể rollback**: Admin có thể khôi phục lại trạng thái trước
5. **Log đầy đủ**: Mọi thao tác đều được ghi lại để audit