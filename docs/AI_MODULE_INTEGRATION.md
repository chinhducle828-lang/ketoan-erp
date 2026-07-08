# AI Module Integration - Tích hợp AI vào các phân hệ

## Tổng quan

Hệ thống AI đã được tích hợp hoặc chuẩn bị tích hợp vào các phân hệ chính của Ketoan ERP.

## Ma trận AI Integration

| Phân hệ | Service AI | Trạng thái | API Endpoint |
|---------|-----------|-----------|--------------|
| **Vouchers** | aiOcr, aiProposal, hitl, aiSelfFix | ✅ Hoàn thành | `/api/ocr`, `/api/hitl/self-fix` |
| **Inventory** | aiInventory | ✅ Hoàn thành | - |
| **Cashflow** | aiCashflow | ✅ Hoàn thành | - |
| **Partners** | aiAging | ✅ Hoàn thành | - |
| **Casso/Bank** | cassoAI | ✅ Hoàn thành | - |
| **Reports** | reportAI | ✅ Hoàn thành | - |
| **Opening Balances** | aiOpeningBalance | 🆕 Mới tạo | `/api/predict-opening-balance` |
| **Closing** | aiClosingPredict | 🆕 Mới tạo | `/api/predict-closing` |
| **Logistics/Orders** | aiLogistics | 🆕 Mới tạo | `/api/optimize-route`, `/api/predict-delivery-time` |
| **Notifications** | aiNotification | 🆕 Mới tạo | `/api/analyze-notification-priority` |
| **E-Invoices** | aiEInvoice | 🆕 Mới tạo | `/api/verify-einvoice`, `/api/detect-fraud` |
| **HR** | aiHR | 🆕 Mới tạo | `/api/predict-salary`, `/api/analyze-kpi` |

## Chi tiết từng Module

### 1. Opening Balance (Số dư đầu kỳ)
**File:** `backend/services/aiOpeningBalance.service.js`

Chức năng:
- `predictOpeningBalance()` - Dự đoán số dư đầu kỳ dựa trên lịch sử 3 tháng
- `getOpeningBalanceSuggestions()` - Gợi ý hàng loạt các tài khoản

### 2. Closing Predict (Dự báo khóa sổ)
**File:** `backend/services/aiClosingPredict.service.js`

Chức năng:
- `predictClosingEntries()` - Dự báo bút toán khóa sổ
- `predictDepreciation()` - Dự báo chi phí khấu hao
- `predictVAT()` - Dự báo thuế VAT phải nộp

### 3. Logistics (Vận tải)
**File:** `backend/services/aiLogistics.service.js`

Chức năng:
- `optimizeDeliveryRoute()` - Tối ưu tuyến đường giao hàng
- `predictDeliveryTime()` - Dự báo thời gian giao hàng
- `predictWarehouseLoad()` - Dự báo tải trọng kho

### 4. Notification (Thông báo)
**File:** `backend/services/aiNotification.service.js`

Chức năng:
- `analyzeNotificationPriority()` - Phân tích độ ưu tiên thông báo
- `suggestNotificationTime()` - Gợi ý thời điểm gửi thông báo
- `summarizeDailyNotifications()` - Tóm tắt thông báo hàng ngày

### 5. E-Invoice (Hóa đơn điện tử)
**File:** `backend/services/aiEInvoice.service.js`

Chức năng:
- `verifyEInvoice()` - Xác thực hóa đơn điện tử
- `detectFraudulentInvoices()` - Phát hiện hóa đơn gian lận
- `reconcileInvoices()` - So sánh hóa đơn nhà cung cấp

### 6. HR (Nhân sự)
**File:** `backend/services/aiHR.service.js`

Chức năng:
- `predictSalaryCost()` - Dự báo chi phí lương
- `analyzeEmployeeKPI()` - Phân tích KPI nhân viên
- `predictRecruitmentNeeds()` - Dự báo nhu cầu tuyển dụng

## Cách sử dụng

### Import service trong controller:
```javascript
import { 
  predictOpeningBalance, 
  getOpeningBalanceSuggestions 
} from '../services/aiOpeningBalance.service.js';
```

### Gọi AI service:
```javascript
// Dự đoán số dư đầu kỳ
const prediction = await predictOpeningBalance(companyId, '111', '2025-01');

// Dự báo lương
const salary = await predictSalaryCost(companyId, '2025-01');
```

## API Endpoints trên Python AI Service

Tất cả các API endpoint đã được triển khai:

| Endpoint | Chức năng |
|----------|----------|
| `/api/ocr` | Xử lý OCR hóa đơn |
| `/api/self-fix` | AI tự sửa lỗi |
| `/api/fine-tune` | Huấn luyện lại model (RLHF) |
| `/api/text-to-sql` | Chuyển câu hỏi thành SQL |
| `/api/rag-summarize` | Tóm tắt dữ liệu bằng RAG |
| `/api/predict-opening-balance` | Dự đoán số dư đầu kỳ |
| `/api/predict-closing` | Dự báo bút toán khóa sổ |
| `/api/predict-depreciation` | Dự báo chi phí khấu hao |
| `/api/optimize-route` | Tối ưu tuyến đường |
| `/api/predict-delivery-time` | Dự báo thời gian giao hàng |
| `/api/predict-warehouse-load` | Dự báo tải trọng kho |
| `/api/analyze-notification-priority` | Phân tích độ ưu tiên thông báo |
| `/api/suggest-notification-time` | Gợi ý thời điểm gửi thông báo |
| `/api/summarize-notifications` | Tóm tắt thông báo hàng ngày |
| `/api/verify-einvoice` | Xác thực hóa đơn điện tử |
| `/api/detect-fraud` | Phát hiện hóa đơn gian lận |
| `/api/reconcile-invoices` | So sánh hóa đơn nhà cung cấp |
| `/api/predict-salary` | Dự báo chi phí lương |
| `/api/analyze-kpi` | Phân tích KPI nhân viên |
| `/api/predict-recruitment` | Dự báo nhu cầu tuyển dụng |
| `/health` | Health check |

## Lưu ý

1. Các service mới tạo đều có sẵn error handling
2. Cần cấu hình `PYTHON_AI_SERVICE_URL` trong .env
3. Các service đều ghi log bằng Pino logger
4. Có thể mở rộng thêm API routes khi cần
