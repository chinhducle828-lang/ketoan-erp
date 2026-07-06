import { pool } from '../config/db.js';
import { getInventoryRules } from '../config/businessRules.js';
import { withLock } from './distributedLock.service.js';
import { invalidateBalance } from './balanceCache.service.js';

const getInventoryRuleContext = () => {
  const rules = getInventoryRules();
  const accounts = rules.accounts || {};
  const inventoryAccount = String(accounts.inventory || '156');
  const logisticsAccount = String(accounts.logistics || '1562');
  const logisticsCostAccounts = Array.isArray(accounts.logisticsCost) && accounts.logisticsCost.length > 0
    ? accounts.logisticsCost.map((account) => String(account || '').trim()).filter(Boolean)
    : ['632', '641', '642'];

  return {
    inboundVoucherType: String(rules.inboundVoucherType || 'NK'),
    outboundVoucherType: String(rules.outboundVoucherType || 'XK'),
    allocationVoucherType: String(rules.allocationVoucherType || 'DauKy'),
    inventoryAccount,
    logisticsAccount,
    logisticsCostAccounts,
    allocationCreditAccount: String(accounts.allocationCredit || logisticsCostAccounts[0] || '632')
  };
};

const isInboundMovement = (row, inboundVoucherType) => row.voucher_type === inboundVoucherType || (row.entry_type === 'DR' && Number(row.quantity || 0) > 0);
const isOutboundMovement = (row, outboundVoucherType) => row.voucher_type === outboundVoucherType || (row.entry_type === 'CR' && Number(row.quantity || 0) > 0);

/**
 * QUẢN LÝ KHO & TÍNH GIÁ VỐN - ERP KẾ TOÁN
 * LỖI 5: Tính giá xuất kho
 */

/**
 * Tính giá vốn xuất kho bằng phương pháp FIFO
 * Hỗ trợ tính toán cho tồn kho âm (negative inventory)
 * @param {number} companyId - ID công ty
 * @param {number} itemId - ID vật tư
 * @param {string} targetDate - Ngày tính giá (định dạng YYYY-MM-DD)
 */
export async function calculateFifoCost(companyId, itemId, targetDate) {
  const ruleContext = getInventoryRuleContext();
  // Lấy tất cả phiếu nhập/xuất của vật tư sắp xếp theo thời gian
  const query = `
    SELECT vd.entry_type, vd.quantity, vd.amount, v.voucher_date, v.voucher_type
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND v.is_posted = TRUE
      AND vd.item_id = $2 
      AND v.voucher_date <= $3
    ORDER BY v.voucher_date ASC, v.id ASC
  `;
  
  const { rows } = await pool.query(query, [companyId, itemId, targetDate]);
  
  // Tính giá vốn tồn kho theo FIFO
  const inventoryLots = [];
  let totalQty = 0;
  let totalCostValue = 0;
  let negativeInventoryQty = 0; // Theo dõi số lượng tồn âm
  let negativeInventoryCost = 0; // Theo dõi chi phí cho tồn âm
  
  for (const row of rows) {
    const qty = parseFloat(row.quantity) || 0;
    const val = parseFloat(row.amount) || 0;
    
    if (isInboundMovement(row, ruleContext.inboundVoucherType)) {
      // Nhập kho - tạo lô mới
      // Nếu đang có tồn âm, ưu tiên bù trừ trước
      if (negativeInventoryQty > 0) {
        const deductQty = Math.min(qty, negativeInventoryQty);
        negativeInventoryQty -= deductQty;
        negativeInventoryCost -= deductQty * (val / qty);
        
        // Nếu còn lại, tạo lô mới
        const remainingQty = qty - deductQty;
        if (remainingQty > 0) {
          inventoryLots.push({
            date: row.voucher_date,
            quantity: remainingQty,
            unit_cost: val / qty,
            remaining_qty: remainingQty,
            total_value: (val / qty) * remainingQty
          });
          totalQty += remainingQty;
          totalCostValue += (val / qty) * remainingQty;
        }
      } else {
        inventoryLots.push({
          date: row.voucher_date,
          quantity: qty,
          unit_cost: val / qty,
          remaining_qty: qty,
          total_value: val
        });
        totalQty += qty;
        totalCostValue += val;
      }
    } else if (isOutboundMovement(row, ruleContext.outboundVoucherType)) {
      // Xuất kho - trừ dần từ các lô cũ nhất
      let qtyToDeduct = qty;
      let costValueToDeduct = 0;
      
      for (const lot of inventoryLots) {
        if (qtyToDeduct <= 0) break;
        
        if (lot.remaining_qty > 0) {
          const deductQty = Math.min(lot.remaining_qty, qtyToDeduct);
          costValueToDeduct += deductQty * lot.unit_cost;
          lot.remaining_qty -= deductQty;
          qtyToDeduct -= deductQty;
        }
      }
      
      // Xử lý tồn kho âm: nếu xuất nhiều hơn tồn kho
      if (qtyToDeduct > 0) {
        // Tồn âm: dùng giá trị cuối cùng của lot cuối cùng hoặc giá vốn 0
        const lastLotUnitCost = inventoryLots.length > 0 
          ? inventoryLots[inventoryLots.length - 1].unit_cost 
          : 0;
        
        // Ghi nhận tồn âm
        negativeInventoryQty += qtyToDeduct;
        negativeInventoryCost += qtyToDeduct * lastLotUnitCost;
        costValueToDeduct += qtyToDeduct * lastLotUnitCost;
      }
      
      totalQty -= qty;
      totalCostValue -= costValueToDeduct;
    }
  }
  
  return {
    current_quantity: totalQty,
    total_inventory_value: totalCostValue,
    average_unit_cost: totalQty > 0 ? totalCostValue / totalQty : 0,
    lots: inventoryLots,
    // Thông tin tồn kho âm
    negative_inventory: {
      quantity: negativeInventoryQty,
      cost_value: negativeInventoryCost,
      is_negative: negativeInventoryQty > 0
    }
  };
}

/**
 * Tính giá vốn bình quân gia quyền
 * @param {number} companyId - ID công ty
 * @param {number} month - Tháng
 * @param {number} year - Năm
 */
export async function calculateWeightedAverageCostForPeriod(companyId, month, year) {
  const ruleContext = getInventoryRuleContext();
  // Xây dựng điều kiện WHERE cho tháng/năm
  let whereClause = 'WHERE v.company_id = $1';
  const params = [companyId];
  let paramIndex = 2;
  
  if (month) {
    whereClause += ` AND EXTRACT(MONTH FROM v.voucher_date) = $${paramIndex}`;
    params.push(month);
    paramIndex++;
  }
  
  if (year) {
    whereClause += ` AND EXTRACT(YEAR FROM v.voucher_date) = $${paramIndex}`;
    params.push(year);
    paramIndex++;
  }
  
  // Lấy tất cả chứng từ nhập/xuất kho
  const query = `
    SELECT v.id as voucher_id, v.voucher_date, v.voucher_type,
           vd.id as detail_id, vd.item_id, vd.quantity, vd.amount, vd.account_code, vd.entry_type
    FROM vouchers v
    JOIN voucher_details vd ON v.id = vd.voucher_id
    ${whereClause}
    ORDER BY v.voucher_date ASC, v.id ASC, vd.id ASC
  `;
  
  const { rows } = await pool.query(query, params);
  
  // Tính giá bình quân cho từng vật tư
  const itemCosts = {};
  
  for (const row of rows) {
    const itemId = row.item_id;
    const quantity = parseFloat(row.quantity) || 0;
    const amount = parseFloat(row.amount) || 0;
    
    if (!itemCosts[itemId]) {
      itemCosts[itemId] = {
        totalQty: 0,
        totalCostValue: 0,
        averagePrice: 0
      };
    }
    
    if (isInboundMovement(row, ruleContext.inboundVoucherType)) {
      // Nhập kho - cập nhật giá trung bình
      itemCosts[itemId].totalQty += quantity;
      itemCosts[itemId].totalCostValue += amount;
      if (itemCosts[itemId].totalQty > 0) {
        itemCosts[itemId].averagePrice = itemCosts[itemId].totalCostValue / itemCosts[itemId].totalQty;
      }
    } else if (isOutboundMovement(row, ruleContext.outboundVoucherType)) {
      // Xuất kho - cập nhật giá trị dựa trên giá bình quân
      const calculatedValue = quantity * itemCosts[itemId].averagePrice;
      itemCosts[itemId].totalQty -= quantity;
      itemCosts[itemId].totalCostValue -= calculatedValue;
      
      // Cập nhật lại amount cho chi tiết xuất kho
      await pool.query(
        'UPDATE voucher_details SET amount = $1 WHERE id = $2',
        [calculatedValue, row.detail_id]
      );
    }
  }
  
  return {
    success: true,
    message: `Đã tính toán giá vốn cho ${Object.keys(itemCosts).length} vật tư`,
    itemCosts
  };
}

/**
 * Tính giá vốn xuất kho bằng phương pháp FIFO cho kỳ
 * @param {number} companyId - ID công ty
 * @param {number} month - Tháng
 * @param {number} year - Năm
 */
export async function calculateFifoCostForPeriod(companyId, month, year) {
  // Sử dụng distributed lock để tránh race condition
  const lock = await withLock('fifo_calculation', async () => {
    const client = await pool.connect();
    const ruleContext = getInventoryRuleContext();
    
    try {
      await client.query('BEGIN');
      
      // [PESSIMISTIC LOCK] Khóa monthly_balances để tránh race condition
      await client.query(
        'SELECT id FROM monthly_balances WHERE company_id = $1 AND year = $2 AND month = $3 FOR UPDATE',
        [companyId, year, month]
      );
      
      // Xây dựng điều kiện WHERE cho tháng/năm
      let whereClause = 'WHERE v.company_id = $1';
      const params = [companyId];
      let paramIndex = 2;
      
      if (month) {
        whereClause += ` AND EXTRACT(MONTH FROM v.voucher_date) = $${paramIndex}`;
        params.push(month);
        paramIndex++;
      }
      
      if (year) {
        whereClause += ` AND EXTRACT(YEAR FROM v.voucher_date) = $${paramIndex}`;
        params.push(year);
        paramIndex++;
      }
      
      // Lấy tất cả chứng từ nhập/xuất kho kèm thông tin vật tư
      const query = `
        SELECT v.id as voucher_id, v.voucher_date, v.voucher_type,
               vd.id as detail_id, vd.item_id, vd.quantity, vd.amount, vd.account_code, vd.entry_type
        FROM vouchers v
        JOIN voucher_details vd ON v.id = vd.voucher_id
        ${whereClause}
        ORDER BY v.voucher_date ASC, v.id ASC, vd.id ASC
      `;
      
      const { rows } = await client.query(query, params);
      
      // Tính giá vốn FIFO cho từng vật tư
      const itemCosts = {};
      
      for (const row of rows) {
        const itemId = row.item_id;
        const quantity = parseFloat(row.quantity) || 0;
        const amount = parseFloat(row.amount) || 0;
        
        if (!itemCosts[itemId]) {
          itemCosts[itemId] = {
            totalQty: 0,
            totalCostValue: 0,
            lots: [] // FIFO lots
          };
        }
        
        if (isInboundMovement(row, ruleContext.inboundVoucherType)) {
          // Nhập kho - tạo lô mới theo FIFO
          // Nếu đang có tồn âm, ưu tiên bù trừ trước
          if (itemCosts[itemId].negativeQty > 0) {
            const deductQty = Math.min(quantity, itemCosts[itemId].negativeQty);
            itemCosts[itemId].negativeQty -= deductQty;
            itemCosts[itemId].negativeCost -= deductQty * (amount / quantity);
            
            const remainingQty = quantity - deductQty;
            if (remainingQty > 0) {
              const unitCost = remainingQty > 0 ? amount / quantity : 0;
              itemCosts[itemId].lots.push({
                date: row.voucher_date,
                quantity: remainingQty,
                unit_cost: unitCost,
                remaining_qty: remainingQty,
                total_value: unitCost * remainingQty
              });
              itemCosts[itemId].totalQty += remainingQty;
              itemCosts[itemId].totalCostValue += unitCost * remainingQty;
            }
          } else {
            const unitCost = quantity > 0 ? amount / quantity : 0;
            itemCosts[itemId].lots.push({
              date: row.voucher_date,
              quantity: quantity,
              unit_cost: unitCost,
              remaining_qty: quantity,
              total_value: amount
            });
            itemCosts[itemId].totalQty += quantity;
            itemCosts[itemId].totalCostValue += amount;
          }
        } else if (isOutboundMovement(row, ruleContext.outboundVoucherType)) {
          // Xuất kho - trừ dần từ các lô cũ nhất (FIFO)
          let qtyToDeduct = quantity;
          let costValueToDeduct = 0;
          
          for (const lot of itemCosts[itemId].lots) {
            if (qtyToDeduct <= 0) break;
            
            if (lot.remaining_qty > 0) {
              const deductQty = Math.min(lot.remaining_qty, qtyToDeduct);
              costValueToDeduct += deductQty * lot.unit_cost;
              lot.remaining_qty -= deductQty;
              qtyToDeduct -= deductQty;
            }
          }
          
          // Xử lý tồn kho âm: nếu xuất nhiều hơn tồn kho
          if (qtyToDeduct > 0) {
            // Tồn âm: dùng giá trị cuối cùng của lot cuối cùng hoặc giá vốn 0
            const lastLotUnitCost = itemCosts[itemId].lots.length > 0 
              ? itemCosts[itemId].lots[itemCosts[itemId].lots.length - 1].unit_cost 
              : 0;
            
            // Ghi nhận tồn âm
            itemCosts[itemId].negativeQty = (itemCosts[itemId].negativeQty || 0) + qtyToDeduct;
            itemCosts[itemId].negativeCost = (itemCosts[itemId].negativeCost || 0) + (qtyToDeduct * lastLotUnitCost);
            costValueToDeduct += qtyToDeduct * lastLotUnitCost;
          }
          
          itemCosts[itemId].totalQty -= quantity;
          itemCosts[itemId].totalCostValue -= costValueToDeduct;
          
          // Cập nhật lại amount cho cả 2 vế của chứng từ xuất kho.
          await client.query(
            'UPDATE voucher_details SET amount = $1 WHERE id = $2',
            [costValueToDeduct, row.detail_id]
          );
          
          // Cập nhật vế đối ứng (DR) - giảm số tiền tương ứng
          if (row.account_code === ruleContext.allocationCreditAccount || row.account_code === ruleContext.inventoryAccount) {
            // Tìm chi tiết đối ứng trong cùng phiếu
            const counterQuery = `
              SELECT id, account_code, entry_type, amount 
              FROM voucher_details 
              WHERE voucher_id = $1 AND entry_type != $2
            `;
            const counterResult = await client.query(counterQuery, [row.voucher_id, row.entry_type]);
            
            for (const counterRow of counterResult.rows) {
              if (counterRow.entry_type === 'DR') {
                // Cập nhật vế DR (giảm kho)
                await client.query(
                  'UPDATE voucher_details SET amount = $1 WHERE id = $2',
                  [costValueToDeduct, counterRow.id]
                );
              }
            }
          }
        }
      }
      
      await client.query('COMMIT');
      
      // Xóa cache balance sau khi tính toán
      try {
        await invalidateBalance(companyId, year, month);
      } catch (cacheError) {
        console.error('Lỗi xóa cache FIFO:', cacheError);
      }
      
      return {
        success: true,
        message: `Đã tính toán giá vốn FIFO cho ${Object.keys(itemCosts).length} vật tư`,
        itemCosts
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
 * Kiểm tra chi phí logistic đã được phân bổ chưa
 * @param {number} companyId - ID công ty
 * @param {number} voucherId - ID phiếu nhập kho
 */
export async function checkLogisticCostAllocation(companyId, voucherId) {
  const ruleContext = getInventoryRuleContext();
  const inAccounts = [ruleContext.inventoryAccount, ...ruleContext.logisticsCostAccounts];
  const inPlaceholders = inAccounts.map((_, idx) => `$${idx + 2}`).join(', ');

  // Kiểm tra xem phiếu nhập kho đã có phân bổ chi phí logistic chưa
  const query = `
    SELECT vd.id, vd.account_code, vd.amount, vd.entry_type
    FROM voucher_details vd
    WHERE vd.voucher_id = $1
    AND vd.account_code IN (${inPlaceholders})
  `;
  
  const { rows } = await pool.query(query, [voucherId, ...inAccounts]);
  
  // Tính tổng giá trị nhập kho và chi phí đã phân bổ
  let totalInputValue = 0;
  let totalCostAllocated = 0;
  
  for (const row of rows) {
    const amount = parseFloat(row.amount) || 0;
    
    if (row.account_code === ruleContext.inventoryAccount && row.entry_type === 'DR') {
      totalInputValue += amount;
    } else if (ruleContext.logisticsCostAccounts.includes(row.account_code) && row.entry_type === 'DR') {
      totalCostAllocated += amount;
    }
  }
  
  return {
    total_input_value: totalInputValue,
    total_cost_allocated: totalCostAllocated,
    is_allocated: totalCostAllocated > 0
  };
}

/**
 * Phân bổ chi phí mua hàng vào nguyên giá
 * @param {number} companyId - ID công ty
 * @param {number} month - Tháng
 * @param {number} year - Năm
 */
export async function allocateLogisticCosts(companyId, month, year) {
  const client = await pool.connect();
  const ruleContext = getInventoryRuleContext();
  const costAccounts = ruleContext.logisticsCostAccounts;
  const costAccountsPlaceholders = costAccounts.map((_, idx) => `$${idx + 6}`).join(', ');
  
  try {
    await client.query('BEGIN');
    
    // Lấy tất cả phiếu nhập kho chưa phân bổ chi phí
    const query = `
      SELECT v.id as voucher_id, v.voucher_date,
             SUM(CASE WHEN vd.account_code = $4 AND vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as input_value,
             SUM(CASE WHEN vd.account_code IN (${costAccountsPlaceholders}) AND vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as cost_allocated
      FROM vouchers v
      JOIN voucher_details vd ON v.id = vd.voucher_id
      WHERE v.company_id = $1 
        AND v.is_posted = TRUE
        AND v.voucher_type = $5
        AND EXTRACT(MONTH FROM v.voucher_date) = $2
        AND EXTRACT(YEAR FROM v.voucher_date) = $3
      GROUP BY v.id, v.voucher_date
      HAVING SUM(CASE WHEN vd.account_code IN (${costAccountsPlaceholders}) AND vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) = 0
    `;
    
    const queryParams = [
      companyId,
      month,
      year,
      ruleContext.inventoryAccount,
      ruleContext.inboundVoucherType,
      ...costAccounts
    ];
    const { rows } = await client.query(query, queryParams);
    
    // Tính tổng giá trị nhập kho
    let totalInputValue = 0;
    for (const voucher of rows) {
      totalInputValue += parseFloat(voucher.input_value) || 0;
    }
    
    // Truy vấn SUM(amount) từ voucher_details cho tài khoản 1562 (totalLogisticFee)
    const logisticsQuery = `
      SELECT SUM(vd.amount) as total_logistics
      FROM voucher_details vd
      JOIN vouchers v ON vd.voucher_id = v.id
      WHERE v.company_id = $1 
        AND v.is_posted = TRUE
        AND vd.account_code = $4
        AND vd.entry_type = 'DR'
        AND EXTRACT(MONTH FROM v.voucher_date) = $2
        AND EXTRACT(YEAR FROM v.voucher_date) = $3
    `;
    
    const { rows: logisticsRows } = await client.query(logisticsQuery, [companyId, month, year, ruleContext.logisticsAccount]);
    const totalLogistics = parseFloat(logisticsRows[0]?.total_logistics) || 0;
    
    // Tính tỷ lệ phân bổ thực tế: totalLogistics / totalInputValue
    const allocationRate = totalInputValue > 0 ? totalLogistics / totalInputValue : 0;
    
    for (const row of rows) {
      const inputValue = parseFloat(row.input_value) || 0;
      
      if (inputValue > 0) {
        // Tạo bút toán phân bổ chi phí logistics
        const closingDate = `${year}-${String(month).padStart(2, '0')}-31`;
        await client.query(
          `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
           VALUES ($1, $2, $3, 'Phân bổ chi phí logistics cho hàng tồn kho')`,
          [companyId, ruleContext.allocationVoucherType, closingDate]
        );
        
        const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
        
        // Phân bổ theo tỷ lệ thực tế: inputValue * allocationRate
        const logisticCost = inputValue * allocationRate;
        
        await client.query(
          `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
           VALUES ($1, $2, 'DR', $3), ($4, $5, 'CR', $6)`,
          [voucherId, ruleContext.inventoryAccount, logisticCost, voucherId, ruleContext.allocationCreditAccount, logisticCost]
        );
      }
    }
    
    await client.query('COMMIT');
    
    return {
      success: true,
      message: `Đã phân bổ chi phí cho ${rows.length} phiếu nhập kho`,
      vouchers_processed: rows.length,
      allocation_rate: allocationRate
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
