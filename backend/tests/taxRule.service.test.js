import { describe, test, expect } from '@jest/globals';
import { resolveTaxBreakdown } from '../services/taxRule.service.js';

describe('tax rule service', () => {
  test('returns a net/tax/gross breakdown with the retail fallback rate', () => {
    const result = resolveTaxBreakdown({
      amount: 100000,
      businessRules: {
        pricing: {
          defaultTaxRate: 0.08,
          taxPrecision: 2
        }
      }
    });

    expect(result.taxRate).toBe(0.08);
    expect(result.netAmount).toBe(100000);
    expect(result.taxAmount).toBe(8000);
    expect(result.grossAmount).toBe(108000);
  });

  test('supports explicit tax rules from the payload context', () => {
    const result = resolveTaxBreakdown({
      amount: 100000,
      taxRate: 0.1,
      entityType: 'company',
      annualRevenueBand: 'under_1b',
      category: 'retail',
      businessRules: {
        pricing: {
          defaultTaxRate: 0.08,
          taxPrecision: 2,
          taxRules: [
            {
              entityType: 'company',
              annualRevenueBand: 'under_1b',
              category: 'retail',
              taxRate: 0.08
            }
          ]
        }
      }
    });

    expect(result.taxRate).toBe(0.08);
    expect(result.grossAmount).toBe(108000);
  });

  test('matches company/under_1b/retail rule correctly', () => {
    const result = resolveTaxBreakdown({
      amount: 200000,
      entityType: 'company',
      annualRevenueBand: 'under_1b',
      category: 'retail',
      businessRules: {
        pricing: {
          defaultTaxRate: 0.08,
          taxPrecision: 2,
          taxRules: [
            { entityType: 'company', annualRevenueBand: 'under_1b', category: 'retail', taxRate: 0.08 },
{ entityType: 'company', annualRevenueBand: '1b_3b', category: 'retail', taxRate: 0.08 }
          ]
        }
      }
    });

    expect(result.taxRate).toBe(0.08);
    expect(result.taxAmount).toBe(16000);
    expect(result.grossAmount).toBe(216000);
    expect(result.matchedRule).not.toBeNull();
    expect(result.matchedRule.entityType).toBe('company');
  });

test('matches company/1b_3b/retail rule with 8% rate', () => {
    const result = resolveTaxBreakdown({
      amount: 500000,
      entityType: 'company',
      annualRevenueBand: '1b_3b',
      category: 'retail',
      businessRules: {
        pricing: {
          defaultTaxRate: 0.08,
          taxPrecision: 2,
          taxRules: [
            { entityType: 'company', annualRevenueBand: 'under_1b', category: 'retail', taxRate: 0.08 },
            { entityType: 'company', annualRevenueBand: '1b_3b', category: 'retail', taxRate: 0.08 }
          ]
        }
      }
    });

    expect(result.taxRate).toBe(0.08);
    expect(result.taxAmount).toBe(40000);
    expect(result.grossAmount).toBe(540000);
  });

  test('household/under_1b/retail has 0% tax rate', () => {
    const result = resolveTaxBreakdown({
      amount: 100000,
      entityType: 'household',
      annualRevenueBand: 'under_1b',
      category: 'retail',
      businessRules: {
        pricing: {
          defaultTaxRate: 0.08,
          taxPrecision: 2,
          taxRules: [
            { entityType: 'household', annualRevenueBand: 'under_1b', category: 'retail', taxRate: 0 }
          ]
        }
      }
    });

    expect(result.taxRate).toBe(0);
    expect(result.taxAmount).toBe(0);
    expect(result.grossAmount).toBe(100000);
  });

  test('falls back to defaultTaxRate when no rule matches', () => {
    const result = resolveTaxBreakdown({
      amount: 100000,
      entityType: 'company',
      annualRevenueBand: 'over_3b',
      category: 'wholesale',
      businessRules: {
        pricing: {
          defaultTaxRate: 0.08,
          taxPrecision: 2,
          taxRules: [
            { entityType: 'company', annualRevenueBand: 'under_1b', category: 'retail', taxRate: 0.08 }
          ]
        }
      }
    });

    expect(result.taxRate).toBe(0.08);
    expect(result.matchedRule).toBeNull();
  });

  test('supports gross price mode (tax inclusive)', () => {
    const result = resolveTaxBreakdown({
      amount: 108000,
      entityType: 'company',
      annualRevenueBand: 'under_1b',
      category: 'retail',
      priceMode: 'gross',
      businessRules: {
        pricing: {
          defaultTaxRate: 0.08,
          taxPrecision: 2,
          taxRules: [
            { entityType: 'company', annualRevenueBand: 'under_1b', category: 'retail', taxRate: 0.08, priceMode: 'gross' }
          ]
        }
      }
    });

    expect(result.priceMode).toBe('gross');
    expect(result.grossAmount).toBe(108000);
    expect(result.netAmount).toBe(100000);
    expect(result.taxAmount).toBe(8000);
  });

  test('category matching works independently', () => {
    const result = resolveTaxBreakdown({
      amount: 100000,
      entityType: 'company',
      annualRevenueBand: 'under_1b',
      category: 'service',
      businessRules: {
        pricing: {
          defaultTaxRate: 0.08,
          taxPrecision: 2,
          taxRules: [
            { entityType: 'company', annualRevenueBand: '', category: 'retail', taxRate: 0.08 },
            { entityType: 'company', annualRevenueBand: '', category: 'service', taxRate: 0.1 }
          ]
        }
      }
    });

    expect(result.taxRate).toBe(0.1);
    expect(result.taxAmount).toBe(10000);
    expect(result.grossAmount).toBe(110000);
  });

  test('empty entityType in rule matches any entity type', () => {
    const result = resolveTaxBreakdown({
      amount: 100000,
      entityType: 'cooperative',
      annualRevenueBand: 'under_1b',
      category: 'retail',
      businessRules: {
        pricing: {
          defaultTaxRate: 0.08,
          taxPrecision: 2,
          taxRules: [
            { entityType: '', annualRevenueBand: 'under_1b', category: 'retail', taxRate: 0.05 }
          ]
        }
      }
    });

    expect(result.taxRate).toBe(0.05);
    expect(result.taxAmount).toBe(5000);
  });
});
