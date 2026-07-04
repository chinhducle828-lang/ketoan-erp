import express from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createUserSchema } from '../validators/index.js';
import { normalizeCompanyIds, syncUserCompanyLinks } from '../services/helpers.js';

const router = express.Router();
const EMPLOYEE_ROLES = ['nv', 'nv_banhang', 'nv_kho'];

// ==========================================
// 1. GET ALL USERS (Sửa triệt để lỗi 500)
// ==========================================
router.get('/', authenticate, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      // Sử dụng cardinality và ép kiểu mảng tường minh để Postgres không bao giờ lỗi
      result = await pool.query(`
        SELECT id, username, role, manager_id, is_root_admin,
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
        SELECT id, username, role, manager_id, is_root_admin,
               COALESCE(company_ids, '{}'::integer[]) as company_ids,
               CASE 
                 WHEN cardinality(COALESCE(company_ids, '{}'::integer[])) = 0 THEN NULL 
                 ELSE (COALESCE(company_ids, '{}'::integer[]))[1] 
               END as company_id
        FROM users 
        WHERE manager_id = $1 AND role = ANY($2::text[])
        ORDER BY username ASC
      `, [req.user.id, EMPLOYEE_ROLES]);
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
router.post('/', authenticate, async (req, res) => {
  try {
    const { username, password, role, companyIds, companyId, managerId } = req.body;

    // 1. Kiểm tra quyền root admin khi tạo user có role admin
    const currentUser = await pool.query('SELECT username, role, is_root_admin FROM users WHERE id = $1', [req.user.id]);
    const isRootAdmin = currentUser.rows[0]?.username === 'admin' || currentUser.rows[0]?.is_root_admin === true;
    
    if (role === 'admin' && !isRootAdmin) {
      return res.status(403).json({ error: 'Chỉ Root Admin mới có quyền tạo tài khoản Admin!' });
    }
    
    // 2. Kiểm tra trùng tài khoản
    const userExist = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ error: 'Tên tài khoản này đã tồn tại trên hệ thống!' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const normalizedCompanyIds = role === 'admin' ? [] : normalizeCompanyIds(companyIds ?? companyId);

    if (EMPLOYEE_ROLES.includes(role) && normalizedCompanyIds.length === 0) {
      return res.status(400).json({ error: 'Nhân viên bắt buộc phải được gán ít nhất 1 doanh nghiệp làm việc.' });
    }
    
    // Ép kiểu an toàn: Chuỗi rỗng, không truyền, hoặc null đều đưa về null nguyên bản
    let finalManagerId = null;
    if (EMPLOYEE_ROLES.includes(role) && managerId !== undefined && managerId !== '' && managerId !== null) {
      finalManagerId = Number(managerId);
    }

    // 2. Kiểm tra điều kiện quản lý (Nếu có chọn Kế toán trưởng)
    if (finalManagerId) {
      const managerRes = await pool.query('SELECT role FROM users WHERE id = $1', [finalManagerId]);
      if (managerRes.rows.length === 0 || managerRes.rows[0].role !== 'ktt') {
        return res.status(400).json({ error: 'KTT quản lý không hợp lệ!' });
      }

      const countRes = await pool.query(
        "SELECT COUNT(*) FROM users WHERE manager_id = $1 AND role = ANY($2::text[])",
        [finalManagerId, EMPLOYEE_ROLES]
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
        "SELECT id FROM users WHERE manager_id = $1 AND role = ANY($2::text[]) ORDER BY id DESC",
        [finalManagerId, EMPLOYEE_ROLES]
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
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const userId = req.params.id;
    if (parseInt(userId, 10) === req.user.id) {
      return res.status(400).json({ error: 'Bạn không thể tự xóa tài khoản chính mình!' });
    }

    const targetUser = await pool.query('SELECT username, role FROM users WHERE id = $1', [userId]);
    if (targetUser.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy tài khoản nhân sự!' });

    if (targetUser.rows[0].username === 'admin') {
      return res.status(400).json({ error: 'Tài khoản Root hệ thống là bất tử, không thể xóa!' });
    }
    
    // Kiểm tra quyền root admin khi xóa user có role admin
    const currentUser = await pool.query('SELECT username, role, is_root_admin FROM users WHERE id = $1', [req.user.id]);
    const isRootAdmin = currentUser.rows[0]?.username === 'admin' || currentUser.rows[0]?.is_root_admin === true;
    
    if (targetUser.rows[0].role === 'admin' && !isRootAdmin) {
      return res.status(403).json({ error: 'Chỉ Root Admin mới có quyền xóa tài khoản Admin!' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    return res.json({ success: true, message: 'Đã xóa nhân sự khỏi hệ thống thành công!' });
  } catch (err) { 
    console.error("Lỗi DELETE /api/users:", err);
    return res.status(500).json({ error: "Lỗi hệ thống khi xóa nhân sự: " + err.message }); 
  }
});

// ==========================================
// 4. SET ROOT ADMIN FLAG - CHỈ CHO PHÉP KHI KHỞI TẠO HỆ THỐNG
// ==========================================
router.post('/:id/set-root-admin', authenticate, async (req, res) => {
  try {
    const userId = req.params.id;
    const { is_root_admin } = req.body;

    // Validate input
    if (typeof is_root_admin !== 'boolean') {
      return res.status(400).json({ error: 'Giá trị is_root_admin phải là boolean (true/false)' });
    }

    // Check if user exists
    const targetUser = await pool.query('SELECT username, role, is_root_admin FROM users WHERE id = $1', [userId]);
    if (targetUser.rows.length === 0) {
      return res.status(400).json({ error: 'Không tìm thấy tài khoản nhân sự!' });
    }
    
    // Kiểm tra quyền root admin
    const currentUser = await pool.query('SELECT username, role, is_root_admin FROM users WHERE id = $1', [req.user.id]);
    const isRootAdmin = currentUser.rows[0]?.username === 'admin' || currentUser.rows[0]?.is_root_admin === true;
    
    if (!isRootAdmin) {
      return res.status(403).json({ error: 'Chỉ Root Admin mới có quyền thay đổi quyền Root Admin!' });
    }

    const { username, role, is_root_admin: currentRootStatus } = targetUser.rows[0];

    // Only admin role can be set as root admin
    if (is_root_admin && role !== 'admin') {
      return res.status(400).json({ error: 'Chỉ tài khoản có vai trò Admin mới có thể được set làm Root Admin!' });
    }

    // KIỂM TRA NGHIÊM NGẶT: Chỉ cho phép set root admin cho tài khoản admin đầu tiên (ID nhỏ nhất)
    const firstAdmin = await pool.query(
      'SELECT id, username FROM users WHERE role = $1 ORDER BY id ASC LIMIT 1',
      ['admin']
    );
    
    if (firstAdmin.rows.length === 0 || parseInt(firstAdmin.rows[0].id) !== parseInt(userId)) {
      return res.status(403).json({ 
        error: `Chỉ tài khoản Admin đầu tiên (${firstAdmin.rows[0]?.username || 'N/A'}) mới có quyền Root Admin! Không thể thay đổi quyền này.` 
      });
    }

    // Không cho phép hủy quyền root admin
    if (!is_root_admin && currentRootStatus) {
      return res.status(403).json({ 
        error: 'Không thể hủy quyền Root Admin của tài khoản gốc!' 
      });
    }

    // Update the is_root_admin flag
    await pool.query(
      'UPDATE users SET is_root_admin = $1 WHERE id = $2',
      [is_root_admin, userId]
    );

    return res.json({ 
      success: true, 
      message: `Đã cấp quyền Root Admin cho tài khoản ${username} thành công!` 
    });
  } catch (err) { 
    console.error("Lỗi POST /api/users/set-root-admin:", err);
    return res.status(500).json({ error: "Lỗi hệ thống khi cập nhật quyền Root Admin: " + err.message }); 
  }
});

export { router as usersRouter };
