/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

// FILE_PATH: front-end/src/constants/modules.js
// Đăng ký tập trung toàn bộ Module hệ thống với phân quyền nghiêm ngặt

export const MODULES_REGISTER = [
  {
    id: 'dashboard',
    name: 'Bảng Điều Khiển Tổng Quan',
    path: '/dashboard',
    component: 'DashboardView',
    roles: ['admin', 'ktt', 'nv']
  },
  {
    id: 'vouchers',
    name: 'Quản Lý Chứng Từ Kế Toán',
    path: '/vouchers',
    component: 'VoucherManagement',
    roles: ['admin', 'ktt', 'nv']
  },
  {
    id: 'partners',
    name: 'Quản Lý Đối Tác',
    path: '/partners',
    component: 'PartnerManagement',
    roles: ['admin', 'ktt', 'nv']
  },
  {
    id: 'inventory',
    name: 'Quản Lý Kho & Vật Tư',
    path: '/inventory',
    component: 'InventoryManagement',
    roles: ['admin', 'ktt', 'nv']
  },
  {
    id: 'opening-balances',
    name: 'Số Dư Đầu Kỳ',
    path: '/opening-balances',
    component: 'OpeningBalanceManagement',
    roles: ['admin', 'ktt']
  },
  {
    id: 'closing',
    name: 'Khóa Sổ & Cân Đối',
    path: '/closing',
    component: 'ClosingProcess',
    roles: ['admin', 'ktt']
  },
  {
    id: 'reports',
    name: 'Báo Cáo Tài Chính',
    path: '/reports',
    component: 'FinancialReports',
    roles: ['admin', 'ktt']
  },
  {
    id: 'users',
    name: 'Quản Lý Người Dùng',
    path: '/users',
    component: 'UserManagement',
    roles: ['admin']
  },
  {
    id: 'companies',
    name: 'Quản Lý Doanh Nghiệp',
    path: '/companies',
    component: 'CompanyManagement',
    roles: ['admin']
  },
  // ĐĂNG KÝ MODULE AUDIT LOGS MỚI NÂNG CẤP
  {
    id: 'audit_logs',
    name: 'Nhật Ký An Ninh & Hệ Thống',
    path: '/audit-logs',
    component: 'AuditLogsManagement', 
    roles: ['admin'], // BẢO MẬT: Chỉ tài khoản Admin tối cao mới có quyền truy cập xem vết biến động dữ liệu
    icon: 'ShieldAlert'
  }
];

/**
 * Kiểm tra quyền truy cập module dựa trên vai trò người dùng
 * @param {string} modulePath - Đường dẫn module (ví dụ: '/audit-logs')
 * @param {string} userRole - Vai trò người dùng (admin, ktt, nv)
 * @returns {boolean} - true nếu có quyền truy cập
 */
export const hasModuleAccess = (modulePath, userRole) => {
  const module = MODULES_REGISTER.find(m => m.path === modulePath);
  if (!module) return false;
  return module.roles.includes(userRole);
};

/**
 * Lấy danh sách module được phép truy cập theo vai trò
 * @param {string} userRole - Vai trò người dùng
 * @returns {Array} - Danh sách module được phép truy cập
 */
export const getAccessibleModules = (userRole) => {
  return MODULES_REGISTER.filter(module => module.roles.includes(userRole));
};