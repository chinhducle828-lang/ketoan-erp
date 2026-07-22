/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * ioWorker.js - Worker thread cho Leontief I-O Matrix
 * Tính (I - A)^(-1) * D trong worker thread, không block Event Loop
 */

import { parentPort, workerData } from 'worker_threads';

const { A, D } = workerData;

/**
 * Tính ma trận nghịch đảo bằng Gauss-Jordan elimination
 */
function invertMatrix(matrix) {
  const n = matrix.length;

  // Tạo ma trận mở rộng [A | I]
  const aug = matrix.map((row, i) => [
    ...row,
    ...Array(n).fill(0).map((_, j) => (i === j ? 1 : 0))
  ]);

  // Gauss-Jordan elimination
  for (let col = 0; col < n; col++) {
    // Tìm pivot (hàng có giá trị tuyệt đối lớn nhất)
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
        maxRow = row;
      }
    }

    // Hoán đổi hàng
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-10) {
      throw new Error(`Ma trận suy biến: pivot tại hàng ${col + 1}, cột ${col + 1} gần bằng 0 (|${pivot.toFixed(6)}| < 1e-10). Kiểm tra ma trận hệ số A có đầy đủ rank không.`);
    }

    // Chuẩn hóa hàng pivot
    for (let j = 0; j < 2 * n; j++) {
      aug[col][j] /= pivot;
    }

    // Khử các hàng khác
    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const factor = aug[row][col];
        for (let j = 0; j < 2 * n; j++) {
          aug[row][j] -= factor * aug[col][j];
        }
      }
    }
  }

  // Trích xuất ma trận nghịch đảo (nửa bên phải)
  return aug.map(row => row.slice(n));
}

/**
 * Nhân ma trận với vector
 */
function multiplyMatrixVector(matrix, vector) {
  return matrix.map(row =>
    row.reduce((sum, val, i) => sum + val * (vector[i] || 0), 0)
  );
}

try {
  const n = A.length;

  // Tạo ma trận đơn vị I
  const I = Array(n)
    .fill(0)
    .map((_, i) => Array(n).fill(0).map((_, j) => (i === j ? 1 : 0)));

  // Tính (I - A)
  const IA = A.map((row, i) => row.map((val, j) => I[i][j] - val));

  // Tính (I - A)^(-1)
  const inv = invertMatrix(IA);

  // Tính (I - A)^(-1) * D
  const result = multiplyMatrixVector(inv, D);

  parentPort.postMessage({ success: true, data: result });
} catch (err) {
  parentPort.postMessage({ success: false, error: err.message });
}