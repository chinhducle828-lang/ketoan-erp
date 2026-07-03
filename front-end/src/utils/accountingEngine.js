/**
 * Accounting Engine - Frontend Version
 * Chứa các hàm tính toán kế toán thuần túy (không cần database)
 */

/**
 * Tính toán số dư tài khoản tổng hợp từ danh sách chứng từ
 * @param {Array} vouchers - Danh sách chứng từ
 * @param {Array} openingBalances - Số dư đầu kỳ (tùy chọn)
 * @returns {Object} - Đối tượng chứa số dư từng tài khoản
 */
export function calculateBalances(vouchers, openingBalances = []) {
  const ledger = {};

  // Khởi tạo số dư đầu kỳ nếu có
  if (Array.isArray(openingBalances)) {
    openingBalances.forEach(ob => {
      const accCode = ob.account_code || ob.accountCode;
      if (!ledger[accCode]) {
        ledger[accCode] = {
          patsinhDr: 0,
          patsinhCr: 0,
          closingDr: 0,
          closingCr: 0
        };
      }
      ledger[accCode].patsinhDr = parseFloat(ob.opening_debit || ob.debit_balance || 0);
      ledger[accCode].patsinhCr = parseFloat(ob.opening_credit || ob.credit_balance || 0);
      ledger[accCode].closingDr = ledger[accCode].patsinhDr;
      ledger[accCode].closingCr = ledger[accCode].patsinhCr;
    });
  }

  // Duyệt qua từng chứng từ và tính dồn tích
  vouchers.forEach(voucher => {
    if (!voucher.details || !Array.isArray(voucher.details)) return;
    
    voucher.details.forEach(detail => {
      const accCode = detail.accountCode || detail.account_code;
      const entryType = detail.entryType || detail.entry_type;
      const amount = parseFloat(detail.amount) || 0;

      if (!ledger[accCode]) {
        ledger[accCode] = {
          patsinhDr: 0,
          patsinhCr: 0,
          closingDr: 0,
          closingCr: 0
        };
      }

      if (entryType === 'DR') {
        ledger[accCode].patsinhDr += amount;
        ledger[accCode].closingDr += amount;
      } else if (entryType === 'CR') {
        ledger[accCode].patsinhCr += amount;
        ledger[accCode].closingCr += amount;
      }
    });
  });

  return ledger;
}

/**
 * Tính tổng phát sinh Nợ của một tài khoản
 */
export function getTotalDebit(ledger, accountCode) {
  if (!ledger[accountCode]) return 0;
  return ledger[accountCode].patsinhDr || 0;
}

/**
 * Tính tổng phát sinh Có của một tài khoản
 */
export function getTotalCredit(ledger, accountCode) {
  if (!ledger[accountCode]) return 0;
  return ledger[accountCode].patsinhCr || 0;
}

/**
 * Tính số dư cuối kỳ của tài khoản
 * Xử lý đặc biệt cho tài khoản lưỡng tính và tài khoản lỗ
 * 
 * @param {Object} ledger - Kết quả từ calculateBalances
 * @param {String} accountCode - Mã tài khoản
 * @param {String} accountType - Loại tài khoản (asset, liability, equity, revenue, expense)
 * @returns {Number|Object} Số dư cuối kỳ (có thể âm) hoặc object cho tài khoản lưỡng tính
 */
export function getClosingBalance(ledger, accountCode, accountType = 'asset') {
  if (!ledger[accountCode]) return 0;
  
  const { patsinhDr, patsinhCr } = ledger[accountCode];
  
  // Tài khoản lưỡng tính: trả về cả hai chiều để frontend xử lý
  const hermaphroditicAccounts = ['131', '331', '138', '338', '333', '3381'];
  const isHermaphroditic = hermaphroditicAccounts.some(acc => accountCode.startsWith(acc));
  
  if (isHermaphroditic) {
    // Trả về object với cả Dr và Cr để frontend biết cách hiển thị
    return {
      type: 'hermaphroditic',
      debit: patsinhDr,
      credit: patsinhCr,
      // Số dư thuần: Dr - Cr (nếu âm thì là bên Có)
      net: patsinhDr - patsinhCr
    };
  }
  
  // Tài khoản 421 (LNSTCPP) có thể có số dư Nợ khi lỗ
  const isProfitLoss = accountCode.startsWith('421');
  
  if (accountType === 'asset' || accountType === 'expense' || isProfitLoss) {
    // Tài sản/Chi phí/LNSTCPP: Nợ - Có (có thể âm khi lỗ)
    return patsinhDr - patsinhCr;
  } else {
    // Nguồn vốn/Doanh thu: Có - Nợ (có thể âm)
    return patsinhCr - patsinhDr;
  }
}
