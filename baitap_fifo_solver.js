/**
 * GIẢI BÀI TẬP KẾ TOÁN - CÔNG TY TNHH AN BÌNH
 * Phương pháp tính giá vốn: FIFO (First In First Out)
 * Tháng 1/20X8
 */

// Dữ liệu đầu kỳ
const openingBalances = {
  '1111': { debit: 50000000, credit: 0 },
  '1121': { debit: 512500000, credit: 0 },
  '141': { debit: 2000000, credit: 0 },
  '131': { debit: 250000000, credit: 0 },
  '156': { debit: 155000000, credit: 0 },
  '2111': { debit: 200000000, credit: 0 },
  '2112': { debit: 150000000, credit: 0 },
  '2118': { debit: 100000000, credit: 0 },
  '2141': { debit: 0, credit: 50000000 },
  '331': { debit: 0, credit: 285600000 },
  '4111': { debit: 1000000000, credit: 0 },
  '421': { debit: 0, credit: 83900000 }
};

// Chi tiết đầu kỳ theo đối tác
const openingByPartner = {
  '131': {
    '1': { debit: 45500000, credit: 0 },   // Khách hàng 1
    '2': { debit: 98300000, credit: 0 },   // Khách hàng 2
    '3': { debit: 106250000, credit: 0 }   // Khách hàng 3
  },
  '331': {
    '1': { debit: 0, credit: 255600000 }, // Nhà cung cấp 1
    '2': { debit: 0, credit: 30000000 }    // Nhà cung cấp 2
  }
};

// Chi tiết hàng tồn kho đầu kỳ (Rượu A, Rượu B)
const initialInventory = {
  'A': { quantity: 300, unitCost: 300000, totalValue: 90000000 },
  'B': { quantity: 250, unitCost: 260000, totalValue: 65000000 }
};

// Lô hàng FIFO
let fifoLots = {
  'A': [
    { date: '20X8-01-01', quantity: 300, unitCost: 300000, remaining: 300 }
  ],
  'B': [
    { date: '20X8-01-01', quantity: 250, unitCost: 260000, remaining: 250 }
  ]
};

// Sổ nhật ký chung
const journalEntries = [];

// Bảng cân đối tài khoản
let ledger = JSON.parse(JSON.stringify(openingBalances));

// Hàm thêm bút toán
function addEntry(date, description, details) {
  const entry = {
    date,
    description,
    details: details.map(d => ({
      account: d.account,
      dr: d.dr || 0,
      cr: d.cr || 0,
      partner: d.partner || null
    }))
  };
  journalEntries.push(entry);
  
  // Cập nhật ledger
  details.forEach(d => {
    if (!ledger[d.account]) {
      ledger[d.account] = { debit: 0, credit: 0 };
    }
    ledger[d.account].debit += d.dr || 0;
    ledger[d.account].credit += d.cr || 0;
  });
}

// BÚT TOÁN 1: Nợ thuế môn bài năm 20X8
addEntry('01/01/20X8', 'Ghi nợ thuế môn bài năm 20X8', [
  { account: '3339', dr: 3000000, cr: 0 }
]);

// BÚT TOÁN 2: Tạm ứng văn phòng phẩm NV Năm
addEntry('02/01/20X8', 'Tạm ứng văn phòng phẩm NV Năm', [
  { account: '141', dr: 1500000, cr: 0 },
  { account: '331', dr: 0, cr: 1500000 }
]);

// BÚT TOÁN 3: Thuế GTGT tạm ứng văn phụ
addEntry('02/01/20X8', 'Thuế GTGT tạm ứng văn phụ', [
  { account: '1331', dr: 150000, cr: 0 },
  { account: '3331', dr: 0, cr: 150000 }
]);

// BÚT TOÁN 4: NV Năm nộp lại tiền dư
addEntry('02/01/20X8', 'NV Năm nộp lại tiền dư', [
  { account: '1121', dr: 150000, cr: 0 },
  { account: '141', dr: 0, cr: 150000 }
]);

// BÚT TOÁN 5: Khách hàng 3 thanh toán
addEntry('03/01/20X8', 'Khách hàng 3 thanh toán', [
  { account: '1121', dr: 106250000, cr: 0 },
  { account: '131', dr: 0, cr: 106250000, partner: '3' }
]);

// BÚT TOÁN 6: Thanh toán NCC 1
addEntry('04/01/20X8', 'Thanh toán cho nhà cung cấp 1', [
  { account: '331', dr: 255600000, cr: 0, partner: '1' },
  { account: '1121', dr: 0, cr: 255600000 }
]);

// BÚT TOÁN 7: Thanh toán cước internet
addEntry('04/01/20X8', 'Thanh toán cước internet tháng 12/X7', [
  { account: '331', dr: 440000, cr: 0 },
  { account: '1121', dr: 0, cr: 440000 }
]);

// BÚT TOÁN 8: Thuế GTGT cước internet
addEntry('04/01/20X8', 'Thuế GTGT cước internet', [
  { account: '1331', dr: 40000, cr: 0 },
  { account: '3331', dr: 0, cr: 40000 }
]);

// BÚT TOÁN 9: Chuyển tiền trả NCC 2
addEntry('05/01/20X8', 'Chuyển tiền trả cho nhà cung cấp 2', [
  { account: '331', dr: 30000000, cr: 0, partner: '2' },
  { account: '1121', dr: 0, cr: 30000000 }
]);

// BÚT TOÁN 10: Bán hàng cho khách hàng 2
// 200 chai Rượu A + 200 chai Rượu B
// Giá bán: 550.000/chai A, 450.000/chai B + VAT 10%
const sale2_A = 200 * 550000; // 110.000.000
const sale2_B = 200 * 450000;  // 90.000.000
const sale2_vat = (sale2_A + sale2_B) * 0.1; // 20.000.000
const sale2_total = sale2_A + sale2_B + sale2_vat; // 220.000.000

// Tính giá vốn xuất kho FIFO
// Rượu A: 200 chai x 300.000 = 60.000.000
// Rượu B: 200 chai x 260.000 = 52.000.000
const cogs2_A = 200 * 300000; // 60.000.000
const cogs2_B = 200 * 260000;  // 52.000.000
const cogs2_total = cogs2_A + cogs2_B; // 112.000.000

// Cập nhật lô hàng FIFO
fifoLots['A'][0].remaining -= 200;
fifoLots['B'][0].remaining -= 200;

addEntry('06/01/20X8', 'Bán hàng cho khách hàng 2 - Hóa đơn 0000002', [
  { account: '131', dr: sale2_total, cr: 0, partner: '2' },
  { account: '511', dr: 0, cr: sale2_A + sale2_B },
  { account: '3331', dr: 0, cr: sale2_vat },
  { account: '632', dr: cogs2_total, cr: 0 },
  { account: '156', dr: 0, cr: cogs2_total }
]);

// BÚT TOÁN 11: Nhập khẩu 2.000 chai Rượu A, 1.000 chai Rượu B
// Rượu A: 2.000 chai x 156.450 = 312.900.000
// Rượu B: 1.000 chai x 129.630 = 129.630.000
const import_A_qty = 2000;
const import_A_cost = 2000 * 156450; // 312.900.000
const import_B_qty = 1000;
const import_B_cost = 1000 * 129630; // 129.630.000

// Cập nhật lô hàng FIFO
fifoLots['A'].push({ date: '20X8-01-08', quantity: 2000, unitCost: 156450, remaining: 2000 });
fifoLots['B'].push({ date: '20X8-01-08', quantity: 1000, unitCost: 129630, remaining: 1000 });

addEntry('08/01/20X8', 'Nhập khẩu rượu A, B từ nhà cung cấp 1', [
  { account: '156', dr: import_A_cost + import_B_cost, cr: 0 },
  { account: '331', dr: 0, cr: import_A_cost + import_B_cost, partner: '1' }
]);

// BÚT TOÁN 12: Chi phí logistics
// Tổng chi phí: 3.000.000 + 4.500.000 = 7.500.000 + VAT 10% = 8.250.000
const logistics_cost = 7500000;
const logistics_vat = 750000;
const logistics_total = 8250000;

addEntry('08/01/20X8', 'Chi phí logistics dịch vụ', [
  { account: '1562', dr: logistics_total, cr: 0 },
  { account: '331', dr: 0, cr: logistics_total, partner: '2' }
]);

// BÚT TOÁN 13: Bán hàng cho khách hàng 1
// 100 chai Rượu A + 100 chai Rượu B
const sale1_A = 100 * 550000; // 55.000.000
const sale1_B = 100 * 450000;  // 45.000.000
const sale1_vat = (sale1_A + sale1_B) * 0.1; // 10.000.000
const sale1_total = sale1_A + sale1_B + sale1_vat; // 110.000.000

// Tính giá vốn xuất kho FIFO
// Rượu A: 100 chai x 156.450 = 15.645.000 (lấy từ lô mới nhất)
// Rượu B: 100 chai x 129.630 = 12.963.000
const cogs1_A = 100 * 156450; // 15.645.000
const cogs1_B = 100 * 129630;  // 12.963.000
const cogs1_total = cogs1_A + cogs1_B; // 28.608.000

// Cập nhật lô hàng FIFO
fifoLots['A'][1].remaining -= 100;
fifoLots['B'][1].remaining -= 100;

addEntry('10/01/20X8', 'Bán hàng cho khách hàng 1 - Hóa đơn 0000004', [
  { account: '131', dr: sale1_total, cr: 0, partner: '1' },
  { account: '511', dr: 0, cr: sale1_A + sale1_B },
  { account: '3331', dr: 0, cr: sale1_vat },
  { account: '632', dr: cogs1_total, cr: 0 },
  { account: '156', dr: 0, cr: cogs1_total }
]);

// BÚT TOÁN 14: Thanh toán tiếp khách
const business_entertainment = 1200000;
const business_entertainment_vat = 120000;

addEntry('12/01/20X8', 'Thanh toán tiếp khách', [
  { account: '642', dr: business_entertainment + business_entertainment_vat, cr: 0 },
  { account: '1111', dr: 0, cr: business_entertainment + business_entertainment_vat }
]);

// BÚT TOÁN 15: Thuế GTGT tiếp khách
addEntry('12/01/20X8', 'Thuế GTGT tiếp khách', [
  { account: '3331', dr: business_entertainment_vat, cr: 0 },
  { account: '1331', dr: 0, cr: business_entertainment_vat }
]);

// BÚT TOÁN 16: Khách hàng 3 trả trước
addEntry('14/01/20X8', 'Khách hàng 3 trả trước', [
  { account: '1121', dr: 44400000, cr: 0 },
  { account: '312', dr: 0, cr: 44400000, partner: '3' }
]);

// BÚT TOÁN 17: Xuất bán 500 chai Rượu A cho khách hàng 3
// Giá bán: 399.600/chai + VAT 10%
const sale3_A = 500 * 399600; // 199.800.000
const sale3_vat = sale3_A * 0.1; // 19.980.000
const sale3_total = sale3_A + sale3_vat; // 219.780.000

// Tính giá vốn xuất kho FIFO
// Rượu A: 300 chai còn lại x 300.000 + 200 chai x 156.450
// = 90.000.000 + 31.290.000 = 121.290.000
const cogs3_A = 300 * 300000 + 200 * 156450; // 121.290.000

// Cập nhật lô hàng FIFO
fifoLots['A'][0].remaining = 0;
fifoLots['A'][1].remaining -= 200;

addEntry('16/01/20X8', 'Xuất bán rượu A cho khách hàng 3 - Hóa đơn GTGT', [
  { account: '131', dr: sale3_total, cr: 0, partner: '3' },
  { account: '511', dr: 0, cr: sale3_A },
  { account: '3331', dr: 0, cr: sale3_vat },
  { account: '632', dr: cogs3_A, cr: 0 },
  { account: '156', dr: 0, cr: cogs3_A }
]);

// BÚT TOÁN 18: Chi phí vận chuyển nội địa
const domestic_shipping = 4000000;
const domestic_shipping_vat = 400000;

addEntry('17/01/20X8', 'Chi phí vận chuyển nội địa', [
  { account: '642', dr: domestic_shipping + domestic_shipping_vat, cr: 0 },
  { account: '331', dr: 0, cr: domestic_shipping + domestic_shipping_vat, partner: '2' }
]);

// BÚT TOÁN 19: Thuế GTGT vận chuyển
addEntry('17/01/20X8', 'Thuế GTGT vận chuyển nội địa', [
  { account: '3331', dr: domestic_shipping_vat, cr: 0 },
  { account: '1331', dr: 0, cr: domestic_shipping_vat }
]);

// BÚT TOÁN 20: Tính lương tháng 1/20X8
// Tổng lương: 30.000.000 (văn phòng) + 20.000.000 (bán hàng) = 50.000.000
// Trích theo lương: 34% x 50.000.000 = 17.000.000
// Lương ròng: 50.000.000 - 17.000.000 = 33.000.000
const total_salary = 50000000;
const salary_deduction = 17000000;
const net_salary = 33000000;

// Chi tiết trích theo lương:
// BHXH: 17.5% + 8% = 25.5% x 50.000.000 = 12.750.000
// BHYT: 3% + 1.5% = 4.5% x 50.000.000 = 2.250.000
// BHTN: 1% + 1% = 2% x 50.000.000 = 1.000.000
// KPCĐ: 2% x 50.000.000 = 1.000.000
// Tổng: 17.000.000

addEntry('31/01/20X8', 'Tính lương tháng 1/20X8', [
  { account: '3341', dr: 12750000, cr: 0 }, // BHXH
  { account: '3342', dr: 2250000, cr: 0 },  // BHYT
  { account: '3383', dr: 1000000, cr: 0 },  // BHTN
  { account: '6422', dr: 1000000, cr: 0 },  // KPCĐ
  { account: '641', dr: net_salary, cr: 0 }, // Lương nhân viên
  { account: '1121', dr: 0, cr: total_salary }
]);

// BÚT TOÁN 21: Khấu hao TSCĐ
// Quản lý: 15.000.000, Bán hàng: 10.000.000
const depreciation_mgmt = 15000000;
const depreciation_sales = 10000000;

addEntry('31/01/20X8', 'Khấu hao TSCĐ tháng 1/20X8', [
  { account: '611', dr: depreciation_mgmt + depreciation_sales, cr: 0 },
  { account: '2141', dr: 0, cr: depreciation_mgmt + depreciation_sales }
]);

// BÚT TOÁN 22: Kết chuyển lãi/lỗ
// Tính doanh thu, chi phí, thuế TNDN
const total_revenue = (sale2_A + sale2_B) + (sale1_A + sale1_B) + sale3_A;
const total_cogs = cogs2_total + cogs1_total + cogs3_A;
const total_vat_output = sale2_vat + sale1_vat + sale3_vat;
const total_operating_expenses = business_entertainment + business_entertainment_vat + domestic_shipping + domestic_shipping_vat + net_salary + depreciation_mgmt + depreciation_sales;

// Kết chuyển doanh thu
addEntry('31/01/20X8', 'Kết chuyển doanh thu', [
  { account: '911', dr: total_revenue, cr: 0 },
  { account: '511', dr: 0, cr: total_revenue }
]);

// Kết chuyển chi phí
addEntry('31/01/20X8', 'Kết chuyển chi phí', [
  { account: '911', dr: 0, cr: total_cogs + total_operating_expenses },
  { account: '632', dr: total_cogs, cr: 0 },
  { account: '641', dr: net_salary + depreciation_mgmt + depreciation_sales, cr: 0 },
  { account: '642', dr: business_entertainment + business_entertainment_vat + domestic_shipping + domestic_shipping_vat, cr: 0 }
]);

// Tính lợi nhuận trước thuế
const profit_before_tax = total_revenue - total_cogs - total_operating_expenses;

// Kết chuyển thuế TNDN (20%)
const corporate_tax = profit_before_tax * 0.2;

addEntry('31/01/20X8', 'Kết chuyển thuế TNDN', [
  { account: '821', dr: corporate_tax, cr: 0 },
  { account: '3334', dr: 0, cr: corporate_tax }
]);

// Kết chuyển lãi/lỗ sang TK 421
const net_profit = profit_before_tax - corporate_tax;

addEntry('31/01/20X8', 'Kết chuyển lãi/lỗ sang vốn', [
  { account: '421', dr: 0, cr: net_profit },
  { account: '911', dr: net_profit, cr: 0 }
]);

// BÚT TOÁN 23: Kết chuyển thuế GTGT
// Thuế đầu vào: 150.000 + 40.000 + 120.000 + 400.000 = 710.000
// Thuế đầu ra: 20.000.000 + 10.000.000 + 19.980.000 = 50.000.000
// Thuế phải nộp: 50.000.000 - 710.000 = 49.290.000

const vat_input = 150000 + 40000 + 120000 + domestic_shipping_vat;
const vat_output = sale2_vat + sale1_vat + sale3_vat;
const vat_payable = vat_output - vat_input;

// Kết chuyển thuế GTGT: chuyển từ TK 3331 sang TK 1331
// TK 3331: Nợ 49.270.000, Có 50.000.000 → số dư Nợ 230.000
// TK 1331: Nợ 710.000, Có 0 → số dư Nợ 710.000
// Sau khi kết chuyển: TK 3331 = 0, TK 1331 = 49.270.000 (Có)
addEntry('31/01/20X8', 'Kết chuyển thuế GTGT', [
  { account: '3331', dr: 0, cr: vat_output },
  { account: '1331', dr: 0, cr: vat_input }
]);

// BÚT TOÁN 24: Kết chuyển lãi/lỗ ngân hàng
// Lãi/lỗ từ tài khoản 421
addEntry('31/01/20X8', 'Kết chuyển lãi/lỗ ngân hàng', [
  { account: '421', dr: 0, cr: 0 }
]);

// Tính số dư cuối kỳ (chính xác theo từng loại tài khoản)
function calculateClosingBalance() {
  const closing = {};
  for (const [acc, data] of Object.entries(ledger)) {
    const debitSum = data.debit;
    const creditSum = data.credit;
    
    // Xác định loại tài khoản
    const isAsset = acc.startsWith('1') || acc.startsWith('2');
    const isLiability = acc.startsWith('3') && !acc.startsWith('333');
    const isEquity = acc.startsWith('4');
    const isProfitLoss = acc === '421' || acc === '911';
    const isVAT = acc.startsWith('333');
    const isInputTax = acc === '1331'; // Thuế đầu vào
    const isAccumDepreciation = acc === '2141'; // Khấu hao tích lũy
    const isCustomerAdvance = acc === '312'; // Khách hàng trả trước
    
    let balance, isDebit, isNegative;
    
    if (isAsset) {
      // Tài sản: Nợ là số dư, Có là giảm số dư
      balance = debitSum - creditSum;
      isDebit = balance >= 0;
      isNegative = balance < 0;
    } else if (isInputTax) {
      // Thuế đầu vào (1331): Nợ là được khấu trừ, Có là phải nộp
      balance = creditSum - debitSum;
      isDebit = false;
      isNegative = balance < 0;
    } else if (isAccumDepreciation) {
      // Khấu hao tích lũy (2141): Có là số dư, Nợ là giảm
      balance = creditSum - debitSum;
      isDebit = false;
      isNegative = balance < 0;
    } else if (isCustomerAdvance) {
      // Khách hàng trả trước (312): Có là số dư, Nợ là giảm
      balance = creditSum - debitSum;
      isDebit = false;
      isNegative = balance < 0;
    } else if (isLiability) {
      // Nợ phải trả: Có là số dư, Nợ là giảm số dư
      balance = creditSum - debitSum;
      isDebit = false;
      isNegative = balance < 0;
    } else if (isEquity || isProfitLoss) {
      // Vốn, lãi/lỗ: Có là số dư, Nợ là giảm số dư
      balance = creditSum - debitSum;
      isDebit = false;
      isNegative = balance < 0;
    } else if (isVAT) {
      // Thuế: Nợ là phải nộp, Có là được khấu trừ
      balance = debitSum - creditSum;
      isDebit = balance >= 0;
      isNegative = false;
    } else {
      balance = debitSum - creditSum;
      isDebit = balance >= 0;
      isNegative = balance < 0;
    }
    
    closing[acc] = {
      debit: debitSum,
      credit: creditSum,
      balance: Math.abs(balance),
      isDebit: isDebit,
      isNegative: isNegative
    };
  }
  return closing;
}

// In kết quả
console.log('='.repeat(80));
console.log('SỔ NHẬT KÝ CHUNG - CÔNG TY TNHH AN BÌNH');
console.log('Tháng 1/20X8');
console.log('='.repeat(80));

journalEntries.forEach((entry, index) => {
  console.log(`\nBÚT TOÁN ${index + 1}: ${entry.date} - ${entry.description}`);
  console.log('-'.repeat(60));
  entry.details.forEach(d => {
    const partner = d.partner ? ` (Đối tác: ${d.partner})` : '';
    console.log(`  TK ${d.account}${partner.padEnd(20)} Nợ: ${d.dr.toLocaleString().padStart(15)} Có: ${d.cr.toLocaleString().padStart(15)}`);
  });
});

console.log('\n' + '='.repeat(80));
console.log('BẢNG CÂN ĐỐI KẾ TOÁN - Số dư cuối kỳ tháng 1/20X8');
console.log('='.repeat(80));

const closing = calculateClosingBalance();
const assetAccounts = ['1111', '1121', '131', '1331', '156', '2111', '2112', '2118', '2141', '312'];
const liabilityAccounts = ['331', '3331', '3334', '3339', '334', '335', '338', '3381'];
const equityAccounts = ['4111', '421'];

let totalAssets = 0;
let totalLiabilities = 0;
let totalEquity = 0;

console.log('\nTÀI SẢN:');
assetAccounts.forEach(acc => {
  if (closing[acc]) {
    const bal = closing[acc].balance;
    const isDebit = closing[acc].isDebit;
    if (bal !== 0) {
      const sign = isDebit ? '' : '(Có)';
      console.log(`  TK ${acc}: ${bal.toLocaleString()} ${sign}`);
      totalAssets += bal;
    }
  }
});

console.log('\nNỢ PHẢI TRẢ:');
liabilityAccounts.forEach(acc => {
  if (closing[acc]) {
    const bal = closing[acc].balance;
    if (bal !== 0) {
      console.log(`  TK ${acc}: ${bal.toLocaleString()}`);
      totalLiabilities += bal;
    }
  }
});

console.log('\nVỐN:');
equityAccounts.forEach(acc => {
  if (closing[acc]) {
    const bal = closing[acc].balance;
    const isNegative = closing[acc].isNegative;
    if (bal !== 0) {
      const sign = isNegative ? '(Lỗ)' : '';
      console.log(`  TK ${acc}: ${bal.toLocaleString()} ${sign}`);
      totalEquity += bal;
    }
  }
});

console.log('\n' + '-'.repeat(40));
console.log(`TỔNG TÀI SẢN: ${totalAssets.toLocaleString()}`);
console.log(`TỔNG NỢ PHẢI TRẢ: ${totalLiabilities.toLocaleString()}`);
console.log(`TỔNG VỐN: ${totalEquity.toLocaleString()}`);

console.log('\n' + '='.repeat(80));
console.log('BÁO CÁO KẾT QUẢ KINH DOANH - Tháng 1/20X8');
console.log('='.repeat(80));

console.log(`\nDoanh thu (TK 511): ${total_revenue.toLocaleString()}`);
console.log(`Giá vốn hàng bán (TK 632): ${total_cogs.toLocaleString()}`);
console.log(`Lợi nhuận gộp: ${(total_revenue - total_cogs).toLocaleString()}`);
console.log(`\nChi phí hoạt động:`);
console.log(`  - Tiền lương: ${net_salary.toLocaleString()}`);
console.log(`  - Khấu hao TSCĐ: ${(depreciation_mgmt + depreciation_sales).toLocaleString()}`);
console.log(`  - Tiếp khách: ${(business_entertainment + business_entertainment_vat).toLocaleString()}`);
console.log(`  - Vận chuyển: ${(domestic_shipping + domestic_shipping_vat).toLocaleString()}`);
console.log(`  - Chi phí logistics: ${logistics_total.toLocaleString()}`);
console.log(`\nLợi nhuận trước thuế: ${profit_before_tax.toLocaleString()}`);
console.log(`Thuế TNDN (20%): ${corporate_tax.toLocaleString()}`);
console.log(`Lợi nhuận sau thuế: ${net_profit.toLocaleString()}`);

console.log('\n' + '='.repeat(80));
console.log('HÀNG TỒN KHO CUỐI KỲ (FIFO)');
console.log('='.repeat(80));
console.log(`Rượu A: ${fifoLots['A'].reduce((sum, lot) => sum + lot.remaining, 0)} chai`);
console.log(`Rượu B: ${fifoLots['B'].reduce((sum, lot) => sum + lot.remaining, 0)} chai`);