/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * @module DebtReconciliationService
 * @description Dịch vụ cấn trừ công nợ (Debt Reconciliation).
 * Hỗ trợ 2 loại:
 * 1. Offsetting: Cấn trừ giữa phải thu và phải trả cùng 1 đối tác
 * 2. Intercompany: Cấn trừ công nợ nội bộ giữa các công ty trong tập đoàn
 * 
 * @FLOW:
 * 1. Tạo biên bản đối trừ (draft)
 * 2. Duyệt → Tự động sinh bút toán:
 *    - Nợ TK 331 (Phải trả) / Có TK 131 (Phải thu)
 * 3. Cập nhật số dư công nợ
 */

import { pool } from '../config/db.js';
import { withLock } from './distributedLock.service.js';
import { invalidateBalance } from './balanceCache.service.js';
import { logAction, getClientIp } from './auditLog.service.js';

/**
 * Tạo biên bản cấn trừ công nợ
 */
export async function createDebtReconciliation(companyId, data, userId = null) {
  const { voucher_number, reconciliation_date, type, description, details } = data;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Tạo biên bản cấn trừ
    const masterQuery = `
      INSERT INTO debt_reconciliations (company_id, voucher_number, reconciliation_date, type, description, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    
    const masterRes = await client.query(masterQuery, [
      companyId,
      voucher_number,
      reconciliation_date,
      type || 'offsetting',
      description,
      userId
    ]);
    
    const reconciliationId = masterRes.rows[0].id;
    
    // 2. Tạo chi tiết cấn trừ
    if (details && details.length > 0) {
      let totalOffset = 0;
      
      for (const detail of details) {
        const receivable = parseFloat(detail.receivable_amount) || 0;
        const payable = parseFloat(detail.payable_amount) || 0;
        const offsetAmount = Math.min(receivable, payable);
        const remainingReceivable = receivable - offsetAmount;
        const remainingPayable = payable - offsetAmount;
        
        totalOffset += offsetAmount;
        
        const detailQuery = `
          INSERT INTO debt_reconciliation_details (
            debt_reconciliation_id, partner_id, company_id,
            receivable_amount, payable_amount, offset_amount,
            remaining_receivable, remaining_payable, notes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
        
        await client.query(detailQuery, [
          reconciliationId,
          detail.partner_id || null,
          detail.company_id || null,
          receivable,
          payable,
          offsetAmount,
          remainingReceivable,
          remainingPayable,
          detail.notes || null
        ]);
      }
      
      // 3. Cập nhật tổng cấn trừ
      await client.query(
        'UPDATE debt_reconciliations SET total_offset_amount = $1 WHERE id = $2',
        [totalOffset, reconciliationId]
      );
    }
    
    await client.query('COMMIT');
    
    // 4. Ghi audit log
    await logAction({
      userId,
      action: 'CREATE',
      entityType: 'DEBT_RECONCILIATION',
      newValues: {
        voucher_number,
        reconciliation_date,
        type,
        description,
        total_offset_amount: details?.reduce((sum, d) => sum + Math.min(d.receivable_amount, d.payable_amount), 0) || 0
      },
      ipAddress: getClientIp(null),
      companyId
    });
    
    return {
      success: true,
      reconciliation_id: reconciliationId,
      message: 'Tạo biên bản cấn trừ công nợ thành công'
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Duyệt biên bản cấn trừ và sinh bút toán
 */
export async function approveDebtReconciliation(companyId, reconciliationId, userId = null) {
  const lock = await withLock('debt_reconciliation', async () => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 1. Kiểm tra biên bản
      const reconQuery = await client.query(
        'SELECT * FROM debt_reconciliations WHERE id = $1 AND company_id = $2',
        [reconciliationId, companyId]
      );
      
      if (reconQuery.rows.length === 0) {
        throw new Error('Biên bản cấn trừ không tồn tại');
      }
      
      const reconciliation = reconQuery.rows[0];
      
      if (reconciliation.status !== 'draft') {
        throw new Error('Biên bản đã được duyệt hoặc hủy');
      }
      
      // 2. Lấy chi tiết cấn trừ
      const detailsQuery = await client.query(
        'SELECT * FROM debt_reconciliation_details WHERE debt_reconciliation_id = $1',
        [reconciliationId]
      );
      
      const details = detailsQuery.rows;
      
      if (details.length === 0) {
        throw new Error('Biên bản không có chi tiết');
      }
      
      // 3. Tạo chứng từ kế toán
      const voucherQuery = `
        INSERT INTO vouchers (company_id, voucher_number, voucher_date, voucher_type, description, created_by, is_posted)
        VALUES ($1, $2, $3, $4, $5, $6, TRUE)
        RETURNING id
      `;
      
      const voucherNumber = `CT-${reconciliation.voucher_number}`;
      const voucherRes = await client.query(voucherQuery, [
        companyId,
        voucherNumber,
        reconciliation.reconciliation_date,
        'CT', // Cấn trừ
        `Cấn trừ công nợ ${reconciliation.description || ''}`,
        userId
      ]);
      
      const voucherId = voucherRes.rows[0].id;
      
      // 4. Tạo bút toán cho từng dòng cấn trừ
      for (const detail of details) {
        const offsetAmount = parseFloat(detail.offset_amount) || 0;
        
        if (offsetAmount === 0) continue; // Bỏ qua nếu không có cấn trừ
        
        if (reconciliation.type === 'offsetting') {
          // CẤN TRỪ MUA - BÁN: Nợ 331 / Có 131
          await client.query(
            `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount, partner_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [voucherId, '331', 'DR', offsetAmount, detail.partner_id]
          );
          
          await client.query(
            `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount, partner_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [voucherId, '131', 'CR', offsetAmount, detail.partner_id]
          );
        } else if (reconciliation.type === 'intercompany') {
          // CẤN TRỪ NỘI BỘ: Nợ 331 / Có 131
          // Lưu ý: Trong thực tế, cần xác định rõ công ty nào là bên nợ, bên có
          // Ở đây giả định: company_id là bên phải trả, partner company_id là bên phải thu
          await client.query(
            `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount, partner_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [voucherId, '331', 'DR', offsetAmount, detail.company_id]
          );
          
          await client.query(
            `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount, partner_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [voucherId, '131', 'CR', offsetAmount, detail.company_id]
          );
        }
      }
      
      // 5. Cập nhật trạng thái
      await client.query(
        'UPDATE debt_reconciliations SET status = $1, approved_by = $2, approved_at = NOW() WHERE id = $3',
        ['approved', userId, reconciliationId]
      );
      
      await client.query('COMMIT');
      
      // 6. Xóa cache balance
      try {
        const year = new Date(reconciliation.reconciliation_date).getFullYear();
        const month = new Date(reconciliation.reconciliation_date).getMonth() + 1;
        await invalidateBalance(companyId, year, month);
      } catch (cacheError) {
        console.error('Lỗi xóa cache sau cấn trừ công nợ:', cacheError);
      }
      
      return {
        success: true,
        voucher_id: voucherId,
        message: 'Duyệt biên bản cấn trừ và tạo bút toán thành công'
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
 * Hủy biên bản cấn trừ
 */
export async function cancelDebtReconciliation(companyId, reconciliationId, userId = null) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Kiểm tra biên bản
    const reconQuery = await client.query(
      'SELECT * FROM debt_reconciliations WHERE id = $1 AND company_id = $2',
      [reconciliationId, companyId]
    );
    
    if (reconQuery.rows.length === 0) {
      throw new Error('Biên bản cấn trừ không tồn tại');
    }
    
    const reconciliation = reconQuery.rows[0];
    
    if (reconciliation.status !== 'draft') {
      throw new Error('Chỉ có thể hủy biên bản ở trạng thái nháp');
    }
    
    // 2. Cập nhật trạng thái
    await client.query(
      'UPDATE debt_reconciliations SET status = $1 WHERE id = $2',
      ['cancelled', reconciliationId]
    );
    
    await client.query('COMMIT');
    
    return {
      success: true,
      message: 'Hủy biên bản cấn trừ thành công'
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Lấy danh sách biên bản cấn trừ
 */
export async function getDebtReconciliations(companyId, filters = {}) {
  const { type, status, from_date, to_date, page = 1, limit = 50 } = filters;
  
  let query = `
    SELECT dr.*, 
           u.username as created_by_name,
           u2.username as approved_by_name,
           COUNT(drd.id) as detail_count
    FROM debt_reconciliations dr
    LEFT JOIN users u ON dr.created_by = u.id
    LEFT JOIN users u2 ON dr.approved_by = u2.id
    LEFT JOIN debt_reconciliation_details drd ON drd.debt_reconciliation_id = dr.id
    WHERE dr.company_id = $1
  `;
  
  const params = [companyId];
  let paramIdx = 2;
  
  if (type) {
    query += ` AND dr.type = $${paramIdx}`;
    params.push(type);
    paramIdx++;
  }
  
  if (status) {
    query += ` AND dr.status = $${paramIdx}`;
    params.push(status);
    paramIdx++;
  }
  
  if (from_date) {
    query += ` AND dr.reconciliation_date >= $${paramIdx}`;
    params.push(from_date);
    paramIdx++;
  }
  
  if (to_date) {
    query += ` AND dr.reconciliation_date <= $${paramIdx}`;
    params.push(to_date);
    paramIdx++;
  }
  
  query += ` GROUP BY dr.id, u.username, u2.username`;
  query += ` ORDER BY dr.reconciliation_date DESC`;
  query += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
  params.push(limit, (page - 1) * limit);
  
  const result = await pool.query(query, params);
  
  return {
    success: true,
    data: result.rows,
    total: result.rows.length
  };
}

/**
 * Lấy chi tiết biên bản cấn trừ
 */
export async function getDebtReconciliationDetails(reconciliationId) {
  const query = `
    SELECT drd.*, 
           p.partner_code,
           p.partner_name,
           c.name as company_name
    FROM debt_reconciliation_details drd
    LEFT JOIN partners p ON drd.partner_id = p.id
    LEFT JOIN companies c ON drd.company_id = c.id
    WHERE drd.debt_reconciliation_id = $1
    ORDER BY drd.id
  `;
  
  const result = await pool.query(query, [reconciliationId]);
  
  return {
    success: true,
    data: result.rows
  };
}