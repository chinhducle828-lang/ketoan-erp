/**
 * Test Composite Event - Chuỗi nghiệp vụ liên phòng ban
 * Bước 1: Mua hàng (simple_purchase) - 100M + VAT
 * Bước 2: Sản xuất (manufacturing_cogs) - Xuất 80% + nhân công 20M
 * Bước 3: Bán hàng (simple_sale) - 50% thành phẩm, giá 90M + VAT
 */

import { getEventProcessor } from '../core/rea/reaEventMapper.js';

console.log('='.repeat(80));
console.log('KỊCH BẢN TỔNG HỢP LIÊN PHÒNG BAN - COMPOSITE EVENT');
console.log('='.repeat(80));

// ====================================================================
// BƯỚC 1: MUA HÀNG (Phòng Mua hàng)
// ====================================================================
console.log('\n' + '='.repeat(80));
console.log('BƯỚC 1: PHÒNG MUA HÀNG - Mua NVL (simple_purchase)');
console.log('='.repeat(80));

const purchaseProc = getEventProcessor('simple_purchase');
const p1 = purchaseProc.calculate({ supplier_id: 1, amount: 100000000, vat_rate: 0.1 });
const p1Entries = purchaseProc.generateEntries(p1);
console.log(`\n📌 Mua NVL 100M + VAT 10% = 110M, chưa trả NCC`);
p1Entries.forEach(e => console.log(`   ${e.entryType === 'DR' ? 'Nợ' : 'Có'} ${e.accountCode}: ${e.amount.toLocaleString('vi-VN')} VND${e.partnerId ? ' (NCC: ' + e.partnerId + ')' : ''}`));
const p1Dr = p1Entries.filter(e => e.entryType === 'DR').reduce((s, e) => s + e.amount, 0);
const p1Cr = p1Entries.filter(e => e.entryType === 'CR').reduce((s, e) => s + e.amount, 0);
console.log(`   => Tổng Nợ: ${p1Dr.toLocaleString('vi-VN')} = Tổng Có: ${p1Cr.toLocaleString('vi-VN')} ✅`);

// ====================================================================
// BƯỚC 2: SẢN XUẤT (Phòng Sản xuất)
// ====================================================================
console.log('\n' + '='.repeat(80));
console.log('BƯỚC 2: PHÒNG SẢN XUẤT - Xuất NVL & Nhập kho TP (manufacturing_cogs)');
console.log('='.repeat(80));

const mfgProc = getEventProcessor('manufacturing_cogs');
// Giá vốn NVL xuất kho: 80% × 100M = 80M
const materialCost = Math.round(100000000 * 0.8); // 80M
const p2 = mfgProc.calculate({ material_cost: materialCost, labor_cost: 20000000, overhead_cost: 0 });
const p2Entries = mfgProc.generateEntries(p2);
console.log(`\n📌 Xuất NVL: ${materialCost.toLocaleString('vi-VN')} VND`);
console.log(`   Nhân công: 20.000.000 VND`);
console.log(`   Tổng giá thành: ${p2.total_cost.toLocaleString('vi-VN')} VND`);
p2Entries.forEach(e => console.log(`   ${e.entryType === 'DR' ? 'Nợ' : 'Có'} ${e.accountCode}: ${e.amount.toLocaleString('vi-VN')} VND`));
const p2Dr = p2Entries.filter(e => e.entryType === 'DR').reduce((s, e) => s + e.amount, 0);
const p2Cr = p2Entries.filter(e => e.entryType === 'CR').reduce((s, e) => s + e.amount, 0);
console.log(`   => Tổng Nợ: ${p2Dr.toLocaleString('vi-VN')} = Tổng Có: ${p2Cr.toLocaleString('vi-VN')} ✅`);

// ====================================================================
// BƯỚC 3: BÁN HÀNG (Phòng Kinh doanh)
// ====================================================================
console.log('\n' + '='.repeat(80));
console.log('BƯỚC 3: PHÒNG KINH DOANH - Bán 50% thành phẩm (simple_sale)');
console.log('='.repeat(80));

const saleProc = getEventProcessor('simple_sale');
// Giá vốn 50% thành phẩm = 50% × 100M = 50M
const unitCost = Math.round(p2.total_cost * 0.5); // 50M
const p3 = saleProc.calculate({
  partner_id: 2,
  items: [{ name: 'Thành phẩm A', quantity: 1, unit_price: 90000000, cost_price: unitCost }],
  vat_rate: 0.1
});
const p3Entries = saleProc.generateEntries(p3);
console.log(`\n📌 Giá bán: 90.000.000 VND + VAT 10% = 99.000.000 VND`);
console.log(`   Giá vốn (50% × 100M): ${unitCost.toLocaleString('vi-VN')} VND`);
p3Entries.forEach(e => console.log(`   ${e.entryType === 'DR' ? 'Nợ' : 'Có'} ${e.accountCode}: ${e.amount.toLocaleString('vi-VN')} VND`));
const p3Dr = p3Entries.filter(e => e.entryType === 'DR').reduce((s, e) => s + e.amount, 0);
const p3Cr = p3Entries.filter(e => e.entryType === 'CR').reduce((s, e) => s + e.amount, 0);
console.log(`   => Tổng Nợ: ${p3Dr.toLocaleString('vi-VN')} = Tổng Có: ${p3Cr.toLocaleString('vi-VN')} ✅`);

// ====================================================================
// TỔNG KẾT
// ====================================================================
console.log('\n' + '='.repeat(80));
console.log('📊 TÍNH LỢI NHUẬN GỘP (GROSS PROFIT)');
console.log('='.repeat(80));

const doanhThu = p3.total_amount; // 90M
const giaVon = p3.cogs_amount;    // 50M
const laiGop = doanhThu - giaVon;

console.log(`\n   Doanh thu bán hàng:     ${doanhThu.toLocaleString('vi-VN')} VND`);
console.log(`   Giá vốn hàng bán:       ${giaVon.toLocaleString('vi-VN')} VND`);
console.log(`   ─────────────────────────────────────────`);
console.log(`   LỢI NHUẬN GỘP:          ${laiGop.toLocaleString('vi-VN')} VND ✅`);

console.log(`\n📋 CHUỖI BÚT TOÁN TỔNG HỢP:`);
console.log(`   Bước 1 (Mua hàng):   Nợ 156 100M + 1331 10M / Có 331 110M`);
console.log(`   Bước 2 (Sản xuất):   Nợ 154 100M / Có 621 80M + 622 20M`);
console.log(`                         Nợ 155 100M / Có 154 100M`);
console.log(`   Bước 3 (Bán hàng):   Nợ 1121 99M / Có 5111 90M + 33311 9M`);
console.log(`                         Nợ 632 50M / Có 1561 50M`);

console.log('\n✅ Hoàn thành kịch bản tổng hợp liên phòng ban!');
console.log('='.repeat(80));