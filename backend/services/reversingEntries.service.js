/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * @module ReversingEntriesService
 * @description Dịch vụ bút toán hoàn nhập đầu năm (Reversing Entries).
 * Tự động tạo bút toán ngược lại vào ngày 01/01 để triệt tiêu chi phí trích trước năm trước.
 * 
 * @FLOW:
 * 1. Ngày 31/12: Tạo bút toán trích trước chi phí (Nợ 642 / Có 335)
 * 2. Ngày 01/01 năm sau: Tự động hoàn nhập (Nợ 335 / Có 642) với số tiền âm
 * 3. Tháng 1/2: Khi có hóa đơn thực tế, hạch toán bình thường → Tự động triệt tiêu
 * 
 * @BENEFIT:
 * - Tiết kiệm thời gian kế toán
 * - Tránh hạch toán trùng chi phí 2 lần
 * - Đảm bảo tính đúng kỳ theo Thông tư 99
 */

import { pool } from '../config/db.js';
import { withLock } from './distributedLock.service.js';
import { invalidateBalance } from './balanceCache.service.js';
import { logAction, getClientIp } from './auditLog.service.js';

/**
 * Tạo bút toán hoàn nhập đầu năm
 * @param {number} companyId - ID công ty
 * @param {number} year - Năm cần hoàn nhập (vd: 2026 → hoàn nhập bút toán năm 2025)
 * @param {number} userId - ID người thực hiện
 */
export async function createReversingEntries(companyId, year, userId = null) {
  const lock = await withLock('reversing_entries', async () => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 1. Kiểm tra đã hoàn nhập chưa
      const checkQuery = await client.query(
        `SELECT id FROM vouchers 
         WHERE company_id = $1 
         AND voucher_date = $2 
         AND is_reversing = TRUE
         AND EXTRACT(YEAR FROM voucher_date) = $3`,
        [companyId, `${year}-01-01`, year]
      );
      
      if (checkQuery.rows.length > 0) {
        throw new Error(`Đã tạo bút toán hoàn nhập năm ${year} rồi`);
      }
      
      // 2. Tìm các bút toán trích trước chi phí năm trước (có TK 335)
      // Loại: 'DauKy' (số dư đầu kỳ) hoặc các chứng từ cuối năm có TK 335
      const accrualQuery = `
        SELECT v.id, v.voucher_number, v.voucher_date, v.description
        FROM vouchers v
        JOIN voucher_details vd ON v.id = vd.voucher_id
        WHERE v.company_id = $1
          AND v.is_posted = TRUE
          AND EXTRACT(YEAR FROM v.voucher_date) = $2
          AND vd.account_code LIKE '335%'
          AND vd.entry_type = 'CR'
          AND v.is_reversing = FALSE
          AND v.id NOT IN (
            SELECT COALESCE(reversed_from, 0) FROM vouchers WHERE is_reversing = TRUE
          )
        GROUP BY v.id, v.voucher_number, v.voucher_date, v.description
        ORDER BY v.voucher_date DESC
      `;
      
      const accrualVouchers = await client.query(accrualQuery, [companyId, year - 1]);
      
      if (accrualVouchers.rows.length === 0) {
        throw new Error(`Không tìm thấy bút toán trích trước chi phí năm ${year - 1}`);
      }
      
      // 3. Tạo bút toán hoàn nhập cho từng chứng từ
      const reversingVoucherIds = [];
      
      for (const accrual of accrualVouchers.rows) {
        // Lấy chi tiết bút toán gốc
        const detailsQuery = await client.query(
          'SELECT * FROM voucher_details WHERE voucher_id = $1',
          [accrual.id]
        );
        
        const details = detailsQuery.rows;
        
        // Tạo bút toán hoàn nhập
        const reversingVoucherQuery = `
          INSERT INTO vouchers (
            company_id, voucher_number, voucher_date, voucher_type, description, 
            created_by, is_posted, is_reversing, reversed_from
          )
          VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE, $7)
          RETURNING id
        `;
        
        const reversingVoucherNumber = `HN-${accrual.voucher_number}`;
        const reversingVoucherRes = await client.query(reversingVoucherQuery, [
          companyId,
          reversingVoucherNumber,
          `${year}-01-01`,
          'DauKy',
          `Hoàn nhập bút toán ${accrual.voucher_number} ngày ${accrual.voucher_date}`,
          userId,
          accrual.id
        ]);
        
        const reversingVoucherId = reversingVoucherRes.rows[0].id;
        reversingVoucherIds.push(reversingVoucherId);
        
        // Tạo chi tiết bút toán ngược lại (đảo entry_type và amount * -1)
        for (const detail of details) {
          const reversedEntryType = detail.entry_type === 'DR' ? 'CR' : 'DR';
          const reversedAmount = -parseFloat(detail.amount); // Số tiền âm
          
          await client.query(
            `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount, quantity, partner_id, item_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              reversingVoucherId,
              detail.account_code,
              reversedEntryType,
              reversedAmount,
              detail.quantity || 0,
              detail.partner_id,
              detail.item_id
            ]
          );
        }
      }
      
      await client.query('COMMIT');
      
      // 4. Ghi audit log
      await logAction({
        userId,
        action: 'CREATE',
        entityType: 'REVERSING_ENTRIES',
        newValues: {
          year,
          reversing_count: reversingVoucherIds.length,
          reversing_voucher_ids: reversingVoucherIds
        },
        ipAddress: getClientIp(null),
        companyId
      });
      
      return {
        success: true,
        year,
        reversing_count: reversingVoucherIds.length,
        reversing_voucher_ids: reversingVoucherIds,
        message: `Tạo ${reversingVoucherIds.length} bút toán hoàn nhập năm ${year} thành công`
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }, { companyId, ttl: 60000 });
  
  return lock;
}

/**
 * Lấy danh sách bút toán hoàn nhập
 */
export async function getReversingEntries(companyId, year = null) {
  let query = `
    SELECT v.*, 
           u.username as created_by_name,
           v2.voucher_number as original_voucher_number
    FROM vouchers v
    LEFT JOIN users u ON v.created_by = u.id
    LEFT JOIN vouchers v2 ON v.reversed_from = v2.id
    WHERE v.company_id = $1
      AND v.is_reversing = TRUE
  `;
  
  const params = [companyId];
  
  if (year) {
    query += ` AND EXTRACT(YEAR FROM v.voucher_date) = $2`;
    params.push(year);
  }
  
  query += ` ORDER BY v.voucher_date DESC, v.id DESC`;
  
  const result = await pool.query(query, params);
  
  return {
    success: true,
    data: result.rows,
    total: result.rows.length
  };
}

/**
 * Kiểm tra xem năm đã hoàn nhập chưa
 */
export async function checkReversingEntriesExist(companyId, year) {
  const query = `
    SELECT COUNT(*) as count
    FROM vouchers
    WHERE company_id = $1
      AND is_reversing = TRUE
      AND EXTRACT(YEAR FROM voucher_date) = $2
  `;
  
  const result = await pool.query(query, [companyId, year]);
  
  return {
    success: true,
    exists: result.rows[0].count > 0,
    count: parseInt(result.rows[0].count)
  };
}