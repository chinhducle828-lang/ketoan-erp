-- ====================================================================
-- MIGRATION 012: BỔ SUNG BẢNG TÀI KHOẢN KẾ TOÁN (CHART OF ACCOUNTS)
-- ====================================================================
-- Tạo bảng accounts và insert danh mục tài khoản đầy đủ
-- theo Thông tư 200/2014/TT-BTC (Chế độ Kế toán Doanh nghiệp)
-- ====================================================================

BEGIN;

-- ====================================================================
-- TẠO BẢNG ACCOUNTS
-- ====================================================================
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    parent_code VARCHAR(20),
    level INTEGER NOT NULL DEFAULT 1,       -- Cấp 1, 2, 3
    type VARCHAR(20) NOT NULL,               -- asset, liability, equity, revenue, expense, other_income, other_expense, closing
    subtype VARCHAR(50),                     -- current_asset, long_term_asset, payable, owner_equity, ...
    is_active BOOLEAN DEFAULT TRUE,
    is_detail BOOLEAN DEFAULT FALSE,         -- TRUE nếu là tài khoản chi tiết (cấp 3+)
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_account_code UNIQUE (code)
);

-- Bổ sung cột name_en nếu bảng đã tồn tại nhưng thiếu cột
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS name_en VARCHAR(255);

COMMENT ON TABLE accounts IS 'Danh mục hệ thống tài khoản kế toán';
COMMENT ON COLUMN accounts.code IS 'Mã số tài khoản (VD: 111, 1111, 112)';
COMMENT ON COLUMN accounts.name IS 'Tên tài khoản tiếng Việt';
COMMENT ON COLUMN accounts.name_en IS 'Tên tài khoản tiếng Anh';
COMMENT ON COLUMN accounts.parent_code IS 'Mã tài khoản cha';
COMMENT ON COLUMN accounts.level IS 'Cấp tài khoản (1, 2, 3)';
COMMENT ON COLUMN accounts.type IS 'Loại tài khoản: asset, liability, equity, revenue, expense, other_income, other_expense, closing';
COMMENT ON COLUMN accounts.subtype IS 'Phân nhóm chi tiết';

CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_code);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);
CREATE INDEX IF NOT EXISTS idx_accounts_active ON accounts(is_active);

-- ====================================================================
-- INSERT DANH MỤC TÀI KHOẢN ĐẦY ĐỦ
-- ====================================================================

-- ============================================================
-- LOẠI 1: TÀI SẢN NGẮN HẠN (100 - 199)
-- ============================================================

INSERT INTO accounts (code, name, parent_code, level, type, subtype) VALUES
('111', 'Tiền mặt', NULL, 1, 'asset', 'current_asset'),
('1111', 'Tiền Việt Nam', '111', 2, 'asset', 'current_asset'),
('1112', 'Ngoại tệ', '111', 2, 'asset', 'current_asset'),
('1113', 'Vàng, bạc, kim khí quý, đá quý', '111', 2, 'asset', 'current_asset'),

('112', 'Tiền gửi ngân hàng', NULL, 1, 'asset', 'current_asset'),
('1121', 'Tiền Việt Nam', '112', 2, 'asset', 'current_asset'),
('1122', 'Ngoại tệ', '112', 2, 'asset', 'current_asset'),
('1123', 'Vàng, bạc, kim khí quý, đá quý', '112', 2, 'asset', 'current_asset'),

('113', 'Tiền đang chuyển', NULL, 1, 'asset', 'current_asset'),
('1131', 'Tiền Việt Nam', '113', 2, 'asset', 'current_asset'),
('1132', 'Ngoại tệ', '113', 2, 'asset', 'current_asset'),

('121', 'Chứng khoán kinh doanh', NULL, 1, 'asset', 'current_asset'),
('1211', 'Cổ phiếu', '121', 2, 'asset', 'current_asset'),
('1212', 'Trái phiếu', '121', 2, 'asset', 'current_asset'),
('1218', 'Chứng khoán kinh doanh khác', '121', 2, 'asset', 'current_asset'),

('128', 'Đầu tư nắm giữ đến ngày đáo hạn', NULL, 1, 'asset', 'current_asset'),
('1281', 'Tiền gửi có kỳ hạn', '128', 2, 'asset', 'current_asset'),
('1282', 'Trái phiếu', '128', 2, 'asset', 'current_asset'),
('1283', 'Cho vay', '128', 2, 'asset', 'current_asset'),
('1288', 'Các khoản đầu tư khác', '128', 2, 'asset', 'current_asset'),

('129', 'Dự phòng giảm giá chứng khoán kinh doanh', NULL, 1, 'asset', 'current_asset'),

('131', 'Phải thu của khách hàng', NULL, 1, 'asset', 'current_asset'),

('133', 'Thuế GTGT được khấu trừ', NULL, 1, 'asset', 'current_asset'),
('1331', 'Thuế GTGT được khấu trừ của hàng hóa, dịch vụ', '133', 2, 'asset', 'current_asset'),
('1332', 'Thuế GTGT được khấu trừ của TSCĐ', '133', 2, 'asset', 'current_asset'),

('136', 'Phải thu nội bộ', NULL, 1, 'asset', 'current_asset'),
('1361', 'Vốn kinh doanh ở đơn vị trực thuộc', '136', 2, 'asset', 'current_asset'),
('1368', 'Phải thu nội bộ khác', '136', 2, 'asset', 'current_asset'),

('137', 'Cho vay nội bộ', NULL, 1, 'asset', 'current_asset'),

('138', 'Phải thu khác', NULL, 1, 'asset', 'current_asset'),
('1381', 'Tài sản thiếu chờ xử lý', '138', 2, 'asset', 'current_asset'),
('1385', 'Phải thu về cổ phần hóa', '138', 2, 'asset', 'current_asset'),
('1386', 'Lãi cho vay phải thu', '138', 2, 'asset', 'current_asset'),
('1387', 'Cổ tức và lợi nhuận phải thu', '138', 2, 'asset', 'current_asset'),
('1388', 'Phải thu khác', '138', 2, 'asset', 'current_asset'),

('139', 'Dự phòng phải thu khó đòi', NULL, 1, 'asset', 'current_asset'),

('141', 'Tạm ứng', NULL, 1, 'asset', 'current_asset'),

('151', 'Hàng mua đang đi đường', NULL, 1, 'asset', 'current_asset'),

('152', 'Nguyên liệu, vật liệu', NULL, 1, 'asset', 'current_asset'),

('153', 'Công cụ, dụng cụ', NULL, 1, 'asset', 'current_asset'),

('154', 'Chi phí sản xuất, kinh doanh dở dang', NULL, 1, 'asset', 'current_asset'),

('155', 'Thành phẩm', NULL, 1, 'asset', 'current_asset'),

('156', 'Hàng hóa', NULL, 1, 'asset', 'current_asset'),
('1561', 'Giá mua hàng hóa', '156', 2, 'asset', 'current_asset'),
('1562', 'Chi phí thu mua hàng hóa', '156', 2, 'asset', 'current_asset'),
('1567', 'Hàng hóa bất động sản', '156', 2, 'asset', 'current_asset'),

('157', 'Hàng gửi đi bán', NULL, 1, 'asset', 'current_asset'),

('158', 'Hàng hóa kho bảo thuế', NULL, 1, 'asset', 'current_asset'),

('159', 'Dự phòng giảm giá hàng tồn kho', NULL, 1, 'asset', 'current_asset');

-- ============================================================
-- LOẠI 2: TÀI SẢN DÀI HẠN (200 - 299)
-- ============================================================

INSERT INTO accounts (code, name, parent_code, level, type, subtype) VALUES
('211', 'Tài sản cố định hữu hình', NULL, 1, 'asset', 'long_term_asset'),
('2111', 'Nhà cửa, vật kiến trúc', '211', 2, 'asset', 'long_term_asset'),
('2112', 'Máy móc, thiết bị', '211', 2, 'asset', 'long_term_asset'),
('2113', 'Phương tiện vận tải, truyền dẫn', '211', 2, 'asset', 'long_term_asset'),
('2114', 'Thiết bị, dụng cụ quản lý', '211', 2, 'asset', 'long_term_asset'),
('2115', 'Cây lâu năm, súc vật làm việc và cho sản phẩm', '211', 2, 'asset', 'long_term_asset'),
('2118', 'TSCĐ hữu hình khác', '211', 2, 'asset', 'long_term_asset'),

('212', 'Tài sản cố định thuê tài chính', NULL, 1, 'asset', 'long_term_asset'),

('213', 'Tài sản cố định vô hình', NULL, 1, 'asset', 'long_term_asset'),
('2131', 'Quyền sử dụng đất', '213', 2, 'asset', 'long_term_asset'),
('2132', 'Quyền phát hành', '213', 2, 'asset', 'long_term_asset'),
('2133', 'Bản quyền, bằng sáng chế', '213', 2, 'asset', 'long_term_asset'),
('2134', 'Nhãn hiệu hàng hóa', '213', 2, 'asset', 'long_term_asset'),
('2135', 'Phần mềm máy tính', '213', 2, 'asset', 'long_term_asset'),
('2136', 'Giấy phép nhượng quyền', '213', 2, 'asset', 'long_term_asset'),
('2138', 'TSCĐ vô hình khác', '213', 2, 'asset', 'long_term_asset'),

('214', 'Hao mòn tài sản cố định', NULL, 1, 'asset', 'long_term_asset'),
('2141', 'Hao mòn TSCĐ hữu hình', '214', 2, 'asset', 'long_term_asset'),
('2142', 'Hao mòn TSCĐ thuê tài chính', '214', 2, 'asset', 'long_term_asset'),
('2143', 'Hao mòn TSCĐ vô hình', '214', 2, 'asset', 'long_term_asset'),
('2147', 'Hao mòn bất động sản đầu tư', '214', 2, 'asset', 'long_term_asset'),

('215', 'Tài sản cố định cho thuê hoạt động', NULL, 1, 'asset', 'long_term_asset'),

('217', 'Bất động sản đầu tư', NULL, 1, 'asset', 'long_term_asset'),

('221', 'Đầu tư vào công ty con', NULL, 1, 'asset', 'long_term_asset'),

('222', 'Đầu tư vào công ty liên kết, liên doanh', NULL, 1, 'asset', 'long_term_asset'),

('228', 'Đầu tư khác', NULL, 1, 'asset', 'long_term_asset'),
('2281', 'Đầu tư góp vốn vào đơn vị khác', '228', 2, 'asset', 'long_term_asset'),
('2282', 'Trái phiếu', '228', 2, 'asset', 'long_term_asset'),
('2288', 'Đầu tư khác', '228', 2, 'asset', 'long_term_asset'),

('229', 'Dự phòng tổn thất tài sản', NULL, 1, 'asset', 'long_term_asset'),
('2291', 'Dự phòng giảm giá chứng khoán kinh doanh', '229', 2, 'asset', 'long_term_asset'),
('2292', 'Dự phòng tổn thất đầu tư', '229', 2, 'asset', 'long_term_asset'),
('2293', 'Dự phòng phải thu khó đòi', '229', 2, 'asset', 'long_term_asset'),
('2294', 'Dự phòng giảm giá hàng tồn kho', '229', 2, 'asset', 'long_term_asset'),
('2295', 'Dự phòng tổn thất tài sản cố định', '229', 2, 'asset', 'long_term_asset'),

('241', 'Xây dựng cơ bản dở dang', NULL, 1, 'asset', 'long_term_asset'),
('2411', 'Mua sắm TSCĐ', '241', 2, 'asset', 'long_term_asset'),
('2412', 'Xây dựng cơ bản', '241', 2, 'asset', 'long_term_asset'),
('2413', 'Sửa chữa lớn TSCĐ', '241', 2, 'asset', 'long_term_asset'),

('242', 'Chi phí trả trước', NULL, 1, 'asset', 'long_term_asset'),

('243', 'Tài sản thuế thu nhập hoãn lại', NULL, 1, 'asset', 'long_term_asset'),

('244', 'Ký quỹ, ký cược dài hạn', NULL, 1, 'asset', 'long_term_asset');

-- ============================================================
-- LOẠI 3: NỢ PHẢI TRẢ (300 - 399)
-- ============================================================

INSERT INTO accounts (code, name, parent_code, level, type, subtype) VALUES
('311', 'Vay ngắn hạn', NULL, 1, 'liability', 'current_liability'),

('312', 'Người mua trả tiền trước', NULL, 1, 'liability', 'current_liability'),

('331', 'Phải trả cho người bán', NULL, 1, 'liability', 'current_liability'),

('333', 'Thuế và các khoản phải nộp Nhà nước', NULL, 1, 'liability', 'current_liability'),
('3331', 'Thuế giá trị gia tăng phải nộp', '333', 2, 'liability', 'current_liability'),
('33311', 'Thuế GTGT đầu ra', '3331', 3, 'liability', 'current_liability'),
('33312', 'Thuế GTGT hàng nhập khẩu', '3331', 3, 'liability', 'current_liability'),
('3332', 'Thuế tiêu thụ đặc biệt', '333', 2, 'liability', 'current_liability'),
('3333', 'Thuế xuất, nhập khẩu', '333', 2, 'liability', 'current_liability'),
('3334', 'Thuế thu nhập doanh nghiệp', '333', 2, 'liability', 'current_liability'),
('3335', 'Thuế thu nhập cá nhân', '333', 2, 'liability', 'current_liability'),
('3336', 'Thuế tài nguyên', '333', 2, 'liability', 'current_liability'),
('3337', 'Thuế nhà đất, tiền thuê đất', '333', 2, 'liability', 'current_liability'),
('3338', 'Thuế bảo vệ môi trường', '333', 2, 'liability', 'current_liability'),
('3339', 'Các loại thuế khác', '333', 2, 'liability', 'current_liability'),

('334', 'Phải trả người lao động', NULL, 1, 'liability', 'current_liability'),
('3341', 'Phải trả công nhân viên', '334', 2, 'liability', 'current_liability'),
('3348', 'Phải trả người lao động khác', '334', 2, 'liability', 'current_liability'),

('335', 'Chi phí phải trả', NULL, 1, 'liability', 'current_liability'),

('336', 'Phải trả nội bộ', NULL, 1, 'liability', 'current_liability'),
('3361', 'Phải trả nội bộ về vốn kinh doanh', '336', 2, 'liability', 'current_liability'),
('3368', 'Phải trả nội bộ khác', '336', 2, 'liability', 'current_liability'),

('337', 'Thanh toán theo tiến độ hợp đồng xây dựng', NULL, 1, 'liability', 'current_liability'),

('338', 'Phải trả, phải nộp khác', NULL, 1, 'liability', 'current_liability'),
('3381', 'Tài sản thừa chờ giải quyết', '338', 2, 'liability', 'current_liability'),
('3382', 'Kinh phí công đoàn', '338', 2, 'liability', 'current_liability'),
('3383', 'Bảo hiểm xã hội', '338', 2, 'liability', 'current_liability'),
('3384', 'Bảo hiểm y tế', '338', 2, 'liability', 'current_liability'),
('3385', 'Bảo hiểm thất nghiệp', '338', 2, 'liability', 'current_liability'),
('3386', 'Bảo hiểm tai nạn lao động, nghề nghiệp', '338', 2, 'liability', 'current_liability'),
('3387', 'Doanh thu chưa thực hiện', '338', 2, 'liability', 'current_liability'),
('3388', 'Phải trả, phải nộp khác', '338', 2, 'liability', 'current_liability'),

('341', 'Vay và nợ thuê tài chính', NULL, 1, 'liability', 'long_term_liability'),
('3411', 'Các khoản đi vay', '341', 2, 'liability', 'long_term_liability'),
('3412', 'Nợ thuê tài chính', '341', 2, 'liability', 'long_term_liability'),

('342', 'Trái phiếu phát hành', NULL, 1, 'liability', 'long_term_liability'),
('3421', 'Trái phiếu thường', '342', 2, 'liability', 'long_term_liability'),
('3422', 'Trái phiếu chuyển đổi', '342', 2, 'liability', 'long_term_liability'),

('343', 'Nhận ký quỹ, ký cược dài hạn', NULL, 1, 'liability', 'long_term_liability'),

('347', 'Thuế thu nhập hoãn lại phải trả', NULL, 1, 'liability', 'long_term_liability');

-- ============================================================
-- LOẠI 4: VỐN CHỦ SỞ HỮU (400 - 499)
-- ============================================================

INSERT INTO accounts (code, name, parent_code, level, type, subtype) VALUES
('411', 'Vốn đầu tư của chủ sở hữu', NULL, 1, 'equity', 'owner_equity'),
('4111', 'Vốn góp của chủ sở hữu', '411', 2, 'equity', 'owner_equity'),
('4112', 'Thặng dư vốn cổ phần', '411', 2, 'equity', 'owner_equity'),
('4118', 'Vốn khác', '411', 2, 'equity', 'owner_equity'),

('412', 'Chênh lệch đánh giá lại tài sản', NULL, 1, 'equity', 'owner_equity'),

('413', 'Chênh lệch tỷ giá hối đoái', NULL, 1, 'equity', 'owner_equity'),

('414', 'Quỹ đầu tư phát triển', NULL, 1, 'equity', 'owner_equity'),

('415', 'Quỹ dự phòng tài chính', NULL, 1, 'equity', 'owner_equity'),

('416', 'Quỹ khen thưởng, phúc lợi', NULL, 1, 'equity', 'owner_equity'),

('417', 'Quỹ ổn định thu nhập', NULL, 1, 'equity', 'owner_equity'),

('418', 'Các quỹ khác thuộc vốn chủ sở hữu', NULL, 1, 'equity', 'owner_equity'),

('419', 'Cổ phiếu quỹ', NULL, 1, 'equity', 'owner_equity'),

('421', 'Lợi nhuận sau thuế chưa phân phối', NULL, 1, 'equity', 'owner_equity'),
('4211', 'Lợi nhuận sau thuế chưa phân phối năm trước', '421', 2, 'equity', 'owner_equity'),
('4212', 'Lợi nhuận sau thuế chưa phân phối năm nay', '421', 2, 'equity', 'owner_equity'),

('441', 'Nguồn vốn đầu tư xây dựng cơ bản', NULL, 1, 'equity', 'owner_equity'),

('461', 'Nguồn kinh phí sự nghiệp', NULL, 1, 'equity', 'owner_equity');

-- ============================================================
-- LOẠI 5: DOANH THU (500 - 599)
-- ============================================================

INSERT INTO accounts (code, name, parent_code, level, type, subtype) VALUES
('511', 'Doanh thu bán hàng và cung cấp dịch vụ', NULL, 1, 'revenue', 'revenue'),
('5111', 'Doanh thu bán hàng hóa', '511', 2, 'revenue', 'revenue'),
('5112', 'Doanh thu bán thành phẩm', '511', 2, 'revenue', 'revenue'),
('5113', 'Doanh thu cung cấp dịch vụ', '511', 2, 'revenue', 'revenue'),
('5114', 'Doanh thu trợ cấp, trợ giá', '511', 2, 'revenue', 'revenue'),
('5117', 'Doanh thu kinh doanh bất động sản đầu tư', '511', 2, 'revenue', 'revenue'),
('5118', 'Doanh thu khác', '511', 2, 'revenue', 'revenue'),

('515', 'Doanh thu hoạt động tài chính', NULL, 1, 'revenue', 'revenue'),

('521', 'Các khoản giảm trừ doanh thu', NULL, 1, 'revenue', 'revenue'),
('5211', 'Chiết khấu thương mại', '521', 2, 'revenue', 'revenue'),
('5212', 'Hàng bán bị trả lại', '521', 2, 'revenue', 'revenue'),
('5213', 'Giảm giá hàng bán', '521', 2, 'revenue', 'revenue');

-- ============================================================
-- LOẠI 6: CHI PHÍ SẢN XUẤT, KINH DOANH (600 - 699)
-- ============================================================

INSERT INTO accounts (code, name, parent_code, level, type, subtype) VALUES
('611', 'Mua hàng', NULL, 1, 'expense', 'production_cost'),
('6111', 'Mua nguyên liệu, vật liệu', '611', 2, 'expense', 'production_cost'),
('6112', 'Mua hàng hóa', '611', 2, 'expense', 'production_cost'),

('621', 'Chi phí nguyên liệu, vật liệu trực tiếp', NULL, 1, 'expense', 'production_cost'),

('622', 'Chi phí nhân công trực tiếp', NULL, 1, 'expense', 'production_cost'),

('623', 'Chi phí sử dụng máy thi công', NULL, 1, 'expense', 'production_cost'),
('6231', 'Chi phí nhân công', '623', 2, 'expense', 'production_cost'),
('6232', 'Chi phí vật liệu', '623', 2, 'expense', 'production_cost'),
('6233', 'Chi phí dụng cụ sản xuất', '623', 2, 'expense', 'production_cost'),
('6234', 'Chi phí khấu hao máy thi công', '623', 2, 'expense', 'production_cost'),
('6237', 'Chi phí dịch vụ mua ngoài', '623', 2, 'expense', 'production_cost'),
('6238', 'Chi phí bằng tiền khác', '623', 2, 'expense', 'production_cost'),

('627', 'Chi phí sản xuất chung', NULL, 1, 'expense', 'production_cost'),
('6271', 'Chi phí nhân viên phân xưởng', '627', 2, 'expense', 'production_cost'),
('6272', 'Chi phí vật liệu', '627', 2, 'expense', 'production_cost'),
('6273', 'Chi phí dụng cụ sản xuất', '627', 2, 'expense', 'production_cost'),
('6274', 'Chi phí khấu hao TSCĐ', '627', 2, 'expense', 'production_cost'),
('6277', 'Chi phí dịch vụ mua ngoài', '627', 2, 'expense', 'production_cost'),
('6278', 'Chi phí bằng tiền khác', '627', 2, 'expense', 'production_cost'),

('631', 'Giá thành sản xuất', NULL, 1, 'expense', 'production_cost'),

('632', 'Giá vốn hàng bán', NULL, 1, 'expense', 'operating_expense'),

('635', 'Chi phí tài chính', NULL, 1, 'expense', 'operating_expense'),

('641', 'Chi phí bán hàng', NULL, 1, 'expense', 'operating_expense'),
('6411', 'Chi phí nhân viên', '641', 2, 'expense', 'operating_expense'),
('6412', 'Chi phí vật liệu, bao bì', '641', 2, 'expense', 'operating_expense'),
('6413', 'Chi phí dụng cụ, đồ dùng', '641', 2, 'expense', 'operating_expense'),
('6414', 'Chi phí khấu hao TSCĐ', '641', 2, 'expense', 'operating_expense'),
('6415', 'Chi phí bảo hành', '641', 2, 'expense', 'operating_expense'),
('6417', 'Chi phí dịch vụ mua ngoài', '641', 2, 'expense', 'operating_expense'),
('6418', 'Chi phí bằng tiền khác', '641', 2, 'expense', 'operating_expense'),

('642', 'Chi phí quản lý doanh nghiệp', NULL, 1, 'expense', 'operating_expense'),
('6421', 'Chi phí nhân viên quản lý', '642', 2, 'expense', 'operating_expense'),
('6422', 'Chi phí vật liệu quản lý', '642', 2, 'expense', 'operating_expense'),
('6423', 'Chi phí đồ dùng văn phòng', '642', 2, 'expense', 'operating_expense'),
('6424', 'Chi phí khấu hao TSCĐ', '642', 2, 'expense', 'operating_expense'),
('6425', 'Thuế, phí và lệ phí', '642', 2, 'expense', 'operating_expense'),
('6426', 'Chi phí dự phòng', '642', 2, 'expense', 'operating_expense'),
('6427', 'Chi phí dịch vụ mua ngoài', '642', 2, 'expense', 'operating_expense'),
('6428', 'Chi phí bằng tiền khác', '642', 2, 'expense', 'operating_expense');

-- ============================================================
-- LOẠI 7: THU NHẬP KHÁC (700 - 799)
-- ============================================================

INSERT INTO accounts (code, name, parent_code, level, type, subtype) VALUES
('711', 'Thu nhập khác', NULL, 1, 'other_income', 'other_income');

-- ============================================================
-- LOẠI 8: CHI PHÍ KHÁC (800 - 899)
-- ============================================================

INSERT INTO accounts (code, name, parent_code, level, type, subtype) VALUES
('811', 'Chi phí khác', NULL, 1, 'other_expense', 'other_expense'),

('821', 'Chi phí thuế thu nhập doanh nghiệp', NULL, 1, 'expense', 'operating_expense'),
('8211', 'Chi phí thuế TNDN hiện hành', '821', 2, 'expense', 'operating_expense'),
('8212', 'Chi phí thuế TNDN hoãn lại', '821', 2, 'expense', 'operating_expense');

-- ============================================================
-- LOẠI 9: XÁC ĐỊNH KẾT QUẢ KINH DOANH (900 - 999)
-- ============================================================

INSERT INTO accounts (code, name, parent_code, level, type, subtype) VALUES
('911', 'Xác định kết quả kinh doanh', NULL, 1, 'closing', 'closing');

-- ============================================================
-- TÀI KHOẢN NGOÀI BẢNG (0xxx)
-- ============================================================

INSERT INTO accounts (code, name, parent_code, level, type, subtype) VALUES
('001', 'Tài sản thuê ngoài', NULL, 1, 'asset', 'off_balance'),
('002', 'Vật tư, hàng hóa nhận giữ hộ, nhận gia công', NULL, 1, 'asset', 'off_balance'),
('003', 'Hàng hóa nhận bán hộ, nhận ký gửi', NULL, 1, 'asset', 'off_balance'),
('004', 'Nợ khó đòi đã xử lý', NULL, 1, 'asset', 'off_balance'),
('005', 'Ngoại tệ các loại', NULL, 1, 'asset', 'off_balance');

-- ============================================================
-- CẬP NHẬT is_detail CHO TÀI KHOẢN CẤP 3 TRỞ LÊN
-- ============================================================
UPDATE accounts SET is_detail = TRUE WHERE level >= 3;

-- ============================================================
-- BỔ SUNG FK TỪ VOUCHER_DETAILS -> ACCOUNTS (NẾU CHƯA CÓ)
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'voucher_details_account_code_fk'
    ) THEN
        ALTER TABLE voucher_details
        ADD CONSTRAINT voucher_details_account_code_fk
        FOREIGN KEY (account_code) REFERENCES accounts(code) ON DELETE RESTRICT;
    END IF;
END $$;

-- ============================================================
-- BỔ SUNG FK TỪ OPENING_BALANCES -> ACCOUNTS (NẾU CHƯA CÓ)
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'opening_balances_account_code_fk'
    ) THEN
        ALTER TABLE opening_balances
        ADD CONSTRAINT opening_balances_account_code_fk
        FOREIGN KEY (account_code) REFERENCES accounts(code) ON DELETE RESTRICT;
    END IF;
END $$;

-- ============================================================
-- BỔ SUNG FK TỪ MONTHLY_BALANCES -> ACCOUNTS (NẾU CHƯA CÓ)
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'monthly_balances_account_code_fk'
    ) THEN
        ALTER TABLE monthly_balances
        ADD CONSTRAINT monthly_balances_account_code_fk
        FOREIGN KEY (account_code) REFERENCES accounts(code) ON DELETE RESTRICT;
    END IF;
END $$;

COMMIT;