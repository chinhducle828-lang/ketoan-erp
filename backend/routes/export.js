import express from 'express';
import ExcelJS from 'exceljs';
import { pool } from '../server.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { canAccessCompany } from '../services/helpers.js';

const router = express.Router();

const styleHeader = (ws) => {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E40AF' } };
  row.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
};

const addRows = (ws, rows) => {
  rows.forEach(r => {
    const row = ws.addRow(r);
    row.eachCell(cell => { cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; });
    row.alignment = { vertical: 'middle' };
  });
};

// 1. Xuất Sổ Nhật ký chung (Bản Master-Detail đa dòng)
router.get('/vouchers', authenticate, async (req, res) => {
  try {
    const { company_id, year } = req.query;
    if (!company_id) return res.status(400).json({ error: 'Thiếu company_id' });
    if (req.user.role !== 'admin' && !(await canAccessCompany(req.user, company_id))) return res.status(403).json({ error: 'Không có quyền!' });

    const result = await pool.query(
      `SELECT 
        v.voucher_date, v.id, v.description, v.voucher_type,
        vd.account_code, vd.entry_type, vd.amount
       FROM vouchers v
       JOIN voucher_details vd ON v.id = vd.voucher_id
       WHERE v.company_id = $1 AND EXTRACT(YEAR FROM v.voucher_date) = $2 
       ORDER BY v.voucher_date, v.id, vd.entry_type DESC`,
      [company_id, year || 2026]
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('So_Nhat_Ky_Chung');
    ws.columns = [
      { header: 'Ngày', key: 'date', width: 14 },
      { header: 'Số CT', key: 'id', width: 8 },
      { header: 'Diễn giải', key: 'desc', width: 45 },
      { header: 'TK Nợ', key: 'dr', width: 10 },
      { header: 'TK Có', key: 'cr', width: 10 },
      { header: 'Số tiền', key: 'amount', width: 18, style: { numFmt: '#,##0' } },
      { header: 'Loại', key: 'type', width: 10 },
    ];
    styleHeader(ws);

    const formattedRows = result.rows.map(v => ({
      date: v.voucher_date ? new Date(v.voucher_date).toISOString().slice(0, 10) : '',
      id: v.id,
      desc: v.description,
      dr: v.entry_type === 'DR' ? v.account_code : '',
      cr: v.entry_type === 'CR' ? v.account_code : '',
      amount: Number(v.amount),
      type: v.voucher_type
    }));

    addRows(ws, formattedRows);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=So_Nhat_Ky_Chung_${company_id}_${year || 2026}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Xuất Sổ Quỹ tiền mặt
router.get('/cashbook', authenticate, async (req, res) => {
  try {
    const { company_id, year } = req.query;
    if (!company_id) return res.status(400).json({ error: 'Thiếu company_id' });
    if (req.user.role !== 'admin' && !(await canAccessCompany(req.user, company_id))) return res.status(403).json({ error: 'Không có quyền!' });

    const result = await pool.query(
      `SELECT 
        v.voucher_date, v.description,
        SUM(CASE WHEN vd.entry_type = 'DR' AND (vd.account_code LIKE '111%' OR vd.account_code LIKE '112%') THEN vd.amount ELSE 0 END) AS thu,
        SUM(CASE WHEN vd.entry_type = 'CR' AND (vd.account_code LIKE '111%' OR vd.account_code LIKE '112%') THEN vd.amount ELSE 0 END) AS chi
       FROM vouchers v
       JOIN voucher_details vd ON v.id = vd.voucher_id
       WHERE v.company_id = $1 AND EXTRACT(YEAR FROM v.voucher_date) = $2
       GROUP BY v.id, v.voucher_date, v.description
       HAVING SUM(CASE WHEN vd.account_code LIKE '111%' OR vd.account_code LIKE '112%' THEN 1 ELSE 0 END) > 0
       ORDER BY v.voucher_date, v.id`,
      [company_id, year || 2026]
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('So_Quy_Tien_Mat');
    ws.columns = [
      { header: 'Ngày', key: 'date', width: 14 },
      { header: 'Diễn giải', key: 'desc', width: 45 },
      { header: 'Thu', key: 'thu', width: 18, style: { numFmt: '#,##0' } },
      { header: 'Chi', key: 'chi', width: 18, style: { numFmt: '#,##0' } },
    ];
    styleHeader(ws);
    addRows(ws, result.rows.map(v => ({
      date: v.voucher_date ? new Date(v.voucher_date).toISOString().slice(0, 10) : '',
      desc: v.description,
      thu: Number(v.thu), chi: Number(v.chi)
    })));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=So_Quy_${company_id}_${year || 2026}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Xuất Danh mục vật tư (Giữ nguyên)
router.get('/items', authenticate, async (req, res) => {
  try {
    const { company_id } = req.query;
    if (!company_id) return res.status(400).json({ error: 'Thiếu company_id' });
    if (req.user.role !== 'admin' && !(await canAccessCompany(req.user, company_id))) return res.status(403).json({ error: 'Không có quyền!' });

    const result = await pool.query('SELECT code, name, unit FROM items WHERE company_id = $1 ORDER BY code', [company_id]);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Danh_Muc_Vat_Tu');
    ws.columns = [
      { header: 'Mã hàng', key: 'code', width: 15 },
      { header: 'Tên hàng', key: 'name', width: 40 },
      { header: 'ĐVT', key: 'unit', width: 10 },
    ];
    styleHeader(ws);
    addRows(ws, result.rows);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Danh_Muc_Vat_Tu_${company_id}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. Xuất Số dư đầu kỳ (Giữ nguyên)
router.get('/opening-balances', authenticate, async (req, res) => {
  try {
    const { company_id, year } = req.query;
    if (!company_id) return res.status(400).json({ error: 'Thiếu company_id' });
    if (req.user.role !== 'admin' && !(await canAccessCompany(req.user, company_id))) return res.status(403).json({ error: 'Không có quyền!' });

    const result = await pool.query(
      'SELECT account_code, debit_balance, credit_balance FROM opening_balances WHERE company_id = $1 AND fiscal_year = $2 ORDER BY account_code',
      [company_id, year || 2026]
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('So_Du_Dau_Ky');
    ws.columns = [
      { header: 'Mã TK', key: 'code', width: 12 },
      { header: 'Dư Nợ đầu kỳ', key: 'dr', width: 20, style: { numFmt: '#,##0' } },
      { header: 'Dư Có đầu kỳ', key: 'cr', width: 20, style: { numFmt: '#,##0' } },
    ];
    styleHeader(ws);
    addRows(ws, result.rows.map(r => ({ code: r.account_code, dr: Number(r.debit_balance), cr: Number(r.credit_balance) })));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=So_Du_Dau_Ky_${company_id}_${year || 2026}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. Xuất Danh sách nhân sự (Giữ nguyên)
router.get('/users', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.role, u.manager_id,
             COALESCE(array_agg(c.name) FILTER (WHERE c.name IS NOT NULL), '{}') as companies
      FROM users u
      LEFT JOIN user_companies uc ON uc.user_id = u.id
      LEFT JOIN companies c ON c.id = uc.company_id
      GROUP BY u.id
      ORDER BY u.id
    `);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Nhan_Su_He_Thong');
    ws.columns = [
      { header: 'ID', key: 'id', width: 6 },
      { header: 'Tên đăng nhập', key: 'username', width: 20 },
      { header: 'Vai trò', key: 'role', width: 10 },
      { header: 'Công ty được gán', key: 'companies', width: 40 },
      { header: 'KTT quản lý', key: 'manager', width: 20 },
    ];
    styleHeader(ws);
    addRows(ws, result.rows.map(r => ({
      id: r.id, username: r.username, role: r.role,
      companies: Array.isArray(r.companies) ? r.companies.join(', ') : '',
      manager: r.manager_id ? result.rows.find(u => u.id === r.manager_id)?.username || '' : ''
    })));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Nhan_Su_He_Thong.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 6. Xuất báo cáo Tài sản cố định (211)
router.get('/fixed-assets', authenticate, async (req, res) => {
  try {
    const { company_id, year } = req.query;
    if (!company_id) return res.status(400).json({ error: 'Thiếu company_id' });
    if (req.user.role !== 'admin' && !(await canAccessCompany(req.user, company_id))) return res.status(403).json({ error: 'Không có quyền!' });

    const result = await pool.query(
      `SELECT v.voucher_date, v.description, v.voucher_type, vd.account_code, vd.entry_type, vd.amount
       FROM vouchers v
       JOIN voucher_details vd ON v.id = vd.voucher_id
       WHERE v.company_id = $1 
         AND EXTRACT(YEAR FROM v.voucher_date) = $2
         AND v.id IN (SELECT DISTINCT voucher_id FROM voucher_details WHERE account_code LIKE '211%')
       ORDER BY v.voucher_date, v.id, vd.entry_type DESC`,
      [company_id, year || 2026]
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Tai_San_Co_Dinh');
    ws.columns = [
      { header: 'Ngày', key: 'date', width: 14 },
      { header: 'Diễn giải', key: 'desc', width: 50 },
      { header: 'TK Nợ', key: 'dr', width: 10 },
      { header: 'TK Có', key: 'cr', width: 10 },
      { header: 'Số tiền', key: 'amount', width: 18, style: { numFmt: '#,##0' } },
      { header: 'Loại', key: 'type', width: 10 },
    ];
    styleHeader(ws);
    addRows(ws, result.rows.map(v => ({
      date: v.voucher_date ? new Date(v.voucher_date).toISOString().slice(0, 10) : '',
      desc: v.description,
      dr: v.entry_type === 'DR' ? v.account_code : '',
      cr: v.entry_type === 'CR' ? v.account_code : '',
      amount: Number(v.amount),
      type: v.voucher_type
    })));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Tai_San_Co_Dinh_${company_id}_${year || 2026}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 7. Xuất báo cáo Chi phí sản xuất (154, 156)
router.get('/production-costs', authenticate, async (req, res) => {
  try {
    const { company_id, year } = req.query;
    if (!company_id) return res.status(400).json({ error: 'Thiếu company_id' });
    if (req.user.role !== 'admin' && !(await canAccessCompany(req.user, company_id))) return res.status(403).json({ error: 'Không có quyền!' });

    const result = await pool.query(
      `SELECT v.voucher_date, v.description, v.voucher_type, vd.account_code, vd.entry_type, vd.amount
       FROM vouchers v
       JOIN voucher_details vd ON v.id = vd.voucher_id
       WHERE v.company_id = $1 
         AND EXTRACT(YEAR FROM v.voucher_date) = $2
         AND v.id IN (SELECT DISTINCT voucher_id FROM voucher_details WHERE account_code LIKE '154%' OR account_code LIKE '156%')
       ORDER BY v.voucher_date, v.id, vd.entry_type DESC`,
      [company_id, year || 2026]
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Chi_Phi_San_Xuat');
    ws.columns = [
      { header: 'Ngày', key: 'date', width: 14 },
      { header: 'Diễn giải', key: 'desc', width: 50 },
      { header: 'TK Nợ', key: 'dr', width: 10 },
      { header: 'TK Có', key: 'cr', width: 10 },
      { header: 'Số tiền', key: 'amount', width: 18, style: { numFmt: '#,##0' } },
      { header: 'Loại', key: 'type', width: 10 },
    ];
    styleHeader(ws);
    addRows(ws, result.rows.map(v => ({
      date: v.voucher_date ? new Date(v.voucher_date).toISOString().slice(0, 10) : '',
      desc: v.description,
      dr: v.entry_type === 'DR' ? v.account_code : '',
      cr: v.entry_type === 'CR' ? v.account_code : '',
      amount: Number(v.amount),
      type: v.voucher_type
    })));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Chi_Phi_San_Xuat_${company_id}_${year || 2026}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 8. Xuất báo cáo Mua hàng & Nhập kho (156, 331, 1331)
router.get('/purchases', authenticate, async (req, res) => {
  try {
    const { company_id, year } = req.query;
    if (!company_id) return res.status(400).json({ error: 'Thiếu company_id' });
    if (req.user.role !== 'admin' && !(await canAccessCompany(req.user, company_id))) return res.status(403).json({ error: 'Không có quyền!' });

    const result = await pool.query(
      `SELECT v.voucher_date, v.description, v.voucher_type, vd.account_code, vd.entry_type, vd.amount
       FROM vouchers v
       JOIN voucher_details vd ON v.id = vd.voucher_id
       WHERE v.company_id = $1 
         AND EXTRACT(YEAR FROM v.voucher_date) = $2
         AND v.id IN (SELECT DISTINCT voucher_id FROM voucher_details WHERE account_code LIKE '156%' OR account_code LIKE '331%' OR account_code LIKE '1331%')
       ORDER BY v.voucher_date, v.id, vd.entry_type DESC`,
      [company_id, year || 2026]
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Mua_Hang_Nhap_Kho');
    ws.columns = [
      { header: 'Ngày', key: 'date', width: 14 },
      { header: 'Diễn giải', key: 'desc', width: 50 },
      { header: 'TK Nợ', key: 'dr', width: 10 },
      { header: 'TK Có', key: 'cr', width: 10 },
      { header: 'Số tiền', key: 'amount', width: 18, style: { numFmt: '#,##0' } },
      { header: 'Loại', key: 'type', width: 10 },
    ];
    styleHeader(ws);
    addRows(ws, result.rows.map(v => ({
      date: v.voucher_date ? new Date(v.voucher_date).toISOString().slice(0, 10) : '',
      desc: v.description,
      dr: v.entry_type === 'DR' ? v.account_code : '',
      cr: v.entry_type === 'CR' ? v.account_code : '',
      amount: Number(v.amount),
      type: v.voucher_type
    })));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Mua_Hang_Nhap_Kho_${company_id}_${year || 2026}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 9. Xuất báo cáo Bảng lương & Bảo hiểm (6422, 3341, 3383)
router.get('/payroll', authenticate, async (req, res) => {
  try {
    const { company_id, year } = req.query;
    if (!company_id) return res.status(400).json({ error: 'Thiếu company_id' });
    if (req.user.role !== 'admin' && !(await canAccessCompany(req.user, company_id))) return res.status(403).json({ error: 'Không có quyền!' });

    const result = await pool.query(
      `SELECT v.voucher_date, v.description, v.voucher_type, vd.account_code, vd.entry_type, vd.amount
       FROM vouchers v
       JOIN voucher_details vd ON v.id = vd.voucher_id
       WHERE v.company_id = $1 
         AND EXTRACT(YEAR FROM v.voucher_date) = $2
         AND v.id IN (SELECT DISTINCT voucher_id FROM voucher_details WHERE account_code LIKE '6421%' OR account_code LIKE '6422%' OR account_code LIKE '3341%' OR account_code LIKE '3383%')
       ORDER BY v.voucher_date, v.id, vd.entry_type DESC`,
      [company_id, year || 2026]
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Bang_Luong_Bao_Hiem');
    ws.columns = [
      { header: 'Ngày', key: 'date', width: 14 },
      { header: 'Diễn giải', key: 'desc', width: 50 },
      { header: 'TK Nợ', key: 'dr', width: 10 },
      { header: 'TK Có', key: 'cr', width: 10 },
      { header: 'Số tiền', key: 'amount', width: 18, style: { numFmt: '#,##0' } },
      { header: 'Loại', key: 'type', width: 10 },
    ];
    styleHeader(ws);
    addRows(ws, result.rows.map(v => ({
      date: v.voucher_date ? new Date(v.voucher_date).toISOString().slice(0, 10) : '',
      desc: v.description,
      dr: v.entry_type === 'DR' ? v.account_code : '',
      cr: v.entry_type === 'CR' ? v.account_code : '',
      amount: Number(v.amount),
      type: v.voucher_type
    })));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Bang_Luong_Bao_Hiem_${company_id}_${year || 2026}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 10. Xuất báo cáo Dòng tiền Dashboard
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const { company_id, year } = req.query;
    if (!company_id) return res.status(400).json({ error: 'Thiếu company_id' });
    if (req.user.role !== 'admin' && !(await canAccessCompany(req.user, company_id))) return res.status(403).json({ error: 'Không có quyền!' });

    const monthly = await pool.query(`
      SELECT 
        EXTRACT(MONTH FROM v.voucher_date)::int AS month,
        SUM(CASE WHEN v.voucher_type IN ('Thu','Nhap') THEN vd.amount ELSE 0 END) AS thu,
        SUM(CASE WHEN v.voucher_type IN ('Chi','Xuat') THEN vd.amount ELSE 0 END) AS chi
      FROM vouchers v
      JOIN voucher_details vd ON v.id = vd.voucher_id
      WHERE v.company_id = $1 AND EXTRACT(YEAR FROM v.voucher_date) = $2 AND vd.entry_type = 'DR'
      GROUP BY month
      ORDER BY month
    `, [company_id, year || 2026]);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Dashboard_Duong_Tien');
    ws.columns = [
      { header: 'Tháng', key: 'month', width: 10 },
      { header: 'Tổng Thu', key: 'thu', width: 20, style: { numFmt: '#,##0' } },
      { header: 'Tổng Chi', key: 'chi', width: 20, style: { numFmt: '#,##0' } },
      { header: 'Số dư', key: 'balance', width: 20, style: { numFmt: '#,##0' } },
    ];
    styleHeader(ws);
    addRows(ws, monthly.rows.map(r => ({
      month: `Tháng ${r.month}`,
      thu: Number(r.thu),
      chi: Number(r.chi),
      balance: Number(r.thu) - Number(r.chi)
    })));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Dashboard_Duong_Tien_${company_id}_${year || 2026}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export { router as exportRouter };