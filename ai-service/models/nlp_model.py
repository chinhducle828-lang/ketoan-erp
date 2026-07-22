"""
NLP Model - Xử lý ngôn ngữ tự nhiên
Dùng cho Text-to-SQL và RAG với semantic understanding

Kiến trúc:
1. Intent Classification: Xác định ý định câu hỏi (truy vấn, báo cáo, phân tích)
2. Entity Extraction: Trích xuất thực thể (thời gian, số tiền, tài khoản, đối tác)
3. SQL Generation: Tạo SQL từ intent + entities
4. RAG Summarization: Tóm tắt kết quả thành câu trả lời tự nhiên

Cấu hình:
  - AI_NLP_MODE: regex|llm (default: regex - không cần GPU)
  - AI_NLP_MODEL: Tên model LLM (nếu dùng llm mode)
"""

import os
import re
import json
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, date, timedelta
from collections import defaultdict
import logging

logger = logging.getLogger(__name__)

# Try to load optional dependencies
try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False


class NLPModel:
    """
    NLP Model for Vietnamese accounting queries.
    
    Supports:
    - Natural language to SQL conversion
    - Entity extraction (amounts, dates, accounts, partners)
    - Intent classification (query, report, analysis)
    - Result summarization in natural language
    """

    # Vietnamese date/time patterns
    DATE_PATTERNS = {
        'tháng này': ('month', 0),
        'tháng trước': ('month', -1),
        'quý này': ('quarter', 0),
        'quý trước': ('quarter', -1),
        'năm nay': ('year', 0),
        'năm ngoái': ('year', -1),
        'năm trước': ('year', -1),
        'hôm nay': ('day', 0),
        'hôm qua': ('day', -1),
        'tuần này': ('week', 0),
        'tuần trước': ('week', -1),
    }

    # Intent patterns for Vietnamese accounting
    INTENT_PATTERNS = {
        'select': [
            r'(?:cho|liệt kê|hiển thị|xem|tìm|lấy)\s+(?:tôi\s+)?(?:danh\s*sách\s+)?',
            r'(?:có\s+)?(?:bao\s+nhiêu|mấy)\s+',
            r'(?:ai|đâu|là)\s+',
        ],
        'aggregate': [
            r'(?:tổng|tổng\s+cộng|sum|total)\s+',
            r'(?:tính|tính\s+toán)\s+',
            r'(?:bao\s+nhiêu|mấy)\s+',
        ],
        'report': [
            r'(?:báo\s+cáo|report|bảng\s+kê|bảng\s+tổng\s+hợp)',
            r'(?:sổ\s+.*|sổ\s+sách)',
            r'(?:kết\s+chuyển|k/c)',
        ],
        'compare': [
            r'(?:so\s+sánh|compare|chênh\s+lệch|tăng|giảm)',
            r'(?:so\s+với|so\s+sánh\s+với)',
        ],
    }

    # Table mappings for Vietnamese accounting
    TABLE_MAPPINGS = {
        'vouchers': {
            'keywords': ['chứng từ', 'phiếu', 'voucher', 'giao dịch', 'phát sinh', 'bút toán'],
            'columns': {
                'id': 'id',
                'voucher_number': ['số chứng từ', 'số', 'mã', 'số phiếu'],
                'voucher_date': ['ngày', 'ngày chứng từ', 'ngày hạch toán'],
                'voucher_type': ['loại', 'loại chứng từ', 'mẫu số'],
                'description': ['diễn giải', 'nội dung', 'mô tả'],
                'amount': ['số tiền', 'tiền', 'giá trị'],
                'currency': ['tiền tệ', 'ngoại tệ'],
                'is_posted': ['đã ghi sổ', 'đã post', 'trạng thái'],
            },
        },
        'partners': {
            'keywords': ['đối tác', 'khách hàng', 'nhà cung cấp', 'partner', 'vendor', 'supplier'],
            'columns': {
                'partner_code': ['mã đối tác', 'mã khách hàng', 'mã'],
                'partner_name': ['tên', 'tên đối tác', 'tên khách hàng'],
                'type': ['loại', 'loại đối tác'],
                'phone': ['điện thoại', 'sđt', 'phone'],
                'total_debt': ['công nợ', 'nợ', 'dư nợ'],
            },
        },
        'items': {
            'keywords': ['hàng hóa', 'vật tư', 'sản phẩm', 'mặt hàng', 'item', 'hàng'],
            'columns': {
                'code': ['mã', 'mã hàng', 'mã vật tư'],
                'name': ['tên', 'tên hàng', 'tên vật tư'],
                'unit': ['đơn vị', 'đvt', 'unit'],
                'price_sell': ['giá bán', 'đơn giá'],
                'opening_quantity': ['tồn đầu', 'tồn kho'],
            },
        },
        'companies': {
            'keywords': ['công ty', 'doanh nghiệp', 'cty'],
            'columns': {
                'name': ['tên', 'tên công ty'],
                'tax_code': ['mã số thuế', 'mst'],
                'address': ['địa chỉ'],
            },
        },
    }

    # Vietnamese number words mapping
    NUMBER_WORDS = {
        'không': 0, 'một': 1, 'hai': 2, 'ba': 3, 'bốn': 4,
        'năm': 5, 'sáu': 6, 'bảy': 7, 'tám': 8, 'chín': 9,
        'mười': 10, 'trăm': 100, 'nghìn': 1000, 'ngàn': 1000,
        'triệu': 1000000, 'tỷ': 1000000000,
    }

    def __init__(self):
        self.mode = os.getenv('AI_NLP_MODE', 'regex').lower()
        self.schema_keywords = {
            tbl: info['keywords'] for tbl, info in self.TABLE_MAPPINGS.items()
        }

    def text_to_sql(self, question: str, company_id: str, schema: str = "") -> Dict[str, Any]:
        """
        Convert natural language question to SQL query.
        Returns SQL string with confidence score.
        """
        start_time = datetime.now()
        question_lower = question.lower().strip()

        # Step 1: Classify intent
        intent = self._classify_intent(question_lower)

        # Step 2: Extract entities
        entities = self.extract_entities(question)

        # Step 3: Identify target table
        table, confidence = self._identify_table(question_lower)

        # Step 4: Extract conditions
        conditions = self._extract_conditions(question_lower, entities)

        # Step 5: Generate SQL
        sql = self._build_sql(intent, table, conditions, company_id, entities)

        # Step 6: Calculate overall confidence
        overall_confidence = self._calculate_sql_confidence(
            intent, table, conditions, entities
        )

        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        return {
            "sql": sql,
            "confidence": overall_confidence,
            "table": table,
            "intent": intent,
            "entities": {k: v for k, v in entities.items() if v},
            "conditions": conditions,
            "processing_time_ms": round(processing_time, 2),
        }

    def _classify_intent(self, text: str) -> str:
        """Classify the user's intent"""
        scores = defaultdict(int)

        for intent, patterns in self.INTENT_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, text):
                    scores[intent] += 1

        # Additional heuristics
        if any(w in text for w in ['tổng', 'sum', 'bao nhiêu']):
            scores['aggregate'] += 1
        if any(w in text for w in ['so sánh', 'tăng', 'giảm', 'chênh lệch']):
            scores['compare'] += 1

        if not scores:
            return 'select'

        return max(scores, key=scores.get)

    def _identify_table(self, text: str) -> Tuple[str, float]:
        """Identify the most likely table from the query"""
        best_table = 'vouchers'
        best_score = 0

        for table, info in self.TABLE_MAPPINGS.items():
            score = 0
            for keyword in info['keywords']:
                if keyword in text:
                    score += 10
                    # Bonus for exact match
                    if text.startswith(keyword) or text.endswith(keyword):
                        score += 5

            # Check column references
            for col_name, col_keywords in info['columns'].items():
                for kw in col_keywords:
                    if kw in text:
                        score += 3

            if score > best_score:
                best_score = score
                best_table = table

        confidence = min(100, 50 + best_score * 5)
        return best_table, confidence

    def _extract_conditions(self, text: str, entities: Dict) -> List[Dict]:
        """Extract WHERE conditions from query"""
        conditions = []

        # Date conditions
        for phrase, (unit, offset) in self.DATE_PATTERNS.items():
            if phrase in text:
                conditions.append({
                    'field': 'voucher_date',
                    'operator': '>=',
                    'value': self._get_date_range(unit, offset)[0],
                    'type': 'date',
                })
                if offset == 0:  # Current period - also add end date
                    conditions.append({
                        'field': 'voucher_date',
                        'operator': '<=',
                        'value': self._get_date_range(unit, offset)[1],
                        'type': 'date',
                    })
                break

        # Specific date patterns
        date_match = re.search(r'(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})', text)
        if date_match:
            conditions.append({
                'field': 'voucher_date',
                'operator': '=',
                'value': f"{date_match.group(3)}-{date_match.group(2).zfill(2)}-{date_match.group(1).zfill(2)}",
                'type': 'date',
            })

        # Amount conditions
        amounts = entities.get('amounts', [])
        if amounts:
            # Check for comparison operators
            if any(w in text for w in ['lớn hơn', '>', 'trên', 'nhiều hơn']):
                conditions.append({
                    'field': 'amount',
                    'operator': '>',
                    'value': amounts[-1],
                    'type': 'amount',
                })
            elif any(w in text for w in ['nhỏ hơn', '<', 'dưới', 'ít hơn']):
                conditions.append({
                    'field': 'amount',
                    'operator': '<',
                    'value': amounts[-1],
                    'type': 'amount',
                })
            else:
                conditions.append({
                    'field': 'amount',
                    'operator': '>=',
                    'value': amounts[-1],
                    'type': 'amount',
                })

        # Status conditions
        if any(w in text for w in ['đã ghi sổ', 'đã post', 'đã hạch toán']):
            conditions.append({
                'field': 'is_posted',
                'operator': '=',
                'value': True,
                'type': 'status',
            })
        elif any(w in text for w in ['chưa ghi sổ', 'chưa post', 'nháp']):
            conditions.append({
                'field': 'is_posted',
                'operator': '=',
                'value': False,
                'type': 'status',
            })

        # Partner conditions
        partners = entities.get('partners', [])
        if partners:
            conditions.append({
                'field': 'partner_name',
                'operator': 'ILIKE',
                'value': f"%{partners[0]}%",
                'type': 'text',
            })

        return conditions

    def _build_sql(self, intent: str, table: str, conditions: List[Dict],
                   company_id: str, entities: Dict) -> str:
        """Build SQL query from parsed components"""
        company_id_safe = company_id.replace("'", "''")

        if intent == 'aggregate':
            select_clause = "SELECT COUNT(*) as count"
            if entities.get('amounts'):
                select_clause = "SELECT COALESCE(SUM(amount), 0) as total"
        elif intent == 'compare':
            select_clause = """
                SELECT 
                    DATE_TRUNC('month', voucher_date) as period,
                    COUNT(*) as count,
                    COALESCE(SUM(amount), 0) as total
            """
        else:
            select_clause = "SELECT *"

        sql_parts = [select_clause]
        sql_parts.append(f"FROM {table}")
        sql_parts.append(f"WHERE company_id = '{company_id_safe}'")

        for cond in conditions:
            if cond['type'] == 'date':
                val = cond['value']
                if cond['operator'] == '>=':
                    sql_parts.append(f"AND {cond['field']} >= '{val}'::date")
                elif cond['operator'] == '<=':
                    sql_parts.append(f"AND {cond['field']} <= '{val}'::date")
                else:
                    sql_parts.append(f"AND {cond['field']} = '{val}'::date")
            elif cond['type'] == 'amount':
                if cond['operator'] == '>':
                    sql_parts.append(f"AND {cond['field']} > {cond['value']}")
                elif cond['operator'] == '<':
                    sql_parts.append(f"AND {cond['field']} < {cond['value']}")
                else:
                    sql_parts.append(f"AND {cond['field']} >= {cond['value']}")
            elif cond['type'] == 'status':
                sql_parts.append(f"AND {cond['field']} = {str(cond['value']).upper()}")
            elif cond['type'] == 'text':
                val = cond['value'].replace("'", "''")
                sql_parts.append(f"AND {cond['field']} {cond['operator']} '{val}'")

        # Add ordering
        if intent == 'compare':
            sql_parts.append("GROUP BY DATE_TRUNC('month', voucher_date)")
            sql_parts.append("ORDER BY period DESC")
        else:
            sql_parts.append("ORDER BY created_at DESC")

        # Add limit for safety
        if intent != 'aggregate':
            sql_parts.append("LIMIT 100")

        return '\n'.join(sql_parts)

    def _calculate_sql_confidence(self, intent: str, table: str,
                                   conditions: List[Dict], entities: Dict) -> float:
        """Calculate confidence score for SQL generation"""
        score = 80.0  # Base confidence

        # Deduct for ambiguity
        if intent == 'select' and not conditions:
            score -= 10  # Broad query
        if not table:
            score -= 20
        if not entities.get('dates') and not entities.get('amounts'):
            score -= 5  # No filters

        # Bonus for clear intent
        if intent != 'select':
            score += 5

        return max(0, min(100, score))

    def _get_date_range(self, unit: str, offset: int) -> Tuple[str, str]:
        """Get date range for relative time expressions"""
        today = date.today()

        if unit == 'day':
            target = today + timedelta(days=offset)
            return target.isoformat(), target.isoformat()

        elif unit == 'week':
            target = today + timedelta(weeks=offset)
            start = target - timedelta(days=target.weekday())
            end = start + timedelta(days=6)
            return start.isoformat(), end.isoformat()

        elif unit == 'month':
            target = today.replace(day=1)
            if offset < 0:
                for _ in range(abs(offset)):
                    target = (target.replace(day=1) - timedelta(days=1)).replace(day=1)
            elif offset > 0:
                for _ in range(offset):
                    target = (target + timedelta(days=32)).replace(day=1)
            # End of month
            if target.month == 12:
                next_month = target.replace(year=target.year + 1, month=1)
            else:
                next_month = target.replace(month=target.month + 1)
            end = next_month - timedelta(days=1)
            return target.isoformat(), end.isoformat()

        elif unit == 'quarter':
            current_quarter = (today.month - 1) // 3
            target_quarter = current_quarter + offset
            start_month = (target_quarter % 4) * 3 + 1
            year = today.year + (target_quarter // 4) - (1 if target_quarter < 0 else 0)
            if year < 1:
                year = 1
            start = date(year, start_month, 1)
            if start_month == 10:
                end = date(year, 12, 31)
            else:
                end = date(year, start_month + 3, 1) - timedelta(days=1)
            return start.isoformat(), end.isoformat()

        elif unit == 'year':
            target_year = today.year + offset
            return f"{target_year}-01-01", f"{target_year}-12-31"

        return today.isoformat(), today.isoformat()

    def rag_summarize(self, question: str, data: List[Dict], sql: str) -> Dict[str, Any]:
        """
        Summarize query results into natural language.
        Uses template-based generation for reliability.
        """
        if not data:
            return {
                "answer": "Không tìm thấy dữ liệu phù hợp với yêu cầu của bạn.",
                "confidence": 0.90,
                "data_count": 0,
                "sql_used": sql,
            }

        data_count = len(data)
        question_lower = question.lower()

        # Check if this is an aggregate query
        if 'count' in data[0] and 'total' not in data[0]:
            total = data[0]['count']
            answer = f"Có {total:,} bản ghi"
            if any(w in question_lower for w in ['chứng từ', 'phiếu', 'giao dịch']):
                answer += " chứng từ"
            answer += "."
            return {
                "answer": answer,
                "confidence": 0.95,
                "data_count": total,
                "sql_used": sql,
            }

        if 'total' in data[0]:
            total = data[0]['total'] or 0
            # Generate appropriate response based on context
            if any(w in question_lower for w in ['doanh thu', 'bán']):
                answer = f"Tổng doanh thu: {total:,.0f} VND"
            elif any(w in question_lower for w in ['chi phí', 'mua']):
                answer = f"Tổng chi phí: {total:,.0f} VND"
            elif any(w in question_lower for w in ['nợ', 'công nợ']):
                answer = f"Tổng công nợ: {total:,.0f} VND"
            else:
                answer = f"Tổng số tiền: {total:,.0f} VND"

            if data_count > 1:
                answer += f" (từ {data_count} bản ghi)"
            answer += "."

            return {
                "answer": answer,
                "confidence": 0.92,
                "data_count": data_count,
                "sql_used": sql,
            }

        # Period comparison
        if 'period' in data[0]:
            lines = ["Kết quả so sánh theo kỳ:"]
            for row in data[:12]:  # Max 12 periods
                period = row.get('period', '')
                count = row.get('count', 0)
                total = row.get('total', 0) or 0
                if period:
                    lines.append(f"- Kỳ {period}: {count} bản ghi, {total:,.0f} VND")

            return {
                "answer": '\n'.join(lines),
                "confidence": 0.88,
                "data_count": data_count,
                "sql_used": sql,
            }

        # General result
        sample = data[0]
        details = []
        for field in ['voucher_number', 'voucher_date', 'description', 'amount', 'partner_name']:
            if field in sample:
                val = sample[field]
                if field == 'amount' and val:
                    val = f"{val:,.0f} VND"
                details.append(f"{field}: {val}")

        answer = f"Tìm thấy {data_count} kết quả."
        if details:
            answer += f"\nVí dụ: {', '.join(details[:3])}"

        return {
            "answer": answer,
            "confidence": 0.85,
            "data_count": data_count,
            "sql_used": sql,
        }

    def extract_entities(self, text: str) -> Dict[str, Any]:
        """
        Extract structured entities from text.
        Returns amounts, dates, account codes, and other entities.
        """
        entities = {
            "amounts": [],
            "dates": [],
            "account_codes": [],
            "partners": [],
            "voucher_types": [],
        }

        # Extract amounts (Vietnamese format: 1.000.000 or 1,000,000)
        amount_patterns = [
            r'(\d{1,3}(?:\.\d{3})+(?:[,]\d{2})?)',  # 1.000.000
            r'(\d{1,3}(?:,\d{3})+(?:[.]\d{2})?)',  # 1,000,000
            r'(\d+)\s*(?:nghìn|ngàn|triệu|tỷ)',  # 10 triệu
            r'(\d+)\s*VND',  # 100000 VND
        ]
        for pattern in amount_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for m in matches:
                try:
                    # Clean and normalize
                    clean = m.replace('.', '').replace(',', '')
                    entities["amounts"].append(float(clean))
                except ValueError:
                    continue

        # Convert Vietnamese number words
        for word, value in self.NUMBER_WORDS.items():
            if word in text.lower():
                entities["amounts"].append(float(value))

        # Extract dates
        date_patterns = [
            r'(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})',  # DD/MM/YYYY
            r'(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})',  # YYYY-MM-DD
            r'(\d{1,2})[/\-](\d{4})',  # MM/YYYY
        ]
        for pattern in date_patterns:
            matches = re.findall(pattern, text)
            for m in matches:
                entities["dates"].append('/'.join(m))

        # Extract account codes (111, 112, 131, 156, 331, etc.)
        account_pattern = r'\b(1\d{2}|2\d{2}|3\d{2}|4\d{2}|5\d{2}|6\d{2}|7\d{2}|8\d{2}|9\d{2})\b'
        entities["account_codes"] = list(set(re.findall(account_pattern, text)))

        # Extract Vietnamese accounting account names
        account_names = [
            'tiền mặt', 'tiền gửi', 'phải thu', 'hàng hóa', 'tài sản',
            'phải trả', 'vốn', 'doanh thu', 'chi phí', 'thu nhập',
        ]
        for name in account_names:
            if name in text.lower():
                entities["account_codes"].append(name)

        # Extract partner names (words after common prefixes)
        partner_prefixes = ['đối tác', 'khách hàng', 'nhà cung cấp']
        for prefix in partner_prefixes:
            match = re.search(fr'{prefix}\s+(\w+)', text, re.IGNORECASE)
            if match:
                entities["partners"].append(match.group(1))

        # Extract voucher types
        voucher_types = {
            'phiếu thu': 'PT', 'thu': 'PT',
            'phiếu chi': 'PC', 'chi': 'PC',
            'phiếu nhập': 'NK', 'nhập kho': 'NK',
            'phiếu xuất': 'PX', 'xuất kho': 'PX',
        }
        for name, code in voucher_types.items():
            if name in text.lower():
                entities["voucher_types"].append(code)

        return entities