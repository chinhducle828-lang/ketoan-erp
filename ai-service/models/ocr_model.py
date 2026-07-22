"""
OCR Model - Xử lý OCR hóa đơn
Hỗ trợ: PaddleOCR (GPU), Tesseract (CPU), hoặc HTTP-based extraction
Cấu hình qua biến môi trường:
  - AI_OCR_ENGINE: paddle|tesseract|http|regex (default: regex - no heavy deps needed)
  - AI_OCR_ENDPOINT: URL của OCR service nếu dùng http mode
  - AI_DEFAULT_OCR_CONFIDENCE: Confidence mặc định (0-100)
"""

import os
import json
import hashlib
import tempfile
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import logging
from datetime import datetime, date
import re

logger = logging.getLogger(__name__)

# Try to load optional heavy dependencies
try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

try:
    import pytesseract  # type: ignore[import-not-found]
    HAS_TESSERACT = True
except ImportError:
    HAS_TESSERACT = False

try:
    from paddleocr import PaddleOCR  # type: ignore[import-not-found]
    HAS_PADDLE = True
except ImportError:
    HAS_PADDLE = False

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    HAS_HTTPX = False


class OCRModel:
    """OCR Model with multiple backends - flexible and extensible"""

    # Vietnamese invoice patterns for structured extraction
    INVOICE_PATTERNS = {
        'invoice_number': [
            r'(?:Số|SỐ|No\.?|Invoice\s*#?)\s*[:.]?\s*([A-Z0-9/\-]+)',
            r'(?:HD|INV|HĐ)[\-_\s]*(\d+)',
        ],
        'invoice_date': [
            r'(?:Ngày|DATE|Date)\s*[:.]?\s*(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4})',
            r'(\d{4}[/\-]\d{2}[/\-]\d{2})',
        ],
        'vendor_name': [
            r'(?:Tên\s*người\s*bán|Vendor|Supplier|Seller)\s*[:.]?\s*(.+?)(?:\n|$)',
            r'(?:CÔNG TY|CTY)\s+[A-ZÀ-Ỹ\s]+',
        ],
        'vendor_tax_code': [
            r'(?:MST|Mã\s*số\s*thuế|Tax\s*Code)\s*[:.]?\s*(\d{10,14})',
        ],
        'total_amount': [
            r'(?:Tổng\s*cộng|Total|Sum)\s*[:.]?\s*([\d,.\s]+)',
            r'(?:Số\s*tiền|Amount)\s*[:.]?\s*([\d,.\s]+)',
        ],
    }

    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path
        self.engine = os.getenv('AI_OCR_ENGINE', 'regex').lower()
        self.http_endpoint = os.getenv('AI_OCR_ENDPOINT', '')
        self.default_confidence = float(os.getenv('AI_DEFAULT_OCR_CONFIDENCE', '85.0'))
        self.is_loaded = False
        self._paddle_ocr = None
        self._load_model()

    def _load_model(self):
        """Load OCR engine based on configuration"""
        if self.engine == 'paddle' and HAS_PADDLE:
            try:
                self._paddle_ocr = PaddleOCR(
                    use_angle_cls=True,
                    lang='ch',
                    use_gpu=os.getenv('AI_USE_GPU', 'false').lower() == 'true'
                )
                self.is_loaded = True
                logger.info("OCR Model loaded: PaddleOCR")
                return
            except Exception as e:
                logger.warning(f"Failed to load PaddleOCR: {e}. Falling back.")
                self.engine = 'tesseract' if HAS_TESSERACT else 'regex'

        if self.engine == 'tesseract' and HAS_TESSERACT:
            self.is_loaded = True
            logger.info("OCR Model loaded: Tesseract")
            return
        elif self.engine == 'http' and self.http_endpoint:
            self.is_loaded = True
            logger.info(f"OCR Model loaded: HTTP endpoint {self.http_endpoint}")
            return

        # Default: regex-based extraction (works without any heavy dependencies)
        self.engine = 'regex'
        self.is_loaded = True
        logger.info("OCR Model loaded: regex-based extraction (no heavy deps)")

    async def process_invoice(self, file_url: str, company_id: str) -> Dict[str, Any]:
        """
        Process invoice from URL or file path.
        Returns structured invoice data with confidence scoring.
        """
        raw_text = ""
        image_data = None

        # Step 1: Get file content
        if file_url.startswith(('http://', 'https://')):
            raw_text, image_data = await self._download_and_extract(file_url)
        elif file_url.startswith(('data:')):
            raw_text, image_data = self._extract_from_base64(file_url)
        elif Path(file_url).exists():
            raw_text, image_data = self._extract_from_file(file_url)
        else:
            logger.warning(f"Cannot access file: {file_url}")
            return self._fallback_result("File not accessible")

        # Step 2: Extract structured data
        extracted = None
        if image_data is not None and HAS_PIL and (HAS_TESSERACT or HAS_PADDLE):
            extracted = self._ocr_extract(image_data)
        elif raw_text:
            extracted = self._regex_extract(raw_text)

        if extracted is None:
            return self._fallback_result("No data could be extracted")

        # Step 3: Calculate confidence
        confidence = self.calculate_confidence(extracted)

        # Step 4: Generate accounting entries
        entries = self._generate_entries(extracted)

        return {
            "confidence_score": confidence,
            "invoice_number": extracted.get("invoice_number", ""),
            "invoice_date": extracted.get("invoice_date", ""),
            "vendor_tax_code": extracted.get("vendor_tax_code", ""),
            "vendor_name": extracted.get("vendor_name", ""),
            "items": extracted.get("items", []),
            "entries": entries,
            "raw_text_preview": raw_text[:500] if raw_text else "",
            "engine_used": self.engine,
        }

    async def _download_and_extract(self, url: str) -> Tuple[str, Optional[Any]]:
        """Download file from URL and extract text/image"""
        if not HAS_HTTPX:
            logger.warning("httpx not available, cannot download from URL")
            return "", None

        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(url)
                response.raise_for_status()
                content = response.content
                content_type = response.headers.get('content-type', '').lower()

                # Handle images
                if 'image' in content_type:
                    if HAS_PIL:
                        from io import BytesIO
                        try:
                            img = Image.open(BytesIO(content))
                            return "", img
                        except Exception as e:
                            logger.warning(f"Failed to open image: {e}")
                            return "", None
                    return "", None

                # Handle PDF
                if 'pdf' in content_type:
                    text = self._extract_pdf_text(content)
                    return text, None

                # Handle text-based content types
                if any(t in content_type for t in ['text', 'json', 'xml', 'csv', 'html']):
                    for encoding in ['utf-8', 'utf-16', 'latin-1']:
                        try:
                            text = content.decode(encoding)
                            if len(text.strip()) > 0:
                                return text, None
                        except (UnicodeDecodeError, UnicodeError):
                            continue
                    return content.decode('utf-8', errors='replace'), None

                # Unknown content type - try text first, then image
                for encoding in ['utf-8', 'utf-16', 'latin-1']:
                    try:
                        text = content.decode(encoding)
                        if len(text.strip()) > 50:
                            return text, None
                    except (UnicodeDecodeError, UnicodeError):
                        continue

                # Try as image
                if HAS_PIL:
                    from io import BytesIO
                    try:
                        img = Image.open(BytesIO(content))
                        return "", img
                    except Exception:
                        pass

                # Last resort: return as text with replacement
                return content.decode('utf-8', errors='replace'), None

        except httpx.TimeoutException:
            logger.error(f"Download timeout for {url}")
            return "", None
        except httpx.HTTPStatusError as e:
            logger.error(f"Download HTTP error {e.response.status_code} for {url}")
            return "", None
        except Exception as e:
            logger.error(f"Download failed: {e}")
            return "", None

    def _extract_from_base64(self, data_uri: str) -> Tuple[str, Optional[Any]]:
        """Extract from base64 data URI"""
        try:
            import base64
            if ',' not in data_uri:
                return "", None
            _, encoded = data_uri.split(',', 1)
            data = base64.b64decode(encoded)

            # Try as image first
            if HAS_PIL:
                from io import BytesIO
                try:
                    img = Image.open(BytesIO(data))
                    return "", img
                except Exception:
                    pass

            # Try as text
            for encoding in ['utf-8', 'utf-16', 'latin-1']:
                try:
                    text = data.decode(encoding)
                    if len(text.strip()) > 0:
                        return text, None
                except (UnicodeDecodeError, UnicodeError):
                    continue

            return data.decode('utf-8', errors='replace'), None
        except Exception as e:
            logger.error(f"Base64 decode failed: {e}")
            return "", None

    def _extract_from_file(self, filepath: str) -> Tuple[str, Optional[Any]]:
        """Extract from local file"""
        try:
            path = Path(filepath)
            if not path.exists():
                logger.warning(f"File not found: {filepath}")
                return "", None

            suffix = path.suffix.lower()

            # Text-based files
            if suffix in ('.txt', '.csv', '.json', '.xml', '.html', '.log'):
                return path.read_text('utf-8', errors='replace'), None

            # PDF files
            if suffix in ('.pdf',):
                text = self._extract_pdf_from_path(path)
                return text, None

            # Image files
            if suffix in ('.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.webp') and HAS_PIL:
                return "", Image.open(path)

            # Unknown - try as text
            try:
                text = path.read_text('utf-8', errors='replace')
                if len(text.strip()) > 50:
                    return text, None
            except (UnicodeDecodeError, UnicodeError):
                pass

            # Try as image
            if HAS_PIL:
                try:
                    return "", Image.open(path)
                except Exception:
                    pass

            logger.warning(f"Unsupported file type: {suffix}")
            return "", None

        except Exception as e:
            logger.error(f"File read failed: {e}")
            return "", None

    def _extract_pdf_from_path(self, path: Path) -> str:
        """Extract text from PDF file"""
        data = path.read_bytes()
        return self._extract_pdf_text(data)

    def _extract_pdf_text(self, data: bytes) -> str:
        """Extract text from PDF binary data"""
        # Try pdfplumber first
        try:
            import pdfplumber
            import io
            with pdfplumber.open(io.BytesIO(data)) as pdf:
                pages = []
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        pages.append(text)
                if pages:
                    return '\n'.join(pages)
        except ImportError:
            pass
        except Exception as e:
            logger.warning(f"pdfplumber failed: {e}")

        # Try PyPDF2 as fallback
        try:
            import PyPDF2  # type: ignore[import-not-found]
            import io
            reader = PyPDF2.PdfReader(io.BytesIO(data))
            pages = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)
            if pages:
                return '\n'.join(pages)
        except ImportError:
            pass
        except Exception as e:
            logger.warning(f"PyPDF2 failed: {e}")

        # No PDF library available
        logger.warning("No PDF extraction library available (install pdfplumber or PyPDF2)")
        return ""

    def _ocr_extract(self, image) -> Dict[str, Any]:
        """Extract text from image using OCR engine (synchronous)"""
        result = {
            "invoice_number": "",
            "invoice_date": "",
            "vendor_name": "",
            "vendor_tax_code": "",
            "items": [],
            "total_amount": 0,
        }

        raw_text = ""

        if self.engine == 'paddle' and self._paddle_ocr:
            try:
                import numpy as np
                if isinstance(image, Image.Image):
                    img_array = np.array(image)
                else:
                    img_array = image

                ocr_result = self._paddle_ocr.ocr(img_array)
                if ocr_result and ocr_result[0]:
                    lines = [line[1][0] for line in ocr_result[0] if line[1]]
                    raw_text = '\n'.join(lines)
            except Exception as e:
                logger.error(f"PaddleOCR failed: {e}")

        elif self.engine == 'tesseract' and HAS_TESSERACT:
            try:
                custom_config = r'--oem 3 --psm 6 -l vie+eng'
                raw_text = pytesseract.image_to_string(image, config=custom_config)
            except Exception as e:
                logger.error(f"Tesseract failed: {e}")

        if raw_text:
            extracted = self._regex_extract(raw_text)
            result.update(extracted)

        return result

    def _regex_extract(self, text: str) -> Dict[str, Any]:
        """Extract structured data from text using regex patterns"""
        result = {
            "invoice_number": "",
            "invoice_date": "",
            "vendor_name": "",
            "vendor_tax_code": "",
            "items": [],
            "total_amount": 0,
        }

        if not text or not text.strip():
            return result

        # Extract fields using patterns
        for field, patterns in self.INVOICE_PATTERNS.items():
            for pattern in patterns:
                match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
                if match:
                    value = match.group(1).strip()
                    if field == 'total_amount':
                        # Clean and parse amount (remove dots, commas, spaces)
                        value = re.sub(r'[.,\s]', '', value)
                        try:
                            result[field] = float(value)
                        except ValueError:
                            pass
                    else:
                        result[field] = value
                    break

        # Extract line items from table-like structures
        items = self._extract_line_items(text)
        if items:
            result["items"] = items

        return result

    def _extract_line_items(self, text: str) -> List[Dict[str, Any]]:
        """Extract line items from invoice text"""
        items = []
        lines = text.split('\n')

        # Pattern 1: quantity + description + unit_price + amount
        item_pattern1 = re.compile(
            r'(\d+[.,]?\d*)\s+'  # quantity
            r'([A-ZÀ-Ỹa-zà-ỹ0-9][A-ZÀ-Ỹa-zà-ỹ0-9\s/\-]+?)\s+'  # description
            r'(\d+[.,]?\d*)\s*'  # unit price
            r'(\d+[.,]?\d*)'  # amount
        )

        # Pattern 2: STT + description + quantity + unit + price + amount (Vietnamese format)
        item_pattern2 = re.compile(
            r'(\d+)\s+'  # STT
            r'([A-ZÀ-Ỹa-zà-ỹ0-9][A-ZÀ-Ỹa-zà-ỹ0-9\s/\-]+?)\s+'  # description
            r'(\d+[.,]?\d*)\s+'  # quantity
            r'(\w+)\s+'  # unit
            r'(\d+[.,]?\d*)\s+'  # unit price
            r'(\d+[.,]?\d*)'  # amount
        )

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # Try pattern 2 first (more specific)
            match = item_pattern2.search(line)
            if match:
                try:
                    qty = float(match.group(3).replace(',', '.'))
                    price = float(match.group(5).replace(',', '.'))
                    amount = float(match.group(6).replace(',', '.'))
                    items.append({
                        "name": match.group(2).strip(),
                        "quantity": qty,
                        "unit_price": price,
                        "amount": amount,
                    })
                    continue
                except ValueError:
                    pass

            # Try pattern 1
            match = item_pattern1.search(line)
            if match:
                try:
                    qty = float(match.group(1).replace(',', '.'))
                    price = float(match.group(3).replace(',', '.'))
                    amount = float(match.group(4).replace(',', '.'))
                    items.append({
                        "name": match.group(2).strip(),
                        "quantity": qty,
                        "unit_price": price,
                        "amount": amount,
                    })
                except ValueError:
                    continue

        return items

    def _generate_entries(self, extracted: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate accounting entries from extracted invoice data"""
        entries = []
        total = extracted.get("total_amount", 0)

        if total > 0:
            entries.append({
                "account_code": "156",
                "entry_type": "DR",
                "amount": total,
                "description": extracted.get("vendor_name", "Mua hàng")
            })
            entries.append({
                "account_code": "331",
                "entry_type": "CR",
                "amount": total,
                "description": extracted.get("vendor_name", "Phải trả người bán")
            })

        return entries

    def calculate_confidence(self, ocr_result: Dict[str, Any]) -> float:
        """Calculate confidence score based on data completeness and consistency"""
        score = self.default_confidence

        if not ocr_result.get("invoice_number"):
            score -= 15
        if not ocr_result.get("invoice_date"):
            score -= 10
        if not ocr_result.get("vendor_name"):
            score -= 15
        if not ocr_result.get("vendor_tax_code"):
            score -= 5
        items = ocr_result.get("items", [])
        if not items:
            score -= 20

        # Check balance between total and items sum
        total = ocr_result.get("total_amount", 0)
        items_total = sum(item.get("amount", 0) for item in items)
        if total > 0 and items_total > 0:
            ratio = abs(total - items_total) / max(total, items_total)
            if ratio > 0.1:
                score -= 20

        # Validate date
        date_str = ocr_result.get("invoice_date", "")
        if date_str:
            parsed = None
            for fmt in ['%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%m/%d/%Y']:
                try:
                    parsed = datetime.strptime(date_str, fmt)
                    break
                except ValueError:
                    continue
            if parsed is None:
                score -= 5
            elif parsed > datetime.now():
                score -= 5

        return max(0, min(100, score))

    def _fallback_result(self, reason: str = "") -> Dict[str, Any]:
        """Return fallback result when processing fails"""
        return {
            "confidence_score": 0,
            "invoice_number": "",
            "invoice_date": datetime.now().strftime("%Y-%m-%d"),
            "vendor_tax_code": "",
            "vendor_name": "",
            "items": [],
            "entries": [],
            "raw_text_preview": "",
            "error": reason,
            "engine_used": "fallback",
        }