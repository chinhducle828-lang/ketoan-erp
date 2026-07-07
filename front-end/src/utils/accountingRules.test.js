import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeVoucherPayload,
  getCorporateIncomeTaxRate,
  buildPayrollInsuranceDetails,
  getDefaultCurrency,
  getDefaultTaxRate,
  buildPurchaseInventoryDetails,
  buildCashVoucherDetails
} from './accountingRules.js';

test('normalizeVoucherPayload maps legacy payload fields to backend keys', () => {
  const normalized = normalizeVoucherPayload({
    companyId: 42,
    voucherDate: '2026-01-15',
    type: 'NK',
    description: 'Mua hàng',
    exchangeRate: 1,
    details: [{ accountCode: '156', entryType: 'DR', amount: 1000 }]
  }, { id: 42 });

  assert.equal(normalized.company_id, 42);
  assert.equal(normalized.voucher_date, '2026-01-15');
  assert.equal(normalized.voucher_type, 'NK');
  assert.equal(normalized.details[0].accountCode, '156');
});

test('getCorporateIncomeTaxRate returns the current legal rate', () => {
  assert.equal(getCorporateIncomeTaxRate(), 0.2);
});

test('buildPayrollInsuranceDetails uses configurable rates', () => {
  const result = buildPayrollInsuranceDetails(10000000, 1000000, {
    employer: { bhxh: 0.18, bhyt: 0.03, bhtn: 0.01 },
    employee: { bhxh: 0.08, bhyt: 0.015, bhtn: 0.01 }
  });

  assert.equal(result.companyInsurance, 2200000);
  assert.equal(result.employeeInsurance, 1050000);
  assert.equal(result.bhxhCr, 2600000);
});

test('shared accounting defaults are centralized and stable', () => {
  assert.equal(getDefaultCurrency(), 'VND');
assert.equal(getDefaultTaxRate(), 0.08);
});

test('purchase and cash voucher builders produce balanced accounting lines', () => {
  const purchaseDetails = buildPurchaseInventoryDetails({ baseAmount: 1000000, quantity: 2, partnerId: 7, itemName: 'Máy in', taxRate: 0.1 });
  const cashDetails = buildCashVoucherDetails({ amount: 500000, partnerId: 12, entryType: 'DR' });

  assert.equal(purchaseDetails[0].accountCode, '156');
  assert.equal(purchaseDetails[1].accountCode, '1331');
  assert.equal(purchaseDetails[2].accountCode, '331');
  assert.equal(cashDetails[0].accountCode, '1111');
  assert.equal(cashDetails[1].accountCode, '131');
});
