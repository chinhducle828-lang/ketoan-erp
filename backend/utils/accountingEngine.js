// FILE_PATH: backend/utils/accountingEngine.js
import pool from '../config/db.js';

/**
 * Kiểm tra xem ngày chứng từ có nằm trong vùng đã bị khóa sổ kế toán hay không
 */
export async function checkLockDate(companyId, voucherDate) {
  const query = 'SELECT lock_date FROM companies WHERE id = $1';
  const { rows } = await pool.query(query, [companyId]);
  if (rows.length === 0 || !rows[0].lock_date) return false;

  const lockDate = new Date(rows[0].lock_date);
  const targetDate = new Date(voucherDate);
  return targetDate <= lockDate;
}

/**
 * Tính toán số dư tài khoản thông thường và tài khoản lưỡng tính theo TT 99/2025/TT-BTC
 * Danh sách tài khoản lưỡng tính quản lý chi tiết theo đối tượng:
 * - 131, 331, 138, 338: Nhóm công nợ khách hàng, nhà cung cấp, phải thu/phải trả khác
 * - 3334, 3335: Thuế TNDN và Thuế TNCN (Dư Nợ khi tạm nộp thừa vào NSNN)
 * - 3381: Tài sản thừa chờ giải quyết
 */
export async function getAccountBalance(companyId, accountCode, partnerId = null) {
  // Cập nhật danh sách tài khoản đặc biệt chuẩn Thông tư 99
  const hermaphroditicAccounts = ['131', '331', '138', '338', '3334', '3335', '3381'];
  const isHermaphroditic = hermaphroditicAccounts.some(acc => accountCode.startsWith(acc));

  let query = `
    SELECT vd.entry_type, SUM(vd.amount) as total_amount
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 AND vd.account_code LIKE $2
  `;
  
  const params = [companyId, `${accountCode}%`];

  // Nếu là tài khoản lưỡng tính đặc biệt, bắt buộc phải lọc nghiêm ngặt theo đối tác cụ thể
  if (isHermaphroditic && partnerId) {
    query += ` AND vd.partner_id = $3`;
    params.push(partnerId);
  }

  query += ` GROUP BY vd.entry_type`;

  const { rows } = await pool.query(query, params);
  
  let debitSum = 0;
  let creditSum = 0;

  rows.forEach(row => {
    if (row.entry_type === 'DR') debitSum += parseFloat(row.total_amount) || 0;
    if (row.entry_type === 'CR') creditSum += parseFloat(row.total_amount) || 0;
  });

  const isAsset = accountCode.startsWith('1') || accountCode.startsWith('2') || accountCode.startsWith('6') || accountCode.startsWith('8');
  const isProfitLoss = accountCode.startsWith('421'); // Hỗ trợ tài khoản 421 lãi/lỗ
  
  if (isHermaphroditic) {
    return { 
      debit_balance: debitSum, 
      credit_balance: creditSum,
      is_hermaphroditic: true 
    };
  }

  if (isAsset || isProfitLoss) {
    return { balance: debitSum - creditSum }; // Số dư Nợ (hoặc âm nếu dư Có)
  } else {
    return { balance: creditSum - debitSum }; // Số dư Có (hoặc âm nếu dư Nợ)
  }
}

/**
 * Tính toán số dư tài khoản tổng hợp từ danh sách chứng từ (Dùng cho Bảng Cân Đối Tài Khoản)
 */
export function calculateBalances(vouchers, openingBalances = []) {
  const ledger = {};

  // Nạp số dư đầu kỳ dồn tích, sửa lỗi dùng toán tử "=" gây ghi đè dữ liệu đối tác
  if (Array.isArray(openingBalances)) {
    openingBalances.forEach(ob => {
      const accCode = ob.account_code || ob.accountCode;
      if (!ledger[accCode]) {
        ledger[accCode] = { patsinhDr: 0, patsinhCr: 0, closingDr: 0, closingCr: 0 };
      }
      ledger[accCode].patsinhDr += parseFloat(ob.opening_debit || ob.debit_balance || 0);
      ledger[accCode].patsinhCr += parseFloat(ob.opening_credit || ob.credit_balance || 0);
      ledger[accCode].closingDr = ledger[accCode].patsinhDr;
      ledger[accCode].closingCr = ledger[accCode].patsinhCr;
    });
  }

  // Lũy kế phát sinh trong kỳ từ chứng từ (Chấp nhận amount âm cho hạch toán điều chỉnh đỏ)
  vouchers.forEach(voucher => {
    if (!voucher.details || !Array.isArray(voucher.details)) return;
    
    voucher.details.forEach(detail => {
      const accCode = detail.accountCode || detail.account_code;
      const entryType = detail.entryType || detail.entry_type;
      const amount = parseFloat(detail.amount) || 0;

      if (!ledger[accCode]) {
        ledger[accCode] = { patsinhDr: 0, patsinhCr: 0, closingDr: 0, closingCr: 0 };
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

export function getClosingBalance(ledger, accountCode, accountType = 'asset') {
  if (!ledger[accountCode]) return 0;
  
  const { patsinhDr, patsinhCr } = ledger[accountCode];
  const hermaphroditicAccounts = ['131', '331', '138', '338', '3334', '3335', '3381'];
  const isHermaphroditic = hermaphroditicAccounts.some(acc => accountCode.startsWith(acc));
  
  if (isHermaphroditic) {
    return {
      type: 'hermaphroditic',
      debit: patsinhDr,
      credit: patsinhCr,
      net: patsinhDr - patsinhCr
    };
  }
  
  const isProfitLoss = accountCode.startsWith('421');
  if (accountType === 'asset' || accountType === 'expense' || isProfitLoss) {
    return patsinhDr - patsinkCr;
  } else {
    return patsinhCr - patsinhDr;
  }
}

// BỔ SUNG: Lấy tổng phát sinh Nợ phục vụ báo cáo KQKD Thông tư 99
export function getTotalDebit(ledger, accountCode) {
  if (!ledger[accountCode]) return 0;
  return ledger[accountCode].patsinhDr || 0;
}

// BỔ SUNG: Lấy tổng phát sinh Có phục vụ báo cáo KQKD Thông tư 99
export function getTotalCredit(ledger, accountCode) {
  if (!ledger[accountCode]) return 0;
  return ledger[accountCode].patsinhCr || 0;
}