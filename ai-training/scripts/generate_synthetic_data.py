"""
Generate synthetic training data for all models
"""

import json
import random
from pathlib import Path
from faker import Faker
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import logging

logger = logging.getLogger(__name__)
fake = Faker('vi_VN')  # Vietnamese locale


# ==================== OCR SYNTHETIC DATA ====================

def generate_synthetic_invoice(output_dir: Path, num_samples: int = 500) -> None:
    """
    Generate synthetic Vietnamese invoices for OCR training
    
    Args:
        output_dir: Directory to save generated invoices
        num_samples: Number of invoices to generate
    """
    logger.info(f"Generating {num_samples} synthetic invoices...")
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Vietnamese company names
    company_names = [
        "CÔNG TY TNHH ABC",
        "CÔNG TY CỔ PHẦN XYZ",
        "DOANH NGHIỆP TƯ NHÂN 123",
        "CÔNG TY TRÁCH NHIỆM HỮU HẠN DEF",
        "HỘ KINH DOANH GHI",
    ]
    
    # Vietnamese products/services
    products = [
        "Dịch vụ tư vấn",
        "Hàng hóa nhập khẩu",
        "Phần mềm kế toán",
        "Thiết bị văn phòng",
        "Vật tư tiêu hao",
        "Dịch vụ vận chuyển",
        "Bảo trì hệ thống",
        "Tư vấn thuế",
    ]
    
    for i in range(num_samples):
        # Create invoice image
        width, height = 800, 1000
        image = Image.new('RGB', (width, height), color='white')
        draw = ImageDraw.Draw(image)
        
        # Try to load Vietnamese font, fallback to default
        try:
            font_large = ImageFont.truetype("arial.ttf", 24)
            font_medium = ImageFont.truetype("arial.ttf", 18)
            font_small = ImageFont.truetype("arial.ttf", 14)
        except:
            font_large = ImageFont.load_default()
            font_medium = ImageFont.load_default()
            font_small = ImageFont.load_default()
        
        # Generate invoice content
        company = random.choice(company_names)
        invoice_no = f"HD{random.randint(100000, 999999)}"
        date = fake.date_between(start_date='-1y', end_date='today').strftime("%d/%m/%Y")
        product = random.choice(products)
        amount = random.randint(100000, 50000000)
        tax = int(amount * 0.1)
        total = amount + tax
        
        # Draw text
        y_offset = 50
        draw.text((50, y_offset), "HÓA ĐƠN GTGT", fill="black", font=font_large)
        y_offset += 60
        draw.text((50, y_offset), company, fill="black", font=font_medium)
        y_offset += 40
        draw.text((50, y_offset), f"Mã số: {invoice_no}", fill="black", font=font_small)
        y_offset += 30
        draw.text((50, y_offset), f"Ngày: {date}", fill="black", font=font_small)
        y_offset += 50
        draw.text((50, y_offset), f"Nội dung: {product}", fill="black", font=font_medium)
        y_offset += 40
        draw.text((50, y_offset), f"Tiền hàng: {amount:,.0f}đ", fill="black", font=font_small)
        y_offset += 30
        draw.text((50, y_offset), f"Thuế GTGT (10%): {tax:,.0f}đ", fill="black", font=font_small)
        y_offset += 30
        draw.text((50, y_offset), f"Tổng cộng: {total:,.0f}đ", fill="black", font=font_medium)
        
        # Add noise and distortions
        image_np = np.array(image)
        
        # Random rotation
        angle = random.uniform(-5, 5)
        M = cv2.getRotationMatrix2D((width/2, height/2), angle, 1)
        image_np = cv2.warpAffine(image_np, M, (width, height), borderValue=(255, 255, 255))
        
        # Add noise
        noise = np.random.normal(0, 10, image_np.shape).astype(np.uint8)
        image_np = cv2.add(image_np, noise)
        
        # Save image
        image = Image.fromarray(image_np)
        image_path = output_dir / f"invoice_{i:04d}.jpg"
        image.save(image_path, quality=90)
        
        # Save annotation (ground truth)
        annotation = {
            "image_path": str(image_path),
            "company": company,
            "invoice_no": invoice_no,
            "date": date,
            "product": product,
            "amount": amount,
            "tax": tax,
            "total": total
        }
        
        annotation_path = output_dir / f"invoice_{i:04d}.json"
        with open(annotation_path, 'w', encoding='utf-8') as f:
            json.dump(annotation, f, ensure_ascii=False, indent=2)
    
    logger.info(f"Generated {num_samples} invoices in {output_dir}")


# ==================== NLP SYNTHETIC DATA ====================

def generate_synthetic_query_sql_pairs(output_dir: Path, num_samples: int = 2000) -> None:
    """
    Generate synthetic Vietnamese query-SQL pairs for NLP training
    
    Args:
        output_dir: Directory to save generated pairs
        num_samples: Number of pairs to generate
    """
    logger.info(f"Generating {num_samples} query-SQL pairs...")
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Query templates
    templates = [
        # Simple SELECT
        {
            "template": "Tìm tất cả hóa đơn của tháng {month} năm {year}",
            "sql": "SELECT * FROM invoices WHERE MONTH(created_at) = {month} AND YEAR(created_at) = {year}",
            "tables": ["invoices"]
        },
        {
            "template": "Liệt kê các phiếu thu trong ngày {date}",
            "sql": "SELECT * FROM receipts WHERE DATE(created_at) = '{date}'",
            "tables": ["receipts"]
        },
        # Aggregation
        {
            "template": "Tổng doanh thu quý {quarter} năm {year}",
            "sql": "SELECT SUM(amount) FROM invoices WHERE QUARTER(created_at) = {quarter} AND YEAR(created_at) = {year}",
            "tables": ["invoices"]
        },
        {
            "template": "Tổng chi phí tháng {month}",
            "sql": "SELECT SUM(amount) FROM expenses WHERE MONTH(created_at) = {month}",
            "tables": ["expenses"]
        },
        # GROUP BY
        {
            "template": "Doanh thu theo từng tháng trong năm {year}",
            "sql": "SELECT MONTH(created_at) as month, SUM(amount) as total FROM invoices WHERE YEAR(created_at) = {year} GROUP BY MONTH(created_at)",
            "tables": ["invoices"]
        },
        {
            "template": "Số lượng hóa đơn theo từng khách hàng",
            "sql": "SELECT customer_id, COUNT(*) as count FROM invoices GROUP BY customer_id",
            "tables": ["invoices", "customers"]
        },
        # JOIN
        {
            "template": "Danh sách hóa đơn kèm tên khách hàng",
            "sql": "SELECT i.*, c.name as customer_name FROM invoices i JOIN customers c ON i.customer_id = c.id",
            "tables": ["invoices", "customers"]
        },
        {
            "template": "Chi tiết phiếu chi kèm tên nhà cung cấp",
            "sql": "SELECT e.*, s.name as supplier_name FROM expenses e JOIN suppliers s ON e.supplier_id = s.id",
            "tables": ["expenses", "suppliers"]
        },
        # WHERE with conditions
        {
            "template": "Hóa đơn có giá trị lớn hơn {amount}",
            "sql": "SELECT * FROM invoices WHERE amount > {amount}",
            "tables": ["invoices"]
        },
        {
            "template": "Phiếu thu từ khách hàng {customer_name}",
            "sql": "SELECT * FROM receipts WHERE customer_name = '{customer_name}'",
            "tables": ["receipts"]
        },
        # Complex queries
        {
            "template": "Top 10 khách hàng có doanh thu cao nhất năm {year}",
            "sql": "SELECT c.name, SUM(i.amount) as total FROM customers c JOIN invoices i ON c.id = i.customer_id WHERE YEAR(i.created_at) = {year} GROUP BY c.id ORDER BY total DESC LIMIT 10",
            "tables": ["customers", "invoices"]
        },
        {
            "template": "Tỷ lệ thu chi tháng {month} năm {year}",
            "sql": "SELECT (SELECT SUM(amount) FROM invoices WHERE MONTH(created_at) = {month} AND YEAR(created_at) = {year}) / (SELECT SUM(amount) FROM expenses WHERE MONTH(created_at) = {month} AND YEAR(created_at) = {year}) as ratio",
            "tables": ["invoices", "expenses"]
        },
    ]
    
    pairs = []
    
    for i in range(num_samples):
        template = random.choice(templates)
        
        # Fill template variables
        query = template["template"]
        sql = template["sql"]
        
        # Replace variables
        month = random.randint(1, 12)
        year = random.randint(2020, 2024)
        quarter = random.randint(1, 4)
        amount = random.randint(1000000, 100000000)
        date = f"{year}-{month:02d}-{random.randint(1, 28):02d}"
        customer_name = fake.name()
        
        query = query.replace("{month}", str(month))
        query = query.replace("{year}", str(year))
        query = query.replace("{quarter}", str(quarter))
        query = query.replace("{amount}", f"{amount:,}")
        query = query.replace("{date}", date)
        query = query.replace("{customer_name}", customer_name)
        
        sql = sql.replace("{month}", str(month))
        sql = sql.replace("{year}", str(year))
        sql = sql.replace("{quarter}", str(quarter))
        sql = sql.replace("{amount}", str(amount))
        sql = sql.replace("{date}", date)
        sql = sql.replace("{customer_name}", customer_name)
        
        pairs.append({
            "id": i + 1,
            "query": query,
            "sql": sql,
            "tables": template["tables"],
            "complexity": "simple" if len(template["tables"]) == 1 else "complex"
        })
    
    # Save to JSON
    output_file = output_dir / "query_sql_pairs.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(pairs, f, ensure_ascii=False, indent=2)
    
    logger.info(f"Generated {num_samples} query-SQL pairs: {output_file}")


# ==================== SELF-FIX SYNTHETIC DATA ====================

def generate_synthetic_self_fix_data(output_dir: Path, num_samples: int = 5000) -> None:
    """
    Generate synthetic voucher error-correction pairs for self-fix training
    
    Args:
        output_dir: Directory to save generated data
        num_samples: Number of samples to generate
    """
    logger.info(f"Generating {num_samples} self-fix samples...")
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Account codes (Vietnamese accounting)
    account_codes = [
        "111", "112", "131", "151", "152", "153", "211", "331", "333",
        "511", "632", "642", "821", "911"
    ]
    
    # Account names
    account_names = {
        "111": "Tiền mặt",
        "112": "Tiền gửi ngân hàng",
        "131": "Phải thu khách hàng",
        "151": "Hàng hóa",
        "152": "Nguyên liệu",
        "153": "Công cụ dụng cụ",
        "211": "Phải trả người bán",
        "331": "Phải trả người bán",
        "333": "Thuế GTGT phải nộp",
        "511": "Doanh thu bán hàng",
        "632": "Giá vốn hàng bán",
        "642": "Chi phí quản lý",
        "821": "Chi phí tài chính",
        "911": "Xác định kết quả kinh doanh"
    }
    
    samples = []
    
    for i in range(num_samples):
        # Generate correct voucher
        voucher_type = random.choice(["receipt", "payment", "journal"])
        
        if voucher_type == "receipt":
            debit_account = random.choice(["111", "112", "131"])
            credit_account = random.choice(["511", "331", "333"])
            description = random.choice([
                "Thu tiền khách hàng",
                "Thu hóa đơn bán hàng",
                "Thu nợ khách hàng"
            ])
        elif voucher_type == "payment":
            debit_account = random.choice(["632", "642", "821", "152"])
            credit_account = random.choice(["111", "112", "211"])
            description = random.choice([
                "Chi tiền nhà cung cấp",
                "Mua nguyên liệu",
                "Trả lương nhân viên"
            ])
        else:  # journal
            debit_account = random.choice(account_codes)
            credit_account = random.choice([c for c in account_codes if c != debit_account])
            description = random.choice([
                "Điều chỉnh kế toán",
                "Kết chuyển cuối kỳ",
                "Phân bổ chi phí"
            ])
        
        amount = random.randint(100000, 100000000)
        
        correct_voucher = {
            "voucher_type": voucher_type,
            "debit_account": debit_account,
            "credit_account": credit_account,
            "amount": amount,
            "description": description,
            "date": fake.date_between(start_date='-1y', end_date='today').strftime("%Y-%m-%d")
        }
        
        # Introduce error (80% have errors, 20% are correct)
        has_error = random.random() < 0.8
        
        if has_error:
            error_type = random.choice([
                "wrong_debit_account",
                "wrong_credit_account",
                "missing_debit",
                "missing_credit",
                "wrong_amount",
                "missing_description"
            ])
            
            error_voucher = correct_voucher.copy()
            
            if error_type == "wrong_debit_account":
                # Swap with another account
                error_voucher["debit_account"] = random.choice([c for c in account_codes if c != debit_account])
            elif error_type == "wrong_credit_account":
                error_voucher["credit_account"] = random.choice([c for c in account_codes if c != credit_account])
            elif error_type == "missing_debit":
                error_voucher["debit_account"] = "000"
            elif error_type == "missing_credit":
                error_voucher["credit_account"] = "000"
            elif error_type == "wrong_amount":
                error_voucher["amount"] = int(amount * random.uniform(0.5, 2.0))
            elif error_type == "missing_description":
                error_voucher["description"] = ""
            
            samples.append({
                "id": i + 1,
                "error_voucher": error_voucher,
                "correct_voucher": correct_voucher,
                "error_type": error_type,
                "needs_fix": True
            })
        else:
            samples.append({
                "id": i + 1,
                "error_voucher": correct_voucher,
                "correct_voucher": correct_voucher,
                "error_type": "none",
                "needs_fix": False
            })
    
    # Save to JSON
    output_file = output_dir / "self_fix_data.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(samples, f, ensure_ascii=False, indent=2)
    
    logger.info(f"Generated {num_samples} self-fix samples: {output_file}")


# ==================== RAG SYNTHETIC DATA ====================

def generate_synthetic_rag_data(output_dir: Path, num_qa_pairs: int = 500) -> None:
    """
    Generate synthetic Q&A pairs for RAG training
    
    Args:
        output_dir: Directory to save generated data
        num_qa_pairs: Number of Q&A pairs to generate
    """
    logger.info(f"Generating {num_qa_pairs} RAG Q&A pairs...")
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Q&A templates
    qa_templates = [
        {
            "question": "Làm sao để tạo hóa đơn GTGT?",
            "answer": "Để tạo hóa đơn GTGT, bạn cần: 1) Vào menu 'Bán hàng' → 'Hóa đơn'; 2) Nhấn 'Tạo mới'; 3) Điền thông tin khách hàng, sản phẩm, số lượng, đơn giá; 4) Hệ thống tự tính thuế GTGT 10%; 5) Lưu hóa đơn.",
            "category": "invoice"
        },
        {
            "question": "Cách nhập phiếu thu?",
            "answer": "Nhập phiếu thu: 1) Menu 'Thu tiền' → 'Phiếu thu'; 2) Chọn khách hàng; 3) Nhập số tiền và nội dung; 4) Chọn tài khoản nợ (111/112); 5) Chọn tài khoản có (511/131); 6) Lưu phiếu.",
            "category": "receipt"
        },
        {
            "question": "Kế toán 511 là gì?",
            "answer": "TK 511 - Doanh thu bán hàng và cung cấp dịch vụ. Tài khoản này phản ánh doanh thu từ hoạt động bán hàng, cung cấp dịch vụ. Có phát sinh bên Nợ (trả lại hàng, giảm giá) và bên Có (ghi nhận doanh thu).",
            "category": "accounting"
        },
        {
            "question": "Làm thế nào để đối chiếu công nợ?",
            "answer": "Đối chiếu công nợ: 1) Menu 'Báo cáo' → 'Đối chiếu công nợ'; 2) Chọn đối tác (khách hàng/nhà cung cấp); 3) Chọn khoảng thời gian; 4) Hệ thống liệt kê các phát sinh; 5) Đối chiếu với sổ sái đối tác; 6) Xác nhận công nợ.",
            "category": "report"
        },
        {
            "question": "Thuế GTGT đầu ra là gì?",
            "answer": "Thuế GTGT đầu ra là thuế doanh nghiệp phải nộp khi bán hàng/cung cấp dịch vụ. Công thức: Thuế GTGT đầu ra = Doanh thu × 10%. Tài khoản phản ánh: TK 3331 (Thuế GTGT đầu ra).",
            "category": "tax"
        },
        {
            "question": "Cách kết chuyển cuối kỳ?",
            "answer": "Kết chuyển cuối kỳ: 1) Menu 'Kết chuyển' → 'Tạo bút toán kết chuyển'; 2) Chọn loại kết chuyển (doanh thu, chi phí, thuế); 3) Hệ thống tự động tạo bút toán; 4) Kiểm tra và điều chỉnh; 5) Xác nhận kết chuyển.",
            "category": "accounting"
        },
        {
            "question": "Làm sao để xuất báo cáo tài chính?",
            "answer": "Xuất báo cáo tài chính: 1) Menu 'Báo cáo' → 'Báo cáo tài chính'; 2) Chọn loại báo cáo (CĐKT, KQKD, LCTT); 3) Chọn kỳ báo cáo; 4) Xem trước; 5) Xuất Excel/PDF.",
            "category": "report"
        },
        {
            "question": "Phương pháp kê khai thuế GTGT là gì?",
            "answer": "Có 2 phương pháp: 1) Kê khai khấu trừ: Doanh nghiệp kê khai thuế đầu vào và đầu ra, tính thuế phải nộp = Thuế đầu ra - Thuế đầu vào; 2) Kê khai trực tiếp: Doanh nghiệp kê khai theo doanh thu thực tế.",
            "category": "tax"
        },
    ]
    
    qa_pairs = []
    
    for i in range(num_qa_pairs):
        template = random.choice(qa_templates)
        
        # Add variations
        question = template["question"]
        answer = template["answer"]
        
        # Sometimes add variations
        if random.random() < 0.3:
            # Add context
            question = f"Cho tôi biết: {question}"
        
        qa_pairs.append({
            "id": i + 1,
            "question": question,
            "answer": answer,
            "category": template["category"],
            "source": "synthetic",
            "confidence": 1.0
        })
    
    # Save to JSON
    output_file = output_dir / "rag_qa_pairs.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(qa_pairs, f, ensure_ascii=False, indent=2)
    
    logger.info(f"Generated {num_qa_pairs} Q&A pairs: {output_file}")


# ==================== MAIN ====================

def main():
    """Main function to generate all synthetic data"""
    logging.basicConfig(level=logging.INFO)
    logger.info("Starting synthetic data generation...")
    
    # Generate OCR data
    generate_synthetic_invoice(
        output_dir=Path("data/synthetic/ocr"),
        num_samples=500
    )
    
    # Generate NLP data
    generate_synthetic_query_sql_pairs(
        output_dir=Path("data/synthetic/nlp"),
        num_samples=2000
    )
    
    # Generate Self-Fix data
    generate_synthetic_self_fix_data(
        output_dir=Path("data/synthetic/self_fix"),
        num_samples=5000
    )
    
    # Generate RAG data
    generate_synthetic_rag_data(
        output_dir=Path("data/synthetic/rag"),
        num_qa_pairs=500
    )
    
    logger.info("\n" + "="*60)
    logger.info("Synthetic data generation complete!")
    logger.info("="*60)
    logger.info("\nGenerated data:")
    logger.info("  - OCR: 500 synthetic invoices")
    logger.info("  - NLP: 2000 query-SQL pairs")
    logger.info("  - Self-Fix: 5000 error-correction pairs")
    logger.info("  - RAG: 500 Q&A pairs")
    logger.info("="*60)


if __name__ == "__main__":
    main()