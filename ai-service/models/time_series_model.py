"""
Time Series Model - Dự báo chuỗi thời gian
Dùng cho dự báo tồn kho, dòng tiền, công nợ
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
import logging

logger = logging.getLogger(__name__)

class TimeSeriesModel:
    def __init__(self, model_type: str = "default"):
        self.model_type = model_type
        self.model = None
        self.scaler = StandardScaler()
        self.is_trained = False
    
    def train(self, data: List[Dict[str, Any]]) -> bool:
        """
        Huấn luyện model với dữ liệu lịch sử
        Args:
            data: Danh sách các bản ghi lịch sử
        """
        if not data:
            return False
        
        try:
            df = pd.DataFrame(data)
            
            # Chuẩn bị features
            X = np.array(range(len(df))).reshape(-1, 1)
            y = df['total_debit'].values - df['total_credit'].values
            
            # Scale dữ liệu
            X_scaled = self.scaler.fit_transform(X)
            
            # Train model
            self.model = LinearRegression()
            self.model.fit(X_scaled, y)
            self.is_trained = True
            
            logger.info(f"TimeSeries model trained with {len(data)} samples")
            return True
        except Exception as e:
            logger.error(f"Training failed: {e}")
            return False
    
    def predict(self, periods: int = 1) -> Dict[str, Any]:
        """
        Dự báo giá trị trong tương lai
        Args:
            periods: Số kỳ cần dự báo
        """
        if not self.is_trained:
            return {"predicted": 0, "confidence": 0}
        
        # Dự báo đơn giản
        last_value = self.model.predict([[periods]])[0]
        
        return {
            "predicted": float(last_value),
            "confidence": 0.75,
            "trend": "increasing" if last_value > 0 else "decreasing"
        }
    
    def predict_inventory(self, item_data: Dict[str, Any]) -> Dict[str, Any]:
        """Dự báo tồn kho"""
        opening = item_data.get("opening_quantity", 0)
        ordered = item_data.get("ordered_quantity", 0)
        delivered = item_data.get("delivered_quantity", 0)
        
        predicted = opening + ordered - delivered
        
        return {
            "predicted_stock": max(0, predicted),
            "days_until_stockout": predicted / max(1, delivered) * 30 if delivered > 0 else 999,
            "confidence": 0.80
        }
    
    def predict_cashflow(self, transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Dự báo dòng tiền"""
        total_in = sum(t.get("amount", 0) for t in transactions if t.get("type") == "in")
        total_out = sum(t.get("amount", 0) for t in transactions if t.get("type") == "out")
        
        net_flow = total_in - total_out
        
        return {
            "net_flow": net_flow,
            "inflow": total_in,
            "outflow": total_out,
            "shortage_risk": net_flow < 0,
            "confidence": 0.70
        }