import express from 'express';
import { pool } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createCompanySchema } from '../validators/index.js';
import { canAccessCompany, getCompanyIdsForUser } from '../services/helpers.js';

const router = express.Router();

// Thêm mới công ty
router.post('/', authenticate, requireRole(['admin']), validate(createCompanySchema), async (req, res) => {
  try {
    const { name, taxCode, address } = req.body;
    const result = await pool.query(
      'INSERT INTO companies (name, tax_code, address) VALUES ($1, $2, $3) RETURNING *', 
      [name, taxCode, address]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Lấy danh sách công ty
router.get('/', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      const result = await pool.query('SELECT * FROM companies ORDER BY id DESC');
      return res.json(result.rows);
    }

    const companyIds = await getCompanyIdsForUser(req.user);
    if (companyIds.length === 0) {
      return res.json([]);
    }

    const result = await pool.query(
      'SELECT * FROM companies WHERE id = ANY($1) ORDER BY id DESC',
      [companyIds]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Xóa công ty
router.delete('/:id', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const companyId = req.params.id;
    
    const checkUsers = await pool.query('SELECT user_id FROM user_companies WHERE company_id = $1 LIMIT 1', [companyId]);
    if (checkUsers.rows.length > 0) {
      return res.status(400).json({ error: 'Không thể xóa công ty vì còn nhân viên đang được gán quyền làm việc!' });
    }

    await pool.query('DELETE FROM companies WHERE id = $1', [companyId]);
    res.json({ success: true, message: 'Đã xóa công ty thành công!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Export a single company's data
router.get('/:id/export', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const companyId = Number(req.params.id);
    const comp = await pool.query('SELECT * FROM companies WHERE id = $1', [companyId]);
    if (comp.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy công ty.' });

    const items = await pool.query('SELECT code, name, unit, company_id FROM items WHERE company_id = $1 ORDER BY code', [companyId]);
    const vouchers = await pool.query('SELECT id, company_id, voucher_date, description, account_dr, account_cr, amount, voucher_type, created_by, created_at FROM vouchers WHERE company_id = $1 ORDER BY id', [companyId]);
    const opening = await pool.query('SELECT account_code, debit_balance, credit_balance, fiscal_year FROM opening_balances WHERE company_id = $1 ORDER BY account_code', [companyId]);

    res.json({
      company: comp.rows[0],
      items: items.rows,
      vouchers: vouchers.rows,
      opening_balances: opening.rows
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Import data for a company
router.post('/:id/import', authenticate, requireRole(['admin']), async (req, res) => {
  const companyId = Number(req.params.id);
  const { items = [], vouchers = [], opening_balances = [] } = req.body || {};
  try {
    await pool.query('BEGIN');

    // Upsert items
    for (const it of items) {
      await pool.query(
        'INSERT INTO items (code, name, unit, company_id, created_by, created_at) VALUES ($1, $2, $3, $4, $5, COALESCE($6, now())) ON CONFLICT (code, company_id) DO UPDATE SET name = EXCLUDED.name, unit = EXCLUDED.unit',
        [it.code, it.name, it.unit, companyId, req.user.id, it.created_at || null]
      );
    }

    // Insert opening balances
    for (const ob of opening_balances) {
      await pool.query(
        `INSERT INTO opening_balances (company_id, account_code, debit_balance, credit_balance, fiscal_year)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (company_id, account_code, fiscal_year) DO UPDATE SET debit_balance = EXCLUDED.debit_balance, credit_balance = EXCLUDED.credit_balance`,
        [companyId, ob.account_code, ob.debit_balance || 0, ob.credit_balance || 0, ob.fiscal_year || 2026]
      );
    }

    // Insert vouchers
    for (const v of vouchers) {
      await pool.query(
        `INSERT INTO vouchers (company_id, voucher_date, description, account_dr, account_cr, amount, voucher_type, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, COALESCE($8, now()))`,
        [companyId, v.voucher_date, v.description, v.account_dr, v.account_cr, v.amount, v.voucher_type, v.created_at || null]
      );
    }

    await pool.query('COMMIT');
    res.json({ success: true, message: 'Import dữ liệu công ty thành công.' });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

export { router as companiesRouter };