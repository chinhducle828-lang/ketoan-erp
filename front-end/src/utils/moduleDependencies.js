/**
 * Module Dependencies Configuration
 * Defines which modules depend on other modules for proper functionality
 */

export const MODULE_DEPENDENCIES = {
  // Financial reporting depends on having vouchers and opening balances
  'income-statement': ['vouchers', 'opening'],
  'income-statement-b02': ['vouchers', 'opening'],
  'balance-sheet': ['vouchers', 'opening'],
  'cash-flow': ['vouchers', 'opening'],
  'financial-notes': ['vouchers', 'opening'],
  
  // Debt reconciliation requires partner management
  'debt-reconciliation': ['partners'],
  
  // Stock reconciliation requires inventory management
  'stock-reconciliation': ['inventory'],
  
  // Logistics requires inventory and sales
  'logistics-dashboard': ['inventory', 'partners'],
  'bai-xuc': ['inventory', 'logistics-dashboard'],
  
  // Purchasing requires partners (suppliers)
  'purchasing': ['partners'],
  
  // AI Copilot requires vouchers for context
  'ai-copilot': ['vouchers'],
  
  // Closing process requires all accounting modules
  'closing_process': ['vouchers', 'opening', 'tax']
};

/**
 * Get dependencies for a module
 */
export const getModuleDependencies = (moduleId) => {
  return MODULE_DEPENDENCIES[moduleId] || [];
};

/**
 * Check if a module has unmet dependencies
 */
export const checkModuleDependencies = (moduleId, enabledModules = []) => {
  const dependencies = getModuleDependencies(moduleId);
  
  if (dependencies.length === 0) {
    return {
      hasDependencies: false,
      missing: [],
      available: []
    };
  }
  
  const enabledModuleIds = new Set(enabledModules.map(m => m.id));
  const missing = dependencies.filter(depId => !enabledModuleIds.has(depId));
  const available = dependencies.filter(depId => enabledModuleIds.has(depId));
  
  return {
    hasDependencies: true,
    missing,
    available,
    isFullyDependent: missing.length === 0
  };
};

/**
 * Get dependency tree for a module (recursive)
 */
export const getDependencyTree = (moduleId, visited = new Set()) => {
  if (visited.has(moduleId)) {
    return [];
  }
  
  visited.add(moduleId);
  const dependencies = getModuleDependencies(moduleId);
  const tree = [];
  
  dependencies.forEach(depId => {
    tree.push({
      id: depId,
      dependencies: getDependencyTree(depId, visited)
    });
  });
  
  return tree;
};

/**
 * Get all transitive dependencies for a module
 */
export const getAllTransitiveDependencies = (moduleId) => {
  const tree = getDependencyTree(moduleId);
  const allDeps = new Set();
  
  const traverse = (nodes) => {
    nodes.forEach(node => {
      if (allDeps.has(node.id)) return;
      allDeps.add(node.id);
      traverse(node.dependencies);
    });
  };
  
  traverse(tree);
  return Array.from(allDeps);
};

/**
 * Validate module dependency order
 * Returns true if all dependencies are satisfied in the given module list
 */
export const validateModuleOrder = (moduleList) => {
  const enabledIds = new Set(moduleList.map(m => m.id));
  const errors = [];
  
  moduleList.forEach(module => {
    const depCheck = checkModuleDependencies(module.id, moduleList);
    if (!depCheck.isFullyDependent) {
      errors.push({
        moduleId: module.id,
        moduleName: module.name,
        missingDependencies: depCheck.missing
      });
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Get modules that depend on a given module
 */
export const getDependentModules = (moduleId) => {
  return Object.entries(MODULE_DEPENDENCIES)
    .filter(([_, deps]) => deps.includes(moduleId))
    .map(([moduleId]) => moduleId);
};

/**
 * Get installation order for modules (topological sort)
 */
export const getModuleInstallationOrder = (moduleIds) => {
  const visited = new Set();
  const order = [];
  
  const visit = (moduleId) => {
    if (visited.has(moduleId)) return;
    visited.add(moduleId);
    
    const deps = getModuleDependencies(moduleId);
    deps.forEach(depId => visit(depId));
    
    order.push(moduleId);
  };
  
  moduleIds.forEach(moduleId => visit(moduleId));
  
  return order;
};