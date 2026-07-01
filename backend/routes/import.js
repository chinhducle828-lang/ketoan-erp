import express from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { pool } from '../server.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { canAccessCompany } from '../services/helpers.js';
import { invalidateCache } from '../cache/redis.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file Excel (.xlsx, .xls)'));
    }
  },
});

// Helper function to parse Excel file
const parseExcelFile = async (fileBuffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);
  const worksheet = workbook.getWorksheet(1); // Get first worksheet
  
  const headers = [];
  const rows = [];
  
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell) => {
        headers.push(cell.value?.toString().trim() || '');
      });
    } else {
      const rowData = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          rowData[header] = cell.value;
        }
      });
      if (Object.keys(rowData).length > 0) {
        rows.push(rowData);
      }
    }
  });
  
  return { headers, rows };
};

// 1. Nhập Danh mục vật tư từ Excel
router.post('/items', authenticate, requireRole(['admin', 'ktt']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Vui lòng chọn file Excel để nhập.' });
    
    const companyId = req.body.company_id;
    if (!companyId) return res.status(400).json({ error: 'Thiếu company_id' });
    
    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, companyId);
      if (!hasAccess) return res.status(403).json({ error: 'Không có quyền!' });
    }

    const { rows } = await parseExcelFile(req.file.buffer);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const row of rows) {
      try {
        const code = row['Mã hàng'] || row['code'] || row['Mã'];
        const name = row['Tên hàng'] || row['name'] || row['Tên'];
        const unit = row['ĐVT'] || row['unit'] || row['Đơn vị'];

        if (!code || !name || !unit) {
          errorCount++;
          errors.push(`Dòng thiếu thông tin: ${JSON.stringify(row)}`);
          continue;
        }

        await pool.query(
          'INSERT INTO items (code, name, unit, company_id, created_by) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (code, company_id) DO UPDATE SET name = EXCLUDED.name, unit = EXCLUDED.unit',
          [code.toUpperCase().trim(), name.trim(), unit.trim(), companyId, req.user.id]
        );
        successCount++;
      } catch (err) {
        errorCount++;
        errors.push(`Lỗi nhập ${row['Mã hàng'] || row['code']}: ${err.message}`);
      }
    }

    res.json({ 
      success: true, 
      message: `Nhập thành công ${successCount} dòng, lỗi ${errorCount} dòng.`,
      details: { successCount, errorCount, errors: errors.slice(0, 10) }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Nhập Số dư đầu kỳ từ Excel
router.post('/opening-balances', authenticate, requireRole(['admin', 'ktt']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Vui lòng chọn file Excel để nhập.' });
    
    const companyId = req.body.company_id;
    const year = req.body.year || 2026;
    
    if (!companyId) return res.status(400).json({ error: 'Thiếu company_id' });
    
    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, companyId);
      if (!hasAccess) return res.status(403).json({ error: 'Không có quyền!' });
    }

    const { rows } = await parseExcelFile(req.file.buffer);
    
    let successCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      try {
        const accountCode = row['Mã TK'] || row['account_code'] || row['Mã tài khoản'];
        const debitBalance = parseFloat(row['Dư Nợ đầu kỳ'] || row['debit_balance'] || 0);
        const creditBalance = parseFloat(row['Dư Có đầu kỳ'] || row['credit_balance'] || 0);

        if (!accountCode) {
          errorCount++;
          continue;
        }

        await pool.query(
          `INSERT INTO opening_balances (company_id, account_code, debit_balance, credit_balance, fiscal_year)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (company_id, account_code, fiscal_year)
           DO UPDATE SET debit_balance = $3, credit_balance = $4`,
          [companyId, accountCode, debitBalance || 0, creditBalance || 0, year]
        );
        successCount++;
      } catch (err) {
        errorCount++;
      }
    }

    // Invalidate dashboard cache
    await invalidateCache(`dashboard:cashflow:${companyId}:*`);
    
    res.json({ 
      success: true, 
      message: `Nhập số dư đầu kỳ thành công ${successCount} dòng, lỗi ${errorCount} dòng.`,
      details: { successCount, errorCount }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Nhập Chứng từ hạch toán từ Excel
router.post('/vouchers', authenticate, requireRole(['admin', 'ktt']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Vui lòng chọn file Excel để nhập.' });
    
    const companyId = req.body.company_id;
    const year = req.body.year || 2026;
    
    if (!companyId) return res.status(400).json({ error: 'Thiếu company_id' });
    
    if (req.user.role !== 'admin') {
      const hasAccess = await canAccessCompany(req.user, companyId);
      if (!hasAccess) return res.status(403).json({ error: 'Không có quyền!' });
    }

    const { rows } = await parseExcelFile(req.file.buffer);
    
    let successCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      try {
        const voucherDate = row['Ngày'] || row['date'] || row['voucher_date'];
        const description = row['Diễn giải'] || row['description'] || row['Nội dung'];
        const accountDr = row['TK Nợ'] || row['account_dr'] || row['Tài khoản nợ'];
        const accountCr = row['TK Có'] || row['account_cr'] || row['Tài khoản có'];
        const amount = parseFloat(row['Số tiền'] || row['amount'] || 0);
        const voucherType = row['Loại'] || row['type'] || row['voucher_type'] || 'Khac';

        if (!voucherDate || !description || !accountDr || !accountCr || !amount) {
          errorCount++;
          continue;
        }

        await pool.query(
          `INSERT INTO vouchers (company_id, voucher_date, description, account_dr, account_cr, amount, voucher_type, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [companyId, voucherDate, description, accountDr, accountCr, amount, voucherType, req.user.id]
        );
        successCount++;
      } catch (err) {
        errorCount++;
      }
    }

    // Invalidate dashboard cache
    await invalidateCache(`dashboard:cashflow:${companyId}:*`);
    
    res.json({ 
      success: true, 
      message: `Nhập chứng từ thành công ${successCount} dòng, lỗi ${errorCount} dòng.`,
      details: { successCount, errorCount }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export { router as importRouter };