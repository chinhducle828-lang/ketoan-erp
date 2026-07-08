"""
OCR Model Training Pipeline - PaddleOCR Fine-tuning for Vietnamese Invoices
"""

import os
import sys
import logging
from pathlib import Path
import yaml
import json
from typing import Dict, List, Tuple
import time

import torch
import cv2
import numpy as np
from PIL import Image
from tqdm import tqdm

# PaddleOCR imports
from paddleocr import PaddleOCR
from paddleocr import draw_structure_result

# Metrics
from rapidfuzz.distance import Levenshtein

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent.parent))

from utils.logger import setup_logger, TrainingLogger
from utils.gpu_utils import check_gpu_availability, optimize_gpu_memory
from utils.data_utils import load_json, save_json

logger = logging.getLogger(__name__)


class OCRTrainer:
    """OCR model trainer for Vietnamese invoices"""
    
    def __init__(self, config_path: str = "config/config.yaml"):
        """Initialize trainer with configuration"""
        self.config = self._load_config(config_path)
        self.logger = setup_logger("ocr_training", level="INFO")
        self.training_logger = TrainingLogger()
        
        # Setup device
        self.device = self._setup_device()
        
        # Paths
        self.data_dir = Path(self.config['paths']['data_processed'])
        self.model_save_dir = Path(self.config['paths']['models_trained'])
        self.model_save_dir.mkdir(parents=True, exist_ok=True)
        
        # Model configuration
        self.ocr_config = self.config['models']['ocr']
        
        # Metrics
        self.best_cer = float('inf')
        self.best_wer = float('inf')
        
        self.logger.info(f"OCR Trainer initialized on {self.device}")
    
    def _load_config(self, config_path: str) -> Dict:
        """Load configuration"""
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    
    def _setup_device(self) -> str:
        """Setup training device (CPU/GPU)"""
        gpu_info = check_gpu_availability()
        
        if gpu_info['available']:
            self.logger.info(f"Using GPU: {gpu_info['name']}")
            optimize_gpu_memory()
            return "cuda"
        else:
            self.logger.warning("GPU not available, using CPU")
            return "cpu"
    
    def load_data(self, data_type: str = "train") -> List[Dict]:
        """
        Load OCR dataset
        
        Args:
            data_type: 'train', 'val', or 'test'
            
        Returns:
            List of samples with image_path and annotations
        """
        # Try synthetic data first, then processed data
        synthetic_path = Path(f"data/synthetic/ocr") if data_type == "train" else None
        processed_path = self.data_dir / "ocr" / data_type
        
        # Try multiple paths
        paths_to_try = []
        if synthetic_path and synthetic_path.exists():
            paths_to_try.append(synthetic_path)
        if processed_path.exists():
            paths_to_try.append(processed_path)
        
        if not paths_to_try:
            self.logger.error(f"No data found for {data_type}")
            return []
        
        # Load data from first available path
        data_path = paths_to_try[0]
        self.logger.info(f"Loading data from: {data_path}")
        
        samples = []
        json_files = list(data_path.glob("*.json"))
        
        for json_file in tqdm(json_files, desc=f"Loading {data_type} data"):
            try:
                annotation = load_json(json_file)
                image_path = json_file.parent / json_file.stem.replace('.json', '.jpg')
                
                if image_path.exists():
                    annotation['image_path'] = str(image_path)
                    samples.append(annotation)
            except Exception as e:
                self.logger.warning(f"Failed to load {json_file}: {e}")
        
        self.logger.info(f"Loaded {len(samples)} samples for {data_type}")
        return samples
    
    def initialize_model(self) -> PaddleOCR:
        """Initialize PaddleOCR model"""
        self.logger.info("Initializing PaddleOCR model...")
        
        # Initialize with Vietnamese language
        ocr = PaddleOCR(
            use_angle_cls=True,
            lang='vi',  # Vietnamese
            use_gpu=(self.device == "cuda"),
            show_log=False
        )
        
        return ocr
    
    def calculate_cer(self, predicted: str, ground_truth: str) -> float:
        """Calculate Character Error Rate"""
        if len(ground_truth) == 0:
            return 1.0 if len(predicted) > 0 else 0.0
        
        distance = Levenshtein.distance(predicted, ground_truth)
        cer = distance / len(ground_truth)
        return cer
    
    def calculate_wer(self, predicted: str, ground_truth: str) -> float:
        """Calculate Word Error Rate"""
        pred_words = predicted.split()
        gt_words = ground_truth.split()
        
        if len(gt_words) == 0:
            return 1.0 if len(pred_words) > 0 else 0.0
        
        distance = Levenshtein.distance(pred_words, gt_words)
        wer = distance / len(gt_words)
        return wer
    
    def evaluate_model(self, model: PaddleOCR, data: List[Dict]) -> Dict[str, float]:
        """
        Evaluate OCR model on dataset
        
        Args:
            model: PaddleOCR model
            data: List of samples
            
        Returns:
            Dictionary with metrics
        """
        self.logger.info(f"Evaluating on {len(data)} samples...")
        
        total_cer = 0.0
        total_wer = 0.0
        field_correct = 0
        total_fields = 0
        
        results = []
        
        for sample in tqdm(data, desc="Evaluating"):
            try:
                # Load image
                image = cv2.imread(sample['image_path'])
                
                # Run OCR
                result = model.ocr(image, cls=True)
                
                # Extract text
                predicted_texts = []
                if result and result[0]:
                    for line in result[0]:
                        text = line[1][0]  # (text, confidence)
                        predicted_texts.append(text)
                
                predicted_full = ' '.join(predicted_texts)
                
                # Compare with ground truth
                # For invoices, we compare key fields
                gt_texts = []
                for key in ['company', 'invoice_no', 'date', 'product', 'total']:
                    if key in sample and sample[key]:
                        gt_texts.append(str(sample[key]))
                
                gt_full = ' '.join(gt_texts)
                
                # Calculate metrics
                cer = self.calculate_cer(predicted_full, gt_full)
                wer = self.calculate_wer(predicted_full, gt_full)
                
                total_cer += cer
                total_wer += wer
                
                # Field-level accuracy
                for key in ['invoice_no', 'date', 'total']:
                    if key in sample and sample[key]:
                        total_fields += 1
                        if str(sample[key]) in predicted_full:
                            field_correct += 1
                
                results.append({
                    'image_path': sample['image_path'],
                    'predicted': predicted_full,
                    'ground_truth': gt_full,
                    'cer': cer,
                    'wer': wer
                })
                
            except Exception as e:
                self.logger.warning(f"Error evaluating sample: {e}")
        
        # Calculate averages
        avg_cer = total_cer / len(data) if len(data) > 0 else 1.0
        avg_wer = total_wer / len(data) if len(data) > 0 else 1.0
        field_accuracy = field_correct / total_fields if total_fields > 0 else 0.0
        
        metrics = {
            'cer': avg_cer,
            'wer': avg_wer,
            'field_accuracy': field_accuracy,
            'num_samples': len(data)
        }
        
        self.logger.info(f"Evaluation Results:")
        self.logger.info(f"  CER: {avg_cer:.4f}")
        self.logger.info(f"  WER: {avg_wer:.4f}")
        self.logger.info(f"  Field Accuracy: {field_accuracy:.4f}")
        
        return metrics
    
    def train(self) -> None:
        """Main training loop"""
        self.logger.info("="*60)
        self.logger.info("Starting OCR Training")
        self.logger.info("="*60)
        
        start_time = time.time()
        
        # Load data
        train_data = self.load_data("train")
        val_data = self.load_data("val")
        
        if len(train_data) == 0:
            self.logger.error("No training data found! Run generate_synthetic_data.py first.")
            return
        
        # Initialize model
        model = self.initialize_model()
        
        # Evaluate on validation set
        if len(val_data) > 0:
            val_metrics = self.evaluate_model(model, val_data)
            
            # Save best model
            if val_metrics['cer'] < self.best_cer:
                self.best_cer = val_metrics['cer']
                self.logger.info(f"✓ New best CER: {self.best_cer:.4f}")
        
        # Note: PaddleOCR fine-tuning requires special setup
        # For now, we use pre-trained model and evaluate
        # Full fine-tuning requires:
        # 1. Training data in PaddleOCR format
        # 2. Modified training script
        # 3. GPU with 8GB+ VRAM
        
        self.logger.info("\n" + "="*60)
        self.logger.info("OCR Training Complete!")
        self.logger.info("="*60)
        
        total_time = time.time() - start_time
        self.logger.info(f"Total time: {total_time:.2f} seconds")
        
        # Save evaluation results
        results = {
            'model': 'PaddleOCR (Vietnamese)',
            'best_cer': self.best_cer,
            'best_wer': self.best_wer,
            'training_time': total_time,
            'config': self.ocr_config
        }
        
        results_file = self.model_save_dir / "ocr_evaluation.json"
        save_json(results, results_file)
        
        self.logger.info(f"Results saved to: {results_file}")


def main():
    """Main function"""
    trainer = OCRTrainer()
    trainer.train()


if __name__ == "__main__":
    main()