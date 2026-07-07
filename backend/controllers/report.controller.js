import { pool } from '../config/db.js';
import { calculateBalances } from '../utils/accountingEngine.js';
import { calculateWeightedAverageCost } from '../utils/inventoryEngine.js';
import { getBalanceSheetData, getCustomerAccountBalances, getTaxAccountBalances } from '../services/report.service.js';
import { runClosingEntries, getClosingData } from '../services/closing.service.js';
import { allocateLogisticCosts, calculateFifoCostForPeriod } from '../services/inventory.service.js';
import { invalidateCache } from '../cache/redis.js';
import { emitClosingRealtime } from '../services/voucherRealtime.service.js';
import { assertCompanyOperational } from '../services/cascadeValidation.service.js';

// Khởi tạo bộ lưu trữ Cache RAM cục bộ
const localCache = new Map();

/**
 * API Lấy bảng cân đối kế toán
 * Tích hợp: Tính giá vốn kho → Chạy kết chuyển → Query báo cáo
 */
export const getBalanceSheet = async (req, res) => {
  try {
    const companyId = req.companyId || req.query.company_id || req.query.companyId;
    const month = req.query.month ? Number(req.query.month) : null;
    const year = req.query.year ? Number(req.query.year) : null;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu tham số bắt buộc companyId!' });
    }
    
    const cacheKey = `balance-sheet:${companyId}:${month || 'all'}:${year || 'all'}`;
    
    // Kiểm tra cache
    if (localCache.has(cacheKey)) {
      return res.json({ 
        success: true, 
        source: 'cache', 
        data: localCache.get(cacheKey) 
      });
    }
    
    // Bước 1: Tính giá vốn kho nếu có tháng/năm
    if (month && year) {
      await calculateWeightedAverageCost(Number(companyId), month, year);
    }
    
    // Bước 2: Chạy kết chuyển sổ nếu có tháng/năm
    if (month && year) {
      await runClosingEntries(Number(companyId), month, year);
    }
    
    // Bước 3: Lấy dữ liệu báo cáo
    const balanceSheetData = await getBalanceSheetData(Number(companyId), month, year);
    
    // Lưu cache
    localCache.set(cacheKey, balanceSheetData);
    
    return res.json({ 
      success: true, 
      source: 'database', 
      data: balanceSheetData 
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * API Lấy số dư công nợ khách hàng (TK 131)
 */
export const getCustomerBalances = async (req, res) => {
  try {
    const companyId = req.companyId || req.query.company_id || req.query.companyId;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu tham số bắt buộc companyId!' });
    }
    
    // Lấy số dư theo từng khách hàng
    const customerBalances = await getCustomerAccountBalances(Number(companyId), '131');
    
    return res.json({ 
      success: true, 
      data: customerBalances 
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * API Lấy số dư người mua trả tiền trước (TK 312)
 */
export const getAdvanceCustomerBalances = async (req, res) => {
  try {
    const companyId = req.companyId || req.query.company_id || req.query.companyId;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu tham số bắt buộc companyId!' });
    }
    
    const advanceBalances = await getCustomerAccountBalances(Number(companyId), '312');
    
    return res.json({ 
      success: true, 
      data: advanceBalances 
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * API Lấy số dư phải trả người bán (TK 331)
 */
export const getSupplierBalances = async (req, res) => {
  try {
    const companyId = req.companyId || req.query.company_id || req.query.companyId;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu tham số bắt buộc companyId!' });
    }
    
    const supplierBalances = await getCustomerAccountBalances(Number(companyId), '331');
    
    return res.json({ 
      success: true, 
      data: supplierBalances 
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * API Lấy số dư thuế
 */
export const getTaxBalances = async (req, res) => {
  try {
    const companyId = req.companyId || req.query.company_id || req.query.companyId;
    
    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu tham số bắt buộc companyId!' });
    }
    
    const taxBalances = await getTaxAccountBalances(Number(companyId));
    
    return res.json({ 
      success: true, 
      data: taxBalances 
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * API Kích hoạt kết chuyển sổ
 * Trình tự thực thi: allocateLogisticCosts() → calculateFifoCost() → runClosingEntries()
 */
export const executeClosing = async (req, res) => {
  try {
    const companyId = req.companyId || req.body.companyId || req.body.company_id;
    const month = req.body.month || new Date().getMonth() + 1;
    const year = req.body.year || new Date().getFullYear();
    
    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu mã định danh doanh nghiệp (companyId)!' });
    }

    await assertCompanyOperational(companyId);
    
    // Bước 1: Phân bổ chi phí logistics (nạp phí vào nguyên giá)
    await allocateLogisticCosts(Number(companyId), month, year);
    
    // Bước 2: Tính giá vốn kho bằng FIFO
    await calculateFifoCostForPeriod(Number(companyId), month, year);
    
    // Bước 3: Chạy kết chuyển sổ (kết chuyển lỗ ròng cuối cùng)
    const result = await runClosingEntries(Number(companyId), month, year);
    
    // Xóa cache toàn bộ hệ thống
    const cacheKey = `balance-sheet:${companyId}:${month}:${year}`;
    localCache.delete(cacheKey);
    
    // Xóa Redis cache
    await invalidateCache(`dashboard:cashflow:${companyId}:*`);
    await invalidateCache(`balance-sheet:${companyId}:*`);

    emitClosingRealtime({
      companyId: Number(companyId),
      month,
      year,
      source: 'report.controller.executeClosing',
      result,
      clientInstanceId: req.headers['x-client-instance-id'] || null
    });
    
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Hàm hỗ trợ xóa cache
 */
export const invalidateReportCache = (companyId) => {
  const keys = Array.from(localCache.keys());
  for (const key of keys) {
    if (key.startsWith(`balance-sheet:${companyId}`)) {
      localCache.delete(key);
    }
  }
};