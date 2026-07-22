/**
 * useModuleAccess Hook
 * Provides module-level access control for React components
 */

import { useMemo, useCallback } from 'react';
import { hasModuleAccess, getAccessibleModules, getModuleAccessStatus } from '../utils/enhancedRbac.js';
import { checkModuleDependencies } from '../utils/moduleDependencies.js';
import { isModuleAvailable, getModuleFeatureStatus } from '../utils/featureFlags.js';
import { MODULES_REGISTER } from '../views/index.js';

export const useModuleAccess = (user, enabledModules = [], featureFlags = {}) => {
  // Use useMemo to compute accessible modules - no useState/useEffect needed
  const accessibleModules = useMemo(() => {
    if (!user) return [];
    return getAccessibleModules(user, MODULES_REGISTER, enabledModules, featureFlags);
  }, [user?.id, user?.role, user?.department, user?.clearance_level, JSON.stringify(enabledModules), JSON.stringify(featureFlags)]);

  const moduleStatus = useMemo(() => {
    if (!user) return {};
    const statusMap = {};
    MODULES_REGISTER.forEach(module => {
      statusMap[module.id] = getModuleAccessStatus(user, module, enabledModules, featureFlags);
    });
    return statusMap;
  }, [user?.id, user?.role, user?.department, user?.clearance_level, JSON.stringify(enabledModules), JSON.stringify(featureFlags)]);

  const hasAccess = useMemo(() => {
    return (moduleId) => {
      const module = MODULES_REGISTER.find(m => m.id === moduleId);
      if (!module) return false;
      return accessibleModules.some(m => m.id === moduleId);
    };
  }, [accessibleModules]);

  const getModuleInfo = useMemo(() => {
    return (moduleId) => {
      const module = MODULES_REGISTER.find(m => m.id === moduleId);
      if (!module) return null;
      
      const depCheck = checkModuleDependencies(moduleId, enabledModules);
      const featureStatus = getModuleFeatureStatus(module, featureFlags);
      const accessStatus = moduleStatus[moduleId] || { hasAccess: false, reasons: [] };
      
      return {
        ...module,
        isAccessible: accessibleModules.some(m => m.id === moduleId),
        dependencies: depCheck,
        featureStatus,
        accessStatus
      };
    };
  }, [accessibleModules, enabledModules, featureFlags, moduleStatus]);

  const getDependencyTree = useMemo(() => {
    return (moduleId) => {
      const module = MODULES_REGISTER.find(m => m.id === moduleId);
      if (!module || !module.dependencies) return [];
      
      return module.dependencies.map(depId => {
        const depModule = MODULES_REGISTER.find(m => m.id === depId);
        return {
          id: depId,
          name: depModule?.name || depId,
          isAccessible: accessibleModules.some(m => m.id === depId)
        };
      });
    };
  }, [accessibleModules]);

  return {
    accessibleModules,
    hasAccess,
    getModuleInfo,
    getDependencyTree,
    moduleStatus,
    totalAccessible: accessibleModules.length,
    totalModules: MODULES_REGISTER.length
  };
};

export default useModuleAccess;