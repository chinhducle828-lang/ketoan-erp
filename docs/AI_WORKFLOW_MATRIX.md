# AI Workflow Matrix - Ma trận luồng AI trong hệ thống

## Tổng quan

Bảng ma trận mô tả luồng AI từ đầu vào đến đầu ra cho từng chức năng.

## Ma trận AI Workflow

| Chức năng | Node.js Service | Python AI Service | Input | Process | Output | HITL Status |
|----------|----------------|-----------------|-------|---------|--------|-----------|
| **OCR Hóa đơn** | aiOcr.service | `/api/ocr` | file_url, company_id | PaddleOCR → extract → normalize | entries, confidence | HUMAN_REVIEW |
| **AI tự sửa** | aiSelfFix.service | `/api/self-fix` | voucher_id, original_proposal | model inference → fix | confidence, changes | AUTO_POSTED/HUMAN_REVIEW |
| **Text-to-SQL** | aiCopilot.service | `/api/text-to-sql` | question, company_id | NLP → parse → generate | sql, confidence | - |
| **RAG Summarize** | aiCopilot.service | `/api/rag-summarize` | question, data, sql | LLM → summarize | answer, confidence | - |
| **Dự báo tồn kho** | aiInventory.service | - | items, period | time series → predict | stock_level, days_left | - |
| **Dự báo dòng tiền** | aiCashflow.service | - | transactions | time series → predict | net_flow, risk | - |
| **Markov công nợ** | aiAging.service | - | partner_transactions | markov chain → predict | aging_days, risk | - |
| **Dự báo số dư đầu** | aiOpeningBalance.service | `/api/predict-opening-balance` | account, period, history | time series → predict | balance, confidence | - |
| **Dự báo khóa sổ** | aiClosingPredict.service | `/api/predict-closing` | period, data | time series → predict | entries, confidence | - |
| **Tối ưu tuyến đường** | aiLogistics.service | `/api/optimize-route` | orders, vehicles | optimization → route | optimized_routes | - |
| **Xác thực hóa đơn** | aiEInvoice.service | `/api/verify-einvoice` | invoice_data | validation → verify | is_valid, confidence | - |
| **Phát hiện gian lận** | aiEInvoice.service | `/api/detect-fraud` | invoices | anomaly detection | fraud_list | - |
| **Dự báo lương** | aiHR.service | `/api/predict-salary` | employees, period | regression → predict | cost, confidence | - |
| **Phân tích KPI** | aiHR.service | `/api/analyze-kpi` | user_activity | scoring → analyze | kpi_score, analysis | - |
| **RLHF Training** | trainFeedbackLoop.js | `/api/fine-tune` | training_data | fine-tune → update | new_version, improvement | - |

## Chi tiết Flow: AI OCR → HITL → Self-Fix

```
┌─────────────────┐
│  Upload hóa đơn  │
│  (Frontend)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│  aiOcr.service   │────▶│  Python /api/ocr  │
│  (Node.js)       │     │  (FastAPI)        │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│  Confidence     │     │  OCR Result      │
│  < 95%         │     │  (entries)       │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         ▼                       │
┌─────────────────┐             │
│  HITL Log       │             │
│  (ai_hitl_logs) │◀────────────┘
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│  trySelfFix()   │────▶│  /api/self-fix   │
│  (Node.js)     │     │  (Python)        │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│  Confidence     │     │  Fixed Result    │
│  >= 95%?       │     │  (changes)       │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         ▼                       │
┌─────────────────┐             │
│  AUTO_POSTED    │             │
│  (Success)      │             │
└─────────────────┘             │
         │                      │
         ▼                      │
┌─────────────────┐             │
│  Update HITL    │◀────────────┘
│  (ai_hitl_logs) │
└─────────────────┘
```

## Circuit Breaker Flow

```
┌─────────────────┐
│  Self-Fix Call  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│  isCircuitOpen? │────▶│  is_open = TRUE   │
│  (DB check)     │     │  → Stop          │
└────────┬────────┘     └──────────────────┘
         │
         ▼
┌─────────────────┐
│  Call Python    │
│  /api/self-fix  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│  Success?       │────▶│  Improvement >10  │
│  (confidence)   │     │  → closeCircuit   │
└────────┬────────┘     └──────────────────┘
         │
         ▼
┌─────────────────┐
│  Error?         │────▶│  openCircuit     │
│                 │     │  (failure_count+1)│
└─────────────────┘     └──────────────────┘
```

## RLHF Training Flow

```
┌─────────────────┐
│  Cronjob 24h    │
│  (trainFeedback) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Query HITL    │
│  is_modified=TRUE│
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐
│  /api/fine-tune │────▶│  Python Training   │
│  (POST)         │     │  Pipeline          │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│  New Model      │     │  Update Version    │
│  Version        │◀────│  (v1.0 → v1.1)   │
└─────────────────┘     └──────────────────┘
```

## Cấu hình Thresholds

| Tham số | Giá trị mặc định | Mô tả |
|--------|------------------|------|
| `AI_CONFIDENCE_AUTO_POSTED` | 95 | Confidence để tự động ghi sổ |
| `AI_CONFIDENCE_HUMAN_REVIEW` | 80 | Confidence để cần kiểm duyệt |
| `AI_AMOUNT_AUTO_POSTED_MAX` | 5,000,000 | Số tiền tối đa tự động (VND) |
| `AI_AMOUNT_HUMAN_REVIEW_MAX` | 50,000,000 | Số tiền tối đa kiểm duyệt (VND) |
| `AI_CASHFLOW_LARGE` | 100,000,000 | Giao dịch lớn (VND) |
| `AI_CASHFLOW_SHORTAGE_DAYS` | 30 | Ngày cảnh báo thiếu tiền |
| `AI_INVENTORY_LOW_STOCK_DAYS` | 7 | Ngày cảnh báo tồn kho thấp |
| `AI_INVENTORY_OVERSTOCK_DAYS` | 90 | Ngày cảnh báo tồn kho quá nhiều |

## Lưu ý triển khai

1. **Python AI Service** chạy độc lập trên port 8000
2. **Node.js Backend** gọi Python qua HTTP API
3. **Circuit Breaker** lưu trong DB, timeout 1 giờ
4. **HITL Logs** lưu mọi thao tác AI
5. **RLHF Training** chạy định kỳ, cập nhật model version