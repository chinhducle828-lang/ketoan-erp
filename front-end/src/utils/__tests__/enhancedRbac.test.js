/**
 * Unit tests for enhanced RBAC utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  hasModuleAccess, 
  getRequiredClearance, 
  checkModuleDependencies, 
  checkFeatureFlags,
  getAccessibleModules,
  getModuleAccessStatus,
  sortModulesByDepartment,
  groupModulesByDepartment
} from '../enhancedRbac.js';

describe('enhancedRbac', () => {
  const mockUser = {
    role: 'admin',
    department: 'finance',
    clearance_level: 3
  };

  const mockModule = {
    id: 'test-module',
    accessControl: {
      roles: ['admin', 'ktt'],
      departments: ['finance']
    }
  };

  describe('hasModuleAccess', () => {
    it('should return true when user has correct role and department', () => {
      expect(hasModuleAccess(mockUser, mockModule)).toBe(true);
    });

    it('should return false when user has wrong role', () => {
      const user = { ...mockUser, role: 'nv' };
      expect(hasModuleAccess(user, mockModule)).toBe(false);
    });

    it('should return false when user has wrong department', () => {
      const user = { ...mockUser, department: 'sales' };
      expect(hasModuleAccess(user, mockModule)).toBe(false);
    });

    it('should return false when user has insufficient clearance level', () => {
      const user = { ...mockUser, clearance_level: 1 };
      expect(hasModuleAccess(user, mockModule)).toBe(false);
    });

    it('should return false when user is null', () => {
      expect(hasModuleAccess(null, mockModule)).toBe(false);
    });

    it('should return false when module is null', () => {
      expect(hasModuleAccess(mockUser, null)).toBe(false);
    });
  });

  describe('getRequiredClearance', () => {
    it('should return correct clearance for admin', () => {
      expect(getRequiredClearance('admin')).toBe(3);
    });

    it('should return correct clearance for ktt', () => {
      expect(getRequiredClearance('ktt')).toBe(2);
    });

    it('should return correct clearance for nv', () => {
      expect(getRequiredClearance('nv')).toBe(1);
    });

    it('should return 0 for unknown role', () => {
      expect(getRequiredClearance('unknown')).toBe(0);
    });
  });

  describe('checkModuleDependencies', () => {
    const moduleWithDeps = {
      id: 'test-module',
      dependencies: ['dep1', 'dep2']
    };

    it('should return true when all dependencies are met', () => {
      const enabledModules = [
        { id: 'dep1' },
        { id: 'dep2' }
      ];
      const result = checkModuleDependencies(mockUser, moduleWithDeps, enabledModules);
      expect(result.hasAccess).toBe(true);
      expect(result.missingDependencies).toHaveLength(0);
    });

    it('should return false when dependencies are missing', () => {
      const enabledModules = [{ id: 'dep1' }];
      const result = checkModuleDependencies(mockUser, moduleWithDeps, enabledModules);
      expect(result.hasAccess).toBe(false);
      expect(result.missingDependencies).toContain('dep2');
    });

    it('should return true when module has no dependencies', () => {
      const moduleWithoutDeps = { id: 'test-module', dependencies: [] };
      const result = checkModuleDependencies(mockUser, moduleWithoutDeps, []);
      expect(result.hasAccess).toBe(true);
      expect(result.missingDependencies).toHaveLength(0);
    });
  });

  describe('checkFeatureFlags', () => {
    it('should return true when all feature flags are enabled', () => {
      const module = {
        id: 'test-module',
        featureFlags: ['flag1', 'flag2']
      };
      const featureFlags = { flag1: true, flag2: true };
      const result = checkFeatureFlags(module, featureFlags);
      expect(result.hasAccess).toBe(true);
    });

    it('should return false when a feature flag is disabled', () => {
      const module = {
        id: 'test-module',
        featureFlags: ['flag1', 'flag2']
      };
      const featureFlags = { flag1: true, flag2: false };
      const result = checkFeatureFlags(module, featureFlags);
      expect(result.hasAccess).toBe(false);
      expect(result.disabledFlags).toContain('flag2');
    });

    it('should return true when module has no feature flags', () => {
      const module = { id: 'test-module', featureFlags: [] };
      const result = checkFeatureFlags(module, {});
      expect(result.hasAccess).toBe(true);
    });
  });

  describe('getAccessibleModules', () => {
    it('should return only accessible modules', () => {
      const modules = [
        { id: 'module1', accessControl: { roles: ['admin'], departments: ['finance'] } },
        { id: 'module2', accessControl: { roles: ['nv'], departments: ['sales'] } }
      ];
      const accessible = getAccessibleModules(mockUser, modules);
      expect(accessible).toHaveLength(1);
      expect(accessible[0].id).toBe('module1');
    });
  });

  describe('getModuleAccessStatus', () => {
    it('should return detailed access status', () => {
      const result = getModuleAccessStatus(mockUser, mockModule);
      expect(result.hasAccess).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it('should return reasons for denied access', () => {
      const user = { ...mockUser, role: 'nv' };
      const result = getModuleAccessStatus(user, mockModule);
      expect(result.hasAccess).toBe(false);
      expect(result.reasons.length).toBeGreaterThan(0);
    });
  });

  describe('sortModulesByDepartment', () => {
    it('should sort modules by department order', () => {
      const modules = [
        { id: 'module1', department: 'sales', order: 2 },
        { id: 'module2', department: 'finance', order: 1 }
      ];
      const sorted = sortModulesByDepartment(modules);
      expect(sorted[0].department).toBe('finance');
      expect(sorted[1].department).toBe('sales');
    });
  });

  describe('groupModulesByDepartment', () => {
    it('should group modules by department', () => {
      const modules = [
        { id: 'module1', department: 'finance' },
        { id: 'module2', department: 'sales' },
        { id: 'module3', department: 'finance' }
      ];
      const grouped = groupModulesByDepartment(modules);
      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped['finance']).toHaveLength(2);
      expect(grouped['sales']).toHaveLength(1);
    });
  });
});