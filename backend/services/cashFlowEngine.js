/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { pool } from '../config/db.js';
import { getCashFlowRules } from '../config/businessRules.js';

/**
 * BÁO CÁO LƯU CHUYỂN TIỀN TỆ (B03-DN)
 * Hỗ trợ 2 phương pháp: Trực tiếp (Direct) và Gián tiếp (Indirect)
 * Chuẩn Thông tư 99/2025/TT-BTC
 */

const buildLikeCondition = (fieldExpr, prefixes, params) => {
  const safePrefixes = (Array.isArray(prefixes) ? prefixes : [])
    .map((prefix) => String(prefix || '').trim())
    .filter(Boolean);

  if (safePrefixes.length === 0) return '1=0';

  const clauses = safePrefixes.map((prefix) => {
    params.push(`${prefix}%`);
    return `${fieldExpr} LIKE $${params.length}`;
  });

  return `(${clauses.join(' OR ')})`;
};

const getScopedConditions = (companyId, year = null) => {
  const conditions = ['v.company_id = $1'];
  const params = [companyId];

  if (year) {
    params.push(year);
    conditions.push(`EXTRACT(YEAR FROM v.voucher_date) = $${params.length}`);
  }

  return { conditions, params };
};

/**
 * Phương pháp Trực tiếp (Direct Method)
 * Quét chéo dữ liệu đối ứng từ TK 111/112
 */
export async function calculateCashFlowDirect(companyId, year = null) {
  const cashFlowRules = getCashFlowRules();
  const directRules = cashFlowRules.directMethod || {};
  const cashAccountPrefixes = cashFlowRules.cashAccountPrefixes || ['111', '112'];

  const runDirectAggregate = async (counterpartPrefixes) => {
    const { conditions, params } = getScopedConditions(companyId, year);
    const cashCondition = buildLikeCondition('vd.account_code', cashAccountPrefixes, params);
    const counterpartCondition = buildLikeCondition('vd2.account_code', counterpartPrefixes, params);

    const query = `
      SELECT SUM(vd.amount) as total
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE ${conditions.join(' AND ')}
        AND ${cashCondition}
        AND EXISTS (
          SELECT 1 FROM voucher_details vd2
          WHERE vd2.voucher_id = vd.voucher_id
            AND ${counterpartCondition}
        )
    `;

    const { rows } = await pool.query(query, params);
    return parseFloat(rows[0]?.total) || 0;
  };

  const [cashReceivedFromCustomers, cashPaidToSuppliers, cashPaidToEmployees] = await Promise.all([
    runDirectAggregate(directRules.salesCounterpartPrefixes || ['511', '3331', '131']),
    runDirectAggregate(directRules.supplierPaymentCounterpartPrefixes || ['331', '152', '156', '242']),
    runDirectAggregate(directRules.salaryCounterpartPrefixes || ['334'])
  ]);

  return {
    method: 'direct',
    operatingActivities: {
      cashReceivedFromCustomers,
      cashPaidToSuppliers,
      cashPaidToEmployees
    },
    investingActivities: {
      cashReceivedFromInvestments: 0,
      cashPaidForInvestments: 0
    },
    financingActivities: {
      cashReceivedFromLoans: 0,
      cashPaidForLoans: 0,
      cashReceivedFromOwner: 0,
      cashPaidToOwner: 0
    }
  };
}

/**
 * Phương pháp Gián tiếp (Indirect Method)
 * Dựa trên lợi nhuận trước thuế
 */
export async function calculateCashFlowIndirect(companyId, year = null) {
  const cashFlowRules = getCashFlowRules();
  const indirectRules = cashFlowRules.indirectMethod || {};
  const { conditions, params } = getScopedConditions(companyId, year);

  const revenueCondition = buildLikeCondition('vd.account_code', indirectRules.revenuePrefixes || ['5'], params);
  const expenseCondition = buildLikeCondition('vd.account_code', indirectRules.expensePrefixes || ['6'], params);
  const otherIncomeCondition = buildLikeCondition('vd.account_code', indirectRules.otherIncomePrefixes || ['7'], params);
  const otherExpenseCondition = buildLikeCondition('vd.account_code', indirectRules.otherExpensePrefixes || ['8'], params);
  const depreciationCondition = buildLikeCondition('vd.account_code', indirectRules.depreciationPrefixes || ['214'], params);
  const provisionCondition = buildLikeCondition('vd.account_code', indirectRules.provisionPrefixes || ['2293', '2294', '2295'], params);
  const arCondition = buildLikeCondition('vd.account_code', indirectRules.accountsReceivablePrefixes || ['131'], params);
  const inventoryCondition = buildLikeCondition('vd.account_code', indirectRules.inventoryPrefixes || ['152'], params);
  const apCondition = buildLikeCondition('vd.account_code', indirectRules.accountsPayablePrefixes || ['331'], params);
  const financingCondition = buildLikeCondition('vd.account_code', indirectRules.financingPrefixes || ['341'], params);

  // 1. Lợi nhuận trước thuế (từ TK 5xx, 6xx, 7xx, 8xx)
  const profitQuery = `
    SELECT 
      SUM(CASE WHEN ${revenueCondition} AND vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as revenue,
      SUM(CASE WHEN ${expenseCondition} AND vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as expenses,
      SUM(CASE WHEN ${otherIncomeCondition} AND vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as other_income,
      SUM(CASE WHEN ${otherExpenseCondition} AND vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as other_expenses
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE ${conditions.join(' AND ')}
  `;

  // 2. Khấu hao TSCĐ (TK 214)
  const depreciationQuery = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) -
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as depreciation
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE ${conditions.join(' AND ')}
      AND ${depreciationCondition}
  `;

  // 3. Dự phòng (TK 2293, 2294, 2295 - Thông tư 99)
  const provisionQuery = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) -
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as provisions
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE ${conditions.join(' AND ')}
      AND ${provisionCondition}
  `;

  // 4. Biến động vốn lưu động (TK 131, 152/156, 331)
  const workingCapitalQuery = `
    SELECT 
      -- TK 131: Phải thu khách hàng
      SUM(CASE WHEN ${arCondition} AND vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) -
      SUM(CASE WHEN ${arCondition} AND vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as ar_change,
      -- TK 152/156: Hàng tồn kho
      SUM(CASE WHEN ${inventoryCondition} AND vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) -
      SUM(CASE WHEN ${inventoryCondition} AND vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as inventory_change,
      -- TK 331: Phải trả người bán
      SUM(CASE WHEN ${apCondition} AND vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) -
      SUM(CASE WHEN ${apCondition} AND vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as ap_change
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE ${conditions.join(' AND ')}
  `;

  // 5. Hoạt động tài chính (TK 341)
  const financingQuery = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as loan_received,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as loan_paid
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE ${conditions.join(' AND ')}
      AND ${financingCondition}
  `;

  // Thực thi các truy vấn
  const [profitRes, depreciationRes, provisionRes, workingCapitalRes, financingRes] = await Promise.all([
    pool.query(profitQuery, params),
    pool.query(depreciationQuery, params),
    pool.query(provisionQuery, params),
    pool.query(workingCapitalQuery, params),
    pool.query(financingQuery, params)
  ]);

  const profitData = profitRes.rows[0] || {};
  const workingCapitalData = workingCapitalRes.rows[0] || {};
  const financingData = financingRes.rows[0] || {};

  // Tính toán lợi nhuận trước thuế
  const profitBeforeTax = (parseFloat(profitData.revenue) || 0) 
    - (parseFloat(profitData.expenses) || 0) 
    + (parseFloat(profitData.other_income) || 0) 
    - (parseFloat(profitData.other_expenses) || 0);

  // Tính toán dòng tiền từ hoạt động tài chính
  const cashFromFinancing = (parseFloat(financingData.loan_received) || 0) 
    - (parseFloat(financingData.loan_paid) || 0);

  return {
    method: 'indirect',
    profitBeforeTax: profitBeforeTax,
    adjustments: {
      depreciation: Math.abs(parseFloat(depreciationRes.rows[0]?.depreciation) || 0),
      provisions: Math.abs(parseFloat(provisionRes.rows[0]?.provisions) || 0),
      workingCapitalChanges: {
        accountsReceivable: parseFloat(workingCapitalData.ar_change) || 0,
        inventory: parseFloat(workingCapitalData.inventory_change) || 0,
        accountsPayable: parseFloat(workingCapitalData.ap_change) || 0
      }
    },
    financingActivities: {
      cashFromLoans: parseFloat(financingData.loan_received) || 0,
      cashToLoans: parseFloat(financingData.loan_paid) || 0,
      netCashFromFinancing: cashFromFinancing
    }
  };
}

/**
 * Lấy dữ liệu báo cáo lưu chuyển tiền tệ tổng hợp
 */
export async function getCashFlowData(companyId, year = null, method = 'indirect') {
  if (method === 'direct') {
    return await calculateCashFlowDirect(companyId, year);
  }
  return await calculateCashFlowIndirect(companyId, year);
}

// END_OF_FILE