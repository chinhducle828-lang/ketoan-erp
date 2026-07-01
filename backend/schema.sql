-- ====================================================================
-- CẤU TRÚC CƠ SỞ DỮ LIỆU HỆ THỐNG KETOAN ERP - THÔNG TƯ 200/2014/TT-BTC
-- BẢN CHUẨN HÓA: HẠCH TOÁN ĐA DÒNG - RÀNG BUỘC KHO - TỐI ƯU INDEX
-- ====================================================================

CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    tax_code VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'nv', -- admin (Quản trị), ktt (Kế toán trưởng), nv (Nhân viên)
    company_id INT REFERENCES companies(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS accounts (
    code VARCHAR(20) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL -- Tai San, Nguon Von, Doanh Thu, Chi Phi, Trung Gian
);

CREATE TABLE IF NOT EXISTS opening_balances (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    account_code VARCHAR(20) REFERENCES accounts(code) ON DELETE CASCADE,
    debit_balance NUMERIC(15,2) DEFAULT 0,
    credit_balance NUMERIC(15,2) DEFAULT 0,
    fiscal_year INT NOT NULL,
    UNIQUE(company_id, account_code, fiscal_year)
);

-- BẢNG 1 (MASTER): Lưu thông tin chung của chứng từ hạch toán
CREATE TABLE IF NOT EXISTS vouchers (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    voucher_date DATE NOT NULL,
    description TEXT NOT NULL,
    voucher_type VARCHAR(50) NOT NULL, -- Thu, Chi, Nhap, Xuan, Khac
    created_by INT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- BẢNG 2 (DETAIL): Cho phép 1 chứng từ có nhiều dòng Nợ/Có (Xử lý lỗi hạch toán kèm Thuế GTGT)
CREATE TABLE IF NOT EXISTS voucher_details (
    id SERIAL PRIMARY KEY,
    voucher_id INT REFERENCES vouchers(id) ON DELETE CASCADE,
    account_code VARCHAR(20) REFERENCES accounts(code) ON DELETE RESTRICT,
    entry_type VARCHAR(2) NOT NULL CHECK (entry_type IN ('DR', 'CR')), -- DR: Ghi Nợ, CR: Ghi Có
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0)
);

-- ====================================================================
-- HỆ THỐNG INDEXES TỐI ƯU HIỆU NĂNG (Gánh tải khi nghiệp vụ lũy thừa lên hàng triệu dòng)
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_vouchers_date_company 
ON vouchers(company_id, voucher_date);

CREATE INDEX IF NOT EXISTS idx_voucher_details_lookup 
ON voucher_details(voucher_id, account_code, entry_type);

CREATE INDEX IF NOT EXISTS idx_opening_balances_lookup 
ON opening_balances(company_id, fiscal_year, account_code);


-- ====================================================================
-- NẠP DANH MỤC TÀI KHOẢN CHI TIẾT THEO THÔNG TƯ 200
-- ====================================================================

INSERT INTO accounts (code, name, type) VALUES
-- --- LOẠI 1 & LOẠI 2: TÀI SẢN ---
('1111', 'Tiền mặt Việt Nam Đồng (VND)', 'Tai San'),
('1112', 'Tiền mặt Ngoại tệ', 'Tai San'),
('1121', 'Tiền gửi Ngân hàng bằng VND', 'Tai San'),
('1122', 'Tiền gửi Ngân hàng bằng Ngoại tệ', 'Tai San'),
('121', 'Chứng khoán kinh doanh', 'Tai San'),
('128', 'Đầu tư nắm giữ đến ngày đáo hạn', 'Tai San'),
('131', 'Phải thu của khách hàng', 'Tai San'),
('1331', 'Thuế GTGT được khấu trừ của hàng hóa, dịch vụ', 'Tai San'),
('1332', 'Thuế GTGT được khấu trừ của tài sản cố định', 'Tai San'),
('136', 'Phải thu nội bộ', 'Tai San'),
('1381', 'Tài sản thiếu chờ xử lý', 'Tai San'),
('1388', 'Phải thu khác', 'Tai San'),
('141', 'Tạm ứng cho nhân viên', 'Tai San'),
('151', 'Hàng mua đang đi đường', 'Tai San'),
('152', 'Nguyên liệu, vật liệu tồn kho', 'Tai San'),
('153', 'Công cụ, dụng cụ tồn kho', 'Tai San'),
('154', 'Chi phí sản xuất kinh doanh dở dang', 'Tai San'),
('155', 'Thành phẩm tồn kho', 'Tai San'),
('1561', 'Giá mua hàng hóa nhập kho', 'Tai San'),
('1562', 'Chi phí mua hàng hóa', 'Tai San'),
('157', 'Hàng gửi đi bán', 'Tai San'),
('211', 'Tài sản cố định hữu hình', 'Tai San'),
('213', 'Tài sản cố định vô hình', 'Tai San'),
('2141', 'Hao mòn tài sản cố định hữu hình', 'Tai San'),
('2143', 'Hao mòn tài sản cố định vô hình', 'Tai San'),
('217', 'Bất động sản đầu tư', 'Tai San'),
('241', 'Xây dựng cơ bản dở dang', 'Tai San'),
('242', 'Chi phí trả trước (Ngắn/Dài hạn)', 'Tai San'),
('244', 'Cầm cố, ký quỹ, ký cược', 'Tai San'),

-- --- LOẠI 3 & LOẠI 4: NGUỒN VỐN ---
('331', 'Phải trả cho người bán', 'Nguon Von'),
('33311', 'Thuế GTGT hàng bán ra nội địa', 'Nguon Von'),
('33312', 'Thuế GTGT hàng nhập khẩu', 'Nguon Von'),
('3332', 'Thuế tiêu thụ đặc biệt', 'Nguon Von'),
('3333', 'Thuế xuất, nhập khẩu', 'Nguon Von'),
('3334', 'Thuế thu nhập doanh nghiệp (TNDN)', 'Nguon Von'),
('3335', 'Thuế thu nhập cá nhân (TNCN)', 'Nguon Von'),
('3338', 'Các loại thuế khác phải nộp', 'Nguon Von'),
('3341', 'Phải trả công nhân viên (Tiền lương)', 'Nguon Von'),
('335', 'Chi phí phải trả (Trích trước)', 'Nguon Von'),
('336', 'Phải trả nội bộ', 'Nguon Von'),
('3381', 'Tài sản thừa chờ giải quyết', 'Nguon Von'),
('3382', 'Kinh phí công đoàn', 'Nguon Von'),
('3383', 'Bảo hiểm xã hội (BHXH)', 'Nguon Von'),
('3384', 'Bảo hiểm y tế (BHYT)', 'Nguon Von'),
('3386', 'Bảo hiểm thất nghiệp (BHTN)', 'Nguon Von'),
('341', 'Vay và nợ thuê tài chính', 'Nguon Von'),
('352', 'Dự phòng phải trả', 'Nguon Von'),
('353', 'Quỹ khen thưởng, phúc lợi', 'Nguon Von'),
('4111', 'Vốn góp của chủ sở hữu', 'Nguon Von'),
('4112', 'Thặng dư vốn cổ phần', 'Nguon Von'),
('412', 'Chênh lệch đánh giá lại tài sản', 'Nguon Von'),
('414', 'Quỹ đầu tư phát triển', 'Nguon Von'),
('418', 'Các quỹ khác thuộc vốn chủ sở hữu', 'Nguon Von'),
('419', 'Cổ phiếu quỹ', 'Nguon Von'),
('4211', 'Lợi nhuận sau thuế chưa phân phối năm trước', 'Nguon Von'),
('4212', 'Lợi nhuận sau thuế chưa phân phối năm nay', 'Nguon Von'),

-- --- LOẠI 5 & LOẠI 7: DOANH THU & THU NHẬP ---
('5111', 'Doanh thu bán hàng hóa', 'Doanh Thu'),
('5112', 'Doanh thu bán các thành phẩm', 'Doanh Thu'),
('5113', 'Doanh thu cung cấp dịch vụ', 'Doanh Thu'),
('515', 'Doanh thu hoạt động tài chính', 'Doanh Thu'),
('5211', 'Chiết khấu thương mại', 'Doanh Thu'),
('5212', 'Hàng bán bị trả lại', 'Doanh Thu'),
('5213', 'Giảm giá hàng bán', 'Doanh Thu'),
('711', 'Thu nhập khác (Thanh lý tài sản...)', 'Doanh Thu'),

-- --- LOẠI 6 & LOẠI 8: CHI PHÍ ---
('611', 'Mua hàng (Phương pháp kiểm kê định kỳ)', 'Chi Phi'),
('621', 'Chi phí nguyên liệu, vật liệu trực tiếp', 'Chi Phi'),
('622', 'Chi phí nhân công trực tiếp', 'Chi Phi'),
('623', 'Chi phí sử dụng máy thi công', 'Chi Phi'),
('6271', 'Chi phí nhân viên phân xưởng', 'Chi Phi'),
('6272', 'Chi phí vật liệu phân xưởng', 'Chi Phi'),
('6273', 'Chi phí dụng cụ sản xuất', 'Chi Phi'),
('6274', 'Chi phí khấu hao TSCĐ phân xưởng', 'Chi Phi'),
('632', 'Giá vốn hàng bán', 'Chi Phi'),
('635', 'Chi phí tài chính (Lãi vay, lỗ tỷ giá)', 'Chi Phi'),
('6411', 'Chi phí nhân viên bán hàng', 'Chi Phi'),
('6414', 'Chi phí khấu hao TSCĐ bộ phận bán hàng', 'Chi Phi'),
('6421', 'Chi phí nhân viên quản lý doanh nghiệp', 'Chi Phi'),
('6422', 'Chi phí vật liệu quản lý doanh nghiệp', 'Chi Phi'),
('6424', 'Chi phí khấu hao TSCĐ quản lý doanh nghiệp', 'Chi Phi'),
('811', 'Chi phí khác', 'Chi Phi'),
('821', 'Chi phí thuế thu nhập doanh nghiệp', 'Chi Phi'),

-- --- LOẠI 9: TRUNG GIAN XÁC ĐỊNH KẾT QUẢ ---
('911', 'Xác định kết quả kinh doanh', 'Trung Gian')

ON CONFLICT (code) DO NOTHING;

-- ====================================================================
-- KẾT THÚC CẤU TRÚC VÀ DANH MỤC TÀI KHOẢN CHI TIẾT THEO THÔNG TƯ 200
-- ====================================================================