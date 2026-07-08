"""
Logging configuration
"""

import logging
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional


def setup_logger(
    name: str = "ai_training",
    level: str = "INFO",
    log_file: Optional[str] = None,
    format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
) -> logging.Logger:
    """
    Setup logger with console and optional file output
    
    Args:
        name: Logger name
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Optional log file path
        format: Log format string
        
    Returns:
        Configured logger
    """
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper()))
    
    # Clear existing handlers
    logger.handlers.clear()
    
    # Create formatter
    formatter = logging.Formatter(format)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # File handler (optional)
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        
        file_handler = logging.FileHandler(log_file, encoding='utf-8')
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger


def get_logger(name: str = "ai_training") -> logging.Logger:
    """Get existing logger or create new one"""
    return logging.getLogger(name)


def log_system_info(logger: logging.Logger) -> None:
    """Log system information at startup"""
    from .gpu_utils import get_system_info
    
    info = get_system_info()
    
    logger.info("="*60)
    logger.info("SYSTEM INFORMATION")
    logger.info("="*60)
    logger.info(f"CPU: {info['cpu']['cores']} cores, {info['cpu']['threads']} threads")
    logger.info(f"RAM: {info['memory']['total_gb']:.2f} GB total, {info['memory']['available_gb']:.2f} GB available")
    
    if info['gpu']['available']:
        logger.info(f"GPU: {info['gpu']['name']}")
        logger.info(f"  - Memory: {info['gpu']['memory_total']:.2f} GB")
        logger.info(f"  - CUDA: {info['gpu']['cuda_version']}")
    else:
        logger.warning("GPU: Not available (CPU only)")
    
    logger.info("="*60)


class TrainingLogger:
    """Enhanced logger for training with metrics tracking"""
    
    def __init__(self, name: str = "training", log_dir: str = "logs"):
        self.logger = setup_logger(name, log_file=f"{log_dir}/training.log")
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        # Training metrics
        self.current_epoch = 0
        self.metrics = {
            'train_loss': [],
            'val_loss': [],
            'learning_rate': []
        }
    
    def log_epoch(self, epoch: int, train_loss: float, val_loss: float, 
                  learning_rate: float, **kwargs):
        """Log epoch results"""
        self.current_epoch = epoch
        self.metrics['train_loss'].append(train_loss)
        self.metrics['val_loss'].append(val_loss)
        self.metrics['learning_rate'].append(learning_rate)
        
        self.logger.info(
            f"Epoch {epoch:3d} | "
            f"Train Loss: {train_loss:.4f} | "
            f"Val Loss: {val_loss:.4f} | "
            f"LR: {learning_rate:.2e}"
        )
        
        # Log additional metrics
        for key, value in kwargs.items():
            self.logger.info(f"  {key}: {value}")
    
    def log_best_model(self, epoch: int, metric: str, value: float):
        """Log best model achievement"""
        self.logger.info(f"✓ Best model saved at epoch {epoch} ({metric}: {value:.4f})")
    
    def log_training_complete(self, total_time: float, best_metric: float):
        """Log training completion"""
        self.logger.info("="*60)
        self.logger.info(f"Training completed in {total_time:.2f} seconds")
        self.logger.info(f"Best {self.metrics}: {best_metric:.4f}")
        self.logger.info("="*60)
    
    def save_metrics(self, filepath: str):
        """Save metrics to JSON file"""
        import json
        
        filepath = Path(filepath)
        filepath.parent.mkdir(parents=True, exist_ok=True)
        
        with open(filepath, 'w') as f:
            json.dump(self.metrics, f, indent=2)
        
        self.logger.info(f"Metrics saved to {filepath}")


if __name__ == "__main__":
    # Test logger
    logger = setup_logger(log_file="logs/test.log")
    logger.info("Logger test successful!")
    print("Logger configured successfully!")