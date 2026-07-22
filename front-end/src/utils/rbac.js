/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * Role-Based Access Control (RBAC) Helper Functions
 * 
 * Module structure:
 * - accessControl.roles: list of roles that can access this module
 * - accessControl.departments: list of departments that can access this module
 * - If a module has no accessControl, it's accessible to all authenticated users
 */

/**
 * Check if a user has permission to access a module
 * @param {Object} user - User object from AuthContext
 * @param {Object} module - Module object from MODULES_REGISTER
 * @returns {boolean}
 */
export function hasPermission(user, module) {
  if (!user) return false;
  
  // If module has no accessControl, allow all authenticated users
  if (!module.accessControl) return true;
  
  const { roles, departments } = module.accessControl;
  
  // Check role permission
  if (roles && roles.length > 0) {
    const userRole = user.roleId || user.role;
    if (!userRole || !roles.includes(userRole)) {
      return false;
    }
  }
  
  // Check department permission
  if (departments && departments.length > 0) {
    const userDepartment = user.department;
    if (!userDepartment || !departments.includes(userDepartment)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get list of accessible modules for a user
 * @param {Object} user - User object from AuthContext
 * @param {Array} modules - Array of modules from MODULES_REGISTER
 * @returns {Array} Filtered list of accessible modules
 */
export function getAccessibleModules(user, modules) {
  if (!user) return [];
  return modules.filter(module => hasPermission(user, module));
}

/**
 * Filter modules by department
 * @param {Array} modules - Array of modules from MODULES_REGISTER
 * @param {string} department - Department ID to filter by
 * @returns {Array} Filtered list of modules for the department
 */
export function filterModulesByDepartment(modules, department) {
  if (!department) return modules;
  return modules.filter(module => {
    if (!module.accessControl || !module.accessControl.departments) {
      return true; // No department restriction
    }
    return module.accessControl.departments.includes(department);
  });
}

/**
 * Group modules by department for sidebar display
 * @param {Array} modules - Array of accessible modules
 * @param {Object} departments - DEPARTMENTS object from views/index.js
 * @returns {Object} Grouped modules by department ID
 */
export function groupModulesByDepartment(modules, departments) {
  const groups = {};
  
  // Initialize groups based on DEPARTMENTS order
  Object.values(departments).forEach(dept => {
    groups[dept.id] = {
      ...dept,
      modules: []
    };
  });
  
  // Add modules to their respective departments
  modules.forEach(module => {
    const deptId = module.department;
    if (groups[deptId]) {
      groups[deptId].modules.push(module);
    }
  });
  
  return groups;
}

/**
 * Check if user has access to a specific department
 * @param {Object} user - User object from AuthContext
 * @param {string} department - Department ID to check
 * @returns {boolean}
 */
export function hasDepartmentAccess(user, department) {
  if (!user || !department) return false;
  
  // Admin has access to all departments
  const userRole = user.roleId || user.role;
  if (userRole === 'admin') return true;
  
  // Check if user's department matches
  return user.department === department;
}

/**
 * Get user's accessible departments
 * @param {Object} user - User object from AuthContext
 * @param {Object} departments - DEPARTMENTS object from views/index.js
 * @returns {Array} List of department IDs the user can access
 */
export function getAccessibleDepartments(user, departments) {
  if (!user) return [];
  
  const userRole = user.roleId || user.role;
  
  // Admin has access to all departments
  if (userRole === 'admin') {
    return Object.keys(departments);
  }
  
  // Regular users only have access to their own department
  return user.department ? [user.department] : [];
}