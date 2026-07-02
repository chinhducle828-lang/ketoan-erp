/**
 * Bộ engine tính toán số dư động chuẩn Kế toán (T-Account Ledger Flow)
 * Hỗ trợ: Định khoản đa dòng, Cơ chế dồn tích, và Tài khoản lưỡng tính.
 */
export function calculateBalances(vouchers, legacyOpeningBalances = []) {
  const ledger = {};

  const initAccount = (code) => {
    if (!ledger[code]) {
      ledger[code] = { 
        accountCode: code, 
        openingDr: 0, openingCr: 0, 
        patsinhDr: 0, patsinhCr: 0, 
        closingDr: 0, closingCr: 0 
      };
    }
  };

  // 1. Quét chứng từ (Tích hợp xử lý cả Đầu kỳ và Phát sinh Đa dòng)
  vouchers.forEach(v => {
    const isOpening = v.type === 'DauKy' || v.voucher_type === 'DauKy'; 

    if (v.details && Array.isArray(v.details)) {
      v.details.forEach(d => {
        const code = d.accountCode || d.account_code;
        const amount = parseFloat(d.amount || 0);
        if (!code || amount <= 0) return;

        initAccount(code);

        if (d.entryType === 'DR' || d.entry_type === 'DR') {
          if (isOpening) ledger[code].openingDr += amount;
          else ledger[code].patsinhDr += amount;
        } else if (d.entryType === 'CR' || d.entry_type === 'CR') {
          if (isOpening) ledger[code].openingCr += amount;
          else ledger[code].patsinhCr += amount;
        }
      });
    }
  });

  // 2. Dự phòng nạp số dư đầu kỳ từ nguồn khác (nếu có)
  legacyOpeningBalances.forEach(bal => {
    const code = bal.account_code || bal.accountCode;
    if (code) {
      initAccount(code);
      ledger[code].openingDr += parseFloat(bal.debit_balance || bal.openingDr || 0);
      ledger[code].openingCr += parseFloat(bal.credit_balance || bal.openingCr || 0);
    }
  });

  // 3. Xử lý tính chất bắc cầu: Cộng dồn lên TK cha (3 chữ số)
  Object.keys(ledger).forEach(code => {
    if (code.length > 3) {
      const parentCode = code.substring(0, 3);
      initAccount(parentCode);
      ledger[parentCode].openingDr += ledger[code].openingDr;
      ledger[parentCode].openingCr += ledger[code].openingCr;
      ledger[parentCode].patsinhDr += ledger[code].patsinhDr;
      ledger[parentCode].patsinhCr += ledger[code].patsinhCr;
    }
  });

  // 4. Bù trừ (Netting) xác định Số dư cuối kỳ theo chuẩn Kế toán Việt Nam
  Object.keys(ledger).forEach(code => {
    const acc = ledger[code];
    const totalDr = acc.openingDr + acc.patsinhDr;
    const totalCr = acc.openingCr + acc.patsinhCr;

    // 4.1. Nhóm tài khoản CÔNG NỢ LƯỠNG TÍNH (131, 331, 138, 338, 334)
    // Đặc tả: Có thể có số dư bên Nợ hoặc bên Có tùy thuộc vào biến động dồn tích.
    if (['131', '331', '138', '338', '334'].some(prefix => code.startsWith(prefix))) {
      if (totalDr >= totalCr) {
        acc.closingDr = totalDr - totalCr;
        acc.closingCr = 0;
      } else {
        acc.closingCr = totalCr - totalDr;
        acc.closingDr = 0;
      }
    } 
    // 4.2. Nhóm Tài sản (Đầu 1, 2, 6, 8)
    else if (code.startsWith('1') || code.startsWith('2') || code.startsWith('6') || code.startsWith('8')) {
      if (code.startsWith('214')) { 
        // Ngoại lệ: Hao mòn TSCĐ luôn có số dư bên Có
        acc.closingCr = totalCr > totalDr ? totalCr - totalDr : 0;
        acc.closingDr = 0;
      } else {
        // Tài sản thông thường chỉ có số dư Nợ
        acc.closingDr = totalDr > totalCr ? totalDr - totalCr : 0;
        acc.closingCr = 0;
      }
    } 
    // 4.3. Nhóm Nguồn vốn / Doanh thu (Đầu 3, 4, 5, 7, 9)
    else {
      // Nguồn vốn thông thường chỉ có số dư Có
      acc.closingCr = totalCr > totalDr ? totalCr - totalDr : 0;
      acc.closingDr = 0;
    }
  });

  return ledger;
}