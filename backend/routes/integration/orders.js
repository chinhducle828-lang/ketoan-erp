import express from 'express';
import { pool } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import { publishToCompany } from '../../services/websocket.service.js';
import { addOrderIngestionJob } from '../../services/queue.service.js';
import { assertCompanyOperational, validateOrderPayloadReferences } from '../../services/cascadeValidation.service.js';

const router = express.Router();

/**
 * Order Ingestion API - Storefront to ERP Integration
 * Maps storefront order payloads to ERP draft vouchers
 */

/**
 * POST: Tạo đơn hàng storefront vào queue xử lý bất đồng bộ
 */
router.post('/orders', authenticate, async (req, res) => {
  try {
    const {
      company_id,
      order_number,
      order_date,
      customer_id,
      items,
      description
    } = req.body;

    if (!company_id || !order_number || !order_date || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu thông tin bắt buộc: company_id, order_number, order_date, items'
      });
    }

    await assertCompanyOperational(company_id);
    await validateOrderPayloadReferences({
      companyId: company_id,
      customerId: customer_id,
      items
    });

    const job = await addOrderIngestionJob({
      order: {
        company_id,
        order_number,
        order_date,
        customer_id,
        items,
        description
      },
      userId: req.user?.id || null
    });

    res.status(202).json({
      success: true,
      message: 'Đơn hàng đã được nhận vào queue xử lý',
      jobId: job.id,
      status: 'queued'
    });
  } catch (error) {
    console.error('Lỗi enqueue đơn hàng storefront:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể đưa đơn vào queue xử lý',
      details: error.message
    });
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
    await assertCompanyOperational(voucher.company_id, { client });
    
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
        clientInstanceId: req.headers['x-client-instance-id'] || null,
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