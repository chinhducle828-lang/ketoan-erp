import React from 'react';
import {
  Wallet, 
  Calculator, 
  BookOpenCheck, 
  Settings, 
  ShoppingBag, 
  ShoppingCart,
  Users, 
  Percent, 
  Coins, 
  Layers, 
  BarChart3,
  ShieldAlert,
  TrendingUp,
  FileText,
  ClipboardList,
  Warehouse,
  Truck,
  Boxes
} from 'lucide-react';

export const MODULES_REGISTER = [
  {
    id: 'opening',
    name: 'Khai báo số dư đầu kỳ',
    icon: Coins,
    component: React.lazy(() => import('./closing/OpeningBalances.jsx')),
    allowedRoles: ['admin', 'ktt', 'gd_kinhdoanh'],
    requiresActiveCompany: true
  },
  {
    id: 'cash',
    name: 'Quỹ & Tiền gửi ngân hàng',
    icon: Wallet,
    component: React.lazy(() => import('./cash/CashManagement.jsx')),
    allowedRoles: ['admin', 'ktt', 'nv'],
    requiresActiveCompany: true
  },
  {
    id: 'purchasing',
    name: 'Mua hàng & Vật tư nhập kho',
    icon: ShoppingBag,
    component: React.lazy(() => import('./purchasing/PurchaseInventory.jsx')),
    allowedRoles: ['admin', 'ktt', 'nv'],
    requiresActiveCompany: true
  },
  {
    id: 'pos',
    name: 'Bán hàng tại quầy',
    icon: ShoppingCart,
    component: React.lazy(() => import('./auth/StorefrontAccessNotice.jsx')),
    allowedRoles: ['admin'], // Non-accounting module, chỉ admin mới được xem trong ERP
    requiresActiveCompany: true
  },
  {
    id: 'partners', // 👈 1. Đăng ký ID duy nhất đại diện cho URL: /partners
    name: 'Danh mục Đối tác (KH & NCC)',
    icon: Users,    // 👈 2. Tái sử dụng icon nhóm người dùng thích hợp cho đối tác
    component: React.lazy(() => import('./sales/PartnerManagement.jsx')), // 👈 3. Lazy load chuẩn chỉ
    allowedRoles: ['admin', 'ktt', 'nv'], // Cho phép cả ban quản trị, kế toán trưởng và nhân viên nội bộ ERP
    requiresActiveCompany: true // Bắt buộc phải có một công ty đang active mới cho dùng dữ liệu
  },
  {
    id: 'sales_excel',
    name: 'Hóa đơn bán hàng Excel',
    icon: Layers,
    component: React.lazy(() => import('./sales/AutoSalesExcel.jsx')),
    allowedRoles: ['admin'], // Non-accounting module, chỉ admin mới được xem
    requiresActiveCompany: true
  },
  {
    id: 'assets',
    name: 'Tài sản cố định & Khấu hao',
    icon: Calculator,
    component: React.lazy(() => import('./assets/FixedAssets.jsx')),
    allowedRoles: ['admin', 'ktt', 'nv'],
    requiresActiveCompany: true
  },
  {
    id: 'hr',
    name: 'Tính lương & Trích BHXH',
    icon: Users,
    component: React.lazy(() => import('./hr/Payroll.jsx')),
    allowedRoles: ['admin', 'ktt', 'nv'],
    requiresActiveCompany: true
  },
  {
    id: 'costs',
    name: 'Tập hợp chi phí Giá thành',
    icon: BookOpenCheck,
    component: React.lazy(() => import('./costs/WorkInProcess.jsx')),
    allowedRoles: ['admin', 'ktt', 'gd_kinhdoanh'],
    requiresActiveCompany: true
  },
  {
    id: 'tax',
    name: 'Tờ khai báo cáo Thuế GTGT',
    icon: Percent,
    component: React.lazy(() => import('./tax/TaxReporting.jsx')),
    allowedRoles: ['admin', 'ktt', 'gd_kinhdoanh'],
    requiresActiveCompany: true
  },
  {
    id: 'closing_process',
    name: 'Kết chuyển khóa sổ cuối kỳ',
    icon: BookOpenCheck,
    component: React.lazy(() => import('./closing/ClosingProcess.jsx')),
    allowedRoles: ['admin', 'ktt', 'gd_kinhdoanh'],
    requiresActiveCompany: true
  },
  {
    id: 'companies',
    name: 'Cấu hình hệ thống pháp nhân',
    icon: Settings,
    component: React.lazy(() => import('./admin/CompanyManagement.jsx')),
    allowedRoles: ['admin'],
    requiresActiveCompany: false
  },
  {
    id: 'dashboard',
    name: 'Dashboard dòng tiền',
    icon: BarChart3,
    component: React.lazy(() => import('./dashboard/CashFlowDashboard.jsx')),
    allowedRoles: ['admin', 'ktt', 'nv'],
    requiresActiveCompany: true
  },
  {
    id: 'vouchers',
    name: 'Quản Lý Chứng Từ Tổng Hợp',
    icon: ClipboardList,
    component: React.lazy(() => import('./vouchers/VoucherManagement.jsx')),
    allowedRoles: ['admin', 'ktt', 'nv'],
    requiresActiveCompany: true
  },
  {
    id: 'inventory',
    name: 'Quản Lý Kho Tổng Hợp',
    icon: Warehouse,
    component: React.lazy(() => import('./inventory/InventoryManagement.jsx')),
    allowedRoles: ['admin', 'ktt', 'nv'],
    requiresActiveCompany: true
  },
  {
    id: 'logistics-dashboard',
    name: 'Logistics / Giao Hàng',
    icon: Truck,
    component: React.lazy(() => import('./logistics/LogisticsDashboard.jsx')),
    allowedRoles: ['admin'], // Non-accounting logistics module, chỉ admin được xem
    requiresActiveCompany: true
  },
  {
    id: 'bai-xuc',
    name: 'Màn Hình Bãi Xúc',
    icon: Boxes,
    component: React.lazy(() => import('./logistics/LoadingDock.jsx')),
    allowedRoles: ['admin'], // Non-accounting logistics module, chỉ admin được xem
    requiresActiveCompany: true
  },
  {
    id: 'audit-logs',
    name: 'Nhật Ký An Ninh & Hệ Thống',
    icon: ShieldAlert,
    component: React.lazy(() => import('./admin/AuditLogs.jsx')),
    allowedRoles: ['admin'],
    requiresActiveCompany: false
  },
  {
    id: 'income-statement',
    name: 'Báo Cáo Kết Quả Hoạt Động Kinh Doanh',
    icon: TrendingUp,
    component: React.lazy(() => import('./financial/IncomeStatement.jsx')),
    allowedRoles: ['admin', 'ktt', 'gd_kinhdoanh'],
    requiresActiveCompany: true
  },
  {
    id: 'balance-sheet',
    name: 'Báo Cáo Tài Chính B01-DN',
    icon: FileText,
    component: React.lazy(() => import('./financial/BalanceSheetB01.jsx')),
    allowedRoles: ['admin', 'ktt', 'gd_kinhdoanh'],
    requiresActiveCompany: true
  },
  {
    id: 'income-statement-b02',
    name: 'Báo Cáo Kết Quả Kinh Doanh B02-DN',
    icon: TrendingUp,
    component: React.lazy(() => import('./financial/IncomeStatementB02.jsx')),
    allowedRoles: ['admin', 'ktt', 'gd_kinhdoanh'],
    requiresActiveCompany: true
  },
  {
    id: 'cash-flow',
    name: 'Báo Cáo Lưu Chuyển Tiền Tệ B03-DN',
    icon: BarChart3,
    component: React.lazy(() => import('./reports/FinancialReportsView.jsx')),
    allowedRoles: ['admin', 'ktt', 'gd_kinhdoanh'],
    requiresActiveCompany: true
  },
  {
    id: 'financial-notes',
    name: 'Bản Thuyết Minh BCTC B09-DN',
    icon: FileText,
    component: React.lazy(() => import('./reports/FinancialReportsView.jsx')),
    allowedRoles: ['admin', 'ktt', 'gd_kinhdoanh'],
    requiresActiveCompany: true
  }
];
