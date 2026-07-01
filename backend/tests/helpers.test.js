const { describe, it, expect } = require('@jest/globals');
const { normalizeCompanyIds, syncUserCompanyLinks, canAccessCompany, getCompanyIdsForUser } = require('../services/helpers.js');

describe('Helper Services', () => {
  describe('normalizeCompanyIds', () => {
    it('should normalize array of company IDs', () => {
      const result = normalizeCompanyIds([1, 2, 3, '4', null, undefined, '']);
      expect(result).toEqual([1, 2, 3, 4]);
    });

    it('should handle single number', () => {
      const result = normalizeCompanyIds(5);
      expect(result).toEqual([5]);
    });

    it('should return empty array for null/undefined', () => {
      expect(normalizeCompanyIds(null)).toEqual([]);
      expect(normalizeCompanyIds(undefined)).toEqual([]);
      expect(normalizeCompanyIds('')).toEqual([]);
    });

    it('should filter out invalid IDs', () => {
      const result = normalizeCompanyIds([0, -1, 1.5, 'abc', 2]);
      expect(result).toEqual([2]);
    });
  });

  describe('canAccessCompany', () => {
    it('should return true for admin', async () => {
      const adminUser = { id: 1, role: 'admin' };
      const result = await canAccessCompany(adminUser, 1);
      expect(result).toBe(true);
    });

    it('should return false for non-admin without companyId', async () => {
      const user = { id: 2, role: 'nv' };
      const result = await canAccessCompany(user, null);
      expect(result).toBe(false);
    });

    it('should return false for non-admin without companyId', async () => {
      const user = { id: 2, role: 'nv' };
      const result = await canAccessCompany(user, 0);
      expect(result).toBe(false);
    });
  });

  describe('getCompanyIdsForUser', () => {
    it('should return empty array for admin', async () => {
      const adminUser = { id: 1, role: 'admin' };
      const result = await getCompanyIdsForUser(adminUser);
      expect(result).toEqual([]);
    });
  });
});