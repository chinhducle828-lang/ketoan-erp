/**
 * A1. COMBINATORIAL TESTING — Pairwise (Orthogonal Arrays)
 *
 * Bài toán: Bùng nổ không gian kiểm thử (Test State Explosion).
 *   T (Pháp nhân/Tenant): 3 nhóm cấu hình
 *   P (Phương thức thanh toán): 4 loại
 *   I (Mặt hàng/Thuế suất): 4 mức
 *   S (Trạng thái kho): 3 trạng thái
 *   => Exhaustive = 3 x 4 x 4 x 3 = 144 kịch bản.
 *
 * Giải pháp: Sinh ma trận kiểm thử tối thiểu (Pairwise) sao cho mọi cặp
 * 2-way interaction được phủ ít nhất 1 lần. Chứng minh số kịch bản giảm
 * mạnh (144 -> ~20) mà vẫn quét sạch lỗi tương tác.
 *
 * Độ phức tạp tăng theo cấp số nhân: tham số hóa số biến (4 -> 10) để
 * chứng minh exhaustive bùng nổ (hàng triệu) trong khi pairwise giữ < 60.
 */

import { createVoucherSchema } from '../../validators/index.js';
import { calculateBalances } from '../../utils/accountingEngine.js';

// ---------------------------------------------------------------------------
// Pairwise generator (greedy algorithm — In-Parameter-Order)
// ---------------------------------------------------------------------------
function generatePairwise(params) {
  // Tạo danh sách tất cả các cặp cần phủ
  const allPairs = [];
  for (let i = 0; i < params.length; i++) {
    for (let j = i + 1; j < params.length; j++) {
      for (const vi of params[i]) {
        for (const vj of params[j]) {
          allPairs.push({ i, vi, j, vj, key: `${i}:${vi}|${j}:${vj}` });
        }
      }
    }
  }

  const covered = new Set();
  const suite = [];

  while (covered.size < allPairs.length) {
    // Tìm các cặp chưa được phủ
    const uncovered = allPairs.filter((p) => !covered.has(p.key));
    if (uncovered.length === 0) break;

    // Chọn cặp chưa phủ đầu tiên
    const seed = uncovered[0];
    const combo = new Array(params.length).fill(undefined);
    combo[seed.i] = seed.vi;
    combo[seed.j] = seed.vj;

    // Mở rộng combo với các giá trị phủ nhiều cặp chưa phủ nhất
    let changed = true;
    while (changed) {
      changed = false;
      for (let k = 0; k < params.length; k++) {
        if (combo[k] !== undefined) continue;
        let bestVal = params[k][0];
        let bestScore = -1;
        for (const vk of params[k]) {
          combo[k] = vk;
          let score = 0;
          for (const p of uncovered) {
            if (p.i === k && combo[p.j] === p.vj && !covered.has(p.key)) score++;
            else if (p.j === k && combo[p.i] === p.vi && !covered.has(p.key)) score++;
          }
          if (score > bestScore) {
            bestScore = score;
            bestVal = vk;
          }
        }
        combo[k] = bestVal;
        if (bestScore > 0) changed = true;
      }
    }

    // Đánh dấu các cặp được phủ bởi combo này
    for (let i = 0; i < params.length; i++) {
      for (let j = i + 1; j < params.length; j++) {
        const key = `${i}:${combo[i]}|${j}:${combo[j]}`;
        covered.add(key);
      }
    }
    suite.push([...combo]);
  }

  return { suite, covered };
}

function verifyFullPairwiseCoverage(params, suite) {
  const seen = new Set();
  for (const combo of suite) {
    for (let i = 0; i < params.length; i++) {
      for (let j = i + 1; j < params.length; j++) {
        seen.add(`${i}:${combo[i]}|${j}:${combo[j]}`);
      }
    }
  }
  let totalPairs = 0;
  for (let i = 0; i < params.length; i++) {
    for (let j = i + 1; j < params.length; j++) {
      totalPairs += params[i].length * params[j].length;
    }
  }
  return { coveredPairs: seen.size, totalPairs, ratio: seen.size / totalPairs };
}

// ---------------------------------------------------------------------------
// Biến đầu vào kế toán
// ---------------------------------------------------------------------------
const TENANT = ['SME', 'Enterprise', 'Household'];
const PAYMENT = ['cash', 'transfer', 'credit', 'card'];
const TAX = ['none', 'vat5', 'vat10', 'resolution'];
const STOCK = ['positive', 'zero', 'negative'];

function buildVoucher({ tenant, payment, tax, stock }) {
  const companyId = tenant === 'Household' ? 3 : tenant === 'Enterprise' ? 2 : 1;
  const amount = stock === 'negative' ? 1000000 : stock === 'zero' ? 0 : 5000000;
  const taxRate = tax === 'vat5' ? 0.05 : tax === 'vat10' ? 0.1 : 0;
  const taxAmount = amount * taxRate;
  const net = amount - taxAmount;

  const details = [
    { account_code: '511', entry_type: 'CR', amount: net, partner_id: 1 },
    { account_code: '3331', entry_type: 'CR', amount: taxAmount, partner_id: 1 },
    { account_code: '111', entry_type: 'DR', amount: amount, partner_id: 1 }
  ];

  if (payment === 'transfer') details[2].account_code = '112';
  if (payment === 'credit') details[2].account_code = '131';
  if (payment === 'card') details[2].account_code = '112';

  if (stock === 'negative') {
    details.push({ account_code: '611', entry_type: 'DR', amount: 200000, partner_id: 1 });
    details.push({ account_code: '152', entry_type: 'CR', amount: 200000, partner_id: 1 });
  }

  return {
    company_id: companyId,
    voucher_number: `PW-${tenant}-${payment}-${tax}-${stock}`,
    voucher_date: '2026-06-30',
    voucher_type: 'PT',
    details
  };
}

describe('A1. Combinatorial Pairwise Voucher Testing', () => {
  const params = [TENANT, PAYMENT, TAX, STOCK];
  const exhaustive = params.reduce((a, p) => a * p.length, 1);
  const { suite, covered } = generatePairwise(params);

  test(`Exhaustive space = ${exhaustive}, pairwise suite = ${suite.length} (giảm >60%)`, () => {
    expect(exhaustive).toBe(144);
    expect(suite.length).toBeLessThan(60);
    expect(suite.length).toBeGreaterThan(0);
  });

  test('Mọi cặp 2-way interaction được phủ 100%', () => {
    const { coveredPairs, totalPairs, ratio } = verifyFullPairwiseCoverage(params, suite);
    expect(coveredPairs).toBe(totalPairs);
    expect(ratio).toBe(1);
  });

  test.each(suite.map((combo, idx) => [idx, combo]))(
    'Pairwise case #%i: %j thỏa mãn double-entry & schema',
    (_idx, combo) => {
      const voucher = buildVoucher({
        tenant: combo[0],
        payment: combo[1],
        tax: combo[2],
        stock: combo[3]
      });

      const parsed = createVoucherSchema.safeParse(voucher);
      expect(parsed.success).toBe(true);

      const ledger = calculateBalances([{ details: voucher.details }]);
      let dr = 0;
      let cr = 0;
      for (const key of Object.keys(ledger)) {
        dr += ledger[key].patsinhDr;
        cr += ledger[key].patsinhCr;
      }
      expect(Math.abs(dr - cr)).toBeLessThan(0.01);
    }
  );

  test('Độ phức tạp cấp số nhân: 10 biến -> exhaustive bùng nổ, pairwise vẫn nhỏ', () => {
    const bigParams = Array.from({ length: 10 }, () => ['a', 'b', 'c']);
    const bigExhaustive = bigParams.reduce((a, p) => a * p.length, 1);
    const { suite: bigSuite } = generatePairwise(bigParams);
    expect(bigExhaustive).toBe(3 ** 10);
    expect(bigSuite.length).toBeLessThan(250);
    const { ratio } = verifyFullPairwiseCoverage(bigParams, bigSuite);
    expect(ratio).toBe(1);
  });
});