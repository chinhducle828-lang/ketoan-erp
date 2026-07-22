/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import express from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { pool } from '../config/db.js';
import { authenticate, checkCompanyAccess } from '../middleware/auth.js';
import { invalidateCache } from '../cache/redis.js';
import { invalidateCompanyCache } from '../controllers/erpController.js';
import { emitVoucherRealtime } from '../services/voucherRealtime.service.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/**
 * Validate Excel file structure
 */
function validateExcelStructure(workbook, expectedHeaders) {
  const ws = workbook.getWorksheet(1);
  if (!ws) {
    return { valid: false, error: 'File Excel không có worksheet nào!' };
  }

  const headerRow = ws.getRow(1);
  const actualHeaders = headerRow.values.slice(1).filter(v => v); // Remove first null value
  
  const missingHeaders = expectedHeaders.filter(h => !actualHeaders.includes(h));
  if (missingHeaders.length > 0) {
    return {
      valid: false,
      error: `Thiếu các cột bắt buộc: ${missingHeaders.join(', ')}`
    };
  }

  return { valid: true, ws, headers: actualHeaders };
}

/**
 * Parse voucher row from Excel
 */
function parseVoucherRow(row, rowNumber, headers) {
  const data = {};
  
  headers.forEach((header, index) => {
    const cell = row.getCell(index + 1);
    data[header] = cell.value;
  });

  return {
    rowNumber,
    data,
    errors: []
  };
}

/**
 * Validate voucher data
 */
function validateVoucherData(parsedRow, companyId) {
  const { data, rowNumber } = parsedRow;
  const errors = [];

  // Required fields
  if (!data['Ngày']) {
    errors.push(`Dòng ${rowNumber}: Thiếu ngày chứng từ`);
  }
  if (!data['Loại']) {
    errors.push(`Dòng ${rowNumber}: Thiếu loại chứng từ (PT/PC/NK/XK/PKT)`);
  }
  if (!data['TK Nợ'] && !data['TK Có']) {
    errors.push(`Dòng ${rowNumber}: Thiếu mã tài khoản Nợ hoặc Có`);
  }
  if (!data['Số tiền']) {
    errors.push(`Dòng ${rowNumber}: Thiếu số tiền`);
  }

  // Validate voucher type
  const validTypes = ['PT', 'PC', 'NK', 'XK', 'PKT'];
  if (data['Loại'] && !validTypes.includes(data['Loại'].toString().toUpperCase())) {
    errors.push(`Dòng ${rowNumber}: Loại chứng từ không hợp lệ (chỉ chấp nhận: PT, PC, NK, XK, PKT)`);
  }

  // Validate amount
  const amount = parseFloat(data['Số tiền']);
  if (isNaN(amount) || amount <= 0) {
    errors.push(`Dòng ${rowNumber}: Số tiền phải là số dương`);
  }

  // Validate account codes
  const drAccount = data['TK Nợ']?.toString().trim();
  const crAccount = data['TK Có']?.toString().trim();
  
  if (drAccount && !/^\d{3,}$/.test(drAccount)) {
    errors.push(`Dòng ${rowNumber}: Mã TK Nợ không hợp lệ (phải có ít nhất 3 chữ số)`);
  }
  if (crAccount && !/^\d{3,}$/.test(crAccount)) {
    errors.push(`Dòng ${rowNumber}: Mã TK Có không hợp lệ (phải có ít nhất 3 chữ số)`);
  }

  return errors;
}

/**
 * POST /api/import/vouchers
 * Import chứng từ từ Excel
 */
router.post('/vouchers', authenticate, checkCompanyAccess, upload.single('file'), async (req, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.companyId;

    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng chọn tệp Excel chứng từ!' });
    }

    // Đọc file Excel
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    // Validate structure
    const expectedHeaders = ['Ngày', 'Loại', 'TK Nợ', 'TK Có', 'Số tiền', 'Diễn giải'];
    const validation = validateExcelStructure(workbook, expectedHeaders);
    
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const { ws } = validation;
    const totalRows = ws.rowCount - 1; // Exclude header
    const results = {
      success: 0,
      failed: 0,
      errors: [],
      details: []
    };

    await client.query('BEGIN');

    // Process each row
    ws.eachRow(async (row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const parsedRow = parseVoucherRow(row, rowNumber, validation.headers);
      const validationErrors = validateVoucherData(parsedRow, companyId);

      if (validationErrors.length > 0) {
        results.failed++;
        results.errors.push(...validationErrors);
        results.details.push({
          row: rowNumber,
          status: 'failed',
          errors: validationErrors
        });
        return;
      }

      // Insert voucher
      try {
        const voucherType = parsedRow.data['Loại'].toString().toUpperCase();
        const voucherDate = parsedRow.data['Ngày'];
        const description = parsedRow.data['Diễn giải'] || '';
        const amount = parseFloat(parsedRow.data['Số tiền']);
        const drAccount = parsedRow.data['TK Nợ']?.toString().trim();
        const crAccount = parsedRow.data['TK Có']?.toString().trim();

        // Create voucher
        const voucherQuery = `
          INSERT INTO vouchers (company_id, voucher_number, voucher_date, voucher_type, description, currency, exchange_rate, created_by, is_posted)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
        `;
        
        const voucherNumber = `${voucherType}-${Date.now().toString().slice(-6)}-${rowNumber}`;
        const voucherResult = await client.query(voucherQuery, [
          companyId,
          voucherNumber,
          voucherDate,
          voucherType,
          description,
          'VND',
          1,
          req.user?.id || null,
          false
        ]);

        const voucherId = voucherResult.rows[0].id;

        // Create voucher details
        const detailQuery = `
          INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount)
          VALUES ($1, $2, $3, $4)
        `;

        await client.query(detailQuery, [voucherId, drAccount, 'DR', amount]);
        await client.query(detailQuery, [voucherId, crAccount, 'CR', amount]);

        results.success++;
        results.details.push({
          row: rowNumber,
          status: 'success',
          voucherNumber,
          voucherId
        });

      } catch (err) {
        results.failed++;
        results.errors.push(`Dòng ${rowNumber}: ${err.message}`);
        results.details.push({
          row: rowNumber,
          status: 'failed',
          errors: [err.message]
        });
      }
    });

    await client.query('COMMIT');

    // Emit realtime event
    if (results.success > 0) {
      emitVoucherRealtime('created', {
        companyId: Number(companyId),
        userId: req.user?.id || null,
        clientInstanceId: req.headers['x-client-instance-id'] || null,
        imported: true,
        count: results.success
      });
    }

    // ĐỒNG BỤ CACHE ĐA TẦNG
    await invalidateCache(`dashboard:cashflow:${companyId}:*`);
    invalidateCompanyCache(companyId);

    res.json({
      success: true,
      message: `Nhập Excel hoàn tất! Thành công: ${results.success}, Thất bại: ${results.failed}`,
      summary: results
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi nhập Excel:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * GET /api/import/template/:type
 * Download template Excel cho import
 */
router.get('/template/:type', authenticate, async (req, res) => {
  try {
    const { type } = req.params;
    
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Template');

    let columns = [];
    let filename = '';

    switch (type) {
      case 'vouchers':
        columns = [
          { header: 'Ngày (YYYY-MM-DD)', key: 'date', width: 15 },
          { header: 'Loại (PT/PC/NK/XK/PKT)', key: 'type', width: 20 },
          { header: 'TK Nợ', key: 'drAccount', width: 12 },
          { header: 'TK Có', key: 'crAccount', width: 12 },
          { header: 'Số tiền', key: 'amount', width: 15 },
          { header: 'Diễn giải', key: 'description', width: 50 }
        ];
        filename = 'Template_Chung_Tu.xlsx';
        break;

      case 'inventory':
        columns = [
          { header: 'Mã hàng', key: 'itemCode', width: 15 },
          { header: 'Tên hàng', key: 'itemName', width: 40 },
          { header: 'ĐVT', key: 'unit', width: 10 },
          { header: 'Số lượng', key: 'quantity', width: 12 },
          { header: 'Đơn giá', key: 'unitPrice', width: 15 },
          { header: 'TK Nợ', key: 'drAccount', width: 12 },
          { header: 'TK Có', key: 'crAccount', width: 12 }
        ];
        filename = 'Template_Ton_Kho.xlsx';
        break;

      case 'users':
        columns = [
          { header: 'Username', key: 'username', width: 20 },
          { header: 'Password', key: 'password', width: 20 },
          { header: 'Role (admin/ktt/nv/gd_kinhdoanh)', key: 'role', width: 25 },
          { header: 'Email', key: 'email', width: 30 },
          { header: 'Phone', key: 'phone', width: 15 }
        ];
        filename = 'Template_Nhan_Su.xlsx';
        break;

      case 'items':
        columns = [
          { header: 'Mã hàng', key: 'code', width: 15 },
          { header: 'Tên hàng', key: 'name', width: 40 },
          { header: 'ĐVT', key: 'unit', width: 10 },
          { header: 'Nhóm', key: 'group', width: 20 }
        ];
        filename = 'Template_Vat_Tu.xlsx';
        break;

      case 'opening-balances':
        columns = [
          { header: 'Mã TK', key: 'accountCode', width: 12 },
          { header: 'Dư Nợ đầu kỳ', key: 'debitBalance', width: 20 },
          { header: 'Dư Có đầu kỳ', key: 'creditBalance', width: 20 }
        ];
        filename = 'Template_So_Du_Dau_Ky.xlsx';
        break;

      default:
        return res.status(400).json({ error: 'Loại template không hợp lệ' });
    }

    ws.columns = columns;

    // Add example row
    const exampleRow = ws.addRow({});
    columns.forEach((col, index) => {
      const cell = exampleRow.getCell(index + 1);
      cell.value = `[Ví dụ: ${col.header}]`;
      cell.font = { italic: true, color: { argb: '999999' } };
    });

    // Style header
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E40AF' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    await wb.xlsx.write(res);
    res.end();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/import/inventory
 * Import inventory từ Excel
 */
router.post('/inventory', authenticate, upload.single('file'), async (req, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.body.companyId || req.query.company_id;
    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu mã đơn vị doanh nghiệp!' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng chọn tệp Excel!' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const ws = workbook.getWorksheet(1);

    if (!ws) {
      return res.status(400).json({ error: 'File Excel không hợp lệ!' });
    }

    await client.query('BEGIN');
    let successCount = 0;
    const errors = [];

    ws.eachRow(async (row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      try {
        const code = row.getCell(1).value?.toString().trim();
        const name = row.getCell(2).value?.toString().trim();
        const unit = row.getCell(3).value?.toString().trim();

        if (!code || !name) {
          errors.push(`Dòng ${rowNumber}: Thiếu mã hoặc tên hàng`);
          return;
        }

        // Kiểm tra xem mã đã tồn tại chưa
        const existingItem = await client.query(
          'SELECT code, name FROM items WHERE company_id = $1 AND code = $2',
          [companyId, code]
        );

        if (existingItem.rows.length === 0) {
          // Mã chưa tồn tại -> Insert bình thường
          await client.query(
            'INSERT INTO items (company_id, code, name, unit) VALUES ($1, $2, $3, $4)',
            [companyId, code, name, unit || 'Cái']
          );
        } else {
          // Mã đã tồn tại
          const existingName = existingItem.rows[0].name;
          
          if (existingName === name) {
            // Tên trùng khớp -> Cập nhật thông tin
            await client.query(
              'UPDATE items SET name = $3, unit = $4 WHERE company_id = $1 AND code = $2',
              [companyId, code, name, unit || 'Cái']
            );
          } else {
            // Tên khác -> Tạo mã mới với hậu tố số
            let newCode = code;
            let counter = 1;
            
            // Tìm mã mới chưa tồn tại
            while (true) {
              const candidateCode = `${code}-${counter}`;
              const candidateExists = await client.query(
                'SELECT code FROM items WHERE company_id = $1 AND code = $2',
                [companyId, candidateCode]
              );
              
              if (candidateExists.rows.length === 0) {
                newCode = candidateCode;
                break;
              }
              
              // Kiểm tra nếu mã candidate đã có tên trùng với tên mới
              const candidateItem = await client.query(
                'SELECT name FROM items WHERE company_id = $1 AND code = $2',
                [companyId, candidateCode]
              );
              
              if (candidateItem.rows.length > 0 && candidateItem.rows[0].name === name) {
                // Đã có sản phẩm cùng tên với mã candidate -> cập nhật
                await client.query(
                  'UPDATE items SET unit = $4 WHERE company_id = $1 AND code = $2',
                  [companyId, candidateCode, name, unit || 'Cái']
                );
                newCode = candidateCode;
                break;
              }
              
              counter++;
            }
            
            // Insert sản phẩm mới với mã đã được xử lý
            await client.query(
              'INSERT INTO items (company_id, code, name, unit) VALUES ($1, $2, $3, $4)',
              [companyId, newCode, name, unit || 'Cái']
            );
          }
        }

        successCount++;
      } catch (err) {
        errors.push(`Dòng ${rowNumber}: ${err.message}`);
      }
    });

    await client.query('COMMIT');

    await invalidateCache(`items:${companyId}:*`);
    invalidateCompanyCache(companyId);

    res.json({
      success: true,
      message: `Nhập ${successCount} vật tư thành công!`,
      successCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

/**
 * POST /api/import/opening-balances
 * Import số dư đầu kỳ
 */
router.post('/opening-balances', authenticate, upload.single('file'), async (req, res) => {
  const client = await pool.connect();
  try {
    const companyId = req.body.companyId || req.query.company_id;
    const fiscalYear = req.body.year || req.query.year || new Date().getFullYear();

    if (!companyId) {
      return res.status(400).json({ error: 'Thiếu mã đơn vị doanh nghiệp!' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng chọn tệp Excel!' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const ws = workbook.getWorksheet(1);

    if (!ws) {
      return res.status(400).json({ error: 'File Excel không hợp lệ!' });
    }

    await client.query('BEGIN');
    let successCount = 0;
    const errors = [];

    // Clear existing opening balances for this year
    await client.query('DELETE FROM opening_balances WHERE company_id = $1 AND fiscal_year = $2', [companyId, fiscalYear]);

    ws.eachRow(async (row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      try {
        const accountCode = row.getCell(1).value?.toString().trim();
        const debitBalance = parseFloat(row.getCell(2).value) || 0;
        const creditBalance = parseFloat(row.getCell(3).value) || 0;

        if (!accountCode) {
          errors.push(`Dòng ${rowNumber}: Thiếu mã tài khoản`);
          return;
        }

        if (debitBalance === 0 && creditBalance === 0) {
          return; // Skip empty rows
        }

        await client.query(
          'INSERT INTO opening_balances (company_id, fiscal_year, account_code, debit_balance, credit_balance) VALUES ($1, $2, $3, $4, $5)',
          [companyId, fiscalYear, accountCode, debitBalance, creditBalance]
        );

        successCount++;
      } catch (err) {
        errors.push(`Dòng ${rowNumber}: ${err.message}`);
      }
    });

    await client.query('COMMIT');

    await invalidateCache(`opening-balances:${companyId}:${fiscalYear}:*`);
    invalidateCompanyCache(companyId);

    res.json({
      success: true,
      message: `Nhập ${successCount} số dư đầu kỳ thành công!`,
      successCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
export { router as importRouter };