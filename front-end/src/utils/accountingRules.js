export const DEFAULT_PAYROLL_RATES = Object.freeze({
  employer: { bhxh: 0.175, bhyt: 0.03, bhtn: 0.01 },
  employee: { bhxh: 0.08, bhyt: 0.015, bhtn: 0.01 }
});

const DEFAULT_CURRENCY = 'VND';
const DEFAULT_TAX_RATE = 0.1;

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

export const buildPurchaseInventoryDetails = ({ baseAmount, quantity = 1, partnerId = null, itemName = '', taxRate = DEFAULT_TAX_RATE }) => {
  const amount = Math.round(Number(baseAmount) || 0);
  const qty = Math.max(1, Number(quantity) || 1);
  const effectiveTaxRate = Number(taxRate) || 0;
  const taxAmount = Math.round(amount * (effectiveTaxRate / 100));
  const totalPay = amount + taxAmount;

  const details = [
    { accountCode: '156', entryType: 'DR', amount, quantity: qty, partnerId, itemName },
  ];

  if (taxAmount > 0) {
    details.push({ accountCode: '1331', entryType: 'DR', amount: taxAmount });
  }

  details.push({ accountCode: '331', entryType: 'CR', amount: totalPay });
  return details;
};

export const buildCashVoucherDetails = ({ amount, partnerId = null, entryType = 'DR' }) => {
  const value = Math.round(Number(amount) || 0);
  return [
    { accountCode: '1111', entryType, amount: value, partnerId },
    { accountCode: '131', entryType: entryType === 'DR' ? 'CR' : 'DR', amount: value, partnerId }
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
