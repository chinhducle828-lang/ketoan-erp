import { pool } from '../config/db.js';

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

  for (const acc of accounts) {
    const query = `
      SELECT 
        SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
        SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
        AND vd.account_code LIKE $2
        ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $3` : ''}
    `;
    
    const params = [companyId, `${acc}%`];
    if (year) params.push(year);
    
    const { rows } = await pool.query(query, params);
    
    if (rows.length > 0) {
      const debit = parseFloat(rows[0].debit_total) || 0;
      const credit = parseFloat(rows[0].credit_total) || 0;
      data[acc] = { debit, credit, net: debit - credit };
      total += acc === '411' ? credit : (acc === '515' ? credit : debit);
    }
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

  // TK 152 - Nguyên liệu, vật liệu tồn kho
  const query152 = `
    SELECT SUM(vd.amount) as total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE '152%'
      ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $2` : ''}
  `;
  const { rows: rows152 } = await pool.query(query152, year ? [companyId, year] : [companyId]);
  data['152'] = parseFloat(rows152[0]?.total) || 0;
  total += data['152'];

  // TK 156 - Hàng hóa kho tổng
  const query156 = `
    SELECT SUM(vd.amount) as total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE '156%'
      ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $2` : ''}
  `;
  const { rows: rows156 } = await pool.query(query156, year ? [companyId, year] : [companyId]);
  data['156'] = parseFloat(rows156[0]?.total) || 0;
  total += data['156'];

  // TK 1331 - Thuế GTGT được khấu trừ
  const query1331 = `
    SELECT SUM(vd.amount) as total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE '1331%'
      ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $2` : ''}
  `;
  const { rows: rows1331 } = await pool.query(query1331, year ? [companyId, year] : [companyId]);
  data['1331'] = parseFloat(rows1331[0]?.total) || 0;
  total += data['1331'];

  // TK 331 - Phải trả cho người bán
  const query331 = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE '331%'
      ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $2` : ''}
  `;
  const { rows: rows331 } = await pool.query(query331, year ? [companyId, year] : [companyId]);
  data['331'] = (parseFloat(rows331[0]?.debit_total) || 0) - (parseFloat(rows331[0]?.credit_total) || 0);
  total += Math.abs(data['331']);

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

  // TK 632 - Giá vốn hàng bán
  const query632 = `
    SELECT SUM(vd.amount) as total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE '632%'
      ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $2` : ''}
  `;
  const { rows: rows632 } = await pool.query(query632, year ? [companyId, year] : [companyId]);
  data['632'] = parseFloat(rows632[0]?.total) || 0;
  total += data['632'];

  // TK 156 - Hàng hóa xuất kho
  const query156 = `
    SELECT SUM(vd.amount) as total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE '156%'
      ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $2` : ''}
  `;
  const { rows: rows156 } = await pool.query(query156, year ? [companyId, year] : [companyId]);
  data['156'] = parseFloat(rows156[0]?.total) || 0;
  total += data['156'];

  // TK 131 - Phải thu khách hàng
  const query131 = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE '131%'
      ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $2` : ''}
  `;
  const { rows: rows131 } = await pool.query(query131, year ? [companyId, year] : [companyId]);
  data['131'] = (parseFloat(rows131[0]?.debit_total) || 0) - (parseFloat(rows131[0]?.credit_total) || 0);
  total += Math.abs(data['131']);

  // TK 511 - Doanh thu bán hàng
  const query511 = `
    SELECT SUM(vd.amount) as total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE '511%'
      ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $2` : ''}
  `;
  const { rows: rows511 } = await pool.query(query511, year ? [companyId, year] : [companyId]);
  data['511'] = parseFloat(rows511[0]?.total) || 0;
  total += data['511'];

  // TK 3331 - Thuế GTGT phải nộp
  const query3331 = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE '3331%'
      ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $2` : ''}
  `;
  const { rows: rows3331 } = await pool.query(query3331, year ? [companyId, year] : [companyId]);
  data['3331'] = (parseFloat(rows3331[0]?.debit_total) || 0) - (parseFloat(rows3331[0]?.credit_total) || 0);
  total += Math.abs(data['3331']);

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

  for (const acc of accounts) {
    const query = `
      SELECT SUM(vd.amount) as total
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
        AND vd.account_code LIKE $2
        ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $3` : ''}
    `;
    
    const params = [companyId, `${acc}%`];
    if (year) params.push(year);
    
    const { rows } = await pool.query(query, params);
    data[acc] = parseFloat(rows[0]?.total) || 0;
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

  // TK 211 - Tài sản cố định hữu hình
  const query211 = `
    SELECT SUM(vd.amount) as total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE '211%'
      ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $2` : ''}
  `;
  const { rows: rows211 } = await pool.query(query211, year ? [companyId, year] : [companyId]);
  data['211'] = parseFloat(rows211[0]?.total) || 0;
  total += data['211'];

  // TK 214 - Hao mòn tài sản cố định
  const query214 = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE '214%'
      ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $2` : ''}
  `;
  const { rows: rows214 } = await pool.query(query214, year ? [companyId, year] : [companyId]);
  data['214'] = (parseFloat(rows214[0]?.credit_total) || 0) - (parseFloat(rows214[0]?.debit_total) || 0);
  total += Math.abs(data['214']);

  // TK 1332 - Thuế GTGT khấu trừ TSCĐ
  const query1332 = `
    SELECT SUM(vd.amount) as total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE '1332%'
      ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $2` : ''}
  `;
  const { rows: rows1332 } = await pool.query(query1332, year ? [companyId, year] : [companyId]);
  data['1332'] = parseFloat(rows1332[0]?.total) || 0;
  total += data['1332'];

  // TK 331 - Phải trả cho người bán (TSCĐ)
  const query331 = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE '331%'
      ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $2` : ''}
  `;
  const { rows: rows331 } = await pool.query(query331, year ? [companyId, year] : [companyId]);
  data['331'] = (parseFloat(rows331[0]?.debit_total) || 0) - (parseFloat(rows331[0]?.credit_total) || 0);
  total += Math.abs(data['331']);

  return {
    name: 'Tài sản cố định',
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

  for (const acc of accounts) {
    const query = `
      SELECT SUM(vd.amount) as total
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
        AND vd.account_code LIKE $2
        ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $3` : ''}
    `;
    
    const params = [companyId, `${acc}%`];
    if (year) params.push(year);
    
    const { rows } = await pool.query(query, params);
    data[acc] = parseFloat(rows[0]?.total) || 0;
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

  // TK 341 - Vay và nợ thuê tài chính
  const query341 = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE '341%'
      ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $2` : ''}
  `;
  const { rows: rows341 } = await pool.query(query341, year ? [companyId, year] : [companyId]);
  data['341'] = (parseFloat(rows341[0]?.debit_total) || 0) - (parseFloat(rows341[0]?.credit_total) || 0);
  total += Math.abs(data['341']);

  // TK 635 - Chi phí tài chính
  const query635 = `
    SELECT SUM(vd.amount) as total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE '635%'
      ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $2` : ''}
  `;
  const { rows: rows635 } = await pool.query(query635, year ? [companyId, year] : [companyId]);
  data['635'] = parseFloat(rows635[0]?.total) || 0;
  total += data['635'];

  // TK 335 - Chi phí phải trả
  const query335 = `
    SELECT SUM(vd.amount) as total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE '335%'
      ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $2` : ''}
  `;
  const { rows: rows335 } = await pool.query(query335, year ? [companyId, year] : [companyId]);
  data['335'] = parseFloat(rows335[0]?.total) || 0;
  total += data['335'];

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

  // TK 3331 - Thuế GTGT
  const query3331 = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE '3331%'
      ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $2` : ''}
  `;
  const { rows: rows3331 } = await pool.query(query3331, year ? [companyId, year] : [companyId]);
  data['3331'] = (parseFloat(rows3331[0]?.debit_total) || 0) - (parseFloat(rows3331[0]?.credit_total) || 0);
  total += Math.abs(data['3331']);

  // TK 133 - Thuế GTGT phát sinh
  const query133 = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE '133%'
      ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $2` : ''}
  `;
  const { rows: rows133 } = await pool.query(query133, year ? [companyId, year] : [companyId]);
  data['133'] = (parseFloat(rows133[0]?.debit_total) || 0) - (parseFloat(rows133[0]?.credit_total) || 0);
  total += Math.abs(data['133']);

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

  // TK 911 - Xác định kết quả kinh doanh
  const query911 = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE '911%'
      ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $2` : ''}
  `;
  const { rows: rows911 } = await pool.query(query911, year ? [companyId, year] : [companyId]);
  data['911'] = (parseFloat(rows911[0]?.debit_total) || 0) - (parseFloat(rows911[0]?.credit_total) || 0);
  total += Math.abs(data['911']);

  // TK 4212 - Lợi nhuận sau thuế chưa phân phối
  const query4212 = `
    SELECT 
      SUM(CASE WHEN vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as debit_total,
      SUM(CASE WHEN vd.entry_type = 'CR' THEN vd.amount ELSE 0 END) as credit_total
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.account_code LIKE '4212%'
      ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $2` : ''}
  `;
  const { rows: rows4212 } = await pool.query(query4212, year ? [companyId, year] : [companyId]);
  data['4212'] = (parseFloat(rows4212[0]?.credit_total) || 0) - (parseFloat(rows4212[0]?.debit_total) || 0);
  total += Math.abs(data['4212']);

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