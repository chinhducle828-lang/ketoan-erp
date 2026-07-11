/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * Script: fix_monthly_balances.js
 * 
 * Mục đích: Fix dữ liệu monthly_balances hiện có để bao gồm số dư đầu kỳ
 * 
 * Cách dùng:
 *   node scripts/fix_monthly_balances.js --company=1 --year=2026
 *   node scripts/fix_monthly_balances.js --company=1 --year=2026 --startMonth=3
 *   node scripts/fix_monthly_balances.js --all --year=2026
 *   node scripts/fix_monthly_balances.js --all --year=2026 --dry-run
 * 
 * Tham số:
 *   --company=<id>    : ID công ty cần fix
 *   --all             : Fix tất cả công ty
 *   --year=<năm>      : Năm tài chính cần fix (mặc định: 2026)
 *   --startMonth=<m>  : Tháng bắt đầu fix (mặc định: 1)
 *   --dry-run         : Chạy thử, không ghi vào DB
 *   --validate        : Chỉ validate, không rebuild
 */

import { pool } from '../config/db.js';
import { rebuildLedger, validateMonthlyBalances } from '../services/maintenance.service.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      params[key] = value || true;
    }
  }

  return params;
}

async function getAllCompanies() {
  const { rows } = await pool.query('SELECT id, name, tax_code FROM companies ORDER BY id');
  return rows;
}

async function main() {
  const params = parseArgs();
  const year = params.year ? Number(params.year) : 2026;
  const startMonth = params.startMonth ? Number(params.startMonth) : 1;
  const dryRun = Boolean(params['dry-run']);
  const validateOnly = Boolean(params.validate);

  console.log('='.repeat(70));
  console.log('FIX MONTHLY_BALANCES - Bổ sung số dư đầu kỳ');
  console.log('='.repeat(70));
  console.log(`Năm tài chính: ${year}`);
  console.log(`Tháng bắt đầu: ${startMonth}`);
  console.log(`Dry run: ${dryRun ? 'CÓ (không ghi DB)' : 'KHÔNG'}`);
  console.log(`Validate only: ${validateOnly ? 'CÓ' : 'KHÔNG'}`);
  console.log('-'.repeat(70));

  let companies = [];

  if (params.all) {
    companies = await getAllCompanies();
    console.log(`Tìm thấy ${companies.length} công ty trong hệ thống`);
  } else if (params.company) {
    const companyId = Number(params.company);
    const { rows } = await pool.query('SELECT id, name, tax_code FROM companies WHERE id = $1', [companyId]);
    if (rows.length === 0) {
      console.error(`❌ Không tìm thấy công ty ID = ${companyId}`);
      process.exit(1);
    }
    companies = rows;
  } else {
    console.error('❌ Yêu cầu tham số --company=<id> hoặc --all');
    console.error('   Ví dụ: node scripts/fix_monthly_balances.js --company=1 --year=2026');
    process.exit(1);
  }

  let totalSuccess = 0;
  let totalErrors = 0;

  for (const company of companies) {
    console.log(`\n📋 Công ty: ${company.name} (ID=${company.id}, MST=${company.tax_code})`);

    if (validateOnly) {
      // Chỉ validate
      try {
        const validation = await validateMonthlyBalances(company.id, year);
        console.log(`   Validation: ${validation.valid ? '✅ OK' : '❌ CÓ LỖI'}`);
        if (validation.errors.length > 0) {
          console.log(`   Lỗi (${validation.errors.length}):`);
          validation.errors.forEach(e => console.log(`     ❌ ${e}`));
        }
        if (validation.warnings.length > 0) {
          console.log(`   Cảnh báo (${validation.warnings.length}):`);
          validation.warnings.forEach(w => console.log(`     ⚠️  ${w}`));
        }
        if (validation.details) {
          console.log(`   Các tháng có dữ liệu: [${validation.details.months_present.join(', ')}]`);
        }
      } catch (error) {
        console.error(`   ❌ Lỗi validation: ${error.message}`);
        totalErrors++;
      }
    } else {
      // Rebuild
      try {
        if (dryRun) {
          console.log(`   🔍 Dry-run: Sẽ rebuild từ tháng ${startMonth} → 12`);
          // Kiểm tra dữ liệu hiện tại
          const { rows: currentData } = await pool.query(
            `SELECT month, COUNT(*) as rows, 
                    ROUND(SUM(closing_debit)::numeric, 2) as total_debit,
                    ROUND(SUM(closing_credit)::numeric, 2) as total_credit
             FROM monthly_balances 
             WHERE company_id = $1 AND year = $2 AND month >= $3
             GROUP BY month ORDER BY month`,
            [company.id, year, startMonth]
          );
          console.log(`   Dữ liệu hiện tại (tháng ${startMonth}→12):`);
          for (const row of currentData) {
            console.log(`     Tháng ${row.month}: ${row.rows} dòng, Nợ=${row.total_debit}, Có=${row.total_credit}`);
          }
        } else {
          const result = await rebuildLedger(company.id, year, startMonth);
          console.log(`   ✅ ${result.message}`);
          console.log(`   Tổng số dòng đã xử lý: ${result.monthCount}`);
          if (result.details && result.details.length > 0) {
            console.log(`   Chi tiết từng tháng:`);
            for (const detail of result.details) {
              console.log(`     Tháng ${detail.month}: ${detail.rows_affected} dòng (${detail.elapsed_ms}ms)`);
            }
          }
          totalSuccess++;
        }
      } catch (error) {
        console.error(`   ❌ Lỗi rebuild: ${error.message}`);
        totalErrors++;
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  if (validateOnly) {
    console.log(`📊 KẾT THÚC VALIDATION - ${companies.length} công ty`);
  } else if (dryRun) {
    console.log(`📊 KẾT THÚC DRY-RUN - ${companies.length} công ty (không có thay đổi)`);
  } else {
    console.log(`📊 KẾT THÚC REBUILD - Thành công: ${totalSuccess}, Lỗi: ${totalErrors}`);
  }
  console.log('='.repeat(70));

  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});