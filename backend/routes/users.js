import express from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../server.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createUserSchema } from '../validators/index.js';
import { normalizeCompanyIds, syncUserCompanyLinks } from '../services/helpers.js';

const router = express.Router();

// Lấy danh sách người dùng
router.get('/', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await pool.query(`
        SELECT id, username, role, manager_id,
               COALESCE(company_ids, '{}') as company_ids,
               COALESCE(staff_ids, '{}') as staff_ids,
               CASE WHEN array_length(COALESCE(company_ids, '{}'), 1) IS NULL THEN NULL ELSE COALESCE(company_ids, '{}')[1] END as company_id
        FROM users 
        ORDER BY id DESC
      `);
    } else {
      result = await pool.query(`
        SELECT id, username, role, manager_id,
               COALESCE(company_ids, '{}') as company_ids,
               CASE WHEN array_length(COALESCE(company_ids, '{}'), 1) IS NULL THEN NULL ELSE COALESCE(company_ids, '{}')[1] END as company_id
        FROM users 
        WHERE manager_id = $1 AND role = 'nv'
        ORDER BY username ASC
      `, [req.user.id]);
    }
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Khai báo nhân sự mới
router.post('/', authenticate, requireRole(['admin']), validate(createUserSchema), async (req, res) => {
  try {
    const { username, password, role, companyIds, companyId, managerId } = req.body;

    const userExist = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ error: 'Tên tài khoản này đã tồn tại trên hệ thống!' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const normalizedCompanyIds = role === 'admin' ? [] : normalizeCompanyIds(companyIds ?? companyId);
    const finalManagerId = role === 'nv' ? (managerId || null) : null;

    if (finalManagerId) {
      const managerRes = await pool.query('SELECT role FROM users WHERE id = $1', [finalManagerId]);
      if (managerRes.rows.length === 0 || managerRes.rows[0].role !== 'ktt') {
        return res.status(400).json({ error: 'KTT quản lý không hợp lệ!' });
      }

      const countRes = await pool.query(
        "SELECT COUNT(*) FROM users WHERE manager_id = $1 AND role = 'nv'",
        [finalManagerId]
      );
      if (parseInt(countRes.rows[0].count, 10) >= 15) {
        return res.status(400).json({ error: 'Kế toán trưởng này đã quản lý đủ tối đa 15 nhân viên!' });
      }
    }

    const result = await pool.query(
      "INSERT INTO users (username, password, role, must_change_password, company_ids, staff_ids, manager_id) VALUES ($1, $2, $3, $4, $5, '{}', $6) RETURNING id, username, role, manager_id, company_ids",
      [username, hashed, role, true, normalizedCompanyIds, finalManagerId]
    );

    if (result.rows[0] && normalizedCompanyIds.length > 0) {
      await syncUserCompanyLinks(result.rows[0].id, normalizedCompanyIds);
    }

    if (finalManagerId) {
      const staffRes = await pool.query(
        "SELECT id FROM users WHERE manager_id = $1 AND role = 'nv' ORDER BY id DESC",
        [finalManagerId]
      );
      const currentStaffIds = staffRes.rows.map((row) => row.id);
      await pool.query('UPDATE users SET staff_ids = $1 WHERE id = $2', [currentStaffIds, finalManagerId]);
    }

    res.status(201).json({ success: true, message: 'Thêm nhân sự mới thành công!', user: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Xóa nhân sự
router.delete('/:id', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const userId = req.params.id;
    if (parseInt(userId, 10) === req.user.id) {
      return res.status(400).json({ error: 'Bạn không thể tự xóa tài khoản chính mình!' });
    }

    const targetUser = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
    if (targetUser.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy tài khoản nhân sự!' });

    if (targetUser.rows[0].username === 'admin') {
      return res.status(400).json({ error: 'Tài khoản Root hệ thống là bất tử, không thể xóa!' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    res.json({ success: true, message: 'Đã xóa nhân sự khỏi hệ thống thành công!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export { router as usersRouter };