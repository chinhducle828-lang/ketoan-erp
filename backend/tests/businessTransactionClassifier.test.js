/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * businessTransactionClassifier.test.js - Tests for 3-layer transaction classification
 */

import { describe, it, expect, jest } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../config/db.js', () => ({
  pool: {
    query: mockQuery
  }
}));

jest.unstable_mockModule('../services/geminiClient.js', () => ({
  callGemini: jest.fn()
}));

jest.unstable_mockModule('../services/aiDepartmentClassifier.service.js', () => ({
  classifyDepartment: jest.fn().mockResolvedValue({ success: false, error: 'Mock disabled' })
}));

const { classifyTransaction, getRules, createRule } = await import('../services/businessTransactionClassifier.service.js');

describe('businessTransactionClassifier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('classifyTransaction', () => {
    it('should classify by rules when high confidence match found', async () => {
      // Mock rule-based classification
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            rule_name: 'Bán hàng - Doanh thu',
            rule_type: 'keyword',
            priority: 10,
            conditions: { keywords: ['bán hàng', 'doanh thu'] },
            action_type: 'set_account',
            action_value: { account_code: '511', entry_type: 'CR' }
          }
        ]
      });

      const result = await classifyTransaction(
        { description: 'Bán hàng cho khách hàng ABC' },
        1
      );

      expect(result.success).toBe(true);
      expect(result.classification.account_code).toBe('511');
      expect(result.classification.entry_type).toBe('CR');
      expect(result.layer_used).toBe(1);
    });

    it('should return default when no rules match', async () => {
      // Mock no rules
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await classifyTransaction(
        { description: 'Giao dịch không xác định' },
        1
      );

      expect(result.success).toBe(true);
      expect(result.classification.account_code).toBe('511'); // Default
      expect(result.layer_used).toBe(0);
    });

    it('should handle errors gracefully', async () => {
      // Mock error
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      const result = await classifyTransaction(
        { description: 'Test' },
        1
      );

      // Service falls back to default classification on DB error
      expect(result.success).toBe(true);
      expect(result.classification.account_code).toBeDefined();
    });
  });

  describe('getRules', () => {
    it('should return rules for company', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 1, rule_name: 'Test Rule', rule_type: 'keyword' }
        ]
      });

      const rules = await getRules(1);

      expect(rules).toHaveLength(1);
      expect(rules[0].rule_name).toBe('Test Rule');
    });
  });

  describe('createRule', () => {
    it('should create a new rule', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            company_id: 1,
            rule_name: 'New Rule',
            rule_type: 'keyword',
            priority: 100,
            is_active: true,
            conditions: { keywords: ['test'] },
            action_type: 'set_account',
            action_value: { account_code: '511' }
          }
        ]
      });

      const rule = await createRule(1, {
        rule_name: 'New Rule',
        rule_type: 'keyword',
        conditions: { keywords: ['test'] },
        action_type: 'set_account',
        action_value: { account_code: '511' }
      });

      expect(rule.rule_name).toBe('New Rule');
    });
  });
});