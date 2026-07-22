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
  Brain,
  Layout,
  Activity,
  GitBranch
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
  // ===== PHÒNG TÀI CHÍNH - KẾ TOÁN =====
  // 1. Dashboard - Tổng quan
  {
    id: 'dashboard',
    name: 'Dashboard dòng tiền',
    icon: BarChart3,
    component: React.lazy(() => import('./dashboard/CashFlowDashboard.jsx')),
    accessControl: {
      roles: ['admin', 'ktt', 'nv'],
      departments: ['finance']
    },
    requiresActiveCompany: true,
    department: 'finance',
    order: 1,
    dependencies: ['vouchers', 'opening'],
    featureFlags: []
  },
  // 2. Số dư đầu kỳ
  {
    id: 'opening',
    name: 'Khai báo số dư đầu kỳ',
    icon: Coins,
    component: React.lazy(() => import('./closing/OpeningBalances.jsx')),
    accessControl: {
      roles: ['admin', 'ktt', 'gd_kinhdoanh'],
      departments: ['finance']
    },
    requiresActiveCompany: true,
    department: 'finance',
    order: 2,
    dependencies: [],
    featureFlags: []
  },
  // 3. Chứng từ kế toán (lõi)
  {
    id: 'vouchers',
    name: 'Quản Lý Chứng Từ Tổng Hợp',
    icon: ClipboardList,
    component: React.lazy(() => import('./vouchers/VoucherManagement.jsx')),
    accessControl: {
      roles: ['admin', 'ktt', 'nv'],
      departments: ['finance']
    },
    requiresActiveCompany: true,
    department: 'finance',
    order: 3,
    dependencies: [],
    featureFlags: []
  },
  // 4. Quỹ & Tiền gửi
  {
    id: 'cash',
    name: 'Quỹ & Tiền gửi ngân hàng',
    icon: Wallet,
    component: React.lazy(() => import('./cash/CashManagement.jsx')),
    accessControl: {
      roles: ['admin', 'ktt', 'nv'],
      departments: ['finance']
    },
    requiresActiveCompany: true,
    department: 'finance',
    order: 4,
    dependencies: [],
    featureFlags: []
  },
  // 5. Mua hàng
  {
    id: 'purchasing',
    name: 'Mua hàng & Vật tư nhập kho',
    icon: ShoppingBag,
    component: React.lazy(() => import('./purchasing/PurchaseInventory.jsx')),
    accessControl: {
      roles: ['admin', 'ktt', 'nv'],
      departments: ['finance', 'warehouse']
    },
    requiresActiveCompany: true,
    department: 'finance',
    order: 5,
    dependencies: ['partners'],
    featureFlags: []
  },
  // 6. Tài sản cố định
  {
    id: 'assets',
    name: 'Tài sản cố định & Khấu hao',
    icon: Calculator,
    component: React.lazy(() => import('./assets/FixedAssets.jsx')),
    accessControl: {
      roles: ['admin', 'ktt', 'nv'],
      departments: ['finance']
    },
    requiresActiveCompany: true,
    department: 'finance',
    order: 6,
    dependencies: [],
    featureFlags: []
  },
  // 7. Chi phí - Giá thành
  {
    id: 'costs',
    name: 'Tập hợp chi phí Giá thành',
    icon: BookOpenCheck,
    component: React.lazy(() => import('./costs/WorkInProcess.jsx')),
    accessControl: {
      roles: ['admin', 'ktt', 'gd_kinhdoanh'],
      departments: ['finance']
    },
    requiresActiveCompany: true,
    department: 'finance',
    order: 7,
    dependencies: [],
    featureFlags: []
  },
  // 8. Thuế GTGT
  {
    id: 'tax',
    name: 'Tờ khai báo cáo Thuế GTGT',
    icon: Percent,
    component: React.lazy(() => import('./tax/TaxReporting.jsx')),
    accessControl: {
      roles: ['admin', 'ktt', 'gd_kinhdoanh'],
      departments: ['finance']
    },
    requiresActiveCompany: true,
    department: 'finance',
    order: 8,
    dependencies: [],
    featureFlags: ['non-deductible-expenses']
  },
  // 9. Cấn trừ công nợ
  {
    id: 'debt-reconciliation',
    name: 'Cấn Trừ Công Nợ',
    icon: Users,
    component: React.lazy(() => import('./finance/DebtReconciliation.jsx')),
    accessControl: {
      roles: ['admin', 'ktt'],
      departments: ['finance']
    },
    requiresActiveCompany: true,
    department: 'finance',
    order: 9,
    dependencies: ['partners'],
    featureFlags: []
  },
  // 10. Khóa sổ cuối kỳ
  {
    id: 'closing_process',
    name: 'Kết chuyển khóa sổ cuối kỳ',
    icon: BookOpenCheck,
    component: React.lazy(() => import('./closing/ClosingProcess.jsx')),
    accessControl: {
      roles: ['admin', 'ktt', 'gd_kinhdoanh'],
      departments: ['finance']
    },
    requiresActiveCompany: true,
    department: 'finance',
    order: 10,
    dependencies: ['vouchers', 'opening', 'tax'],
    featureFlags: ['reversing-entries']
  },
  // === BÁO CÁO TÀI CHÍNH ===
  // 11. Báo cáo KQHĐKD
  {
    id: 'income-statement',
    name: 'Báo Cáo Kết Quả Hoạt Động Kinh Doanh',
    icon: TrendingUp,
    component: React.lazy(() => import('./financial/IncomeStatement.jsx')),
    accessControl: {
      roles: ['admin', 'ktt', 'gd_kinhdoanh'],
      departments: ['finance']
    },
    requiresActiveCompany: true,
    department: 'finance',
    order: 11,
    dependencies: ['vouchers', 'opening'],
    featureFlags: ['advanced-reports']
  },
  // 12. BCTC B01-DN
  {
    id: 'balance-sheet',
    name: 'Báo Cáo Tài Chính B01-DN',
    icon: FileText,
    component: React.lazy(() => import('./financial/BalanceSheetB01.jsx')),
    accessControl: {
      roles: ['admin', 'ktt', 'gd_kinhdoanh'],
      departments: ['finance']
    },
    requiresActiveCompany: true,
    department: 'finance',
    order: 12,
    dependencies: ['vouchers', 'opening'],
    featureFlags: ['advanced-reports']
  },
  // 13. Báo cáo KQKD B02-DN
  {
    id: 'income-statement-b02',
    name: 'Báo Cáo Kết Quả Kinh Doanh B02-DN',
    icon: TrendingUp,
    component: React.lazy(() => import('./financial/IncomeStatementB02.jsx')),
    accessControl: {
      roles: ['admin', 'ktt', 'gd_kinhdoanh'],
      departments: ['finance']
    },
    requiresActiveCompany: true,
    department: 'finance',
    order: 13,
    dependencies: ['vouchers', 'opening'],
    featureFlags: ['advanced-reports']
  },
  // 14. Báo cáo lưu chuyển tiền tệ B03-DN
  {
    id: 'cash-flow',
    name: 'Báo Cáo Lưu Chuyển Tiền Tệ B03-DN',
    icon: BarChart3,
    component: React.lazy(() => import('./reports/FinancialReportsView.jsx')),
    accessControl: {
      roles: ['admin', 'ktt', 'gd_kinhdoanh'],
      departments: ['finance']
    },
    requiresActiveCompany: true,
    department: 'finance',
    order: 14,
    dependencies: ['vouchers', 'opening'],
    featureFlags: ['advanced-reports']
  },
  // 15. Bản thuyết minh BCTC B09-DN
  {
    id: 'financial-notes',
    name: 'Bản Thuyết Minh BCTC B09-DN',
    icon: FileText,
    component: React.lazy(() => import('./reports/FinancialReportsView.jsx')),
    accessControl: {
      roles: ['admin', 'ktt', 'gd_kinhdoanh'],
      departments: ['finance']
    },
    requiresActiveCompany: true,
    department: 'finance',
    order: 15,
    dependencies: ['vouchers', 'opening'],
    featureFlags: ['advanced-reports']
  },
  // === AI & DYNAMIC ===
  // 16. AI Copilot
  {
    id: 'ai-copilot',
    name: 'AI Copilot - Hỏi Đáp Tài Chính',
    icon: Brain,
    component: React.lazy(() => import('./dashboard/AIFinancialCopilot.jsx')),
    accessControl: {
      roles: ['admin', 'ktt', 'gd_kinhdoanh'],
      departments: ['finance']
    },
    requiresActiveCompany: true,
    department: 'finance',
    order: 16,
    dependencies: ['vouchers'],
    featureFlags: ['ai-copilot']
  },
  // 17. Dynamic Dashboard
  {
    id: 'dynamic-dashboard',
    name: 'Dynamic Dashboard',
    icon: BarChart3,
    component: React.lazy(() => import('../core/DynamicDashboard.jsx')),
    accessControl: {
      roles: ['admin', 'ktt', 'nv', 'gd_kinhdoanh'],
      departments: ['finance']
    },
    requiresActiveCompany: true,
    department: 'finance',
    order: 17,
    dependencies: [],
    featureFlags: ['dynamic-ui']
  },
  // 18. Dynamic Entity
  {
    id: 'dynamic',
    name: 'Dynamic Entity',
    icon: Layout,
    component: React.lazy(() => import('../core/DynamicEntity.jsx')),
    accessControl: {
      roles: ['admin', 'ktt', 'nv'],
      departments: ['finance']
    },
    requiresActiveCompany: true,
    department: 'finance',
    order: 18,
    dependencies: [],
    featureFlags: ['dynamic-ui']
  },

  // ===== PHÒNG BÁN HÀNG =====
  {
    id: 'pos',
    name: 'Bán hàng tại quầy',
    icon: ShoppingCart,
    component: React.lazy(() => import('./auth/StorefrontAccessNotice.jsx')),
    accessControl: {
      roles: ['admin'],
      departments: ['sales']
    },
    requiresActiveCompany: true,
    department: 'sales',
    order: 1,
    dependencies: [],
    featureFlags: []
  },
  {
    id: 'partners',
    name: 'Danh mục Đối tác (KH & NCC)',
    icon: Users,
    component: React.lazy(() => import('./sales/PartnerManagement.jsx')),
    accessControl: {
      roles: ['admin', 'ktt', 'nv'],
      departments: ['sales']
    },
    requiresActiveCompany: true,
    department: 'sales',
    order: 2,
    dependencies: [],
    featureFlags: []
  },
  {
    id: 'sales_excel',
    name: 'Hóa đơn bán hàng Excel',
    icon: Layers,
    component: React.lazy(() => import('./sales/AutoSalesExcel.jsx')),
    accessControl: {
      roles: ['admin'],
      departments: ['sales']
    },
    requiresActiveCompany: true,
    department: 'sales',
    order: 3,
    dependencies: ['partners'],
    featureFlags: []
  },

  // ===== PHÒNG KHO VẬN =====
  {
    id: 'inventory',
    name: 'Quản Lý Kho Tổng Hợp',
    icon: Warehouse,
    component: React.lazy(() => import('./inventory/InventoryManagement.jsx')),
    accessControl: {
      roles: ['admin', 'ktt', 'nv'],
      departments: ['warehouse']
    },
    requiresActiveCompany: true,
    department: 'warehouse',
    order: 1,
    dependencies: [],
    featureFlags: []
  },
  {
    id: 'stock-reconciliation',
    name: 'Kiểm Kê Kho',
    icon: ClipboardList,
    component: React.lazy(() => import('./inventory/StockReconciliation.jsx')),
    accessControl: {
      roles: ['admin', 'ktt'],
      departments: ['warehouse']
    },
    requiresActiveCompany: true,
    department: 'warehouse',
    order: 2,
    dependencies: ['inventory'],
    featureFlags: ['stock-reconciliation']
  },
  {
    id: 'logistics-dashboard',
    name: 'Logistics / Giao Hàng',
    icon: Truck,
    component: React.lazy(() => import('./logistics/LogisticsDashboard.jsx')),
    accessControl: {
      roles: ['admin'],
      departments: ['warehouse']
    },
    requiresActiveCompany: true,
    department: 'warehouse',
    order: 3,
    dependencies: ['inventory', 'partners'],
    featureFlags: []
  },
  {
    id: 'bai-xuc',
    name: 'Màn Hình Bãi Xúc',
    icon: Boxes,
    component: React.lazy(() => import('./logistics/LoadingDock.jsx')),
    accessControl: {
      roles: ['admin'],
      departments: ['warehouse']
    },
    requiresActiveCompany: true,
    department: 'warehouse',
    order: 4,
    dependencies: ['inventory', 'logistics-dashboard'],
    featureFlags: []
  },

  // ===== PHÒNG NHÂN SỰ =====
  {
    id: 'hr',
    name: 'Tính lương & Trích BHXH',
    icon: Users,
    component: React.lazy(() => import('./hr/Payroll.jsx')),
    accessControl: {
      roles: ['admin', 'ktt', 'nv'],
      departments: ['hr']
    },
    requiresActiveCompany: true,
    department: 'hr',
    order: 1,
    dependencies: [],
    featureFlags: []
  },

  // ===== PHÒNG QUẢN TRỊ =====
  {
    id: 'companies',
    name: 'Cấu hình hệ thống pháp nhân',
    icon: Settings,
    component: React.lazy(() => import('./admin/CompanyManagement.jsx')),
    accessControl: {
      roles: ['admin'],
      departments: ['admin']
    },
    requiresActiveCompany: false,
    department: 'admin',
    order: 1,
    dependencies: [],
    featureFlags: []
  },
  {
    id: 'audit-logs',
    name: 'Nhật Ký An Ninh & Hệ Thống',
    icon: ShieldAlert,
    component: React.lazy(() => import('./admin/AuditLogs.jsx')),
    accessControl: {
      roles: ['admin'],
      departments: ['admin']
    },
    requiresActiveCompany: false,
    department: 'admin',
    order: 2,
    dependencies: [],
    featureFlags: []
  },
  {
    id: 'settings/notifications',
    name: 'Cài Đặt Thông Báo Đẩy',
    icon: BellRing,
    component: React.lazy(() => import('./settings/NotificationSettings.jsx')),
    accessControl: {
      roles: ['admin', 'ktt', 'nv', 'gd_kinhdoanh'],
      departments: ['admin']
    },
    requiresActiveCompany: false,
    department: 'admin',
    order: 3,
    dependencies: [],
    featureFlags: ['push-notifications']
  },
  {
    id: 'admin/ai-config',
    name: 'AI Configuration',
    icon: Settings,
    component: React.lazy(() => import('./admin/AIConfigManagement.jsx')),
    accessControl: {
      roles: ['admin'],
      departments: ['admin']
    },
    requiresActiveCompany: false,
    department: 'admin',
    order: 4,
    dependencies: [],
    featureFlags: ['ai-copilot']
  },
  // === KỸ THUẬT HỆ THỐNG (REA Events, Workflow) ===
  {
    id: 'rea-events',
    name: 'Quản lý Sự kiện REA',
    icon: Activity,
    component: React.lazy(() => import('./admin/rea-event-management/ReaEventDashboard.jsx')),
    accessControl: {
      roles: ['admin'],
      departments: ['admin']
    },
    requiresActiveCompany: false,
    department: 'admin',
    order: 5,
    dependencies: [],
    featureFlags: ['rea-events']
  },
  {
    id: 'rea-processors',
    name: 'Xử lý nghiệp vụ REA',
    icon: Activity,
    component: React.lazy(() => import('./admin/rea-event-management/ReaEventProcessor.jsx')),
    accessControl: {
      roles: ['admin', 'ktt', 'nv'],
      departments: ['finance', 'sales', 'purchasing', 'warehouse', 'hr']
    },
    requiresActiveCompany: true,
    department: 'admin',
    order: 6,
    dependencies: [],
    featureFlags: ['rea-events']
  },
  {
    id: 'workflows',
    name: 'Workflow Engine',
    icon: GitBranch,
    component: React.lazy(() => import('./admin/rea-event-management/WorkflowDashboard.jsx')),
    accessControl: {
      roles: ['admin', 'ktt'],
      departments: ['finance', 'admin']
    },
    requiresActiveCompany: true,
    department: 'admin',
    order: 7,
    dependencies: [],
    featureFlags: ['rea-events']
  }
];
