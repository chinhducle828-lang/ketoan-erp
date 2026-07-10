# AI Service - Python FastAPI

Microservice xử lý AI cho Ketoan ERP.

## Cấu trúc

```
ai-service/
├── main.py              # FastAPI entry point
├── requirements.txt     # Python dependencies
├── Dockerfile           # Docker image
├── railway.json         # Railway config
├── .env.example         # Environment variables
└── models/
    ├── __init__.py
    ├── ocr_model.py     # OCR processing (PaddleOCR)
    ├── time_series_model.py  # Time series prediction (Linear Regression)
    ├── nlp_model.py     # NLP processing (Text-to-SQL, RAG)
    └── self_fix_model.py # Self-improvement (RLHF)
```

## Deploy lên Railway

1. Tạo service mới trong Railway
2. Chọn "Python" template
3. Set root directory: `ai-service`
4. Railway sẽ tự động detect từ `requirements.txt`
5. Port được set tự động qua biến môi trường `$PORT`
6. **Thêm GEMINI_API_KEY** vào Environment Variables trong Railway dashboard

## API Endpoints

| Endpoint | Method | Mô tả |
|----------|--------|------|
| `/health` | GET | Health check |
| `/api/ocr` | POST | Xử lý OCR hóa đơn (PaddleOCR) |
| `/api/self-fix` | POST | AI tự sửa (RLHF) |
| `/api/fine-tune` | POST | Huấn luyện lại model |
| `/api/text-to-sql` | POST | Chuyển câu hỏi thành SQL (NLP + Gemini) |
| `/api/rag-summarize` | POST | Tóm tắt dữ liệu (RAG) |
| `/api/predict-opening-balance` | POST | Dự đoán số dư đầu kỳ (TimeSeries) |
| `/api/predict-closing` | POST | Dự báo khóa sổ |
| `/api/optimize-route` | POST | Tối ưu tuyến đường |

## Environment Variables

```bash
PORT=8000
HOST=0.0.0.0
MODEL_DIR=./models
PYTHON_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
GEMINI_API_KEY=<your-api-key>  # Set in Railway, NOT in .env file
```

## Chạy local

```bash
# Cài đặt dependencies
pip install -r requirements.txt

# Chạy server
uvicorn main:app --host 0.0.0.0 --port 8000

# Hoặc dùng Docker
docker build -t ai-service .
docker run -p 8000:8000 ai-service
```

## Kết nối với Backend

Cập nhật `PYTHON_AI_SERVICE_URL` trong backend `.env`:

```bash
PYTHON_AI_SERVICE_URL=http://localhost:8000
# Hoặc trên Railway:
PYTHON_AI_SERVICE_URL=https://ai-service.up.railway.app
```

## Model Integration

### OCR Model
- Sử dụng PaddleOCR để xử lý hóa đơn
- Tính confidence score dựa trên độ đầy đủ thông tin

### TimeSeries Model
- Dự báo số dư đầu kỳ dựa trên dữ liệu lịch sử
- Sử dụng linear regression đơn giản

### NLP Model
- Text-to-SQL: Chuyển câu hỏi tiếng Việt thành SQL
- RAG Summarize: Tóm tắt dữ liệu truy vấn
- Entity extraction: Trích xuất số tiền, ngày, số hóa đơn

### SelfFix Model
- Tự sửa đề xuất dựa trên attempt number
- Học từ feedback của con người (RLHF)