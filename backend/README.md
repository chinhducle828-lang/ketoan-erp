# ERP Kế Toán Backend

## Tổng quan

Backend API cho hệ thống ERP kế toán, hỗ trợ rule-driven configuration cho các nghiệp vụ kế toán, kho, và vận hành.

## Cài đặt

```bash
npm install
```

## Chạy server

```bash
npm start
# hoặc
node server.js
```

## Cấu hình Business Rules

Hệ thống sử dụng biến môi trường `BUSINESS_RULES_JSON` để cấu hình các quy tắc nghiệp vụ.

Xem chi tiết tại: [docs/BUSINESS_RULES.md](./docs/BUSINESS_RULES.md)

## Test

```bash
# Chạy tất cả test
npm test

# Chạy test rule cụ thể
npm test -- --testPathPatterns="businessRulesPhase3|inventoryService|closingService|cashFlowEngine"
```

## API Endpoints

- `/api/vouchers` - Quản lý chứng từ kế toán
- `/api/logistics` - Vận hành logistics (xuất kho)
- `/api/inventory` - Quản lý kho
- `/api/report` - Báo cáo tài chính
- `/api/auth` - Xác thực người dùng

## Phase 4 - Rule Engine Improvements

### Đã hoàn thành:
1. **Loại bỏ hard-code** trong `logisticsRoutes.js` - Thay thế `'XK'` bằng rule từ `getLogisticsRules()`
2. **Chuẩn hoá key rule** - `accountingEngine.js` hỗ trợ cả `progressiveTaxBrackets` (mới) và `taxBracketsByRevenue` (legacy)
3. **Thêm validation** - `validateBusinessRules()` kiểm tra cấu hình trước khi dùng
4. **Cải thiện fallback** - Các hàm getter tự động fallback khi rule null/empty
5. **Mở rộng test suite** - Thêm test cho inventory, closing, cashflow rules

### Files đã chỉnh sửa:
- `backend/config/businessRules.js` - Thêm `getLogisticsRules()`, `validateBusinessRules()`, fallback logic
- `backend/routes/logisticsRoutes.js` - Loại bỏ hard-code voucher type
- `backend/utils/accountingEngine.js` - Hỗ trợ cả 2 key tax brackets
- `backend/server.js` - Thêm validation khi khởi động
- `backend/tests/businessRulesPhase3.test.js` - Mở rộng test cases
- `backend/tests/inventoryService.test.js` - Test mới
- `backend/tests/closingService.test.js` - Test mới
- `backend/tests/cashFlowEngine.test.js` - Test mới
- `backend/docs/BUSINESS_RULES.md` - Tài liệu hướng dẫn