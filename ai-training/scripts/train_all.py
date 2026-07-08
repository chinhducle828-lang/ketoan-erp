"""
Master Training Script - Train all AI models
"""

import os
import sys
import logging
import argparse
from pathlib import Path
import time
from typing import Dict, List

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from utils.logger import setup_logger, log_system_info
from utils.gpu_utils import print_system_info

# Import trainers
from training.ocr.train_ocr import OCRTrainer
from training.nlp.train_nlp import NLPTrainer
from training.self_fix.train_self_fix import SelfFixTrainer
from training.rag.train_rag import RAGTrainer
from training.time_series.train_time_series import TimeSeriesTrainer

logger = logging.getLogger(__name__)


def train_ocr():
    """Train OCR model"""
    logger.info("\n" + "="*60)
    logger.info("TRAINING OCR MODEL")
    logger.info("="*60)
    
    trainer = OCRTrainer()
    trainer.train()


def train_nlp():
    """Train NLP model"""
    logger.info("\n" + "="*60)
    logger.info("TRAINING NLP MODEL (Text-to-SQL)")
    logger.info("="*60)
    
    trainer = NLPTrainer()
    trainer.train()


def train_self_fix():
    """Train Self-Fix model"""
    logger.info("\n" + "="*60)
    logger.info("TRAINING SELF-FIX MODEL")
    logger.info("="*60)
    
    trainer = SelfFixTrainer()
    trainer.train()


def train_rag():
    """Train RAG model"""
    logger.info("\n" + "="*60)
    logger.info("TRAINING RAG MODEL")
    logger.info("="*60)
    
    trainer = RAGTrainer()
    trainer.train()


def train_time_series():
    """Train Time Series model"""
    logger.info("\n" + "="*60)
    logger.info("TRAINING TIME SERIES MODEL")
    logger.info("="*60)
    
    trainer = TimeSeriesTrainer()
    trainer.train()


def main():
    """Main function"""
    parser = argparse.ArgumentParser(description='Train all AI models')
    parser.add_argument('--model', type=str, default='all',
                       choices=['all', 'ocr', 'nlp', 'self_fix', 'rag', 'time_series'],
                       help='Which model to train (default: all)')
    parser.add_argument('--skip-data-generation', action='store_true',
                       help='Skip synthetic data generation')
    
    args = parser.parse_args()
    
    # Setup logging
    setup_logger("master_training", level="INFO", log_file="logs/master_training.log")
    
    # Print system info
    print_system_info()
    log_system_info(logger)
    
    logger.info("="*60)
    logger.info("MASTER TRAINING SCRIPT")
    logger.info("="*60)
    logger.info(f"Model to train: {args.model}")
    logger.info(f"Skip data generation: {args.skip_data_generation}")
    
    start_time = time.time()
    
    # Generate synthetic data if needed
    if not args.skip_data_generation:
        logger.info("\nGenerating synthetic data...")
        from scripts.generate_synthetic_data import main as generate_data
        generate_data()
    
    # Train models
    training_functions = {
        'ocr': train_ocr,
        'nlp': train_nlp,
        'self_fix': train_self_fix,
        'rag': train_rag,
        'time_series': train_time_series
    }
    
    if args.model == 'all':
        # Train all models
        for model_name, train_func in training_functions.items():
            try:
                train_func()
            except Exception as e:
                logger.error(f"Failed to train {model_name}: {e}", exc_info=True)
                continue
    else:
        # Train specific model
        if args.model in training_functions:
            try:
                training_functions[args.model]()
            except Exception as e:
                logger.error(f"Failed to train {args.model}: {e}", exc_info=True)
        else:
            logger.error(f"Unknown model: {args.model}")
    
    # Final summary
    total_time = time.time() - start_time
    
    logger.info("\n" + "="*60)
    logger.info("ALL TRAINING COMPLETE!")
    logger.info("="*60)
    logger.info(f"Total time: {total_time:.2f} seconds ({total_time/3600:.2f} hours)")
    logger.info("\nTrained models saved in: models/trained/")
    logger.info("\nNext steps:")
    logger.info("1. Review evaluation results in models/trained/*_evaluation.json")
    logger.info("2. Run evaluation: python evaluation/run_all_tests.py")
    logger.info("3. Export models: python scripts/export_models.py")
    logger.info("4. Integrate into ERP system")
    logger.info("="*60)


if __name__ == "__main__":
    main()