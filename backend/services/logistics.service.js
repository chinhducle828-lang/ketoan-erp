import { getBusinessRules, getSaleRules } from '../config/businessRules.js';

export function buildOrderNumber(prefix = 'WEB') {
  const rules = getBusinessRules();
  const configuredPrefix = String(rules.voucher?.storefrontPrefix || 'WEB').trim() || 'WEB';
  const effectivePrefix = String(prefix || configuredPrefix).trim() || configuredPrefix;
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${effectivePrefix}-${stamp}-${random}`;
}

export function calculateTaxAmount(amount, taxRate = 0.1) {
  const rules = getBusinessRules();
  const precision = Number(rules.pricing?.taxPrecision ?? 2);
  const fallbackTaxRate = Number(rules.pricing?.defaultTaxRate ?? 0.1);
  const safeTaxRate = Number.isFinite(Number(taxRate)) ? Number(taxRate) : fallbackTaxRate;
  return Number((Number(amount || 0) * safeTaxRate).toFixed(precision));
}

export function buildAccountingEntries({ amount, costAmount, taxAmount }) {
  const saleRules = getSaleRules();
  const totalAmount = Number(amount || 0);
  const totalCostAmount = Number(costAmount || 0);
  const totalTaxAmount = Number(taxAmount || 0);

  return [
    { accountCode: saleRules.receivableAccount, entryType: 'DR', amount: totalAmount },
    { accountCode: saleRules.revenueAccount, entryType: 'CR', amount: Number(totalAmount - totalTaxAmount) },
    { accountCode: saleRules.vatAccount, entryType: 'CR', amount: totalTaxAmount },
    { accountCode: saleRules.cogsAccount, entryType: 'DR', amount: totalCostAmount },
    { accountCode: saleRules.inventoryAccount, entryType: 'CR', amount: totalCostAmount }
  ];
}
