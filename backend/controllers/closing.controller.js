import { pool } from '../config/db.js';
import { getClosingWorkflow, getTaxRateByRevenue } from '../config/closingWorkflow.js';
import { calculateWeightedAverageCost } from '../utils/inventoryEngine.js';
import { allocateLogisticCosts } from '../services/inventory.service.js';
import { 
  runClosingEntries, 
  createDepreciationEntries, 
  createAllowanceEntries, 
  createProvisionEntries,
  processTaxTNCN,
  processTaxVAT,
  getClosingData
} from '../services/closing.service.js';
import { invalidateCache } from '../cache/redis.js';

/**
 * Controller xử lý kết chuyển sổ
 */

/**
 * API Xem trước bút toán kết chuyển
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const previewClosing = async (req, res) => {
  try {
    const companyId = req.companyId || req.body.companyId || req.body.company_id;
    const month = req.body.month || new Date().getMonth() + 1;
    const year = req.body.year || new Date().getFullYear();

    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu mã định danh doanh nghiệp (companyId)!' });
    }

    // Lấy dữ liệu kết chuyển để xem trước
    const closingData = await getClosingData(companyId, month, year);
    
    // Tính toán các bút toán sẽ thực hiện
    const previewEntries = [];
    
    // 1. Kết chuyển doanh thu
    if (closingData.account511.credit > 0) {
      previewEntries.push({
        type: 'revenue_closing',
        description: 'Kết chuyển doanh thu sang TK 911',
        debit: { account: '911', amount: closingData.account511.credit },
        credit: { account: '511', amount: closingData.account511.credit }
      });
    }
    
    // 2. Kết chuyển chi phí
    let totalCost = 0;
    for (const acc of closingData.costAccounts) {
      totalCost += acc.debit;
    }
    
    if (totalCost > 0) {
      previewEntries.push({
        type: 'cost_closing',
        description: 'Kết chuyển chi phí sang TK 911',
        debit: { account: '632/641/642', amount: totalCost },
        credit: { account: '911', amount: totalCost }
      });
    }
    
    // 3. Tính thuế TNDN
    const profitBeforeTax = closingData.account511.credit - totalCost;
    if (profitBeforeTax > 0) {
      const taxRate = getTaxRateByRevenue(0); // Sử dụng mặc định nếu chưa có doanh thu năm trước
      const taxAmount = profitBeforeTax * taxRate;
      
      previewEntries.push({
        type: 'corporate_tax',
        description: `Kết chuyển thuế TNDN (${taxRate * 100}%)`,
        debit: { account: '821', amount: taxAmount },
        credit: { account: '3334', amount: taxAmount }
      });
    }
    
    return res.json({
      success: true,
      data: {
        companyId,
        month,
        year,
        previewEntries,
        summary: {
          revenue: closingData.account511.credit,
          totalCost,
          profitBeforeTax,
          taxAmount: profitBeforeTax > 0 ? profitBeforeTax * getTaxRateByRevenue(0) : 0
        }
      }
    });
  } catch (error) {
    console.error('Lỗi preview kết chuyển:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * API Thực thi kết chuyển sổ
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const executeClosing = async (req, res) => {
  try {
    const companyId = req.companyId || req.body.companyId || req.body.company_id;
    const month = req.body.month || new Date().getMonth() + 1;
    const year = req.body.year || new Date().getFullYear();

    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu mã định danh doanh nghiệp (companyId)!' });
    }

    // Thực hiện các bước kết chuyển theo workflow
    const results = [];
    
    // Bước 1: Tính giá vốn kho
    const inventoryResult = await calculateWeightedAverageCost(companyId, month, year);
    results.push({ step: 'inventory_costing', result: inventoryResult });
    
    // Bước 2: Phân bổ chi phí logistics
    const logisticResult = await allocateLogisticCosts(companyId, month, year);
    results.push({ step: 'logistic_allocation', result: logisticResult });
    
    // Bước 3: Khấu hao TSCĐ
    const depreciationResult = await createDepreciationEntries(companyId, month, year);
    results.push({ step: 'depreciation', result: depreciationResult });
    
    // Bước 4: Xử lý thuế VAT
    const vatResult = await processTaxVAT(companyId, month, year);
    results.push({ step: 'tax_vat', result: vatResult });
    
    // Bước 5: Xử lý thuế TNCN
    const tncnResult = await processTaxTNCN(companyId, month, year);
    results.push({ step: 'tax_tncn', result: tncnResult });
    
    // Bước 6: Kết chuyển sổ
    const closingResult = await runClosingEntries(companyId, month, year);
    results.push({ step: 'closing_entries', result: closingResult });
    
    // Xóa cache
    try {
      await invalidateCache(`dashboard:cashflow:${companyId}:*`);
      await invalidateCache(`balance-sheet:${companyId}:*`);
    } catch (cacheError) {
      console.error('Lỗi xóa cache:', cacheError);
    }
    
    return res.json({
      success: true,
      message: 'Kết chuyển sổ tháng ' + month + '/' + year + ' thành công',
      data: {
        companyId,
        month,
        year,
        results
      }
    });
  } catch (error) {
    console.error('Lỗi thực thi kết chuyển:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * API Lấy dữ liệu kết chuyển để xem trước
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getClosingPreviewData = async (req, res) => {
  try {
    const companyId = req.companyId || req.query.company_id || req.query.companyId || req.body.companyId || req.body.company_id;
    const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu mã định danh doanh nghiệp (companyId)!' });
    }

    // Lấy dữ liệu kết chuyển
    const closingData = await getClosingData(companyId, month, year);
    
    return res.json({
      success: true,
      data: closingData
    });
  } catch (error) {
    console.error('Lỗi lấy dữ liệu kết chuyển:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * API Lấy cấu hình workflow kết chuyển
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getWorkflowConfig = async (req, res) => {
  try {
    const workflow = getClosingWorkflow();
    
    return res.json({
      success: true,
      data: workflow
    });
  } catch (error) {
    console.error('Lỗi lấy cấu hình workflow:', error);
    return res.status(500).json({ error: error.message });
  }
};