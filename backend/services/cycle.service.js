import { pool } from '../config/db.js';
import { getPeriodBalanceSummary } from './summary.service.js';

async function getSummaryMap(companyId, accountCodes, year = null) {
  const summary = await getPeriodBalanceSummary(companyId, accountCodes, year);
  return Object.fromEntries(summary.map((entry) => [entry.account_code, entry]));
}

/**
 * DỊCH VỤ TÍNH TOÁN 9 CHU TRÌNH NGHIỆP VỤ
 * Tính toán dữ liệu thực tế từ các tài khoản kế toán
 */

/**
 * Chu trình 1: Vốn góp & Đầu tư tài chính (TK 411, 121, 128, 221, 515)
 */
export async function getCycle1Data(companyId, year = null) {
  const accounts = ['411', '121', '128', '221', '515'];
  const data = {};
  let total = 0;
  const summaryMap = await getSummaryMap(companyId, accounts, year);

  for (const acc of accounts) {
    const row = summaryMap[acc] || { debit: 0, credit: 0 };
    data[acc] = { debit: row.debit, credit: row.credit, net: row.debit - row.credit };
    total += acc === '411' || acc === '515' ? row.credit : row.debit;
  }

  return {
    name: 'Vốn góp & Đầu tư tài chính',
    data,
    total
  };
}

/**
 * Chu trình 2: Mua sắm vật tư & Công nợ phải trả (TK 152, 156, 1331, 331)
 */
export async function getCycle2Data(companyId, year = null) {
  const data = {};
  let total = 0;
  const accounts = ['152', '156', '1331', '331'];
  const summaryMap = await getSummaryMap(companyId, accounts, year);

  data['152'] = (summaryMap['152']?.debit || 0) + (summaryMap['152']?.credit || 0);
  data['156'] = (summaryMap['156']?.debit || 0) + (summaryMap['156']?.credit || 0);
  data['1331'] = (summaryMap['1331']?.debit || 0) + (summaryMap['1331']?.credit || 0);
  data['331'] = (summaryMap['331']?.debit || 0) - (summaryMap['331']?.credit || 0);

  total += data['152'] + data['156'] + data['1331'] + Math.abs(data['331']);

  return {
    name: 'Mua sắm vật tư & Công nợ phải trả',
    data,
    total
  };
}

/**
 * Chu trình 3: Bán hàng & Phải thu khách hàng (TK 632, 156, 131, 511, 3331)
 */
export async function getCycle3Data(companyId, year = null) {
  const data = {};
  let total = 0;
  const accounts = ['632', '156', '131', '511', '3331'];
  const summaryMap = await getSummaryMap(companyId, accounts, year);

  data['632'] = (summaryMap['632']?.debit || 0) + (summaryMap['632']?.credit || 0);
  data['156'] = (summaryMap['156']?.debit || 0) + (summaryMap['156']?.credit || 0);
  data['131'] = (summaryMap['131']?.debit || 0) - (summaryMap['131']?.credit || 0);
  data['511'] = (summaryMap['511']?.debit || 0) + (summaryMap['511']?.credit || 0);
  data['3331'] = (summaryMap['3331']?.debit || 0) - (summaryMap['3331']?.credit || 0);

  total += data['632'] + data['156'] + Math.abs(data['131']) + data['511'] + Math.abs(data['3331']);

  return {
    name: 'Bán hàng & Phải thu khách hàng',
    data,
    total
  };
}

/**
 * Chu trình 4: Tiền lương & Bảo hiểm (TK 622, 641, 642, 334, 338)
 */
export async function getCycle4Data(companyId, year = null) {
  const data = {};
  let total = 0;

  const accounts = ['622', '641', '642', '334', '338'];
  const summaryMap = await getSummaryMap(companyId, accounts, year);

  for (const acc of accounts) {
    const row = summaryMap[acc] || { debit: 0, credit: 0 };
    data[acc] = row.debit + row.credit;
    total += data[acc];
  }

  return {
    name: 'Tiền lương & Bảo hiểm',
    data,
    total
  };
}

/**
 * Chu trình 5: Tài sản cố định (TK 211, 214, 1332, 331)
 */
export async function getCycle5Data(companyId, year = null) {
  const data = {};
  let total = 0;
  const accounts = ['211', '214', '1332', '331'];
  const summaryMap = await getSummaryMap(companyId, accounts, year);

  data['211'] = (summaryMap['211']?.debit || 0) + (summaryMap['211']?.credit || 0);
  data['214'] = (summaryMap['214']?.debit || 0) - (summaryMap['214']?.credit || 0);
  data['1332'] = (summaryMap['1332']?.debit || 0) + (summaryMap['1332']?.credit || 0);
  data['331'] = (summaryMap['331']?.debit || 0) - (summaryMap['331']?.credit || 0);

  total += data['211'] + Math.abs(data['214']) + data['1332'] + Math.abs(data['331']);
    data,
    total
  };
}

/**
 * Chu trình 6: Tập hợp chi phí & Giá thành (TK 154, 621, 622, 627)
 */
export async function getCycle6Data(companyId, year = null) {
  const data = {};
  let total = 0;

  const accounts = ['154', '621', '622', '627'];
  const summaryMap = await getSummaryMap(companyId, accounts, year);

  for (const acc of accounts) {
    const row = summaryMap[acc] || { debit: 0, credit: 0 };
    data[acc] = row.debit + row.credit;
    total += data[acc];
  }

  return {
    name: 'Tập hợp chi phí & Giá thành',
    data,
    total
  };
}

/**
 * Chu trình 7: Vay & Chi phí tài chính (TK 341, 635, 335)
 */
export async function getCycle7Data(companyId, year = null) {
  const data = {};
  let total = 0;
  const accounts = ['341', '635', '335'];
  const summaryMap = await getSummaryMap(companyId, accounts, year);

  data['341'] = (summaryMap['341']?.debit || 0) - (summaryMap['341']?.credit || 0);
  data['635'] = (summaryMap['635']?.debit || 0) + (summaryMap['635']?.credit || 0);
  data['335'] = (summaryMap['335']?.debit || 0) + (summaryMap['335']?.credit || 0);

  total += Math.abs(data['341']) + data['635'] + data['335'];

  return {
    name: 'Vay & Chi phí tài chính',
    data,
    total
  };
}

/**
 * Chu trình 8: Kế toán Thuế (TK 3331, 133)
 */
export async function getCycle8Data(companyId, year = null) {
  const data = {};
  let total = 0;
  const accounts = ['3331', '133'];
  const summaryMap = await getSummaryMap(companyId, accounts, year);

  data['3331'] = (summaryMap['3331']?.debit || 0) - (summaryMap['3331']?.credit || 0);
  data['133'] = (summaryMap['133']?.debit || 0) - (summaryMap['133']?.credit || 0);

  total += Math.abs(data['3331']) + Math.abs(data['133']);

  return {
    name: 'Kế toán Thuế',
    data,
    total
  };
}

/**
 * Chu trình 9: Khóa sổ kết chuyển (TK 911, 4212)
 */
export async function getCycle9Data(companyId, year = null) {
  const data = {};
  let total = 0;
  const accounts = ['911', '4212'];
  const summaryMap = await getSummaryMap(companyId, accounts, year);

  data['911'] = (summaryMap['911']?.debit || 0) - (summaryMap['911']?.credit || 0);
  data['4212'] = (summaryMap['4212']?.credit || 0) - (summaryMap['4212']?.debit || 0);

  total += Math.abs(data['911']) + Math.abs(data['4212']);

  return {
    name: 'Khóa sổ kết chuyển',
    data,
    total
  };
}

/**
 * Lấy dữ liệu tổng hợp 9 chu trình nghiệp vụ
 */
export async function getCycleData(companyId, year = null) {
  const [cycle1, cycle2, cycle3, cycle4, cycle5, cycle6, cycle7, cycle8, cycle9] = await Promise.all([
    getCycle1Data(companyId, year),
    getCycle2Data(companyId, year),
    getCycle3Data(companyId, year),
    getCycle4Data(companyId, year),
    getCycle5Data(companyId, year),
    getCycle6Data(companyId, year),
    getCycle7Data(companyId, year),
    getCycle8Data(companyId, year),
    getCycle9Data(companyId, year)
  ]);

  return {
    cycle1,
    cycle2,
    cycle3,
    cycle4,
    cycle5,
    cycle6,
    cycle7,
    cycle8,
    cycle9
  };
}