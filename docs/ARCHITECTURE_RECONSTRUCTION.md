# TÀI LIỆU TÁI CẤU TRÚC KIẾN TRÚC KETOAN ERP

> **Mục tiêu:** Nâng cao tính dễ bảo trì (Maintainability), độ tin cậy (Reliability), khả năng mở rộng (Scalability) qua Clean Architecture, TypeScript, Design Patterns — **mà vẫn giữ nguyên cách deploy riêng biệt trên Railway (Dockerfile, không Nixpacks)**.
>
> **Nguồn tổng hợp:** `all_project_code.txt` (thực trạng mã nguồn) + `txt` (chiến lược) + `docs/MASTERPLAN_REFACTORING.md` (kế hoạch P0/P1) + phân tích `railway.json` & 3 Dockerfile.

---

## 0. RÀNG BUỘC DEPLOY — QUAN TRỌNG NHẤT (ĐỌC TRƯỚC KHI REFACTOR)

### 0.1. Thực tế: Dự án KHÔNG dùng Nixpacks

`railway.json` khai báo `"builder": "DOCKERFILE"` (không phải `NIXPACKS`), với **3 Dockerfile riêng biệt**, và không có `nixpacks.toml` nào. Cách "deploy riêng biệt" thực tế:

| Service | Dockerfile | Build step | Start command | Ràng buộc cốt lõi |
|---|---|---|---|---|
| **backend** | `Dockerfile.backend` | `npm ci --only=production` | `node server.js` | Chạy **plain ESM JavaScript**, không có bước compile. Chỉ cài `dependencies` (loại `devDependencies`). |
| **frontend** | `Dockerfile.frontend` | `npm ci` → `npm run build` (Vite) | `npm start` (vite preview) | Biến `VITE_*` chỉ đọc lúc build. |
| **storefront** | `Dockerfile.storefront` | `npm ci` → `npm run build` | `npm start` | Tương tự frontend. |

### 0.2. Kim chỉ nam: "Không đổi cách deploy"

Để tái cấu trúc mà **không phá deploy**, TUYỆT ĐỐI:

1. **Không sửa** `railway.json`, `Dockerfile.backend`, `Dockerfile.frontend`, `Dockerfile.storefront` (kể cả 1 ký tự).
2. Backend chạy `node server.js` → mọi code backend phải là **`.js` ESM chạy được bằng `node`**. **KHÔNG đổi đuôi `.ts`** (sẽ phá `node server.js`).
3. Thư viện mới dùng lúc runtime (Pino, v.v.) phải thêm vào `backend/package.json` → **`dependencies`** (KHÔNG phải `devDependencies`, vì `npm ci --only=production` loại bỏ devDeps).
4. `server.js` tự chạy `schema.sql` + `migrations/*.sql` khi khởi động → migration (P2 partitioning) không cần đổi deploy.
5. Giữ nguyên endpoint `/api/health` để Railway healthcheck.

### 0.3. Ma trận: Đổi deploy hay không?

| Hạng mục (từ txt + masterplan) | Đổi deploy? | Lý do |
|---|---|---|
| P0: tách Controller/Service/Repository | ❌ Không | Chỉ thêm file `.js` trong `backend/`, `node server.js` vẫn gọi route như cũ |
| P0: UnitOfWork (`utils/unitOfWork.js`) | ❌ Không | File mới, dùng `pool` có sẵn |
| P0: AppError + errorHandler middleware | ❌ Không | Middleware mới, gắn cuối `server.js` |
| P0: correlationId + logger (Pino) | ❌ Không | **Pino phải vào `dependencies`** (không phải devDeps) |
| P1: **TypeScript (đổi đuôi `.ts`)** | ⚠️ **CÓ** | Sẽ phá `node server.js` → xem mục 2.1 cách né |
| P1: BullMQ retry/backoff/DLQ | ❌ Không | `bullmq` đã trong `dependencies`; chỉ sửa code worker |
| P2: Partitioning / Materialized View | ❌ Không | Chỉ thêm file `.sql` trong `backend/migrations/` |
| P2: React Query / Socket | ❌ Không | Code thuần frontend, build bởi Vite như cũ |

---

## 1. THỰC TRẠNG KIẾN TRÚC (trích `all_project_code.txt`)

### 1.1. Cấu trúc backend hiện tại
```
backend/
  cache/redis.js            → Middleware cache Redis (hand-rolled, ổn)
  config/                   → db.js, businessRules.js, closingWorkflow.js, tenant.js
  controllers/              → erpController, closing, partner, report, inventory, notification
  middleware/               → auth, permissions, rateLimiter, validation, waf
  migrations/               → 001..010_*.sql (chạy tự động khi start)
  routes/                   → accounting, auth, cashflow, companies, dashboard, export,
                              import, inventoryRoutes, items, logistics, notifications,
                              openingBalances, partnerRoute, publicRoutes, report, users, vouchers,
                              integration/{index,orders}
  services/                 → ~30 service (closing, inventory, summary, voucherStatus, queue, ...)
  tests/                    → e2e, integration, stress, unit
  utils/                    → accountingEngine.js, inventoryEngine.js
  validators/               → index.js, partnerValidator.js
  workers/                  → inventoryWorker.js, orderIngestionWorker.js
  server.js                 → mount routes, healthcheck, static serve, init DB
```

### 1.2. Vấn đề (Fat Controller)
- `controllers/erpController.js`:
  - Giữ `localCache = new Map()` (RAM cache cục bộ) → vi phạm chia sẻ trạng thái giữa nhiều replica.
  - Gọi `pool.query(...)` trực tiếp trong controller (ví dụ `getLedgerBalances`, `getAuditLogs`).
  - Trộn logic HTTP + business (`calculateBalances`) + DB query.
- `controllers/closing.controller.js`, `report.controller.js`: gọi `pool.query` trực tiếp, mở transaction rải rác (`client = await pool.connect(); BEGIN; ... COMMIT/ROLLBACK`).
- `controllers/partnerController.js`: đã tách service (`partnerService`) khá tốt — làm mẫu tham khảo.
- Xử lý lỗi: `try/catch` + `res.status(500).json({error})` lặp lại khắp nơi, thông báo không nhất quán.
- `console.log/error` dùng trực tiếp (chưa structured logging).
- `workers/orderIngestionWorker.js`: BullMQ đã cài nhưng **chưa** có `attempts`/`backoff`/`deadLetterPolicy`.

### 1.3. Điểm đã tốt (giữ nguyên)
- ESM (`"type":"module"`), `zod@^4.4.3` đã cài (dùng trong `middleware/validation.js`).
- `cache/redis.js` cache middleware hoạt động ổn.
- `services/` đã tồn tại nhiều module nghiệp vụ (closing, inventory, summary...).
- `server.js` tự động chạy schema + migrations → dễ mở rộng DB không đổi deploy.

---

## 2. CHIẾN LƯỢC TÁI CẤU TRÚC (từ `txt` + masterplan, áp dụng thực tế)

### 2.1. TypeScript — CÁCH NÉ "ĐỔI DEPLOY" (quan trọng)

Masterplan đề xuất đổi đuôi `*.js → *.ts` + chạy `tsx`. **Điều này sẽ phá `node server.js`** và vi phạm ràng buộc 0.2.

**Giải pháp an toàn (giữ `node server.js`):**
- **Giữ nguyên đuôi `.js`** cho mọi file runtime.
- Bật `backend/tsconfig.json` với `"allowJs": true, "checkJs": false` → type-check chỉ chạy ở dev/CI, không ảnh hưởng runtime.
- Định nghĩa kiểu chặt chẽ qua **JSDoc** và file `.d.ts` trong `backend/types/`:

```js
// backend/types/domain.d.ts
/**
 * @typedef {Object} LedgerEntry
 * @property {string} accountCode
 * @property {string|null} [partnerId]
 * @property {number} debitAmount     // ép number, không string
 * @property {number} creditAmount
 */
```

```js
// Ví dụ dùng JSDoc trong service
/**
 * @param {number} companyId
 * @returns {Promise<Record<string, any>>}
 */
static async getBalances(companyId) { /* ... */ }
```

- Nếu sau này thực sự muốn `.ts`: phải chuyển `tsx` vào `dependencies` VÀ đổi `startCommand` trong `railway.json` thành `tsx server.ts` — tức là **đổi deploy**. Vì yêu cầu là "không đổi deploy", ta CHỌN cách JSDoc/`allowJs`.

### 2.2. Tách 3 lớp (Controller / Service / Repository)

**Quy ước:**
```
backend/
  controllers/   → mỏng: parse + validate(zod) + gọi service + trả response
  services/      → 100% business logic, gọi repository, KHÔNG biết req/res
  repositories/  → CHỈ gọi pool/PG (DAO)
  validators/    → zod schema (đã có)
```

**Ví dụ refactor `erpController.getLedgerBalances`:**
```js
// TRƯỚC (fat controller, gọi pool.query trực tiếp + localCache Map)
export const getLedgerBalances = async (req, res) => {
  const companyId = req.companyId || req.query.company_id;
  if (!companyId) return res.status(400).json({ error: 'Thiếu companyId!' });
  const vouchersRes = await pool.query(`SELECT ... JOIN voucher_details ...`, [Number(companyId)]);
  const balances = calculateBalances(vouchersRes.rows, []);
  return res.json({ success: true, data: { accountLedger: balances } });
};

// SAU (controller mỏng)
export const getLedgerBalances = async (req, res, next) => {
  try {
    const { companyId } = LedgerQueryValidator.parse({
      companyId: req.companyId || req.query.company_id
    });
    const data = await LedgerService.getBalances(companyId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

// services/ledger.service.js
export class LedgerService {
  static async getBalances(companyId) {
    const vouchers = await LedgerRepository.findByCompany(companyId);
    return calculateBalances(vouchers, []);
  }
}

// repositories/ledger.repository.js
export const LedgerRepository = {
  async findByCompany(companyId) {
    const { rows } = await pool.query(
      `SELECT v.id, v.voucher_date, v.voucher_type, v.currency, v.exchange_rate, v.description,
              json_agg(json_build_object('accountCode', vd.account_code, 'entryType', vd.entry_type,
                'amount', vd.amount, 'quantity', vd.quantity, 'partnerId', vd.partner_id, 'itemId', vd.item_id))
              as details
       FROM vouchers v JOIN voucher_details vd ON v.id = vd.voucher_id
       WHERE v.company_id = $1 GROUP BY v.id`,
      [Number(companyId)]
    );
    return rows;
  }
};
```

**Thứ tự thực thi:**
1. `erpController.js` → `services/ledger.service.js` + `repositories/ledger.repository.js` (bỏ `localCache` Map → chuyển sang `balanceCache.service`/Redis).
2. `closing.controller.js` ↔ `services/closing.service.js` (đã có service, làm mỏng controller).
3. `partnerController.js`, `report.controller.js` tương tự.
4. Tạo `backend/repositories/` (`voucher.repository.js`, `ledger.repository.js`, `partner.repository.js`).

### 2.3. Unit of Work (Transaction tập trung)
Tạo `backend/utils/unitOfWork.js`:
```js
import { pool } from '../config/db.js';

export const UnitOfWork = {
  async transaction(fn) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);   // truyền client (tương đương Knex trx)
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
};
```
Service gọi `UnitOfWork.transaction(async (trx) => { ... })` thay vì mở transaction rải rác trong controller.

### 2.4. Xử lý lỗi tập trung (Centralized Error Handling)
- `backend/utils/AppError.js`:
```js
export class AppError extends Error {
  constructor(errorCode, message, statusCode = 500) {
    super(message);
    this.errorCode = errorCode;
    this.statusCode = statusCode;
  }
}
```
- `backend/middleware/errorHandler.js` (gắn CUỐI `server.js`, sau tất cả routes):
```js
export const errorHandler = (err, req, res, next) => {
  logger.error({ traceId: req.traceId, errorCode: err.errorCode, err });
  res.status(err.statusCode || 500).json({
    success: false,
    errorCode: err.errorCode || 'INTERNAL_ERROR',
    message: err.message || 'Lỗi máy chủ nội bộ'
  });
};
```
- Thay mọi `catch { res.status(500).json({error}) }` bằng `next(err)` / `throw new AppError(...)`.
- `backend/utils/logger.js` (Pino JSON) thay `console.log` (bắt đầu từ `server.js` + worker).

### 2.5. Correlation / Trace ID
- `backend/middleware/correlationId.js`: gán `req.traceId = req.headers['x-trace-id'] || uuid()`. Gắn vào logger + truyền sang worker job data.

---

## 3. HÀNG ĐỢI (QUEUE) — BULLMQ HARDENING (P1)

Nâng cấp `workers/orderIngestionWorker.js` (đã cài `bullmq@^4.18.3`, chưa retry/backoff/DLQ):
```js
new Worker(queueName, handler, {
  connection: redis,
  concurrency: 10,
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },        // Exponential backoff
  deadLetterPolicy: { maxFailedAttempts: 5 }            // DLQ: tuyệt đối không drop tin nhắn
});
```
- Tạo `workers/deadLetterWorker.js` để Kế toán trưởng duyệt tay các job vào DLQ.
- Đảm bảo job data mang `traceId` để trace xuyên suốt Controller → Worker → DB log.
- **Không đổi deploy** (bullmq đã trong `dependencies`).

---

## 4. TỐI ƯU CƠ SỞ DỮ LIỆU (P2 — không đổi deploy)

### 4.1. Table Partitioning
Bảng `voucher_details` (sổ cái) phình nhanh → áp dụng Declarative Partitioning theo tháng.
Tạo migration `backend/migrations/0xx_partition_voucher_details.sql` (partitions `voucher_details_2026_01`, ...). Vì `server.js` tự chạy migrations → **không đổi deploy**.

### 4.2. Materialized Views (CQRS)
Tạo Materialized View cho Dashboard; worker ngầm `REFRESH MATERIALIZED VIEW`. Frontend chỉ `SELECT` nhanh.

---

## 5. FRONTEND (P2 — không đổi deploy)

- Chuẩn hóa `useRealTimeSync` / `useRealtimeInvalidation` hiện có thành **React Query (TanStack)**:
```js
const { data: vouchers, isLoading } = useQuery({
  queryKey: ['vouchers', month, year],
  queryFn: () => api.fetchVouchers(month, year)
});
socket.on('voucher:created', () => {
  queryClient.invalidateQueries({ queryKey: ['vouchers'] });
});
```
- Tách logic gọi API/format ra Custom Hooks (`useInventoryClosing.js`); `.jsx` làm Dumb Components.
- Build vẫn qua `Dockerfile.frontend` / `Dockerfile.storefront` như cũ.

---

## 6. OBSERVABILITY & DEVOPS

- **Correlation ID**: mỗi request Storefront gán UUID → truyền xuống Worker → log PG. Tra cứu toàn bộ vòng đời khi có lỗi.
- **Structured Logging (Pino)**: thay `console.log` bằng `logger` JSON → sẵn sàng đẩy ELK/Datadog.
- Gắn `traceId` xuyên suốt Controller → Service → Worker → DB log.

---

## 7. MA TRẬN ƯU TIÊN & THỨ TỰ THỰC THI

| STT | Hạng mục | Priority | File/Module ảnh hưởng | Đổi deploy? | Rủi ro |
|---|---|---|---|---|---|
| 1 | AppError + errorHandler middleware | P0 | `utils/AppError.js`, `middleware/errorHandler.js`, `server.js` | ❌ | Thấp |
| 2 | correlationId middleware + logger (Pino) | P0 | `middleware/correlationId.js`, `utils/logger.js`, `package.json`(deps) | ❌ | Thấp |
| 3 | UnitOfWork | P0 | `utils/unitOfWork.js` | ❌ | Trung bình |
| 4 | Tách erpController → service/repo | P0 | `controllers/erpController.js`, `services/ledger.service.js`, `repositories/*` | ❌ | Trung bình |
| 5 | Tách closing/partner/report controllers | P0 | tương ứng | ❌ | Trung bình |
| 6 | tsconfig + domain types (JSDoc) | P1 | `tsconfig.json`, `types/domain.d.ts` | ❌ | Thấp (allowJs) |
| 7 | BullMQ retry/backoff/DLQ | P1 | `workers/orderIngestionWorker.js`, `workers/deadLetterWorker.js` | ❌ | Thấp |
| 8 | Partitioning + Materialized View | P2 | `migrations/0xx_*.sql` | ❌ | Thấp |
| 9 | React Query chuẩn hóa | P2 | `front-end/src/hooks/*` | ❌ | Trung bình |

---

## 8. KIỂM THỬ & ĐẢM BẢO

- Giữ nguyên `npm test` (Jest) xanh suốt quá trình; refactor từng module rồi chạy test.
- Thêm test cho `UnitOfWork` (rollback trên lỗi) và `errorHandler` (map AppError → status/code).
- **Không xóa** `cache/redis.js` (vẫn dùng); chỉ bổ sung logger.
- **Không sửa** `railway.json`, 3 Dockerfile, `backend/package.json` `"type":"module"` + `"start":"node server.js"`.

---

## 9. TÓM TẮT

- **Ràng buộc then chốt:** Deploy hiện tại là **Dockerfile (không phải Nixpacks)**; backend chạy `node server.js` (plain ESM JS). Mọi refactor P0/P1/P2 **có thể thực hiện mà không sửa Dockerfile/railway.json**, NGOẠI TRỪ việc đổi đuôi `.ts` (phải né bằng JSDoc + `allowJs`).
- **P0** thiết lập nền tảng: tách 3 lớp, Unit of Work, xử lý lỗi tập trung, trace id, logger.
- **P1** nâng cấp: TypeScript dần dần qua JSDoc (không big-bang đổi đuôi), BullMQ có retry/backoff/DLQ, structured logging.
- **P2** tối ưu dài hạn: partitioning, materialized views, React Query.