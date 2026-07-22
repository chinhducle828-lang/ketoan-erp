import express from 'express';
import { pool } from '../config/db.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

const parsePositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

router.get('/check', authenticate, async (req, res) => {
  try {
    const companyId = req.query.company_id || req.user?.activeCompanyId;
    const partnerId = req.query.partner_id || req.query.customer_id;
    const newOrderAmount = parsePositiveNumber(req.query.amount || req.query.order_total);

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Thiếu company_id' });
    }

    if (!partnerId) {
      return res.status(400).json({ success: false, error: 'Thiếu partner_id hoặc customer_id' });
    }

    const partnerResult = await pool.query(
      'SELECT id, partner_name, credit_limit FROM partners WHERE id = $1 AND company_id = $2',
      [partnerId, companyId]
    );

    if (partnerResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: `Không tìm thấy partner id=${partnerId}` });
    }

    const creditLimit = parsePositiveNumber(partnerResult.rows[0].credit_limit);
    const debtResult = await pool.query(
      `SELECT COALESCE(SUM(CASE WHEN entry_type = 'DR' THEN amount ELSE -amount END), 0) AS current_debt
       FROM voucher_details vd
       JOIN vouchers v ON v.id = vd.voucher_id
       WHERE v.company_id = $1 AND vd.account_code = '131' AND vd.partner_id = $2 AND v.is_posted = TRUE`,
      [companyId, partnerId]
    );

    const currentDebt = parsePositiveNumber(debtResult.rows[0]?.current_debt);
    const totalExpected = currentDebt + newOrderAmount;
    const shortage = totalExpected - creditLimit;
    const availableCredit = Math.max(creditLimit - currentDebt, 0);

    return res.json({
      success: true,
      company_id: Number(companyId),
      partner_id: Number(partnerId),
      partner_name: partnerResult.rows[0].partner_name,
      credit_limit: creditLimit,
      current_debt: currentDebt,
      available_credit: availableCredit,
      new_order_amount: newOrderAmount,
      total_expected: totalExpected,
      shortage,
      is_exceeded: shortage > 0
    });
  } catch (err) {
    console.error('Error checking credit limit:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
