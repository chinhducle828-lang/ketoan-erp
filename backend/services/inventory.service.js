import { pool } from '../config/db.js';

/**
 * QUẢN LÝ KHO & TÍNH GIÁ VỐN - ERP KẾ TOÁN
 * LỖI 5: Tính giá xuất kho
 */

/**
 * Tính giá vốn xuất kho bằng phương pháp FIFO
 * @param {number} companyId - ID công ty
 * @param {number} itemId - ID vật tư
 * @param {string} targetDate - Ngày tính giá (định dạng YYYY-MM-DD)
 */
export async function calculateFifoCost(companyId, itemId, targetDate) {
  // Lấy tất cả phiếu nhập/xuất của vật tư sắp xếp theo thời gian
  const query = `
    SELECT vd.entry_type, vd.quantity, vd.amount, v.voucher_date, v.voucher_type
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 
      AND vd.item_id = $2 
      AND v.voucher_date <= $3
    ORDER BY v.voucher_date ASC, v.id ASC
  `;
  
  const { rows } = await pool.query(query, [companyId, itemId, targetDate]);
  
  // Tính giá vốn tồn kho theo FIFO
  const inventoryLots = [];
  let totalQty = 0;
  let totalCostValue = 0;
  
  for (const row of rows) {
    const qty = parseFloat(row.quantity) || 0;
    const val = parseFloat(row.amount) || 0;
    
    if (row.voucher_type === 'NK' || (row.entry_type === 'DR' && qty > 0)) {
      // Nhập kho - tạo lô mới
      inventoryLots.push({
        date: row.voucher_date,
        quantity: qty,
        unit_cost: val / qty,
        remaining_qty: qty,
        total_value: val
      });
      totalQty += qty;
      totalCostValue += val;
    } else if (row.voucher_type === 'XK' || (row.entry_type === 'CR' && qty > 0)) {
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
      
      totalQty -= qty;
      totalCostValue -= costValueToDeduct;
    }
  }
  
  return {
    current_quantity: totalQty,
    total_inventory_value: totalCostValue,
    average_unit_cost: totalQty > 0 ? totalCostValue / totalQty : 0,
    lots: inventoryLots
  };
}

/**
 * Tính giá vốn bình quân gia quyền
 * @param {number} companyId - ID công ty
 * @param {number} month - Tháng
 * @param {number} year - Năm
 */
export async function calculateWeightedAverageCostForPeriod(companyId, month, year) {
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
    
    if (row.voucher_type === 'NK' || (row.entry_type === 'DR' && quantity > 0)) {
      // Nhập kho - cập nhật giá trung bình
      itemCosts[itemId].totalQty += quantity;
      itemCosts[itemId].totalCostValue += amount;
      if (itemCosts[itemId].totalQty > 0) {
        itemCosts[itemId].averagePrice = itemCosts[itemId].totalCostValue / itemCosts[itemId].totalQty;
      }
    } else if (row.voucher_type === 'XK' || (row.entry_type === 'CR' && quantity > 0)) {
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
  
  const { rows } = await pool.query(query, params);
  
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
    
    if (row.voucher_type === 'NK' || (row.entry_type === 'DR' && quantity > 0)) {
      // Nhập kho - tạo lô mới theo FIFO
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
    } else if (row.voucher_type === 'XK' || (row.entry_type === 'CR' && quantity > 0)) {
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
      
      itemCosts[itemId].totalQty -= quantity;
      itemCosts[itemId].totalCostValue -= costValueToDeduct;
      
      // Cập nhật lại amount cho cả 2 vế của chứng từ xuất kho
      // Vế CR: Tài khoản 632 (Giá vốn) - cập nhật số tiền
      // Vế DR: Tài khoản 156 (Hàng tồn kho) - cập nhật số tiền giảm
      await pool.query(
        'UPDATE voucher_details SET amount = $1 WHERE id = $2',
        [costValueToDeduct, row.detail_id]
      );
      
      // Cập nhật vế đối ứng (DR) - giảm số tiền tương ứng
      if (row.account_code === '632' || row.account_code === '156') {
        // Tìm chi tiết đối ứng trong cùng phiếu
        const counterQuery = `
          SELECT id, account_code, entry_type, amount 
          FROM voucher_details 
          WHERE voucher_id = $1 AND entry_type != $2
        `;
        const counterResult = await pool.query(counterQuery, [row.voucher_id, row.entry_type]);
        
        for (const counterRow of counterResult.rows) {
          if (counterRow.entry_type === 'DR') {
            // Cập nhật vế DR (giảm kho)
            await pool.query(
              'UPDATE voucher_details SET amount = $1 WHERE id = $2',
              [costValueToDeduct, counterRow.id]
            );
          }
        }
      }
    }
  }
  
  return {
    success: true,
    message: `Đã tính toán giá vốn FIFO cho ${Object.keys(itemCosts).length} vật tư`,
    itemCosts
  };
}

/**
 * Kiểm tra chi phí logistic đã được phân bổ chưa
 * @param {number} companyId - ID công ty
 * @param {number} voucherId - ID phiếu nhập kho
 */
export async function checkLogisticCostAllocation(companyId, voucherId) {
  // Kiểm tra xem phiếu nhập kho đã có phân bổ chi phí logistic chưa
  const query = `
    SELECT vd.id, vd.account_code, vd.amount, vd.entry_type
    FROM voucher_details vd
    WHERE vd.voucher_id = $1
    AND vd.account_code IN ('156', '632', '641', '642')
  `;
  
  const { rows } = await pool.query(query, [voucherId]);
  
  // Tính tổng giá trị nhập kho và chi phí đã phân bổ
  let totalInputValue = 0;
  let totalCostAllocated = 0;
  
  for (const row of rows) {
    const amount = parseFloat(row.amount) || 0;
    
    if (row.account_code === '156' && row.entry_type === 'DR') {
      totalInputValue += amount;
    } else if (['632', '641', '642'].includes(row.account_code) && row.entry_type === 'DR') {
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
  
  try {
    await client.query('BEGIN');
    
    // Lấy tất cả phiếu nhập kho chưa phân bổ chi phí
    const query = `
      SELECT v.id as voucher_id, v.voucher_date,
             SUM(CASE WHEN vd.account_code = '156' AND vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as input_value,
             SUM(CASE WHEN vd.account_code IN ('632', '641', '642') AND vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as cost_allocated
      FROM vouchers v
      JOIN voucher_details vd ON v.id = vd.voucher_id
      WHERE v.company_id = $1 
        AND v.voucher_type = 'NK'
        AND EXTRACT(MONTH FROM v.voucher_date) = $2
        AND EXTRACT(YEAR FROM v.voucher_date) = $3
      GROUP BY v.id, v.voucher_date
      HAVING SUM(CASE WHEN vd.account_code IN ('632', '641', '642') AND vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) = 0
    `;
    
    const { rows } = await client.query(query, [companyId, month, year]);
    
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
        AND vd.account_code = '1562'
        AND vd.entry_type = 'DR'
        AND EXTRACT(MONTH FROM v.voucher_date) = $2
        AND EXTRACT(YEAR FROM v.voucher_date) = $3
    `;
    
    const { rows: logisticsRows } = await client.query(logisticsQuery, [companyId, month, year]);
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
           VALUES ($1, 'DauKy', $2, 'Phân bổ chi phí logistics cho hàng tồn kho')`,
          [companyId, closingDate]
        );
        
        const voucherId = (await client.query('SELECT LASTVAL()')).rows[0].lastval;
        
        // Phân bổ theo tỷ lệ thực tế: inputValue * allocationRate
        const logisticCost = inputValue * allocationRate;
        
        await client.query(
          `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
           VALUES ($1, '156', 'DR', $2), ($3, '632', 'CR', $4)`,
          [voucherId, logisticCost, voucherId, logisticCost]
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
