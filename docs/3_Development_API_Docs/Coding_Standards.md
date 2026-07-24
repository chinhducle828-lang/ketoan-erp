# Quy chuẩn Viết mã (Coding Standards)
## KETOAN ERP - Development Guidelines

**Phiên bản:** 1.0.0  
**Ngày:** 23/07/2026  

---

## 1. Ngôn ngữ & Công cụ

### 1.1. Backend (Node.js)
- **Ngôn ngữ**: JavaScript (ES2022+)
- **Module system**: ES Modules (`import`/`export`)
- **Runtime**: Node.js >= 18.0.0
- **Framework**: Express.js 4.x
- **Formatter**: Prettier (cấu hình mặc định)
- **Linter**: ESLint (cấu hình chuẩn)

### 1.2. Frontend (React)
- **Ngôn ngữ**: JavaScript (JSX)
- **Framework**: React 18
- **Build tool**: Vite 5
- **Styling**: TailwindCSS 3
- **State management**: React Query + Context API

### 1.3. AI Service (Python)
- **Python**: >= 3.11
- **Framework**: FastAPI
- **Formatter**: Black
- **Linter**: Flake8

---

## 2. Naming Conventions

### 2.1. JavaScript/Node.js

| Loại | Convention | Ví dụ |
|------|-----------|-------|
| Variables | camelCase | `const companyId = 1;` |
| Functions | camelCase | `async function getVoucher(id) {}` |
| Classes | PascalCase | `class AppError extends Error {}` |
| Constants | UPPER_SNAKE | `const MAX_RETRIES = 3;` |
| Files (JS) | camelCase | `voucher.service.js` |
| Files (routes) | camelCase | `auth.js`, `vouchers.js` |
| Database columns | snake_case | `company_id`, `voucher_date` |
| JSON keys | camelCase | `"companyId": 1` |

### 2.2. Python

| Loại | Convention | Ví dụ |
|------|-----------|-------|
| Variables | snake_case | `company_id = 1` |
| Functions | snake_case | `def process_ocr():` |
| Classes | PascalCase | `class OCRModel:` |
| Constants | UPPER_SNAKE | `DEFAULT_TIMEOUT = 30` |
| Files | snake_case | `ocr_model.py` |

---

## 3. Code Structure

### 3.1. Backend Project Structure
```
routes/                 # Route handlers (thin layer)
  ├── auth.js           # Chỉ call controller functions
  ├── vouchers.js
  └── ...

controllers/            # Request parsing & response formatting
  ├── authController.js
  └── ...

services/               # Business logic (core)
  ├── voucher.service.js
  ├── closing.service.js
  └── ...

repositories/           # Data access (queries)
  ├── voucherRepository.js
  └── ...

validators/             # Zod schemas
  └── index.js

middleware/             # Express middleware
  ├── auth.js
  ├── waf.js
  └── ...
```

### 3.2. Error Handling Pattern
```javascript
// services/voucher.service.js
import { AppError, ErrorCodes } from '../utils/AppError.js';

export async function getVoucher(id, companyId) {
  // 1. Validate input
  if (!id) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'ID is required');
  
  // 2. Query
  const result = await pool.query(
    'SELECT * FROM vouchers WHERE id = $1 AND company_id = $2',
    [id, companyId]
  );
  
  // 3. Handle not found
  if (result.rows.length === 0) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Chứng từ không tồn tại');
  }
  
  // 4. Return
  return result.rows[0];
}
```

### 3.3. Route Handler Pattern
```javascript
// routes/vouchers.js
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as voucherController from '../controllers/voucherController.js';

const router = Router();

router.use(authenticate);

router.get('/', voucherController.list);
router.get('/:id', voucherController.getById);
router.post('/', voucherController.create);
router.put('/:id', voucherController.update);
router.delete('/:id', voucherController.delete);
router.post('/:id/post', voucherController.post);

export default router;
```

---

## 4. Async/Await Pattern

### 4.1. Luôn sử dụng async/await
```javascript
// ✅ Đúng
export async function createVoucher(data) {
  const result = await pool.query('INSERT ...');
  return result.rows[0];
}

// ❌ Sai
export function createVoucher(data) {
  return pool.query('INSERT ...').then(result => result.rows[0]);
}
```

### 4.2. Try/Catch ở controller
```javascript
// controllers/voucherController.js
export async function create(req, res, next) {
  try {
    const data = req.body;
    const result = await voucherService.createVoucher(data);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error); // Chuyển đến errorHandler
  }
}
```

---

## 5. Validation

### 5.1. Zod Schema Validation
```javascript
// validators/index.js
import { z } from 'zod';

export const createVoucherSchema = z.object({
  company_id: z.number().int().positive(),
  voucher_number: z.string().min(1).max(100),
  voucher_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  voucher_type: z.enum(['PT', 'PC', 'NK', 'XK', 'DauKy']),
  description: z.string().optional(),
  currency: z.enum(['VND', 'USD']).default('VND'),
  exchange_rate: z.number().positive().default(1.0000),
  details: z.array(z.object({
    account_code: z.string().length(3),
    entry_type: z.enum(['DR', 'CR']),
    amount: z.number().positive(),
    partner_id: z.number().optional(),
    item_id: z.number().optional(),
  })).min(2) // Ít nhất 2 dòng (Nợ + Có)
}).refine(data => {
  // Tổng Nợ = Tổng Có
  const drTotal = data.details.filter(d => d.entry_type === 'DR')
    .reduce((sum, d) => sum + d.amount, 0);
  const crTotal = data.details.filter(d => d.entry_type === 'CR')
    .reduce((sum, d) => sum + d.amount, 0);
  return drTotal === crTotal;
}, { message: 'Tổng Nợ phải bằng tổng Có' });
```

### 5.2. Middleware Validation
```javascript
import { validate } from '../middleware/validate.js';

router.post('/', validate(createVoucherSchema), voucherController.create);
```

---

## 6. Database Access

### 6.1. Parameterized Queries (Chống SQL Injection)
```javascript
// ✅ Đúng
const result = await pool.query(
  'SELECT * FROM vouchers WHERE id = $1 AND company_id = $2',
  [id, companyId]
);

// ❌ Sai (SQL Injection)
const result = await pool.query(
  `SELECT * FROM vouchers WHERE id = ${id}`
);
```

### 6.2. Transaction Pattern
```javascript
export async function createVoucherWithDetails(voucherData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Insert voucher
    const voucherResult = await client.query(
      'INSERT INTO vouchers (...) VALUES (...) RETURNING id',
      [...]
    );
    const voucherId = voucherResult.rows[0].id;
    
    // Insert details
    for (const detail of voucherData.details) {
      await client.query(
        'INSERT INTO voucher_details (...) VALUES (...)',
        [voucherId, ...]
      );
    }
    
    await client.query('COMMIT');
    return voucherId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

---

## 7. Logging

### 7.1. Pino Logger
```javascript
import logger from '../utils/logger.js';

// Log levels
logger.info({ companyId, voucherId }, 'Voucher created successfully');
logger.warn({ companyId }, 'Low inventory warning');
logger.error({ err, companyId }, 'Failed to post voucher');
logger.debug({ query, params }, 'Executing SQL query');
```

### 7.2. Correlation ID
Mỗi request tự động có correlation ID để tracing:
```javascript
// Request lifecycle log
2026-07-23 INFO: [corr-abc123] GET /api/vouchers 200 45ms
2026-07-23 INFO: [corr-abc123] Query executed 12ms
```

---

## 8. Testing Standards

### 8.1. Test File Structure
```javascript
// tests/voucher.service.test.js
import { describe, it, expect, beforeAll } from '@jest/globals';

describe('VoucherService', () => {
  describe('createVoucher', () => {
    it('should create voucher with balanced entries', async () => {
      // Arrange
      const data = { ... };
      
      // Act
      const result = await voucherService.createVoucher(data);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.details.length).toBe(2);
    });
    
    it('should throw error when debit != credit', async () => {
      const data = { ... };
      await expect(voucherService.createVoucher(data))
        .rejects.toThrow('Tổng Nợ phải bằng tổng Có');
    });
  });
});
```

### 8.2. Coverage Targets
| Module | Target |
|--------|--------|
| validators/ | 90% |
| services/taxRule | 85% |
| services/closing | 80% |
| utils/accountingEngine | 80% |
| **Global** | **70%** |

---

## 9. Git Workflow

### 9.1. Branch Strategy
```
main           → Production (deployed on Railway)
  ├── develop  → Development branch
  │     ├── feature/xxx  → New features
  │     ├── fix/xxx      → Bug fixes
  │     └── refactor/xxx → Code refactoring
```

### 9.2. Commit Convention
```
feat: Thêm tính năng quản lý công nợ
fix: Sửa lỗi tính toán số dư đầu kỳ
refactor: Tái cấu trúc service layer
docs: Cập nhật API documentation
test: Thêm test cho voucher service
chore: Cập nhật dependencies
```

### 9.3. Pull Request Checklist
- [ ] Code follows coding standards
- [ ] All tests pass
- [ ] Coverage meets thresholds
- [ ] No console.log (use logger)
- [ ] API docs updated
- [ ] Migration added if schema change

---

## 10. Environment Variables

### 10.1. Naming Convention
```
UPPER_SNAKE_CASE = value
```

### 10.2. Required Variables
```bash
# Database
DATABASE_URL=postgresql://...

# Auth
JWT_SECRET=your-secret-here

# AI
GEMINI_API_KEY=your-key
AI_INTERNAL_SECRET=shared-secret

# CORS
FRONTEND_URL=http://localhost:3000
```

### 10.3. Never Commit
- `.env` files with real secrets
- API keys
- Database passwords
- JWT secrets