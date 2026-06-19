import React from 'react';
import { 
  Wallet, 
  Package, 
  Calculator, 
  BookOpenCheck, 
  Settings, 
  ShoppingBag, 
  Users, 
  Percent, 
  Coins, 
  Layers, 
  UserCheck 
} from 'lucide-react';

export const MODULES_REGISTER = [
  {
    id: 'opening',
    name: 'Khai báo số dư đầu kỳ',
    icon: Coins,
    component: React.lazy(() => import('./closing/OpeningBalances.jsx')),
    allowedRoles: ['admin', 'ktt'],
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
    id: 'items',
    name: 'Danh mục mã vật tư hàng hóa',
    icon: Package,
    component: React.lazy(() => import('./sales/ItemManagement.jsx')),
    allowedRoles: ['admin', 'ktt', 'nv'],
    requiresActiveCompany: true
  },
  {
    id: 'sales_excel',
    name: 'Hóa đơn bán hàng Excel',
    icon: Layers,
    component: React.lazy(() => import('./sales/AutoSalesExcel.jsx')),
    allowedRoles: ['admin', 'ktt', 'nv'],
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
    allowedRoles: ['admin', 'ktt'],
    requiresActiveCompany: true
  },
  {
    id: 'tax',
    name: 'Tờ khai báo cáo Thuế GTGT',
    icon: Percent,
    component: React.lazy(() => import('./tax/TaxReporting.jsx')),
    allowedRoles: ['admin', 'ktt'],
    requiresActiveCompany: true
  },
  {
    id: 'closing_process',
    name: 'Kết chuyển khóa sổ cuối kỳ',
    icon: BookOpenCheck,
    component: React.lazy(() => import('./closing/ClosingProcess.jsx')),
    allowedRoles: ['admin', 'ktt'],
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
    id: 'users',
    name: 'Quản lý ô tích phân quyền',
    icon: UserCheck,
    // ĐÃ SỬA: Cho module quản lý ô tích import thẳng component CompanyManagement.jsx
    // Khi đổi tab trên sidebar, React sẽ ép unmount và mount lại view, kích hoạt useEffect tải lại dữ liệu mới nhất.
    component: React.lazy(() => import('./admin/CompanyManagement.jsx')),
    allowedRoles: ['admin'],
    requiresActiveCompany: false 
  }
];