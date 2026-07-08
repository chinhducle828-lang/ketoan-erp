# TÀI LIỆU WORKFLOW MODULE & MA TRẬN WORKFLOW — KETOAN ERP

> **Mục đích:** Mô tả luồng công việc (end-to-end workflow) của từng module trong dự án Ketoan ERP, kèm ma trận ánh xạ module × tầng kiến trúc và ma trận phân quyền. Tài liệu mang tính tham khảo kiến trúc, **không sửa code, không đổi deploy**.
>
> **Nguồn khảo sát:** `backend/server.js`, `backend/routes/*`, `backend/controllers/*`, `backend/services/*`, `backend/middleware/*`, `backend/workers/*`, `front-end/src/views/index.js`, `front-end/src/constants/modules.js`, `storefront/src/StorefrontPage.jsx`.

---

## 0. TỔNG QUAN KIẾN TRÚC

Hệ thống gồm 3 ứng dụng deploy độc lập trên Railway (Dockerfile):

| Ứng dụng | Vai trò | Entrypoint |
|---|---|---|
| **backend** | REST API + WebSocket + Worker (Node ESM, `node server.js`) | `backend/server.js` |
| **front-end** | SPA kế toán nội bộ (React + Vite) | `front-end/src/main.jsx` |
| **storefront** | Cửa hàng/đặt hàng khách hàng (React + Vite) | `storefront/src/main.jsx` |

**Chuỗi xử lý chung (mọi request API):**
```
Client (front-end/storefront)
  → Express Route (backend/routes/*)
  → Middleware: waf → rateLimiter → authenticate → requireRole/requirePermission
               → validation (zod) → checkCompanyAccess
  → Controller (mỏng: parse + gọi service)
  → Service (business logic)
       ├─ pool.query (PostgreSQL)
       ├─ Worker / BullMQ Queue (async)
       └─ Realtime emit (websocket.service / redis)
  → Response JSON → Socket.io push → Frontend hook (useRealTime*) cập nhật UI
```

---

## PHẦN A — WORKFLOW TỪNG MODULE (END-TO-END)

### A.1. Auth & Session (Xác thực & Phiên)
- **Route:** `POST /api/auth/*` (`routes/auth.js`)
- **Controller:** `auth.js` (login, refresh, logout, SSO callback)
- **Service:** `helpers.js` (token/hash), `sso.service.js` (Auth0/Azure/Google), `sessionPolicy.js`, `tenant.service.js`
- **Middleware:** `authenticate` (JWT + refresh cookie), `requireRole`, `requireRootAdmin`, `checkCompanyAccess`
- **Luồng:**
  1. User gửi credentials → `authenticate` giải mã JWT, validate session qua `sso.service.validateSession`.
  2. `helpers.createRefreshToken` + `hashToken` lưu cookie `refresh_token`.
  3. Mỗi request sau mang cookie → `authenticate` tái tạo context `req.user`, `req.companyId`.
  4. `sessionPolicy.shouldClearExistingSessions(role)` quyết định có ép đăng xuất session cũ không.

### A.2. Companies (Quản lý pháp nhân)
- **Route:** `/api/companies` → `companiesRouter`
- **Service:** `tenant.service.js` (TenantService: getTenantConfig/createTenant/deleteTenant/getTenantStats/validateTenantAccess)
- **Phân quyền:** `requireRole(['admin'])`
- **Luồng:** Admin tạo/sửa công ty → `tenant.service` ghi bảng `companies` (có `lock_date`) → `checkCompanyAccess` dùng để giới hạn dữ liệu theo `companyId`.

### A.3. Vouchers (Chứng từ kế toán — module trung tâm)
- **Route:** `/api/vouchers` (`routes/vouchers.js`), `/api/accounting` (`accountingRouter`)
- **Controller:** `erpController.js` (`getLedgerBalances`, `runInventoryCosting`), `inventoryController.js` (`getInventoryVouchers`, `createInventoryVoucher`), `report.controller.js`
- **Service:** `inventory.service.js` (FIFO, Weighted Average), `closing.service.js`, `summary.service.js`, `voucherStatus.js`, `orderIngestion.service.js`, `balanceCache.service.js`
- **Realtime:** `voucherRealtime.service.js` (`emitVoucherRealtime`, `emitInventoryRealtime`, `emitClosingRealtime`), `voucherStatus.emitVoucherPostingRealtime`
- **Luồng tạo chứng từ:**
  1. Frontend `POST /api/vouchers` → `authenticate` + `validation(zod)` + `checkLockDate` (không cho sửa sau `lock_date`).
  2. Controller gọi `inventory.service.calculateFifoCost` / `calculateWeightedAverageCostForPeriod`.
  3. Ghi `vouchers` + `voucher_details` (PostgreSQL).
  4. `voucherStatus.normalizePostingState` → nếu đã post, `emitVoucherPostingRealtime`.
  5. `balanceCache.invalidateBalance(companyId, year, month)` → `emitVoucherRealtime('created', payload)`.
  6. Frontend `useRealTimeSync`/`useRealtimeInvalidation` nhận event → refresh bảng.

### A.4. Partners (Đối tác KH/NCC)
- **Route:** `/api/partners` (`partnerRoute.js`)
- **Controller:** `partnerController.js` (`createPartner`, `getPartners`)
- **Service:** `partnerService.js` (`createPartnerDB`, `getPartnersByCompanyDB`)
- **Realtime:** `emitPartnerRealtime`
- **Luồng:** CRUD đối tác → `partnerService` ghi DB → emit realtime → danh sách đối tác cập nhật live.

### A.5. Inventory (Kho & Vật tư)
- **Route:** `/api/inventory` (`inventoryRoutes.js`), `/api/items` (`items.js`)
- **Controller:** `inventoryController.js`, `items.js` (quản lý hàng hóa, image URL, Google Drive)
- **Service:** `inventory.service.js`, `logistics.service.js` (`buildOrderNumber`, `calculateTaxAmount`, `buildAccountingEntries`)
- **Worker:** `inventoryWorker.js` (`queueInventoryCosting`) — tính giá tồn kho bất đồng bộ
- **Luồng:** Nhập/xuất kho → controller → `inventory.service` tính giá → `inventoryWorker` chạy costing → `emitInventoryRealtime`.

### A.6. Opening Balances (Số dư đầu kỳ)
- **Route:** `/api/opening-balances` (`openingBalances.js`)
- **Service:** `report.service.js` (`getOpeningBalancesByPartner`), `summary.service.js`
- **Phân quyền:** `admin`, `ktt`
- **Luồng:** Khai báo số dư đầu kỳ theo tài khoản → ghi `vouchers` (loại opening) → `balanceCache.invalidateAllBalances`.

### A.7. Closing (Khóa sổ & Cân đối)
- **Route:** `/api/report` (một phần), `/api/accounting`
- **Controller:** `closing.controller.js` (`previewClosing`, `executeClosing`, `getClosingPreviewData`, `getWorkflowConfig`), `report.controller.js.executeClosing`
- **Service:** `closing.service.js` (`runClosingEntries`, `createAllowanceEntries`, `createDepreciationEntries`, `createProvisionEntries`, `processTaxVAT`, `processTaxTNCN`), `config/closingWorkflow.js`
- **Queue:** `queue.service.addClosingJob` / `createClosingWorker`
- **Luồng:**
  1. KTT chọn kỳ (tháng/năm) → `previewClosing` tính toán dự kiến.
  2. `executeClosing` → `closing.service.runClosingEntries` sinh bút toán kết chuyển (VAT, TNCN, khấu hao, trích lập dự phòng).
  3. Ghi chứng từ khóa sổ → `balanceCache.invalidateBalance` → `emitClosingRealtime`.
  4. Báo cáo tài chính (B01/B02/B03) đọc số liệu đã khóa.

### A.8. Reports & Financial Statements (Báo cáo tài chính)
- **Route:** `/api/report` (`report.js`), `/api/cashflow` (`cashflow.js`)
- **Controller:** `report.controller.js` (`getBalanceSheet`, `getCustomerBalances`, `getSupplierBalances`, `getTaxBalances`, `getAdvanceCustomerBalances`)
- **Service:** `report.service.js` (`getBalanceSheetData`, `getAccountBalance`, `getCustomerAccountBalances`, `getTaxAccountBalances`, `getDepreciationBalance`, `getBiologicalAssetBalance`), `cashFlowEngine.js` (`calculateCashFlowDirect/Indirect`), `financialNotesEngine.js`, `cycle.service.js` (9 chu kỳ báo cáo), `multiCurrency.service.js`
- **Cache:** `balanceCache.service.js`
- **Luồng:** Frontend yêu cầu báo cáo → `report.service` tổng hợp từ `voucher_details` (có thể qua Materialized View) → trả JSON → `invalidateReportCache` khi có biến động.

### A.9. Cashflow & Casso (Lưu chuyển tiền tệ & Ngân hàng)
- **Route:** `/api/cashflow`, `/api/casso` (`casso.js`)
- **Service:** `cashFlowEngine.js`, `casso.service.js` (webhook, sync giao dịch ngân hàng, `handleIncomingTransaction` → tạo receipt voucher tự động)
- **Luồng:** Webhook Casso → `verifyWebhookPayload` → `handleIncomingTransaction` → `createReceiptVoucher` → emit realtime thu tiền.

### A.10. Logistics & Orders (Giao hàng & Đơn hàng)
- **Route:** `/api/logistics` (`logisticsRoutes.js`), `/api/integration/orders` (`integration/orders.js`)
- **Service:** `logistics.service.js`, `orderIngestion.service.js` (`ingestOrderToVoucher`), `queue.service` (`addOrderIngestionJob`)
- **Worker:** `orderIngestionWorker.js` (BullMQ, concurrency 10)
- **Luồng:**
  1. Storefront tạo đơn → `POST /api/integration/orders` hoặc qua queue.
  2. `queue.service.addOrderIngestionJob` → `orderIngestionWorker` xử lý → `orderIngestion.service.ingestOrderToVoucher` (có `rollbackVoucher` bù trừ).
  3. Sinh chứng từ bán hàng → `emitVoucherRealtime` → Kế toán thấy đơn mới.

### A.11. Notifications & Web Push
- **Route:** `/api/notifications` (`notifications.js`)
- **Controller:** `notification.controller.js` (`subscribeToPush`, `getNotifications`, `markAsRead`, `sendNotification`)
- **Service:** `webPush.service.js` (VAPID, `sendToUser`/`sendToRole`), `storefrontRealtime.service.js` (SSE)
- **Luồng:** User subscribe → `webPush.subscribe` lưu subscription → `sendToRole` đẩy thông báo qua Push API khi có event.

### A.12. E-Invoices & Refunds
- **Route:** `/api/e-invoices` (`einvoice.js`), `/api/refunds` (`refunds.js`)
- **Service:** `einvoice.service.js` (`generateEInvoice`, `saveEInvoice`, `listEInvoices`)
- **Luồng:** Từ chứng từ bán → `generateEInvoice` → lưu → liên kết với voucher.

### A.13. Audit Logs & Security
- **Route:** `/api/audit-logs` (qua `admin` module), `/api/public/legal` (`legalPublic.js`)
- **Service:** `audit.service.js`, `auditLog.service.js` (`logAction`, `logBusinessEvent`, `logVoucherDetails`), `encryption.service.js` (mã hóa trường nhạy cảm)
- **Phân quyền:** `admin` (MODULES_REGISTER audit_logs chỉ admin)
- **Luồng:** Mọi mutation quan trọng → `auditLog.service.logBusinessEvent` ghi `audit_logs` → Admin xem vết biến động.

### A.14. Maintenance & Data Retention
- **Route:** `/api/maintenance` (`maintenance.js`)
- **Service:** `maintenance.service.js` (`rebuildLedger`), `dataRetentionWorker.js` (cleanup session, anonymize user, cleanup push subs, old audit logs)
- **Luồng:** Admin rebuild sổ cái → worker định kỳ dọn dẹp dữ liệu hết hạn.

### A.15. Storefront (Cửa hàng khách hàng)
- **File:** `storefront/src/StorefrontPage.jsx`
- **Luồng:**
  1. Khách chọn vai trò (guest/admin/nhân viên) → `handleRoleChange` → `validateAdminSession`.
  2. Duyệt vật tư (`loadItems`) → thêm giỏ (`addToCart`) → thanh toán (`handleCheckoutSubmit`).
  3. `loadWarehouseQueue` (poll hoặc realtime `refreshFromRealtime`) theo dõi hàng đợi kho.
  4. Thanh toán Casso (`loadCassoAccounts`, `openCassoPayment`).
  5. Admin storefront quản lý vật tư (`handleAdminItemSubmit`, `handleAdminDeleteItem`).
  6. Sự kiện realtime từ `storefrontRealtime.service` cập nhật trạng thái đơn/queue.

---

## PHẦN B — MA TRẬN MODULE × TẦNG KIẾN TRÚC

| Module | Route | Controller | Service chính | Worker/Queue | Realtime event | Bảng DB chính |
|---|---|---|---|---|---|---|
| Auth | `/api/auth` | auth.js | helpers, sso, tenant | — | — | users, companies |
| Companies | `/api/companies` | companiesRouter | tenant.service | — | — | companies |
| Vouchers | `/api/vouchers`, `/api/accounting` | erpController, inventoryController | inventory, closing, summary, voucherStatus, orderIngestion | orderIngestionWorker, inventoryWorker | emitVoucherRealtime, emitInventoryRealtime, emitClosingRealtime | vouchers, voucher_details |
| Partners | `/api/partners` | partnerController | partnerService | — | emitPartnerRealtime | partners |
| Inventory/Items | `/api/inventory`, `/api/items` | inventoryController, items.js | inventory, logistics | inventoryWorker | emitInventoryRealtime | items, inventory_vouchers |
| Opening Balances | `/api/opening-balances` | openingBalances.js | report, summary | — | — | vouchers (opening) |
| Closing | `/api/report`, `/api/accounting` | closing.controller, report.controller | closing.service, config/closingWorkflow | addClosingJob | emitClosingRealtime | vouchers (closing) |
| Reports | `/api/report` | report.controller | report, cashFlowEngine, financialNotes, cycle, multiCurrency | — | invalidateReportCache | voucher_details, materialized views |
| Cashflow | `/api/cashflow` | cashflow.js | cashFlowEngine | — | — | vouchers |
| Casso/Bank | `/api/casso` | casso.js | casso.service | — | emitVoucherRealtime (receipt) | casso_webhooks, bank_accounts |
| Logistics/Orders | `/api/logistics`, `/api/integration/orders` | logisticsRoutes, integration/orders | logistics, orderIngestion, queue | orderIngestionWorker (BullMQ) | emitVoucherRealtime | orders, vouchers |
| Notifications | `/api/notifications` | notification.controller | webPush, storefrontRealtime | — | SSE / Push | push_subscriptions, notifications |
| E-Invoices | `/api/e-invoices` | einvoice.js | einvoice.service | — | — | e_invoices |
| Refunds | `/api/refunds` | refunds.js | (refund logic) | — | — | refunds |
| Audit | `/api/.../audit-logs` | admin module | audit, auditLog, encryption | — | — | audit_logs |
| Maintenance | `/api/maintenance` | maintenance.js | maintenance, dataRetentionWorker | dataRetentionWorker | — | vouchers, audit_logs |
| Public/Legal | `/api/public`, `/api/public/legal` | publicRoutes, legalPublic | (metadata) | — | — | items, vouchers |
| Storefront | (SPA riêng) | StorefrontPage.jsx | storefrontRealtime, casso | — | storefrontRealtime (SSE) | orders, items |

---

## PHẦN C — MA TRẬN PHÂN QUYỀN (MODULE × ROLE)

Dựa trên `front-end/src/views/index.js` (`allowedRoles`) và `constants/modules.js` (`roles`), kết hợp `requireRole` backend.

| Module (Frontend id) | admin | ktt | nv | nv_banhang | nv_kho | gd_kinhdoanh |
|---|---|---|---|---|---|---|
| dashboard | ✅ | ✅ | ✅ | — | — | — |
| vouchers | ✅ | ✅ | ✅ | — | — | — |
| partners | ✅ | ✅ | ✅ | — | — | — |
| inventory | ✅ | ✅ | ✅ | — | — | — |
| opening | ✅ | ✅ | — | — | — | ✅ |
| cash | ✅ | ✅ | ✅ | — | — | — |
| purchasing | ✅ | ✅ | ✅ | — | — | — |
| pos | ✅ | — | — | — | — | — |
| sales_excel | ✅ | — | — | — | — | — |
| assets | ✅ | ✅ | ✅ | — | — | — |
| hr | ✅ | ✅ | ✅ | — | — | — |
| costs | ✅ | ✅ | — | — | — | ✅ |
| tax | ✅ | ✅ | — | — | — | ✅ |
| closing_process | ✅ | ✅ | — | — | — | ✅ |
| companies | ✅ | — | — | — | — | — |
| logistics-dashboard | ✅ | — | — | — | — | — |
| bai-xuc | ✅ | — | — | — | — | — |
| audit-logs | ✅ | — | — | — | — | — |
| income-statement | ✅ | ✅ | — | — | — | ✅ |
| balance-sheet | ✅ | ✅ | — | — | — | ✅ |
| income-statement-b02 | ✅ | ✅ | — | — | — | ✅ |
| cash-flow | ✅ | ✅ | — | — | — | ✅ |
| financial-notes | ✅ | ✅ | — | — | — | ✅ |

**Ghi chú backend:** `users_role_check` giới hạn `role IN ('admin','ktt','nv','nv_banhang','nv_kho')`. `gd_kinhdoanh` là role nghiệp vụ (kinh doanh) thường được ánh xạ qua `constants/storefrontRoles.js` hoặc permission module. `requireRootAdmin` bảo vệ các route hệ thống.

---

## PHẦN D — LUỒNG XUYÊN SUỐT (CROSS-CUTTING WORKFLOWS)

### D.1. Auth & Multi-tenant Session
```
Login → authenticate (JWT + refresh cookie)
  → checkCompanyAccess (giới hạn theo companyId)
  → requireRole / requirePermission (theo module.action)
  → Controller xử lý trong scope công ty
```

### D.2. Realtime Loop (Controller → UI)
```
Controller/Service mutate DB
  → voucherRealtime / storefrontRealtime / websocket.service.publishEvent
  → Socket.io (websocket.service.initWebSocket)
  → Frontend: SocketContext / useRealTimeSync / useStorefrontRealTime
  → useRealtimeInvalidation → queryClient.invalidateQueries / setState
  → UI cập nhật không reload
```

### D.3. Async Queue (Storefront → Voucher)
```
Storefront order
  → queue.service.addOrderIngestionJob (BullMQ)
  → orderIngestionWorker (concurrency 10)
  → orderIngestion.service.ingestOrderToVoucher (có rollbackVoucher bù trừ)
  → vouchers + voucher_details
  → emitVoucherRealtime → Kế toán thấy đơn mới
```

### D.4. Closing Cycle (Cuối kỳ)
```
KTT previewClosing → executeClosing
  → closing.service.runClosingEntries
       ├─ processTaxVAT
       ├─ processTaxTNCN
       ├─ createDepreciationEntries
       └─ createProvisionEntries / createAllowanceEntries
  → ghi chứng từ khóa sổ (UnitOfWork transaction)
  → balanceCache.invalidateBalance + emitClosingRealtime
  → Reports (B01/B02/B03) đọc số liệu đã khóa
```

### D.5. Audit & Data Retention
```
Mọi mutation → auditLog.service.logBusinessEvent / logVoucherDetails
  → bảng audit_logs
DataRetentionWorker (định kỳ):
  → cleanupExpiredSessions, anonymizeDeletedUsers,
    cleanupStalePushSubscriptions, cleanupOldAuditLogs, cleanupOldComplaints
```

### D.6. Security Middleware Chain
```
Request → waf (sqlInjectionProtection, xssProtection, securityHeaders, ipWhitelist, checkCompanyActive)
  → rateLimiter (apiRateLimiter trên /api)
  → authenticate
  → requireRole / requirePermission
  → validation (zod)
  → Controller
```

---

## PHẦN E — TÓM TẮT MA TRẬN ƯU TIÊN (THAM CHIẾU)

| STT | Hạng mục | Priority | Đổi deploy? |
|---|---|---|---|
| 1 | AppError + errorHandler | P0 | ❌ |
| 2 | correlationId + logger (Pino) | P0 | ❌ |
| 3 | UnitOfWork | P0 | ❌ |
| 4 | Tách Controller → Service/Repository | P0 | ❌ |
| 5 | BullMQ retry/backoff/DLQ | P1 | ❌ |
| 6 | Partitioning + Materialized View | P2 | ❌ |
| 7 | React Query chuẩn hóa | P2 | ❌ |

> Chi tiết xem `docs/ARCHITECTURE_RECONSTRUCTION.md`.

---

## PHẦN F — DANH MỤC FILE THAM CHIẾU NHANH

**Backend:**
- Routes: `backend/routes/{auth,companies,items,openingBalances,dashboard,export,import,partnerRoute,users,inventoryRoutes,report,vouchers,maintenance,publicRoutes,logisticsRoutes,notifications,accounting,cashflow,casso,integration/index,integration/orders,einvoice,refunds,legalPublic}.js`
- Controllers: `backend/controllers/{closing,erp,inventory,notification,partner,report}.controller.js`
- Services: `backend/services/*.js` (~30 file)
- Middleware: `backend/middleware/{auth,permissions,rateLimiter,validation,waf}.js`
- Workers: `backend/workers/{orderIngestionWorker,inventoryWorker,dataRetentionWorker}.js`
- Config: `backend/config/{db,businessRules,closingWorkflow,tenant,casso}.js`

**Frontend:**
- Module register: `front-end/src/views/index.js`, `front-end/src/constants/modules.js`
- Realtime hooks: `front-end/src/hooks/{useRealTime,useRealTimeSync,useRealtimeInvalidation,useStorefrontRealTime,usePushNotification}.js`
- Context: `front-end/src/context/{AuthContext,SocketContext,VoucherContext}.jsx`

**Storefront:**
- `storefront/src/StorefrontPage.jsx`, `storefront/src/main.jsx`, `storefront/src/App.jsx`