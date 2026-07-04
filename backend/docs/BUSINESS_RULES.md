# Business Rules Configuration Guide

## Overview

Hệ thống ERP Kế toán sử dụng cơ chế cấu hình rules linh hoạt thông qua biến môi trường `BUSINESS_RULES_JSON`. Cấu trúc này cho phép tùy chỉnh hành vi nghiệp vụ mà không cần thay đổi code.

## Cấu trúc BUSINESS_RULES_JSON

```json
{
  "pricing": {
    "amountPrecision": 2,
    "taxPrecision": 2,
    "defaultTaxRate": 0.1,
    "minOrderQuantity": 1
  },
  "voucher": {
    "storefrontPrefix": "WEB",
    "saleVoucherType": "XK"
  },
  "accounting": {
    "general": {
      "hermaphroditicAccounts": ["131", "331", "138", "338", "3334", "3335", "3381"]
    },
    "sale": {
      "receivableAccount": "131",
      "revenueAccount": "511",
      "vatAccount": "3331",
      "cogsAccount": "632",
      "inventoryAccount": "156"
    },
    "closing": {
      "voucherType": "DauKy",
      "defaultTaxRate": 0.2,
      "progressiveTaxBrackets": [
        { "maxRevenue": 3000000000, "rate": 0.15 },
        { "maxRevenue": 50000000000, "rate": 0.17 },
        { "maxRevenue": null, "rate": 0.2 }
      ],
      "accounts": {
        "revenue": "511",
        "cost": ["632", "641", "642"],
        "closing": "911"
      },
      "rates": {
        "depreciationAnnualRate": 0.2,
        "doubtfulDebtProvisionRate": 0.1
      }
    },
    "inventory": {
      "inboundVoucherType": "NK",
      "outboundVoucherType": "XK",
      "allocationVoucherType": "DauKy",
      "accounts": {
        "inventory": "156",
        "logistics": "1562",
        "logisticsCost": ["632", "641", "642"],
        "allocationCredit": "632"
      }
    }
  },
  "reporting": {
    "cashFlow": {
      "cashAccountPrefixes": ["111", "112"],
      "directMethod": {
        "salesCounterpartPrefixes": ["511", "3331", "131"]
      },
      "indirectMethod": {
        "revenuePrefixes": ["5"],
        "expensePrefixes": ["6"]
      }
    },
    "balanceSheet": {
      "customerDualAccounts": {
        "receivable": "131",
        "customerAdvance": "312"
      },
      "taxAccounts": ["3331", "3334", "3339"]
    }
  }
}
```

## Rule Groups

### 1. Pricing Rules
- `amountPrecision`: Độ chính xác số lượng (mặc định: 2)
- `taxPrecision`: Độ chính xác thuế (mặc định: 2)
- `defaultTaxRate`: Thuế suất mặc định (mặc định: 0.1 = 10%)
- `minOrderQuantity`: Số lượng đặt hàng tối thiểu (mặc định: 1)

### 2. Voucher Rules
- `storefrontPrefix`: Tiền tố mã đơn hàng web (mặc định: "WEB")
- `saleVoucherType`: Loại chứng từ bán hàng (mặc định: "XK")

### 3. Accounting Rules

#### General
- `hermaphroditicAccounts`: Danh sách tài khoản lưỡng tính cần theo dõi chi tiết theo đối tác

#### Sale
- `receivableAccount`: Tài khoản phải thu khách hàng (mặc định: "131")
- `revenueAccount`: Tài khoản doanh thu (mặc định: "511")
- `vatAccount`: Tài khoản VAT (mặc định: "3331")
- `cogsAccount`: Tài khoản giá vốn (mặc định: "632")
- `inventoryAccount`: Tài khoản tồn kho (mặc định: "156")

#### Closing
- `voucherType`: Loại chứng từ kết chuyển (mặc định: "DauKy")
- `defaultTaxRate`: Thuế suất mặc định TNDN (mặc định: 0.2)
- `progressiveTaxBrackets`: Bảng thuế suất lũy tiến TNDN
  - `maxRevenue`: Mức doanh thu tối đa (null = vô hạn)
  - `rate`: Thuế suất áp dụng
- `accounts`: Các tài khoản kết chuyển
- `rates`: Các tỷ lệ tính toán (khấu hao, dự phòng...)

#### Inventory
- `inboundVoucherType`: Loại chứng từ nhập kho (mặc định: "NK")
- `outboundVoucherType`: Loại chứng từ xuất kho (mặc định: "XK")
- `allocationVoucherType`: Loại chứng từ phân bổ (mặc định: "DauKy")
- `accounts`: Các tài khoản kho
  - `inventory`: Tài khoản kho (mặc định: "156")
  - `logistics`: Tài khoản logistics (mặc định: "1562")
  - `logisticsCost`: Các tài khoản chi phí logistics (mặc định: ["632", "641", "642"])
  - `allocationCredit`: Tài khoản có khi phân bổ (mặc định: "632")

### 4. Reporting Rules

#### Cash Flow
- `cashAccountPrefixes`: Tiền tố tài khoản tiền mặt (mặc định: ["111", "112"])
- `directMethod`: Cấu hình phương pháp trực tiếp
- `indirectMethod`: Cấu hình phương pháp gián tiếp

#### Balance Sheet
- `customerDualAccounts`: Tài khoản công nợ khách hàng
- `taxAccounts`: Các tài khoản thuế
- `accountGroups`: Nhóm tài khoản theo tiền tố

## Fallback Behavior

Hệ thống tự động áp dụng giá trị mặc định khi:
1. Rule không được cấu hình
2. Rule có kiểu dữ liệu sai
3. Rule là null hoặc mảng rỗng

Ví dụ:
- `logisticsCost: null` → fallback về `["632", "641", "642"]`
- `cost: []` → fallback về `["632", "641", "642"]`
- `saleVoucherType: ""` → fallback về `"XK"`

## Validation

Hệ thống sẽ log cảnh báo khi khởi động nếu:
- `progressiveTaxBrackets` không phải mảng
- `rate` không phải số hợp lệ
- `maxRevenue` không phải số hoặc null
- `logisticsCost` không phải mảng
- `cost` không phải mảng

## Usage Example

### Trong code:
```javascript
import { getInventoryRules, getClosingRules, getCashFlowRules } from '../config/businessRules.js';

// Lấy cấu hình kho
const inventoryRules = getInventoryRules();
const inventoryAccount = inventoryRules.accounts.inventory; // "156" hoặc giá trị override

// Lấy cấu hình kết chuyển
const closingRules = getClosingRules();
const taxBrackets = closingRules.progressiveTaxBrackets;

// Lấy cấu hình lưu chuyển tiền tệ
const cashFlowRules = getCashFlowRules();
const cashPrefixes = cashFlowRules.cashAccountPrefixes;
```

### Trong .env:
```bash
BUSINESS_RULES_JSON={"accounting":{"inventory":{"accounts":{"inventory":"1569"}}}}
```

## Risk & Rollback

### Rủi ro còn lại:
1. **Thay đổi rule ảnh hưởng tới dữ liệu đã có**: Cần chạy so sánh trước/sau khi thay đổi rule
2. **Rule mới không tương thích**: Hệ thống sẽ dùng fallback, nhưng có thể gây kết quả không mong muốn

### Phương án rollback:
1. Xóa biến `BUSINESS_RULES_JSON` hoặc đặt lại giá trị cũ
2. Khởi động lại server
3. Chạy test để xác nhận hành vi trở lại bình thường