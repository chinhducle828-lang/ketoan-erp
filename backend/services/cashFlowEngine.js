import { pool } from '../config/db.js';

/**
 * BÁO CÁO LƯU CHUYỂN TIỀN TỆ (B03-DN)
 * Hỗ trợ 2 phương pháp: Trực tiếp (Direct) và Gián tiếp (Indirect)
 * Chuẩn Thông tư 99/2025/TT-BTC
 */

/**
 * Phương pháp Trực tiếp (Direct Method)
 * Quét chéo dữ liệu đối ứng từ TK 111/112
 */
export async function calculateCashFlowDirect(companyId, year = null) {
  const conditions = ['v.company_id = $1'];
  const params = [companyId];
  let paramIndex = 2;

  if (year) {
    conditions.push(`EXTRACT(YEAR FROM v.voucher_date) = $${paramIndex}`);
    params.push(year);
    paramIndex++;
  }

  // 1. Tiền thu từ bán hàng (DR 111/112 + CR 511/3331/131)
  const salesQuery = `
    SELECT 
      SUM(vd.amount) as total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE ${conditions.join(' AND ')}
      AND (vd.account_code LIKE '111%' OR vd.account_code LIKE '112%')
      AND EXISTS (
        SELECT 1 FROM voucher_details vd2 
        WHERE vd2.voucher_id = vd.voucher_id 
        AND (vd2.account_code LIKE '511%' OR vd2.account_code LIKE '3331%' OR vd2.account_code LIKE '131%')
      )
  `;

  // 2. Tiền chi trả NCC (CR 111/112 + DR 331/152/156/242)
  const supplierPaymentQuery = `
    SELECT 
      SUM(vd.amount) as total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE ${conditions.join(' AND ')}
      AND (vd.account_code LIKE '111%' OR vd.account_code LIKE '112%')
      AND EXISTS (
        SELECT 1 FROM voucher_details vd2 
        WHERE vd2.voucher_id = vd.voucher_id 
        AND (vd2.account_code LIKE '331%' OR vd2.account_code LIKE '152%' OR vd2.account_code LIKE '156%' OR vd2.account_code LIKE '242%')
      )
  `;

  // 3. Tiền chi trả NLĐ (CR 111/112 + DR 334)
  const salaryPaymentQuery = `
    SELECT 
      SUM(vd.amount) as total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE ${conditions.join(' AND ')}
      AND (vd.account_code LIKE '111%' OR vd.account_code LIKE '112%')
      AND EXISTS (
        SELECT 1 FROM voucher_details vd2 
        WHERE vd2.voucher_id = vd.voucher_id 
        AND vd2.account_code LIKE '334%'
      )
  `;

  // Thực thi các truy vấn
  const [salesRes, supplierRes, salaryRes] = await Promise.all([
    pool.query(salesQuery, params),
    pool.query(supplierPaymentQuery, params),
    pool.query(salaryPaymentQuery, params)
  ]);

  return {
    method: 'direct',
    operatingActivities: {
      cashReceivedFromCustomers: parseFloat(salesRes.rows[0]?.total) || 0,
      cashPaidToSuppliers: parseFloat(supplierRes.rows[0]?.total) || 0,
      cashPaidToEmployees: parseFloat(salaryRes.rows[0]?.total) || 0
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
  const conditions = ['v.company_id = $1'];
  const params = [companyId];
  let paramIndex = 2;

  if (year) {
    conditions.push(`EXTRACT(YEAR FROM v.voucher_date) = $${paramIndex}`);
    params.push(year);
    paramIndex++;
  }

  // 1. Lợi nhuận trước thuế (từ TK 5xx, 6xx, 7xx, 8xx)
  const profitQuery = `
    SELECT 
      SUM(CASE WHEN vd.account_code LIKE '5%' AND vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as revenue,
      SUM(CASE WHEN vd.account_code LIKE '6%' AND vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as expenses,
      SUM(CASE WHEN vd.account_code LIKE '7%' AND vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as other_income,
      SUM(CASE WHEN vd.account_code LIKE '8%' AND vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as other_expenses
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
      AND vd.account_code LIKE '214%'
  `;

  // 3. Dự phòng (TK 2293, 2294, 2295 - Thông tư 99)
  const provisionQuery = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) -
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as provisions
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE ${conditions.join(' AND ')}
      AND (vd.account_code LIKE '2293%' OR vd.account_code LIKE '2294%' OR vd.account_code LIKE '2295%')
  `;

  // 4. Biến động vốn lưu động (TK 131, 152/156, 331)
  const workingCapitalQuery = `
    SELECT 
      -- TK 131: Phải thu khách hàng
      SUM(CASE WHEN vd.account_code LIKE '131%' AND vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) -
      SUM(CASE WHEN vd.account_code LIKE '131%' AND vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as ar_change,
      -- TK 152/156: Hàng tồn kho
      SUM(CASE WHEN vd.account_code LIKE '152%' AND vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) -
      SUM(CASE WHEN vd.account_code LIKE '152%' AND vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as inventory_change,
      -- TK 331: Phải trả người bán
      SUM(CASE WHEN vd.account_code LIKE '331%' AND vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) -
      SUM(CASE WHEN vd.account_code LIKE '331%' AND vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as ap_change
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
      AND vd.account_code LIKE '341%'
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