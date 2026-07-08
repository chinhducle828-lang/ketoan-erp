# Quick Start Guide - AI Training Project

## 🚀 5-Minute Quick Start

### Prerequisites
- Python 3.8+
- NVIDIA GPU with CUDA 11.8+ (optional but recommended)
- 32GB RAM minimum

### Step 1: Setup Environment (2 minutes)

```bash
# Navigate to project
cd ai-training

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Linux/Mac)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 2: Verify GPU (30 seconds)

```bash
python -c "from utils.gpu_utils import print_system_info; print_system_info()"
```

Expected output:
```
============================================================
SYSTEM INFORMATION
============================================================

CPU:
  Cores: 8
  Threads: 16
  Usage: 15.2%

RAM:
  Total: 32.00 GB
  Available: 28.50 GB
  Used: 10.9%

GPU:
  Available: Yes
  Name: NVIDIA GeForce RTX 5060
  Memory: 8.00 GB
  Free: 7.85 GB
  CUDA: 12.1.0
============================================================
```

### Step 3: Generate Synthetic Data (1 minute)

```bash
python scripts/generate_synthetic_data.py
```

This generates:
- 500 synthetic invoices (OCR)
- 2000 query-SQL pairs (NLP)
- 5000 error-correction pairs (Self-Fix)
- 500 Q&A pairs (RAG)

### Step 4: Train Models (varies)

```bash
# Train all models
python scripts/train_all.py

# Or train specific model
python scripts/train_all.py --model nlp
python scripts/train_all.py --model self_fix
```

### Step 5: Evaluate Results (30 seconds)

```bash
python evaluation/run_all_tests.py
```

### Step 6: Export Models (30 seconds)

```bash
python scripts/export_models.py
```

## 📊 Expected Results

After training, check `models/trained/` for:

- `ocr_evaluation.json` - OCR metrics (CER, WER)
- `nlp_evaluation.json` - NLP metrics (BLEU, Exact Match)
- `self_fix_evaluation.json` - Self-Fix metrics (Precision, Recall, F1)
- `rag_evaluation.json` - RAG metrics (Precision@5, MRR)
- `time_series_evaluation.json` - Time Series metrics (MAE, RMSE)

## 🎯 Success Criteria

Models should meet these thresholds:

| Model | Metric | Target |
|-------|--------|--------|
| OCR | CER | ≤ 5% |
| OCR | WER | ≤ 10% |
| NLP | Exact Match | ≥ 70% |
| NLP | BLEU | ≥ 0.75 |
| Self-Fix | F1 | ≥ 0.77 |
| RAG | Precision@5 | ≥ 85% |
| Time Series | MAE | ≤ 15% |

## 🔧 Troubleshooting

### CUDA Out of Memory
```bash
# Reduce batch size in config/config.yaml
# Or use CPU (slower)
python scripts/train_all.py --skip-data-generation
```

### Import Errors
```bash
# Make sure you're in the ai-training directory
cd ai-training

# Activate virtual environment
venv\Scripts\activate  # Windows
```

### Slow Training
- Use GPU (10-50x faster)
- Reduce batch size
- Use smaller models

## 📚 Next Steps

1. **Collect real data** - Replace synthetic data with real invoices/queries
2. **Fine-tune models** - Adjust hyperparameters in `config/config.yaml`
3. **Integrate with ERP** - Update `ai-service/models/` with trained models
4. **Deploy to Railway** - Push to production

## 🆘 Need Help?

- Check logs in `logs/` directory
- Review `README.md` for detailed documentation
- Check `evaluation/reports/` for detailed metrics

## ⚡ Quick Commands Reference

```bash
# Setup
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# Data
python scripts/generate_synthetic_data.py

# Training
python scripts/train_all.py                    # All models
python scripts/train_all.py --model ocr         # Specific model
python scripts/train_all.py --skip-data-generation  # Skip data gen

# Evaluation
python evaluation/run_all_tests.py

# Export
python scripts/export_models.py

# System info
python -c "from utils.gpu_utils import print_system_info; print_system_info()"