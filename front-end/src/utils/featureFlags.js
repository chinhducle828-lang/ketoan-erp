/**
 * Feature Flags Configuration
 * Controls module availability and experimental features
 */

export const DEFAULT_FEATURE_FLAGS = {
  // Core features (always enabled)
  'basic-accounting': true,
  'voucher-management': true,
  'partner-management': true,
  'inventory-management': true,
  
  // Advanced features (can be toggled)
  'stock-reconciliation': true,
  'debt-reconciliation': true,
  'reversing-entries': true,
  'non-deductible-expenses': true,
  
  // Experimental features
  'ai-copilot': true,
  'advanced-reports': true,
  'multi-currency': false,
  'advanced-analytics': false,
  
  // SDUI / Dynamic features
  'dynamic-ui': true,

  // Integration features
  'einvoice': true,
  'push-notifications': true,
  'sms-notifications': false,
  'webhook-integrations': false
};

/**
 * Get default feature flags
 */
export const getDefaultFeatureFlags = () => {
  return { ...DEFAULT_FEATURE_FLAGS };
};

/**
 * Check if a feature flag is enabled
 */
export const isFeatureEnabled = (flagName, featureFlags = {}) => {
  const flags = { ...DEFAULT_FEATURE_FLAGS, ...featureFlags };
  return flags[flagName] === true;
};

/**
 * Get all enabled feature flags
 */
export const getEnabledFeatures = (featureFlags = {}) => {
  const flags = { ...DEFAULT_FEATURE_FLAGS, ...featureFlags };
  return Object.entries(flags)
    .filter(([_, enabled]) => enabled === true)
    .map(([name]) => name);
};

/**
 * Get all disabled feature flags
 */
export const getDisabledFeatures = (featureFlags = {}) => {
  const flags = { ...DEFAULT_FEATURE_FLAGS, ...featureFlags };
  return Object.entries(flags)
    .filter(([_, enabled]) => enabled === false)
    .map(([name]) => name);
};

/**
 * Validate feature flags against module requirements
 */
export const validateFeatureFlags = (modules, featureFlags = {}) => {
  const flags = { ...DEFAULT_FEATURE_FLAGS, ...featureFlags };
  const issues = [];
  
  modules.forEach(module => {
    if (!module.featureFlags || module.featureFlags.length === 0) {
      return;
    }
    
    module.featureFlags.forEach(flag => {
      if (flags[flag] === false) {
        issues.push({
          moduleId: module.id,
          moduleName: module.name,
          disabledFlag: flag,
          message: `Module "${module.name}" requires feature flag "${flag}" to be enabled`
        });
      }
    });
  });
  
  return {
    isValid: issues.length === 0,
    issues
  };
};

/**
 * Get modules that require a specific feature flag
 */
export const getModulesRequiringFeature = (flagName, modules) => {
  return modules.filter(module => {
    return module.featureFlags && module.featureFlags.includes(flagName);
  });
};

/**
 * Merge user feature flags with defaults
 */
export const mergeFeatureFlags = (userFlags = {}) => {
  return { ...DEFAULT_FEATURE_FLAGS, ...userFlags };
};

/**
 * Check if module is available based on feature flags
 */
export const isModuleAvailable = (module, featureFlags = {}) => {
  if (!module.featureFlags || module.featureFlags.length === 0) {
    return true;
  }
  
  const flags = { ...DEFAULT_FEATURE_FLAGS, ...featureFlags };
  
  return module.featureFlags.every(flag => flags[flag] !== false);
};

/**
 * Get feature flag status for a module
 */
export const getModuleFeatureStatus = (module, featureFlags = {}) => {
  if (!module.featureFlags || module.featureFlags.length === 0) {
    return {
      available: true,
      disabledFlags: [],
      enabledFlags: []
    };
  }
  
  const flags = { ...DEFAULT_FEATURE_FLAGS, ...featureFlags };
  const disabledFlags = module.featureFlags.filter(flag => flags[flag] === false);
  const enabledFlags = module.featureFlags.filter(flag => flags[flag] !== false);
  
  return {
    available: disabledFlags.length === 0,
    disabledFlags,
    enabledFlags
  };
};