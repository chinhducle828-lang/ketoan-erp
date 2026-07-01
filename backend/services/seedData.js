import { pool } from '../server.js';

export const seedDatabase = async () => {
  try {
    // Check if data already exists
    const userCheck = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCheck.rows[0].count) > 0) {
      console.log('ℹ️  Database already has data. Skipping seed.');
      return;
    }

    console.log('🌱 Seeding database with test data...');

    // Create admin user
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const adminResult = await pool.query(
      "INSERT INTO users (username, password, role, must_change_password, company_ids, staff_ids) VALUES ($1, $2, $3, $4, '{}', '{}') RETURNING id",
      ['admin', hashedPassword, 'admin', false]
    );
    const adminId = adminResult.rows[0].id;
    console.log('✅ Created admin user: admin / admin123');

    // Create test companies
    const company1 = await pool.query(
      'INSERT INTO companies (name, tax_code, address) VALUES ($1, $2, $3) RETURNING id',
      ['Công ty TNHH ABC', '0123456789', 'Hà Nội']
    );
    const company2 = await pool.query(
      'INSERT INTO companies (name, tax_code, address) VALUES ($1, $2, $3) RETURNING id',
      ['Công ty XYZ', '9876543210', 'TP.HCM']
    );
    console.log('✅ Created 2 test companies');

    // Create KTT users
    const ktt1Password = await bcrypt.hash('ktt123', 10);
    const ktt1 = await pool.query(
      'INSERT INTO users (username, password, role, must_change_password, company_ids, staff_ids, manager_id) VALUES ($1, $2, $3, $4, $5, \'{}\', NULL) RETURNING id',
      ['ktt1', ktt1Password, 'ktt', false, `{${company1.rows[0].id}}`]
    );
    console.log('✅ Created KTT user: ktt1 / ktt123');

    const ktt2Password = await bcrypt.hash('ktt123', 10);
    const ktt2 = await pool.query(
      'INSERT INTO users (username, password, role, must_change_password, company_ids, staff_ids, manager_id) VALUES ($1, $2, $3, $4, $5, \'{}\', NULL) RETURNING id',
      ['ktt2', ktt2Password, 'ktt', false, `{${company2.rows[0].id}}`]
    );
    console.log('✅ Created KTT user: ktt2 / ktt123');

    // Create NV users
    const nv1Password = await bcrypt.hash('nv123', 10);
    const nv1 = await pool.query(
      'INSERT INTO users (username, password, role, must_change_password, company_ids, staff_ids, manager_id) VALUES ($1, $2, $3, $4, $5, \'{}\', $6) RETURNING id',
      ['nv1', nv1Password, 'nv', false, `{${company1.rows[0].id}}`, ktt1.rows[0].id]
    );
    console.log('✅ Created NV user: nv1 / nv123 (under ktt1)');

    const nv2Password = await bcrypt.hash('nv123', 10);
    const nv2 = await pool.query(
      'INSERT INTO users (username, password, role, must_change_password, company_ids, staff_ids, manager_id) VALUES ($1, $2, $3, $4, $5, \'{}\', $6) RETURNING id',
      ['nv2', nv2Password, 'nv', false, `{${company2.rows[0].id}}`, ktt2.rows[0].id]
    );
    console.log('✅ Created NV user: nv2 / nv123 (under ktt2)');

    // Update staff_ids for KTTs
    await pool.query('UPDATE users SET staff_ids = $1 WHERE id = $2', [`{${nv1.rows[0].id}}`, ktt1.rows[0].id]);
    await pool.query('UPDATE users SET staff_ids = $1 WHERE id = $2', [`{${nv2.rows[0].id}}`, ktt2.rows[0].id]);

    // Create test items
    const items = [
      ['SP001', 'Sản phẩm A', 'Cái', company1.rows[0].id],
      ['SP002', 'Sản phẩm B', 'Cái', company1.rows[0].id],
      ['VT001', 'Vật tư X', 'Kg', company1.rows[0].id],
      ['SP003', 'Sản phẩm C', 'Cái', company2.rows[0].id],
    ];

    for (const [code, name, unit, companyId] of items) {
      await pool.query(
        'INSERT INTO items (code, name, unit, company_id, created_by) VALUES ($1, $2, $3, $4, $5)',
        [code, name, unit, companyId, adminId]
      );
    }
    console.log('✅ Created 4 test items');

    // Create test opening balances for 2026
    const openingBalances = [
      ['1111', 100000000, 0, company1.rows[0].id, 2026],
      ['1121', 50000000, 0, company1.rows[0].id, 2026],
      ['331', 0, 50000000, company1.rows[0].id, 2026],
      ['1111', 80000000, 0, company2.rows[0].id, 2026],
      ['331', 0, 30000000, company2.rows[0].id, 2026],
    ];

    for (const [accountCode, dr, cr, companyId, year] of openingBalances) {
      await pool.query(
        'INSERT INTO opening_balances (company_id, account_code, debit_balance, credit_balance, fiscal_year) VALUES ($1, $2, $3, $4, $5)',
        [companyId, accountCode, dr, cr, year]
      );
    }
    console.log('✅ Created test opening balances');

    // Create test vouchers for 2026
    const vouchers = [
      ['2026-01-05', 'Thu tiền bán hàng', '1111', '331', 10000000, 'Thu', company1.rows[0].id],
      ['2026-01-10', 'Chi trả tiền nhập hàng', '156', '1111', 5000000, 'Chi', company1.rows[0].id],
      ['2026-01-15', 'Thu tiền bán dịch vụ', '1121', '331', 15000000, 'Thu', company1.rows[0].id],
      ['2026-02-01', 'Mua vật tư', '156', '331', 8000000, 'Nhap', company1.rows[0].id],
      ['2026-02-10', 'Bán sản phẩm', '131', '511', 20000000, 'Xuat', company1.rows[0].id],
      ['2026-01-08', 'Thu tiền bán hàng', '1111', '331', 12000000, 'Thu', company2.rows[0].id],
      ['2026-01-20', 'Chi lương nhân viên', '6422', '1111', 7000000, 'Chi', company2.rows[0].id],
    ];

    for (const [date, desc, dr, cr, amount, type, companyId] of vouchers) {
      await pool.query(
        'INSERT INTO vouchers (company_id, voucher_date, description, account_dr, account_cr, amount, voucher_type, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [companyId, date, desc, dr, cr, amount, type, adminId]
      );
    }
    console.log('✅ Created 7 test vouchers');

    console.log('\n🎉 Database seeding completed successfully!');
    console.log('\n📋 Test Accounts:');
    console.log('  Admin: admin / admin123');
    console.log('  KTT 1: ktt1 / ktt123 (Công ty ABC)');
    console.log('  KTT 2: ktt2 / ktt123 (Công ty XYZ)');
    console.log('  NV 1:  nv1 / nv123 (under ktt1)');
    console.log('  NV 2:  nv2 / nv123 (under ktt2)');
    console.log('\n🏢 Companies:');
    console.log('  - Công ty TNHH ABC (ID: 1)');
    console.log('  - Công ty XYZ (ID: 2)');
    console.log('\n💡 You can now login with any of these accounts to test the system.\n');

  } catch (error) {
    console.error('❌ Error seeding database:', error.message);
  }
};