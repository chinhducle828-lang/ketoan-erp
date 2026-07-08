"""
NLP Model - Xử lý ngôn ngữ tự nhiên
Dùng cho Text-to-SQL và RAG
"""

import re
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)

class NLPModel:
    def __init__(self):
        self.schema_keywords = {
            "vouchers": ["chứng từ", "phiếu", "voucher", "giao dịch"],
            "partners": ["đối tác", "khách hàng", "nhà cung cấp", "partner"],
            "items": ["hàng hóa", "vật tư", "sản phẩm", "mặt hàng"],
            "cashflow": ["dòng tiền", "tiền", "cash", "lưu chuyển"]
        }
    
    def text_to_sql(self, question: str, company_id: str, schema: str = "") -> Dict[str, Any]:
        """
        Chuyển câu hỏi thành SQL
        Args:
            question: Câu hỏi tự nhiên
            company_id: ID công ty
            schema: Schema database
        """
        question_lower = question.lower()
        sql_parts = ["SELECT * FROM vouchers"]
        
        # Xác định bảng cần truy vấn
        table = "vouchers"
        for tbl, keywords in self.schema_keywords.items():
            if any(kw in question_lower for kw in keywords):
                table = tbl
                break
        
        # Thêm điều kiện company_id
        sql_parts = [f"SELECT * FROM {table}", f"WHERE company_id = '{company_id}'"]
        
        # Xử lý các trường hợp cụ thể
        if "tháng" in question_lower or "thang" in question_lower:
            sql_parts.append("AND voucher_date >= DATE_TRUNC('month', NOW())")
        
        if "năm" in question_lower or "nam" in question_lower:
            sql_parts.append("AND voucher_date >= DATE_TRUNC('year', NOW())")
        
        if "số tiền" in question_lower or "tổng" in question_lower:
            sql_parts[0] = f"SELECT SUM(amount) as total FROM {table}"
        
        sql = " ".join(sql_parts)
        
        return {
            "sql": sql,
            "confidence": 0.80,
            "table": table
        }
    
    def rag_summarize(self, question: str, data: List[Dict], sql: str) -> Dict[str, Any]:
        """
        Tóm tắt dữ liệu bằng RAG
        Args:
            question: Câu hỏi
            data: Dữ liệu đã truy vấn
            sql: Câu lệnh SQL
        """
        if not data:
            return {
                "answer": "Không tìm thấy dữ liệu phù hợp",
                "confidence": 0.50
            }
        
        # Tính tổng nếu có
        total = sum(d.get("amount", 0) for d in data if d.get("amount"))
        
        # Tạo câu trả lời
        answer = f"Tìm được {len(data)} bản ghi"
        if total > 0:
            answer += f", tổng số tiền: {total:,.0f} VND"
        
        return {
            "answer": answer,
            "confidence": 0.85,
            "data_count": len(data)
        }
    
    def extract_entities(self, text: str) -> Dict[str, Any]:
        """
        Trích xuất entities từ text
        """
        entities = {
            "amounts": [],
            "dates": [],
            "invoice_numbers": []
        }
        
        # Trích xuất số tiền
        amounts = re.findall(r'(\d{1,3}(?:[.,]\d{3})*|\d+)([ ]?(?:nghìn|ngàn|triệu|tỷ)?)', text, re.IGNORECASE)
        entities["amounts"] = [amt[0] for amt in amounts]
        
        # Trích xuất ngày
        dates = re.findall(r'(\d{1,2}/\d{1,2}/\d{4})', text)
        entities["dates"] = dates
        
        # Trích xuất số hóa đơn
        invoices = re.findall(r'(INV|SO|HD)[- ]?(\d+)', text, re.IGNORECASE)
        entities["invoice_numbers"] = [f"{i[0]}-{i[1]}" for i in invoices]
        
        return entities