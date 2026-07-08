"""
NLP Model Training Pipeline - ViT5 Fine-tuning for Vietnamese Text-to-SQL
"""

import os
import sys
import logging
from pathlib import Path
import yaml
import json
import time
from typing import Dict, List, Tuple

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torch.optim import AdamW
from tqdm import tqdm
import numpy as np
from sklearn.model_selection import train_test_split

# Transformers
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer, get_linear_schedule_with_warmup
# Metrics
from nltk.translate.bleu_score import sentence_bleu, corpus_bleu
from rouge_score import rouge_scorer

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent.parent))

from utils.logger import setup_logger, TrainingLogger
from utils.gpu_utils import check_gpu_availability, optimize_gpu_memory
from utils.data_utils import load_json, save_json

logger = logging.getLogger(__name__)


class TextToSQLDataset(Dataset):
    """Dataset for Text-to-SQL training"""
    
    def __init__(self, data: List[Dict], tokenizer, max_source_length: int = 128, 
                 max_target_length: int = 256):
        """
        Initialize dataset
        
        Args:
            data: List of samples with 'query' and 'sql' fields
            tokenizer: HuggingFace tokenizer
            max_source_length: Maximum length for input query
            max_target_length: Maximum length for output SQL
        """
        self.data = data
        self.tokenizer = tokenizer
        self.max_source_length = max_source_length
        self.max_target_length = max_target_length
    
    def __len__(self) -> int:
        return len(self.data)
    
    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        sample = self.data[idx]
        
        # Tokenize input query
        source_encoding = self.tokenizer(
            sample['query'],
            max_length=self.max_source_length,
            padding='max_length',
            truncation=True,
            return_tensors='pt'
        )
        
        # Tokenize target SQL
        target_encoding = self.tokenizer(
            sample['sql'],
            max_length=self.max_target_length,
            padding='max_length',
            truncation=True,
            return_tensors='pt'
        )
        
        return {
            'input_ids': source_encoding['input_ids'].squeeze(),
            'attention_mask': source_encoding['attention_mask'].squeeze(),
            'labels': target_encoding['input_ids'].squeeze()
        }


class NLPTrainer:
    """NLP model trainer for Vietnamese Text-to-SQL"""
    
    def __init__(self, config_path: str = "config/config.yaml"):
        """Initialize trainer with configuration"""
        self.config = self._load_config(config_path)
        self.logger = setup_logger("nlp_training", level="INFO")
        self.training_logger = TrainingLogger()
        
        # Setup device
        self.device = self._setup_device()
        
        # Paths
        self.data_dir = Path(self.config['paths']['data_processed'])
        self.model_save_dir = Path(self.config['paths']['models_trained'])
        self.model_save_dir.mkdir(parents=True, exist_ok=True)
        
        # Model configuration
        self.nlp_config = self.config['models']['nlp']
        
        # Metrics
        self.best_bleu = 0.0
        self.best_exact_match = 0.0
        
        self.logger.info(f"NLP Trainer initialized on {self.device}")
    
    def _load_config(self, config_path: str) -> Dict:
        """Load configuration"""
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    
    def _setup_device(self) -> str:
        """Setup training device"""
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
        Load NLP dataset
        
        Args:
            data_type: 'train', 'val', or 'test'
            
        Returns:
            List of samples with 'query' and 'sql' fields
        """
        # Try synthetic data first
        synthetic_path = Path(f"data/synthetic/nlp/query_sql_pairs.json") if data_type == "train" else None
        processed_path = self.data_dir / "nlp" / data_type / "query_sql_pairs.json"
        
        # Try multiple paths
        if synthetic_path and synthetic_path.exists():
            self.logger.info(f"Loading synthetic data from: {synthetic_path}")
            data = load_json(synthetic_path)
        elif processed_path.exists():
            self.logger.info(f"Loading processed data from: {processed_path}")
            data = load_json(processed_path)
        else:
            self.logger.error(f"No data found for {data_type}")
            return []
        
        self.logger.info(f"Loaded {len(data)} samples for {data_type}")
        return data
    
    def initialize_model(self):
        """Initialize ViT5 model and tokenizer"""
        self.logger.info(f"Loading model: {self.nlp_config['base_model']}")
        
        # Load tokenizer
        tokenizer = AutoTokenizer.from_pretrained(
            self.nlp_config['base_model'],
            use_fast=True
        )
        
        # Load model
        model = AutoModelForSeq2SeqLM.from_pretrained(
            self.nlp_config['base_model']
        )
        
        # Move to device
        model = model.to(self.device)
        
        # Enable mixed precision if using GPU
        if self.device == "cuda":
            from torch.cuda.amp import autocast
            self.use_amp = True
        else:
            self.use_amp = False
        
        self.logger.info(f"Model loaded: {model.__class__.__name__}")
        self.logger.info(f"Parameters: {sum(p.numel() for p in model.parameters()):,}")
        
        return model, tokenizer
    
    def train_epoch(self, model, dataloader, optimizer, scheduler) -> float:
        """Train for one epoch"""
        model.train()
        total_loss = 0.0
        
        progress_bar = tqdm(dataloader, desc="Training")
        
        for batch in progress_bar:
            # Move batch to device
            input_ids = batch['input_ids'].to(self.device)
            attention_mask = batch['attention_mask'].to(self.device)
            labels = batch['labels'].to(self.device)
            
            # Forward pass
            if self.use_amp:
                from torch.cuda.amp import autocast
                with autocast():
                    outputs = model(
                        input_ids=input_ids,
                        attention_mask=attention_mask,
                        labels=labels
                    )
                    loss = outputs.loss
            else:
                outputs = model(
                    input_ids=input_ids,
                    attention_mask=attention_mask,
                    labels=labels
                )
                loss = outputs.loss
            
            # Backward pass
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            scheduler.step()
            
            total_loss += loss.item()
            progress_bar.set_postfix({'loss': f'{loss.item():.4f}'})
        
        avg_loss = total_loss / len(dataloader)
        return avg_loss
    
    def evaluate(self, model, tokenizer, val_data: List[Dict]) -> Dict[str, float]:
        """
        Evaluate model on validation set
        
        Args:
            model: Model to evaluate
            tokenizer: Tokenizer
            val_data: Validation data
            
        Returns:
            Dictionary with metrics
        """
        model.eval()
        
        predictions = []
        references = []
        
        self.logger.info(f"Evaluating on {len(val_data)} samples...")
        
        with torch.no_grad():
            for sample in tqdm(val_data, desc="Evaluating"):
                # Tokenize input
                inputs = tokenizer(
                    sample['query'],
                    max_length=self.nlp_config['max_source_length'],
                    padding=True,
                    truncation=True,
                    return_tensors='pt'
                ).to(self.device)
                
                # Generate SQL
                outputs = model.generate(
                    **inputs,
                    max_length=self.nlp_config['max_target_length'],
                    num_beams=4,
                    early_stopping=True
                )
                
                # Decode
                predicted_sql = tokenizer.decode(outputs[0], skip_special_tokens=True)
                ground_truth_sql = sample['sql']
                
                predictions.append(predicted_sql)
                references.append(ground_truth_sql)
        
        # Calculate metrics
        metrics = self.calculate_metrics(predictions, references)
        
        return metrics
    
    def calculate_metrics(self, predictions: List[str], references: List[str]) -> Dict[str, float]:
        """Calculate evaluation metrics"""
        
        # Exact match accuracy
        exact_matches = sum(1 for pred, ref in zip(predictions, references) if pred == ref)
        exact_match_accuracy = exact_matches / len(predictions) if len(predictions) > 0 else 0.0
        
        # BLEU score
        references_for_bleu = [[ref.split()] for ref in references]
        predictions_for_bleu = [pred.split() for pred in predictions]
        
        bleu = corpus_bleu(references_for_bleu, predictions_for_bleu)
        
        # ROUGE score
        scorer = rouge_scorer.RougeScorer(['rouge1', 'rouge2', 'rougeL'], use_stemmer=False)
        rouge_scores = {
            'rouge1': [],
            'rouge2': [],
            'rougeL': []
        }
        
        for pred, ref in zip(predictions, references):
            scores = scorer.score(ref, pred)
            for key in rouge_scores.keys():
                rouge_scores[key].append(scores[key].fmeasure)
        
        avg_rouge = {key: np.mean(values) for key, values in rouge_scores.items()}
        
        # Component accuracy (simplified)
        component_accuracy = self._calculate_component_accuracy(predictions, references)
        
        metrics = {
            'exact_match': exact_match_accuracy,
            'bleu': bleu,
            'rouge1': avg_rouge['rouge1'],
            'rouge2': avg_rouge['rouge2'],
            'rougeL': avg_rouge['rougeL'],
            'component_accuracy': component_accuracy,
            'num_samples': len(predictions)
        }
        
        self.logger.info("Evaluation Results:")
        for key, value in metrics.items():
            if isinstance(value, float):
                self.logger.info(f"  {key}: {value:.4f}")
        
        return metrics
    
    def _calculate_component_accuracy(self, predictions: List[str], references: List[str]) -> float:
        """Calculate component-level accuracy (simplified)"""
        # Count how many predictions contain key SQL components
        correct_components = 0
        total_components = 0
        
        for pred, ref in zip(predictions, references):
            # Check for SELECT, FROM, WHERE keywords
            components = ['SELECT', 'FROM', 'WHERE']
            for component in components:
                total_components += 1
                if component in pred.upper() and component in ref.upper():
                    correct_components += 1
        
        return correct_components / total_components if total_components > 0 else 0.0
    
    def train(self) -> None:
        """Main training loop"""
        self.logger.info("="*60)
        self.logger.info("Starting NLP Training (Text-to-SQL)")
        self.logger.info("="*60)
        
        start_time = time.time()
        
        # Load data
        train_data = self.load_data("train")
        val_data = self.load_data("val")
        
        if len(train_data) == 0:
            self.logger.error("No training data found! Run generate_synthetic_data.py first.")
            return
        
        # Split train into train/val if no val data
        if len(val_data) == 0:
            self.logger.info("Splitting training data into train/val...")
            train_data, val_data = train_test_split(
                train_data, 
                test_size=0.2, 
                random_state=42
            )
        
        # Initialize model and tokenizer
        model, tokenizer = self.initialize_model()
        
        # Create datasets
        train_dataset = TextToSQLDataset(
            train_data, 
            tokenizer,
            self.nlp_config['max_source_length'],
            self.nlp_config['max_target_length']
        )
        
        val_dataset = TextToSQLDataset(
            val_data,
            tokenizer,
            self.nlp_config['max_source_length'],
            self.nlp_config['max_target_length']
        )
        
        # Create dataloaders
        train_dataloader = DataLoader(
            train_dataset,
            batch_size=self.nlp_config['batch_size'],
            shuffle=True,
            num_workers=4
        )
        
        # Optimizer and scheduler
        optimizer = AdamW(
            model.parameters(),
            lr=self.nlp_config['learning_rate'],
            weight_decay=0.01
        )
        
        total_steps = len(train_dataloader) * self.nlp_config['epochs']
        scheduler = get_linear_schedule_with_warmup(
            optimizer,
            num_warmup_steps=500,
            num_training_steps=total_steps
        )
        
        # Training loop
        for epoch in range(self.nlp_config['epochs']):
            self.logger.info(f"\nEpoch {epoch + 1}/{self.nlp_config['epochs']}")
            
            # Train
            train_loss = self.train_epoch(model, train_dataloader, optimizer, scheduler)
            self.logger.info(f"Average training loss: {train_loss:.4f}")
            
            # Evaluate
            val_metrics = self.evaluate(model, tokenizer, val_data)
            
            # Log results
            self.training_logger.log_epoch(
                epoch + 1,
                train_loss,
                0.0,  # val_loss not calculated
                scheduler.get_last_lr()[0],
                **val_metrics
            )
            
            # Save best model
            if val_metrics['bleu'] > self.best_bleu:
                self.best_bleu = val_metrics['bleu']
                self.best_exact_match = val_metrics['exact_match']
                
                # Save model
                model_save_path = self.model_save_dir / "nlp_best_model"
                model.save_pretrained(model_save_path)
                tokenizer.save_pretrained(model_save_path)
                
                self.logger.info(f"✓ Best model saved (BLEU: {self.best_bleu:.4f})")
        
        # Final evaluation
        self.logger.info("\n" + "="*60)
        self.logger.info("Training Complete!")
        self.logger.info("="*60)
        
        total_time = time.time() - start_time
        self.logger.info(f"Total time: {total_time:.2f} seconds")
        self.logger.info(f"Best BLEU: {self.best_bleu:.4f}")
        self.logger.info(f"Best Exact Match: {self.best_exact_match:.4f}")
        
        # Save results
        results = {
            'model': self.nlp_config['base_model'],
            'best_bleu': self.best_bleu,
            'best_exact_match': self.best_exact_match,
            'training_time': total_time,
            'config': self.nlp_config
        }
        
        results_file = self.model_save_dir / "nlp_evaluation.json"
        save_json(results, results_file)
        
        self.logger.info(f"Results saved to: {results_file}")


def main():
    """Main function"""
    trainer = NLPTrainer()
    trainer.train()


if __name__ == "__main__":
    main()
