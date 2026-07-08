# AI Training Project - Ketoan ERP

Dự án training AI models cho hệ thống ERP Kế Toán Vietnamese Accounting.

## 🎯 Mục Tiêu

Train các model AI thực tế để tích hợp vào hệ thống ERP:
- **OCR:** Nhận dạng hóa đơn/voucher từ ảnh
- **NLP:** Text-to-SQL (truy vấn bằng tiếng Việt)
- **Self-Fix:** Tự động sửa lỗi voucher
- **RAG:** Hỏi đáp kiến thức kế toán
- **Time Series:** Dự báo cashflow & inventory

## 🖥️ Hardware Setup

- **CPU:** AMD Ryzen 7 14400F (8 cores, 16 threads)
- **RAM:** 32GB
- **GPU:** NVIDIA RTX 5060 8GB VRAM (CUDA)
- **Storage:** NVMe SSD 5000 MB/s

## 📁 Project Structure

```
ai-training/
├── data/
│   ├── raw/                    # Raw collected data
│   ├── processed/              # Cleaned & annotated data
│   ├── synthetic/              # Generated training samples
│   └── ground_truth/           # Human-annotated labels
├── notebooks/                  # Jupyter notebooks for exploration
├── training/
│   ├── ocr/                    # OCR model training
│   ├── nlp/                    # NLP/Text-to-SQL training
│   ├── self_fix/               # Self-fix classifier training
│   ├── rag/                    # Embedding & RAG training
│   └── time_series/            # Cashflow/Inventory forecasting
├── models/
│   ├── trained/                # Training checkpoints
│   └── exported/               # Production-ready models
├── evaluation/
│   ├── reports/                # Training reports
│   └── metrics/                # Quantitative metrics
├── utils/                      # Data processing utilities
├── scripts/                    # Automation scripts
├── requirements.txt            # Python dependencies
├── .gitignore
└── README.md
```

## 🚀 Quick Start

### 1. Setup Environment

```bash
# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Linux/Mac)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Verify GPU

```python
python -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}'); print(f'GPU: {torch.cuda.get_device_name(0)}')"
```

Expected output:
```
CUDA available: True
GPU: NVIDIA GeForce RTX 5060
```

### 3. Download Datasets

```bash
# Download public datasets
python scripts/download_datasets.py

# Generate synthetic data
python scripts/generate_synthetic_data.py
```

### 4. Train Models

```bash
# Train OCR model
python training/ocr/train_ocr.py

# Train NLP model
python training/nlp/train_nlp.py

# Train Self-Fix model
python training/self_fix/train_self_fix.py

# Train RAG model
python training/rag/train_rag.py
```

### 5. Evaluate Models

```bash
# Run quantitative tests
python evaluation/run_all_tests.py

# Generate report
python evaluation/generate_report.py
```

### 6. Export Models

```bash
# Export to production format
python scripts/export_models.py

# Output: models/exported/
```

## 📊 Training Timeline (6 Months)

| Phase | Duration | Goal |
|-------|----------|------|
| **Month 1-2** | Weeks 1-8 | Data collection & preprocessing |
| **Month 3-4** | Weeks 9-16 | Model training |
| **Month 5** | Weeks 17-22 | Evaluation & optimization |
| **Month 6** | Weeks 23-28 | Integration & deployment |

## 🎓 Model Details

### 1. OCR Model (PaddleOCR)
- **Task:** Extract text from Vietnamese invoices
- **Metrics:** CER < 5%, WER < 10%
- **Data:** 1700 annotated invoice images
- **Training time:** 2-3 days

### 2. NLP Model (ViT5)
- **Task:** Convert Vietnamese queries to SQL
- **Metrics:** Exact match > 70%, BLEU > 0.75
- **Data:** 2150 query-SQL pairs
- **Training time:** 3-4 days

### 3. Self-Fix Model (XGBoost)
- **Task:** Predict voucher corrections
- **Metrics:** Precision > 80%, Recall > 75%
- **Data:** 5500 error-correction pairs
- **Training time:** 1 day

### 4. RAG Model (PhoBERT + Qdrant)
- **Task:** Answer accounting questions
- **Metrics:** Precision@5 > 85%, MRR > 0.8
- **Data:** 1000 Q&A pairs + 500 document chunks
- **Training time:** 2-3 days

### 5. Time Series (Prophet + LSTM)
- **Task:** Forecast cashflow & inventory
- **Metrics:** MAE < 15%, Directional accuracy > 70%
- **Data:** Historical transaction data
- **Training time:** 1-2 days

## 📈 Expected Results

After 6 months, you'll have:
- ✅ 5 production-ready AI models
- ✅ Quantitative metrics for each model
- ✅ Integration with ERP system
- ✅ Complete documentation
- ✅ Monitoring & retraining pipeline

## 🔗 Integration with ERP

After training, models will be integrated into:
- `ai-service/models/` - Replace mocks with real models
- `backend/services/` - Update service layer
- `ai-service/main.py` - Load trained models
- Deploy to Railway with GPU

## 📝 Documentation

- Training reports: `evaluation/reports/`
- Model cards: `models/trained/`
- Integration guide: `docs/INTEGRATION.md`

## 🤝 Contributing

This is a private training project for Ketoan ERP.

## 📄 License

Proprietary - Ketoan ERP

---

**Status:** 🚧 In Progress (Phase 0: Preparation)
**Started:** 2026-07-08
**Target Completion:** 2027-01-08 (6 months)