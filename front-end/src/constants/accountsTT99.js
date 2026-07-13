/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * Chart of Accounts hoàn chỉnh theo Thông tư 99/2025/TT-BTC
 * Bao gồm tài khoản cấp 1, cấp 2, cấp 3
 */

export const ACCOUNTS_TT99 = [
  // ============================================================
  // LOẠI 1 - TÀI SẢN NGẮN HẠN
  // ============================================================
  // 111 - Tiền mặt
  { code: '111', name: 'Tiền mặt', type: '1', group: 'cash', department: 'finance', nature: 'debit', parent: null },
  { code: '1111', name: 'Tiền mặt Việt Nam', type: '1', group: 'cash', department: 'finance', nature: 'debit', parent: '111' },
  { code: '1112', name: 'Tiền mặt ngoại tệ', type: '1', group: 'cash', department: 'finance', nature: 'debit', parent: '111' },
  { code: '1113', name: 'Vàng, bạc, kim khí quý, đá quý', type: '1', group: 'cash', department: 'finance', nature: 'debit', parent: '111' },

  // 112 - Tiền gửi ngân hàng
  { code: '112', name: 'Tiền gửi ngân hàng', type: '1', group: 'cash', department: 'finance', nature: 'debit', parent: null },
  { code: '1121', name: 'Tiền gửi ngân hàng VND', type: '1', group: 'cash', department: 'finance', nature: 'debit', parent: '112' },
  { code: '1122', name: 'Tiền gửi ngân hàng ngoại tệ', type: '1', group: 'cash', department: 'finance', nature: 'debit', parent: '112' },

  // 113 - Tiền đang chuyển
  { code: '113', name: 'Tiền đang chuyển', type: '1', group: 'cash', department: 'finance', nature: 'debit', parent: null },

  // 121 - Chứng khoán kinh doanh
  { code: '121', name: 'Chứng khoán kinh doanh', type: '1', group: 'financial_assets', department: 'finance', nature: 'debit', parent: null },
  { code: '1211', name: 'Cổ phiếu', type: '1', group: 'financial_assets', department: 'finance', nature: 'debit', parent: '121' },
  { code: '1212', name: 'Trái phiếu', type: '1', group: 'financial_assets', department: 'finance', nature: 'debit', parent: '121' },
  { code: '1218', name: 'Chứng khoán kinh doanh khác', type: '1', group: 'financial_assets', department: 'finance', nature: 'debit', parent: '121' },

  // 128 - Đầu tư nắm giữ đến ngày đáo hạn
  { code: '128', name: 'Đầu tư nắm giữ đến ngày đáo hạn', type: '1', group: 'financial_assets', department: 'finance', nature: 'debit', parent: null },
  { code: '1281', name: 'Tiền gửi có kỳ hạn', type: '1', group: 'financial_assets', department: 'finance', nature: 'debit', parent: '128' },
  { code: '1282', name: 'Cho vay', type: '1', group: 'financial_assets', department: 'finance', nature: 'debit', parent: '128' },
  { code: '1283', name: 'Trái phiếu', type: '1', group: 'financial_assets', department: 'finance', nature: 'debit', parent: '128' },
  { code: '1288', name: 'Đầu tư khác', type: '1', group: 'financial_assets', department: 'finance', nature: 'debit', parent: '128' },

  // 129 - Dự phòng giảm giá chứng khoán kinh doanh
  { code: '129', name: 'Dự phòng giảm giá chứng khoán kinh doanh', type: '1', group: 'financial_assets', department: 'finance', nature: 'credit', parent: null, is_contra: true },

  // 131 - Phải thu khách hàng
  { code: '131', name: 'Phải thu của khách hàng', type: '1', group: 'receivables', department: 'sales', nature: 'both', parent: null },

  // 133 - Thuế GTGT được khấu trừ
  { code: '133', name: 'Thuế GTGT được khấu trừ', type: '1', group: 'tax', department: 'finance', nature: 'debit', parent: null },
  { code: '1331', name: 'Thuế GTGT đầu vào được khấu trừ', type: '1', group: 'tax', department: 'finance', nature: 'debit', parent: '133' },
  { code: '1332', name: 'Thuế GTGT đầu vào không được khấu trừ', type: '1', group: 'tax', department: 'finance', nature: 'debit', parent: '133' },

  // 136 - Phải thu nội bộ
  { code: '136', name: 'Phải thu nội bộ', type: '1', group: 'receivables', department: 'finance', nature: 'debit', parent: null },
  { code: '1361', name: 'Vốn kinh doanh ở đơn vị trực thuộc', type: '1', group: 'receivables', department: 'finance', nature: 'debit', parent: '136' },
  { code: '1362', name: 'Phải thu nội bộ khác', type: '1', group: 'receivables', department: 'finance', nature: 'debit', parent: '136' },
  { code: '1368', name: 'Phải thu nội bộ khác', type: '1', group: 'receivables', department: 'finance', nature: 'debit', parent: '136' },

  // 137 - Dự phòng phải thu khó đòi
  { code: '137', name: 'Dự phòng phải thu khó đòi', type: '1', group: 'receivables', department: 'finance', nature: 'credit', parent: null, is_contra: true },

  // 138 - Phải thu khác
  { code: '138', name: 'Phải thu khác', type: '1', group: 'receivables', department: 'finance', nature: 'both', parent: null },
  { code: '1381', name: 'Tài sản thiếu chờ xử lý', type: '1', group: 'receivables', department: 'finance', nature: 'both', parent: '138' },
  { code: '1385', name: 'Phải thu về cổ phần hóa', type: '1', group: 'receivables', department: 'finance', nature: 'both', parent: '138' },
  { code: '1388', name: 'Phải thu khác', type: '1', group: 'receivables', department: 'finance', nature: 'both', parent: '138' },

  // 141 - Tạm ứng
  { code: '141', name: 'Tạm ứng', type: '1', group: 'advances', department: 'finance', nature: 'debit', parent: null },

  // 151 - Hàng mua đang đi đường
  { code: '151', name: 'Hàng mua đang đi đường', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit', parent: null },

  // 152 - Nguyên liệu, vật liệu
  { code: '152', name: 'Nguyên liệu, vật liệu', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit', parent: null },
  { code: '1521', name: 'Nguyên liệu chính', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit', parent: '152' },
  { code: '1522', name: 'Vật liệu phụ', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit', parent: '152' },
  { code: '1523', name: 'Nhiên liệu', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit', parent: '152' },
  { code: '1524', name: 'Phụ tùng thay thế', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit', parent: '152' },
  { code: '1525', name: 'Vật liệu thiết bị XDCB', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit', parent: '152' },
  { code: '1528', name: 'Vật liệu khác', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit', parent: '152' },

  // 153 - Công cụ, dụng cụ
  { code: '153', name: 'Công cụ, dụng cụ', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit', parent: null },
  { code: '1531', name: 'Công cụ, dụng cụ', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit', parent: '153' },
  { code: '1532', name: 'Bao bì luân chuyển', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit', parent: '153' },
  { code: '1533', name: 'Đồ dùng cho thuê', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit', parent: '153' },

  // 154 - Chi phí sản xuất, kinh doanh dở dang
  { code: '154', name: 'Chi phí SXKD dở dang', type: '1', group: 'wip', department: 'warehouse', nature: 'debit', parent: null },

  // 155 - Thành phẩm
  { code: '155', name: 'Thành phẩm', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit', parent: null },

  // 156 - Hàng hóa
  { code: '156', name: 'Hàng hóa', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit', parent: null },
  { code: '1561', name: 'Hàng hóa kho', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit', parent: '156' },
  { code: '1562', name: 'Hàng hóa logistics', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit', parent: '156' },
  { code: '1567', name: 'Hàng hóa bất động sản', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit', parent: '156' },
  { code: '1568', name: 'Hàng hóa khác', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit', parent: '156' },

  // 157 - Hàng gửi đi bán
  { code: '157', name: 'Hàng gửi đi bán', type: '1', group: 'inventory', department: 'sales', nature: 'debit', parent: null },

  // 158 - Hàng hóa kho bảo thuế
  { code: '158', name: 'Hàng hóa kho bảo thuế', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit', parent: null },

  // 161 - Chi phí trả trước ngắn hạn
  { code: '161', name: 'Chi phí trả trước ngắn hạn', type: '1', group: 'prepaid', department: 'finance', nature: 'debit', parent: null },
  { code: '1611', name: 'Chi phí trả trước ngắn hạn', type: '1', group: 'prepaid', department: 'finance', nature: 'debit', parent: '161' },
  { code: '1612', name: 'Chi phí trả trước ngắn hạn khác', type: '1', group: 'prepaid', department: 'finance', nature: 'debit', parent: '161' },

  // 171 - Giá trị hàng gửi đi bán (đã có)

  // ============================================================
  // LOẠI 2 - TÀI SẢN DÀI HẠN
  // ============================================================

  // 211 - TSCĐ hữu hình
  { code: '211', name: 'Tài sản cố định hữu hình', type: '2', group: 'fixed_assets', department: 'admin', nature: 'debit', parent: null },
  { code: '2111', name: 'Nhà cửa, vật kiến trúc', type: '2', group: 'fixed_assets', department: 'admin', nature: 'debit', parent: '211' },
  { code: '2112', name: 'Máy móc, thiết bị', type: '2', group: 'fixed_assets', department: 'admin', nature: 'debit', parent: '211' },
  { code: '2113', name: 'Phương tiện vận tải, truyền dẫn', type: '2', group: 'fixed_assets', department: 'admin', nature: 'debit', parent: '211' },
  { code: '2114', name: 'Thiết bị, dụng cụ quản lý', type: '2', group: 'fixed_assets', department: 'admin', nature: 'debit', parent: '211' },
  { code: '2115', name: 'Cây lâu năm, súc vật làm việc', type: '2', group: 'fixed_assets', department: 'admin', nature: 'debit', parent: '211' },
  { code: '2118', name: 'TSCĐ hữu hình khác', type: '2', group: 'fixed_assets', department: 'admin', nature: 'debit', parent: '211' },

  // 212 - TSCĐ thuê tài chính
  { code: '212', name: 'TSCĐ thuê tài chính', type: '2', group: 'fixed_assets', department: 'admin', nature: 'debit', parent: null },
  { code: '2121', name: 'TSCĐ thuê tài chính hữu hình', type: '2', group: 'fixed_assets', department: 'admin', nature: 'debit', parent: '212' },
  { code: '2122', name: 'TSCĐ thuê tài chính vô hình', type: '2', group: 'fixed_assets', department: 'admin', nature: 'debit', parent: '212' },

  // 213 - TSCĐ vô hình
  { code: '213', name: 'TSCĐ vô hình', type: '2', group: 'fixed_assets', department: 'admin', nature: 'debit', parent: null },
  { code: '2131', name: 'Quyền sử dụng đất', type: '2', group: 'fixed_assets', department: 'admin', nature: 'debit', parent: '213' },
  { code: '2132', name: 'Bản quyền, bằng sáng chế', type: '2', group: 'fixed_assets', department: 'admin', nature: 'debit', parent: '213' },
  { code: '2133', name: 'Nhãn hiệu', type: '2', group: 'fixed_assets', department: 'admin', nature: 'debit', parent: '213' },
  { code: '2134', name: 'Phần mềm máy tính', type: '2', group: 'fixed_assets', department: 'admin', nature: 'debit', parent: '213' },
  { code: '2135', name: 'Giấy phép, giấy phép nhượng quyền', type: '2', group: 'fixed_assets', department: 'admin', nature: 'debit', parent: '213' },
  { code: '2136', name: 'TSCĐ vô hình khác', type: '2', group: 'fixed_assets', department: 'admin', nature: 'debit', parent: '213' },

  // 214 - Hao mòn TSCĐ (đối tài)
  { code: '214', name: 'Hao mòn tài sản cố định', type: '2', group: 'fixed_assets', department: 'admin', nature: 'credit', parent: null, is_contra: true },
  { code: '2141', name: 'Hao mòn TSCĐ hữu hình', type: '2', group: 'fixed_assets', department: 'admin', nature: 'credit', parent: '214', is_contra: true },
  { code: '2142', name: 'Hao mòn TSCĐ thuê tài chính', type: '2', group: 'fixed_assets', department: 'admin', nature: 'credit', parent: '214', is_contra: true },
  { code: '2143', name: 'Hao mòn TSCĐ vô hình', type: '2', group: 'fixed_assets', department: 'admin', nature: 'credit', parent: '214', is_contra: true },
  { code: '2147', name: 'Hao mòn bất động sản đầu tư', type: '2', group: 'fixed_assets', department: 'admin', nature: 'credit', parent: '214', is_contra: true },

  // 215 - Tài sản sinh học
  { code: '215', name: 'Tài sản sinh học', type: '2', group: 'fixed_assets', department: 'admin', nature: 'debit', parent: null },

  // 217 - Bất động sản đầu tư
  { code: '217', name: 'Bất động sản đầu tư', type: '2', group: 'fixed_assets', department: 'admin', nature: 'debit', parent: null },

  // 221 - Đầu tư vào công ty con
  { code: '221', name: 'Đầu tư vào công ty con', type: '2', group: 'financial_assets', department: 'finance', nature: 'debit', parent: null },

  // 222 - Đầu tư vào công ty liên kết
  { code: '222', name: 'Đầu tư vào công ty liên kết', type: '2', group: 'financial_assets', department: 'finance', nature: 'debit', parent: null },

  // 228 - Đầu tư khác dài hạn
  { code: '228', name: 'Đầu tư khác dài hạn', type: '2', group: 'financial_assets', department: 'finance', nature: 'debit', parent: null },
  { code: '2281', name: 'Đầu tư góp vốn', type: '2', group: 'financial_assets', department: 'finance', nature: 'debit', parent: '228' },
  { code: '2288', name: 'Đầu tư dài hạn khác', type: '2', group: 'financial_assets', department: 'finance', nature: 'debit', parent: '228' },

  // 229 - Dự phòng tổn thất tài sản (đối tài)
  { code: '229', name: 'Dự phòng tổn thất tài sản', type: '2', group: 'financial_assets', department: 'finance', nature: 'credit', parent: null, is_contra: true },
  { code: '2291', name: 'Dự phòng giảm giá đầu tư ngắn hạn', type: '2', group: 'financial_assets', department: 'finance', nature: 'credit', parent: '229', is_contra: true },
  { code: '2292', name: 'Dự phòng giảm giá đầu tư dài hạn', type: '2', group: 'financial_assets', department: 'finance', nature: 'credit', parent: '229', is_contra: true },
  { code: '2293', name: 'Dự phòng phải thu khó đòi', type: '2', group: 'receivables', department: 'finance', nature: 'credit', parent: '229', is_contra: true },
  { code: '2294', name: 'Dự phòng giảm giá hàng tồn kho', type: '2', group: 'inventory', department: 'warehouse', nature: 'credit', parent: '229', is_contra: true },
  { code: '2295', name: 'Dự phòng tài sản sinh học', type: '2', group: 'fixed_assets', department: 'admin', nature: 'credit', parent: '229', is_contra: true },

  // 241 - XDCB dở dang
  { code: '241', name: 'Xây dựng cơ bản dở dang', type: '2', group: 'construction', department: 'admin', nature: 'debit', parent: null },
  { code: '2411', name: 'Mua sắm TSCĐ', type: '2', group: 'construction', department: 'admin', nature: 'debit', parent: '241' },
  { code: '2412', name: 'Xây dựng cơ bản', type: '2', group: 'construction', department: 'admin', nature: 'debit', parent: '241' },
  { code: '2413', name: 'Sửa chữa lớn TSCĐ', type: '2', group: 'construction', department: 'admin', nature: 'debit', parent: '241' },

  // 242 - Chi phí trả trước dài hạn
  { code: '242', name: 'Chi phí trả trước dài hạn', type: '2', group: 'prepaid', department: 'finance', nature: 'debit', parent: null },

  // 243 - Tài sản thuế thu nhập hoãn lại
  { code: '243', name: 'Tài sản thuế thu nhập hoãn lại', type: '2', group: 'tax', department: 'finance', nature: 'debit', parent: null },

  // 244 - Ký quỹ, ký cược dài hạn
  { code: '244', name: 'Ký quỹ, ký cược dài hạn', type: '2', group: 'receivables', department: 'finance', nature: 'debit', parent: null },

  // ============================================================
  // LOẠI 3 - NỢ PHẢI TRẢ
  // ============================================================

  // 311 - Vay ngắn hạn
  { code: '311', name: 'Vay ngắn hạn', type: '3', group: 'loans', department: 'admin', nature: 'credit', parent: null },
  { code: '3111', name: 'Vay ngân hàng', type: '3', group: 'loans', department: 'admin', nature: 'credit', parent: '311' },
  { code: '3112', name: 'Vay khác', type: '3', group: 'loans', department: 'admin', nature: 'credit', parent: '311' },

  // 315 - Nợ dài hạn đến hạn trả
  { code: '315', name: 'Nợ dài hạn đến hạn trả', type: '3', group: 'loans', department: 'admin', nature: 'credit', parent: null },

  // 331 - Phải trả người bán
  { code: '331', name: 'Phải trả cho người bán', type: '3', group: 'payables', department: 'purchasing', nature: 'both', parent: null },

  // 332 - Người mua trả trước
  { code: '332', name: 'Người mua trả tiền trước', type: '3', group: 'prepayments', department: 'sales', nature: 'credit', parent: null },

  // 333 - Thuế và các khoản phải nộp
  { code: '333', name: 'Thuế và các khoản phải nộp Nhà nước', type: '3', group: 'tax', department: 'finance', nature: 'credit', parent: null },
  { code: '3331', name: 'Thuế GTGT đầu ra', type: '3', group: 'tax', department: 'finance', nature: 'credit', parent: '333' },
  { code: '33311', name: 'Thuế GTGT đầu ra (chi tiết)', type: '3', group: 'tax', department: 'finance', nature: 'credit', parent: '3331' },
  { code: '33312', name: 'Thuế GTGT hàng nhập khẩu', type: '3', group: 'tax', department: 'finance', nature: 'credit', parent: '3331' },
  { code: '3332', name: 'Thuế tiêu thụ đặc biệt', type: '3', group: 'tax', department: 'finance', nature: 'credit', parent: '333' },
  { code: '3333', name: 'Thuế xuất, nhập khẩu', type: '3', group: 'tax', department: 'finance', nature: 'credit', parent: '333' },
  { code: '3334', name: 'Thuế thu nhập doanh nghiệp', type: '3', group: 'tax', department: 'finance', nature: 'credit', parent: '333' },
  { code: '3335', name: 'Thuế thu nhập cá nhân', type: '3', group: 'tax', department: 'hr', nature: 'credit', parent: '333' },
  { code: '3336', name: 'Thuế tài nguyên', type: '3', group: 'tax', department: 'finance', nature: 'credit', parent: '333' },
  { code: '3337', name: 'Thuế nhà đất', type: '3', group: 'tax', department: 'admin', nature: 'credit', parent: '333' },
  { code: '3338', name: 'Thuế bảo vệ môi trường', type: '3', group: 'tax', department: 'finance', nature: 'credit', parent: '333' },
  { code: '3339', name: 'Thuế môn bài', type: '3', group: 'tax', department: 'admin', nature: 'credit', parent: '333' },

  // 334 - Phải trả người lao động
  { code: '334', name: 'Phải trả người lao động', type: '3', group: 'payroll', department: 'hr', nature: 'credit', parent: null },
  { code: '3341', name: 'Phải trả công nhân viên', type: '3', group: 'payroll', department: 'hr', nature: 'credit', parent: '334' },
  { code: '3342', name: 'Phải trả người lao động khác', type: '3', group: 'payroll', department: 'hr', nature: 'credit', parent: '334' },

  // 335 - Chi phí phải trả
  { code: '335', name: 'Chi phí phải trả', type: '3', group: 'accruals', department: 'finance', nature: 'credit', parent: null },

  // 336 - Phải trả nội bộ
  { code: '336', name: 'Phải trả nội bộ', type: '3', group: 'intercompany', department: 'finance', nature: 'credit', parent: null },
  { code: '3361', name: 'Phải trả nội bộ về vốn', type: '3', group: 'intercompany', department: 'finance', nature: 'credit', parent: '336' },
  { code: '3362', name: 'Phải trả nội bộ khác', type: '3', group: 'intercompany', department: 'finance', nature: 'credit', parent: '336' },

  // 337 - Thanh toán theo tiến độ
  { code: '337', name: 'Thanh toán theo tiến độ hợp đồng xây dựng', type: '3', group: 'payables', department: 'admin', nature: 'credit', parent: null },

  // 338 - Phải trả, phải nộp khác
  { code: '338', name: 'Phải trả, phải nộp khác', type: '3', group: 'other_payables', department: 'finance', nature: 'both', parent: null },
  { code: '3381', name: 'Tài sản thừa chờ giải quyết', type: '3', group: 'other_payables', department: 'finance', nature: 'both', parent: '338' },
  { code: '3382', name: 'Kinh phí công đoàn', type: '3', group: 'payroll', department: 'hr', nature: 'credit', parent: '338' },
  { code: '3383', name: 'Bảo hiểm xã hội', type: '3', group: 'payroll', department: 'hr', nature: 'credit', parent: '338' },
  { code: '3384', name: 'Bảo hiểm y tế', type: '3', group: 'payroll', department: 'hr', nature: 'credit', parent: '338' },
  { code: '3385', name: 'Bảo hiểm thất nghiệp', type: '3', group: 'payroll', department: 'hr', nature: 'credit', parent: '338' },
  { code: '3386', name: 'Đoàn phí', type: '3', group: 'other_payables', department: 'hr', nature: 'credit', parent: '338' },
  { code: '3387', name: 'Doanh thu chưa thực hiện', type: '3', group: 'other_payables', department: 'finance', nature: 'credit', parent: '338' },
  { code: '3388', name: 'Phải trả, phải nộp khác', type: '3', group: 'other_payables', department: 'finance', nature: 'credit', parent: '338' },

  // 341 - Vay và nợ thuê tài chính
  { code: '341', name: 'Vay và nợ thuê tài chính', type: '3', group: 'loans', department: 'admin', nature: 'credit', parent: null },
  { code: '3411', name: 'Vay ngắn hạn', type: '3', group: 'loans', department: 'admin', nature: 'credit', parent: '341' },
  { code: '3412', name: 'Vay dài hạn', type: '3', group: 'loans', department: 'admin', nature: 'credit', parent: '341' },

  // 342 - Trái phiếu phát hành
  { code: '342', name: 'Trái phiếu phát hành', type: '3', group: 'bonds', department: 'admin', nature: 'credit', parent: null },

  // 343 - Nhận ký quỹ, ký cược
  { code: '343', name: 'Nhận ký quỹ, ký cược', type: '3', group: 'payables', department: 'finance', nature: 'credit', parent: null },

  // 344 - Doanh thu chưa thực hiện
  { code: '344', name: 'Doanh thu chưa thực hiện', type: '3', group: 'other_payables', department: 'sales', nature: 'credit', parent: null },

  // 347 - Dự phòng phải trả
  { code: '347', name: 'Dự phòng phải trả', type: '3', group: 'accruals', department: 'finance', nature: 'credit', parent: null },

  // 352 - Quỹ khen thưởng, phúc lợi
  { code: '352', name: 'Quỹ khen thưởng, phúc lợi', type: '3', group: 'welfare', department: 'hr', nature: 'credit', parent: null },

  // ============================================================
  // LOẠI 4 - VỐN CHỦ SỞ HỮU
  // ============================================================

  // 411 - Vốn góp của chủ sở hữu
  { code: '411', name: 'Vốn góp của chủ sở hữu', type: '4', group: 'equity', department: 'admin', nature: 'credit', parent: null },
  { code: '4111', name: 'Vốn góp', type: '4', group: 'equity', department: 'admin', nature: 'credit', parent: '411' },
  { code: '4112', name: 'Thặng dư cổ phiếu', type: '4', group: 'equity', department: 'admin', nature: 'credit', parent: '411' },
  { code: '4118', name: 'Vốn khác', type: '4', group: 'equity', department: 'admin', nature: 'credit', parent: '411' },

  // 412 - Chênh lệch đánh giá lại tài sản
  { code: '412', name: 'Chênh lệch đánh giá lại tài sản', type: '4', group: 'fx', department: 'finance', nature: 'credit', parent: null },

  // 413 - Chênh lệch tỷ giá hối đoái
  { code: '413', name: 'Chênh lệch tỷ giá hối đoái', type: '4', group: 'fx', department: 'finance', nature: 'credit', parent: null },

  // 414 - Quỹ đầu tư phát triển
  { code: '414', name: 'Quỹ đầu tư phát triển', type: '4', group: 'equity', department: 'admin', nature: 'credit', parent: null },

  // 415 - Quỹ dự phòng tài chính
  { code: '415', name: 'Quỹ dự phòng tài chính', type: '4', group: 'equity', department: 'admin', nature: 'credit', parent: null },

  // 416 - Quỹ khác thuộc vốn chủ sở hữu
  { code: '416', name: 'Quỹ khác thuộc vốn chủ sở hữu', type: '4', group: 'equity', department: 'admin', nature: 'credit', parent: null },

  // 417 - Quỹ khen thưởng ban quản lý
  { code: '417', name: 'Quỹ khen thưởng ban quản lý', type: '4', group: 'equity', department: 'admin', nature: 'credit', parent: null },

  // 418 - Cổ phiếu quỹ (đối tài)
  { code: '418', name: 'Cổ phiếu quỹ', type: '4', group: 'equity', department: 'admin', nature: 'debit', parent: null, is_contra: true },

  // 419 - Lợi nhuận sau thuế chưa phân phối
  { code: '419', name: 'Lợi nhuận sau thuế chưa phân phối', type: '4', group: 'retained', department: 'admin', nature: 'credit', parent: null },
  { code: '4191', name: 'Lợi nhuận năm trước', type: '4', group: 'retained', department: 'admin', nature: 'credit', parent: '419' },
  { code: '4192', name: 'Lợi nhuận năm nay', type: '4', group: 'retained', department: 'admin', nature: 'credit', parent: '419' },

  // ============================================================
  // LOẠI 5 - DOANH THU
  // ============================================================

  // 511 - Doanh thu bán hàng và cung cấp dịch vụ
  { code: '511', name: 'Doanh thu bán hàng và cung cấp dịch vụ', type: '5', group: 'revenue', department: 'sales', nature: 'credit', parent: null },
  { code: '5111', name: 'Doanh thu bán hàng hóa', type: '5', group: 'revenue', department: 'sales', nature: 'credit', parent: '511' },
  { code: '5112', name: 'Doanh thu cung cấp dịch vụ', type: '5', group: 'revenue', department: 'sales', nature: 'credit', parent: '511' },
  { code: '5113', name: 'Doanh thu nội bộ', type: '5', group: 'revenue', department: 'sales', nature: 'credit', parent: '511' },

  // 512 - Doanh thu nội bộ
  { code: '512', name: 'Doanh thu nội bộ', type: '5', group: 'revenue', department: 'sales', nature: 'credit', parent: null },
  { code: '5121', name: 'Doanh thu bán hàng nội bộ', type: '5', group: 'revenue', department: 'sales', nature: 'credit', parent: '512' },
  { code: '5122', name: 'Doanh thu cung cấp dịch vụ nội bộ', type: '5', group: 'revenue', department: 'sales', nature: 'credit', parent: '512' },

  // 515 - Doanh thu hoạt động tài chính
  { code: '515', name: 'Doanh thu hoạt động tài chính', type: '5', group: 'income', department: 'finance', nature: 'credit', parent: null },

  // 521 - Chiết khấu thương mại (giảm trừ DT)
  { code: '521', name: 'Chiết khấu thương mại', type: '5', group: 'deductions', department: 'sales', nature: 'debit', parent: null },

  // 531 - Hàng bán bị trả lại (giảm trừ DT)
  { code: '531', name: 'Hàng bán bị trả lại', type: '5', group: 'deductions', department: 'sales', nature: 'debit', parent: null },

  // 532 - Giảm giá hàng bán (giảm trừ DT)
  { code: '532', name: 'Giảm giá hàng bán', type: '5', group: 'deductions', department: 'sales', nature: 'debit', parent: null },

  // ============================================================
  // LOẠI 6 - CHI PHÍ SẢN XUẤT, KINH DOANH
  // ============================================================

  // 611 - Chi phí mua hàng
  { code: '611', name: 'Chi phí mua hàng', type: '6', group: 'cogs', department: 'warehouse', nature: 'debit', parent: null },
  { code: '6111', name: 'Chi phí mua hàng hóa', type: '6', group: 'cogs', department: 'warehouse', nature: 'debit', parent: '611' },
  { code: '6112', name: 'Chi phí mua hàng nội bộ', type: '6', group: 'cogs', department: 'warehouse', nature: 'debit', parent: '611' },

  // 621 - Chi phí nguyên liệu, vật liệu trực tiếp
  { code: '621', name: 'Chi phí nguyên liệu, vật liệu trực tiếp', type: '6', group: 'manufacturing', department: 'warehouse', nature: 'debit', parent: null },

  // 622 - Chi phí nhân công trực tiếp
  { code: '622', name: 'Chi phí nhân công trực tiếp', type: '6', group: 'manufacturing', department: 'hr', nature: 'debit', parent: null },

  // 623 - Chi phí máy thi công
  { code: '623', name: 'Chi phí máy thi công', type: '6', group: 'manufacturing', department: 'warehouse', nature: 'debit', parent: null },

  // 627 - Chi phí sản xuất chung
  { code: '627', name: 'Chi phí sản xuất chung', type: '6', group: 'manufacturing', department: 'warehouse', nature: 'debit', parent: null },
  { code: '6271', name: 'Chi phí nhân viên phân xưởng', type: '6', group: 'manufacturing', department: 'warehouse', nature: 'debit', parent: '627' },
  { code: '6272', name: 'Chi phí vật liệu', type: '6', group: 'manufacturing', department: 'warehouse', nature: 'debit', parent: '627' },
  { code: '6273', name: 'Chi phí dụng cụ sản xuất', type: '6', group: 'manufacturing', department: 'warehouse', nature: 'debit', parent: '627' },
  { code: '6274', name: 'Chi phí khấu hao TSCĐ', type: '6', group: 'manufacturing', department: 'warehouse', nature: 'debit', parent: '627' },
  { code: '6275', name: 'Chi phí dịch vụ mua ngoài', type: '6', group: 'manufacturing', department: 'warehouse', nature: 'debit', parent: '627' },
  { code: '6277', name: 'Chi phí bằng tiền khác', type: '6', group: 'manufacturing', department: 'warehouse', nature: 'debit', parent: '627' },
  { code: '6278', name: 'Chi phí sản xuất chung khác', type: '6', group: 'manufacturing', department: 'warehouse', nature: 'debit', parent: '627' },

  // 631 - Giá thành sản xuất
  { code: '631', name: 'Giá thành sản xuất', type: '6', group: 'cogs', department: 'warehouse', nature: 'debit', parent: null },

  // 632 - Giá vốn hàng bán
  { code: '632', name: 'Giá vốn hàng bán', type: '6', group: 'cogs', department: 'warehouse', nature: 'debit', parent: null },

  // 635 - Chi phí tài chính
  { code: '635', name: 'Chi phí tài chính', type: '6', group: 'finance', department: 'finance', nature: 'debit', parent: null },

  // 641 - Chi phí bán hàng
  { code: '641', name: 'Chi phí bán hàng', type: '6', group: 'selling', department: 'sales', nature: 'debit', parent: null },
  { code: '6411', name: 'Chi phí nhân viên bán hàng', type: '6', group: 'selling', department: 'sales', nature: 'debit', parent: '641' },
  { code: '6412', name: 'Chi phí vật liệu, bao bì', type: '6', group: 'selling', department: 'sales', nature: 'debit', parent: '641' },
  { code: '6413', name: 'Chi phí dụng cụ bán hàng', type: '6', group: 'selling', department: 'sales', nature: 'debit', parent: '641' },
  { code: '6414', name: 'Chi phí khấu hao TSCĐ', type: '6', group: 'selling', department: 'sales', nature: 'debit', parent: '641' },
  { code: '6415', name: 'Chi phí bảo hành', type: '6', group: 'selling', department: 'sales', nature: 'debit', parent: '641' },
  { code: '6417', name: 'Chi phí quảng cáo, tiếp thị', type: '6', group: 'marketing', department: 'sales', nature: 'debit', parent: '641' },
  { code: '6418', name: 'Chi phí bán hàng khác', type: '6', group: 'selling', department: 'sales', nature: 'debit', parent: '641' },

  // 642 - Chi phí quản lý doanh nghiệp
  { code: '642', name: 'Chi phí quản lý doanh nghiệp', type: '6', group: 'admin', department: 'hr', nature: 'debit', parent: null },
  { code: '6421', name: 'Chi phí nhân viên quản lý', type: '6', group: 'admin', department: 'hr', nature: 'debit', parent: '642' },
  { code: '6422', name: 'Chi phí vật liệu quản lý', type: '6', group: 'admin', department: 'hr', nature: 'debit', parent: '642' },
  { code: '6423', name: 'Chi phí đồ dùng văn phòng', type: '6', group: 'admin', department: 'hr', nature: 'debit', parent: '642' },
  { code: '6424', name: 'Chi phí khấu hao TSCĐ', type: '6', group: 'admin', department: 'hr', nature: 'debit', parent: '642' },
  { code: '6425', name: 'Chi phí dịch vụ mua ngoài', type: '6', group: 'admin', department: 'hr', nature: 'debit', parent: '642' },
  { code: '6426', name: 'Chi phí thuế, phí, lệ phí', type: '6', group: 'admin', department: 'hr', nature: 'debit', parent: '642' },
  { code: '6427', name: 'Chi phí dự phòng', type: '6', group: 'admin', department: 'hr', nature: 'debit', parent: '642' },
  { code: '6428', name: 'Chi phí quản lý khác', type: '6', group: 'admin', department: 'hr', nature: 'debit', parent: '642' },

  // ============================================================
  // LOẠI 7 - THU NHẬP KHÁC
  // ============================================================
  { code: '711', name: 'Thu nhập khác', type: '7', group: 'other_income', department: 'finance', nature: 'credit', parent: null },

  // ============================================================
  // LOẠI 8 - CHI PHÍ KHÁC
  // ============================================================
  { code: '811', name: 'Chi phí khác', type: '8', group: 'other_expense', department: 'finance', nature: 'debit', parent: null },
  { code: '821', name: 'Chi phí thuế thu nhập doanh nghiệp', type: '8', group: 'tax', department: 'finance', nature: 'debit', parent: null },
  { code: '8211', name: 'Chi phí thuế TNDN hiện hành', type: '8', group: 'tax', department: 'finance', nature: 'debit', parent: '821' },
  { code: '8212', name: 'Chi phí thuế TNDN hoãn lại', type: '8', group: 'tax', department: 'finance', nature: 'debit', parent: '821' },

  // ============================================================
  // LOẠI 9 - XÁC ĐỊNH KẾT QUẢ KINH DOANH
  // ============================================================
  { code: '911', name: 'Xác định kết quả kinh doanh', type: '9', group: 'closing', department: 'finance', nature: 'credit', parent: null },
  { code: '921', name: 'Lợi nhuận thuần từ hoạt động kinh doanh', type: '9', group: 'closing', department: 'finance', nature: 'credit', parent: null },
  { code: '931', name: 'Lợi nhuận thuần sau thuế', type: '9', group: 'closing', department: 'finance', nature: 'credit', parent: null }
];

// ============================================================
// NHÓM TÀI KHOẢN (Account Groups)
// ============================================================
export const ACCOUNT_GROUPS = {
  cash: 'Tiền và tương đương tiền',
  financial_assets: 'Tài sản tài chính',
  receivables: 'Phải thu',
  advances: 'Tạm ứng',
  inventory: 'Hàng tồn kho',
  wip: 'SXKD dở dang',
  prepaid: 'Chi phí trả trước',
  consignment: 'Hàng gửi bán',
  fixed_assets: 'Tài sản cố định',
  construction: 'XDCB dở dang',
  manufacturing: 'Chi phí sản xuất',
  tax: 'Thuế',
  payables: 'Phải trả',
  prepayments: 'Người mua trả trước',
  payroll: 'Lương và BHXH',
  accruals: 'Chi phí phải trả',
  intercompany: 'Nội bộ',
  other_payables: 'Phải trả khác',
  loans: 'Vay và nợ',
  bonds: 'Trái phiếu',
  welfare: 'Quỹ phúc lợi',
  equity: 'Nguồn vốn',
  fx: 'Chênh lệch tỷ giá',
  retained: 'Lợi nhuận giữ lại',
  revenue: 'Doanh thu',
  income: 'Thu nhập',
  deductions: 'Giảm trừ doanh thu',
  cogs: 'Giá vốn',
  selling: 'Chi phí bán hàng',
  marketing: 'Chi phí tiếp thị',
  admin: 'Chi phí quản lý',
  finance: 'Chi phí tài chính',
  other_income: 'Thu nhập khác',
  other_expense: 'Chi phí khác',
  closing: 'Kết chuyển',
  rnd: 'Nghiên cứu phát triển'
};

/**
 * Lấy danh sách tài khoản theo phòng ban
 */
export function getAccountsByDepartment(dept) {
  if (!dept) return ACCOUNTS_TT99;
  return ACCOUNTS_TT99.filter(a => a.department === dept);
}

/**
 * Lấy thông tin tài khoản theo mã
 */
export function getAccountByCode(code) {
  return ACCOUNTS_TT99.find(a => a.code === code);
}

/**
 * Lấy tài khoản theo loại (type 1-9)
 */
export function getAccountsByType(type) {
  return ACCOUNTS_TT99.filter(a => a.type === type);
}

/**
 * Lấy tài khoản theo nhóm
 */
export function getAccountsByGroup(group) {
  return ACCOUNTS_TT99.filter(a => a.group === group);
}

/**
 * Lấy tài khoản con của một tài khoản cha
 */
export function getChildAccounts(parentCode) {
  return ACCOUNTS_TT99.filter(a => a.parent === parentCode);
}

/**
 * Lấy tài khoản cấp 1 (không có parent)
 */
export function getTopLevelAccounts() {
  return ACCOUNTS_TT99.filter(a => !a.parent);
}

/**
 * Kiểm tra tài khoản có hợp lệ trong danh mục không
 */
export function isValidAccountCode(code) {
  return ACCOUNTS_TT99.some(a => a.code === code);
}