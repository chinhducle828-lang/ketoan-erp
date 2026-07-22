/**
 * Module Defaults Configuration
 * Provides default values and configurations for the enhanced RBAC system
 */

import { MODULES_REGISTER } from '../views/index.js';
import { MODULE_DEPENDENCIES } from './moduleDependencies.js';
import { DEFAULT_FEATURE_FLAGS } from './featureFlags.js';

/**
 * Get default module configuration
 */
export const getDefaultModuleConfig = () => {
  return {
    modules: MODULES_REGISTER,
    dependencies: MODULE_DEPENDENCIES,
    featureFlags: DEFAULT_FEATURE_FLAGS,
    enabledModules: MODULES_REGISTER.map(m => m.id),
    userClearanceLevels: {
      'admin': 3,
      'ktt': 2,
      'nv': 1,
      'gd_kinhdoanh': 2,
      'nv_banhang': 1,
      'nv_kho': 1,
      'guest': 0
    }
  };
};

/**
 * Get default accessible modules for a given role
 */
export const getDefaultAccessibleModules = (role) => {
  const clearanceLevel = getDefaultModuleConfig().userClearanceLevels[role] || 0;
  
  return MODULES_REGISTER.filter(module => {
    const requiredClearance = getDefaultModuleConfig().userClearanceLevels[module.accessControl.roles[0]] || 0;
    return clearanceLevel >= requiredClearance && module.accessControl.roles.includes(role);
  });
};

/**
 * Get module by ID
 */
export const getModuleById = (moduleId) => {
  return MODULES_REGISTER.find(m => m.id === moduleId) || null;
};

/**
 * Get modules by department
 */
export const getModulesByDepartment = (departmentId) => {
  return MODULES_REGISTER.filter(m => m.department === departmentId);
};

/**
 * Get modules by role
 */
export const getModulesByRole = (role) => {
  return MODULES_REGISTER.filter(m => m.accessControl.roles.includes(role));
};

/**
 * Check if a module exists
 */
export const moduleExists = (moduleId) => {
  return MODULES_REGISTER.some(m => m.id === moduleId);
};

/**
 * Get all module IDs
 */
export const getAllModuleIds = () => {
  return MODULES_REGISTER.map(m => m.id);
};

/**
 * Get module count
 */
export const getModuleCount = () => {
  return MODULES_REGISTER.length;
};

/**
 * Validate module configuration
 */
export const validateModuleConfig = () => {
  const errors = [];
  const warnings = [];
  
  // Check for duplicate module IDs
  const moduleIds = MODULES_REGISTER.map(m => m.id);
  const uniqueIds = new Set(moduleIds);
  if (moduleIds.length !== uniqueIds.size) {
    errors.push('Duplicate module IDs found');
  }
  
  // Check for missing dependencies
  MODULES_REGISTER.forEach(module => {
    if (module.dependencies) {
      module.dependencies.forEach(depId => {
        if (!moduleExists(depId)) {
          warnings.push(`Module "${module.id}" depends on non-existent module "${depId}"`);
        }
      });
    }
  });
  
  // Check for missing feature flags
  MODULES_REGISTER.forEach(module => {
    if (module.featureFlags) {
      module.featureFlags.forEach(flag => {
        if (!DEFAULT_FEATURE_FLAGS.hasOwnProperty(flag)) {
          warnings.push(`Module "${module.id}" uses undefined feature flag "${flag}"`);
        }
      });
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Get module statistics
 */
export const getModuleStatistics = () => {
  const stats = {
    total: MODULES_REGISTER.length,
    byDepartment: {},
    byRole: {},
    withDependencies: 0,
    withFeatureFlags: 0
  };
  
  MODULES_REGISTER.forEach(module => {
    // Count by department
    if (!stats.byDepartment[module.department]) {
      stats.byDepartment[module.department] = 0;
    }
    stats.byDepartment[module.department]++;
    
    // Count by role
    module.accessControl.roles.forEach(role => {
      if (!stats.byRole[role]) {
        stats.byRole[role] = 0;
      }
      stats.byRole[role]++;
    });
    
    // Count with dependencies
    if (module.dependencies && module.dependencies.length > 0) {
      stats.withDependencies++;
    }
    
    // Count with feature flags
    if (module.featureFlags && module.featureFlags.length > 0) {
      stats.withFeatureFlags++;
    }
  });
  
  return stats;
};