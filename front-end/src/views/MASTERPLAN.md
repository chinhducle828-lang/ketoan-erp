# MASTERPLAN - ERP KẾ TOÁN DOANH NGHIỆP
## Tích Hợp Storefront-ERP & Sẵn Sàng Sản Xuất

**Phiên bản:** 2.0  
**Ngày tạo:** 2026-01-07  
**Căn cứ pháp lý:** Thông tư 200/2014/TT-BTC, Thông tư 99/2025/TT-BTC  
**Trạng thái:** ⚠️ CẦN SỬA LỖI TRƯỚC KHI PRODUCTION

---

## MỤC LỤC

1. [Tổng Quan Dự Án](#1-tổng-quan-dự-án)
2. [Quy Trình Nghiệp Vụ Hiện Tại](#2-quy-trình-nghiệp-vụ-hiện-tại)
3. [Kiến Trúc Tích Hợp Storefront-ERP](#3-kiến-trúc-tích-hợp-storefront-erp)
4. [Lộ Trình Triển Khai](#4-lộ-trình-triển-khai)
5. [Đánh Giá Sẵn Sàng Production](#5-đánh-giá-sẵn-sàng-production)
6. [Danh Sách Lỗi Cần Sửa](#6-danh-sách-lỗi-cần-sửa)
7. [Kế Hoạch Sửa Lỗi](#7-kế-hoạch-sửa-lỗi)
8. [Tài Liệu Tham Khảo](#8-tài-liệu-tham-khảo)

---

## 1. TỔNG QUAN DỰ ÁN

### 1.1. Mục Tiêu

Xây dựng hệ thống ERP kế toán hoàn chỉnh, tuân thủ Thông tư 99/2025/TT-BTC, tích hợp với storefront để tự động hóa quy trình từ bán hàng đến kế toán.

### 1.2. Phạm Vi Hệ Thống

**22 Modules Chính:**
- Quản lý Quỹ & Tiền gửi ngân hàng
- Mua hàng & Nhập kho
- Bán hàng & Doanh thu
- Quản lý Đối tác (KH/NCC)
- Tính lương & Trích BHXH
- Báo cáo Thuế (GTGT, TNDN, TNCN)
- Báo cáo Tài chính (KQKD, B01-DN, B03-DN, B09-DN)
- Kết chuyển khóa sổ cuối kỳ
- Tài sản cố định & Khấu hao
- Tập hợp chi phí Giá thành
- Quản lý Chứng từ Tổng hợp
- Quản lý Kho Tổng hợp
- Dashboard Dòng tiền
- Logistics & Giao hàng
- Cấu hình pháp nhân
- Nhật ký An ninh & Hệ thống

### 1.3. Đối Tượng Sử Dụng

| Vai trò | Quyền hạn | Modules được phép |
|---------|-----------|-------------------|
| **Admin** | Toàn quyền | Tất cả 22 modules |
| **KTT** | Quản lý tài chính | 14 modules (trừ POS, Excel, Logistics) |
| **NV** | Nhập liệu | 6 modules cơ bản |
| **GD Kinh Doanh** | Xem báo cáo | 6 modules báo cáo |

### 1.4. Các Vấn Đề Hiện Tại

**Trạng thái hiện tại:** ❌ **KHÔNG SẴN SÀNG PRODUCTION**

**Lý do:**
- 7 lỗi CRITICAL cần sửa trước khi deploy
- Thiếu tích hợp storefront-ERP hoàn chỉnh
- Hardcoded giá trị không tuân thủ pháp luật
- Thiếu validation quan trọng

---

## 2. QUY TRÌNH NGHIỆP VỤ HIỆN TẠI

### 2.1. Luồng Nghiệp Vụ Chuẩn

```
┌─────────────────────────────────────────────────────────────┐
│ 1. KHỞI TẠO                                                │
│    ├── Cấu hình pháp nhân (Company Management)              │
│    └── Khai báo số dư đầu kỳ (OpeningBalances)             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. NGHIỆP VỤ THƯỜNG XUYÊN                                  │
│    ├── Quản lý Đối tác (PartnerManagement)                  │
│    │   └── Tạo KH/NCC với mã duy nhất                      │
│    ├── Mua hàng → Nhập kho (PurchaseInventory)              │
│    │   └── Tạo NK voucher với định khoản tự động            │
│    ├── Bán hàng → Xuất kho (AutoSalesExcel)                 │
│    │   └── Import Excel → Tạo PK voucher hàng loạt          │
│    ├── Quản lý Quỹ (CashManagement)                         │
│    │   ├── Phiếu Thu (PT) - Đa tiền tệ                      │
│    │   └── Phiếu Chi (PC) - Tỷ giá tự động                  │
│    └── Tính lương (Payroll)                                 │
│        └── TL voucher + Trích BHXH/BHYT/BHTN               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. NGHIỆP VỤ KẾ TOÁN                                       │
│    ├── Ghi sổ chứng từ (VoucherManagement)                  │
│    ├── Theo dõi công nợ (từ PT/PC/NK/PK)                   │
│    └── Đối chiếu tài khoản (IncomeStatement)                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. BÁO CÁO THUẾ                                            │
│    ├── Thuế GTGT (TaxReporting) - Mẫu 01/GTGT              │
│    ├── Thuế TNDN (IncomeStatement) - TK 3334                │
│    └── Thuế TNCN (TaxReporting) - TK 3335                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. BÁO CÁO TÀI CHÍNH                                       │
│    ├── Báo cáo KQKD (IncomeStatement)                       │
│    ├── Bảng Cân đối kế toán B01-DN (BalanceSheetB01)       │
│    ├── Báo cáo Lưu chuyển tiền tệ B03-DN                   │
│    └── Bản thuyết minh BCTC B09-DN                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. KẾT THÚC KỲ                                             │
│    ├── Kiểm tra sổ sách (ClosingProcess)                    │
│    ├── Kết chuyển khóa sổ tự động                           │
│    │   ├── Doanh thu (511, 515, 711) → 911                 │
│    │   ├── Chi phí (632, 635, 641, 642, 811) → 911         │
│    │   └── 911 → 421 (LNST chưa phân phối)                 │
│    └── Xuất báo cáo tài chính                               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2. Định Khoản Tự Động Hiện Tại

#### 2.2.1. Nhập Kho (NK) - PurchaseInventory.jsx
```javascript
// HIỆN TẠI (CÓ LỖI)
Nợ TK 156 (Hàng hóa) = Giá trị hàng
Nợ TK 1331 (Thuế GTGT) = Thuế GTGT
   Có TK 331 (Phải trả NCC) = Tổng cộng

// THIẾU: item_id, quantity, partner_id
```

#### 2.2.2. Phiếu Thu (PT) - CashManagement.jsx
```javascript
// HỖ TRỢ ĐA TIỀN TỆ
Nợ TK 1111/112 (Tiền mặt/Tiền gửi) = Số tiền × Tỷ giá
   Có TK 131/331 (Phải thu/Phải trả) = Số tiền

// KIỂM TRA: Cân đối Nợ = Có
// VẤN ĐỀ: Cho phép partnerId = null
```

#### 2.2.3. Bán Hàng Excel (PK) - AutoSalesExcel.jsx
```javascript
// ĐỒNG BỘ HÀNG LOẠT
Nợ TK 131 (Phải thu KH) = Tiền hàng + Thuế
   Có TK 511 (Doanh thu) = Tiền hàng
   Có TK 3331 (Thuế GTGT đầu ra) = Thuế

// TỰ ĐỘNG: Đọc Excel, tạo voucher cho mỗi hóa đơn
```

#### 2.2.4. Tính Lương (TL) - Payroll.jsx
```javascript
// 7 DÒNG BÚT TOÁN TỰ ĐỘNG
1. Nợ 6422 (Lương gộp) / Có 334 (Phải trả NLĐ)
2. Nợ 334 (Thuế TNCN) / Có 3331 (Thuế TNCN)
3. Nợ 6422 (BH DN) / Có 3383 (BHXH)
4. Nợ 334 (BH NLĐ) / Có 3383 (BHXH)
5. Nợ 334 (BH NLĐ) / Có 3384 (BHYT)
6. Nợ 334 (BH NLĐ) / Có 3386 (BHTN)

// TỶ LỆ: BHXH 25.5%, BHYT 4.5%, BHTN 2%
// VẤN ĐỀ: Hardcoded rates
```

### 2.3. Báo Cáo Tự Động

#### 2.3.1. Báo Cáo KQKD - IncomeStatement.jsx
```javascript
// 8 CHỈ TIÊU CHÍNH
I. Doanh thu thuần (511) - Có TK 511
II. Giá vốn (632) - Nợ TK 632
III. Lợi nhuận gộp = I - II
IV. Chi phí hoạt động (635, 641, 642)
V. Lợi nhuận thuần HĐKD = III + 515 - (635+641+642)
VI. Thu nhập/chi phí khác (711, 811)
VII. Lợi nhuận trước thuế = V + (711-811)
VIII. Chi phí thuế TNDN (821)
LNST = VII - 821

// VẤN ĐỀ: Thuế suất tính sai (dựa trên doanh thu năm trước)
```

#### 2.3.2. Báo Cáo Thuế - TaxReporting.jsx
```javascript
// THUẾ GTGT (Mẫu 01/GTGT)
Thuế đầu vào (1331 Nợ) - Từ chứng từ mua hàng
Thuế đầu ra (3331 Có) - Từ chứng từ bán hàng
Nghĩa vụ phải nộp = Đầu ra - Đầu vào

// THUẾ TNDN (TK 3334)
Phát sinh (Có 3334) - Từ TK 821
Đã nộp (Nợ 3334) - Từ chứng từ thuế
Trạng thái: Còn phải nộp hoặc Tạm nộp thừa

// THUẾ TNCN (TK 3335)
Khấu trừ (Có 3335) - Từ bảng lương
```

#### 2.3.3. Khóa Sổ Cuối Kỳ - ClosingProcess.jsx
```javascript
// TỰ ĐỘNG KẾT CHUYỂN
1. Doanh thu → 911
   Nợ 511, 515, 711 / Có 911

2. Chi phí → 911
   Nợ 911 / Có 632, 635, 641, 642, 811

3. Kết quả → 421
   Nợ 911 / Có 421 (LNST chưa phân phối)

// KIỂM TRA: Tổng Tài sản = Tổng Nguồn vốn
```

---

## 3. KIẾN TRÚC TÍCH HỢP STOREFRONT-ERP

### 3.1. Luồng Dữ Liệu Tích Hợp

```
┌─────────────────────────────────────────────────────────────────┐
│                    STOREFRONT LAYER                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ItemManagement.jsx                                      │  │
│  │  - Tạo sản phẩm mới                                      │  │
│  │  - Nhập: code, name, unit, price_sell                    │  │
│  │  - THÊM MỚI: unit_cost, opening_quantity, supplier_id    │  │
│  │  - Lưu vào items table                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓ POST /api/items                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PurchaseInventory.jsx                                   │  │
│  │  - Chọn sản phẩm từ danh mục                             │  │
│  │  - Nhập số lượng nhập kho                                │  │
│  │  - Chọn nhà cung cấp                                     │  │
│  │  - Hệ thống tự động:                                     │  │
│  │    * Tính giá trị hàng = qty × unit_cost                 │  │
│  │    * Tính thuế GTGT                                      │  │
│  │    * Sinh bút toán NK tự động                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                          ↓ POST /api/vouchers
┌─────────────────────────────────────────────────────────────────┐
│                      ERP ACCOUNTING ENGINE                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  VoucherManagement.jsx                                   │  │
│  │  - Lưu chứng từ NK                                       │  │
│  │  - Chi tiết:                                             │  │
│  │    * Nợ 156 (Hàng hóa) = qty × unit_cost                │  │
│  │    * Nợ 1331 (Thuế GTGT) = inventory_value × vat_rate   │  │
│  │    * Có 331 (Phải trả NCC) = total                      │  │
│  │  - Cập nhật số lượng tồn kho                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  InventoryManagement.jsx                                 │  │
│  │  - current_quantity += receipt_quantity                  │  │
│  │  - last_purchase_cost = unit_cost                        │  │
│  │  - last_purchase_date = voucher_date                     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────────┐
│                      REPORTING LAYER                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  CashFlowDashboard.jsx                                   │  │
│  │  - NK voucher → Phân loại:                               │  │
│  │    * Nợ 111/112: Cash outflow (immediate payment)        │  │
│  │    * Có 331: Increase in payables (deferred)             │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  IncomeStatement.jsx                                     │  │
│  │  - Đọc số liệu từ sổ cái                                │  │
│  │  - Tính KQKD theo TT 99/2025                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  TaxReporting.jsx                                        │  │
│  │  - Tổng hợp thuế GTGT, TNDN, TNCN                       │  │
│  │  - Xuất báo cáo thuế theo mẫu                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2. Schema Thiết Kế

#### 3.2.1. Items Table (Product Master)
```sql
CREATE TABLE items (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  item_code VARCHAR(50) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  description TEXT,
  unit VARCHAR(50) NOT NULL,
  unit_of_measure VARCHAR(50) DEFAULT 'Cái',
  
  -- Inventory Fields
  opening_quantity DECIMAL(15,3) DEFAULT 0,
  current_quantity DECIMAL(15,3) DEFAULT 0,
  unit_cost DECIMAL(15,2) DEFAULT 0,  -- Giá vốn mua vào
  
  -- Sales Fields
  price_sell DECIMAL(15,2) NOT NULL,
  
  -- Accounting Fields
  supplier_id INTEGER REFERENCES partners(id),
  inventory_account VARCHAR(20) DEFAULT '156',
  vat_input_account VARCHAR(20) DEFAULT '1331',
  vat_rate INTEGER DEFAULT 10 CHECK (vat_rate IN (0, 5, 10)),
  
  -- Metadata
  image_urls TEXT[],  -- Array of image URLs
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(company_id, item_code),
  CHECK (current_quantity >= 0)
);

CREATE INDEX idx_items_company ON items(company_id);
CREATE INDEX idx_items_code ON items(item_code);
```

#### 3.2.2. Voucher Details Enhancement
```sql
ALTER TABLE voucher_details ADD COLUMN IF NOT EXISTS item_id INTEGER REFERENCES items(id);
ALTER TABLE voucher_details ADD COLUMN IF NOT EXISTS quantity DECIMAL(15,3);
ALTER TABLE voucher_details ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(15,2);
ALTER TABLE voucher_details ADD COLUMN IF NOT EXISTS unit_of_measure VARCHAR(50);

-- Index for inventory queries
CREATE INDEX idx_voucher_details_item ON voucher_details(item_id);
```

### 3.3. API Endpoints

#### 3.3.1. Items API
```javascript
// GET /api/items?company_id=123
// Response: All items with inventory fields
{
  "success": true,
  "data": [
    {
      "id": 1,
      "company_id": 123,
      "item_code": "NGUYENLIEU01",
      "item_name": "Nguyên liệu A",
      "unit": "Kg",
      "unit_of_measure": "Kg",
      "opening_quantity": 100,
      "current_quantity": 250,
      "unit_cost": 50000,
      "price_sell": 80000,
      "supplier_id": 5,
      "inventory_account": "156",
      "vat_input_account": "1331",
      "vat_rate": 10
    }
  ]
}

// POST /api/items
// Request: FormData with all fields including images
// Response: Created item with ID

// PUT /api/items/:id
// Request: Updated fields
// Response: Updated item

// GET /api/items/suppliers?company_id=123
// Response: List of vendors for dropdown
{
  "success": true,
  "data": [
    { "id": 5, "partner_code": "NCC001", "partner_name": "Công ty ABC" }
  ]
}
```

#### 3.3.2. Vouchers API (Enhanced)
```javascript
// POST /api/vouchers
// Request for NK (Nhập Kho) voucher:
{
  "company_id": 123,
  "voucher_type": "NK",
  "voucher_date": "2026-01-07",
  "description": "Nhập kho: Nguyên liệu A - 50 Kg",
  "details": [
    {
      "account_code": "156",
      "entry_type": "DR",
      "amount": 2500000,  // 50 × 50000
      "item_id": 1,
      "quantity": 50,
      "unit_cost": 50000,
      "unit_of_measure": "Kg"
    },
    {
      "account_code": "1331",
      "entry_type": "DR",
      "amount": 250000,  // 10% VAT
      "item_id": 1,
      "quantity": 50
    },
    {
      "account_code": "331",
      "entry_type": "CR",
      "amount": 2750000,  // Total
      "partner_id": 5  // Supplier
    }
  ]
}

// Response:
{
  "success": true,
  "data": {
    "voucher_id": 456,
    "voucher_number": "NK-123456",
    "message": "Nhập kho thành công. Số lượng tồn kho đã cập nhật."
  }
}
```

### 3.4. Frontend Workflow

#### 3.4.1. ItemManagement.jsx - Enhanced Form
```javascript
const [form, setForm] = usePersistentState('item-management-form-v2', {
  code: '',
  name: '',
  description: '',
  unit: 'Cái',
  unit_of_measure: 'Cái',
  price_sell: '',
  unit_cost: '',  // NEW
  opening_quantity: '',  // NEW
  current_quantity: '',  // NEW
  supplier_id: '',  // NEW
  inventory_account: '156',  // NEW
  vat_input_account: '1331',  // NEW
  vat_rate: 10  // NEW
});

// Form submission sends all fields to /api/items
// Fetches suppliers from /api/items/suppliers?company_id=...
```

#### 3.4.2. PurchaseInventory.jsx - Enhanced Workflow
```javascript
const [form, setForm] = useState({
  mode: 'existing',  // 'existing' or 'new'
  item_id: '',
  item_code: '',
  item_name: '',
  quantity: '',
  unit_cost: '',
  vat_rate: '10',
  supplier_id: '',
  description: ''
});

// Workflow:
// 1. Select existing item OR create new
// 2. Auto-fill unit_cost, inventory_account from item master
// 3. Enter receipt quantity
// 4. System calculates: inventory_value, vat_amount, total
// 5. Select supplier
// 6. Preview journal entry
// 7. Submit → Creates NK voucher
```

---

## 4. LỘ TRÌNH TRIỂN KHAI

### Phase 1: Backend API Enhancement (8-10 giờ)

#### 1.1. Items API Enhancement (3-4 giờ)
- [ ] Update items table schema with inventory fields
- [ ] Enhance POST /api/items to accept inventory fields
- [ ] Enhance GET /api/items to return all fields
- [ ] Add PUT /api/items/:id for updates
- [ ] Add GET /api/items/suppliers endpoint
- [ ] Add validation for item_code uniqueness per company
- [ ] Add validation for positive quantities and costs

#### 1.2. Vouchers API Enhancement (3-4 giờ)
- [ ] Add NK voucher validation schema
- [ ] Implement automatic journal entry generation for NK vouchers
- [ ] Add item_id and quantity tracking
- [ ] Implement inventory quantity update on NK voucher creation
- [ ] Add lock date validation
- [ ] Add company active state validation
- [ ] Implement audit logging

#### 1.3. Validation Rules (2 giờ)
- [ ] Create inventoryReceiptSchema in validation.js
- [ ] Add DR = CR balance validation
- [ ] Add account code validation against chart of accounts
- [ ] Add partner type validation (vendor for NK, customer for PT)
- [ ] Add voucher date range validation

### Phase 2: Frontend Enhancement (6-8 giờ)

#### 2.1. ItemManagement.jsx (2-3 giờ)
- [ ] Add unit_cost input field
- [ ] Add opening_quantity input field
- [ ] Add current_quantity input field
- [ ] Add supplier dropdown (fetch from /api/items/suppliers)
- [ ] Add vat_rate selector (0%, 5%, 10%)
- [ ] Add inventory_account input (default 156)
- [ ] Add vat_input_account input (default 1331)
- [ ] Update form submission to send all fields
- [ ] Add validation for positive numbers
- [ ] Display success message with inventory summary

#### 2.2. PurchaseInventory.jsx (2-3 giờ)
- [ ] Add item selection dropdown (fetch from /api/items)
- [ ] Add "Create New Item" button with modal
- [ ] Auto-fill unit_cost, inventory_account, vat_rate on item selection
- [ ] Add quantity input field
- [ ] Add supplier dropdown
- [ ] Add payment type selection (immediate vs deferred)
- [ ] Implement real-time calculation: inventory_value, vat_amount, total
- [ ] Add journal entry preview
- [ ] Enhance validation

#### 2.3. VoucherManagement.jsx (1-2 giờ)
- [ ] Display item code and name in voucher details
- [ ] Show quantity and unit cost
- [ ] Add link to item master
- [ ] Color-code by voucher type
- [ ] Add filter by voucher type
- [ ] Add search by item code/name

#### 2.4. CashFlowDashboard.jsx (1 giờ)
- [ ] Include NK vouchers in cash flow calculations
- [ ] Distinguish immediate vs deferred payments
- [ ] Show accounts payable from deferred payments
- [ ] Add drill-down to voucher details

### Phase 3: Critical Bug Fixes (20-30 giờ)

#### 3.1. IncomeStatement.jsx - Tax Rate Fix (2 giờ)
- [ ] Remove progressive tax rate calculation
- [ ] Implement flat 20% CIT rate (or configurable)
- [ ] Use current year taxable income, not prior year revenue
- [ ] Add tax rate configuration table
- [ ] Support multiple revenue accounts (5111-5119)

#### 3.2. PurchaseInventory.jsx - Missing Fields (3 giờ)
- [ ] Add item_id to voucher details
- [ ] Add quantity to voucher details
- [ ] Add partner_id to voucher details
- [ ] Add unit_cost to voucher details
- [ ] Implement inventory quantity update
- [ ] Add validation for required fields

#### 3.3. CashManagement.jsx - Partner Validation (2 giờ)
- [ ] Add partner existence validation
- [ ] Add partner type validation (customer vs vendor)
- [ ] Prevent NULL partner_id for PT/PC vouchers
- [ ] Add partner dropdown with search
- [ ] Display partner name in voucher list

#### 3.4. Payroll.jsx - Configurable Insurance Rates (3 giờ)
- [ ] Create insurance_rates table
- [ ] Move hardcoded rates to database
- [ ] Add admin UI for rate configuration
- [ ] Add maximum insurance base validation (46.8M)
- [ ] Add minimum base validation (regional wage)
- [ ] Support historical rates by date

#### 3.5. TaxReporting.jsx - Account Code Support (2 giờ)
- [ ] Support detailed VAT accounts (13311, 13312, 33311, 33312)
- [ ] Add chart of accounts lookup
- [ ] Handle VAT refunds (negative amounts)
- [ ] Validate account codes exist
- [ ] Support multiple TNDN accounts

#### 3.6. ClosingProcess.jsx - Dynamic Account Dictionary (3 giờ)
- [ ] Move ACCOUNT_DICTIONARY to database
- [ ] Create chart_of_accounts table
- [ ] Support TC99 detailed accounts
- [ ] Support company-specific account structures
- [ ] Add admin UI for account management
- [ ] Load accounts dynamically from API

#### 3.7. Lock Date Validation (3 giờ)
- [ ] Add lock_date field to companies table
- [ ] Implement checkLockDate() function
- [ ] Add validation to all voucher creation endpoints
- [ ] Display lock date in UI
- [ ] Add admin function to set lock date
- [ ] Prevent modification of locked period vouchers

#### 3.8. Company Active State (2 giờ)
- [ ] Add is_active field to companies table
- [ ] Validate activeCompany.is_active in all modules
- [ ] Display warning for inactive companies
- [ ] Prevent transactions for inactive companies

### Phase 4: Testing & Documentation (8-10 giờ)

#### 4.1. Unit Testing (4-5 giờ)
- [ ] Test NK voucher creation with VAT
- [ ] Test NK voucher creation without VAT
- [ ] Test inventory quantity updates
- [ ] Test tax rate calculations
- [ ] Test insurance calculations
- [ ] Test lock date validation
- [ ] Test company active state validation
- [ ] Test DR = CR balance validation

#### 4.2. Integration Testing (2-3 giờ)
- [ ] Test complete storefront-to-ERP workflow
- [ ] Test multi-company data isolation
- [ ] Test concurrent voucher creation
- [ ] Test year-end closing process
- [ ] Test report generation accuracy

#### 4.3. Documentation (2 giờ)
- [ ] Update QUY_TRINH_NGHIEP_VU.md with fixes
- [ ] Create API documentation
- [ ] Create user guide for storefront-ERP workflow
- [ ] Document accounting entry templates
- [ ] Create troubleshooting guide

---

## 5. ĐÁNH GIÁ SẴN SÀNG PRODUCTION

### 5.1. Kết Quả Audit

**Tổng lỗi phát hiện:** 14 lỗi

| Mức độ | Số lượng | Mô tả |
|--------|----------|-------|
| 🔴 CRITICAL | 8 | Block production, legal non-compliance |
| 🟠 HIGH | 3 | Major functionality issues |
| 🟡 MEDIUM | 3 | Usability/validation issues |

### 5.2. Chi Tiết Lỗi CRITICAL

#### ❌ 1. IncomeStatement.jsx - Thuế Suất Tính Sai
**Vị trí:** Lines 17-24  
**Mô tả:** Sử dụng doanh thu năm trước để tính thuế suất TNDN năm hiện tại  
**Vấn đề pháp lý:** Vi phạm Thông tư 200/2014/TT-BTC  
**Hậu quả:** Báo cáo thuế không chính xác, có thể dẫn đến phạt thuế  
**Sửa:** Dùng thuế suất 20% cố định hoặc theo quy định hiện hành

#### ❌ 2. PurchaseInventory.jsx - Thiếu Trường Quan Trọng
**Vị trí:** Lines 24-30  
**Mô tả:** Không có item_id, quantity, partner_id  
**Vấn đề:** Không thể theo dõi tồn kho, không liên kết được với NCC  
**Hậu quả:** Không quản lý được kho, không có audit trail  
**Sửa:** Thêm đầy đủ các trường vào voucher details

#### ❌ 3. CashManagement.jsx - Cho Phép Partner NULL
**Vị trí:** Line 51  
**Mô tả:** partnerId có thể null  
**Vấn đề:** Giao dịch tiền mặt không thể truy xuất được  
**Hậu quả:** Không đáp ứng yêu cầu kiểm toán, audit trail không đầy đủ  
**Sửa:** Bắt buộc phải chọn đối tác

#### ❌ 4. Payroll.jsx - Tỷ Lệ BHXH Hardcoded
**Vị trí:** Lines 37-43  
**Mô tả:** Tỷ lệ bảo hiểm hardcoded (21.5%, 10.5%, 25.5%, 4.5%, 2%)  
**Vấn đề:** Khi pháp luật thay đổi, hệ thống tính sai  
**Hậu quả:** Tính lương sai, trích BHXH không đúng quy định  
**Sửa:** Lưu tỷ lệ vào database, có UI cập nhật

#### ❌ 5. TaxReporting.jsx - Giả Định Mã Tài Khoản
**Vị trí:** Lines 28-45  
**Mô tả:** Chỉ dùng 1331, 3331, 3334, 3335  
**Vấn đề:** Bỏ sót tài khoản chi tiết (13311, 13312, 33311, 33312)  
**Hậu quả:** Báo cáo thuế thiếu số liệu  
**Sửa:** Hỗ trợ cả tài khoản tổng và chi tiết

#### ❌ 6. ClosingProcess.jsx - Danh Mục TK Tĩnh
**Vị trí:** Lines 8-29  
**Mô tả:** ACCOUNT_DICTIONARY hardcoded 20 tài khoản  
**Vấn đề:** Thiếu nhiều tài khoản (621, 622, 627, 632, 641, 642...)  
**Hậu quả:** Bảng cân đối kế toán thiếu sót  
**Sửa:** Lấy danh mục từ database

#### ❌ 7. ALL MODULES - Thiếu Lock Date Validation
**Vị trí:** Tất cả modules tạo voucher  
**Mô tả:** Không kiểm tra ngày chứng từ có bị khóa không  
**Vấn đề:** Người dùng có thể nhập ngày trong kỳ đã khóa  
**Hậu quả:** Sổ sách bị thay đổi sau khi khóa, vi phạm audit  
**Sửa:** Thêm validation ở tất cả endpoints tạo voucher

#### ❌ 8. ALL MODULES - Thiếu Company Active Check
**Vị trí:** Tất cả modules  
**Mô tả:** Không kiểm tra công ty có đang active không  
**Vấn đề:** Giao dịch có thể tạo cho công ty đã ngừng hoạt động  
**Hậu quả:** Dữ liệu không nhất quán  
**Sửa:** Thêm check ở tất cả endpoints

### 5.3. Chi Tiết Lỗi HIGH

#### 🟠 9. IncomeStatement.jsx - Chỉ Dùng TK 511
**Vấn đề:** Bỏ sót TK 5111-5119 (doanh thu chi tiết)  
**Sửa:** Sum tất cả TK 51XX

#### 🟠 10. AutoSalesExcel.jsx - Không Báo Lỗi Chi Tiết
**Vấn đề:** Filter silent không báo dòng nào lỗi  
**Sửa:** Log và hiển thị các dòng bị bỏ

#### 🟠 11. PartnerManagement.jsx - Không Check Trùng Mã
**Vấn đề:** Không check trùng mã trước khi gửi API  
**Sửa:** Thêm frontend validation

### 5.4. Chi Tiết Lỗi MEDIUM

#### 🟡 12. Payroll.jsx - Không Validate Base BHXH
**Vấn đề:** Không check max base (46.8M)  
**Sửa:** Thêm validation

#### 🟡 13. CashManagement.jsx - Không Validate Tỷ Giá
**Vấn đề:** Không check tỷ giá âm  
**Sửa:** Thêm validation

#### 🟡 14. PurchaseInventory.jsx - Không Validate TK Kho
**Vấn đề:** Không check TK 156 có tồn tại không  
**Sửa:** Thêm validation

### 5.5. Kết Luận Đánh Giá

**Điểm Sẵn Sàng Production:** 3/10

**Khuyến nghị:**
1. ❌ **KHÔNG ĐƯỢC** deploy production trong tình trạng hiện tại
2. ✅ Cần sửa tối thiểu 7 lỗi CRITICAL trước
3. ✅ Ước tính 40-60 giờ sửa lỗi
4. ✅ Cần test kỹ lưỡng sau khi sửa
5. ✅ Nên có accountant review bút toán trước khi go-live

---

## 6. DANH SÁCH LỖI CẦN SỬA

### CRITICAL (Block Production)

| # | File | Vị trí | Lỗi | Sửa | Thời gian |
|---|------|--------|-----|-----|-----------|
| 1 | IncomeStatement.jsx | L17-24 | Thuế suất tính sai | Dùng 20% flat | 2h |
| 2 | PurchaseInventory.jsx | L24-30 | Thiếu item_id, qty, partner_id | Thêm đầy đủ | 3h |
| 3 | CashManagement.jsx | L51 | Cho phép partner NULL | Bắt buộc chọn partner | 2h |
| 4 | Payroll.jsx | L37-43 | Hardcoded insurance rates | Configurable | 3h |
| 5 | TaxReporting.jsx | L28-45 | Chỉ dùng TK tổng | Hỗ trợ TK chi tiết | 2h |
| 6 | ClosingProcess.jsx | L8-29 | Danh mục TK tĩnh | Dynamic from DB | 3h |
| 7 | ALL | All | Thiếu lock date | Add validation | 3h |
| 8 | ALL | All | Thiếu company check | Add validation | 2h |

### HIGH (Major Issues)

| # | File | Vị trí | Lỗi | Sửa | Thời gian |
|---|------|--------|-----|-----|-----------|
| 9 | IncomeStatement.jsx | L81 | Chỉ dùng TK 511 | Sum 5111-5119 | 1h |
| 10 | AutoSalesExcel.jsx | L24-29 | Silent filter | Log errors | 1h |
| 11 | PartnerManagement.jsx | L18-33 | No duplicate check | Frontend validation | 1h |

### MEDIUM (Nice to Have)

| # | File | Vị trí | Lỗi | Sửa | Thời gian |
|---|------|--------|-----|-----|-----------|
| 12 | Payroll.jsx | L37-43 | No base validation | Add max/min check | 1h |
| 13 | CashManagement.jsx | L100 | No rate validation | Add check | 0.5h |
| 14 | PurchaseInventory.jsx | L25 | No account validation | Add check | 0.5h |

---

## 7. KẾ HOẠCH SỬA LỖI

### Sprint 1: Critical Fixes (Tuần 1-2)

**Mục tiêu:** Đạt production-ready status

**Ngày 1-2: Tax & Reporting**
- [ ] Fix IncomeStatement.jsx tax rate calculation
- [ ] Add support for multiple revenue accounts
- [ ] Test with sample data

**Ngày 3-5: Inventory & Purchasing**
- [ ] Enhance PurchaseInventory.jsx with item_id, quantity, partner_id
- [ ] Update backend to handle new fields
- [ ] Implement inventory quantity tracking
- [ ] Test NK voucher creation

**Ngày 6-7: Cash & Partners**
- [ ] Add partner validation in CashManagement.jsx
- [ ] Add duplicate check in PartnerManagement.jsx
- [ ] Test partner workflows

### Sprint 2: Configuration & Validation (Tuần 3)

**Ngày 8-10: Payroll**
- [ ] Create insurance_rates table
- [ ] Move hardcoded rates to database
- [ ] Add admin UI for rate management
- [ ] Add base validation
- [ ] Test payroll calculations

**Ngày 11-12: Tax & Closing**
- [ ] Update TaxReporting.jsx for detailed accounts
- [ ] Make ClosingProcess.jsx account dictionary dynamic
- [ ] Test tax reports

**Ngày 13-14: System-wide**
- [ ] Implement lock date validation
- [ ] Implement company active check
- [ ] Test all modules

### Sprint 3: Storefront Integration (Tuần 4-5)

**Ngày 15-17: Backend**
- [ ] Enhance items API with inventory fields
- [ ] Add suppliers endpoint
- [ ] Update voucher creation for NK with items
- [ ] Test API endpoints

**Ngày 18-21: Frontend**
- [ ] Update ItemManagement.jsx with inventory fields
- [ ] Enhance PurchaseInventory.jsx workflow
- [ ] Update VoucherManagement.jsx display
- [ ] Update CashFlowDashboard.jsx
- [ ] Test complete workflow

### Sprint 4: Testing & Documentation (Tuần 6)

**Ngày 22-24: Testing**
- [ ] Unit tests for all fixes
- [ ] Integration tests
- [ ] User acceptance testing
- [ ] Performance testing

**Ngày 25-26: Documentation**
- [ ] Update QUY_TRINH_NGHIEP_VU.md
- [ ] Create API documentation
- [ ] Create user guides
- [ ] Create troubleshooting guide

**Ngày 27-28: Deployment Prep**
- [ ] Code review
- [ ] Security audit
- [ ] Backup strategy
- [ ] Rollback plan

---

## 8. TÀI LIỆU THAM KHẢO

### 8.1. Văn Bản Pháp Lý

1. **Thông tư 200/2014/TT-BTC** - Chuẩn mực kế toán Việt Nam
2. **Thông tư 99/2025/TT-BTC** - Sửa đổi, bổ sung chuẩn mực kế toán
3. **Luật Kế toán 2015** - Sửa đổi 2019
4. **Nghị định 200/2014/NĐ-CP** - Chi tiết hướng dẫn kế toán

### 8.2. Tài Liệu Hệ Thống

1. **QUY_TRINH_NGHIEP_VU.md** - Tổng hợp quy trình nghiệp vụ (đã tạo)
2. **API_REFERENCE.md** - Tài liệu API endpoints (cần tạo)
3. **ACCOUNTING_WORKFLOW.md** - Mẫu bút toán (cần tạo)
4. **STOREfront_ERP_INTEGRATION.md** - Kiến trúc tích hợp (cần tạo)

### 8.3. Công Cụ & Công Nghệ

- **Frontend:** React, Tailwind CSS, Lucide icons
- **Backend:** Node.js, Express, PostgreSQL
- **Authentication:** JWT tokens
- **File Upload:** Multer (images), XLSX (Excel import)
- **Validation:** Custom validation schemas

---

## PHỤ LỤC

### A. Mã Tài Khoản Tham Chiếu

**Theo Thông tư 99/2025/TT-BTC:**

| TK | Tên | Loại |
|----|-----|------|
| 111 | Tiền mặt | Tài sản ngắn hạn |
| 112 | Tiền gửi ngân hàng | Tài sản ngắn hạn |
| 131 | Phải thu khách hàng | Tài sản ngắn hạn |
| 1331 | Thuế GTGT được khấu trừ | Tài sản ngắn hạn |
| 133 | Thuế GTGT | Tài sản ngắn hạn |
| 138 | Phải thu khác | Tài sản ngắn hạn |
| 141 | Tạm ứng | Tài sản ngắn hạn |
| 152 | Nguyên liệu, vật liệu | Tài sản ngắn hạn |
| 153 | Công cụ, dụng cụ | Tài sản ngắn hạn |
| 156 | Hàng hóa kho tổng | Tài sản ngắn hạn |
| 211 | TSCĐ hữu hình | Tài sản dài hạn |
| 214 | Hao mòn TSCĐ | Tài sản dài hạn |
| 331 | Phải trả người bán | Nợ phải trả |
| 333 | Thuế và các khoản phải nộp NSNN | Nợ phải trả |
| 3331 | Thuế GTGT phải nộp | Nợ phải trả |
| 3334 | Thuế TNDN phải nộp | Nợ phải trả |
| 3335 | Thuế TNCN phải nộp | Nợ phải trả |
| 334 | Phải trả người lao động | Nợ phải trả |
| 3383 | Nghĩa vụ BHXH | Nợ phải trả |
| 3384 | Nghĩa vụ BHYT | Nợ phải trả |
| 3386 | Nghĩa vụ BHTN | Nợ phải trả |
| 341 | Vay và nợ thuê tài chính | Nợ phải trả |
| 411 | Vốn đầu tư của chủ sở hữu | Vốn chủ sở hữu |
| 421 | LNST chưa phân phối | Vốn chủ sở hữu |
| 511 | Doanh thu bán hàng | Doanh thu |
| 515 | Doanh thu hoạt động tài chính | Doanh thu |
| 632 | Giá vốn hàng bán | Chi phí |
| 635 | Chi phí tài chính | Chi phí |
| 641 | Chi phí bán hàng | Chi phí |
| 642 | Chi phí quản lý doanh nghiệp | Chi phí |
| 6422 | Chi phí tiền lương | Chi phí |
| 711 | Thu nhập khác | Thu nhập |
| 811 | Chi phí khác | Chi phí |
| 821 | Chi phí thuế TNDN | Chi phí |
| 911 | Xác định kết quả kinh doanh | Tạm tính |

### B. Tỷ Lệ Bảo Hiểm Hiện Hành

| Loại | Tỷ lệ DN | Tỷ lệ NLĐ | Tổng |
|------|----------|-----------|------|
| BHXH | 17.5% | 8% | 25.5% |
| BHYT | 3% | 1.5% | 4.5% |
| BHTN | 1% | 1% | 2% |
| **Tổng DN** | **21.5%** | | |
| **Tổng NLĐ** | | **10.5%** | |

**Lưu ý:** Tỷ lệ có thể thay đổi theo quy định pháp luật. Cần cập nhật thường xuyên.

**Mức đóng BHXH tối đa:** 46.8 triệu/tháng (năm 2026)  
**Mức lương tối thiểu vùng:** Theo từng vùng (Vùng I: 4.96M, Vùng II: 4.41M, Vùng III: 3.9M, Vùng IV: 3.5M)

### C. Thuế Suất Thuế TNDN

| Điều kiện | Thuế suất |
|-----------|-----------|
| Doanh thu ≤ 3 tỷ/năm | 15% |
| Doanh thu > 3 tỷ và ≤ 50 tỷ/năm | 17% |
| Doanh thu > 50 tỷ/năm | 20% |

**Lưu ý:** Từ năm 2026, thuế suất TNDN là 20% cố định theo Luật Thuế TNDN sửa đổi.

---

**KẾT THÚC MASTERPLAN**

**Hành động tiếp theo:**
1. Review và approve masterplan này
2. Toggle sang Act mode để bắt đầu sửa lỗi
3. Hoặc yêu cầu điều chỉnh kế hoạch

**Liên hệ:** Đội ngũ phát triển ERP  
**Cập nhật lần cuối:** 2026-01-07