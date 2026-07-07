# MASTERPLAN: TÁI CẤU TRÚC & NÂNG CẤP KETOAN ERP (P0 + P1)

> Tài liệu kế hoạch chi tiết dựa trên **thực trạng mã nguồn hiện tại** (không chỉ lý thuyết). Mục tiêu: Maintainability, Reliability, Scalability.
> Phạm vi tài liệu này: P0 (làm ngay) + P1 (trong tháng tới). P2 liệt kê để biết lộ trình dài hạn.

---

## 0. ĐÁNH GIÁ THỰC TRẠNG (Current State Audit)

Dựa trên quét thực tế `backend/` (commit `10ec17e`):

| Hạng mục trong chiến lược | Trạng thái hiện tại | Bằng chứng |
|---|---|---|
| ESM / module | ✅ Đã có | `package.json` `"type":"module"`; `server.js` dùng `import/export` |
| Validation (zod) | 🟡 Đã cài `zod@^4.4.3` | Chưa áp dụng đồng bộ ở Controller |
| Queue (BullMQ) | 🟡 Đã cài `bullmq@^4.18.3` | `workers/orderIngestionWorker.js` chưa có retry/backoff/DLQ |
| Redis cache | ✅ `cache/redis.js` | Hand-rolled middleware (không phải queue), ổn nhưng chưa structured logging |
| Controller/Service tách biệt | ❌ Chưa | `controllers/erpController.js` gọi `pool.query` trực tiếp (dòng 38–52), giữ `localCache` Map |
| Unit of Work / transaction | ❌ Chưa | Transaction rải rác, không tập trung |
| Centralized Error Handling | ❌ Chưa | `try/catch` + `res.status(500).json({error})` lặp lại khắp nơi |
| TypeScript | ❌ Chưa | Toàn bộ `*.js` / `*.jsx` |
| Table Partitioning | ❌ Chưa | `voucher_details` (sổ cái) chưa partition |
| React Query / Socket invalidation | 🟡 Một phần | Đã có `useRealTimeSync`, `useRealtimeInvalidation` (untracked) nhưng chưa chuẩn React Query |

**Kết luận:** P0 là nền móng bắt buộc. P1 (TS, BullMQ hardening) xây trên nền đó.

---

## 1. P0 — LÀM NGAY (Nền tảng)

### 1.1 Tách Controller / Service / Repository (3-Tier)
**Nguyên tắc:** Controller chỉ làm HTTP (parse + validate + gọi service + trả response). Service chứa 100% business logic, không biết `req/res`. Repository/DAO chỉ gọi Knex/PG.

**Thực thi theo module (ưu tiên cao → thấp):**
1. `controllers/erpController.js` → tách `getLedgerBalances`, `runInventoryCosting` ra `services/ledger.service.js` + `repositories/ledger.repository.js`.
2. `controllers/closing.controller.js` ↔ `services/closing.service.js` (đã có service, làm mỏng controller).
3. `controllers/partnerController.js`, `controllers/report.controller.js` tương tự.
4. Tạo thư mục `backend/repositories/` với `voucher.repository.js`, `ledger.repository.js`, `partner.repository.js`.

**Quy ước cấu trúc file:**
```
backend/
  controllers/   → mỏng, gọi service
  services/      → business logic, gọi repository
  repositories/  → Knex/PG only
  validators/    → zod schema (đã có thư mục này)
```

**Ví dụ refactor (lấy từ `erpController.getLedgerBalances`):**

```js
// TRƯỚC (erpController.js - fat controller, gọi pool.query trực tiếp)
export const getLedgerBalances = async (req, res) => {
  const companyId = req.companyId || req.query.company_id;
  if (!companyId) return res.status(400).json({ error: 'Thiếu companyId!' });
  const vouchersRes = await pool.query(`SELECT ... FROM vouchers v JOIN voucher_details vd ...`, [Number(companyId)]);
  const balances = calculateBalances(vouchersRes.rows, []);
  return res.json({ success: true, data: { accountLedger: balances } });
};

// SAU (Controller mỏng)
export const getLedgerBalances = async (req, res, next) => {
  try {
    const { companyId } = LedgerQueryValidator.parse({
      companyId: req.companyId || req.query.company_id
    });
    const data = await LedgerService.getBalances(companyId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

// Service (services/ledger.service.js)
class LedgerService {
  static async getBalances(companyId) {
    const vouchers = await LedgerRepository.findByCompany(companyId);
    return calculateBalances(vouchers, []);
  }
}
```

### 1.2 Unit of Work (Transaction tập trung)
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
Service gọi `UnitOfWork.transaction(async (trx) => { ... })` thay vì mở transaction rải rác.

### 1.3 Centralized Error Handling
- Tạo `backend/utils/AppError.js`:
```js
export class AppError extends Error {
  constructor(errorCode, message, statusCode = 500) {
    super(message);
    this.errorCode = errorCode;
    this.statusCode = statusCode;
  }
}
```
- Tạo `backend/middleware/errorHandler.js` (đặt CUỐI `server.js`, sau tất cả routes):
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
- Tạo `backend/utils/logger.js` (Pino/Winston JSON) thay `console.log` (bắt đầu từ `server.js` + worker).

### 1.4 Correlation / Trace ID
- Middleware `backend/middleware/correlationId.js`: gán `req.traceId = req.headers['x-trace-id'] || uuid()`. Gắn vào logger + truyền sang worker job data.

---

## 2. P1 — TRONG THÁNG TỚI

### 2.1 TypeScript Migration (Chiến lược an toàn, không big-bang)
Vì dự án lớn, dùng **gradual migration**:
1. Thêm `tsconfig.json` (`"allowJs": true`, `"checkJs": false` ban đầu để không break).
2. Cài `typescript`, `@types/node`, `@types/express`, `tsx`.
3. Định nghĩa `backend/types/domain.ts`:
```ts
export interface LedgerEntry {
  accountCode: string;
  partnerId?: string | null;
  debitAmount: number;   // ép number, không string
  creditAmount: number;
}
export interface Voucher {
  id: number;
  voucherDate: string;
  companyId: number;
  details: LedgerEntry[];
}
```
4. Đổi đuôi từng module `*.js → *.ts` theo thứ tự: `utils/` → `repositories/` → `services/` → `controllers/` → `server.js`. Giữ `"type":"module"` + `tsx` chạy dev.
5. Bật dần `"checkJs": true` để siết chặt kiểu.

### 2.2 BullMQ Hardening (Retry + DLQ)
Nâng cấp `workers/orderIngestionWorker.js` (hiện tại chưa có retry/backoff/DLQ):
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
- Đảm bảo job data mang `traceId` để trace xuyên suốt.

### 2.3 Structured Logging & Observability
- Thay toàn bộ `console.log/error` bằng `logger` (Pino JSON) → sẵn sàng đẩy ELK/Datadog.
- Gắn `traceId` xuyên suốt Controller → Service → Worker → DB log.

---

## 3. P2 (Dài hạn — lộ trình, không làm ngay)
- **Table Partitioning** `voucher_details` theo tháng (PostgreSQL declarative partitioning) → migration SQL `backend/migrations/0xx_partition_voucher_details.sql` (partitions `voucher_details_2026_01`, ...).
- **Materialized Views** cho Dashboard (CQRS) → worker ngầm `REFRESH MATERIALIZED VIEW`.
- **React Query (TanStack)** chuẩn hóa `useRealTimeSync` hiện có; tách UI components / business hooks triệt để.

---

## 4. MA TRẬN ƯU TIÊN & THỨ TỰ THỰC THI

| STT | Hạng mục | Priority | File/Module ảnh hưởng | Rủi ro |
|---|---|---|---|---|
| 1 | AppError + errorHandler middleware | P0 | `utils/AppError.js`, `middleware/errorHandler.js`, `server.js` | Thấp |
| 2 | correlationId middleware + logger | P0 | `middleware/correlationId.js`, `utils/logger.js` | Thấp |
| 3 | UnitOfWork | P0 | `utils/unitOfWork.js` | Trung bình |
| 4 | Tách erpController → service/repo | P0 | `controllers/erpController.js`, `services/ledger.service.js`, `repositories/*` | Trung bình |
| 5 | Tách closing/partner/report controllers | P0 | tương ứng | Trung bình |
| 6 | tsconfig + domain types | P1 | `tsconfig.json`, `types/domain.ts` | Thấp (allowJs) |
| 7 | Gradual .js→.ts | P1 | toàn bộ backend | Cao (làm từng module) |
| 8 | BullMQ retry/backoff/DLQ | P1 | `workers/orderIngestionWorker.js`, `workers/deadLetterWorker.js` | Thấp |

---

## 5. KIỂM THỬ & ĐẢM BẢO
- Giữ nguyên `npm test` (Jest) xanh suốt quá trình; refactor từng module rồi chạy test.
- Thêm test cho `UnitOfWork` (rollback trên lỗi) và `errorHandler` (map AppError → status/code).
- Không xóa `cache/redis.js` (vẫn dùng); chỉ bổ sung logger.

---

## 6. TÓM TẮT
- **P0** thiết lập nền tảng: tách 3 lớp, Unit of Work, xử lý lỗi tập trung, trace id, logger.
- **P1** nâng cấp: TypeScript dần dần (không big-bang), BullMQ có retry/backoff/DLQ, structured logging.
- **P2** tối ưu dài hạn: partitioning, materialized views, React Query.