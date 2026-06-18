export const ROLES = {
  ADMIN: 'admin',
  KTT: 'ktt',
  NV: 'nv'
};

export const CHART_OF_ACCOUNTS = [
  // ==========================================
  // LOẠI 1 & LOẠI 2: TÀI SẢN (DEBIT BALANCE)
  // ==========================================
  { code: '1111', name: 'Tiền mặt Việt Nam Đồng (VND)', type: 'Tai San' },
  { code: '1112', name: 'Tiền mặt Ngoại tệ', type: 'Tai San' },
  { code: '1121', name: 'Tiền gửi Ngân hàng bằng VND', type: 'Tai San' },
  { code: '1122', name: 'Tiền gửi Ngân hàng bằng Ngoại tệ', type: 'Tai San' },
  { code: '121', name: 'Chứng khoán kinh doanh', type: 'Tai San' },
  { code: '128', name: 'Đầu tư nắm giữ đến ngày đáo hạn', type: 'Tai San' },
  { code: '131', name: 'Phải thu của khách hàng', type: 'Tai San' },
  { code: '1331', name: 'Thuế GTGT được khấu trừ của hàng hóa, dịch vụ', type: 'Tai San' },
  { code: '1332', name: 'Thuế GTGT được khấu trừ của tài sản cố định', type: 'Tai San' },
  { code: '136', name: 'Phải thu nội bộ', type: 'Tai San' },
  { code: '1381', name: 'Tài sản thiếu chờ xử lý', type: 'Tai San' },
  { code: '1388', name: 'Phải thu khác', type: 'Tai San' },
  { code: '141', name: 'Tạm ứng cho nhân viên', type: 'Tai San' },
  { code: '151', name: 'Hàng mua đang đi đường', type: 'Tai San' },
  { code: '152', name: 'Nguyên liệu, vật liệu tồn kho', type: 'Tai San' },
  { code: '153', name: 'Công cụ, dụng cụ tồn kho', type: 'Tai San' },
  { code: '154', name: 'Chi phí sản xuất kinh doanh dở dang', type: 'Tai San' },
  { code: '155', name: 'Thành phẩm tồn kho', type: 'Tai San' },
  { code: '1561', name: 'Giá mua hàng hóa nhập kho', type: 'Tai San' },
  { code: '1562', name: 'Chi phí mua hàng hóa', type: 'Tai San' },
  { code: '157', name: 'Hàng gửi đi bán', type: 'Tai San' },
  { code: '211', name: 'Tài sản cố định hữu hình', type: 'Tai San' },
  { code: '213', name: 'Tài sản cố định vô hình', type: 'Tai San' },
  { code: '2141', name: 'Hao mòn tài sản cố định hữu hình', type: 'Tai San' },
  { code: '2143', name: 'Hao mòn tài sản cố định vô hình', type: 'Tai San' },
  { code: '217', name: 'Bất động sản đầu tư', type: 'Tai San' },
  { code: '241', name: 'Xây dựng cơ bản dở dang', type: 'Tai San' },
  { code: '242', name: 'Chi phí trả trước (Ngắn/Dài hạn)', type: 'Tai San' },
  { code: '244', name: 'Cầm cố, ký quỹ, ký cược', type: 'Tai San' },

  // ==========================================
  // LOẠI 3 & LOẠI 4: NGUỒN VỐN (CREDIT BALANCE)
  // ==========================================
  { code: '331', name: 'Phải trả cho người bán', type: 'Nguon Von' },
  { code: '33311', name: 'Thuế GTGT hàng bán ra nội địa', type: 'Nguon Von' },
  { code: '33312', name: 'Thuế GTGT hàng nhập khẩu', type: 'Nguon Von' },
  { code: '3332', name: 'Thuế tiêu thụ đặc biệt', type: 'Nguon Von' },
  { code: '3333', name: 'Thuế xuất, nhập khẩu', type: 'Nguon Von' },
  { code: '3334', name: 'Thuế thu nhập doanh nghiệp (TNDN)', type: 'Nguon Von' },
  { code: '3335', name: 'Thuế thu nhập cá nhân (TNCN)', type: 'Nguon Von' },
  { code: '3338', name: 'Các loại thuế khác phải nộp', type: 'Nguon Von' },
  { code: '3341', name: 'Phải trả công nhân viên (Tiền lương)', type: 'Nguon Von' },
  { code: '335', name: 'Chi phí phải trả (Trích trước)', type: 'Nguon Von' },
  { code: '336', name: 'Phải trả nội bộ', type: 'Nguon Von' },
  { code: '3381', name: 'Tài sản thừa chờ giải quyết', type: 'Nguon Von' },
  { code: '3382', name: 'Kinh phí công đoàn', type: 'Nguon Von' },
  { code: '3383', name: 'Bảo hiểm xã hội (BHXH)', type: 'Nguon Von' },
  { code: '3384', name: 'Bảo hiểm y tế (BHYT)', type: 'Nguon Von' },
  { code: '3386', name: 'Bảo hiểm thất nghiệp (BHTN)', type: 'Nguon Von' },
  { code: '341', name: 'Vay và nợ thuê tài chính', type: 'Nguon Von' },
  { code: '352', name: 'Dự phòng phải trả', type: 'Nguon Von' },
  { code: '353', name: 'Quỹ khen thưởng, phúc lợi', type: 'Nguon Von' },
  { code: '4111', name: 'Vốn góp của chủ sở hữu', type: 'Nguon Von' },
  { code: '4112', name: 'Thặng dư vốn cổ phần', type: 'Nguon Von' },
  { code: '412', name: 'Chênh lệch đánh giá lại tài sản', type: 'Nguon Von' },
  { code: '414', name: 'Quỹ đầu tư phát triển', type: 'Nguon Von' },
  { code: '418', name: 'Các quỹ khác thuộc vốn chủ sở hữu', type: 'Nguon Von' },
  { code: '419', name: 'Cổ phiếu quỹ', type: 'Nguon Von' },
  { code: '4211', name: 'Lợi nhuận sau thuế chưa phân phối năm trước', type: 'Nguon Von' },
  { code: '4212', name: 'Lợi nhuận sau thuế chưa phân phối năm nay', type: 'Nguon Von' },

  // ==========================================
  // LOẠI 5 & LOẠI 7: DOANH THU & THU NHẬP
  // ==========================================
  { code: '5111', name: 'Doanh thu bán hàng hóa', type: 'Doanh Thu' },
  { code: '5112', name: 'Doanh thu bán các thành phẩm', type: 'Doanh Thu' },
  { code: '5113', name: 'Doanh thu cung cấp dịch vụ', type: 'Doanh Thu' },
  { code: '515', name: 'Doanh thu hoạt động tài chính', type: 'Doanh Thu' },
  { code: '5211', name: 'Chiết khấu thương mại', type: 'Doanh Thu' },
  { code: '5212', name: 'Hàng bán bị trả lại', type: 'Doanh Thu' },
  { code: '5213', name: 'Giảm giá hàng bán', type: 'Doanh Thu' },
  { code: '711', name: 'Thu nhập khác (Thanh lý tài sản...)', type: 'Doanh Thu' },

  // ==========================================
  // LOẠI 6 & LOẠI 8: CHI PHÍ SẢN XUẤT KINH DOANH
  // ==========================================
  { code: '611', name: 'Mua hàng (Phương pháp kiểm kê định kỳ)', type: 'Chi Phi' },
  { code: '621', name: 'Chi phí nguyên liệu, vật liệu trực tiếp', type: 'Chi Phi' },
  { code: '622', name: 'Chi phí nhân công trực tiếp', type: 'Chi Phi' },
  { code: '623', name: 'Chi phí sử dụng máy thi công', type: 'Chi Phi' },
  { code: '6271', name: 'Chi phí nhân viên phân xưởng', type: 'Chi Phi' },
  { code: '6272', name: 'Chi phí vật liệu phân xưởng', type: 'Chi Phi' },
  { code: '6273', name: 'Chi phí dụng cụ sản xuất', type: 'Chi Phi' },
  { code: '6274', name: 'Chi phí khấu hao TSCĐ phân xưởng', type: 'Chi Phi' },
  { code: '632', name: 'Giá vốn hàng bán', type: 'Chi Phi' },
  { code: '635', name: 'Chi phí tài chính (Lãi vay, lỗ tỷ giá)', type: 'Chi Phi' },
  { code: '6411', name: 'Chi phí nhân viên bán hàng', type: 'Chi Phi' },
  { code: '6414', name: 'Chi phí khấu hao TSCĐ bộ phận bán hàng', type: 'Chi Phi' },
  { code: '6421', name: 'Chi phí nhân viên quản lý doanh nghiệp', type: 'Chi Phi' },
  { code: '6422', name: 'Chi phí vật liệu quản lý doanh nghiệp', type: 'Chi Phi' },
  { code: '6424', name: 'Chi phí khấu hao TSCĐ quản lý doanh nghiệp', type: 'Chi Phi' },
  { code: '811', name: 'Chi phí khác', type: 'Chi Phi' },
  { code: '821', name: 'Chi phí thuế thu nhập doanh nghiệp', type: 'Chi Phi' },

  // ==========================================
  // LOẠI 9: TRUNG GIAN XÁC ĐỊNH KẾT QUẢ KINH DOANH
  // ==========================================
  { code: '911', name: 'Xác định kết quả kinh doanh', type: 'Trung Gian' }
];