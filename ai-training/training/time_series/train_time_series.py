"""
Time Series Model Training Pipeline - Prophet + LSTM for Cashflow & Inventory Forecasting
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
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from prophet import Prophet
from tqdm import tqdm

# Deep learning for LSTM
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent.parent))

from utils.logger import setup_logger, TrainingLogger
from utils.gpu_utils import check_gpu_availability, optimize_gpu_memory
from utils.data_utils import load_json, save_json

logger = logging.getLogger(__name__)


class LSTMForecaster(nn.Module):
    """LSTM model for time series forecasting"""
    
    def __init__(self, input_size: int = 1, hidden_size: int = 128, 
                 num_layers: int = 2, output_size: int = 1, dropout: float = 0.2):
        """
        Initialize LSTM model
        
        Args:
            input_size: Number of input features
            hidden_size: LSTM hidden state size
            num_layers: Number of LSTM layers
            output_size: Number of outputs
            dropout: Dropout rate
        """
        super(LSTMForecaster, self).__init__()
        
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        
        # LSTM layers
        self.lstm = nn.LSTM(
            input_size,
            hidden_size,
            num_layers,
            batch_first=True,
            dropout=dropout
        )
        
        # Fully connected layer
        self.fc = nn.Linear(hidden_size, output_size)
    
    def forward(self, x):
        """Forward pass"""
        # Initialize hidden state
        h0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        c0 = torch.zeros(self.num_layers, x.size(0), self.hidden_size).to(x.device)
        
        # LSTM forward
        out, _ = self.lstm(x, (h0, c0))
        
        # Decode last time step
        out = self.fc(out[:, -1, :])
        
        return out


class TimeSeriesDataset(Dataset):
    """Dataset for time series forecasting"""
    
    def __init__(self, data: np.ndarray, sequence_length: int = 30):
        """
        Initialize dataset
        
        Args:
            data: Time series data
            sequence_length: Number of past steps to use
        """
        self.data = data
        self.sequence_length = sequence_length
    
    def __len__(self) -> int:
        return len(self.data) - self.sequence_length
    
    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        # Input: past sequence_length values
        x = self.data[idx:idx + self.sequence_length]
        # Output: next value
        y = self.data[idx + self.sequence_length]
        
        return torch.FloatTensor(x), torch.FloatTensor([y])


class TimeSeriesTrainer:
    """Time series model trainer for cashflow and inventory forecasting"""
    
    def __init__(self, config_path: str = "config/config.yaml"):
        """Initialize trainer with configuration"""
        self.config = self._load_config(config_path)
        self.logger = setup_logger("time_series_training", level="INFO")
        self.training_logger = TrainingLogger()
        
        # Setup device
        self.device = self._setup_device()
        
        # Paths
        self.data_dir = Path(self.config['paths']['data_processed'])
        self.model_save_dir = Path(self.config['paths']['models_trained'])
        self.model_save_dir.mkdir(parents=True, exist_ok=True)
        
        # Model configuration
        self.ts_config = self.config['models']['time_series']
        
        # Metrics
        self.best_mae = float('inf')
        self.best_rmse = float('inf')
        
        self.logger.info("Time Series Trainer initialized")
    
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
    
    def load_data(self, data_type: str = "train") -> pd.DataFrame:
        """
        Load time series data
        
        Args:
            data_type: 'train', 'val', or 'test'
            
        Returns:
            DataFrame with 'ds' (date) and 'y' (value) columns
        """
        # Try to load from various sources
        data_path = self.data_dir / "time_series" / data_type / "timeseries.csv"
        
        if data_path.exists():
            self.logger.info(f"Loading data from: {data_path}")
            df = pd.read_csv(data_path)
            df['ds'] = pd.to_datetime(df['ds'])
            return df
        
        # Generate synthetic data if not found
        self.logger.warning(f"No data found for {data_type}, generating synthetic data...")
        return self.generate_synthetic_data(data_type)
    
    def generate_synthetic_data(self, data_type: str = "train") -> pd.DataFrame:
        """
        Generate synthetic time series data for testing
        
        Args:
            data_type: 'train', 'val', or 'test'
            
        Returns:
            DataFrame with time series data
        """
        # Set random seed
        np.random.seed(42)
        
        # Generate dates
        if data_type == "train":
            dates = pd.date_range(start='2020-01-01', end='2023-12-31', freq='D')
        elif data_type == "val":
            dates = pd.date_range(start='2024-01-01', end='2024-06-30', freq='D')
        else:
            dates = pd.date_range(start='2024-07-01', end='2024-12-31', freq='D')
        
        # Generate synthetic cashflow data with trend and seasonality
        t = np.arange(len(dates))
        
        # Trend
        trend = 0.1 * t
        
        # Seasonality (yearly)
        seasonality = 10 * np.sin(2 * np.pi * t / 365)
        
        # Weekly pattern
        weekly = 5 * np.sin(2 * np.pi * t / 7)
        
        # Random noise
        noise = np.random.normal(0, 5, len(dates))
        
        # Combine
        values = 100 + trend + seasonality + weekly + noise
        values = np.maximum(values, 0)  # Ensure non-negative
        
        df = pd.DataFrame({
            'ds': dates,
            'y': values
        })
        
        self.logger.info(f"Generated {len(df)} synthetic samples for {data_type}")
        
        return df
    
    def train_prophet(self, train_data: pd.DataFrame, val_data: pd.DataFrame) -> Dict[str, Any]:
        """
        Train Prophet model
        
        Args:
            train_data: Training data
            val_data: Validation data
            
        Returns:
            Dictionary with model and metrics
        """
        self.logger.info("Training Prophet model...")
        
        # Initialize Prophet
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            seasonality_mode='multiplicative'
        )
        
        # Add Vietnamese holidays (optional)
        # model.add_country_holidays(country_name='VN')
        
        # Fit model
        model.fit(train_data)
        
        # Evaluate on validation set
        future = val_data[['ds']]
        forecast = model.predict(future)
        
        # Calculate metrics
        y_true = val_data['y'].values
        y_pred = forecast['yhat'].values
        
        mae = mean_absolute_error(y_true, y_pred)
        rmse = np.sqrt(mean_squared_error(y_true, y_pred))
        r2 = r2_score(y_true, y_pred)
        
        metrics = {
            'mae': mae,
            'rmse': rmse,
            'r2': r2
        }
        
        self.logger.info("Prophet Results:")
        self.logger.info(f"  MAE: {mae:.4f}")
        self.logger.info(f"  RMSE: {rmse:.4f}")
        self.logger.info(f"  R²: {r2:.4f}")
        
        return {
            'model': model,
            'metrics': metrics
        }
    
    def train_lstm(self, train_data: pd.DataFrame, val_data: pd.DataFrame) -> Dict[str, Any]:
        """
        Train LSTM model
        
        Args:
            train_data: Training data
            val_data: Validation data
            
        Returns:
            Dictionary with model and metrics
        """
        self.logger.info("Training LSTM model...")
        
        # Prepare data
        scaler = MinMaxScaler()
        
        # Fit scaler on training data
        train_values = train_data['y'].values.reshape(-1, 1)
        train_scaled = scaler.fit_transform(train_values)
        
        val_values = val_data['y'].values.reshape(-1, 1)
        val_scaled = scaler.transform(val_values)
        
        # Create datasets
        sequence_length = self.ts_config['sequence_length']
        train_dataset = TimeSeriesDataset(train_scaled, sequence_length)
        val_dataset = TimeSeriesDataset(val_scaled, sequence_length)
        
        # Create dataloaders
        train_loader = DataLoader(
            train_dataset,
            batch_size=self.ts_config['batch_size'],
            shuffle=True
        )
        
        # Initialize model
        model = LSTMForecaster(
            input_size=1,
            hidden_size=self.ts_config['lstm_units'],
            num_layers=self.ts_config['lstm_layers']
        )
        model = model.to(self.device)
        
        # Loss and optimizer
        criterion = nn.MSELoss()
        optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
        
        # Training loop
        num_epochs = self.ts_config['epochs']
        
        for epoch in range(num_epochs):
            model.train()
            train_loss = 0.0
            
            for batch_x, batch_y in train_loader:
                batch_x = batch_x.to(self.device)
                batch_y = batch_y.to(self.device)
                
                # Forward pass
                outputs = model(batch_x)
                loss = criterion(outputs, batch_y)
                
                # Backward pass
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
                
                train_loss += loss.item()
            
            avg_train_loss = train_loss / len(train_loader)
            
            # Validate
            model.eval()
            val_predictions = []
            val_true = []
            
            with torch.no_grad():
                for i in range(len(val_dataset)):
                    x, y = val_dataset[i]
                    x = x.unsqueeze(0).to(self.device)
                    y_pred = model(x).cpu().numpy()[0, 0]
                    
                    val_predictions.append(y_pred)
                    val_true.append(y.numpy()[0])
            
            # Inverse transform
            val_predictions = scaler.inverse_transform(np.array(val_predictions).reshape(-1, 1))
            val_true = scaler.inverse_transform(np.array(val_true).reshape(-1, 1))
            
            # Calculate metrics
            mae = mean_absolute_error(val_true, val_predictions)
            rmse = np.sqrt(mean_squared_error(val_true, val_predictions))
            
            if (epoch + 1) % 10 == 0:
                self.logger.info(f"Epoch {epoch + 1}/{num_epochs}")
                self.logger.info(f"  Train Loss: {avg_train_loss:.4f}")
                self.logger.info(f"  Val MAE: {mae:.4f}, RMSE: {rmse:.4f}")
        
        metrics = {
            'mae': mae,
            'rmse': rmse
        }
        
        self.logger.info("LSTM Results:")
        self.logger.info(f"  MAE: {mae:.4f}")
        self.logger.info(f"  RMSE: {rmse:.4f}")
        
        return {
            'model': model,
            'scaler': scaler,
            'metrics': metrics
        }
    
    def train(self) -> None:
        """Main training loop"""
        self.logger.info("="*60)
        self.logger.info("Starting Time Series Training")
        self.logger.info("="*60)
        
        start_time = time.time()
        
        # Load data
        train_data = self.load_data("train")
        val_data = self.load_data("val")
        
        if len(train_data) == 0:
            self.logger.error("No training data found!")
            return
        
        # Train Prophet
        prophet_results = self.train_prophet(train_data, val_data)
        
        # Train LSTM
        lstm_results = self.train_lstm(train_data, val_data)
        
        # Save best model (Prophet for now, simpler and faster)
        best_model = prophet_results['model']
        best_metrics = prophet_results['metrics']
        
        # Save Prophet model
        from prophet.serialize import model_to_json
        model_path = self.model_save_dir / "prophet_model.json"
        with open(model_path, 'w') as f:
            f.write(model_to_json(best_model))
        
        # Save LSTM model
        lstm_path = self.model_save_dir / "lstm_model.pt"
        torch.save(lstm_results['model'].state_dict(), lstm_path)
        joblib.dump(lstm_results['scaler'], self.model_save_dir / "lstm_scaler.pkl")
        
        self.logger.info(f"✓ Models saved to {self.model_save_dir}")
        
        # Final results
        self.logger.info("\n" + "="*60)
        self.logger.info("Training Complete!")
        self.logger.info("="*60)
        
        total_time = time.time() - start_time
        self.logger.info(f"Total time: {total_time:.2f} seconds")
        self.logger.info(f"Best MAE: {best_metrics['mae']:.4f}")
        self.logger.info(f"Best RMSE: {best_metrics['rmse']:.4f}")
        
        # Save results
        results = {
            'prophet_mae': best_metrics['mae'],
            'prophet_rmse': best_metrics['rmse'],
            'lstm_mae': lstm_results['metrics']['mae'],
            'lstm_rmse': lstm_results['metrics']['rmse'],
            'training_time': total_time,
            'num_samples': len(train_data) + len(val_data),
            'config': self.ts_config
        }
        
        results_file = self.model_save_dir / "time_series_evaluation.json"
        save_json(results, results_file)
        
        self.logger.info(f"Results saved to: {results_file}")


def main():
    """Main function"""
    trainer = TimeSeriesTrainer()
    trainer.train()


if __name__ == "__main__":
    main()