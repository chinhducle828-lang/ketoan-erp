/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * DOUBLE-ENTRY VALIDATOR
 * Kiểm tra 8 tổ hợp đối ứng kinh điển trong kế toán kép
 * 
 * Mọi bút toán phát sinh trong voucher_details đều phải thuộc một trong 8 tổ hợp sau.
 * Nếu phát sinh tổ hợp nằm ngoài, engine sẽ chặn và báo lỗi.
 * 
 * 8 TỔ HỢP ĐỐI ỨNG:
 * ┌─────┬──────────────────────┬────────────────────────────────────────────┐
 * │ STT │ Cặp (Nợ / Có)        │ Ý nghĩa                                    │
 * ├─────┼──────────────────────┼────────────────────────────────────────────┤
 * │  1  │ Nợ [1,2] / Có [1,2]  │ Hoán đổi cấu trúc Tài sản                  │
 * │  2  │ Nợ [1,2] / Có [3,4]  │ Tài sản tăng - Nguồn vốn tăng             │
 * │  3  │ Nợ [3,4] / Có [1,2]  │ Tài sản giảm - Nguồn vốn giảm             │
 * │  4  │ Nợ [3,4] / Có [3,4]  │ Hoán đổi cấu trúc Nguồn vốn               │
 * │  5  │ Nợ [6,8] / Có [1,2]  │ Chi phí phát sinh - Tài sản giảm          │
 * │  6  │ Nợ [6,8] / Có [3,4]  │ Chi phí phát sinh - Nợ phải trả tăng      │
 * │  7  │ Nợ [1,2] / Có [5,7]  │ Doanh thu - Tài sản tăng                  │
 * │  8  │ Nợ [3,4] / Có [5,7]  │ Doanh thu - Công nợ giảm                  │
 * └─────┴──────────────────────┴────────────────────────────────────────────┘
 */

// Định nghĩa nhóm tài khoản theo prefix
const ACCOUNT_GROUPS = {
  ASSET: { prefixes: ['1', '2'], name: 'Tài sản (1xx, 2xx)' },
  LIABILITY: { prefixes: ['3', '4'], name: 'Nguồn vốn (3xx, 4xx)' },
  EXPENSE: { prefixes: ['6', '8'], name: 'Chi phí (6xx, 8xx)' },
  REVENUE: { prefixes: ['5', '7'], name: 'Doanh thu (5xx, 7xx)' },
};

// 8 tổ hợp đối ứng hợp lệ
const VALID_PAIRS = [
  { dr: 'ASSET', cr: 'ASSET', code: 1, desc: 'Hoán đổi cấu trúc Tài sản' },
  { dr: 'ASSET', cr: 'LIABILITY', code: 2, desc: 'Tài sản tăng - Nguồn vốn tăng' },
  { dr: 'LIABILITY', cr: 'ASSET', code: 3, desc: 'Tài sản giảm - Nguồn vốn giảm' },
  { dr: 'LIABILITY', cr: 'LIABILITY', code: 4, desc: 'Hoán đổi cấu trúc Nguồn vốn' },
  { dr: 'EXPENSE', cr: 'ASSET', code: 5, desc: 'Chi phí phát sinh - Tài sản giảm' },
  { dr: 'EXPENSE', cr: 'LIABILITY', code: 6, desc: 'Chi phí phát sinh - Nợ phải trả tăng' },
  { dr: 'ASSET', cr: 'REVENUE', code: 7, desc: 'Doanh thu - Tài sản tăng' },
  { dr: 'LIABILITY', cr: 'REVENUE', code: 8, desc: 'Doanh thu - Công nợ giảm' },
];

/**
 * Xác định nhóm tài khoản dựa trên mã số
 * @param {string} accountCode - Mã tài khoản (VD: '111', '511', '632')
 * @returns {string|null} Tên nhóm (ASSET, LIABILITY, EXPENSE, REVENUE) hoặc null
 */
function getAccountGroup(accountCode) {
  if (!accountCode) return null;
  const code = accountCode.toString().trim();

  for (const [groupName, group] of Object.entries(ACCOUNT_GROUPS)) {
    for (const prefix of group.prefixes) {
      if (code.startsWith(prefix)) {
        return groupName;
      }
    }
  }
  return null;
}

/**
 * Kiểm tra một cặp tài khoản Nợ/Có có thuộc 8 tổ hợp hợp lệ không
 * 
 * @param {string} drAccount - Mã tài khoản Nợ
 * @param {string} crAccount - Mã tài khoản Có
 * @returns {Object} { valid: boolean, pair?: object, error?: string }
 */
export function validateDoubleEntryPair(drAccount, crAccount) {
  if (!drAccount || !crAccount) {
    return {
      valid: false,
      error: 'Thiếu tài khoản Nợ hoặc Có'
    };
  }

  const drGroup = getAccountGroup(drAccount);
  const crGroup = getAccountGroup(crAccount);

  if (!drGroup) {
    return {
      valid: false,
      error: `Tài khoản Nợ "${drAccount}" không thuộc nhóm nào (1xx,2xx,3xx,4xx,5xx,6xx,7xx,8xx)`
    };
  }
  if (!crGroup) {
    return {
      valid: false,
      error: `Tài khoản Có "${crAccount}" không thuộc nhóm nào (1xx,2xx,3xx,4xx,5xx,6xx,7xx,8xx)`
    };
  }

  // Tìm cặp hợp lệ
  const matchedPair = VALID_PAIRS.find(p => p.dr === drGroup && p.cr === crGroup);

  if (matchedPair) {
    return {
      valid: true,
      pair: matchedPair,
      description: `Tổ hợp ${matchedPair.code}: ${matchedPair.desc}`
    };
  }

  // Không tìm thấy cặp hợp lệ → báo lỗi chi tiết
  const drGroupName = ACCOUNT_GROUPS[drGroup]?.name || drGroup;
  const crGroupName = ACCOUNT_GROUPS[crGroup]?.name || crGroup;

  return {
    valid: false,
    error: `Cặp đối ứng không hợp lệ: Nợ ${drAccount} (${drGroupName}) / Có ${crAccount} (${crGroupName}). ` +
      `Chỉ chấp nhận 8 tổ hợp: Nợ Tài sản/Có Tài sản, Nợ Tài sản/Có Nguồn vốn, ` +
      `Nợ Nguồn vốn/Có Tài sản, Nợ Nguồn vốn/Có Nguồn vốn, ` +
      `Nợ Chi phí/Có Tài sản, Nợ Chi phí/Có Nguồn vốn, ` +
      `Nợ Tài sản/Có Doanh thu, Nợ Nguồn vốn/Có Doanh thu`
  };
}

/**
 * Kiểm tra toàn bộ danh sách chi tiết chứng từ
 * Mỗi chứng từ phải có ít nhất 1 dòng Nợ và 1 dòng Có
 * Tổng Nợ = Tổng Có
 * Mỗi cặp Nợ/Có phải thuộc 1 trong 8 tổ hợp
 * 
 * @param {Array} details - Mảng chi tiết chứng từ [{ account_code, entry_type, amount }]
 * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
 */
export function validateVoucherDetails(details) {
  const errors = [];
  const warnings = [];

  if (!details || !Array.isArray(details) || details.length === 0) {
    return { valid: false, errors: ['Chứng từ không có chi tiết'], warnings: [] };
  }

  // Tách dòng Nợ và dòng Có
  const drLines = details.filter(d => d.entry_type === 'DR' || d.entry_type === 'dr');
  const crLines = details.filter(d => d.entry_type === 'CR' || d.entry_type === 'cr');

  if (drLines.length === 0) {
    errors.push('Chứng từ phải có ít nhất 1 dòng Nợ (DR)');
  }
  if (crLines.length === 0) {
    errors.push('Chứng từ phải có ít nhất 1 dòng Có (CR)');
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  // Kiểm tra tổng Nợ = tổng Có
  const totalDr = drLines.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  const totalCr = crLines.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);

  if (Math.abs(totalDr - totalCr) > 0.01) {
    errors.push(`Tổng Nợ (${totalDr}) không bằng tổng Có (${totalCr}), chênh lệch: ${Math.abs(totalDr - totalCr)}`);
  }

  // Kiểm tra từng cặp Nợ/Có
  // Với mỗi dòng Nợ, kiểm tra với tất cả dòng Có
  for (const drLine of drLines) {
    for (const crLine of crLines) {
      const result = validateDoubleEntryPair(drLine.account_code, crLine.account_code);
      if (!result.valid) {
        warnings.push(`Cặp Nợ ${drLine.account_code} / Có ${crLine.account_code}: ${result.error}`);
      }
    }
  }

  // Cảnh báo nếu tài khoản lưỡng tính không có partner_id
  const hermaphroditicAccounts = ['131', '331', '138', '338', '3334', '3335', '3381'];
  for (const line of details) {
    const accCode = line.account_code?.toString().trim();
    if (hermaphroditicAccounts.some(h => accCode?.startsWith(h))) {
      if (!line.partner_id && !line.partnerId) {
        warnings.push(`Tài khoản lưỡng tính ${accCode} nên có partner_id (đối tác) để bóc tách số dư chi tiết`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Lấy danh sách 8 tổ hợp đối ứng kèm ví dụ
 * @returns {Array} Mảng các tổ hợp
 */
export function getValidPairExamples() {
  return [
    { code: 1, dr: '111 (Tiền mặt)', cr: '112 (Tiền gửi NH)', desc: 'Rút tiền gửi về nhập quỹ' },
    { code: 2, dr: '112 (Tiền gửi NH)', cr: '411 (Vốn góp CSH)', desc: 'Chủ sở hữu góp vốn bằng chuyển khoản' },
    { code: 3, dr: '331 (Phải trả NCC)', cr: '112 (Tiền gửi NH)', desc: 'Chuyển khoản trả tiền cho người bán' },
    { code: 4, dr: '331 (Phải trả NCC)', cr: '341 (Vay NH)', desc: 'Vay ngân hàng để trả nợ người bán' },
    { code: 5, dr: '642 (CP QLDN)', cr: '111 (Tiền mặt)', desc: 'Chi tiền mặt mua văn phòng phẩm' },
    { code: 6, dr: '642 (CP QLDN)', cr: '334 (Phải trả NLĐ)', desc: 'Tính tiền lương phải trả nhân viên' },
    { code: 7, dr: '112 (Tiền gửi NH)', cr: '511 (Doanh thu)', desc: 'Bán hàng thu tiền ngay bằng chuyển khoản' },
    { code: 8, dr: '131 (Phải thu KH)', cr: '511 (Doanh thu)', desc: 'Bán hàng treo công nợ khách hàng' },
  ];
}

export default {
  validateDoubleEntryPair,
  validateVoucherDetails,
  getValidPairExamples
};