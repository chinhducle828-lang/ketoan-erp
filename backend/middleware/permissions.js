/**
 * Permission-based RBAC Middleware
 * Kiểm tra quyền dựa trên permission thay vì role
 */

/**
 * Định nghĩa permissions cho từng module
 */
const PERMISSIONS = {
  vouchers: {
    create: ['admin', 'ktt', 'nv'],
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
  }
};

/**
 * Middleware kiểm tra permission
 * @param {string} module - Tên module (vouchers, inventory, reports, closing)
 * @param {string} action - Tên action (create, read, update, delete, post, view, export, execute, preview)
 */
export function requirePermission(module, action) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    
    if (!userRole) {
      return res.status(401).json({ error: 'Chưa đăng nhập' });
    }

    const allowedRoles = PERMISSIONS[module]?.[action] || [];
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        error: `Không có quyền ${action} ${module}`,
        required: allowedRoles,
        current: userRole
      });
    }

    next();
  };
}

/**
 * Middleware kiểm tra quyền truy cập công ty
 * @param {string} module - Tên module
 * @param {string} action - Tên action
 */
export function requireCompanyPermission(module, action) {
  return async (req, res, next) => {
    const user = req.user;
    const companyId = req.companyId || req.body.companyId || req.query.companyId;
    
    if (!user) {
      return res.status(401).json({ error: 'Chưa đăng nhập' });
    }

    // Admin có mọi quyền
    if (user.role === 'admin') {
      return next();
    }

    // Kiểm tra user có thuộc công ty không
    if (user.company_ids && !user.company_ids.includes(Number(companyId))) {
      return res.status(403).json({ error: 'Không có quyền truy cập công ty này' });
    }

    // Kiểm tra role
    const allowedRoles = PERMISSIONS[module]?.[action] || [];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: `Không có quyền ${action} ${module}` });
    }

    next();
  };
}

/**
 * Lấy danh sách permissions của user
 * @param {Object} user - User object
 * @returns {Array<string>}
 */
export function getUserPermissions(user) {
  if (!user) return [];
  
  const permissions = [];
  const userRole = user.role;
  
  for (const [module, actions] of Object.entries(PERMISSIONS)) {
    for (const [action, roles] of Object.entries(actions)) {
      if (roles.includes(userRole)) {
        permissions.push(`${module}:${action}`);
      }
    }
  }
  
  return permissions;
}