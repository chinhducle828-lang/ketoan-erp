# Hệ thống Ký số OTP - Tài liệu Kỹ thuật

## Tổng quan

Hệ thống ký số OTP được thiết kế để tuân thủ **Luật 108/2025/QH15** về chữ ký số và audit trail bất biến cho chứng từ kế toán. Hệ thống cung cấp xác thực 2FA (hai yếu tố) cho các chứng từ xuất kho (XK) và phiếu thu (PT) trước khi ghi sổ, đồng thời yêu cầu ký số trước khi phát hành hóa đơn điện tử.

## Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                 │
│  ┌──────────────────────┐    ┌─────────────────────────────┐   │
│  │   OtpSignModal.jsx   │───▶│     api.js (signing APIs)   │   │
│  └──────────────────────┘    └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                   │
│  ┌──────────────────────┐    ┌─────────────────────────────┐   │
│  │    signing.js        │───▶│   signing.service.js        │   │
│  │  (REST API)          │    │   (Business Logic)          │   │
│  └──────────────────────┘    └─────────────────────────────┘   │
│                                  │                            │
│                                  ▼                            │
│  ┌──────────────────────┐    ┌─────────────────────────────┐   │
│  │  signingCheck.js     │    │  otpRouting.service.js      │   │
│  │  (Middleware Guard)  │    │  (Smart Routing)             │   │
│  └──────────────────────┘    └─────────────────────────────┘   │
│                                  │                            │
│                                  ▼                            │
│                    ┌─────────────────────────────┐             │
│                    │   PostgreSQL Database       │             │
│                    │  - otp_signatures table     │             │
│                    │  - vouchers (signing cols)  │             │
│                    │  - e_invoices (signing cols)│             │
│                    └─────────────────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

## 1. Smart Routing - Định tuyến thông minh

### 1.1. Mô hình 3 kênh gửi OTP

| Kênh | Ưu tiên | Chi phí | Tốc độ | Bảo mật | Tiện lợi |
|------|---------|---------|--------|---------|----------|
| Push Notification | 1 | Thấp | < 2s | Cao | Cao |
| SMS | 2 | Trung bình | 3-7s | Trung bình | Cao |
| Email | 3 | Rất thấp | 5-15s | Thấp | Trung bình |

### 1.2. Logic định tuyến

```
[Người dùng bấm "Gửi mã ký số"]
           │
           ▼
┌─────────────────────────────┐
│ Kiểm tra User có Device Token? │
└─────────────────────────────┘
           │
    ┌──────┴──────┐
    │ YES         │ NO
    ▼             ▼
[Push]      ┌─────────────────┐
            │ Kiểm tra User có Phone? │
            └─────────────────┘
                      │
               ┌──────┴──────┐
               │ YES         │ NO
               ▼             ▼
           [SMS]      ┌─────────────────┐
                    │ Kiểm tra User có Email? │
                    └─────────────────┘
                          │
                   ┌──────┴──────┐
                   │ YES         │ NO
                   ▼             ▼
               [Email]      [Lỗi: Không có kênh nào]
```

## 2. API Endpoints

### 2.1. Gửi yêu cầu OTP

```
POST /api/signing/request-otp
Content-Type: application/json
Authorization: Bearer <token>

{
  "voucherId": 123,
  "companyId": 1,
  "documentType": "voucher" // hoặc "e-invoice"
}

Response:
{
  "success": true,
  "message": "Mã OTP đã được gửi qua Push Notification",
  "channel": "PUSH"
}
```

### 2.2. Xác thực OTP và ký số

```
POST /api/signing/verify
Content-Type: application/json
Authorization: Bearer <token>

{
  "voucherId": 123,
  "companyId": 1,
  "otp": "123456",
  "documentType": "voucher"
}

Response:
{
  "success": true,
  "message": "Ký số chứng từ thành công",
  "voucher": {
    "id": 123,
    "sign_status": "signed",
    "signed_at": "2026-07-10T17:30:00.000Z"
  }
}
```

### 2.3. Lấy trạng thái ký số

```
GET /api/signing/status/:voucherId?companyId=1
Authorization: Bearer <token>

Response:
{
  "success": true,
  "status": {
    "sign_status": "signed",
    "signed_by": 5,
    "signed_at": "2026-07-10T17:30:00.000Z",
    "sign_channel": "SMS"
  }
}
```

### 2.4. Hủy yêu cầu ký số

```
POST /api/signing/cancel
Content-Type: application/json
Authorization: Bearer <token>

{
  "voucherId": 123,
  "companyId": 1
}

Response:
{
  "success": true,
  "message": "Đã hủy yêu cầu ký số"
}
```

## 3. Middleware Guard

### 3.1. requireSignedVoucher

Middleware kiểm tra chứng từ cần ký số trước khi ghi sổ:

```javascript
// Áp dụng cho route ghi sổ chứng từ
router.post('/:id/post', authenticate, requireRole(['admin', 'ktt']), requireSignedVoucher, handler);
```

**Áp dụng cho:** Chứng từ loại XK (Xuất kho) và PT (Phiếu thu)

### 3.2. requireSignedEInvoice

Middleware kiểm tra hóa đơn điện tử cần ký số trước khi phát hành:

```javascript
// Áp dụng cho route phát hành hóa đơn
router.post('/issue', authenticate, requireSignedEInvoice, handler);
```

## 4. Cơ sở dữ liệu

### 4.1. Bảng otp_signatures

| Cột | Kiểu | Mô tả |
|-----|------|------|
| id | SERIAL | PK |
| user_id | INT | FK users.id |
| document_id | VARCHAR(50) | ID chứng từ |
| document_type | VARCHAR(20) | 'voucher' hoặc 'e-invoice' |
| otp_hash | TEXT | SHA-256 hash của OTP |
| company_id | INT | Đảm bảo cách ly dữ liệu đa công ty |
| created_at | TIMESTAMP | Thời gian tạo |
| expires_at | TIMESTAMP | Thời gian hết hạn (90s) |
| used_at | TIMESTAMP | Thời gian sử dụng |
| sign_status | VARCHAR(20) | 'pending', 'signed', 'cancelled' |
| sign_channel | VARCHAR(20) | 'PUSH', 'SMS', 'EMAIL' |

### 4.2. Các cột ký số trong vouchers

| Cột | Kiểu | Mô tả |
|-----|------|------|
| sign_status | VARCHAR(20) | 'unsigned' hoặc 'signed' |
| signed_by | INT | FK users.id |
| signed_at | TIMESTAMP | Thời gian ký |
| sign_channel | VARCHAR(20) | Kênh gửi OTP |
| sign_otp_hash | TEXT | Hash OTP đã sử dụng |

## 5. Bảo mật

### 5.1. Hash OTP

- OTP được mã hóa SHA-256 trước khi lưu vào database
- OTP chỉ lưu dưới dạng hash, không lưu dạng plain text
- OTP có thời gian sống 90 giây

### 5.2. Multi-tenant Isolation

- Mỗi OTP đều gắn với company_id
- Kiểm tra quyền truy cập công ty trước khi gửi OTP
- Đảm bảo dữ liệu không bị xuyên thủ nhàn

### 5.3. Audit Trail

- Mọi hành động ký số đều được ghi log
- Bao gồm: REQUEST_SIGNING, SIGN_DOCUMENT, CANCEL_SIGNING, ISSUE_E_INVOICE
- Log chứa thông tin user_id, IP, company_id, thời gian

## 6. Tích hợp Frontend

### 6.1. Sử dụng OtpSignModal

```jsx
import OtpSignModal from '../components/OtpSignModal.jsx';

function VoucherForm() {
  const [showSignModal, setShowSignModal] = useState(false);
  
  const handlePostVoucher = async (voucherId) => {
    // Kiểm tra xem voucher có cần ký số không
    const needsSigning = await checkSigningRequired(voucherId);
    if (needsSigning) {
      setShowSignModal(true);
    }
  };
  
  return (
    <>
      <OtpSignModal
        isOpen={showSignModal}
        onClose={() => setShowSignModal(false)}
        voucherId={selectedVoucherId}
        voucherType="XK"
        onSuccess={handleSignSuccess}
      />
    </>
  );
}
```

### 6.2. API Functions

```javascript
// frontend/src/utils/api.js
export const requestOtpForSigning = async ({ voucherId, companyId, documentType }) => {
  const response = await api.post('/signing/request-otp', { voucherId, companyId, documentType });
  return response.data;
};

export const verifyOtpAndSign = async ({ voucherId, companyId, otp, documentType }) => {
  const response = await api.post('/signing/verify', { voucherId, companyId, otp, documentType });
  return response.data;
};
```

## 7. Luồng xử lý

### 7.1. Luồng ký số chứng từ

```
1. Người dùng tạo chứng từ XK/PT
2. Hệ thống kiểm tra voucher_type
3. Khi ghi sổ, middleware requireSignedVoucher kiểm tra sign_status
4. Nếu chưa ký số → trả lỗi 403 SIGNING_REQUIRED
5. Frontend hiển thị OtpSignModal
6. Người dùng nhập mã OTP
7. Hệ thống xác thực OTP và cập nhật sign_status = 'signed'
8. Cho phép ghi sổ chứng từ
```

### 7.2. Luồng phát hành hóa đơn điện tử

```
1. Người dùng tạo hóa đơn điện tử
2. Hệ thống kiểm tra voucher liên quan (nếu có)
3. Nếu voucher là XK/PT chưa ký số → yêu cầu ký số
4. Sau khi ký số → lưu hóa đơn với sign_status = 'signed'
5. Trả về hóa đơn đã phát hành
```

## 8. Cấu hình môi trường

```env
# .env
# OTP Settings
OTP_EXPIRATION_SECONDS=90
OTP_LENGTH=6

# Push Notification (Firebase)
FCM_SERVER_KEY=your_fcm_server_key

# SMS Provider
SMS_PROVIDER_URL=https://api.sms-provider.com
SMS_PROVIDER_KEY=your_sms_api_key

# Email Provider
EMAIL_PROVIDER=aws_ses
EMAIL_FROM=no-reply@yourcompany.com
```

## 9. Kiểm thử

### 9.1. Unit Tests

```bash
# Chạy test
npm test -- --testPathPattern=otpSigning
```

### 9.2. Test Cases

- [x] Tạo OTP 6 chữ số
- [x] Hash OTP bằng SHA-256
- [x] Lưu OTP vào database
- [x] Xác thực OTP hợp lệ
- [x] Xác thực OTP hết hạn
- [x] Xác thực OTP đã sử dụng
- [x] Smart routing Push → SMS → Email
- [x] Middleware chặn ghi sổ chưa ký số
- [x] Multi-tenant isolation

## 10. Tài liệu tham khảo

- Luật 108/2025/QH15: Về chữ ký số và audit trail
- Nghị định 254/2026/NĐ-CP: Chuẩn dữ liệu hóa đơn điện tử
- SMS OTP Document: Chiến lược smart routing 3 kênh