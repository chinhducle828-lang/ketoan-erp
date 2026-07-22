/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * reversingEntriesCron - Cronjob tự động tạo bút toán hoàn nhập đầu năm
 * Chạy vào ngày 01/01 hàng năm để triệt tiêu chi phí trích trước năm trước
 */

import { pool } from '../config/db.js';
import { createReversingEntries } from '../services/reversingEntries.service.js';
import logger from '../utils/logger.js';

/**
 * Chạy hoàn nhập đầu năm cho tất cả các công ty
 * @param {number} year - Năm cần hoàn nhập (vd: 2026 → hoàn nhập bút toán năm 2025)
 */
export async function runYearlyReversingEntries(year = null) {
  if (!year) {
    const currentYear = new Date().getFullYear();
    year = currentYear;
  }
  
  logger.info({ year }, '[REVERSING ENTRIES] Bắt đầu chạy hoàn nhập đầu năm');
  
  const client = await pool.connect();
  
  try {
    // Lấy danh sách tất cả các công ty đang hoạt động
    const companiesQuery = await client.query(
      'SELECT id, name FROM companies WHERE is_active = TRUE'
    );
    
    const companies = companiesQuery.rows;
    
    if (companies.length === 0) {
      logger.warn('[REVERSING ENTRIES] Không có công ty nào để xử lý');
      return {
        success: true,
        year,
        total_companies: 0,
        results: [],
        message: 'Không có công ty nào'
      };
    }
    
    logger.info({ count: companies.length }, '[REVERSING ENTRIES] Tìm thấy công ty cần xử lý');
    
    const results = [];
    
    // Xử lý từng công ty
    for (const company of companies) {
      try {
        // Kiểm tra xem đã hoàn nhập chưa
        const checkQuery = await client.query(
          `SELECT COUNT(*) as count 
           FROM vouchers 
           WHERE company_id = $1 
           AND is_reversing = TRUE 
           AND EXTRACT(YEAR FROM voucher_date) = $2`,
          [company.id, year]
        );
        
        const alreadyReversed = parseInt(checkQuery.rows[0].count) > 0;
        
        if (alreadyReversed) {
          logger.info(
            { companyId: company.id, companyName: company.name, year },
            '[REVERSING ENTRIES] Công ty đã hoàn nhập rồi, bỏ qua'
          );
          
          results.push({
            company_id: company.id,
            company_name: company.name,
            success: true,
            skipped: true,
            message: 'Đã hoàn nhập rồi'
          });
          
          continue;
        }
        
        // Tạo bút toán hoàn nhập
        const result = await createReversingEntries(company.id, year, null);
        
        logger.info(
          { companyId: company.id, companyName: company.name, result },
          '[REVERSING ENTRIES] Hoàn nhập thành công'
        );
        
        results.push({
          company_id: company.id,
          company_name: company.name,
          success: true,
          skipped: false,
          ...result
        });
        
      } catch (error) {
        logger.error(
          { companyId: company.id, companyName: company.name, error: error.message },
          '[REVERSING ENTRIES] Lỗi khi hoàn nhập'
        );
        
        results.push({
          company_id: company.id,
          company_name: company.name,
          success: false,
          error: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success && !r.skipped).length;
    const skippedCount = results.filter(r => r.skipped).length;
    const failedCount = results.filter(r => !r.success).length;
    
    logger.info(
      { year, total: companies.length, success: successCount, skipped: skippedCount, failed: failedCount },
      '[REVERSING ENTRIES] Hoàn thành'
    );
    
    return {
      success: true,
      year,
      total_companies: companies.length,
      success_count: successCount,
      skipped_count: skippedCount,
      failed_count: failedCount,
      results
    };
    
  } catch (error) {
    logger.error({ error: error.message, year }, '[REVERSING ENTRIES] Lỗi nghiêm trọng');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Chạy thủ công (để test)
 */
export async function runReversingEntriesManually(companyId, year) {
  try {
    logger.info({ companyId, year }, '[REVERSING ENTRIES] Chạy thủ công');
    
    const result = await createReversingEntries(companyId, year, null);
    
    logger.info({ companyId, year, result }, '[REVERSING ENTRIES] Chạy thủ công thành công');
    
    return {
      success: true,
      ...result
    };
  } catch (error) {
    logger.error({ companyId, year, error: error.message }, '[REVERSING ENTRIES] Lỗi chạy thủ công');
    throw error;
  }
}

// ====================================================================
// CRON SCHEDULER - Chạy vào ngày 01/01 hàng năm lúc 00:05
// ====================================================================

let cronHandle = null;

export function startReversingEntriesCron() {
  if (cronHandle) {
    logger.warn('[REVERSING ENTRIES] Cron đã chạy rồi');
    return;
  }
  
  // Tính thời gian chạy lần đầu: ngày 01/01 năm sau lúc 00:05
  const now = new Date();
  const currentYear = now.getFullYear();
  let nextRun = new Date(`${currentYear + 1}-01-01T00:05:00`);
  
  // Nếu hôm nay đã qua 01/01 năm nay, chạy luôn (để test)
  const isTestMode = process.env.REVERSING_ENTRIES_TEST_MODE === 'true';
  
  if (isTestMode) {
    logger.warn('[REVERSING ENTRIES] Chạy ở chế độ TEST - chạy ngay lập tức');
    nextRun = new Date(now.getTime() + 60000); // Chạy sau 1 phút
  }
  
  const msUntilNextRun = nextRun.getTime() - now.getTime();
  
  logger.info(
    { nextRun: nextRun.toISOString(), msUntilNextRun },
    '[REVERSING ENTRIES] Lên lịch chạy hoàn nhập đầu năm'
  );
  
  // Chạy lần đầu sau thời gian tính toán
  setTimeout(async () => {
    try {
      await runYearlyReversingEntries(nextRun.getFullYear());
    } catch (err) {
      logger.error({ error: err.message }, '[REVERSING ENTRIES] Lỗi chạy lần đầu');
    }
  }, msUntilNextRun);
  
  // Lên lịch chạy hàng năm: mỗi 365 ngày (có thể dùng node-cron để chính xác hơn)
  // Tuy nhiên, setTimeout đơn giản hơn và đủ cho use case này
  cronHandle = setInterval(async () => {
    try {
      const currentYear = new Date().getFullYear();
      await runYearlyReversingEntries(currentYear);
    } catch (err) {
      logger.error({ error: err.message }, '[REVERSING ENTRIES] Lỗi chạy định kỳ');
    }
  }, 365 * 24 * 60 * 60 * 1000); // 365 ngày
  
  logger.info('[REVERSING ENTRIES] Cron đã được khởi động');
}

export function stopReversingEntriesCron() {
  if (cronHandle) {
    clearInterval(cronHandle);
    cronHandle = null;
    logger.info('[REVERSING ENTRIES] Cron đã dừng');
  }
}

// Chạy nếu là main module
if (import.meta.url === `file://${process.argv[1]}`) {
  const testMode = process.argv.includes('--test');
  
  if (testMode) {
    process.env.REVERSING_ENTRIES_TEST_MODE = 'true';
  }
  
  startReversingEntriesCron();
  
  // Nếu test mode, chạy ngay và thoát
  if (testMode) {
    setTimeout(() => {
      console.log('Test mode: đang chạy...');
      process.exit(0);
    }, 5000);
  }
}

export default {
  runYearlyReversingEntries,
  runReversingEntriesManually,
  startReversingEntriesCron,
  stopReversingEntriesCron
};