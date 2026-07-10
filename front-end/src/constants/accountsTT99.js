/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * Chart of Accounts theo Thông tư 99/2025/TT-BTC
 */

export const ACCOUNTS_TT99 = [
  // Loại 1 - Tài sản (18 mã)
  { code: '111', name: 'Tiền mặt', type: '1', group: 'cash', department: 'finance', nature: 'debit' },
  { code: '112', name: 'Tiền gửi không kỳ hạn', type: '1', group: 'cash', department: 'finance', nature: 'debit' },
  { code: '121', name: 'Chứng khoán kinh doanh', type: '1', group: 'financial_assets', department: 'finance', nature: 'debit' },
  { code: '128', name: 'Tiền gửi có kỳ hạn và cho vay', type: '1', group: 'financial_assets', department: 'finance', nature: 'debit' },
  { code: '131', name: 'Phải thu của khách hàng', type: '1', group: 'receivables', department: 'sales', nature: 'debit' },
  { code: '133', name: 'Thuế GTGT được khấu trừ', type: '1', group: 'receivables', department: 'finance', nature: 'debit' },
  { code: '136', name: 'Phải thu nội bộ', type: '1', group: 'receivables', department: 'finance', nature: 'debit' },
  { code: '138', name: 'Phải thu khác', type: '1', group: 'receivables', department: 'finance', nature: 'debit' },
  { code: '141', name: 'Tạm ứng', type: '1', group: 'advances', department: 'finance', nature: 'debit' },
  { code: '151', name: 'Hàng tồn kho', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit' },
  { code: '152', name: 'Nguyên liệu, vật liệu', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit' },
  { code: '153', name: 'Công cụ, sản phẩm dở dang', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit' },
  { code: '155', name: 'Thành phẩm', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit' },
  { code: '156', name: 'Hàng hóa', type: '1', group: 'inventory', department: 'warehouse', nature: 'debit' },
  { code: '157', name: 'Chi phí sản xuất kinh doanh dở dang', type: '1', group: 'wip', department: 'warehouse', nature: 'debit' },
  { code: '161', name: 'Chi phí sản xuất kinh doanh phải nộp', type: '1', group: 'costs', department: 'finance', nature: 'debit' },
  { code: '171', name: 'Giá trị hàng gửi đi bán', type: '1', group: 'consignment', department: 'sales', nature: 'debit' },
  { code: '211', name: 'Tài sản cố định hữu hình', type: '1', group: 'fixed_assets', department: 'admin', nature: 'debit' },

  // Loại 2 - Chi phí (8 mã)
  { code: '241', name: 'Chi phí sản xuất chung', type: '2', group: 'manufacturing', department: 'warehouse', nature: 'debit' },
  { code: '242', name: 'Chi phí chờ phân bổ', type: '2', group: 'prepaid', department: 'finance', nature: 'debit' },
  { code: '243', name: 'Chi phí trả trước ngắn hạn', type: '2', group: 'prepaid', department: 'finance', nature: 'debit' },
  { code: '244', name: 'Chi phí trả trước dài hạn', type: '2', group: 'prepaid', department: 'finance', nature: 'debit' },
  { code: '251', name: 'Chi phí xây dựng cơ bản dở dang', type: '2', group: 'construction', department: 'admin', nature: 'debit' },
  { code: '252', name: 'Chi phí sản xuất kinh doanh dở dang', type: '2', group: 'wip', department: 'warehouse', nature: 'debit' },
  { code: '253', name: 'Chi phí mua sắm TSCĐ dở dang', type: '2', group: 'fixed_assets', department: 'admin', nature: 'debit' },
  { code: '254', name: 'Chi phí nghiên cứu phát triển dở dang', type: '2', group: 'rnd', department: 'admin', nature: 'debit' },

  // Loại 3 - Nợ phải trả (12 mã)
  { code: '331', name: 'Phải trả người bán', type: '3', group: 'payables', department: 'finance', nature: 'credit' },
  { code: '332', name: 'Người mua trả trước', type: '3', group: 'prepayments', department: 'sales', nature: 'credit' },
  { code: '333', name: 'Thuế và các khoản phải nộp', type: '3', group: 'tax', department: 'finance', nature: 'credit' },
  { code: '3331', name: 'Thuế GTGT phải nộp', type: '3', group: 'tax', department: 'finance', nature: 'credit' },
  { code: '3332', name: 'Thuế TNDN phải nộp', type: '3', group: 'tax', department: 'finance', nature: 'credit' },
  { code: '334', name: 'Phải trả người lao động', type: '3', group: 'payroll', department: 'hr', nature: 'credit' },
  { code: '335', name: 'Chi phí phải trả', type: '3', group: 'accruals', department: 'finance', nature: 'credit' },
  { code: '336', name: 'Phải trả nội bộ', type: '3', group: 'intercompany', department: 'finance', nature: 'credit' },
  { code: '337', name: 'Quỹ phúc lợi', type: '3', group: 'welfare', department: 'hr', nature: 'credit' },
  { code: '338', name: 'Phải trả, phải nộp khác', type: '3', group: 'other_payables', department: 'finance', nature: 'credit' },
  { code: '341', name: 'Vay và nợ thuê tài chính', type: '3', group: 'loans', department: 'admin', nature: 'credit' },
  { code: '342', name: 'Vay và nợ thuê tài chính dài hạn', type: '3', group: 'loans', department: 'admin', nature: 'credit' },
  { code: '343', name: 'Trái phiếu phát hành', type: '3', group: 'bonds', department: 'admin', nature: 'credit' },
  { code: '346', name: 'Phải trả về tài sản', type: '3', group: 'assets', department: 'admin', nature: 'credit' },

  // Loại 4 - Vốn chủ sở hữu (4 mã)
  { code: '411', name: 'Vốn góp của chủ sở hữu', type: '4', group: 'equity', department: 'admin', nature: 'credit' },
  { code: '412', name: 'Vốn khác của chủ sở hữu', type: '4', group: 'equity', department: 'admin', nature: 'credit' },
  { code: '413', name: 'Chênh lệch tỷ giá', type: '4', group: 'fx', department: 'finance', nature: 'credit' },
  { code: '421', name: 'Lợi nhuận sau thuế chưa phân phối', type: '4', group: 'retained', department: 'admin', nature: 'credit' },

  // Loại 5 - Doanh thu (7 mã)
  { code: '511', name: 'Doanh thu bán hàng và cung cấp dịch vụ', type: '5', group: 'revenue', department: 'sales', nature: 'credit' },
  { code: '512', name: 'Doanh thu bán hàng nội bộ', type: '5', group: 'revenue', department: 'sales', nature: 'credit' },
  { code: '515', name: 'Doanh thu hoạt động tài chính', type: '5', group: 'income', department: 'finance', nature: 'credit' },
  { code: '521', name: 'Các khoản giảm trừ doanh thu', type: '5', group: 'deductions', department: 'sales', nature: 'debit' },
  { code: '523', name: 'Chiết khấu thương mại', type: '5', group: 'deductions', department: 'sales', nature: 'debit' },
  { code: '531', name: 'Giá trị hàng gửi đi bán', type: '5', group: 'consignment', department: 'sales', nature: 'credit' },
  { code: '532', name: 'Phí dịch vụ', type: '5', group: 'income', department: 'sales', nature: 'credit' },

  // Loại 6 - Chi phí (15 mã)
  { code: '611', name: 'Giá vốn hàng bán', type: '6', group: 'cogs', department: 'warehouse', nature: 'debit' },
  { code: '612', name: 'Giá vốn hàng bán nội bộ', type: '6', group: 'cogs', department: 'warehouse', nature: 'debit' },
  { code: '621', name: 'Chi phí quảng cáo', type: '6', group: 'marketing', department: 'sales', nature: 'debit' },
  { code: '622', name: 'Chi phí khuyến mãi', type: '6', group: 'marketing', department: 'sales', nature: 'debit' },
  { code: '623', name: 'Chi phí vận chuyển', type: '6', group: 'logistics', department: 'warehouse', nature: 'debit' },
  { code: '630', name: 'Chi phí bán hàng', type: '6', group: 'selling', department: 'sales', nature: 'debit' },
  { code: '631', name: 'Chi phí bán hàng chi tiết', type: '6', group: 'selling', department: 'sales', nature: 'debit' },
  { code: '632', name: 'Giá vốn hàng bán', type: '6', group: 'cogs', department: 'warehouse', nature: 'debit' },
  { code: '633', name: 'Chi phí quản lý doanh nghiệp', type: '6', group: 'admin', department: 'hr', nature: 'debit' },
  { code: '634', name: 'Chi phí tài chính', type: '6', group: 'finance', department: 'finance', nature: 'debit' },
  { code: '635', name: 'Chi phí bán hàng khác', type: '6', group: 'selling', department: 'sales', nature: 'debit' },
  { code: '636', name: 'Chi phí quản lý khác', type: '6', group: 'admin', department: 'hr', nature: 'debit' },
  { code: '637', name: 'Chi phí thuế', type: '6', group: 'tax', department: 'finance', nature: 'debit' },
  { code: '638', name: 'Chi phí phát triển', type: '6', group: 'rnd', department: 'admin', nature: 'debit' },
  { code: '642', name: 'Chi phí quản lý doanh nghiệp', type: '6', group: 'admin', department: 'hr', nature: 'debit' },
  { code: '641', name: 'Chi phí bán hàng', type: '6', group: 'selling', department: 'sales', nature: 'debit' },
  { code: '6411', name: 'Lương nhân viên sales', type: '6', group: 'selling', department: 'sales', nature: 'debit' },
  { code: '6417', name: 'Chi phí quảng cáo marketing', type: '6', group: 'marketing', department: 'sales', nature: 'debit' },
  { code: '6421', name: 'Lương và bảo hiểm nhân viên văn phòng', type: '6', group: 'admin', department: 'hr', nature: 'debit' },
  { code: '6428', name: 'Chi phí tuyển dụng, team building', type: '6', group: 'admin', department: 'hr', nature: 'debit' },

  // Loại 7 - Chi phí khác (2 mã)
  { code: '711', name: 'Thu nhập khác', type: '7', group: 'other_income', department: 'finance', nature: 'credit' },
  { code: '712', name: 'Chi phí khác', type: '7', group: 'other_expense', department: 'finance', nature: 'debit' },

  // Loại 8 - Xác định KQKD (2 mã)
  { code: '811', name: 'Chi phí thuế thu nhập doanh nghiệp', type: '8', group: 'tax', department: 'finance', nature: 'debit' },
  { code: '821', name: 'Chi phí thuế thu nhập cá nhân', type: '8', group: 'tax', department: 'hr', nature: 'debit' },

  // Loại 9 - Xác định KQKD (3 mã)
  { code: '911', name: 'Xác định kết quả kinh doanh', type: '9', group: 'closing', department: 'finance', nature: 'credit' },
  { code: '921', name: 'Lợi nhuận thuần từ HĐKD', type: '9', group: 'closing', department: 'finance', nature: 'credit' },
  { code: '931', name: 'Lợi nhuận thuần sau thuế', type: '9', group: 'closing', department: 'finance', nature: 'credit' }
];

export const ACCOUNT_GROUPS = {
  cash: 'Tiền và tương đương tiền',
  financial_assets: 'Tài sản tài chính',
  receivables: 'Phải thu',
  inventory: 'Hàng tồn kho',
  fixed_assets: 'TSCĐ',
  prepaid: 'Chi phí trả trước',
  payroll: 'Lương & BHXH',
  tax: 'Thuế',
  revenue: 'Doanh thu',
  cogs: 'Giá vốn',
  selling: 'Chi phí bán hàng',
  admin: 'Chi phí quản lý',
  finance: 'Chi phí tài chính',
  closing: 'Kết chuyển'
};

export function getAccountsByDepartment(dept) {
  if (!dept) return ACCOUNTS_TT99;
  return ACCOUNTS_TT99.filter(a => a.department === dept);
}

export function getAccountByCode(code) {
  return ACCOUNTS_TT99.find(a => a.code === code);
}

export function getAccountsByType(type) {
  return ACCOUNTS_TT99.filter(a => a.type === type);
}

export function getAccountsByGroup(group) {
  return ACCOUNTS_TT99.filter(a => a.group === group);
}