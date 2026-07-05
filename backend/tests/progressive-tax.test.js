// Test tính thuế lũy tiến TNDN
import { calculateProgressiveTax, getTaxRateByRevenue } from '../services/closing.service.js';

console.log('🧪 === KIỂM TRA TÍNH THUẾ LŨY TIẾN TNDN ===\n');

// Test case 1: Doanh thu <= 3 tỷ
console.log('Test 1: Doanh thu 2 tỷ, lợi nhuận 300 triệu');
const test1 = calculateProgressiveTax(2000000000, 300000000);
console.log(`   Kết quả: ${test1.totalTax.toLocaleString()}đ (áp dụng ${test1.appliedRate * 100}%)`);
console.log(`   Chi tiết: ${JSON.stringify(test1.breakdown, null, 2)}`);
console.log(`   ✅ Mong đợi: 45 triệu (300tr * 15%)`);
console.log(`   ${test1.totalTax === 45000000 ? '✅ PASS' : '❌ FAIL'}\n`);

// Test case 2: Doanh thu 10 tỷ (nằm trong khoảng 3-50 tỷ)
console.log('Test 2: Doanh thu 10 tỷ, lợi nhuận 2 tỷ');
const test2 = calculateProgressiveTax(10000000000, 2000000000);
console.log(`   Kết quả: ${test2.totalTax.toLocaleString()}đ (áp dụng ${test2.appliedRate * 100}%)`);
console.log(`   Chi tiết: ${JSON.stringify(test2.breakdown, null, 2)}`);
// Lợi nhuận trên doanh thu = 20%, nên:
// - 3 tỷ * 20% = 600 triệu * 15% = 90 triệu
// - 7 tỷ * 20% = 1.4 tỷ * 17% = 238 triệu
// Tổng = 328 triệu
console.log(`   ✅ Mong đợi: ~328 triệu (tính theo tỷ lệ lợi nhuận/doanh thu)\n`);

// Test case 3: Doanh thu 60 tỷ (vượt quá 50 tỷ)
console.log('Test 3: Doanh thu 60 tỷ, lợi nhuận 10 tỷ');
const test3 = calculateProgressiveTax(60000000000, 10000000000);
console.log(`   Kết quả: ${test3.totalTax.toLocaleString()}đ (áp dụng ${test3.appliedRate * 100}%)`);
console.log(`   Chi tiết: ${JSON.stringify(test3.breakdown, null, 2)}`);
// Lợi nhuận trên doanh thu = 16.67%
// - 3 tỷ * 16.67% = 500 triệu * 15% = 75 triệu
// - 47 tỷ * 16.67% = 7.83 tỷ * 17% = 1.33 triệu
// - 10 tỷ còn lại * 20% = 2 tỷ
// Tổng = ~3.45 tỉ
console.log(`   ✅ Mong đợi: ~3.45 tỉ (tính theo tỷ lệ lũy tiến)\n`);

// Test case 4: Lỗ (profit <= 0)
console.log('Test 4: Doanh thu 5 tỷ, lỗ 100 triệu');
const test4 = calculateProgressiveTax(5000000000, -100000000);
console.log(`   Kết quả: ${test4.totalTax.toLocaleString()}đ`);
console.log(`   ✅ Mong đợi: 0 (không tính thuế khi lỗ)`);
console.log(`   ${test4.totalTax === 0 ? '✅ PASS' : '❌ FAIL'}\n`);

// Test case 5: getTaxRateByRevenue (cũ - chỉ trả về 1 tỉ số)
console.log('Test 5: getTaxRateByRevenue (hàm cũ)');
console.log(`   Doanh thu 2 tỷ: ${getTaxRateByRevenue(2000000000) * 100}% (mong đợi: 15%)`);
console.log(`   Doanh thu 10 tỷ: ${getTaxRateByRevenue(10000000000) * 100}% (mong đợi: 17%)`);
console.log(`   Doanh thu 60 tỷ: ${getTaxRateByRevenue(60000000000) * 100}% (mong đợi: 20%)`);

console.log('\n🎉 === HOÀN THÀNH KIỂM TRA ===');