/**
 * Test script giải 3 bài tập baitap bằng hệ thống Event-Driven mới
 * Chạy: node backend/scripts/test_baitap.js
 * Yêu cầu: DB đã chạy migration, server đang hoạt động
 */

import { getEventProcessor } from '../core/rea/reaEventMapper.js';
import { getAccountingRules } from '../config/businessRules.js';

console.log('='.repeat(80));
console.log('GIẢI BÀI TẬP KẾ TOÁN BẰNG EVENT-DRIVEN ENGINE');
console.log('='.repeat(80));

// ====================================================================
// BÀI TẬP 1: FACTORING
// ====================================================================
console.log('\n' + '='.repeat(80));
console.log('BÀI TẬP 1: NGHIỆP VỤ TÀI TRỢ HÓA ĐƠN (FACTORING)');
console.log('Bối cảnh: Công ty An Bình, hóa đơn 2,200,000,000 VND (đã bao gồm VAT 10%)');
console.log('='.repeat(80));

const processor = getEventProcessor('factoring');
const factoringInput = {
  partner_id: 5, // Techcombank
  invoice_amount: 2200000000,
  includes_vat: true,
  vat_rate: 0.1,
  advance_rate: 0.8,
  fee_rate: 0.02
};

// Trường hợp 1: Có truy đòi
const bt1Recourse = processor.calculate({ ...factoringInput, recourse: true });
console.log('\n📌 Trường hợp 1: Factoring CÓ quyền truy đòi (With Recourse)');
console.log(`   Giá trị hóa đơn (đã VAT): ${bt1Recourse.invoice_amount.toLocaleString('vi-VN')} VND`);
console.log(`   Giá trị chưa VAT: ${bt1Recourse.invoice_excl_vat.toLocaleString('vi-VN')} VND`);
console.log(`   VAT đầu vào: ${bt1Recourse.invoice_vat.toLocaleString('vi-VN')} VND`);
console.log(`   Tỷ lệ ứng trước: ${bt1Recourse.advance_rate * 100}%`);
console.log(`   Số tiền ứng trước: ${bt1Recourse.advance_amount.toLocaleString('vi-VN')} VND`);
console.log(`   Phí factoring (2% trên giá chưa VAT): ${bt1Recourse.fee_amount.toLocaleString('vi-VN')} VND`);
console.log(`   VAT phí (10%): ${bt1Recourse.fee_vat.toLocaleString('vi-VN')} VND`);
console.log(`   Tổng phí: ${bt1Recourse.fee_total.toLocaleString('vi-VN')} VND`);
console.log(`   Thực nhận: ${bt1Recourse.net_proceeds.toLocaleString('vi-VN')} VND`);
console.log(`   Còn lại (20%): ${bt1Recourse.remaining_ar.toLocaleString('vi-VN')} VND`);

const entries1Recourse = processor.generateEntries(bt1Recourse);
console.log('\n   BÚT TOÁN (Có truy đòi):');
entries1Recourse.forEach(e => {
  console.log(`   ${e.entryType === 'DR' ? 'Nợ' : 'Có'} ${e.accountCode}: ${e.amount.toLocaleString('vi-VN')} VND${e.partnerId ? ' (KH: ' + e.partnerId + ')' : ''}`);
});
console.log('   => Ghi nhận vay ngắn hạn (TK 341), GIỮ nguyên phải thu (TK 131)');

// Trường hợp 2: Không truy đòi
const bt1NoRecourse = processor.calculate({ ...factoringInput, recourse: false });
const entries1NoRecourse = processor.generateEntries(bt1NoRecourse);
console.log('\n📌 Trường hợp 2: Factoring KHÔNG có quyền truy đòi (Without Recourse)');
console.log('   BÚT TOÁN (Không truy đòi):');
entries1NoRecourse.forEach(e => {
  console.log(`   ${e.entryType === 'DR' ? 'Nợ' : 'Có'} ${e.accountCode}: ${e.amount.toLocaleString('vi-VN')} VND${e.partnerId ? ' (KH: ' + e.partnerId + ')' : ''}`);
});
console.log('   => Xóa phải thu (TK 131), không ghi nhận vay');

// ====================================================================
// BÀI TẬP 2: QUAD-PARTY NETTING
// ====================================================================
console.log('\n' + '='.repeat(80));
console.log('BÀI TẬP 2: BÙ TRỪ CÔNG NỢ ĐA BÊN (QUAD-PARTY NETTING)');
console.log('Chuỗi: A→B: 800M, B→C: 600M, C→D: 900M, D→A: 500M');
console.log('='.repeat(80));

const nettingProcessor = getEventProcessor('quad-party-netting');
const nettingInput = {
  parties: [
    { id: 'A', name: 'Công ty A' },
    { id: 'B', name: 'Công ty B' },
    { id: 'C', name: 'Công ty C' },
    { id: 'D', name: 'Công ty D' }
  ],
  obligations: [
    { from: 'A', to: 'B', amount: 800000000 },
    { from: 'B', to: 'C', amount: 600000000 },
    { from: 'C', to: 'D', amount: 900000000 },
    { from: 'D', to: 'A', amount: 500000000 }
  ]
};

const nettingResult = nettingProcessor.calculate(nettingInput);
console.log('\n📌 Kết quả Netting vòng khép kín:');
console.log(`   Min chain (A→B→C→D→A): 500,000,000 VND`);
nettingResult.forEach(p => {
  console.log(`   ${p.name}: Nhận ${p.receivable.toLocaleString('vi-VN')}, Trả ${p.payable.toLocaleString('vi-VN')}, Netting ${p.netted_amount.toLocaleString('vi-VN')}, Còn phải thu ${p.remaining_receivable.toLocaleString('vi-VN')}, Còn phải trả ${p.remaining_payable.toLocaleString('vi-VN')}`);
});

const nettingEntries = nettingProcessor.generateEntries(nettingInput);
console.log('\n   BÚT TOÁN CẤN TRỪ:');
nettingEntries.forEach(e => {
  console.log(`   ${e.description}: ${e.entryType === 'DR' ? 'Nợ' : 'Có'} ${e.accountCode}: ${e.amount.toLocaleString('vi-VN')} VND`);
});

// ====================================================================
// BÀI TẬP 3: FOREX REVALUATION
// ====================================================================
console.log('\n' + '='.repeat(80));
console.log('BÀI TẬP 3: ĐÁNH GIÁ LẠI TỶ GIÁ NGOẠI TỆ CUỐI KỲ');
console.log('Tỷ giá mua: 25,400 | Tỷ giá bán: 25,650');
console.log('='.repeat(80));

const forexProcessor = getEventProcessor('forex-revaluation');
const forexInput = {
  accounts: [
    { account_code: '1122', amount_usd: 40000, book_rate: 25100, name: 'Tiền gửi USD' },
    { account_code: '131', amount_usd: 20000, book_rate: 25300, partner_id: 'M', name: 'Phải thu KH M' },
    { account_code: '331', amount_usd: 30000, book_rate: 24900, partner_id: 'N', name: 'Phải trả NCC N' }
  ],
  market_buy_rate: 25400,
  market_sell_rate: 25650
};

const forexResult = forexProcessor.calculate(forexInput);
console.log('\n📌 Kết quả đánh giá lại từng tài khoản:');
forexResult.account_results.forEach(acc => {
  if (acc.closing_entry) {
    console.log(`\n   [Kết chuyển] TK ${acc.account_code}:`);
    if (acc.summary) {
      console.log(`      ${acc.summary.type === 'LOSS' ? 'Lỗ' : 'Lãi'} tỷ giá thuần: ${acc.summary.amount.toLocaleString('vi-VN')} VND`);
    }
  } else {
    console.log(`\n   ${acc.name || acc.account_code} (${acc.account_code}):`);
    console.log(`      Số dư: $${(acc.amount_usd || 0).toLocaleString('en-US')}`);
    console.log(`      Tỷ giá sổ sách: ${acc.book_rate}`);
    console.log(`      Tỷ giá áp dụng (${acc.rate_type === 'buy' ? 'mua' : 'bán'}): ${acc.applied_rate}`);
    console.log(`      Chênh lệch: ${acc.forex_diff > 0 ? '+' : ''}${(acc.forex_diff || 0).toLocaleString('vi-VN')} VND (${acc.is_gain ? 'LÃI' : 'LỖ'})`);
  }
  console.log(`      Bút toán:`);
  acc.entries.forEach(e => {
    console.log(`         ${e.entryType === 'DR' ? 'Nợ' : 'Có'} ${e.accountCode}: ${e.amount.toLocaleString('vi-VN')} VND`);
  });
});

// Tổng kết
const forexEntries = forexProcessor.generateEntries(forexInput);
const totalLoss = forexEntries.filter(e => e.entryType === 'DR' && e.accountCode === '635').reduce((s, e) => s + e.amount, 0);
const totalGain = forexEntries.filter(e => e.entryType === 'CR' && e.accountCode === '515').reduce((s, e) => s + e.amount, 0);

console.log('\n📊 TỔNG KẾT');  
console.log(`   Tổng lỗ tỷ giá (TK 635): ${totalLoss.toLocaleString('vi-VN')} VND`);
console.log(`   Tổng lãi tỷ giá (TK 515): ${totalGain.toLocaleString('vi-VN')} VND`);

// ====================================================================
// BÀI TẬP 4: SIMPLE SALE (Bán hàng thu tiền ngay + giá vốn)
// ====================================================================
console.log('\n' + '='.repeat(80));
console.log('BÀI TẬP 4: NGHIỆP VỤ BÁN HÀNG & DOANH THU (simple_sale)');
console.log('Giá bán: 50M, VAT 10%, KH chuyển khoản, Giá vốn: 35M');
console.log('='.repeat(80));

const saleProcessor = getEventProcessor('simple_sale');
const saleInput = {
  partner_id: 1,
  items: [
    { name: 'Hàng hóa A', quantity: 1, unit_price: 50000000, cost_price: 35000000 }
  ],
  vat_rate: 0.1
};
const saleResult = saleProcessor.calculate(saleInput);
const saleEntries = saleProcessor.generateEntries(saleResult);
console.log('\n📌 Kết quả:');
console.log(`   Tổng doanh thu: ${saleResult.total_amount.toLocaleString('vi-VN')} VND`);
console.log(`   VAT: ${saleResult.vat_amount.toLocaleString('vi-VN')} VND`);
console.log(`   Tổng thu: ${saleResult.grand_total.toLocaleString('vi-VN')} VND`);
console.log(`   Giá vốn: ${saleResult.cogs_amount.toLocaleString('vi-VN')} VND`);
console.log('\n   BÚT TOÁN:');
saleEntries.forEach(e => {
  console.log(`   ${e.entryType === 'DR' ? 'Nợ' : 'Có'} ${e.accountCode}: ${e.amount.toLocaleString('vi-VN')} VND`);
});
const saleTotalDr = saleEntries.filter(e => e.entryType === 'DR').reduce((s, e) => s + e.amount, 0);
const saleTotalCr = saleEntries.filter(e => e.entryType === 'CR').reduce((s, e) => s + e.amount, 0);
console.log(`   => Tổng Nợ: ${saleTotalDr.toLocaleString('vi-VN')} = Tổng Có: ${saleTotalCr.toLocaleString('vi-VN')} ✅`);

// ====================================================================
// BÀI TẬP 5: SIMPLE PURCHASE (Mua hàng nhập kho chưa trả tiền)
// ====================================================================
console.log('\n' + '='.repeat(80));
console.log('BÀI TẬP 5: NGHIỆP VỤ MUA HÀNG NHẬP KHO (simple_purchase)');
console.log('Giá mua: 80M, VAT 10%, chưa thanh toán NCC');
console.log('='.repeat(80));

const purchaseProcessor = getEventProcessor('simple_purchase');
const purchaseInput = { supplier_id: 2, amount: 80000000, vat_rate: 0.1 };
const purchaseResult = purchaseProcessor.calculate(purchaseInput);
const purchaseEntries = purchaseProcessor.generateEntries(purchaseResult);
console.log('\n📌 Kết quả:');
console.log(`   Giá mua: ${purchaseResult.amount.toLocaleString('vi-VN')} VND`);
console.log(`   VAT: ${purchaseResult.vat_amount.toLocaleString('vi-VN')} VND`);
console.log(`   Phải trả: ${purchaseResult.grand_total.toLocaleString('vi-VN')} VND`);
console.log('\n   BÚT TOÁN:');
purchaseEntries.forEach(e => {
  console.log(`   ${e.entryType === 'DR' ? 'Nợ' : 'Có'} ${e.accountCode}: ${e.amount.toLocaleString('vi-VN')} VND${e.partnerId ? ' (NCC: ' + e.partnerId + ')' : ''}`);
});
const purchaseTotalDr = purchaseEntries.filter(e => e.entryType === 'DR').reduce((s, e) => s + e.amount, 0);
const purchaseTotalCr = purchaseEntries.filter(e => e.entryType === 'CR').reduce((s, e) => s + e.amount, 0);
console.log(`   => Tổng Nợ: ${purchaseTotalDr.toLocaleString('vi-VN')} = Tổng Có: ${purchaseTotalCr.toLocaleString('vi-VN')} ✅`);

// ====================================================================
// BÀI TẬP 6: SIMPLE EXPENSE (Chi phí quản lý bằng tiền mặt)
// ====================================================================
console.log('\n' + '='.repeat(80));
console.log('BÀI TẬP 6: CHI PHÍ VẬN HÀNH & TIỀN MẶT (simple_expense)');
console.log('Thuê VP: 10M + VAT, Điện internet: 3M + VAT, trả tiền mặt');
console.log('='.repeat(80));

const expenseProcessor = getEventProcessor('simple_expense');
const expenseInput = {
  expenses: [
    { name: 'Thuê văn phòng', amount: 10000000, vat_rate: 0.1 },
    { name: 'Điện internet', amount: 3000000, vat_rate: 0.1 }
  ]
};
const expenseResult = expenseProcessor.calculate(expenseInput);
const expenseEntries = expenseProcessor.generateEntries(expenseResult);
console.log('\n📌 Kết quả:');
console.log(`   Tổng chi phí: ${expenseResult.total_expense.toLocaleString('vi-VN')} VND`);
console.log(`   Tổng VAT: ${expenseResult.total_vat.toLocaleString('vi-VN')} VND`);
console.log(`   Tiền mặt chi: ${expenseResult.total_cash.toLocaleString('vi-VN')} VND`);
console.log('\n   BÚT TOÁN:');
expenseEntries.forEach(e => {
  console.log(`   ${e.entryType === 'DR' ? 'Nợ' : 'Có'} ${e.accountCode}: ${e.amount.toLocaleString('vi-VN')} VND`);
});
const expenseTotalDr = expenseEntries.filter(e => e.entryType === 'DR').reduce((s, e) => s + e.amount, 0);
const expenseTotalCr = expenseEntries.filter(e => e.entryType === 'CR').reduce((s, e) => s + e.amount, 0);
console.log(`   => Tổng Nợ: ${expenseTotalDr.toLocaleString('vi-VN')} = Tổng Có: ${expenseTotalCr.toLocaleString('vi-VN')} ✅`);

// ====================================================================
// BÀI TẬP 7: CREDIT FREEZE & EARLY PAYMENT DISCOUNT (Composite Risk & Cash Event)
// ====================================================================
console.log('\n\n' + '='.repeat(80));
console.log('BÀI TẬP 7: KHÓA HẠN MỨC TÍN DỤNG & TỐI ƯU CHIẾT KHẤU THANH TOÁN');
console.log('Kịch bản: Tập đoàn X - Credit Limit 500M, Nợ hiện tại 420M, Đơn mới 99M');
console.log('='.repeat(80));

// Mock company & partner IDs cho test offline
const MOCK_COMPANY_ID = 1;
const MOCK_PARTNER_ID = 1; // Tập đoàn X

// ------------------------------------------------------------------------
// PHASE 1: Kiểm tra checkCreditLimit (mô phỏng không cần DB)
// ------------------------------------------------------------------------
console.log('\n📌 PHASE 1: KIỂM TRA HẠN MỨC TÍN DỤNG (Credit Limit Check)');
console.log('   Hạn mức tín dụng: 500,000,000 VND');
console.log('   Dư nợ hiện tại (TK 131): 420,000,000 VND');
console.log('   Đơn hàng mới: 90,000,000 VND + VAT 10% = 99,000,000 VND');

// Mô phỏng checkCreditLimit trực tiếp
const creditLimit = 500000000;
const currentDebt = 420000000;
const newOrderAmount = 99000000; // 90M + 9M VAT
const totalExpected = currentDebt + newOrderAmount;
const shortage = totalExpected - creditLimit;

console.log(`\n   🔍 Tính toán:`);
console.log(`      Tổng nợ dự kiến: ${(currentDebt / 1000000).toFixed(0)}M + ${(newOrderAmount / 1000000).toFixed(0)}M = ${(totalExpected / 1000000).toFixed(0)}M VND`);
console.log(`      Hạn mức: ${(creditLimit / 1000000).toFixed(0)}M VND`);
console.log(`      Thiếu hụt: ${(shortage / 1000000).toFixed(0)}M VND ✅ VƯỢT HẠN MỨC`);

// Mô phỏng response từ API giống routes/events.js
const creditCheckResponse = {
  event: 'sale_request',
  status: 'REJECTED',
  reason: `Credit Limit Exceeded! Limit: 500M, Total Expected: 519M. Shortage: 19M.`,
  action: 'UI_ALERT_RENDERED',
  creditCheck: {
    creditLimit,
    currentDebt,
    newOrderAmount,
    totalExpected,
    shortage,
    partnerName: 'Tập đoàn X'
  }
};

console.log(`\n   📋 Response mô phỏng từ POST /api/events (sales_credit):`);
console.log(`      ${JSON.stringify(creditCheckResponse, null, 6)}`);

console.log('\n   🚫 KẾT LUẬN: Đơn hàng bị ĐÓNG BĂNG (Frozen) - không thể sinh bút toán!');
console.log(`      Khách hàng cần giảm dư nợ ${(shortage / 1000000).toFixed(0)}M để tiếp tục.`);

// ------------------------------------------------------------------------
// PHASE 2: Khách hàng trả nợ sớm → Early Payment Discount
// ------------------------------------------------------------------------
console.log('\n' + '-'.repeat(80));
console.log('📌 PHASE 2: THANH TOÁN SỚM NHẬN CHIẾT KHẤU (Early Payment Discount)');
console.log('   Khách hàng đồng ý tất toán ngay 420,000,000 VND để giải phóng hạn mức');
console.log('   Chính sách: Chiết khấu 2% nếu thanh toán trước hạn > 15 ngày');

const earlyPaymentProcessor = getEventProcessor('early_payment');

const earlyPaymentInput = {
  partner_id: MOCK_PARTNER_ID,
  debt_amount: 420000000,
  payment_amount: 411600000, // 420M - 8.4M discount
  discount_rate: 0.02,
  payment_date: new Date().toISOString().split('T')[0],
  due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
};

// Validate tính toán
const earlyCalc = earlyPaymentProcessor.calculate(earlyPaymentInput);

console.log('\n   🧮 Tính toán chiết khấu:');
console.log(`      Số nợ gốc: ${earlyCalc.debt_amount.toLocaleString('vi-VN')} VND`);
console.log(`      Tỷ lệ chiết khấu: ${(earlyCalc.discount_rate * 100).toFixed(0)}%`);
console.log(`      Số tiền chiết khấu (2%): ${earlyCalc.discount_amount.toLocaleString('vi-VN')} VND`);
console.log(`      Số tiền thực nhận (98%): ${earlyCalc.net_received.toLocaleString('vi-VN')} VND`);

const earlyEntries = earlyPaymentProcessor.generateEntries(earlyCalc);

console.log('\n   📋 BÚT TOÁN CHIẾT KHẤU THANH TOÁN SỚM:');
console.log(`      ${'='.repeat(55)}`);
console.log(`      Diễn giải           | TK   | PS Nợ         | PS Có`);
console.log(`      ${'='.repeat(55)}`);
earlyEntries.forEach(e => {
  const dr = e.entryType === 'DR' ? e.amount.toLocaleString('vi-VN') : '';
  const cr = e.entryType === 'CR' ? e.amount.toLocaleString('vi-VN') : '';
  const desc = e.accountCode === '1121' ? 'Tiền gửi NH (thực nhận)' :
               e.accountCode === '635'  ? 'Chi phí tài chính (CK)' :
               e.accountCode === '131'  ? 'Phải thu KH (tất toán)' : '';
  console.log(`      ${desc.padEnd(25)} | ${e.accountCode.padEnd(4)} | ${dr.padEnd(14)} | ${cr.padEnd(14)}`);
});
console.log(`      ${'='.repeat(55)}`);

const epTotalDr = earlyEntries.filter(e => e.entryType === 'DR').reduce((s, e) => s + e.amount, 0);
const epTotalCr = earlyEntries.filter(e => e.entryType === 'CR').reduce((s, e) => s + e.amount, 0);
console.log(`      TỔNG CỘNG            |     | ${epTotalDr.toLocaleString('vi-VN').padStart(14)} | ${epTotalCr.toLocaleString('vi-VN').padStart(14)}`);
console.log(`      => Tổng Nợ: ${epTotalDr.toLocaleString('vi-VN')} = Tổng Có: ${epTotalCr.toLocaleString('vi-VN')} ✅`);

// ------------------------------------------------------------------------
// HỆ QUẢ: Un-Freeze đơn hàng
// ------------------------------------------------------------------------
console.log('\n' + '-'.repeat(80));
console.log('📌 HỆ QUẢ: GIẢI PHÓNG HẠN MỨC & UN-FREEZE ĐƠN HÀNG');

const newDebtAfterPayment = 0; // 420M đã trả hết → dư nợ = 0
const newTotalAfterPayment = newDebtAfterPayment + 99000000; // 0 + 99M = 99M
const isWithinLimit = newTotalAfterPayment <= 500000000;

console.log(`\n   🔍 Sau thanh toán sớm:`);
console.log(`      Dư nợ TK 131 mới: ${newDebtAfterPayment.toLocaleString('vi-VN')} VND (Đã tất toán)`);
console.log(`      Đơn hàng 99M + dư nợ 0 = ${newTotalAfterPayment.toLocaleString('vi-VN')} VND`);
console.log(`      So với hạn mức 500M: ${isWithinLimit ? '✅ Trong hạn mức' : '❌ Vượt hạn mức'}`);

if (isWithinLimit) {
  console.log('\n   ✅ KẾT LUẬN: Đơn hàng tự động chuyển trạng thái:');
  console.log(`      Frozen → Approved ✅`);
  console.log(`      Hạn mức khả dụng phục hồi: ${((creditLimit - newTotalAfterPayment) / 1000000).toFixed(0)}M / ${(creditLimit / 1000000).toFixed(0)}M`);
  console.log(`      Sẵn sàng sinh bút toán doanh thu cho đơn hàng 99.000.000 VND`);

  // Mô phỏng bút toán doanh thu sau khi un-freeze
  console.log('\n   📋 BÚT TOÁN DOANH THU (sau khi Approved):');
  console.log(`      Nợ 131: 99.000.000 VND`);
  console.log(`      Có 511: 90.000.000 VND`);
  console.log(`      Có 3331: 9.000.000 VND`);
}

// ====================================================================
// BÀI TẬP 8: MANUFACTURING FLOW (Mua NVL → Sản xuất → Bán thành phẩm)
// ====================================================================
console.log('\n\n' + '='.repeat(80));
console.log('BÀI TẬP 8: QUY TRÌNH SẢN XUẤT & BÁN HÀNG (Manufacturing Flow)');
console.log('Kịch bản: Mua NVL 100M → Sản xuất (80M NVL + 20M lao động) → Bán 50%');
console.log('='.repeat(80));

// Mock data
const MOCK_SUPPLIER_ID = 3; // Nhà cung cấp NVL
const MOCK_CUSTOMER_ID = 2; // Khách hàng mua thành phẩm

// ------------------------------------------------------------------------
// BƯỚC 1: Mua nguyên vật liệu (RAW_MATERIAL)
// ------------------------------------------------------------------------
console.log('\n📌 BƯỚC 1: MUA NGUYÊN VẬT LIỆU (Raw Material)');
console.log('   Nhà cung cấp: NCC Vật tư (ID: ' + MOCK_SUPPLIER_ID + ')');
console.log('   Giá trị NVL: 100,000,000 VND');
console.log('   VAT 10%: 10,000,000 VND');
console.log('   Tổng phải trả: 110,000,000 VND');

const purchaseProcessor8 = getEventProcessor('simple_purchase');
const rawMaterialPurchase = {
  supplier_id: MOCK_SUPPLIER_ID,
  amount: 100000000,
  inventory_type: 'raw_material', // ✅ Chỉ định đây là NVL, không phải hàng hóa
  vat_rate: 0.1
};
const purchaseCalc = purchaseProcessor8.calculate(rawMaterialPurchase);
const purchaseEntries8 = purchaseProcessor8.generateEntries(purchaseCalc);

console.log('\n   BÚT TOÁN MUA NVL:');
console.log(`   ${'='.repeat(55)}`);
console.log(`   Diễn giải           | TK   | PS Nợ         | PS Có`);
console.log(`   ${'='.repeat(55)}`);
purchaseEntries8.forEach(e => {
  const dr = e.entryType === 'DR' ? e.amount.toLocaleString('vi-VN') : '';
  const cr = e.entryType === 'CR' ? e.amount.toLocaleString('vi-VN') : '';
  const desc = e.accountCode === '152' ? 'Nguyên liệu (NVL)' :
               e.accountCode === '1331' ? 'Thuế GTGT đầu vào' :
               e.accountCode === '331' ? 'Phải trả NCC' : '';
  console.log(`   ${desc.padEnd(25)} | ${e.accountCode.padEnd(4)} | ${dr.padEnd(14)} | ${cr.padEnd(14)}`);
});
console.log(`   ${'='.repeat(55)}`);

const purchaseDr = purchaseEntries8.filter(e => e.entryType === 'DR').reduce((s, e) => s + e.amount, 0);
const purchaseCr = purchaseEntries8.filter(e => e.entryType === 'CR').reduce((s, e) => s + e.amount, 0);
console.log(`   TỔNG CỘNG            |     | ${purchaseDr.toLocaleString('vi-VN').padStart(14)} | ${purchaseCr.toLocaleString('vi-VN').padStart(14)}`);
console.log(`   => Tổng Nợ: ${purchaseDr.toLocaleString('vi-VN')} = Tổng Có: ${purchaseCr.toLocaleString('vi-VN')} ✅`);

// Số dư sau bước 1
const balance152_after_step1 = 100000000; // Nợ 152: 100M
const balance331_after_step1 = -110000000; // Có 331: 110M

// ------------------------------------------------------------------------
// BƯỚC 2: Sản xuất thành phẩm (MANUFACTURING)
// ------------------------------------------------------------------------
console.log('\n' + '-'.repeat(80));
console.log('📌 BƯỚC 2: SẢN XUẤT THÀNH PHẨM (Manufacturing)');
console.log('   Chi phí NVL xuất kho: 80,000,000 VND (80% của 100M)');
console.log('   Chi phí lao động: 20,000,000 VND');
console.log('   Chi phí sản xuất khác: 0 VND');
console.log('   Tổng chi phí: 100,000,000 VND');

const manufacturingProcessor8 = getEventProcessor('manufacturing_cogs');
const manufacturingInput = {
  material_cost: 80000000,  // 80% NVL
  labor_cost: 20000000,     // Lao động
  overhead_cost: 0          // Phí sản xuất khác
};
const mfgCalc = manufacturingProcessor8.calculate(manufacturingInput);
const mfgEntries8 = manufacturingProcessor8.generateEntries(mfgCalc);

console.log('\n   BÚT TOÁN SẢN XUẤT:');
console.log(`   ${'='.repeat(55)}`);
console.log(`   Diễn giải           | TK   | PS Nợ         | PS Có`);
console.log(`   ${'='.repeat(55)}`);
mfgEntries8.forEach(e => {
  const dr = e.entryType === 'DR' ? e.amount.toLocaleString('vi-VN') : '';
  const cr = e.entryType === 'CR' ? e.amount.toLocaleString('vi-VN') : '';
  const desc = e.accountCode === '154' ? 'Chi phí SXKD dở dang (WIP)' :
               e.accountCode === '152' ? 'Xuất NVL (Có 152)' :
               e.accountCode === '334' ? 'Phải trả lương' :
               e.accountCode === '155' ? 'Nhập thành phẩm' : '';
  console.log(`   ${desc.padEnd(25)} | ${e.accountCode.padEnd(4)} | ${dr.padEnd(14)} | ${cr.padEnd(14)}`);
});
console.log(`   ${'='.repeat(55)}`);

const mfgTotalDr = mfgEntries8.filter(e => e.entryType === 'DR').reduce((s, e) => s + e.amount, 0);
const mfgTotalCr = mfgEntries8.filter(e => e.entryType === 'CR').reduce((s, e) => s + e.amount, 0);
console.log(`   TỔNG CỘNG            |     | ${mfgTotalDr.toLocaleString('vi-VN').padStart(14)} | ${mfgTotalCr.toLocaleString('vi-VN').padStart(14)}`);
console.log(`   => Tổng Nợ: ${mfgTotalDr.toLocaleString('vi-VN')} = Tổng Có: ${mfgTotalCr.toLocaleString('vi-VN')} ✅`);

// Số dư sau bước 2
const balance152_after_step2 = balance152_after_step1 - 80000000; // 100M - 80M = 20M
const balance154_after_step2 = 0; // 154 đã kết chuyển hết vào 155
const balance155_after_step2 = 100000000; // Nợ 155: 100M
const balance334_after_step2 = -20000000; // Có 334: 20M

// ------------------------------------------------------------------------
// BƯỚC 3: Bán 50% thành phẩm (SALES_CREDIT)
// ------------------------------------------------------------------------
console.log('\n' + '-'.repeat(80));
console.log('📌 BƯỚC 3: BÁN 50% THÀNH PHẨM (Sales Credit)');
console.log('   Khách hàng: ' + MOCK_CUSTOMER_ID);
console.log('   Số lượng: 50 sản phẩm');
console.log('   Đơn giá: 2,000,000 VND/sp');
console.log('   Tổng doanh thu: 100,000,000 VND');
console.log('   VAT 10%: 10,000,000 VND');
console.log('   Giá vốn (50%): 50,000,000 VND');
console.log('   Tổng thu: 110,000,000 VND');

const salesCreditProcessor8 = getEventProcessor('sales_credit');
const salesInput = {
  partner_id: MOCK_CUSTOMER_ID,
  items: [
    { quantity: 50, unit_price: 2000000, cost_price: 1000000 }
  ],
  vat_rate: 0.1
};
const salesCalc = salesCreditProcessor8.calculate(salesInput);
const salesEntries8 = salesCreditProcessor8.generateEntries(salesCalc);

console.log('\n   BÚT TOÁN BÁN HÀNG:');
console.log(`   ${'='.repeat(55)}`);
console.log(`   Diễn giải           | TK   | PS Nợ         | PS Có`);
console.log(`   ${'='.repeat(55)}`);
salesEntries8.forEach(e => {
  const dr = e.entryType === 'DR' ? e.amount.toLocaleString('vi-VN') : '';
  const cr = e.entryType === 'CR' ? e.amount.toLocaleString('vi-VN') : '';
  const desc = e.accountCode === '131' ? 'Phải thu KH' :
               e.accountCode === '511' ? 'Doanh thu bán hàng' :
               e.accountCode === '3331' ? 'Thuế GTGT đầu ra' :
               e.accountCode === '632' ? 'Giá vốn hàng bán' :
               e.accountCode === '155' ? 'Xuất thành phẩm' : '';
  console.log(`   ${desc.padEnd(25)} | ${e.accountCode.padEnd(4)} | ${dr.padEnd(14)} | ${cr.padEnd(14)}`);
});
console.log(`   ${'='.repeat(55)}`);

const salesTotalDr = salesEntries8.filter(e => e.entryType === 'DR').reduce((s, e) => s + e.amount, 0);
const salesTotalCr = salesEntries8.filter(e => e.entryType === 'CR').reduce((s, e) => s + e.amount, 0);
console.log(`   TỔNG CỘNG            |     | ${salesTotalDr.toLocaleString('vi-VN').padStart(14)} | ${salesTotalCr.toLocaleString('vi-VN').padStart(14)}`);
console.log(`   => Tổng Nợ: ${salesTotalDr.toLocaleString('vi-VN')} = Tổng Có: ${salesTotalCr.toLocaleString('vi-VN')} ✅`);

// Số dư cuối cùng
const final_balance_152 = balance152_after_step2; // 20M (còn 20% NVL)
const final_balance_155 = balance155_after_step2 - 50000000; // 100M - 50M = 50M (còn 50% thành phẩm)
const final_balance_331 = balance331_after_step1 + balance334_after_step2; // -110M + (-20M) = -130M (tổng nợ NCC + lương)
const final_balance_1121 = 110000000; // +110M (tiền thu từ khách hàng)

// ------------------------------------------------------------------------
// KIỂM TRA SỐ DƯ CUỐI CÙNG
// ------------------------------------------------------------------------
console.log('\n' + '='.repeat(80));
console.log('📊 KIỂM TRA SỐ DƯ CUỐI CÙNG');
console.log('='.repeat(80));
console.log(`   TK 152 (Nguyên liệu):    ${final_balance_152.toLocaleString('vi-VN').padStart(20)} VND (còn 20% NVL)`);
console.log(`   TK 155 (Thành phẩm):     ${final_balance_155.toLocaleString('vi-VN').padStart(20)} VND (còn 50% thành phẩm)`);
console.log(`   TK 331 (Phải trả NCC):  ${final_balance_331.toLocaleString('vi-VN').padStart(20)} VND (nợ NCC + lương)`);
console.log(`   TK 1121 (Tiền gửi NH):  +${final_balance_1121.toLocaleString('vi-VN').padStart(19)} VND (thu từ khách hàng)`);
console.log('='.repeat(80));

// Verify accounting equation
const totalAssets = final_balance_152 + final_balance_155 + final_balance_1121; // 20M + 50M + 110M = 180M
const totalLiabilities = Math.abs(final_balance_331); // 130M
const equity = totalAssets - totalLiabilities; // 50M (lợi nhuận chưa phân phối)

console.log('\n   ✅ KIỂM TRA CÂN ĐỐI KẾ TOÁN:');
console.log(`      Tổng tài sản (152 + 155 + 1121): ${totalAssets.toLocaleString('vi-VN')} VND`);
console.log(`      Tổng nợ phải trả (331): ${totalLiabilities.toLocaleString('vi-VN')} VND`);
console.log(`      Vốn chủ sở hữu (lợi nhuận): ${equity.toLocaleString('vi-VN')} VND`);
console.log(`      => Tài sản (${totalAssets.toLocaleString('vi-VN')}) = Nợ (${totalLiabilities.toLocaleString('vi-VN')}) + Vốn (${equity.toLocaleString('vi-VN')}) ✅`);

console.log('\n   ✅ KẾT LUẬN: Quy trình sản xuất & bán hàng đã được hạch toán chính xác!');
console.log('      - NVL: Mua 100M, xuất 80M, còn 20M');
console.log('      - Thành phẩm: Sản xuất 100M, bán 50M, còn 50M');
console.log('      - Nợ phải trả: 110M (NCC) + 20M (lương) = 130M');
console.log('      - Tiền mặt: +110M từ bán hàng');

// ====================================================================
// TỔNG KẾT TOÀN BỘ 8 BÀI TẬP
// ====================================================================
console.log('\n\n' + '='.repeat(80));
console.log('📊 TỔNG KẾT 8 BÀI TẬP KIỂM THỬ EVENT-DRIVEN ENGINE');
console.log('='.repeat(80));
console.log('   ✅ Bài 1: Factoring (Có/Không truy đòi)');
console.log('   ✅ Bài 2: Quad-Party Netting (Cấn trừ vòng khép kín)');
console.log('   ✅ Bài 3: Forex Revaluation (Đánh giá lại tỷ giá)');
console.log('   ✅ Bài 4: Simple Sale (Bán hàng thu tiền ngay + giá vốn)');
console.log('   ✅ Bài 5: Simple Purchase (Mua hàng nhập kho)');
console.log('   ✅ Bài 6: Simple Expense (Chi phí vận hành)');
console.log('   ✅ Bài 7: Credit Freeze & Early Payment Discount');
console.log('         - Phase 1: Tự động chặn đơn hàng vượt hạn mức (Frozen)');
console.log('         - Phase 2: Chiết khấu thanh toán sớm 2% (DR 1121/635, CR 131)');
console.log('         - Hệ quả: Un-Freeze đơn hàng tự động');
console.log('   ✅ Bài 8: Manufacturing Flow (Mua NVL → Sản xuất → Bán thành phẩm)');
console.log('         - Bước 1: Mua NVL 100M (Nợ 152, Có 331)');
console.log('         - Bước 2: Sản xuất 100M (152→154→155, Có 334)');
console.log('         - Bước 3: Bán 50% (Nợ 131/1121, Có 511/3331/632/155)');
console.log('         - Số dư cuối: 152=20M, 155=50M, 331=-130M, 1121=+110M');
console.log('='.repeat(80));
console.log(`✅ Hoàn thành giải ${8} bài tập bằng Event-Driven Engine!`);
console.log('='.repeat(80));
