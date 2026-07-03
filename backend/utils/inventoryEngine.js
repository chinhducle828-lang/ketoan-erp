// FILE_PATH: backend/utils/inventoryEngine.js
import { pool } from '../config/db.js';

/**
 * Tính toán giá vốn và lượng tồn kho tức thời của vật tư hàng hóa
 * @param {number} companyId - ID công ty
 * @param {number} month - Tháng tính toán (tùy chọn)
 * @param {number} year - Năm tính toán (tùy chọn)
 * @returns {Object} - Kết quả tính giá vốn
 */
export async function calculateInventoryCost(companyId, itemId, targetDate) {
  // Lấy toàn bộ phát sinh nhập xuất của vật tư sắp xếp theo thời gian tăng dần
  const query = `
    SELECT vd.entry_type, vd.quantity, vd.amount, v.voucher_date, v.voucher_type
    FROM voucher_details vd
    JOIN vouchers v ON vd.voucher_id = v.id
    WHERE v.company_id = $1 AND vd.item_id = $2 AND v.voucher_date <= $3
    ORDER BY v.voucher_date ASC, v.id ASC
  `;
  
  const { rows } = await pool.query(query, [companyId, itemId, targetDate]);

  let totalQty = 0;
  let totalCostValue = 0;
  let currentMovingAveragePrice = 0;

  rows.forEach(row => {
    const qty = parseFloat(row.quantity) || 0;
    const val = parseFloat(row.amount) || 0;

    if (row.entry_type === 'DR') { 
      // Phát sinh Nhập kho (Tăng số lượng, tăng giá trị kho)
      totalQty += qty;
      totalCostValue += val;
      if (totalQty > 0) {
        currentMovingAveragePrice = totalCostValue / totalQty;
      }
    } else if (row.entry_type === 'CR') { 
      // Phát sinh Xuất kho (Giảm số lượng theo giá bình quân tại thời điểm đó)
      const calculatedOutValue = qty * currentMovingAveragePrice;
      totalQty -= qty;
      totalCostValue -= calculatedOutValue;
    }
  });

  return {
    current_quantity: totalQty,
    total_inventory_value: totalCostValue,
    average_unit_price: currentMovingAveragePrice
  };
}

/**
 * Tính toán giá vốn bình quân gia quyền cho xuất kho
 * @param {number} companyId - ID công ty
 * @param {number} month - Tháng tính toán
 * @param {number} year - Năm tính toán
 * @returns {Object} - Kết quả tính toán
 */
export async function calculateWeightedAverageCost(companyId, month, year) {
  // BƯỚC 1: Phân bổ chi phí logistics cho phiếu nhập kho chưa có phân bổ
  // Lấy tất cả phiếu nhập kho (NK) chưa có phân bổ chi phí 632/641/642
  const allocationQuery = `
    SELECT v.id as voucher_id,
           SUM(CASE WHEN vd.account_code = '156' AND vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as input_value,
           SUM(CASE WHEN vd.account_code IN ('632', '641', '642') AND vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) as cost_allocated
    FROM vouchers v
    JOIN voucher_details vd ON v.id = vd.voucher_id
    WHERE v.company_id = $1 
      AND v.voucher_type = 'NK'
      ${month ? `AND EXTRACT(MONTH FROM v.voucher_date) = $2` : ''}
      ${year ? `AND EXTRACT(YEAR FROM v.voucher_date) = $${month ? 3 : 2}` : ''}
    GROUP BY v.id
    HAVING SUM(CASE WHEN vd.account_code IN ('632', '641', '642') AND vd.entry_type = 'DR' THEN vd.amount ELSE 0 END) = 0
  `;
  
  const allocParams = [companyId];
  if (month) allocParams.push(month);
  if (year) allocParams.push(year);
  
  const { rows: vouchersToAllocate } = await pool.query(allocationQuery, allocParams);
  
  // Thực hiện phân bổ chi phí logistics (10% giá trị nhập)
  for (const voucher of vouchersToAllocate) {
    const inputValue = parseFloat(voucher.input_value) || 0;
    if (inputValue > 0) {
      const logisticCost = inputValue * 0.1; // 10% chi phí logistics
      
      // Tạo bút toán phân bổ: Nợ TK 156, Có TK 632
      const closingDate = year && month ? `${year}-${String(month).padStart(2, '0')}-31` : new Date().toISOString().split('T')[0];
      await pool.query(
        `INSERT INTO vouchers (company_id, voucher_type, voucher_date, description) 
         VALUES ($1, 'DauKy', $2, 'Tự động phân bổ chi phí logistics')`,
        [companyId, closingDate]
      );
      
      const voucherId = (await pool.query('SELECT LASTVAL()')).rows[0].lastval;
      
      await pool.query(
        `INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount) 
         VALUES ($1, '156', 'DR', $2), ($3, '632', 'CR', $4)`,
        [voucherId, logisticCost, voucherId, logisticCost]
      );
    }
  }
  
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

  // Lấy tất cả chứng từ xuất kho (XK) của công ty trong tháng/năm chỉ định
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
      // Đã bao gồm chi phí logistics đã phân bổ
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
