"""
Self-Fix Model Training Pipeline - XGBoost Classifier for Voucher Error Correction
"""

import os
import sys
import logging
from pathlib import Path
import yaml
import json
import time
from typing import Dict, List, Tuple, Any
import joblib

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import precision_score, recall_score, f1_score, accuracy_score, confusion_matrix
import xgboost as xgb
import torch
from tqdm import tqdm

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent.parent))

from utils.logger import setup_logger, TrainingLogger
from utils.data_utils import load_json, save_json

logger = logging.getLogger(__name__)


class SelfFixTrainer:
    """Self-fix model trainer for voucher error correction"""
    
    def __init__(self, config_path: str = "config/config.yaml"):
        """Initialize trainer with configuration"""
        self.config = self._load_config(config_path)
        self.logger = setup_logger("self_fix_training", level="INFO")
        self.training_logger = TrainingLogger()
        
        # Paths
        self.data_dir = Path(self.config['paths']['data_processed'])
        self.model_save_dir = Path(self.config['paths']['models_trained'])
        self.model_save_dir.mkdir(parents=True, exist_ok=True)
        
        # Model configuration
        self.self_fix_config = self.config['models']['self_fix']
        
        # Metrics
        self.best_f1 = 0.0
        self.best_precision = 0.0
        self.best_recall = 0.0
        
        # Preprocessors
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        
        self.logger.info("Self-Fix Trainer initialized")
    
    def _load_config(self, config_path: str) -> Dict:
        """Load configuration"""
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    
    def load_data(self, data_type: str = "train") -> List[Dict]:
        """
        Load self-fix dataset
        
        Args:
            data_type: 'train', 'val', or 'test'
            
        Returns:
            List of samples with error_voucher and correct_voucher
        """
        # Try synthetic data first
        synthetic_path = Path(f"data/synthetic/self_fix/self_fix_data.json") if data_type == "train" else None
        processed_path = self.data_dir / "self_fix" / data_type / "self_fix_data.json"
        
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
    
    def extract_features(self, voucher: Dict[str, Any]) -> np.ndarray:
        """
        Extract features from voucher for ML model
        
        Args:
            voucher: Voucher dictionary
            
        Returns:
            Feature vector
        """
        features = []
        
        # 1. Voucher type (one-hot encoded)
        voucher_types = ['receipt', 'payment', 'journal']
        for vtype in voucher_types:
            features.append(1 if voucher.get('voucher_type') == vtype else 0)
        
        # 2. Account codes (numeric)
        debit_account = voucher.get('debit_account', '000')
        credit_account = voucher.get('credit_account', '000')
        
        # Convert account codes to numeric (handle '000' as 0)
        try:
            features.append(int(debit_account) if debit_account != '000' else 0)
        except:
            features.append(0)
        
        try:
            features.append(int(credit_account) if credit_account != '000' else 0)
        except:
            features.append(0)
        
        # 3. Amount features
        amount = voucher.get('amount', 0)
        features.append(amount)
        features.append(np.log1p(amount))  # Log-transformed amount
        features.append(amount / 1000000)  # Amount in millions
        
        # 4. Description features
        description = voucher.get('description', '')
        features.append(len(description))  # Description length
        features.append(1 if description else 0)  # Has description
        
        # 5. Date features
        date_str = voucher.get('date', '2024-01-01')
        try:
            from datetime import datetime
            date_obj = datetime.strptime(date_str, '%Y-%m-%d')
            features.append(date_obj.month)  # Month
            features.append(date_obj.weekday())  # Day of week
            features.append(date_obj.day)  # Day of month
        except:
            features.extend([1, 0, 1])  # Default values
        
        # 6. Account balance features (simplified)
        # In production, you'd look up actual account balances
        features.append(1 if debit_account in ['111', '112'] else 0)  # Cash account
        features.append(1 if credit_account in ['511', '632'] else 0)  # Revenue/COGS
        
        return np.array(features, dtype=np.float32)
    
    def prepare_dataset(self, data: List[Dict]) -> Tuple[np.ndarray, np.ndarray]:
        """
        Prepare dataset for training
        
        Args:
            data: List of samples
            
        Returns:
            Tuple of (X, y) where X is features and y is labels
        """
        self.logger.info("Preparing dataset...")
        
        X = []
        y = []
        
        for sample in tqdm(data, desc="Extracting features"):
            error_voucher = sample['error_voucher']
            correct_voucher = sample['correct_voucher']
            error_type = sample.get('error_type', 'none')
            
            # Extract features from error voucher
            features = self.extract_features(error_voucher)
            
            # Label: 1 if needs fix, 0 if correct
            label = 1 if sample.get('needs_fix', False) else 0
            
            X.append(features)
            y.append(label)
        
        X = np.array(X)
        y = np.array(y)
        
        self.logger.info(f"Dataset prepared: {len(X)} samples, {X.shape[1]} features")
        self.logger.info(f"Positive samples (needs fix): {sum(y)} ({100*sum(y)/len(y):.1f}%)")
        
        return X, y
    
    def train(self) -> None:
        """Main training loop"""
        self.logger.info("="*60)
        self.logger.info("Starting Self-Fix Model Training")
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
        
        # Prepare datasets
        X_train, y_train = self.prepare_dataset(train_data)
        X_val, y_val = self.prepare_dataset(val_data)
        
        # Normalize features
        X_train = self.scaler.fit_transform(X_train)
        X_val = self.scaler.transform(X_val)
        
        # Calculate class weights (handle imbalance)
        from collections import Counter
        class_counts = Counter(y_train)
        scale_pos_weight = class_counts[0] / class_counts[1] if class_counts[1] > 0 else 1.0
        
        self.logger.info(f"Class distribution: {dict(class_counts)}")
        self.logger.info(f"Scale pos weight: {scale_pos_weight:.2f}")
        
        # Create DMatrix for XGBoost
        dtrain = xgb.DMatrix(X_train, label=y_train)
        dval = xgb.DMatrix(X_val, label=y_val)
        
        # XGBoost parameters
        params = {
            'objective': 'binary:logistic',
            'eval_metric': ['logloss', 'auc'],
            'max_depth': self.self_fix_config['max_depth'],
            'learning_rate': self.self_fix_config['learning_rate'],
            'n_estimators': self.self_fix_config['n_estimators'],
            'scale_pos_weight': scale_pos_weight,
            'random_state': 42,
            'tree_method': 'hist',  # Faster training
            'device': 'cuda' if torch.cuda.is_available() else 'cpu'
        }
        
        self.logger.info("Training XGBoost model...")
        self.logger.info(f"Parameters: {params}")
        
        # Train model
        model = xgb.train(
            params,
            dtrain,
            num_boost_round=self.self_fix_config['n_estimators'],
            evals=[(dtrain, 'train'), (dval, 'val')],
            early_stopping_rounds=20,
            verbose_eval=10
        )
        
        # Evaluate on validation set
        self.logger.info("\nEvaluating on validation set...")
        y_val_pred = model.predict(dval)
        y_val_pred_binary = (y_val_pred > 0.5).astype(int)
        
        # Calculate metrics
        val_precision = precision_score(y_val, y_val_pred_binary, zero_division=0)
        val_recall = recall_score(y_val, y_val_pred_binary, zero_division=0)
        val_f1 = f1_score(y_val, y_val_pred_binary, zero_division=0)
        val_accuracy = accuracy_score(y_val, y_val_pred_binary)
        
        self.logger.info("Validation Results:")
        self.logger.info(f"  Precision: {val_precision:.4f}")
        self.logger.info(f"  Recall: {val_recall:.4f}")
        self.logger.info(f"  F1 Score: {val_f1:.4f}")
        self.logger.info(f"  Accuracy: {val_accuracy:.4f}")
        
        # Confusion matrix
        cm = confusion_matrix(y_val, y_val_pred_binary)
        self.logger.info(f"  Confusion Matrix:\n{cm}")
        
        # Save best model
        if val_f1 > self.best_f1:
            self.best_f1 = val_f1
            self.best_precision = val_precision
            self.best_recall = val_recall
            
            # Save model
            model_path = self.model_save_dir / "self_fix_model.json"
            model.save_model(str(model_path))
            
            # Save preprocessors
            joblib.dump(self.scaler, self.model_save_dir / "self_fix_scaler.pkl")
            
            # Save feature names
            feature_names = [
                'type_receipt', 'type_payment', 'type_journal',
                'debit_account', 'credit_account',
                'amount', 'amount_log', 'amount_millions',
                'desc_length', 'has_description',
                'month', 'weekday', 'day',
                'is_cash_debit', 'is_revenue_credit'
            ]
            
            self.logger.info(f"✓ Best model saved (F1: {self.best_f1:.4f})")
        
        # Feature importance
        feature_importance = model.get_score(importance_type='weight')
        self.logger.info("\nTop 10 Important Features:")
        sorted_importance = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)[:10]
        for feature, importance in sorted_importance:
            self.logger.info(f"  {feature}: {importance:.2f}")
        
        # Final results
        self.logger.info("\n" + "="*60)
        self.logger.info("Training Complete!")
        self.logger.info("="*60)
        
        total_time = time.time() - start_time
        self.logger.info(f"Total time: {total_time:.2f} seconds")
        self.logger.info(f"Best F1: {self.best_f1:.4f}")
        self.logger.info(f"Best Precision: {self.best_precision:.4f}")
        self.logger.info(f"Best Recall: {self.best_recall:.4f}")
        
        # Save results
        results = {
            'model': 'XGBoost',
            'best_f1': self.best_f1,
            'best_precision': self.best_precision,
            'best_recall': self.best_recall,
            'val_accuracy': val_accuracy,
            'training_time': total_time,
            'num_samples': len(X_train) + len(X_val),
            'num_features': X_train.shape[1],
            'config': self.self_fix_config
        }
        
        results_file = self.model_save_dir / "self_fix_evaluation.json"
        save_json(results, results_file)
        
        self.logger.info(f"Results saved to: {results_file}")


def main():
    """Main function"""
    trainer = SelfFixTrainer()
    trainer.train()


if __name__ == "__main__":
    main()
