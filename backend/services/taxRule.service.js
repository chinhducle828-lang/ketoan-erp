/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { getBusinessRules } from '../config/businessRules.js';

const roundAmount = (value, precision = 2) => Number(Number(value || 0).toFixed(precision));

const normalizeTaxRule = (rule) => ({
  entityType: String(rule?.entityType || '').trim().toLowerCase(),
  annualRevenueBand: String(rule?.annualRevenueBand || '').trim().toLowerCase(),
  category: String(rule?.category || '').trim().toLowerCase(),
  taxRate: Number(rule?.taxRate ?? 0),
  priceMode: String(rule?.priceMode || 'net').trim().toLowerCase(),
  isTaxable: rule?.isTaxable !== false
});

export const resolveTaxBreakdown = ({
  amount,
  taxRate,
  entityType,
  annualRevenueBand,
  category,
  businessRules = null,
  priceMode = 'net'
}) => {
  const rules = businessRules || getBusinessRules();
  const precision = Number(rules?.pricing?.taxPrecision ?? 2);
  const defaultTaxRate = Number(rules?.pricing?.defaultTaxRate ?? 0.08);
  const configuredRules = Array.isArray(rules?.pricing?.taxRules)
    ? rules.pricing.taxRules.map(normalizeTaxRule)
    : [];

  const matchedRule = configuredRules.find((rule) => {
    if (!rule.entityType && !rule.annualRevenueBand && !rule.category) return false;
    const entityMatches = !rule.entityType || rule.entityType === String(entityType || '').trim().toLowerCase();
    const bandMatches = !rule.annualRevenueBand || rule.annualRevenueBand === String(annualRevenueBand || '').trim().toLowerCase();
    const categoryMatches = !rule.category || rule.category === String(category || '').trim().toLowerCase();
    return entityMatches && bandMatches && categoryMatches;
  });

  const effectiveTaxRate = Number((matchedRule?.taxRate ?? taxRate ?? defaultTaxRate) || 0);
  const effectivePriceMode = String(matchedRule?.priceMode || priceMode || 'net').trim().toLowerCase();
  const netAmount = roundAmount(Number(amount || 0), precision);

  if (effectivePriceMode === 'gross') {
    const grossAmount = roundAmount(netAmount, precision);
    const taxAmount = roundAmount(grossAmount - (grossAmount / (1 + effectiveTaxRate || 1)), precision);
    return {
      taxRate: effectiveTaxRate,
      taxAmount,
      netAmount: roundAmount(grossAmount / (1 + effectiveTaxRate || 1), precision),
      grossAmount,
      priceMode: effectivePriceMode,
      matchedRule: matchedRule || null
    };
  }

  const taxAmount = roundAmount(netAmount * effectiveTaxRate, precision);
  const grossAmount = roundAmount(netAmount + taxAmount, precision);

  return {
    taxRate: effectiveTaxRate,
    taxAmount,
    netAmount,
    grossAmount,
    priceMode: effectivePriceMode,
    matchedRule: matchedRule || null
  };
};
