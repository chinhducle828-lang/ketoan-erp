import express from 'express';
import { pool } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import { publishToCompany } from '../../services/websocket.service.js';
import { getInventoryRules } from '../../config/businessRules.js';

const router = express.Router();

/**
 * Order Ingestion API - Storefront to ERP Integration
 * Maps storefront order payloads to ERP draft vouchers
 */

/**
 * Get sales voucher type from business rules
 */
const getSalesVoucherType = () => {
  const rules = getInventoryRules();
  return String(rules.salesVoucherType || 'XK');
};

/**
 * Get inventory account from business rules
 */
const getInventoryAccount = () => {
  const rules = getInventoryRules();
  const accounts = rules.accounts || {};
  return String(accounts.inventory || '156');
};

/**
 * Get sales account from business rules
 */
const getSalesAccount = () => {
  const rules = getInventoryRules();
  const accounts = rules.accounts || {};
  return String(accounts.sales || '511');
};

/**
 * POST: Tạo chứng từ từ đơn hàng storefront
 * Maps storefront order to ERP draft voucher
 */
router.post('/orders', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const {
      company_id,
      order_number,
      order_date,
      customer_id,
      items,
      total_amount,
      description
    } = req.body;
    
    // Validate required fields
    if (!company_id || !order_number || !order_date || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu thông tin bắt buộc: company_id, order_number, order_date, items'
      });
    }
    
    // Create draft voucher (is_posted = false)
    const voucherType = getSalesVoucherType();
    const inventoryAccount = getInventoryAccount();
    const salesAccount = getSalesAccount();
    
    // Insert voucher master
    const voucherRes = await client.query(
      `INSERT INTO vouchers (
        company_id, voucher_type, voucher_date, voucher_number, 
        description, currency, exchange_rate, created_by, is_posted
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        company_id,
        voucherType,
        order_date,
        order_number,
        description || `Đơn hàng từ storefront: ${order_number}`,
        'VND',
        1,
        req.user?.id || null,
        false // Draft voucher
      ]
    );
    
    const voucherId = voucherRes.rows[0].id;
    
    // Calculate total for double-entry validation
    let totalDebit = 0;
    let totalCredit = 0;
    
    // Insert voucher details
    for (const item of items) {
      const { item_id, quantity, unit_price, amount } = item;
      
      // Debit: Inventory account (reduce stock)
      if (quantity > 0 && amount > 0) {
        totalDebit += parseFloat(amount);
        
        await client.query(
          `INSERT INTO voucher_details (
            voucher_id, account_code, entry_type, amount, quantity, item_id, partner_id
          ) VALUES ($1, $2, 'DR', $3, $4, $5, $6)`,
          [voucherId, inventoryAccount, amount, quantity, item_id, customer_id]
        );
      }
    }
    
    // Credit: Sales account
    if (totalDebit > 0) {
      totalCredit = totalDebit;
      
      await client.query(
        `INSERT INTO voucher_details (
          voucher_id, account_code, entry_type, amount, partner_id
        ) VALUES ($1, $2, 'CR', $3, $4)`,
        [voucherId, salesAccount, totalCredit, customer_id]
      );
    }
    
    await client.query('COMMIT');
    
    // Emit WebSocket event for real-time updates
    try {
      publishToCompany(company_id, 'orderCreated', {
        orderId: voucherId,
        orderNumber: order_number,
        status: 'draft',
        timestamp: new Date().toISOString()
      });
    } catch (wsError) {
      console.error('WebSocket notification error:', wsError);
    }
    
    res.status(201).json({
      success: true,
      message: 'Tạo chứng từ từ đơn hàng thành công',
      voucher_id: voucherId,
      voucher_number: order_number,
      status: 'draft'
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Lỗi tạo chứng từ từ đơn hàng:', error);
    res.status(500).json({
      success: false,
      error: 'Lỗi tạo chứng từ từ đơn hàng',
      details: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * GET: Lấy danh sách đơn hàng (draft vouchers)
 */
router.get('/orders', authenticate, async (req, res) => {
  try {
    const { company_id, status = 'draft', limit = 50, offset = 0 } = req.query;
    
    if (!company_id) {
      return res.status(400).json({ error: 'Thiếu company_id' });
    }
    
    const query = `
      SELECT 
        v.id,
        v.voucher_number as order_number,
        v.voucher_date as order_date,
        v.description,
        v.is_posted as is_posted,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', vd.id,
            'account_code', vd.account_code,
            'entry_type', vd.entry_type,
            'amount', vd.amount,
            'quantity', vd.quantity,
            'item_id', vd.item_id,
            'partner_id', vd.partner_id
          )
        ) FILTER (WHERE vd.id IS NOT NULL) as items
      FROM vouchers v
      LEFT JOIN voucher_details vd ON v.id = vd.voucher_id
      WHERE v.company_id = $1
        AND v.voucher_type = 'XK'
        ${status === 'draft' ? 'AND v.is_posted = FALSE' : 'AND v.is_posted = TRUE'}
      GROUP BY v.id
      ORDER BY v.voucher_date DESC
      LIMIT $2 OFFSET $3
    `;
    
    const { rows } = await pool.query(query, [company_id, limit, offset]);
    
    res.json({
      success: true,
      data: rows,
      total: rows.length
    });
    
  } catch (error) {
    console.error('Lỗi lấy danh sách đơn hàng:', error);
    res.status(500).json({
      success: false,
      error: 'Lỗi lấy danh sách đơn hàng',
      details: error.message
    });
  }
});

/**
 * PUT: Cập nhật trạng thái đơn hàng
 */
router.put('/orders/:id/status', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { status } = req.body;
    
    // Get current voucher
    const voucherRes = await client.query(
      'SELECT id, company_id, voucher_number FROM vouchers WHERE id = $1',
      [id]
    );
    
    if (voucherRes.rows.length === 0) {
      return res.status(404).json({ error: 'Đơn hàng không tồn tại' });
    }
    
    const voucher = voucherRes.rows[0];
    
    // Update status
    await client.query(
      'UPDATE vouchers SET is_posted = $1 WHERE id = $2',
      [status === 'posted', id]
    );
    
    await client.query('COMMIT');
    
    // Emit WebSocket event
    try {
      publishToCompany(voucher.company_id, 'orderStatusChanged', {
        orderId: id,
        orderNumber: voucher.voucher_number,
        status: status,
        timestamp: new Date().toISOString()
      });
    } catch (wsError) {
      console.error('WebSocket notification error:', wsError);
    }
    
    res.json({
      success: true,
      message: 'Cập nhật trạng thái đơn hàng thành công',
      order_id: id,
      status: status
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({
      success: false,
      error: 'Lỗi cập nhật trạng thái đơn hàng',
      details: error.message
    });
  } finally {
    client.release();
  }
});

export default router;