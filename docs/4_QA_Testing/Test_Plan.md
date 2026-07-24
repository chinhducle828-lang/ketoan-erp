# Kế hoạch Kiểm thử (Test Plan)
## KETOAN ERP - Quality Assurance Plan

**Phiên bản:** 1.0.0  
**Ngày:** 23/07/2026  

---

## 1. Chiến lược Kiểm thử

### 1.1. Mục tiêu
- Đảm bảo chất lượng code đạt coverage ≥ 70% (global)
- Phát hiện lỗi nghiệp vụ kế toán trước khi deploy
- Đảm bảo AI suggestions chính xác ≥ 90%
- Kiểm tra hiệu năng API đáp ứng SLA < 200ms

### 1.2. Phạm vi Kiểm thử

| Loại | Mô tả | Công cụ |
|------|-------|---------|
| **Unit Tests** | Kiểm tra từng function/service riêng lẻ | Jest 30 |
| **Integration Tests** | Kiểm tra API endpoints + database | Supertest + Jest |
| **Property-based Tests** | Kiểm tra với dữ liệu ngẫu nhiên | fast-check |
| **Mutation Tests** | Kiểm tra chất lượng test suite | Stryker |
| **Performance Tests** | Đo thời gian phản hồi | Jest performance |
| **Statistical Tests** | Kiểm tra phân phối dữ liệu | Jest statistical |
| **Combinatorial Tests** | Kiểm tra tổ hợp tham số | Jest combinatorial |
| **Graph Tests** | Kiểm tra luồng xử lý | Jest graph |
| **Queueing Tests** | Kiểm tra hàng đợi | Jest queueing |
| **Stochastic Tests** | Kiểm tra xác suất | Jest stochastic |

---

## 2. Môi trường Kiểm thử

### 2.1. Môi trường

| Môi trường | URL | Database | Mục đích |
|-----------|-----|----------|---------|
| **Local** | http://localhost:5000 | Local PostgreSQL | Dev testing |
| **CI** | Railway preview | Railway PostgreSQL | PR testing |
| **Staging** | Railway staging | Railway staging DB | Pre-release |
| **Production** | Railway production | Railway production DB | Live |

### 2.2. Test Database
- Tên: `ketoan_db_test`
- Tự động tạo/setup qua `tests/setup.js`
- Dữ liệu seed: mẫu cho mỗi test suite
- Tự động cleanup sau mỗi test

---

## 3. Unit Tests

### 3.1. Backend Test Suites

| Suite | File | Số lượng test | Coverage target |
|-------|------|--------------|-----------------|
| Validators | `tests/validators.test.js` | 50+ | 90% |
| Tax Rule Service | `tests/taxRule.service.test.js` | 30+ | 85% |
| Closing Service | `tests/closing.service.test.js` | 40+ | 80% |
| Accounting Engine | `tests/accountingEngine.test.js` | 60+ | 80% |
| Voucher Service | `tests/voucher.service.test.js` | 50+ | 75% |
| AI Services | `tests/ai*.test.js` | 30+ | 70% |
| Middleware | `tests/middleware.test.js` | 20+ | 80% |

### 3.2. Frontend Test Suites

| Suite | File | Số lượng test | Coverage target |
|-------|------|--------------|-----------------|
| Accounting Engine | `utils/accountingEngine.test.js` | 40+ | 80% |
| Accounting Rules | `utils/accountingRules.test.js` | 30+ | 80% |
| Format Utils | `utils/format.test.js` | 20+ | 80% |
| API Base URL | `utils/apiBaseUrl.test.js` | 10+ | 90% |
| Components | `components/*.test.jsx` | 30+ | 60% |

### 3.3. Test Command
```bash
# Run all tests
npm test

# Run specific test suite
npm test -- tests/voucher.service.test.js

# Run with coverage
npm run test:ci

# Run mutation tests
npm run test:mutation
```

---

## 4. Integration Tests

### 4.1. API Endpoint Tests

| Endpoint | Test cases | Mô tả |
|----------|-----------|-------|
| `POST /api/auth/login` | 10+ | Login success, fail, validation |
| `GET /api/vouchers` | 15+ | List, filter, pagination |
| `POST /api/vouchers` | 20+ | Create, validate, balance check |
| `POST /api/vouchers/:id/post` | 10+ | Post, double post, locked |
| `GET /api/reports/*` | 10+ | Report generation, caching |
| `POST /api/ai/query` | 10+ | Text-to-SQL, error handling |

### 4.2. Test Data
```javascript
// tests/setup.js
import { pool } from '../config/db.js';

beforeAll(async () => {
  // Create test company
  await pool.query(`INSERT INTO companies (name, tax_code) 
    VALUES ('Test Company', 'TEST001')`);
  
  // Create test user
  await pool.query(`INSERT INTO users (username, password, role) 
    VALUES ('testuser', '$2b$10$...', 'admin')`);
  
  // Create test chart of accounts
  // Create test vouchers
});

afterAll(async () => {
  // Cleanup test data
  await pool.query('DELETE FROM vouchers WHERE company_id IN (SELECT id FROM companies WHERE tax_code = \'TEST001\')');
  await pool.query('DELETE FROM companies WHERE tax_code = \'TEST001\'');
});
```

---

## 5. Property-based Tests (fast-check)

### 5.1. Test Cases
```javascript
import fc from 'fast-check';

describe('Accounting Engine (Property-based)', () => {
  it('should always balance debit and credit', () => {
    fc.assert(
      fc.property(fc.array(fc.nat()), (amounts) => {
        const entries = amounts.map((amount, i) => ({
          account_code: '111',
          entry_type: i % 2 === 0 ? 'DR' : 'CR',
          amount
        }));
        
        const result = accountingEngine.validateEntries(entries);
        expect(result.isBalanced).toBe(true);
      })
    );
  });
});
```

---

## 6. Mutation Tests (Stryker)

### 6.1. Configuration
```json
// stryker.conf.json
{
  "mutate": [
    "services/**/*.js",
    "utils/**/*.js",
    "validators/**/*.js",
    "middleware/**/*.js"
  ],
  "thresholds": {
    "high": 80,
    "low": 60,
    "break": 70
  }
}
```

### 6.2. Run
```bash
npx stryker run
```

---

## 7. Performance Tests

### 7.1. API Performance Targets

| Endpoint | Target (p95) | Current |
|----------|-------------|---------|
| GET /api/vouchers | < 200ms | TBD |
| POST /api/vouchers | < 500ms | TBD |
| POST /api/vouchers/:id/post | < 1000ms | TBD |
| GET /api/reports/balance-sheet | < 5000ms | TBD |
| POST /api/ai/query | < 10000ms | TBD |

### 7.2. Load Test Scenarios
- 100 concurrent users
- 1000 transactions/minute
- Mixed read/write ratio (70:30)

---

## 8. Test Case Examples

### 8.1. Voucher Creation Test
```javascript
describe('POST /api/vouchers', () => {
  it('should create voucher with balanced DR/CR entries', async () => {
    const res = await request(app)
      .post('/api/vouchers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        company_id: 1,
        voucher_number: 'PT-TEST-001',
        voucher_date: '2026-07-23',
        voucher_type: 'PT',
        description: 'Test voucher',
        details: [
          { account_code: '111', entry_type: 'DR', amount: 100000 },
          { account_code: '511', entry_type: 'CR', amount: 100000 }
        ]
      });
    
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.details).toHaveLength(2);
  });
  
  it('should reject unbalanced entries', async () => {
    const res = await request(app)
      .post('/api/vouchers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        company_id: 1,
        voucher_number: 'PT-TEST-002',
        voucher_date: '2026-07-23',
        voucher_type: 'PT',
        description: 'Unbalanced test',
        details: [
          { account_code: '111', entry_type: 'DR', amount: 100000 },
          { account_code: '511', entry_type: 'CR', amount: 50000 }
        ]
      });
    
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('BUSINESS_RULE_VIOLATION');
  });
});
```

### 8.2. AI Copilot Test
```javascript
describe('POST /api/ai/query', () => {
  it('should return SQL and answer for valid question', async () => {
    const res = await request(app)
      .post('/api/ai/query')
      .set('Authorization', `Bearer ${token}`)
      .send({
        question: 'Tổng doanh thu tháng 7?',
        company_id: 1
      });
    
    expect(res.status).toBe(200);
    expect(res.body.data.sql).toContain('SELECT');
    expect(res.body.data.answer).toBeDefined();
    expect(res.body.data.confidence).toBeGreaterThan(80);
  });
});
```

---

## 9. Bug Report Template

```markdown
## Bug Report

**ID:** BUG-2026-001  
**Severity:** Critical / High / Medium / Low  
**Module:** Voucher Service  
**Reported by:** [Name]  
**Date:** 2026-07-23  

### Description
Mô tả ngắn gọn về lỗi

### Steps to Reproduce
1. Đăng nhập với tài khoản admin
2. Tạo chứng từ PT với số tiền > 1 tỷ
3. Nhấn "Ghi sổ"

### Expected Result
Chứng từ được ghi sổ thành công

### Actual Result
Lỗi 500 Internal Server Error

### Environment
- Backend version: 1.0.0
- Database: PostgreSQL 16
- Browser: Chrome 120

### Logs
```
2026-07-23 ERROR: [corr-xyz] Failed to post voucher: division by zero
```

### Screenshots
[Attach screenshots if applicable]
```

---

## 10. Test Summary Report

### 10.1. Report Format
```markdown
# Test Summary Report

**Date:** 2026-07-23  
**Build:** v1.0.0-build.123  
**Tester:** [Name]  

## Results
- Total Tests: 250
- Passed: 240 (96%)
- Failed: 5 (2%)
- Skipped: 5 (2%)

## Coverage
- Lines: 78%
- Branches: 72%
- Functions: 85%
- Statements: 80%

## Failed Tests
1. `VoucherService › createVoucher › should reject future date` - Date validation bug
2. `AIService › textToSQL › should handle complex queries` - Timeout

## Recommendations
- Fix date validation in voucher service
- Increase AI query timeout to 30s
```

### 10.2. Quality Gates
- ✅ All critical tests pass
- ✅ Coverage ≥ 70%
- ✅ Mutation score ≥ 70%
- ✅ No P0/P1 bugs open
- ✅ Performance within SLA