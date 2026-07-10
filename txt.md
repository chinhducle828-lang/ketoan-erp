# 📊 CHUỖI WORKFLOW CỦA DỰ ÁN ERP KẾ TOÁN

## 🎯 TỔNG QUAN KIẾN TRÚC

Dự án sử dụng **Event-Driven Architecture** với **Realtime Sync** giữa Frontend và Backend thông qua WebSocket.

---

## 🔄 WORKFLOW CHÍNH (7 LUỒNG CHÍNH)

### **1. VOUCHER WORKFLOW (Chứng từ kế toán)**

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND                                                       │
│  User click "Tạo Chứng Từ"                                      │
│       ↓                                                         │
│  handleSubmit() → validate double-entry (Nợ = Có)              │
│       ↓                                                         │
│  createNewVoucher(payload)                                      │
│       ↓                                                         │
│  api.post('/vouchers', data)                                    │
└─────────────────────────────────────────────────────────────────┘
                    ↓ ↓ ↓ WebSocket ↓ ↓ ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND                                                         │
│  POST /api/vouchers                                             │
│       ↓                                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ TRANSACTION (BEGIN)                                       │  │
│  │  1. Validate data                                        │  │
│  │  2. Check lock date                                      │  │
│  │  3. Check opening balance                                │  │
│  │  4. INSERT INTO vouchers (master)                        │  │
│  │  5. INSERT INTO voucher_details (details)                │  │
│  │  6. Audit log (logAction)                                │  │
│  │  7. COMMIT                                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│       ↓                                                         │
│  emitVoucherRealtime('created', {                               │
│    companyId, voucherId, type, posted, userId, clientInstanceId │
│  })                                                             │
│       ↓                                                         │
│  publishToCompany(companyId, 'voucher:created', payload)        │
│       ↓                                                         │
│  io.to(`company:${companyId}`).emit('voucher:created', data)    │
└─────────────────────────────────────────────────────────────────┘
                    ↓ ↓ ↓ WebSocket ↓ ↓ ↓
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (All views in same company)                           │
│  Socket.on('voucher:created') → ws.emit('voucher:created')     │
│       ↓                                                         │
│  useRealTimeSync:                                               │
│    - Filter self-events (ignoreSelfEvents)                      │
│    - Rate limit (max 30/5s, min 80ms)                          │
│       ↓                                                         │
│  useRealtimeInvalidation:                                       │
│    - invalidateKeys(['vouchers', 'inventory', 'dashboard'])     │
│    - Debounce 250ms                                             │
│       ↓                                                         │
│  Refresher Functions:                                           │
│    - VoucherManagement: reloadVouchers()                        │
│    - InventoryManagement: loadBalances()                        │
│    - CashFlowDashboard: loadCashFlow()                          │
│    - IncomeStatement: fetchVouchers()                           │
│       ↓                                                         │
│  UI AUTO-UPDATE ✅                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

### **2. CLOSING WORKFLOW (Kết chuyển sổ cuối kỳ)**

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (ClosingProcess.jsx)                                  │
│  User click "Thực hiện khóa sổ"                                 │
│       ↓                                                         │
│  executeClosing()                                               │
│       ↓                                                         │
│  api.post('/report/closing', { companyId, year })               │
└─────────────────────────────────────────────────────────────────┘
                    ↓ ↓ ↓ WebSocket ↓ ↓ ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND (closing.controller.js)                                 │
│  POST /api/report/closing                                       │
│       ↓                                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ TRANSACTION (SERIALIZABLE)                                │  │
│  │  Step 1: Tính giá vốn kho (BQGQ/FIFO)                   │  │
│  │  Step 2: Phân bổ chi phí logistics                       │  │
│  │  Step 3: Khấu hao TSCĐ                                   │  │
│  │  Step 4: Xử lý thuế VAT                                  │  │
│  │  Step 5: Xử lý thuế TNCN                                │  │
│  │  Step 6: Kết chuyển sổ:                                  │  │
│  │    - 511 → 911 (Doanh thu)                               │  │
│  │    - 632/641/642 → 911 (Chi phí)                         │  │
│  │    - 911 → 421 (Lãi/Lỗ)                                  │  │
│  │    - Tính TNDN lũy tiến → 821/3334                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│       ↓                                                         │
│  Cache invalidation (Redis + RAM)                               │
│       ↓                                                         │
│  Push notification to KTT users                                 │
│       ↓                                                         │
│  emitClosingRealtime({                                           │
│    companyId, month, year, results, source, clientInstanceId    │
│  })                                                             │
│       ↓                                                         │
│  io.to(`company:${companyId}`).emit('closing:completed', data)   │
└─────────────────────────────────────────────────────────────────┘
                    ↓ ↓ ↓ WebSocket ↓ ↓ ↓
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (All relevant views)                                   │
│  Socket.on('closing:completed')                                 │
│       ↓                                                         │
│  useRealtimeInvalidation:                                       │
│    - invalidateKeys(['closing', 'vouchers', 'dashboard'])       │
│       ↓                                                         │
│  Refresher Functions:                                           │
│    - ClosingProcess: closingRealtimeRefresh()                   │
│      → loadBalances() + fetchVouchers()                        │
│    - IncomeStatement: fetchVouchers()                           │
│    - CashFlowDashboard: loadCashFlow()                          │
│       ↓                                                         │
│  UI AUTO-UPDATE ✅                                               │
│  Log: "✓ Đã nhận tín hiệu realtime: kết chuyển hoàn tất"       │
└─────────────────────────────────────────────────────────────────┘
```

---

### **3. PARTNER WORKFLOW (Đối tác KH/NCC)**

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (PartnerManagement.jsx)                               │
│  User tạo đối tác mới                                           │
│       ↓                                                         │
│  handleCreatePartner() → api.post('/partners', data)            │
└─────────────────────────────────────────────────────────────────┘
                    ↓ ↓ ↓ WebSocket ↓ ↓ ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND (partnerController.js)                                  │
│  POST /api/partners/create                                      │
│       ↓                                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. assertCompanyOperational(company_id)                  │  │
│  │ 2. INSERT INTO partners (company_id, partner_code, ...)  │  │
│  │ 3. Audit log (logAction)                                 │  │
│  │ 4. emitPartnerRealtime({...}) ✨ NEW                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                    ↓ ↓ ↓ WebSocket ↓ ↓ ↓
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (PartnerManagement.jsx)                               │
│  Socket.on('partner:updated')                                   │
│       ↓                                                         │
│  onRefresh() → Reload danh sách đối tác                        │
│       ↓                                                         │
│  UI AUTO-UPDATE ✅                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

### **4. INVENTORY WORKFLOW (Kho vật tư)**

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (PurchaseInventory.jsx / InventoryManagement.jsx)     │
│  User nhập kho / xuất kho                                       │
│       ↓                                                         │
│  handlePurchase() → createNewVoucher(payload)                   │
│       ↓                                                         │
│  api.post('/vouchers', data)                                    │
└─────────────────────────────────────────────────────────────────┘
                    ↓ ↓ ↓ WebSocket ↓ ↓ ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND (inventoryController.js)                                │
│  POST /api/inventory/vouchers                                   │
│       ↓                                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. INSERT INTO inventory_vouchers (master)               │  │
│  │ 2. INSERT INTO inventory_voucher_details (details)       │  │
│  │ 3. COMMIT                                                │  │
│  │ 4. emitInventoryRealtime({...}) ✨ NEW                   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                    ↓ ↓ ↓ WebSocket ↓ ↓ ↓
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (InventoryManagement.jsx)                             │
│  Socket.on('inventory:updated')                                 │
│       ↓                                                         │
│  loadBalances() → Tải lại số liệu tồn kho                      │
│       ↓                                                         │
│  UI AUTO-UPDATE ✅                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ KIẾN TRÚC HỆ THỐNG

### **A. FRONTEND ARCHITECTURE**

```
┌─────────────────────────────────────────────────────────────────┐
│ REACT COMPONENTS (Views)                                        │
│  - VoucherManagement                                            │
│  - InventoryManagement                                          │
│  - CashManagement                                               │
│  - PurchaseInventory                                            │
│  - TaxReporting                                                 │
│  - Payroll                                                      │
│  - ClosingProcess                                               │
│  - IncomeStatement                                              │
│  - CashFlowDashboard                                            │
│  - PartnerManagement                                            │
└─────────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ CUSTOM HOOKS                                                    │
│  - useRealtimeInvalidation()                                    │
│    → Maps events to refresher functions                        │
│    → Debounce + Rate limit                                      │
│                                                                 │
│  - useRealTimeSync()                                            │
│    → Subscribes to WebSocket events                             │
│    → Filters self-events                                        │
│    → Rate limiting                                              │
└─────────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ CONTEXTS                                                        │
│  - VoucherContext (vouchers, createNewVoucher, removeVoucher)   │
│  - AuthContext (activeCompany, fiscalYear)                      │
│  - SocketContext (subscribe, unsubscribe, isConnected)          │
└─────────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ WEBSOCKET SERVICE (websocket.js)                                │
│  - Socket.IO client                                             │
│  - Event bridging (legacy + new naming)                         │
│  - Auto-reconnect                                               │
└─────────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ WEBSOCKET BASE (websocket-base.js)                              │
│  - Connection management                                        │
│  - Event listener management                                    │
│  - Client instance ID (for self-event filtering)                │
└─────────────────────────────────────────────────────────────────┘
```

### **B. BACKEND ARCHITECTURE**

```
┌─────────────────────────────────────────────────────────────────┐
│ ROUTES (backend/routes/)                                        │
│  - vouchers.js                                                  │
│  - export.js (11 endpoints)                                     │
│  - import.js (4 endpoints)                                      │
│  - partnerRoute.js                                              │
│  - inventoryRoutes.js                                           │
│  - report.js                                                    │
└─────────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ CONTROLLERS (backend/controllers/)                              │
│  - vouchers.controller.js                                       │
│  - partnerController.js                                         │
│  - inventoryController.js                                       │
│  - closing.controller.js                                        │
│  - report.controller.js                                         │
│                                                                 │
│  Responsibilities:                                              │
│  - Request validation                                           │
│  - Business logic orchestration                                 │
│  - Transaction management                                       │
│  - Audit logging                                                │
│  - Event emission                                               │
└─────────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ SERVICES (backend/services/)                                    │
│  - voucherRealtime.service.js (emit events)                     │
│  - websocket.service.js (WebSocket server)                      │
│  - partnerService.js (DB operations)                            │
│  - closing.service.js (6-step closing workflow)                 │
│  - inventory.service.js (costing, allocation)                   │
│  - auditLog.service.js (logging)                                │
└─────────────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────┐
│ DATABASE LAYER                                                  │
│  - PostgreSQL (main database)                                   │
│  - Redis (cache + WebSocket adapter)                            │
│                                                                 │
│  Tables:                                                        │
│  - vouchers, voucher_details                                    │
│  - inventory_vouchers, inventory_voucher_details                │
│  - partners                                                     │
│  - opening_balances                                             │
│  - items                                                        │
│  - users, user_companies, companies                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔐 SECURITY & MULTI-TENANT

### **Authentication Flow:**
```
User Login
    ↓
JWT Token (with company_id, role, userId)
    ↓
Request Header: Authorization: Bearer <token>
    ↓
authMiddleware: Verify token, extract req.user
    ↓
checkCompanyAccess: Verify user can access company
    ↓
Controller: Use req.user.company_id (NEVER trust client)
```

### **Multi-Tenant Isolation:**
```javascript
// EVERY query includes company_id filter
SELECT * FROM vouchers WHERE company_id = $1
SELECT * FROM partners WHERE company_id = $1
SELECT * FROM items WHERE company_id = $1

// WebSocket: Join company room
socket.join(`company:${companyId}`)
io.to(`company:${companyId}`).emit(event, data)

// Events scoped to company
emitVoucherRealtime('created', { companyId, ... })
```

---

## 📊 EVENT MATRIX

| Event | Source | Target Views | Trigger | Payload |
|-------|--------|--------------|---------|---------|
| `voucher:created` | vouchers.controller | All views | POST /api/vouchers | companyId, voucherId, type, posted |
| `voucher:posted` | vouchers.controller | Vouchers, Inventory, Dashboard | POST /api/vouchers/:id/post | companyId, voucherId, postedBy |
| `voucher:updated` | vouchers.controller | All views | PUT /api/vouchers/:id | companyId, voucherId |
| `voucher:deleted` | vouchers.controller | All views | DELETE /api/vouchers/:id | companyId, voucherId |
| `closing:completed` | closing.controller | Reports, Dashboard, Vouchers | POST /api/report/closing | companyId, month, year, results |
| `inventory:updated` | inventoryController | Inventory, Dashboard, Purchasing | POST /api/inventory/vouchers | companyId, inventoryVoucherId, io_type |
| `partner:updated` | partnerController | Partners, Dashboard | POST /api/partners/create | companyId, partnerId, action |

---

## 🎯 KEY FEATURES

### **1. Realtime Sync:**
- ✅ WebSocket (Socket.IO) + Redis Adapter
- ✅ Multi-server support
- ✅ Self-event filtering
- ✅ Rate limiting (max 30/5s)
- ✅ Debounce (250ms)
- ✅ Min interval (80ms)

### **2. Business Logic:**
- ✅ Double-entry validation (Nợ = Có)
- ✅ Lock date checking
- ✅ Opening balance validation
- ✅ Multi-currency support
- ✅ Progressive tax calculation
- ✅ Inventory costing (BQGQ/FIFO)
- ✅ 6-step closing workflow

### **3. Security:**
- ✅ JWT Authentication
- ✅ Role-based access (admin, ktt, nv, gd_kinhdoanh)
- ✅ Multi-tenant isolation
- ✅ Audit logging
- ✅ Company access control

### **4. Excel Integration:**
- ✅ 11 export endpoints
- ✅ 4 import endpoints
- ✅ Template download
- ✅ Row-level error reporting
- ✅ Cache invalidation

---

## ✅ KẾT LUẬN

### **Chuỗi workflow hoạt động theo mô hình:**

```
USER ACTION → API CALL → BUSINESS LOGIC → DATABASE → EVENT EMIT → 
WEBSOCKET → FRONTEND SYNC → UI UPDATE
```

### **Đặc điểm:**
1. **Event-Driven**: Mọi thay đổi đều emit event
2. **Realtime**: Tất cả views tự động cập nhật
3. **Multi-tenant**: Cô lập dữ liệu theo company_id
4. **Secure**: Authentication + Authorization + Audit log
5. **Scalable**: Redis adapter cho multi-server
6. **Resilient**: Transaction safety, rollback, error handling

**Hệ thống đã hoàn toàn đồng bộ và sẵn sàng production** 🚀