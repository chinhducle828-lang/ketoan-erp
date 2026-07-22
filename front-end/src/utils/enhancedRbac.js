/**
 * Enhanced RBAC Utility
 * Provides module-level access control with dependencies and feature flags
 */

/**
 * Check if user has access to a module based on role and department
 */
export const hasModuleAccess = (user, module) => {
  if (!user || !module) return false;
  
  const { role, department, clearance_level = 0 } = user;
  const { accessControl, requiresActiveCompany } = module;
  
  // Check role access
  if (!accessControl.roles.includes(role)) {
    return false;
  }
  
  // Admin bypasses department check - they have access to all departments
  if (role === 'admin') {
    // Check clearance level (admin = 3, ktt = 2, nv = 1, guest = 0)
    const requiredClearance = getRequiredClearance(role);
    if (clearance_level < requiredClearance) {
      return false;
    }
    return true;
  }
  
  // Check department access - skip if user has no department set (for backward compatibility)
  if (department && accessControl.departments.length > 0) {
    if (!accessControl.departments.includes(department)) {
      return false;
    }
  }
  
  // Check clearance level (admin = 3, ktt = 2, nv = 1, guest = 0)
  const requiredClearance = getRequiredClearance(role);
  if (clearance_level < requiredClearance) {
    return false;
  }
  
  return true;
};

/**
 * Get required clearance level for a role
 */
export const getRequiredClearance = (role) => {
  const clearanceMap = {
    'admin': 3,
    'ktt': 2,
    'nv': 1,
    'gd_kinhdoanh': 2,
    'nv_banhang': 1,
    'nv_kho': 1,
    'guest': 0
  };
  return clearanceMap[role] || 0;
};

/**
 * Check if all module dependencies are met
 */
export const checkModuleDependencies = (user, module, enabledModules = []) => {
  if (!module.dependencies || module.dependencies.length === 0) {
    return { hasAccess: true, missingDependencies: [] };
  }
  
  const missingDependencies = module.dependencies.filter(depId => {
    const depModule = enabledModules.find(m => m.id === depId);
    return !depModule || !hasModuleAccess(user, depModule);
  });
  
  return {
    hasAccess: missingDependencies.length === 0,
    missingDependencies
  };
};

/**
 * Check if feature flags allow module access
 */
export const checkFeatureFlags = (module, featureFlags = {}) => {
  if (!module.featureFlags || module.featureFlags.length === 0) {
    return { hasAccess: true, disabledFlags: [] };
  }
  
  const disabledFlags = module.featureFlags.filter(flag => {
    return featureFlags[flag] === false;
  });
  
  return {
    hasAccess: disabledFlags.length === 0,
    disabledFlags
  };
};

/**
 * Get all accessible modules for a user
 */
export const getAccessibleModules = (user, allModules, enabledModules = [], featureFlags = {}) => {
  return allModules.filter(module => {
    // Check basic access
    if (!hasModuleAccess(user, module)) {
      return false;
    }
    
    // Check dependencies
    const depCheck = checkModuleDependencies(user, module, enabledModules);
    if (!depCheck.hasAccess) {
      return false;
    }
    
    // Check feature flags
    const flagCheck = checkFeatureFlags(module, featureFlags);
    if (!flagCheck.hasAccess) {
      return false;
    }
    
    return true;
  });
};

/**
 * Get module access status with detailed reasons
 */
export const getModuleAccessStatus = (user, module, enabledModules = [], featureFlags = {}) => {
  const reasons = [];
  
  // Check role access
  if (!module.accessControl.roles.includes(user?.role)) {
    reasons.push(`Role ${user?.role} not authorized`);
  }
  
  // Check department access - admin bypasses department check
  if (user?.role !== 'admin' && user?.department && !module.accessControl.departments.includes(user?.department)) {
    reasons.push(`Department ${user?.department} not authorized`);
  }
  
  // Check clearance level
  const requiredClearance = getRequiredClearance(user?.role);
  if (user?.clearance_level < requiredClearance) {
    reasons.push(`Clearance level ${user?.clearance_level} insufficient (requires ${requiredClearance})`);
  }
  
  // Check dependencies
  const depCheck = checkModuleDependencies(user, module, enabledModules);
  if (!depCheck.hasAccess) {
    reasons.push(`Missing dependencies: ${depCheck.missingDependencies.join(', ')}`);
  }
  
  // Check feature flags
  const flagCheck = checkFeatureFlags(module, featureFlags);
  if (!flagCheck.hasAccess) {
    reasons.push(`Disabled by feature flags: ${flagCheck.disabledFlags.join(', ')}`);
  }
  
  return {
    hasAccess: reasons.length === 0,
    reasons
  };
};

/**
 * Sort modules by department order and module order
 */
export const sortModulesByDepartment = (modules) => {
  return modules.sort((a, b) => {
    const deptOrder = a.department.localeCompare(b.department);
    if (deptOrder !== 0) return deptOrder;
    return (a.order || 0) - (b.order || 0);
  });
};

/**
 * Group modules by department
 */
export const groupModulesByDepartment = (modules) => {
  const grouped = {};
  
  modules.forEach(module => {
    if (!grouped[module.department]) {
      grouped[module.department] = [];
    }
    grouped[module.department].push(module);
  });
  
  return grouped;
};