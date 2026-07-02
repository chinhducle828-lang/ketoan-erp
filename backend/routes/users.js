import express from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createUserSchema } from '../validators/index.js';
import { normalizeCompanyIds, syncUserCompanyLinks } from '../services/helpers.js';

const router = express.Router();

// ==========================================
// 1. GET ALL USERS (Sửa triệt để lỗi 500)
// ==========================================
router.get('/', authenticate, requireRole(['admin', 'ktt']), async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      // Sử dụng cardinality và ép kiểu mảng tường minh để Postgres không bao giờ lỗi
      result = await pool.query(`
        SELECT id, username, role, manager_id,
               COALESCE(company_ids, '{}'::integer[]) as company_ids,
               COALESCE(staff_ids, '{}'::integer[]) as staff_ids,
               CASE 
                 WHEN cardinality(COALESCE(company_ids, '{}'::integer[])) = 0 THEN NULL 
                 ELSE (COALESCE(company_ids, '{}'::integer[]))[1] 
               END as company_id
        FROM users 
        ORDER BY id DESC
      `);
    } else {
      result = await pool.query(`
        SELECT id, username, role, manager_id,
               COALESCE(company_ids, '{}'::integer[]) as company_ids,
               CASE 
                 WHEN cardinality(COALESCE(company_ids, '{}'::integer[])) = 0 THEN NULL 
                 ELSE (COALESCE(company_ids, '{}'::integer[]))[1] 
               END as company_id
        FROM users 
        WHERE manager_id = $1 AND role = 'nv'
        ORDER BY username ASC
      `, [req.user.id]);
    }
    
    return res.json(result.rows);
  } catch (err) { 
    console.error("Lỗi GET /api/users:", err);
    return res.status(500).json({ error: "Lỗi hệ thống khi lấy danh sách nhân sự: " + err.message }); 
  }
});

// ==========================================
// 2. CREATE NEW USER (Sửa triệt để lỗi 502 / Crash)
// ==========================================
router.post('/', authenticate, requireRole(['admin']), validate(createUserSchema), async (req, res) => {
  try {
    const { username, password, role, companyIds, companyId, managerId } = req.body;

    // 1. Kiểm tra trùng tài khoản
    const userExist = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ error: 'Tên tài khoản này đã tồn tại trên hệ thống!' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const normalizedCompanyIds = role === 'admin' ? [] : normalizeCompanyIds(companyIds ?? companyId);
    
    // Ép kiểu an toàn: Chuỗi rỗng, không truyền, hoặc null đều đưa về null nguyên bản
    let finalManagerId = null;
    if (role === 'nv' && managerId !== undefined && managerId !== '' && managerId !== null) {
      finalManagerId = Number(managerId);
    }

    // 2. Kiểm tra điều kiện quản lý (Nếu có chọn Kế toán trưởng)
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

    // 3. Thực hiện chèn dữ liệu với mảng Postgres tường minh
    const result = await pool.query(
      "INSERT INTO users (username, password, role, must_change_password, company_ids, staff_ids, manager_id) VALUES ($1, $2, $3, $4, $5::integer[], '{}'::integer[], $6) RETURNING id, username, role, manager_id, company_ids",
      [username, hashed, role, true, normalizedCompanyIds, finalManagerId]
    );

    // 4. Đồng bộ liên kết công ty bảng phụ nếu có
    if (result.rows[0] && normalizedCompanyIds.length > 0) {
      try {
        await syncUserCompanyLinks(result.rows[0].id, normalizedCompanyIds);
      } catch (syncErr) {
        console.error("Lỗi phụ khi đồng bộ bảng user_companies:", syncErr);
        // Không return lỗi ở đây để tránh làm hỏng quá trình tạo tài khoản chính
      }
    }

    // 5. Đồng bộ cập nhật mảng staff_ids cho Kế toán trưởng quản lý
    if (finalManagerId) {
      const staffRes = await pool.query(
        "SELECT id FROM users WHERE manager_id = $1 AND role = 'nv' ORDER BY id DESC",
        [finalManagerId]
      );
      const currentStaffIds = staffRes.rows.map((row) => row.id) || [];
      await pool.query('UPDATE users SET staff_ids = $1::integer[] WHERE id = $2', [currentStaffIds, finalManagerId]);
    }

    return res.status(201).json({ success: true, message: 'Thêm nhân sự mới thành công!', user: result.rows[0] });
  } catch (err) { 
    console.error("Lỗi POST /api/users:", err);
    return res.status(500).json({ error: "Lỗi hệ thống khi tạo nhân sự: " + err.message }); 
  }
});

// ==========================================
// 3. DELETE USER
// ==========================================
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
    return res.json({ success: true, message: 'Đã xóa nhân sự khỏi hệ thống thành công!' });
  } catch (err) { 
    console.error("Lỗi DELETE /api/users:", err);
    return res.status(500).json({ error: "Lỗi hệ thống khi xóa nhân sự: " + err.message }); 
  }
});

export { router as usersRouter };