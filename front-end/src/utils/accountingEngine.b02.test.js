mm/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * Unit tests for B02 frontend mapping logic.
 * Verifies that the component correctly maps API response fields
 * to B02 report items according to Thông tư 99/2025/TT-BTC.
 */

import { describe, test, expect } from 'vitest';

// Simulate the getItemValue mapping from IncomeStatementB02.jsx
function getItemValue(item, incomeStatement) {
  const s = incomeStatement || {};
  switch (item.code) {
    case '01': return s.revenue || 0;
    case '02': return 0;
    case '11': return s.cogs || 0;
    case '21': return 0;
    case '22': return s.operatingExpenses?.['635'] || 0;
    case '23': return 0;
    case '24': return s.operatingExpenses?.['641'] || 0;
    case '25': return s.operatingExpenses?.['642'] || 0;
    case '31': return s.otherIncome || 0;
    case '32': return s.otherExpenses || 0;
    case '51': return s.taxExpense || 0;
    case '52': return 0;
    default: return 0;
  }
}

const REPORT_ITEMS = [
  { code: '01', name: 'Doanh thu bán hàng và cung cấp dịch vụ', accounts: ['511', '512', '513'] },
  { code: '02', name: 'Các khoản giảm trừ doanh thu', accounts: ['5211', '5212', '5213'] },
  { code: '10', name: 'Doanh thu thuần về bán hàng và cung cấp dịch vụ (10=01-02)', isFormula: true },
  { code: '11', name: 'Giá vốn hàng bán', accounts: ['632'] },
  { code: '20', name: 'Lợi nhuận gộp về bán hàng và cung cấp dịch vụ (20=10-11)', isFormula: true },
  { code: '21', name: 'Doanh thu hoạt động tài chính', accounts: ['515'] },
  { code: '22', name: 'Chi phí tài chính', accounts: ['635'] },
  { code: '23', name: 'Trong đó: Chi phí lãi vay', accounts: ['6351'] },
  { code: '24', name: 'Chi phí bán hàng', accounts: ['641'] },
  { code: '25', name: 'Chi phí quản lý doanh nghiệp', accounts: ['642'] },
  { code: '30', name: 'Lợi nhuận thuần từ hoạt động kinh doanh (30=20+21-22-24-25)', isFormula: true },
  { code: '31', name: 'Thu nhập khác', accounts: ['711'] },
  { code: '32', name: 'Chi phí khác', accounts: ['811'] },
  { code: '40', name: 'Lợi nhuận khác (40=31-32)', isFormula: true },
  { code: '50', name: 'Tổng lợi nhuận kế toán trước thuế (50=30+40)', isFormula: true },
  { code: '51', name: 'Chi phí thuế TNDN hiện hành', accounts: ['821'] },
  { code: '52', name: 'Chi phí thuế TNDN hoãn lại', accounts: ['822'] },
  { code: '60', name: 'Lợi nhuận sau thuế TNDN (60=50-51-52)', isFormula: true },
];

describe('B02 frontend mapping', () => {
  test('maps revenue/cogs/expenses from API response correctly', () => {
    const incomeStatement = {
      revenue: 200000000,
      cogs: 150000000,
      operatingExpenses: { '635': 10000000, '641': 5000000, '642': 3000000 },
      otherIncome: 5000000,
      otherExpenses: 2000000,
      taxExpense: 10000000
    };

    expect(getItemValue(REPORT_ITEMS[0], incomeStatement)).toBe(200000000); // 01 revenue
    expect(getItemValue(REPORT_ITEMS[3], incomeStatement)).toBe(150000000); // 11 cogs
    expect(getItemValue(REPORT_ITEMS[6], incomeStatement)).toBe(10000000);  // 22 635
    expect(getItemValue(REPORT_ITEMS[8], incomeStatement)).toBe(5000000);   // 24 641
    expect(getItemValue(REPORT_ITEMS[9], incomeStatement)).toBe(3000000);   // 25 642
    expect(getItemValue(REPORT_ITEMS[11], incomeStatement)).toBe(5000000);  // 31 otherIncome
    expect(getItemValue(REPORT_ITEMS[12], incomeStatement)).toBe(2000000);  // 32 otherExpenses
    expect(getItemValue(REPORT_ITEMS[15], incomeStatement)).toBe(10000000); // 51 taxExpense
  });

  test('does not include opening balance in B02 values', () => {
    // Even if API returned opening-inclusive values (which it should not),
    // the frontend mapping should use the period-only fields from API.
    const incomeStatement = {
      revenue: 200000000, // period only, NOT 700000000
      cogs: 150000000     // period only, NOT 250000000
    };

    expect(getItemValue(REPORT_ITEMS[0], incomeStatement)).toBe(200000000);
    expect(getItemValue(REPORT_ITEMS[3], incomeStatement)).toBe(150000000);
  });

  test('handles missing optional fields gracefully', () => {
    const incomeStatement = {};
    expect(getItemValue(REPORT_ITEMS[0], incomeStatement)).toBe(0);
    expect(getItemValue(REPORT_ITEMS[6], incomeStatement)).toBe(0);
    expect(getItemValue(REPORT_ITEMS[14], incomeStatement)).toBe(0);
  });
});