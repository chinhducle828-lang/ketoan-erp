# BÁO CÁO PHÂN TÍCH FRONTEND & STOREFRONT - KETOAN ERP

> **Tài liệu:** Phân tích chi tiết UI/UX và Logic nghiệp vụ  
> **Ngày tạo:** 05/07/2026  
> **Trạng thái:** Đang tiến hành

---

## PHẦN 1: TỔNG QUAN HỆ THỐNG

### 1.1. Kiến trúc dự án
```
front-end/
├── src/
│   ├── App.jsx                    # Router chính, layout tổng thể
│   ├── main.jsx                   # Entry point
│   ├── index.css                  # Global styles
│   ├── components/                # UI Components
│   │   ├── Header.jsx             # Header với company switcher, notification bell
│   │   ├── Sidebar.jsx            # Navigation menu
│   │   ├── NotificationBell.jsx   # Thông báo real-time + push
│   │   ├── CompanyRouteWrapper.jsx # Route guard
│   │   ├── ExportExcelButton.jsx  # Xuất Excel
│   │   ├── ImportExcelButton.jsx  # Nhập Excel
│   │   ├── ResponsiveContainer.jsx
│   │   ├── VirtualTable.jsx
│   │   └── VoucherList.jsx
│   ├── context/
│   │   ├── AuthContext.jsx        # Auth state management
│   │   └── VoucherContext.jsx     # Voucher state management
│   ├── hooks/
│   │   ├── useRealTime.js         # WebSocket hook ERP
│   │   ├── useRealTime-base.js      # Base hook chung
│   │   └── usePushNotification.js   # Push notification hook
│   ├── services/
│   │   ├── websocket.js           # WebSocket singleton ERP
│   │   └── websocket-base.js      # Base WebSocket class
│   ├── views/
│   │   ├── index.js               # Module registration
│   │   ├── auth/                  # Auth views
│   │   ├── admin/                 # Admin views
│   │   ├── cash/                  # Quỹ tiền
│   │   ├── closing/               # Kết chuyển
│   │   ├── costs/                 # Chi phí
│   │   ├── dashboard/             # Dashboard
│   │   ├── ERP/                   # ERP dashboard
│   │   ├── financial/             # Báo cáo tài chính
│   │   ├── hr/                    # Tính lương
│   │   ├── inventory/             # Quản lý kho
│   │   ├── logistics/             # Logistics
│   │   ├── purchasing/            # Mua hàng
│   │   ├── reports/               # Báo cáo
│   │   ├── sales/                 # Bán hàng
│       └── tax/                   # Thuế
│   └── utils/
│       ├── api.js                 # Axios instance
│       ├── persistence.js         # LocalStorage helper
│       ├── accountingEngine.js    # Logic kế toán
│       └── constants.js
└── public/
    └── sw.js                      # Service Worker (push notification)
```

---

## PHẦN 2: PHÂN TÍCH AUTHENTICATION FLOW

### 2.1. Login.jsx - Quy trình đăng nhập

**Logic chính:**
- Sử dụng `usePersistentState` để lưu form đăng nhập
- Hỗ trợ 3 lựa chọn sau đăng nhập:
  1. `erp` - Về ERP (mặc định)
  2. `storefront_newtab` - Mở storefront tab mới
  3. `storefront_replace` - Chuyển hướng storefront

**Flow đăng nhập:**
```
1. User nhập username/password
2. Gọi API /auth/login
3. Nhận accessToken + user info
4. Kiểm tra hasErpAccess (dựa vào MODULES_REGISTER)
5. Xử lý redirect dựa trên preference
```

**Cơ chế bảo mật:**
- Token lưu trong localStorage
- HttpOnly cookie cho refresh token
- Interceptor tự động thêm Authorization header

### 2.2. StorefrontAccessNotice.jsx - Xử lý role storefront

**Logic:**
- Kiểm tra `skipAutoRedirect` prop
- Tự động chuyển hướng nếu role chỉ dùng storefront
- Hỗ trợ URL từ env hoặc query params

**Roles được hỗ trợ:**
- `nv_banhang` - Nhân viên bán hàng
- `nv_kho` - Nhân viên kho
- `guest` - Khách vãng lai

---

## PHẦN 3: PHÂN TÍCH COMPONENTS

### 3.1. Header.jsx - Header tổng thể

**Các phần chính:**
1. **Mobile menu button** - Mở sidebar mobile
2. **Desktop toggle button** - Thu gọn/mở sidebar
3. **Company selector** - Chuyển đổi doanh nghiệp
4. **Fiscal year selector** - Chọn niên độ kế toán
5. **Storefront toggle** - Chuyển đổi ERP/Storefront
6. **User info** - Avatar + tên + role
7. **NotificationBell** - Chỉ hiển thị khi không phải nv_banhang

**Role mapping:**
```
admin → Quản trị tối cao
ktt → Kế toán trưởng
nv_banhang → Nhân viên bán hàng
nv_kho → Nhân viên kho
default → Kế toán viên
```

### 3.2. Sidebar.jsx - Navigation

**Logic lọc module:**
```javascript
const accessibleModules = MODULES_REGISTER.filter(module => {
  // Chặn config/users chỉ cho admin
  if ((module.id === 'config' || module.id === 'users') && userRole !== 'admin') {
    return false;
  }
  
  // Chỉ admin xem audit logs
  if (module.id === 'audit-logs') {
    return user?.role === 'admin' || user?.is_root_admin === true;
  }
  
  // Kiểm tra allowedRoles
  return module.allowedRoles && module.allowedRoles.includes(userRole);
});
```

**Responsive:**
- Desktop: Sidebar cố định, thu gọn được
- Mobile: Overlay sidebar, đóng khi click vào link

### 3.3. NotificationBell.jsx - Hệ thống thông báo

**Tính năng:**
- WebSocket real-time (`notification:new` event)
- Push notification (Web Push API)
- Badge đếm số chưa đọc
- Dropdown danh sách thông báo

**Flow hoạt động:**
```
1. useRealTimeBase(companyId, userId) - Kết nối WS
2. Load notifications từ API
3. Lắng nghe WS event 'notification:new'
4. Hiển thị banner bật thông báo nếu permission = 'default'
```

---

## PHẦN 4: PHÂN TÍCH SERVICES & HOOKS

### 4.1. WebSocket Service

**websocket-base.js - Base class:**
- Singleton pattern
- Auto-reconnect (max 5 attempts)
- Event emitter pattern
- Methods: connect, disconnect, joinCompany, leaveCompany, on, off, emit

**websocket.js - ERP extension:**
- Kế thừa WebSocketBaseService
- Xử lý events: voucherCreated, voucherUpdated, orderStatusChanged, inventoryUpdated, balanceUpdated, notification:new

### 4.2. useRealTime-base.js

**Hook cơ bản:**
- Quản lý connection status
- Tự động join company room
- Hỗ trợ custom event handlers

### 4.3. usePushNotification.js

**Web Push API:**
- Kiểm tra browser support
- Request permission
- Đăng ký service worker
- Subscribe push manager
- Gửi subscription lên backend

---

## PHẦN 5: PHÂN TÍCH CONTEXT

### 5.1. AuthContext.jsx

**State quản lý:**
- user, activeCompany, fiscalYear, companies, users
- isSyncing (loading state)
- hasOpeningBalance (kiểm tra số dư đầu kỳ)

**Methods:**
- login, logout, changePassword
- changeCompany, fetchCompanies, loadUsers
- checkOpeningBalanceStatus

**Init flow:**
```
1. Silent refresh (lấy access token từ cookie)
2. Fetch /auth/me để lấy user info
3. Fetch companies list
4. Restore activeCompany từ localStorage
5. Set isSyncing = false
```

### 5.2. VoucherContext.jsx

**State:**
- vouchers, isSyncing

**Validation - Double Entry:**
```javascript
// Đảm bảo tổng Nợ = tổng Có
if (Math.abs(totalDr - totalCr) > 0.01) {
  return { isValid: false, error: 'Chứng từ mất cân đối...' };
}
```

---

## PHẦN 6: PHÂN TÍCH MODULES

### 6.1. MODULES_REGISTER (views/index.js)

| ID | Tên | Roles | requiresActiveCompany |
|----|-----|-------|----------------------|
| opening | Khai báo số dư đầu kỳ | admin, ktt, gd_kinhdoanh | ✅ |
| cash | Quỹ & Tiền gửi ngân hàng | admin, ktt, nv | ✅ |
| purchasing | Mua hàng & Vật tư nhập kho | admin, ktt, nv | ✅ |
| pos | Bán hàng tại quầy | admin, ktt, nv_banhang | ✅ |
| partners | Danh mục Đối tác | admin, ktt, nv | ✅ |
| sales_excel | Hóa đơn bán hàng Excel | admin, ktt, nv | ✅ |
| assets | Tài sản cố định | admin, ktt, nv | ✅ |
| hr | Tính lương & BHXH | admin, ktt, nv | ✅ |
| costs | Tập hợp chi phí | admin, ktt, gd_kinhdoanh | ✅ |
| tax | Tờ khai báo cáo Thuế | admin, ktt, gd_kinhdoanh | ✅ |
| closing_process | Kết chuyển khóa sổ | admin, ktt, gd_kinhdoanh | ✅ |
| companies | Cấu hình hệ thống | admin | ❌ |
| dashboard | Dashboard dòng tiền | admin, ktt, nv | ✅ |
| vouchers | Quản Lý Chứng Từ | admin, ktt, nv | ✅ |
| inventory | Quản Lý Kho | admin, ktt, nv | ✅ |
| logistics-dashboard | Logistics | admin, ktt, nv | ✅ |
| bai-xuc | Màn Hình Bãi Xúc | admin, ktt, nv | ✅ |
| audit-logs | Nhật Ký An Ninh | admin | ❌ |
| income-statement | Báo Cáo Kết Quả | admin, ktt, gd_kinhdoanh | ✅ |
| balance-sheet | Báo Cáo Tài Chính | admin, ktt, gd_kinhdoanh | ✅ |
| income-statement-b02 | Báo Cáo Kết Quả B02 | admin, ktt, gd_kinhdoanh | ✅ |
| cash-flow | Báo Cáo Lưu Chuyển Tiền Tệ | admin, ktt, gd_kinhdoanh | ✅ |
| financial-notes | Bản Thuyết Minh BCTC | admin, ktt, gd_kinhdoanh | ✅ |

---

## PHẦN 7: PHÂN TÍCH UI/UX PATTERNS

### 7.1. Design System

**Colors:**
- Primary: emerald-500/600 (actions)
- Secondary: slate-50/100/200 (backgrounds)
- Error: rose-500/600
- Warning: amber-500/600
- Success: emerald-50/200

**Typography:**
- Headings: font-black, tracking-tight
- Body: text-sm, text-xs
- Labels: uppercase, tracking-wider

**Components:**
- Buttons: rounded-xl, transition, shadow
- Cards: rounded-2xl, border, shadow-sm
- Tables: divide-y, hover:bg-slate-50/50

### 7.2. Responsive Design

**Breakpoints:**
- Mobile: < 768px (md)
- Desktop: ≥ 768px

**Mobile patterns:**
- Sidebar thành overlay
- Header thành column layout
- Table scroll horizontal

---

## PHẦN 8: VẤN ĐỀ PHÁT HIỆN

### 8.1. NotificationBell.jsx - CSS Classes

**Vấn đề:** Sử dụng class names không tồn tại trong Tailwind CSS:
- `notification-bell` - Không phải utility class
- `bell-button` - Không phải utility class
- `badge` - Không phải utility class
- `notification-dropdown` - Không phải utility class
- `dropdown-header` - Không phải utility class
- `notification-list` - Không phải utility class
- `no-notifications` - Không phải utility class
- `notification-item` - Không phải utility class
- `time` - Không phải utility class
- `enable-push-banner` - Không phải utility class

**Giải pháp:** Cần thêm CSS tùy chỉnh hoặc chuyển sang utility classes.

### 8.2. CashManagement.jsx - API Endpoint

**Vấn đề:** Sử dụng `/api/partners` nhưng api.js đã có baseURL `/api`
- Dư một `/api` trong URL: `/api/partners` → `/partners`

### 8.3. AuthContext.jsx - Missing import

**Vấn đề:** Thiếu `useEffect` import trong useRealTime.js (đã sửa)

---

## PHẦN 9: KẾT LUẬN

### 9.1. Điểm mạnh
- ✅ Kiến trúc rõ ràng, module hóa tốt
- ✅ Role-based access control chặt chẽ
- ✅ WebSocket real-time tích hợp tốt
- ✅ Double-entry validation chắc chắn
- ✅ Responsive design tốt

### 9.2. Cần cải thiện
- ⚠️ NotificationBell cần CSS styling
- ⚠️ Một số API endpoint dư `/api` prefix
- ⚠️ Cần kiểm tra thêm error handling

---

*Tài liệu sẽ được cập nhật khi phân tích thêm các module còn lại.*