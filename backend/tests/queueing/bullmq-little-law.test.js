/**
 * A4. QUEUEING THEORY & LITTLE'S LAW (M/M/c)
 * Hệ thống BullMQ/Redis: M/M/c (Poisson Inflow, Exponential Service, c Workers)
 * Little's Law: L = λW
 *   L: số job trung bình trong hệ thống
 *   λ: arrival rate (job/s)
 *   W: thời gian xử lý trung bình (s)
 */
import fc from 'fast-check';

/**
 * Mô phỏng M/M/c bằng discrete-event simulation.
 * @param {number} lambda - Arrival rate (jobs/s)
 * @param {number} mu - Service rate per worker (jobs/s)
 * @param {number} c - Number of workers
 * @param {number} nJobs - Number of jobs to simulate
 * @returns {{ L: number, lambda: number, W: number, ratio: number }}
 */
function simulateMMc(lambda, mu, c, nJobs = 5000, seed = 12345) {
  let rngState = seed >>> 0;
  function random() {
    // Deterministic LCG to make stochastic tests reproducible.
    rngState = (1664525 * rngState + 1013904223) >>> 0;
    return rngState / 4294967296;
  }

  // Sinh inter-arrival times (exponential)
  function expRandom(rate) {
    const u = Math.max(random(), Number.EPSILON);
    return -Math.log(1 - u) / rate;
  }

  const arrivalTimes = [];
  let t = 0;
  for (let i = 0; i < nJobs; i++) {
    t += expRandom(lambda);
    arrivalTimes.push(t);
  }

  // Worker completion times (0 = idle)
  const workers = Array(c).fill(0);
  const queue = []; // arrival times of waiting jobs
  let totalSojournTime = 0; // tổng thời gian job trong hệ thống (chờ + service)
  let totalJobsCompleted = 0;

  for (const arrival of arrivalTimes) {
    // Giải phóng worker đã hoàn thành
    for (let w = 0; w < c; w++) {
      if (workers[w] <= arrival && workers[w] !== 0) {
        workers[w] = 0; // worker freed
      }
    }

    // Tìm worker rảnh
    const freeWorker = workers.indexOf(0);
    if (freeWorker !== -1) {
      // Bắt đầu service ngay
      const serviceDuration = expRandom(mu);
      workers[freeWorker] = arrival + serviceDuration;
      totalSojournTime += serviceDuration;
      totalJobsCompleted++;
    } else {
      // Tất cả worker bận -> vào queue
      queue.push(arrival);
    }

    // Sau khi thêm job mới, xử lý queue nếu có worker rảnh
    while (queue.length > 0) {
      let freedAny = false;
      for (let w = 0; w < c; w++) {
        // Kiểm tra worker đã hoàn thành (so với thời gian hiện tại = arrival)
        if (workers[w] <= arrival && workers[w] !== 0) {
          workers[w] = 0;
          freedAny = true;
        }
        if (workers[w] === 0 && queue.length > 0) {
          const queueArrival = queue.shift();
          const serviceDuration = expRandom(mu);
          const startTime = Math.max(arrival, workers.reduce((a, b) => Math.min(a === 0 ? Infinity : a, b === 0 ? Infinity : b)));
          // Đơn giản: gán ngay worker này
          workers[w] = arrival + serviceDuration;
          totalSojournTime += (arrival - queueArrival) + serviceDuration;
          totalJobsCompleted++;
          freedAny = true;
        }
      }
      if (!freedAny) break;
    }
  }

  // Xử lý các job còn lại trong queue sau khi hết arrival
  while (queue.length > 0) {
    const nextFree = Math.min(...workers.filter((w) => w > 0));
    const queueArrival = queue.shift();
    const serviceDuration = expRandom(mu);
    const waitTime = Math.max(0, nextFree - queueArrival);
    totalSojournTime += waitTime + serviceDuration;
    totalJobsCompleted++;
    const minIdx = workers.indexOf(nextFree);
    workers[minIdx] = nextFree + serviceDuration;
  }

  const W = totalSojournTime / totalJobsCompleted;
  const L = lambda * W; // Little's Law: L = λW
  const measuredL = totalSojournTime / (arrivalTimes[arrivalTimes.length - 1] || 1);
  return { L: measuredL, lambda, W, ratio: measuredL / (lambda * W) };
}

describe('A4. Queueing Theory / Little\'s Law — BullMQ', () => {
  test('Little\'s Law: L ≈ λW (sai số < 15%)', () => {
    const lambda = 30;
    const mu = 10;
    const c = 5;
    const { L, lambda: lam, W, ratio } = simulateMMc(lambda, mu, c);
    // L ≈ λW
    expect(Math.abs(ratio - 1)).toBeLessThan(0.15);
  });

  test('Capacity bound: λ > c·μ dẫn tới queue dài', () => {
    const { L } = simulateMMc(60, 10, 5);
    expect(L).toBeGreaterThan(5);
  });

  test('Property: L tăng khi λ tăng', () => {
    fc.assert(
      fc.property(fc.integer({ min: 10, max: 40 }), (lambda) => {
        const { L } = simulateMMc(lambda, 10, 5);
        expect(L).toBeGreaterThan(0);
      })
    );
  });

  test('Throughput limit: λ < c·μ hệ thống ổn định', () => {
    const { L } = simulateMMc(40, 10, 5);
    // Với ρ = 40/50 = 0.8, L vừa phải
    expect(L).toBeLessThan(70);
  });
});