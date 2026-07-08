/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { useState, useEffect, useCallback } from 'react';

// Permission matrix - must match backend PERMISSIONS
export const PERMISSIONS = {
  vouchers: {
    create: ['admin', 'ktt', 'nv', 'nv_banhang', 'nv_kho'],
    read: ['admin', 'ktt', 'nv', 'nv_banhang', 'nv_kho'],
    update: ['admin', 'ktt'],
    delete: ['admin', 'ktt'],
    post: ['admin', 'ktt']
  },
  inventory: {
    create: ['admin', 'ktt', 'nv_kho'],
    read: ['admin', 'ktt', 'nv_kho', 'nv_banhang'],
    update: ['admin', 'ktt', 'nv_kho'],
    delete: ['admin', 'ktt']
  },
  reports: {
    view: ['admin', 'ktt', 'nv'],
    export: ['admin', 'ktt']
  },
  closing: {
    execute: ['admin', 'ktt'],
    preview: ['admin', 'ktt']
  },
  orders: {
    read: ['admin', 'ktt', 'nv', 'nv_banhang', 'nv_kho'],
    update: ['admin', 'ktt', 'nv_banhang', 'nv_kho']
  }
};

// Storefront-specific roles
export const STOREFRONT_ROLES = ['nv_banhang', 'nv_kho'];

// Check if user has permission for a specific module/action
export function hasPermission(userRole, module, action) {
  if (!userRole) return false;
  
  // Admin has all permissions
  if (userRole === 'admin') return true;
  
  const allowedRoles = PERMISSIONS[module]?.[action] || [];
  return allowedRoles.includes(userRole);
}

// Get all permissions for a user role
export function getUserPermissions(userRole) {
  if (!userRole) return [];
  
  const permissions = [];
  
  for (const [module, actions] of Object.entries(PERMISSIONS)) {
    for (const [action, roles] of Object.entries(actions)) {
      if (roles.includes(userRole)) {
        permissions.push(`${module}:${action}`);
      }
    }
  }
  
  return permissions;
}

// Check if role can access storefront
export function canAccessStorefront(userRole) {
  if (!userRole) return false;
  return STOREFRONT_ROLES.includes(userRole) || userRole === 'admin' || userRole === 'ktt';
}

// Hook to manage user permissions
export function usePermissions() {
  const [userRole, setUserRole] = useState(() => {
    return localStorage.getItem('userRole') || null;
  });
  const [userId, setUserId] = useState(() => {
    return localStorage.getItem('userId') || null;
  });
  const [companyId, setCompanyId] = useState(() => {
    return localStorage.getItem('companyId') || null;
  });

  // Update state when localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      setUserRole(localStorage.getItem('userRole'));
      setUserId(localStorage.getItem('userId'));
      setCompanyId(localStorage.getItem('companyId'));
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Permission check function
  const checkPermission = useCallback((module, action) => {
    return hasPermission(userRole, module, action);
  }, [userRole]);

  // Get all user permissions
  const permissions = getUserPermissions(userRole);

  return {
    userRole,
    userId,
    companyId,
    permissions,
    hasPermission: checkPermission,
    canAccessStorefront: canAccessStorefront(userRole),
    isAuthenticated: !!localStorage.getItem('erp_token')
  };
}