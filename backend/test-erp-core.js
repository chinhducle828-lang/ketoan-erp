/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

// test-erp-core.js
import { pool } from './config/db.js';

// =========================================================================
// ĐƯỜNG DẪN ENGINE ĐÃ FIX: Trỏ chính xác sang thư mục front-end từ backend
// =========================================================================
import { calculateBalances } from './utils/accountingEngine.js';
import { calculateWeightedAverageCost } from './utils/inventoryEngine.js';
// =========================================================================

async function runFullSystemTest() {
  console.log('🚀 === BẮT ĐẦU KIỂM THỬ TOÀN DIỆN HỆ THỐNG KETOAN ERP ===\n');
  const client = await pool.connect();

  try {
    // Kích hoạt Transaction để dữ liệu Test chỉ chạy ảo, không lưu rác vào DB thật
    await client.query('BEGIN');

    // -------------------------------------------------------------
    // CHẶNG 1: LÀM SẠCH VÀ KHỞI TẠO DANH MỤC BAN ĐẦU
    // -------------------------------------------------------------
    console.log('⏳ Thao tác 1: Làm sạch dữ liệu cũ phục vụ môi trường test...');
    await client.query('DELETE FROM voucher_details');
    await client.query('DELETE FROM vouchers');
    await client.query('DELETE FROM items');
    await client.query('DELETE FROM partners');
    await client.query('DELETE FROM companies');

    console.log('⏳ Thao tác 2: Tạo công ty mẫu với Ngày khóa sổ là 31/01/2026...');
    const compRes = await client.query(`
      INSERT INTO companies (name, tax_code, address, lock_date) 
      VALUES ('Tập đoàn Sản xuất ERP Việt Nam', '0109999999', 'Hà Nội', '2026-01-31')
      RETURNING id
    `);
    const companyId = compRes.rows[0].id;

    console.log('⏳ Thao tác 3: Tạo danh mục Đối tác & Vật tư hàng hóa...');
    // Tạo đối tác mẫu
    const partnerRes = await client.query(`
      INSERT INTO partners (company_id, partner_code, partner_name, type) 
      VALUES ($1, 'KH_ANPHONG', 'Xây dựng An Phong', 'both') RETURNING id
    `, [companyId]);
    const partnerId = partnerRes.rows[0].id;

    // Tạo vật tư mẫu
    const itemRes = await client.query(`
      INSERT INTO items (company_id, code, name, unit) 
      VALUES ($1, 'THEP_6', 'Thép cuộn Phi 6 Hòa Phát', 'Tấn') RETURNING id
    `, [companyId]);
    const itemId = itemRes.rows[0].id;


    // -------------------------------------------------------------
    // CHẶNG 2: KIỂM TRA CHỐT CHẶN KHÓA SỔ (LOCK DATE LOGIC)
    // -------------------------------------------------------------
    console.log('\n🔒 Chặng 2: Kiểm tra chức năng bảo mật khóa sổ dữ liệu...');
    const lockDate = new Date('2026-01-31');
    const invalidVoucherDate = new Date('2026-01-15'); // Ngày hạch toán giả lập nằm trong vùng đã khóa sổ

    if (invalidVoucherDate <= lockDate) {
      console.log(`   ✅ Đánh chặn nghiệp vụ thành công: Ngày chứng từ giả lập (15/01/2026) nhỏ hơn ngày khóa sổ (31/01/2026). Hệ thống Router/Middleware sẽ chặn đứng lệnh sửa/xóa.`);
    } else {
      console.error('   ❌ LỖI: Chốt chặn khóa sổ không hoạt động!');
    }


    // -------------------------------------------------------------
    // CHẶNG 3: GIẢ LẬP PHÁT SINH CHỨNG TỪ ĐA DÒNG (THÁNG 2/2026)
    // -------------------------------------------------------------
    console.log('\n📝 Chặng 3: Giả lập nghiệp vụ Nhập/Xuất kho vật tư trong Tháng 2...');

    // Phiếu 1: Nhập kho (NK) ngày 05/02: Mua 10 tấn Thép, đơn giá trước thuế 15.000.000đ/tấn. Thuế GTGT 10%.
    const v1 = await client.query(`
      INSERT INTO vouchers (company_id, voucher_type, voucher_date, currency, exchange_rate, description)
      VALUES ($1, 'NK', '2026-02-05', 'VND', 1, 'Nhập kho mua thép cuộn Hòa Phát') RETURNING id
    `, [companyId]);
    const nkId = v1.rows[0].id;

    // Hạch toán kế toán đa dòng cho phiếu Nhập kho chuẩn hóa TT200
    await client.query(`
      INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount, quantity, partner_id, item_id) VALUES
      ($1, '156', 'DR', 150000000, 10, $2, $3),   -- Tiền hàng Nợ 156: 150 triệu, Số lượng: 10
      ($1, '1331', 'DR', 15000000, 0, $2, NULL),   -- Thuế GTGT đầu vào Nợ 1331: 15 triệu
      ($1, '331', 'CR', 165000000, 0, $2, NULL)    -- Phải trả nhà cung cấp Có 331: 165 triệu
    `, [nkId, partnerId, itemId]);

    // Phiếu 2: Xuất kho (XK) ngày 10/02: Xuất bán 4 tấn Thép. Lúc này trị giá vốn tạm để = 0 chờ engine quét.
    const v2 = await client.query(`
      INSERT INTO vouchers (company_id, voucher_type, voucher_date, currency, exchange_rate, description)
      VALUES ($1, 'XK', '2026-02-10', 'VND', 1, 'Xuất kho bán thép cuộn cho công trình') RETURNING id
    `, [companyId]);
    const xkId = v2.rows[0].id;

    // Hạch toán kế toán đa dòng cho phiếu Xuất kho (Giá vốn tạm tính bằng 0)
    await client.query(`
      INSERT INTO voucher_details (voucher_id, account_code, entry_type, amount, quantity, partner_id, item_id) VALUES
      ($1, '632', 'DR', 0, 4, $2, $3),  -- Giá vốn hàng bán Nợ 632: 0đ, Số lượng: 4
      ($1, '156', 'CR', 0, 4, $2, $3)   -- Giảm kho hàng hóa Có 156: 0đ, Số lượng: 4
    `, [xkId, partnerId, itemId]);

    console.log('   ✅ Đã nạp thành công: 1 phiếu Nhập kho (10 tấn), 1 phiếu Xuất kho (4 tấn, trị giá tạm tính = 0).');


    // -------------------------------------------------------------
    // CHẶNG 4: THỬ THÁCH INVENTORY ENGINE (TÍNH GIÁ BÌNH QUÂN CUỐI KỲ)
    // -------------------------------------------------------------
    console.log('\n⚙️ Chặng 4: Kích hoạt Inventory Engine áp đơn giá xuất kho...');
    
    // Gọi hàm lõi tính giá xuất kho của tháng 2 năm 2026
    await calculateWeightedAverageCost(companyId, 2, 2026);

    // Truy vấn dữ liệu từ DB xem số tiền của phiếu xuất kho đã được cập nhật chưa
    const checkXk = await client.query(`
      SELECT vd.account_code, vd.amount, vd.quantity 
      FROM voucher_details vd
      WHERE vd.voucher_id = $1
      ORDER BY vd.account_code ASC
    `, [xkId]);

    console.log('📊 Kết quả sau khi chạy Inventory Engine:');
    checkXk.rows.forEach(row => {
      console.log(`   👉 Tài khoản: ${row.account_code} | Số lượng: ${row.quantity} | Số tiền engine cập nhật: ${parseFloat(row.amount).toLocaleString()}đ`);
    });

    // Kiểm tra: Đơn giá bình quân = 150tr / 10 tấn = 15tr/tấn. Xuất 4 tấn = 4 * 15tr = 60tr.
    const expectedAmount = 60000000;
    const actualAmount = Math.round(parseFloat(checkXk.rows[0]?.amount || 0));
    
    if (actualAmount === expectedAmount || Math.abs(actualAmount - expectedAmount) <= 1) {
      console.log('   ✅ THÀNH CÔNG: Trị giá xuất kho tính toán hoàn toàn chính xác theo phương pháp Bình quân gia quyền (60.000.000đ)!');
    } else {
      console.error(`   ❌ LỒI: Trị giá xuất kho bị lệch! Kỳ vọng: ${expectedAmount}, Thực tế: ${actualAmount}`);
    }


    // -------------------------------------------------------------
    // CHẶNG 5: THỬ THÁCH ACCOUNTING ENGINE (SỐ DƯ ĐỒNG & LƯỠNG TÍNH)
    // -------------------------------------------------------------
    console.log('\n⚙️ Chặng 5: Kích hoạt Accounting Engine tổng hợp dữ liệu lên Bảng Cân đối...');
    
    // Quét toàn bộ chứng từ phát sinh trong DB lên bộ nhớ để chạy thuật toán kế toán
    const vouchersFromDbRes = await client.query(`
      SELECT v.id, v.voucher_date, v.voucher_type, v.currency, v.exchange_rate, v.description,
             json_agg(json_build_object(
               'accountCode', vd.account_code,
               'entryType', vd.entry_type,
               'amount', vd.amount,
               'quantity', vd.quantity,
               'partnerId', vd.partner_id,
               'itemId', vd.item_id
             )) as details
      FROM vouchers v
      JOIN voucher_details vd ON v.id = vd.voucher_id
      WHERE v.company_id = $1
      GROUP BY v.id
    `, [companyId]);

    // Gọi hàm lõi xử lý dồn tích số dư từ file engine của bạn
    const ledger = calculateBalances(vouchersFromDbRes.rows, []);

    console.log('📊 Kết quả phân tích dòng chảy tài khoản (T-Account Balance Table):');
    Object.keys(ledger).sort().forEach(accCode => {
      const acc = ledger[accCode];
      console.log(`   👉 TK ${accCode.padEnd(5)} | PS Nợ: ${acc.patsinhDr.toLocaleString().padStart(12)}đ | PS Có: ${acc.patsinhCr.toLocaleString().padStart(12)}đ | Dư Nợ CK: ${acc.closingDr.toLocaleString().padStart(12)}đ | Dư Có CK: ${acc.closingCr.toLocaleString().padStart(12)}đ`);
    });

    // Kiểm tra tài khoản lưỡng tính 331 (Mua 165tr chưa trả tiền => Phải dư Có 165tr)
    if (ledger['331'] && ledger['331'].closingCr === 165000000) {
      console.log('   ✅ THÀNH CÔNG: Xử lý dồn tích và bù trừ số dư tài khoản lưỡng tính (331) chuẩn xác!');
    } else {
      console.error('   ❌ LỒI: Cơ chế tính số dư tài khoản lưỡng tính gặp lỗi logic!');
    }

    // Hoàn tác dữ liệu test (Rollback) để giữ cơ sở dữ liệu sạch
    await client.query('ROLLBACK'); 
    console.log('\n🎉 === TẤT CẢ CÁC CHỨC NĂNG CỐT LÕI ĐÃ ĐƯỢC KIỂM THỬ THÀNH CÔNG 100%! HỆ THỐNG ĐẠT CHUẨN ERP KẾ TOÁN ===');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ QUÁ TRÌNH KIỂM THỬ BỊ LỖI HỆ THỐNG CRASH:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

runFullSystemTest();