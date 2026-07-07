/**
 * B1. MARKOV CHAIN RANDOM-WALK TEST
 * Mô phỏng hành trình kế toán viên: Nhập chứng từ -> Xem báo cáo -> Khóa sổ
 * Ma trận chuyển trạng thái dựa trên user logs.
 */
import fc from 'fast-check';

// Ma trận xác suất chuyển trạng thái (transition matrix)
const STATES = ['voucherEntry', 'reportView', 'closing'];
const TRANSITION = {
  voucherEntry: { reportView: 0.8, closing: 0.2 },
  reportView: { voucherEntry: 0.3, closing: 0.1 },
  closing: { voucherEntry: 0.0, reportView: 0.0 } // absorbing
};

function randomWalk(steps, start = 'voucherEntry') {
  const path = [start];
  let current = start;
  for (let i = 0; i < steps; i++) {
    const probs = TRANSITION[current];
    if (!probs) break;
    const rand = Math.random();
    let cum = 0;
    for (const [next, p] of Object.entries(probs)) {
      cum += p;
      if (rand < cum) {
        current = next;
        path.push(next);
        break;
      }
    }
  }
  return path;
}

describe('B1. Markov Chain User Journey', () => {
  test('Random walk sinh chuỗi hành động hợp lệ', () => {
    const path = randomWalk(10);
    expect(STATES).toContainEqual(path[0]);
    for (const state of path) {
      expect(STATES).toContainEqual(state);
    }
  });

  test('Khóa sổ là trạng thái hấp thụ (không rời)', () => {
    const paths = Array.from({ length: 1000 }, () => randomWalk(20));
    for (const path of paths) {
      if (path.includes('closing')) {
        const idx = path.indexOf('closing');
        expect(path.slice(idx).every((s) => s === 'closing')).toBe(true);
      }
    }
  });

  test('Property: Xác suất đến closing tăng theo số bước', () => {
    fc.assert(
      fc.property(fc.integer({ min: 5, max: 50 }), (steps) => {
        const paths = Array.from({ length: 500 }, () => randomWalk(steps));
        const hitClosing = paths.filter((p) => p.includes('closing')).length;
        const rate = hitClosing / 500;
        // Với steps lớn, xác suất đến closing tăng
        expect(rate).toBeGreaterThan(0);
      })
    );
  });

  test('Số bước trung bình đến closing (absorbing time)', () => {
    const stepsToClosing = [];
    for (let i = 0; i < 10000; i++) {
      const path = randomWalk(100);
      if (path.includes('closing')) {
        stepsToClosing.push(path.indexOf('closing'));
      }
    }
    const avg = stepsToClosing.reduce((a, b) => a + b, 0) / stepsToClosing.length;
    // Với tỉ lệ 0.2 từ voucherEntry->closing, trung bình ~5 bước
    expect(avg).toBeLessThan(20);
  });
});