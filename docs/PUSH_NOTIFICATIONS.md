# Web Push Notification Setup

## Overview
Hệ thống Web Push Notification cho phép gửi thông báo real-time đến người dùng ngay cả khi họ không mở ứng dụng.

## Architecture
```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   Browser   │─────▶│ Service      │─────▶│  Push Service   │
│  (Frontend) │      │ Worker       │      │  (FCM/APNs)     │
└─────────────┘      └──────────────┘      └─────────────────┘
        │                     ▲                       │
        │                     │                       │
        ▼                     │                       ▼
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│  Permission │      │   Backend    │      │   Database      │
│   Banner    │─────▶│   API        │─────▶│  - notifications │
│  (User tap) │      │  /api/notif  │      │  - push_subs     │
└─────────────┘      └──────────────┘      └─────────────────┘
```

## 1. Generate VAPID Keys

VAPID (Voluntary Application Server Identification) là cơ chế xác thực server gửi push notification.

```bash
cd backend
npx web-push generate-vapid-keys
```

Output sẽ có dạng:
```
VAPID_PUBLIC_KEY=BC_...
VAPID_PRIVATE_KEY=...
```

## 2. Configure Environment Variables

### Backend (.env)
```env
# VAPID Keys (từ bước 1)
VAPID_PUBLIC_KEY=BC_...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@ketoan-erp.com

# Hoặc dùng email thực tế
VAPID_SUBJECT=mailto:your-email@company.com
```

### Frontend (front-end/.env)
```env
VITE_VAPID_PUBLIC_KEY=BC_...
```

## 3. Install Dependencies

Backend dependencies đã được cài đặt:
```bash
cd backend
npm install web-push
```

## 4. Database Schema

Bảng `push_subscriptions` đã được thêm vào `backend/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_company ON push_subscriptions(company_id);
```

## 5. API Endpoints

### POST /api/notifications/subscribe
Đăng ký nhận push notifications

**Request:**
```json
{
  "endpoint": "https://fcm.googleapis.com/...",
  "p256dh": "base64-encoded-key",
  "auth": "base64-encoded-key",
  "companyId": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Đăng ký nhận thông báo thành công"
}
```

### POST /api/notifications/unsubscribe
Hủy đăng ký

**Request:**
```json
{
  "endpoint": "https://fcm.googleapis.com/..."
}
```

### GET /api/notifications
Lấy danh sách thông báo

**Query Parameters:**
- `company_id` (required): ID công ty
- `page` (optional): Số trang (mặc định: 1)
- `limit` (optional): Số items mỗi trang (mặc định: 20)

### PUT /api/notifications/:id/read
Đánh dấu thông báo đã đọc

### POST /api/notifications/send
Gửi thông báo (chỉ admin)

**Request:**
```json
{
  "title": "Tiêu đề thông báo",
  "message": "Nội dung thông báo",
  "type": "order|logistics|closing",
  "recipientRole": "nv_banhang|ktt|nv_kho",
  "companyId": 1
}
```

## 6. Frontend Integration

### Sử dụng NotificationBell Component

```jsx
import NotificationBell from './components/NotificationBell';

function App() {
  return (
    <div className="app">
      <Header>
        <NotificationBell companyId={1} />
      </Header>
    </div>
  );
}
```

### Sử dụng usePushNotification Hook

```jsx
import { usePushNotification } from './hooks/usePushNotification';

function Settings() {
  const { 
    isSupported, 
    permission, 
    requestPermission, 
    subscribe, 
    unsubscribe 
  } = usePushNotification();

  const handleEnable = async () => {
    const result = await requestPermission();
    if (result.success) {
      await subscribe(companyId);
    }
  };

  return (
    <div>
      {isSupported && permission === 'default' && (
        <button onClick={handleEnable}>
          Bật thông báo
        </button>
      )}
    </div>
  );
}
```

## 7. Business Logic Integration

Hệ thống tự động gửi thông báo trong các trường hợp:

### Order Creation (publicRoutes.js)
- **Trigger**: Tạo đơn hàng mới từ storefront
- **Recipient**: `nv_banhang` (nhân viên bán hàng)
- **Message**: `Đơn hàng {voucherNumber} vừa được tạo`

### Logistics Status Changes (logisticsRoutes.js)
- **Triggers**: 
  - `assign-truck`: Phân xe vận chuyển
  - `confirm-loaded`: Xác nhận đã bốc hàng
  - `mark-completed`: Hoàn thành xuất kho
- **Recipient**: Người tạo đơn hàng (created_by)
- **Message**: Cập nhật trạng thái đơn hàng

### Closing Workflow (closing.controller.js)
- **Trigger**: Kết chuyển sổ thành công
- **Recipient**: `ktt` (kế toán trưởng)
- **Message**: `Kết chuyển tháng {month}/{year} đã hoàn tất`

## 8. Testing Locally

### Yêu cầu
- HTTPS hoặc localhost (browser chỉ cho phép push notification trên secure contexts)
- Service Worker phải được serve từ cùng domain

### Test với ngrok
```bash
# Expose local server
ngrok http 5000

# Thêm URL ngrok vào FRONTEND_URL
export FRONTEND_URL=https://xxxx.ngrok.io
```

### Test Flow
1. Mở browser console để xem logs
2. Click vào icon thông báo (🔔)
3. Click "Bật thông báo"
4. Cho phép quyền notification
5. Tạo đơn hàng test → Kiểm tra notification

## 9. Deploy to Production

### Checklist
- [ ] HTTPS đã được enable
- [ ] VAPID keys đã được generate và thêm vào .env
- [ ] `VAPID_SUBJECT` đã được cập nhật thành email thực tế
- [ ] Frontend đã được build và deploy
- [ ] Service Worker file (`/sw.js`) đã được serve đúng cách
- [ ] Test trên iOS Safari (yêu cầu PWA)

### iOS Safari Requirements
- iOS 16.4+
- App phải được add vào Home Screen (PWA)
- User phải chọn "Allow Notifications"

## 10. Troubleshooting

### "Service Worker registration failed"
- Kiểm tra HTTPS/localhost
- Kiểm tra file `/sw.js` có tồn tại không
- Xem browser console để biết chi tiết lỗi

### "Push subscription failed"
- Kiểm tra VAPID_PUBLIC_KEY đã được cấu hình đúng
- Kiểm tra browser hỗ trợ Push API

### "Notification không hiển thị"
- Kiểm tra Notification.permission === 'granted'
- Kiểm tra Service Worker đã được register
- Xem tab Application → Service Workers trong DevTools

### "Backend không gửi được push"
- Kiểm tra VAPID_PRIVATE_KEY đúng
- Kiểm tra web-push library đã install
- Xem backend logs để biết lỗi chi tiết

## 11. Security Considerations

1. **VAPID Keys**: Không commit VAPID keys vào git
2. **Authentication**: Tất cả endpoints đều yêu cầu JWT token
3. **Rate Limiting**: Cân nhắc thêm rate limiting cho `/api/notifications/subscribe`
4. **Data Privacy**: Chỉ lưu trữ thông tin subscription cần thiết

## 12. Performance

- Push notifications được gửi non-blocking (fire-and-forget)
- Không ảnh hưởng đến business logic chính
- Failed notifications được log nhưng không throw error
- Database cleanup function tự động xóa subscriptions cũ (90 days)

## 13. Monitoring

### Metrics to Track
- Số lượng subscriptions đang active
- Tỷ lệ thành công/thất bại của push notifications
- Thời gian trung bình gửi notification
- Số lượng notifications đã gửi theo loại

### Logs
```javascript
// Backend logs
console.log('[Push] Service Worker registered');
console.warn('Push notification failed:', err);
console.warn('Notification failed:', err.message);
```

## 14. Future Improvements

- [ ] Thêm notification preferences cho users
- [ ] Hỗ trợ rich notifications (images, buttons)
- [ ] Notification history với pagination
- [ ] Email fallback nếu push notification fail
- [ ] SMS notification cho critical alerts
- [ ] Analytics dashboard cho notifications