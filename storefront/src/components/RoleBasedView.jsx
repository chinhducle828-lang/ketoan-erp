import React from 'react';
import { usePermissions } from '../hooks/usePermissions';

// Component to conditionally render based on permissions
export function PermissionGate({ module, action, children, fallback = null }) {
  const { hasPermission } = usePermissions();
  
  if (hasPermission(module, action)) {
    return children;
  }
  
  return fallback;
}

// Component to show content only for specific roles
export function RoleGate({ allowedRoles, children, fallback = null }) {
  const { userRole } = usePermissions();
  
  if (!userRole) return fallback;
  
  if (allowedRoles.includes(userRole)) {
    return children;
  }
  
  return fallback;
}

// Component to show role-specific navigation
export function RoleNavigation() {
  const { userRole } = usePermissions();
  
  const getNavItems = () => {
    const baseItems = [
      { id: 'dashboard', label: 'Tổng quan', icon: '📊' }
    ];
    
    if (userRole === 'nv_banhang') {
      return [
        ...baseItems,
        { id: 'orders', label: 'Đơn hàng', icon: '📦' },
        { id: 'customers', label: 'Khách hàng', icon: '👥' }
      ];
    }
    
    if (userRole === 'nv_kho') {
      return [
        ...baseItems,
        { id: 'inventory', label: 'Tồn kho', icon: '📋' },
        { id: 'products', label: 'Sản phẩm', icon: '🏷️' }
      ];
    }
    
    if (userRole === 'admin' || userRole === 'ktt') {
      return [
        ...baseItems,
        { id: 'orders', label: 'Đơn hàng', icon: '📦' },
        { id: 'inventory', label: 'Tồn kho', icon: '📋' },
        { id: 'reports', label: 'Báo cáo', icon: '📈' }
      ];
    }
    
    return baseItems;
  };
  
  return (
    <nav className="bg-white border-b p-4">
      <div className="max-w-4xl mx-auto flex gap-2">
        {getNavItems().map(item => (
          <button
            key={item.id}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <span className="mr-2">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

// Component to display permission denied message
export function PermissionDenied({ message = 'Bạn không có quyền truy cập chức năng này' }) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-rose-600 text-xl">🔒</span>
        </div>
        <p className="text-sm text-slate-600">{message}</p>
      </div>
    </div>
  );
}