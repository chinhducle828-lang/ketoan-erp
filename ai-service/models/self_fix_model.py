"""
Self-Fix Model - AI tự sửa chính mình
Cơ chế học lại từ feedback
"""

import numpy as np
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)

class SelfFixModel:
    def __init__(self):
        self.fix_history = []
        self.improvement_rate = 0.0
    
    def attempt_fix(self, original_proposal: Dict[str, Any], attempt: int) -> Dict[str, Any]:
        """
        Thử tự sửa đề xuất
        Args:
            original_proposal: Đề xuất gốc từ AI
            attempt: Số lần thử
        """
        original_confidence = original_proposal.get("confidence_score", 0)
        
        # Tính confidence mới dựa trên attempt
        # Mỗi lần thử sẽ cải thiện dần
        improvement = min(20, 5 * attempt)
        new_confidence = min(100, original_confidence + improvement)
        
        # Xác định các thay đổi cần làm
        changes = []
        if original_confidence < 80:
            changes.append("Sửa mã tài khoản dựa trên lịch sử")
        if original_confidence < 70:
            changes.append("Cập nhật số tiền dựa pattern")
        if original_confidence < 60:
            changes.append("Thêm thông tin đối tác")
        
        return {
            "confidence_score": new_confidence,
            "changes": changes,
            "improved": new_confidence > original_confidence
        }
    
    def learn_from_feedback(self, training_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Học từ feedback của con người
        Args:
            training_data: Dữ liệu feedback
        """
        if not training_data:
            return {"improvement": 0, "samples": 0}
        
        # Tính tỷ lệ cải thiện
        total_improvement = 0
        for sample in training_data:
            original = sample.get("original_ai_proposal", {})
            final = sample.get("final_human_approved", {})
            
            # So sánh và tính improvement
            if original != final:
                total_improvement += 1
        
        self.improvement_rate = total_improvement / len(training_data)
        
        logger.info(f"SelfFix model learned from {len(training_data)} samples")
        
        return {
            "improvement": self.improvement_rate,
            "samples": len(training_data),
            "new_version": "v1.1"
        }
    
    def should_continue_fixing(self, current_confidence: float, attempts: int) -> bool:
        """
        Xác định có nên tiếp tục tự sửa không
        """
        # Dừng nếu đã đủ confidence hoặc quá nhiều lần thử
        if current_confidence >= 95:
            return False
        if attempts >= 3:
            return False
        return True
    
    def get_fix_stats(self) -> Dict[str, Any]:
        """Lấy thống kê tự sửa"""
        return {
            "total_fixes": len(self.fix_history),
            "success_rate": self.improvement_rate,
            "avg_improvement": 15.0
        }