/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

/**
 * @module StockReconciliationService
 * @description Dịch vụ kiểm kê kho và xử lý chênh lệch (Stock Reconciliation).
 * Tự động sinh bút toán vào TK 138 (Tài sản khác) khi có chênh lệch.
 * 
 * @FLOW:
 * 1. Tạo phiếu kiểm kê (draft)
 * 2. Nhập số liệu thực tế
 * 3. Duyệt phiếu → Tự động sinh bút toán:
 *    - Thừa kho: Nợ 1381 / Có 156
 *    - Thiếu kho: Nợ 1381 / Có 156
 * 4. Sau khi điều tra nguyên nhân → Điều chỉnh từ 1381 sang 711 hoặc 642
 */

import { pool } from '../config/db.js';
import { withLock } from './distributedLock.service.js';
import { invalidateBalance } from './balanceCache.service.js';
import { logAction, getClientIp } from './auditLog.service.js';

const RECONCILIATION_ACCOUNT = '1381'; // Tài sản khác - chờ xử lý kiểm kê

/**
 * Tạo phiếu kiểm kê kho mới
 */
export async function createStockReconciliation(companyId, data, userId = null) {
  const { voucher_number, reconciliation_date, description, details } = data;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Tạo phiếu kiểm kê
    const masterQuery = `
      INSERT INTO stock_reconciliations (company_id, voucher_number, reconciliation_date, description, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    
    const masterRes = await client.query(masterQuery, [
      companyId,
      voucher_number,
      reconciliation_date,
      description,
      userId
    ]);
    
    const reconciliationId = masterRes.rows[0].id;
    
    // 2. Tạo chi tiết kiểm kê
    if (details && details.length > 0) {
      let totalAdjustment = 0;
      
      for (const detail of details) {
        const systemQty = parseFloat(detail.system_quantity) || 0;
        const actualQty = parseFloat(detail.actual_quantity) || 0;
        const differenceQty = actualQty - systemQty;
        const unitCost = parseFloat(detail.unit_cost) || 0;
        
        const systemValue = systemQty * unitCost;
        const actualValue = actualQty * unitCost;
        const adjustmentAmount = actualValue - systemValue;
        
        totalAdjustment += adjustmentAmount;
        
        const detailQuery = `
          INSERT INTO stock_reconciliation_details (
            stock_reconciliation_id, item_id, system_quantity, actual_quantity, difference_quantity,
            system_value, actual_value, adjustment_amount, unit_cost, account_code, reason
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `;
        
        await client.query(detailQuery, [
          reconciliationId,
          detail.item_id,
          systemQty,
          actualQty,
          differenceQty,
          systemValue,
          actualValue,
          adjustmentAmount,
          unitCost,
          detail.account_code || '156',
          detail.reason || null
        ]);
      }
      
      // 3. Cập nhật tổng điều chỉnh
      await client.query(
        'UPDATE stock_reconciliations SET total_adjustment_amount = $1 WHERE id = $2',
        [totalAdjustment, reconciliationId]
      );
    }
    
    await client.query('COMMIT');
    
    // 4. Ghi audit log
    await logAction({
      userId,
      action: 'CREATE',
      entityType: 'STOCK_RECONCILIATION',
      newValues: {
        voucher_number,
        reconciliation_date,
        description,
        total_adjustment_amount: data.details?.reduce((sum, d) => sum + (d.actual_value - d.system_value), 0) || 0
      },
      ipAddress: getClientIp(null),
      companyId
    });
    
    return {
      success: true,
      reconciliation_id: reconciliationId,
      message: 'Tạo phiếu kiểm kê kho thành công'
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Duyệt phiếu kiểm kê và sinh bút toán
 */
export async function approveStockReconciliation(companyId, reconciliationId, userId = null) {
  const lock = await withLock('stock_reconciliation', async () => {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // 1. Kiểm tra phiếu kiểm kê
      const reconQuery = await client.query(
        'SELECT * FROM stock_reconciliations WHERE id = $1 AND company_id = $2',
        [reconciliationId, companyId]
      );
      
      if (reconQuery.rows.length === 0) {
        throw new Error('Phiếu kiểm kê không tồn tại');
      }
      
      const reconciliation = reconQuery.rows[0];
      
      if (reconciliation.status !== 'draft') {
        throw new Error('Phiếu kiểm kê đã được duyệt hoặc hủy');
      }
      
      // 2. Lấy chi tiết kiểm kê
      const detailsQuery = await client.query(
        'SELECT * FROM stock_reconciliation_details WHERE stock_reconciliation_id = $1',
        [reconciliationId]
      );
      
      const details = detailsQuery.rows;
      
      if (details.length === 0) {
        throw new Error('Phiếu kiểm kê không có chi tiết');
      }
      
      // 3. Tạo chứng từ kế toán
      const voucherQuery = `
        INSERT INTO vouchers (company_id, voucher_number, voucher_date, voucher_type, description, created_by, is_posted)
        VALUES ($1, $2, $3, $4, $5, $6, TRUE)
        RETURNING id
      `;
      
      const voucherNumber = `KK-${reconciliation.voucher_number}`;
      const voucherRes = await client.query(voucherQuery, [
        companyId,
        voucherNumber,
        reconciliation.reconciliation_date,
        'KK', // Kiểm kê kho
        `Kiểm kê kho ${reconciliation.description || ''}`,
        userId
      ]);
      
      const voucherId = voucherRes.rows[0].id;
      
      // 4. Tạo bút toán cho từng dòng chênh lệch
      for (const detail of details) {
        const differenceQty = parseFloat(detail.difference_quantity) || 0;
        const adjustmentAmount = parseFloat(detail.adjustment_amount) || 0;
        
        if (adjustmentAmount === 0) continue; // Bỏ qua nếu không có chênh lệch
        
        if (differenceQty > 0) {
          // THỪA KHO: Nợ 1381 / Có 156
          await client.query(
            `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount, item_id, quantity)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [voucherId, RECONCILIATION_ACCOUNT, 'DR', adjustmentAmount, detail.item_id, differenceQty]
          );
          
          await client.query(
            `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount, item_id, quantity)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [voucherId, detail.account_code, 'CR', adjustmentAmount, detail.item_id, differenceQty]
          );
        } else if (differenceQty < 0) {
          // THIẾU KHO: Nợ 1381 / Có 156
          const absAmount = Math.abs(adjustmentAmount);
          const absQty = Math.abs(differenceQty);
          
          await client.query(
            `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount, item_id, quantity)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [voucherId, RECONCILIATION_ACCOUNT, 'DR', absAmount, detail.item_id, absQty]
          );
          
          await client.query(
            `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount, item_id, quantity)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [voucherId, detail.account_code, 'CR', absAmount, detail.item_id, absQty]
          );
        }
      }
      
      // 5. Cập nhật trạng thái phiếu kiểm kê
      await client.query(
        'UPDATE stock_reconciliations SET status = $1, approved_by = $2, approved_at = NOW() WHERE id = $3',
        ['approved', userId, reconciliationId]
      );
      
      await client.query('COMMIT');
      
      // 6. Xóa cache balance
      try {
        const year = new Date(reconciliation.reconciliation_date).getFullYear();
        const month = new Date(reconciliation.reconciliation_date).getMonth() + 1;
        await invalidateBalance(companyId, year, month);
      } catch (cacheError) {
        console.error('Lỗi xóa cache sau kiểm kê:', cacheError);
      }
      
      return {
        success: true,
        voucher_id: voucherId,
        message: 'Duyệt phiếu kiểm kê và tạo bút toán thành công'
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
 * Hủy phiếu kiểm kê
 */
export async function cancelStockReconciliation(companyId, reconciliationId, userId = null) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Kiểm tra phiếu
    const reconQuery = await client.query(
      'SELECT * FROM stock_reconciliations WHERE id = $1 AND company_id = $2',
      [reconciliationId, companyId]
    );
    
    if (reconQuery.rows.length === 0) {
      throw new Error('Phiếu kiểm kê không tồn tại');
    }
    
    const reconciliation = reconQuery.rows[0];
    
    if (reconciliation.status !== 'draft') {
      throw new Error('Chỉ có thể hủy phiếu ở trạng thái nháp');
    }
    
    // 2. Cập nhật trạng thái
    await client.query(
      'UPDATE stock_reconciliations SET status = $1 WHERE id = $2',
      ['cancelled', reconciliationId]
    );
    
    await client.query('COMMIT');
    
    return {
      success: true,
      message: 'Hủy phiếu kiểm kê thành công'
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Điều chỉnh từ TK 1381 sang TK 711 (thu nhập khác) hoặc 642 (chi phí)
 * Sau khi điều tra nguyên nhân chênh lệch
 */
export async function adjustReconciliationAccount(companyId, reconciliationId, targetAccount, reason, userId = null) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Kiểm tra phiếu đã duyệt chưa
    const reconQuery = await client.query(
      'SELECT * FROM stock_reconciliations WHERE id = $1 AND company_id = $2 AND status = $3',
      [reconciliationId, companyId, 'approved']
    );
    
    if (reconQuery.rows.length === 0) {
      throw new Error('Phiếu kiểm kê không tồn tại hoặc chưa được duyệt');
    }
    
    const reconciliation = reconQuery.rows[0];
    
    // 2. Tìm chứng từ KK đã tạo
    const voucherQuery = await client.query(
      "SELECT id FROM vouchers WHERE voucher_number = $1 AND company_id = $2",
      [`KK-${reconciliation.voucher_number}`, companyId]
    );
    
    if (voucherQuery.rows.length === 0) {
      throw new Error('Chứng từ kiểm kê không tồn tại');
    }
    
    const voucherId = voucherQuery.rows[0].id;
    
    // 3. Lấy chi tiết bút toán
    const detailsQuery = await client.query(
      'SELECT * FROM voucher_details WHERE voucher_id = $1 AND account_code = $2',
      [voucherId, RECONCILIATION_ACCOUNT]
    );
    
    const details = detailsQuery.rows;
    
    if (details.length === 0) {
      throw new Error('Không tìm thấy bút toán TK 1381');
    }
    
    // 4. Tạo bút toán điều chỉnh
    const totalAmount = details.reduce((sum, d) => sum + parseFloat(d.amount), 0);
    
    const adjustmentVoucherNumber = `DK-${reconciliation.voucher_number}`;
    const adjustmentQuery = `
      INSERT INTO vouchers (company_id, voucher_number, voucher_date, voucher_type, description, created_by, is_posted)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      RETURNING id
    `;
    
    const adjustmentRes = await client.query(adjustmentQuery, [
      companyId,
      adjustmentVoucherNumber,
      new Date().toISOString().split('T')[0],
      'DK', // Điều chỉnh
      `Điều chỉnh chênh lệch kiểm kê: ${reason || ''}`,
      userId
    ]);
    
    const adjustmentVoucherId = adjustmentRes.rows[0].id;
    
    // 5. Tạo bút toán: Nợ 711/642 / Có 1381
    await client.query(
      `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount)
       VALUES ($1, $2, $3, $4)`,
      [adjustmentVoucherId, targetAccount, 'DR', totalAmount]
    );
    
    await client.query(
      `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount)
       VALUES ($1, $2, $3, $4)`,
      [adjustmentVoucherId, RECONCILIATION_ACCOUNT, 'CR', totalAmount]
    );
    
    await client.query('COMMIT');
    
    return {
      success: true,
      voucher_id: adjustmentVoucherId,
      message: `Điều chỉnh chênh lệch sang TK ${targetAccount} thành công`
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Lấy danh sách phiếu kiểm kê
 */
export async function getStockReconciliations(companyId, filters = {}) {
  const { status, from_date, to_date, page = 1, limit = 50 } = filters;
  
  let query = `
    SELECT sr.*, 
           u.username as created_by_name,
           u2.username as approved_by_name,
           COUNT(srd.id) as detail_count
    FROM stock_reconciliations sr
    LEFT JOIN users u ON sr.created_by = u.id
    LEFT JOIN users u2 ON sr.approved_by = u2.id
    LEFT JOIN stock_reconciliation_details srd ON srd.stock_reconciliation_id = sr.id
    WHERE sr.company_id = $1
  `;
  
  const params = [companyId];
  let paramIdx = 2;
  
  if (status) {
    query += ` AND sr.status = $${paramIdx}`;
    params.push(status);
    paramIdx++;
  }
  
  if (from_date) {
    query += ` AND sr.reconciliation_date >= $${paramIdx}`;
    params.push(from_date);
    paramIdx++;
  }
  
  if (to_date) {
    query += ` AND sr.reconciliation_date <= $${paramIdx}`;
    params.push(to_date);
    paramIdx++;
  }
  
  query += ` GROUP BY sr.id, u.username, u2.username`;
  query += ` ORDER BY sr.reconciliation_date DESC`;
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
 * Lấy chi tiết phiếu kiểm kê
 */
export async function getStockReconciliationDetails(reconciliationId) {
  const query = `
    SELECT srd.*, i.code as item_code, i.name as item_name
    FROM stock_reconciliation_details srd
    LEFT JOIN items i ON srd.item_id = i.id
    WHERE srd.stock_reconciliation_id = $1
    ORDER BY srd.id
  `;
  
  const result = await pool.query(query, [reconciliationId]);
  
  return {
    success: true,
    data: result.rows
  };
}