/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * ioMatrix.js - Leontief Input-Output Matrix Forecasting Engine
 * Tính (I - A)^(-1) * D trong Worker Thread để không block Event Loop
 */

import { Worker } from 'worker_threads';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';

import { getConfigNumber, getConfigString, getConfig } from '../utils/configHelper.js';


const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Dự báo tác động chuỗi cung ứng bằng mô hình I-O Leontief
 * @param {Array<Array<number>>} coefficientMatrix - Ma trận hệ số A (n x n)
 * @param {Array<number>} demandVector - Vector nhu cầu D (n)
 * @returns {Promise<Array<number>>} Vector đầu ra X
 */
export async function forecastLeontief(coefficientMatrix, demandVector) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, '../workers/ioWorker.js'), {
      workerData: { A: coefficientMatrix, D: demandVector }
    });

    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('I-O Matrix calculation timeout after 30s'));
    }, 30000);

    worker.on('message', (result) => {
      clearTimeout(timeout);
      if (result.success) {
        resolve(result.data);
      } else {
        reject(new Error(result.error || 'I-O Matrix calculation failed'));
      }
      worker.terminate();
    });

    worker.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
      worker.terminate();
    });

    worker.on('exit', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

/**
 * Xây dựng ma trận I-O từ database và tính forecast
 * @param {number} targetCompanyId - Công ty mục tiêu cần dự báo
 * @param {number} growthRate - Tỷ lệ tăng trưởng dự kiến (VD: 0.2 = 20%)
 * @returns {Promise<Array>} Kết quả dự báo cho từng công ty
 */
export async function buildAndForecast(targetCompanyId, growthRate) {
  // 1. Lấy ma trận hệ số I-O từ DB
  const { rows } = await pool.query(`
    SELECT from_company_id, to_company_id, coefficient
    FROM io_coefficients
    WHERE (valid_to IS NULL OR valid_to >= CURRENT_DATE)
  `);

  if (rows.length === 0) {
    throw new Error('Chưa có dữ liệu ma trận I-O. Vui lòng nhập hệ số đầu vào/đầu ra.');
  }

  // 2. Xây dựng ma trận A và vector D
  const companyIds = [...new Set(rows.flatMap(r => [r.from_company_id, r.to_company_id]))];
  const n = companyIds.length;
  const companyIndexMap = {};
  companyIds.forEach((id, idx) => { companyIndexMap[id] = idx; });

  const A = Array(n).fill(0).map(() => Array(n).fill(0));
  const D = Array(n).fill(0);

  rows.forEach(r => {
    const i = companyIndexMap[r.from_company_id];
    const j = companyIndexMap[r.to_company_id];
    if (i !== undefined && j !== undefined) {
      A[i][j] = parseFloat(r.coefficient) || 0;
    }
  });

  // 3. Demand vector: target company tăng trưởng theo growthRate
  const targetIdx = companyIndexMap[Number(targetCompanyId)];
  if (targetIdx === undefined) {
    throw new Error(`Không tìm thấy công ty ID ${targetCompanyId} trong ma trận I-O`);
  }
  D[targetIdx] = growthRate;

  // 4. Tính forecast trong worker thread
  const result = await forecastLeontief(A, D);

  // 5. Map kết quả về tên công ty
  const forecast = result.map((val, i) => ({
    companyId: companyIds[i],
    requiredGrowth: Math.round(val * 10000) / 10000 // 4 chữ số thập phân
  }));

  return forecast;
}