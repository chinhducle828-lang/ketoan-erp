/**
 * Bộ engine tính toán số dư động chuẩn Kế toán (T-Account Ledger Flow)
 * Hỗ trợ: Định khoản phức tạp (v.details), Bù trừ cuối kỳ theo loại TK, và Tính chất TK Lưỡng tính/Hao mòn.
 */
export function calculateBalances(vouchers, openingBalances = []) {
  const ledger = {};

  // 1. Khởi tạo danh mục tài khoản từ số dư đầu kỳ
  openingBalances.forEach(bal => {
    // Thống nhất key viết thường hoặc theo DB (account_code hoặc accountCode)
    const code = bal.account_code || bal.accountCode;
    if (code) {
      ledger[code] = {
        accountCode: code,
        openingDr: parseFloat(bal.debit_balance || bal.openingDr || 0),
        openingCr: parseFloat(bal.credit_balance || bal.openingCr || 0),
        patsinhDr: 0,
        patsinhCr: 0,
        closingDr: 0,
        closingCr: 0
      };
    }
  });

  // 2. Quét chứng từ để cộng dồn phát sinh (Xử lý mảng lồng details)
  vouchers.forEach(v => {
    // Nếu chứng từ có mảng chi tiết (Cấu trúc thực tế của hệ thống)
    if (v.details && Array.isArray(v.details)) {
      v.details.forEach(d => {
        const code = d.accountCode || d.account_code;
        const amount = parseFloat(d.amount || 0);
        if (!code || amount <= 0) return;

        if (!ledger[code]) {
          ledger[code] = { accountCode: code, openingDr: 0, openingCr: 0, patsinhDr: 0, patsinhCr: 0, closingDr: 0, closingCr: 0 };
        }

        if (d.entryType === 'DR' || d.entry_type === 'DR') {
          ledger[code].patsinhDr += amount;
        } else if (d.entryType === 'CR' || d.entry_type === 'CR') {
          ledger[code].patsinhCr += amount;
        }
      });
    } else {
      // Cơ chế dự phòng (Fallback) nếu chứng từ truyền dạng phẳng cũ (account_dr, account_cr)
      const amount = parseFloat(v.amount || 0);
      if (amount <= 0) return;

      if (v.account_dr) {
        if (!ledger[v.account_dr]) ledger[v.account_dr] = { accountCode: v.account_dr, openingDr: 0, openingCr: 0, patsinhDr: 0, patsinhCr: 0, closingDr: 0, closingCr: 0 };
        ledger[v.account_dr].patsinhDr += amount;
      }
      if (v.account_cr) {
        if (!ledger[v.account_cr]) ledger[v.account_cr] = { accountCode: v.account_cr, openingDr: 0, openingCr: 0, patsinhDr: 0, patsinhCr: 0, closingDr: 0, closingCr: 0 };
        ledger[v.account_cr].patsinhCr += amount;
      }
    }
  });

  // 3. Xử lý tính chất bắc cầu: Cộng dồn số liệu từ TK con (4 chữ số) lên TK cha (3 chữ số)
  Object.keys(ledger).forEach(code => {
    if (code.length > 3) {
      const parentCode = code.substring(0, 3);
      if (!ledger[parentCode]) {
        ledger[parentCode] = { accountCode: parentCode, openingDr: 0, openingCr: 0, patsinhDr: 0, patsinhCr: 0, closingDr: 0, closingCr: 0 };
      }
      // Chỉ cộng dồn phần phát sinh (Phần đầu kỳ đã được nạp riêng từ cấu hình hệ thống)
      ledger[parentCode].patsinhDr += ledger[code].patsinhDr;
      ledger[parentCode].patsinhCr += ledger[code].patsinhCr;
    }
  });

  // 4. Bù trừ (Netting) xác định Số dư cuối kỳ dựa trên Loại tài khoản
  Object.keys(ledger).forEach(code => {
    const acc = ledger[code];
    const totalDr = acc.openingDr + acc.patsinhDr;
    const totalCr = acc.openingCr + acc.patsinhCr;

    // Quy tắc đầu tài khoản: 1, 2, 6, 8 mang tính chất Tài sản (Ưu tiên dư Nợ)
    if (code.startsWith('1') || code.startsWith('2') || code.startsWith('6') || code.startsWith('8')) {
      // Trường hợp đặc biệt ngoại lệ: TK 214 (Hao mòn tài sản cố định) luôn có số dư bên Có
      if (code.startsWith('214')) {
        acc.closingCr = totalCr - totalDr;
      } else {
        if (totalDr >= totalCr) {
          acc.closingDr = totalDr - totalCr;
        } else {
          // Đối với tài khoản lưỡng tính như phải thu khách hàng (131), cuối kỳ khách ứng trước tiền vẫn có thể dư Có
          acc.closingCr = totalCr - totalDr;
        }
      }
    } 
    // Quy tắc đầu tài khoản: 3, 4, 5, 7, 9 mang tính chất Nguồn vốn/Doanh thu (Ưu tiên dư Có)
    else {
      if (totalCr >= totalDr) {
        acc.closingCr = totalCr - totalDr;
      } else {
        // Đối với tài khoản lưỡng tính như phải trả người bán (331), ứng trước tiền cho người bán vẫn có thể dư Nợ
        acc.closingDr = totalDr - totalCr;
      }
    }
  });

  return ledger;
}