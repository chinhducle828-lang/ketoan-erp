/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { classifyTransaction } from '../services/transactionClassification.js';

export const DEFAULT_PAYROLL_RATES = Object.freeze({
  employer: { bhxh: 0.175, bhyt: 0.03, bhtn: 0.01 },
  employee: { bhxh: 0.08, bhyt: 0.015, bhtn: 0.01 }
});

const DEFAULT_CURRENCY = 'VND';
const DEFAULT_TAX_RATE = 0.08;

export const getDefaultCurrency = () => DEFAULT_CURRENCY;
export const getDefaultTaxRate = () => DEFAULT_TAX_RATE;

export const normalizeVoucherPayload = (data, activeCompany) => {
  const companyId = activeCompany?.id ?? data?.companyId ?? data?.company_id ?? activeCompany ?? null;
  const normalized = {
    ...data,
    company_id: companyId ? Number(companyId) : undefined,
    voucher_date: data?.voucherDate || data?.voucher_date || new Date().toISOString().split('T')[0],
    voucher_type: data?.type || data?.voucher_type,
    description: data?.description || data?.desc || '',
    currency: data?.currency || DEFAULT_CURRENCY,
    exchange_rate: data?.exchangeRate ?? data?.exchange_rate ?? 1,
    details: (data?.details || []).map((detail) => ({
      accountCode: detail.accountCode || detail.account_code,
      entryType: detail.entryType || detail.entry_type,
      amount: Number(detail.amount || 0),
      partnerId: detail.partnerId ?? detail.partner_id ?? null,
      itemId: detail.itemId ?? detail.item_id ?? null,
      quantity: Number(detail.quantity || 0),
      itemName: detail.itemName || detail.item_name || null
    }))
  };

  return normalized;
};

export const getCorporateIncomeTaxRate = () => 0.2;

/**
 * Build purchase inventory details with AI classification fallback
 * Hybrid: uses AI suggestion when confidence >= 80%, falls back to hardcoded defaults
 */
export const buildPurchaseInventoryDetails = async ({ baseAmount, quantity = 1, partnerId = null, itemName = '', itemId = null, taxRate = DEFAULT_TAX_RATE, description = '' }) => {
  const amount = Math.round(Number(baseAmount) || 0);
  const qty = Math.max(1, Number(quantity) || 1);
  const effectiveTaxRate = Number(taxRate) || 0;
  const taxAmount = Math.round(amount * (effectiveTaxRate / 100));
  const totalPay = amount + taxAmount;

  // Default hardcoded accounts
  let inventoryAccount = '156';
  let taxAccount = '1331';
  let apAccount = '331';

  // Try AI classification if description is provided
  if (description) {
    try {
      const classification = await classifyTransaction({
        description,
        amount,
        partner_id: partnerId
      });
      
      if (classification?.success && classification?.classification?.account_code) {
        const suggestedAccount = classification.classification.account_code;
        if (classification.classification.confidence >= 80) {
          inventoryAccount = suggestedAccount;
        }
      }
    } catch (e) {
      // Use default accounts on error
      console.log('Using default accounts for purchase inventory');
    }
  }

  const details = [
    { accountCode: inventoryAccount, entryType: 'DR', amount, quantity: qty, partnerId, itemId, itemName },
  ];

  if (taxAmount > 0) {
    details.push({ accountCode: taxAccount, entryType: 'DR', amount: taxAmount });
  }

  details.push({ accountCode: apAccount, entryType: 'CR', amount: totalPay });
  return details;
};

/**
 * Build cash voucher details with AI classification fallback
 * Hybrid: uses AI suggestion when confidence >= 80%, falls back to hardcoded defaults
 */
export const buildCashVoucherDetails = async ({ amount, partnerId = null, entryType = 'DR', description = '' }) => {
  const value = Math.round(Number(amount) || 0);

  // Default hardcoded accounts
  let cashAccount = '1111';
  let contraAccount = '131';

  // Try AI classification if description is provided
  if (description) {
    try {
      const classification = await classifyTransaction({
        description,
        amount: value,
        partner_id: partnerId
      });
      
      if (classification?.success && classification?.classification?.account_code) {
        const suggestedAccount = classification.classification.account_code;
        if (classification.classification.confidence >= 80) {
          cashAccount = suggestedAccount;
        }
      }
    } catch (e) {
      // Use default accounts on error
      console.log('Using default accounts for cash voucher');
    }
  }

  return [
    { accountCode: cashAccount, entryType, amount: value, partnerId },
    { accountCode: contraAccount, entryType: entryType === 'DR' ? 'CR' : 'DR', amount: value, partnerId }
  ];
};

export const buildPayrollInsuranceDetails = (baseSalary, totalTaxTNCN, rates = DEFAULT_PAYROLL_RATES) => {
  const employerInsurance = Math.round(baseSalary * (rates.employer.bhxh + rates.employer.bhyt + rates.employer.bhtn));
  const employeeInsurance = Math.round(baseSalary * (rates.employee.bhxh + rates.employee.bhyt + rates.employee.bhtn));
  const bhxhCr = Math.round(baseSalary * rates.employer.bhxh) + Math.round(baseSalary * rates.employee.bhxh);
  const bhytCr = Math.round(baseSalary * rates.employer.bhyt) + Math.round(baseSalary * rates.employee.bhyt);
  const bhtnCr = Math.round(baseSalary * rates.employer.bhtn) + Math.round(baseSalary * rates.employee.bhtn);

  const details = [
    { accountCode: '6422', entryType: 'DR', amount: baseSalary },
    { accountCode: '334', entryType: 'CR', amount: baseSalary },
    { accountCode: '334', entryType: 'DR', amount: totalTaxTNCN },
    { accountCode: '3331', entryType: 'CR', amount: totalTaxTNCN },
    { accountCode: '6422', entryType: 'DR', amount: employerInsurance },
    { accountCode: '334', entryType: 'DR', amount: employeeInsurance },
    { accountCode: '3383', entryType: 'CR', amount: bhxhCr },
    { accountCode: '3384', entryType: 'CR', amount: bhytCr },
    { accountCode: '3386', entryType: 'CR', amount: bhtnCr }
  ];

  return { details, companyInsurance: employerInsurance, employeeInsurance, bhxhCr, bhytCr, bhtnCr };
};

/**
 * Get tax rate by partner ID (hybrid: API lookup + default fallback)
 * @param {number|null} partnerId - Partner ID for tax rate lookup
 * @param {number|null} companyId - Company ID for scoping
 * @returns {Promise<number>} Tax rate (e.g. 0.08 for 8%)
 */
export const getTaxRateByPartner = async (partnerId = null, companyId = null) => {
  // Default tax rate fallback
  let taxRate = DEFAULT_TAX_RATE;
  
  if (partnerId && companyId) {
    try {
      const api = (await import('./api.js')).default;
      const res = await api.get(`/settings/tax-rate?partner_id=${partnerId}&company_id=${companyId}`);
      if (res.data?.tax_rate) {
        taxRate = parseFloat(res.data.tax_rate) / 100;
      }
    } catch (e) {
      // Use default tax rate on error
      console.log('Using default tax rate');
    }
  }
  
  return taxRate;
};
