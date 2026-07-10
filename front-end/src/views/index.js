/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

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
  BellRing,
  TrendingUp,
  FileText,
  ClipboardList,
  Warehouse,
  Truck,
  Boxes,
  Brain
} from 'lucide-react';

export { ACCOUNTS_TT99, ACCOUNT_GROUPS, getAccountsByDepartment, getAccountByCode, getAccountsByType, getAccountsByGroup } from '../constants/accountsTT99.js';
export { WORKFLOW_EVENTS, WORKFLOW_MATRIX, createWorkflowHandlers, getAccountsForEvent, getDepartmentsForEvent } from '../workflow/accountingWorkflow.js';

export const DEPARTMENTS = {
  finance: {
    id: 'finance',
    name: 'Phòng Tài chính - Kế toán',
    icon: Calculator,
    order: 0
  },
  sales: {
    id: 'sales',
    name: 'Phòng Bán hàng',
    icon: ShoppingCart,
    order: 1
  },
  warehouse: {
    id: 'warehouse',
    name: 'Phòng Kho vận',
    icon: Warehouse,
    order: 2
  },
  hr: {
    id: 'hr',
    name: 'Phòng Nhân sự',
    icon: Users,
    order: 3
  },
  admin: {
    id: 'admin',
    name: 'Phòng Quản trị',
    icon: Settings,
    order: 4
  }
};

export const MODULES_REGISTER = [
  {
    id: 'opening',
    name: 'Khai báo số dư đầu kỳ',
    icon: Coins,
    component: React.lazy(() => import('./closing/OpeningBalances.jsx')),
    allowedRoles: ['admin', 'ktt', 'gd_kinhdoanh'],
    requiresActiveCompany: true,
    department: 'finance'
  },
  {
    id: 'cash',
    name: 'Quỹ & Tiền gửi ngân hàng',
    icon: Wallet,
    component: React.lazy(() => import('./cash/CashManagement.jsx')),
    allowedRoles: ['admin', 'ktt', 'nv'],
    requiresActiveCompany: true,
    department: 'finance'
  },
  {
    id: 'purchasing',
    name: 'Mua hàng & Vật tư nhập kho',
    icon: ShoppingBag,
    component: React.lazy(() => import('./purchasing/PurchaseInventory.jsx')),
    allowedRoles: ['admin', 'ktt', 'nv'],
    requiresActiveCompany: true,
    department: 'finance'
  },
  {
    id: 'pos',
    name: 'Bán hàng tại quầy',
    icon: ShoppingCart,
    component: React.lazy(() => import('./auth/StorefrontAccessNotice.jsx')),
    allowedRoles: ['admin'],
    requiresActiveCompany: true,
    department: 'sales'
  },
  {
    id: 'partners',
    name: 'Danh mục Đối tác (KH & NCC)',
    icon: Users,
    component: React.lazy(() => import('./sales/PartnerManagement.jsx')),
    allowedRoles: ['admin', 'ktt', 'nv'],
    requiresActiveCompany: true,
    department: 'sales'
  },
  {
    id: 'sales_excel',
    name: 'Hóa đơn bán hàng Excel',
    icon: Layers,
    component: React.lazy(() => import('./sales/AutoSalesExcel.jsx')),
    allowedRoles: ['admin'],
    requiresActiveCompany: true,
    department: 'sales'
  },
  {
    id: 'assets',
    name: 'Tài sản cố định & Khấu hao',
    icon: Calculator,
    component: React.lazy(() => import('./assets/FixedAssets.jsx')),
    allowedRoles: ['admin', 'ktt', 'nv'],
    requiresActiveCompany: true,
    department: 'finance'
  },
  {
    id: 'hr',
    name: 'Tính lương & Trích BHXH',
    icon: Users,
    component: React.lazy(() => import('./hr/Payroll.jsx')),
    allowedRoles: ['admin', 'ktt', 'nv'],
    requiresActiveCompany: true,
    department: 'hr'
  },
  {
    id: 'costs',
    name: 'Tập hợp chi phí Giá thành',
    icon: BookOpenCheck,
    component: React.lazy(() => import('./costs/WorkInProcess.jsx')),
    allowedRoles: ['admin', 'ktt', 'gd_kinhdoanh'],
    requiresActiveCompany: true,
    department: 'finance'
  },
  {
    id: 'tax',
    name: 'Tờ khai báo cáo Thuế GTGT',
    icon: Percent,
    component: React.lazy(() => import('./tax/TaxReporting.jsx')),
    allowedRoles: ['admin', 'ktt', 'gd_kinhdoanh'],
    requiresActiveCompany: true,
    department: 'finance'
  },
  {
    id: 'closing_process',
    name: 'Kết chuyển khóa sổ cuối kỳ',
    icon: BookOpenCheck,
    component: React.lazy(() => import('./closing/ClosingProcess.jsx')),
    allowedRoles: ['admin', 'ktt', 'gd_kinhdoanh'],
    requiresActiveCompany: true,
    department: 'finance'
  },
  {
    id: 'companies',
    name: 'Cấu hình hệ thống pháp nhân',
    icon: Settings,
    component: React.lazy(() => import('./admin/CompanyManagement.jsx')),
    allowedRoles: ['admin'],
    requiresActiveCompany: false,
    department: 'admin'
  },
  {
    id: 'dashboard',
    name: 'Dashboard dòng tiền',
    icon: BarChart3,
    component: React.lazy(() => import('./dashboard/CashFlowDashboard.jsx')),
    allowedRoles: ['admin', 'ktt', 'nv'],
    requiresActiveCompany: true,
    department: 'finance'
  },
  {
    id: 'vouchers',
    name: 'Quản Lý Chứng Từ Tổng Hợp',
    icon: ClipboardList,
    component: React.lazy(() => import('./vouchers/VoucherManagement.jsx')),
    allowedRoles: ['admin', 'ktt', 'nv'],
    requiresActiveCompany: true,
    department: 'finance'
  },
  {
    id: 'inventory',
    name: 'Quản Lý Kho Tổng Hợp',
    icon: Warehouse,
    component: React.lazy(() => import('./inventory/InventoryManagement.jsx')),
    allowedRoles: ['admin', 'ktt', 'nv'],
    requiresActiveCompany: true,
    department: 'warehouse'
  },
  {
    id: 'logistics-dashboard',
    name: 'Logistics / Giao Hàng',
    icon: Truck,
    component: React.lazy(() => import('./logistics/LogisticsDashboard.jsx')),
    allowedRoles: ['admin'],
    requiresActiveCompany: true,
    department: 'warehouse'
  },
  {
    id: 'bai-xuc',
    name: 'Màn Hình Bãi Xúc',
    icon: Boxes,
    component: React.lazy(() => import('./logistics/LoadingDock.jsx')),
    allowedRoles: ['admin'],
    requiresActiveCompany: true,
    department: 'warehouse'
  },
  {
    id: 'audit-logs',
    name: 'Nhật Ký An Ninh & Hệ Thống',
    icon: ShieldAlert,
    component: React.lazy(() => import('./admin/AuditLogs.jsx')),
    allowedRoles: ['admin'],
    requiresActiveCompany: false,
    department: 'admin'
  },
  {
    id: 'settings/notifications',
    name: 'Cài Đặt Thông Báo Đẩy',
    icon: BellRing,
    component: React.lazy(() => import('./settings/NotificationSettings.jsx')),
    allowedRoles: ['admin', 'ktt', 'nv', 'gd_kinhdoanh'],
    requiresActiveCompany: false,
    department: 'admin'
  },
  {
    id: 'admin/ai-config',
    name: 'AI Configuration',
    icon: Settings,
    component: React.lazy(() => import('./admin/AIConfigManagement.jsx')),
    allowedRoles: ['admin'],
    requiresActiveCompany: false,
    department: 'admin'
  },
  {
    id: 'ai-copilot',
    name: 'AI Copilot - Hỏi Đáp Tài Chính',
    icon: Brain,
    component: React.lazy(() => import('./dashboard/AIFinancialCopilot.jsx')),
    allowedRoles: ['admin', 'ktt', 'gd_kinhdoanh'],
    requiresActiveCompany: true,
    department: 'finance'
  },
  {
    id: 'income-statement',
    name: 'Báo Cáo Kết Quả Hoạt Động Kinh Doanh',
    icon: TrendingUp,
    component: React.lazy(() => import('./financial/IncomeStatement.jsx')),
    allowedRoles: ['admin', 'ktt', 'gd_kinhdoanh'],
    requiresActiveCompany: true,
    department: 'finance'
  },
  {
    id: 'balance-sheet',
    name: 'Báo Cáo Tài Chính B01-DN',
    icon: FileText,
    component: React.lazy(() => import('./financial/BalanceSheetB01.jsx')),
    allowedRoles: ['admin', 'ktt', 'gd_kinhdoanh'],
    requiresActiveCompany: true,
    department: 'finance'
  },
  {
    id: 'income-statement-b02',
    name: 'Báo Cáo Kết Quả Kinh Doanh B02-DN',
    icon: TrendingUp,
    component: React.lazy(() => import('./financial/IncomeStatementB02.jsx')),
    allowedRoles: ['admin', 'ktt', 'gd_kinhdoanh'],
    requiresActiveCompany: true,
    department: 'finance'
  },
  {
    id: 'cash-flow',
    name: 'Báo Cáo Lưu Chuyển Tiền Tệ B03-DN',
    icon: BarChart3,
    component: React.lazy(() => import('./reports/FinancialReportsView.jsx')),
    allowedRoles: ['admin', 'ktt', 'gd_kinhdoanh'],
    requiresActiveCompany: true,
    department: 'finance'
  },
  {
    id: 'financial-notes',
    name: 'Bản Thuyết Minh BCTC B09-DN',
    icon: FileText,
    component: React.lazy(() => import('./reports/FinancialReportsView.jsx')),
    allowedRoles: ['admin', 'ktt', 'gd_kinhdoanh'],
    requiresActiveCompany: true,
    department: 'finance'
  }
];