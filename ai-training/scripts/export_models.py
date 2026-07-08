"""
Export trained models to production-ready format
"""

import os
import sys
import logging
from pathlib import Path
import json
import time
from typing import Dict, Any

import joblib
import numpy as np

# ML/NLP
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
import xgboost as xgb
from prophet.serialize import model_to_json

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from utils.logger import setup_logger

logger = setup_logger("export_models", level="INFO")


class ModelExporter:
    """Export trained models to production format"""
    
    def __init__(self):
        self.logger = logger
        
        # Paths
        self.trained_dir = Path("models/trained")
        self.export_dir = Path("models/exported")
        self.export_dir.mkdir(parents=True, exist_ok=True)
        
        self.logger.info("Model Exporter initialized")
    
    def export_ocr_model(self) -> bool:
        """Export OCR model"""
        self.logger.info("\n" + "="*60)
        self.logger.info("EXPORTING OCR MODEL")
        self.logger.info("="*60)
        
        try:
            # For PaddleOCR, we just copy the evaluation results
            # In production, you'd export the fine-tuned model
            
            eval_file = self.trained_dir / "ocr_evaluation.json"
            if not eval_file.exists():
                self.logger.warning("No OCR evaluation found")
                return False
            
            # Load evaluation results
            with open(eval_file, 'r') as f:
                eval_results = json.load(f)
            
            # Create export info
            export_info = {
                'model_name': 'PaddleOCR (Vietnamese)',
                'model_type': 'ocr',
                'version': 'v1.0',
                'export_date': time.strftime('%Y-%m-%d %H:%M:%S'),
                'metrics': {
                    'cer': eval_results.get('best_cer'),
                    'wer': eval_results.get('best_wer')
                },
                'config': eval_results.get('config'),
                'usage': {
                    'input': 'Image file (JPEG, PNG)',
                    'output': 'Extracted text (Vietnamese)',
                    'language': 'vi',
                    'max_text_length': 100
                },
                'deployment': {
                    'platform': 'Railway',
                    'gpu_required': False,  # PaddleOCR can run on CPU
                    'memory_mb': 500,
                    'inference_time_ms': 500
                }
            }
            
            # Save export info
            export_file = self.export_dir / "ocr_model_info.json"
            with open(export_file, 'w', encoding='utf-8') as f:
                json.dump(export_info, f, indent=2, ensure_ascii=False)
            
            self.logger.info(f"✓ OCR model info exported: {export_file}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to export OCR model: {e}")
            return False
    
    def export_nlp_model(self) -> bool:
        """Export NLP model (ViT5)"""
        self.logger.info("\n" + "="*60)
        self.logger.info("EXPORTING NLP MODEL")
        self.logger.info("="*60)
        
        try:
            # Load trained model
            model_path = self.trained_dir / "nlp_best_model"
            
            if not model_path.exists():
                self.logger.warning("No NLP model found")
                return False
            
            self.logger.info(f"Loading model from: {model_path}")
            
            # Load model and tokenizer
            tokenizer = AutoTokenizer.from_pretrained(model_path)
            model = AutoModelForSeq2SeqLM.from_pretrained(model_path)
            
            # Export to ONNX for better performance
            self.logger.info("Converting to ONNX format...")
            
            # Create dummy input
            dummy_input = tokenizer("Test query", return_tensors="pt")
            
            # Export to ONNX
            onnx_path = self.export_dir / "nlp_model.onnx"
            torch.onnx.export(
                model,
                (dummy_input['input_ids'], dummy_input['attention_mask']),
                onnx_path,
                export_params=True,
                opset_version=14,
                input_names=['input_ids', 'attention_mask'],
                output_names=['output'],
                dynamic_axes={
                    'input_ids': {0: 'batch_size', 1: 'sequence_length'},
                    'attention_mask': {0: 'batch_size', 1: 'sequence_length'},
                    'output': {0: 'batch_size', 1: 'sequence_length'}
                }
            )
            
            # Save tokenizer
            tokenizer_path = self.export_dir / "nlp_tokenizer"
            tokenizer.save_pretrained(tokenizer_path)
            
            # Load evaluation results
            eval_file = self.trained_dir / "nlp_evaluation.json"
            with open(eval_file, 'r') as f:
                eval_results = json.load(f)
            
            # Create export info
            export_info = {
                'model_name': 'ViT5 (Vietnamese Text-to-SQL)',
                'model_type': 'nlp',
                'version': 'v1.0',
                'export_date': time.strftime('%Y-%m-%d %H:%M:%S'),
                'format': 'ONNX',
                'model_path': str(onnx_path),
                'tokenizer_path': str(tokenizer_path),
                'metrics': {
                    'bleu': eval_results.get('best_bleu'),
                    'exact_match': eval_results.get('best_exact_match')
                },
                'config': eval_results.get('config'),
                'usage': {
                    'input': 'Vietnamese text query',
                    'output': 'SQL query',
                    'max_input_length': 128,
                    'max_output_length': 256
                },
                'deployment': {
                    'platform': 'Railway',
                    'gpu_required': True,
                    'gpu_type': 'T4',
                    'memory_mb': 2000,
                    'inference_time_ms': 200
                }
            }
            
            # Save export info
            export_file = self.export_dir / "nlp_model_info.json"
            with open(export_file, 'w', encoding='utf-8') as f:
                json.dump(export_info, f, indent=2, ensure_ascii=False)
            
            self.logger.info(f"✓ NLP model exported: {onnx_path}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to export NLP model: {e}")
            return False
    
    def export_self_fix_model(self) -> bool:
        """Export Self-Fix model (XGBoost)"""
        self.logger.info("\n" + "="*60)
        self.logger.info("EXPORTING SELF-FIX MODEL")
        self.logger.info("="*60)
        
        try:
            # Load model
            model_path = self.trained_dir / "self_fix_model.json"
            
            if not model_path.exists():
                self.logger.warning("No Self-Fix model found")
                return False
            
            # Load XGBoost model
            model = xgb.Booster()
            model.load_model(str(model_path))
            
            # Load scaler
            scaler_path = self.trained_dir / "self_fix_scaler.pkl"
            scaler = joblib.load(scaler_path)
            
            # Save to exported directory
            exported_model_path = self.export_dir / "self_fix_model.json"
            model.save_model(str(exported_model_path))
            
            exported_scaler_path = self.export_dir / "self_fix_scaler.pkl"
            joblib.dump(scaler, exported_scaler_path)
            
            # Load evaluation results
            eval_file = self.trained_dir / "self_fix_evaluation.json"
            with open(eval_file, 'r') as f:
                eval_results = json.load(f)
            
            # Create export info
            export_info = {
                'model_name': 'XGBoost (Voucher Error Detection)',
                'model_type': 'self_fix',
                'version': 'v1.0',
                'export_date': time.strftime('%Y-%m-%d %H:%M:%S'),
                'format': 'XGBoost JSON',
                'model_path': str(exported_model_path),
                'scaler_path': str(exported_scaler_path),
                'metrics': {
                    'f1': eval_results.get('best_f1'),
                    'precision': eval_results.get('best_precision'),
                    'recall': eval_results.get('best_recall')
                },
                'config': eval_results.get('config'),
                'features': [
                    'voucher_type',
                    'debit_account',
                    'credit_account',
                    'amount',
                    'description_length',
                    'date_features'
                ],
                'usage': {
                    'input': 'Voucher data (JSON)',
                    'output': 'Error probability (0-1)',
                    'threshold': 0.5
                },
                'deployment': {
                    'platform': 'Railway',
                    'gpu_required': False,
                    'memory_mb': 100,
                    'inference_time_ms': 10
                }
            }
            
            # Save export info
            export_file = self.export_dir / "self_fix_model_info.json"
            with open(export_file, 'w', encoding='utf-8') as f:
                json.dump(export_info, f, indent=2, ensure_ascii=False)
            
            self.logger.info(f"✓ Self-Fix model exported: {exported_model_path}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to export Self-Fix model: {e}")
            return False
    
    def export_rag_model(self) -> bool:
        """Export RAG model (embeddings + vector DB)"""
        self.logger.info("\n" + "="*60)
        self.logger.info("EXPORTING RAG MODEL")
        self.logger.info("="*60)
        
        try:
            # Load embedding model
            model_path = self.trained_dir / "rag_embedding_model"
            
            if not model_path.exists():
                self.logger.warning("No RAG model found")
                return False
            
            # Load sentence transformer
            embedding_model = SentenceTransformer(str(model_path))
            
            # Save to exported directory
            exported_model_path = self.export_dir / "rag_embedding_model"
            embedding_model.save(str(exported_model_path))
            
            # Load evaluation results
            eval_file = self.trained_dir / "rag_evaluation.json"
            with open(eval_file, 'r') as f:
                eval_results = json.load(f)
            
            # Create export info
            export_info = {
                'model_name': 'SentenceTransformer (Vietnamese Embeddings)',
                'model_type': 'rag',
                'version': 'v1.0',
                'export_date': time.strftime('%Y-%m-%d %H:%M:%S'),
                'format': 'SentenceTransformer',
                'model_path': str(exported_model_path),
                'embedding_dim': 384,
                'metrics': {
                    'precision_at_5': eval_results.get('best_precision_at_5'),
                    'mrr': eval_results.get('best_mrr')
                },
                'config': eval_results.get('config'),
                'usage': {
                    'input': 'Text query (Vietnamese)',
                    'output': '384-dimensional embedding vector',
                    'similarity_metric': 'cosine'
                },
                'deployment': {
                    'platform': 'Railway',
                    'gpu_required': False,
                    'memory_mb': 500,
                    'inference_time_ms': 50
                }
            }
            
            # Save export info
            export_file = self.export_dir / "rag_model_info.json"
            with open(export_file, 'w', encoding='utf-8') as f:
                json.dump(export_info, f, indent=2, ensure_ascii=False)
            
            self.logger.info(f"✓ RAG model exported: {exported_model_path}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to export RAG model: {e}")
            return False
    
    def export_time_series_model(self) -> bool:
        """Export Time Series model (Prophet + LSTM)"""
        self.logger.info("\n" + "="*60)
        self.logger.info("EXPORTING TIME SERIES MODEL")
        self.logger.info("="*60)
        
        try:
            # Load Prophet model
            prophet_path = self.trained_dir / "prophet_model.json"
            
            if not prophet_path.exists():
                self.logger.warning("No Prophet model found")
                return False
            
            # Copy Prophet model
            import shutil
            exported_prophet_path = self.export_dir / "prophet_model.json"
            shutil.copy(prophet_path, exported_prophet_path)
            
            # Load LSTM model (if exists)
            lstm_path = self.trained_dir / "lstm_model.pt"
            if lstm_path.exists():
                exported_lstm_path = self.export_dir / "lstm_model.pt"
                shutil.copy(lstm_path, exported_lstm_path)
                
                # Copy scaler
                scaler_path = self.trained_dir / "lstm_scaler.pkl"
                exported_scaler_path = self.export_dir / "lstm_scaler.pkl"
                shutil.copy(scaler_path, exported_scaler_path)
            
            # Load evaluation results
            eval_file = self.trained_dir / "time_series_evaluation.json"
            with open(eval_file, 'r') as f:
                eval_results = json.load(f)
            
            # Create export info
            export_info = {
                'model_name': 'Prophet + LSTM (Time Series Forecasting)',
                'model_type': 'time_series',
                'version': 'v1.0',
                'export_date': time.strftime('%Y-%m-%d %H:%M:%S'),
                'format': 'Prophet JSON + PyTorch',
                'prophet_model_path': str(exported_prophet_path),
                'lstm_model_path': str(exported_lstm_path) if lstm_path.exists() else None,
                'metrics': {
                    'prophet_mae': eval_results.get('prophet_mae'),
                    'prophet_rmse': eval_results.get('prophet_rmse'),
                    'lstm_mae': eval_results.get('lstm_mae'),
                    'lstm_rmse': eval_results.get('lstm_rmse')
                },
                'config': eval_results.get('config'),
                'usage': {
                    'input': 'Time series data (dates + values)',
                    'output': 'Forecasted values',
                    'forecast_horizon': '30 days'
                },
                'deployment': {
                    'platform': 'Railway',
                    'gpu_required': False,
                    'memory_mb': 200,
                    'inference_time_ms': 100
                }
            }
            
            # Save export info
            export_file = self.export_dir / "time_series_model_info.json"
            with open(export_file, 'w', encoding='utf-8') as f:
                json.dump(export_info, f, indent=2, ensure_ascii=False)
            
            self.logger.info(f"✓ Time Series model exported: {exported_prophet_path}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to export Time Series model: {e}")
            return False
    
    def create_deployment_package(self) -> bool:
        """Create deployment package with all exported models"""
        self.logger.info("\n" + "="*60)
        self.logger.info("CREATING DEPLOYMENT PACKAGE")
        self.logger.info("="*60)
        
        try:
            # Create deployment manifest
            manifest = {
                'package_name': 'ketoan-ai-models',
                'version': 'v1.0',
                'export_date': time.strftime('%Y-%m-%d %H:%M:%S'),
                'models': []
            }
            
            # List all exported models
            for info_file in self.export_dir.glob("*_model_info.json"):
                with open(info_file, 'r') as f:
                    model_info = json.load(f)
                    manifest['models'].append({
                        'name': model_info['model_name'],
                        'type': model_info['model_type'],
                        'version': model_info['version'],
                        'file': info_file.name
                    })
            
            # Save manifest
            manifest_path = self.export_dir / "deployment_manifest.json"
            with open(manifest_path, 'w', encoding='utf-8') as f:
                json.dump(manifest, f, indent=2, ensure_ascii=False)
            
            self.logger.info(f"✓ Deployment manifest created: {manifest_path}")
            self.logger.info(f"  Total models: {len(manifest['models'])}")
            
            # Create README
            readme = f"""# AI Models Deployment Package

**Version:** {manifest['version']}
**Export Date:** {manifest['export_date']}

## Models Included

{chr(10).join([f"- **{m['name']}** ({m['type']}) - {m['version']}" for m in manifest['models']])}

## Deployment Instructions

1. Upload all files from `models/exported/` to your deployment server
2. Update `ai-service/models/` with the exported models
3. Update `ai-service/main.py` to load real models
4. Deploy to Railway with GPU support

## Model Information

See individual `*_model_info.json` files for detailed information about each model.

## Next Steps

1. Test models locally: `python -m pytest tests/`
2. Deploy to Railway: `railway up`
3. Monitor performance: Check logs and metrics
"""
            
            readme_path = self.export_dir / "README.md"
            readme_path.write_text(readme, encoding='utf-8')
            
            self.logger.info(f"✓ Deployment README created: {readme_path}")
            
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to create deployment package: {e}")
            return False
    
    def export_all(self) -> None:
        """Export all models"""
        self.logger.info("="*60)
        self.logger.info("EXPORTING ALL MODELS")
        self.logger.info("="*60)
        
        start_time = time.time()
        
        # Export each model
        results = {
            'ocr': self.export_ocr_model(),
            'nlp': self.export_nlp_model(),
            'self_fix': self.export_self_fix_model(),
            'rag': self.export_rag_model(),
            'time_series': self.export_time_series_model()
        }
        
        # Create deployment package
        self.create_deployment_package()
        
        # Summary
        total_time = time.time() - start_time
        success_count = sum(1 for v in results.values() if v)
        
        self.logger.info("\n" + "="*60)
        self.logger.info("EXPORT COMPLETE!")
        self.logger.info("="*60)
        self.logger.info(f"Total time: {total_time:.2f} seconds")
        self.logger.info(f"Successfully exported: {success_count}/{len(results)} models")
        self.logger.info(f"\nExported models saved in: {self.export_dir}")
        
        # List exported files
        self.logger.info("\nExported files:")
        for file in sorted(self.export_dir.glob("*")):
            self.logger.info(f"  - {file.name}")
        
        self.logger.info("\nNext steps:")
        self.logger.info("1. Review exported models in models/exported/")
        self.logger.info("2. Update ai-service to use exported models")
        self.logger.info("3. Deploy to Railway")
        self.logger.info("="*60)


def main():
    """Main function"""
    exporter = ModelExporter()
    exporter.export_all()


if __name__ == "__main__":
    main()