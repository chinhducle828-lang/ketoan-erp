"""
OCR Model - Xử lý OCR hóa đơn
Hỗ trợ PaddleOCR/Tesseract
"""

import os
import numpy as np
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)

DEFAULT_INVOICE_NUMBER_PREFIX = os.getenv("AI_DEFAULT_INVOICE_NUMBER_PREFIX", "INV")
DEFAULT_INVOICE_DATE = os.getenv("AI_DEFAULT_INVOICE_DATE", "2025-01-15")
DEFAULT_VENDOR_NAME = os.getenv("AI_DEFAULT_VENDOR_NAME", "Công ty ABC")
DEFAULT_ITEM_NAME = os.getenv("AI_DEFAULT_ITEM_NAME", "Hàng hóa 1")
DEFAULT_ITEM_QUANTITY = int(os.getenv("AI_DEFAULT_ITEM_QUANTITY", "10"))
DEFAULT_ITEM_UNIT_PRICE = float(os.getenv("AI_DEFAULT_ITEM_UNIT_PRICE", "100000"))
DEFAULT_ITEM_AMOUNT = float(os.getenv("AI_DEFAULT_ITEM_AMOUNT", "1000000"))

class OCRModel:
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path
        self.is_loaded = False
        self._load_model()
    
    def _load_model(self):
        """Load OCR model - mock implementation"""
        # TODO: Tích hợp PaddleOCR/Tesseract thực tế
        self.is_loaded = True
        logger.info("OCR Model loaded (mock)")
    
    def process_invoice(self, file_url: str, company_id: str) -> Dict[str, Any]:
        """
        Xử lý OCR hóa đơn
        Args:
            file_url: URL file hóa đơn
            company_id: ID công ty
        Returns:
            Kết quả OCR với confidence score
        """
        # Mock implementation - thay thế bằng PaddleOCR thực tế
        return {
            "confidence_score": float(os.getenv("AI_DEFAULT_OCR_CONFIDENCE", "85.0")),
            "invoice_number": f"{DEFAULT_INVOICE_NUMBER_PREFIX}-{np.random.randint(1000, 9999)}",
            "invoice_date": DEFAULT_INVOICE_DATE,
            "vendor_tax_code": f"{np.random.randint(10000000, 99999999)}",
            "vendor_name": DEFAULT_VENDOR_NAME,
            "items": [
                {
                    "name": DEFAULT_ITEM_NAME,
                    "quantity": DEFAULT_ITEM_QUANTITY,
                    "unit_price": DEFAULT_ITEM_UNIT_PRICE,
                    "amount": DEFAULT_ITEM_AMOUNT
                }
            ],
            "entries": [
                {
                    "account_code": "111",
                    "entry_type": "DR",
                    "amount": DEFAULT_ITEM_AMOUNT,
                    "description": "Doanh thu"
                },
                {
                    "account_code": "131",
                    "entry_type": "CR",
                    "amount": DEFAULT_ITEM_AMOUNT,
                    "description": "Tiền mặt"
                }
            ]
        }
    
    def calculate_confidence(self, ocr_result: Dict[str, Any]) -> float:
        """Tính confidence score từ kết quả OCR"""
        score = 100.0
        
        # Trừ điểm nếu thiếu thông tin
        if not ocr_result.get("vendor_tax_code"):
            score -= 10
        if not ocr_result.get("items"):
            score -= 20
        
        # Kiểm tra cân đối
        total_debit = sum(
            e.get("amount", 0) 
            for e in ocr_result.get("entries", []) 
            if e.get("entry_type") == "DR"
        )
        total_credit = sum(
            e.get("amount", 0) 
            for e in ocr_result.get("entries", []) 
            if e.get("entry_type") == "CR"
        )
        
        if abs(total_debit - total_credit) > 1000:
            score -= 30
        
        return max(0, min(100, score))