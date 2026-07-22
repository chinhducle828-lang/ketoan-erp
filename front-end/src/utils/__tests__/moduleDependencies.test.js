/**
 * Unit tests for module dependencies utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getModuleDependencies,
  checkModuleDependencies,
  getDependencyTree,
  getAllTransitiveDependencies,
  validateModuleOrder,
  getDependentModules,
  getModuleInstallationOrder
} from '../moduleDependencies.js';

describe('moduleDependencies', () => {
  describe('getModuleDependencies', () => {
    it('should return dependencies for a module', () => {
      const deps = getModuleDependencies('income-statement');
      expect(deps).toContain('vouchers');
      expect(deps).toContain('opening');
    });

    it('should return empty array for module with no dependencies', () => {
      const deps = getModuleDependencies('partners');
      expect(deps).toHaveLength(0);
    });

    it('should return empty array for non-existent module', () => {
      const deps = getModuleDependencies('non-existent');
      expect(deps).toHaveLength(0);
    });
  });

  describe('checkModuleDependencies', () => {
    it('should return true when all dependencies are met', () => {
      const result = checkModuleDependencies('income-statement', [
        { id: 'vouchers' },
        { id: 'opening' }
      ]);
      expect(result.isFullyDependent).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should return false when dependencies are missing', () => {
      const result = checkModuleDependencies('income-statement', [
        { id: 'vouchers' }
      ]);
      expect(result.isFullyDependent).toBe(false);
      expect(result.missing).toContain('opening');
    });

    it('should return true when module has no dependencies', () => {
      const result = checkModuleDependencies('partners', []);
      expect(result.hasDependencies).toBe(false);
      expect(result.isFullyDependent).toBe(true);
    });
  });

  describe('getDependencyTree', () => {
    it('should return dependency tree for a module', () => {
      const tree = getDependencyTree('closing_process');
      expect(tree.length).toBeGreaterThan(0);
      expect(tree.some(node => node.id === 'vouchers')).toBe(true);
    });

    it('should handle circular dependencies', () => {
      const tree = getDependencyTree('closing_process', new Set(['closing_process']));
      expect(tree).toHaveLength(0);
    });
  });

  describe('getAllTransitiveDependencies', () => {
    it('should return all transitive dependencies', () => {
      const deps = getAllTransitiveDependencies('closing_process');
      expect(deps).toContain('vouchers');
      expect(deps).toContain('opening');
      expect(deps).toContain('tax');
    });

    it('should not include duplicates', () => {
      const deps = getAllTransitiveDependencies('income-statement');
      const uniqueDeps = new Set(deps);
      expect(deps.length).toBe(uniqueDeps.size);
    });
  });

  describe('validateModuleOrder', () => {
    it('should return true when all dependencies are satisfied', () => {
      const modules = [
        { id: 'vouchers' },
        { id: 'opening' },
        { id: 'income-statement' }
      ];
      const result = validateModuleOrder(modules);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return false when dependencies are not satisfied', () => {
      const modules = [
        { id: 'income-statement' }
      ];
      const result = validateModuleOrder(modules);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return errors with module details', () => {
      const modules = [
        { id: 'income-statement', name: 'Income Statement' }
      ];
      const result = validateModuleOrder(modules);
      expect(result.errors[0].moduleId).toBe('income-statement');
      expect(result.errors[0].moduleName).toBe('Income Statement');
    });
  });

  describe('getDependentModules', () => {
    it('should return modules that depend on a given module', () => {
      const dependents = getDependentModules('vouchers');
      expect(dependents.length).toBeGreaterThan(0);
      expect(dependents).toContain('income-statement');
    });

    it('should return empty array for module with no dependents', () => {
      const dependents = getDependentModules('partners');
      expect(dependents).toHaveLength(0);
    });
  });

  describe('getModuleInstallationOrder', () => {
    it('should return modules in topological order', () => {
      const order = getModuleInstallationOrder(['income-statement', 'vouchers', 'opening']);
      expect(order.indexOf('vouchers')).toBeLessThan(order.indexOf('income-statement'));
      expect(order.indexOf('opening')).toBeLessThan(order.indexOf('income-statement'));
    });

    it('should handle modules with no dependencies', () => {
      const order = getModuleInstallationOrder(['partners']);
      expect(order).toContain('partners');
    });

    it('should not include duplicates', () => {
      const order = getModuleInstallationOrder(['vouchers', 'vouchers']);
      expect(order).toHaveLength(1);
    });
  });
});