import React, { useState } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { BookOpenCheck, RefreshCw } from 'lucide-react';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';

export default function ClosingProcess() {
  const { vouchers, createNewVoucher } = useVouchers();
  const [log, setLog] = useState('');
  const [loading, setLoading] = useState(false);

  const executeClosing = async () => {
    setLoading(true);
    setLog('Đang bóc tách, dọn dẹp số liệu và quét sâu sổ chi tiết...');

    let rev = 0;   // Tổng doanh thu phát sinh bên Có TK 511
    let cogs = 0;  // Tổng giá vốn phát sinh bên Nợ TK 632
    let adminExp = 0; // Tổng chi phí quản lý phát sinh bên Nợ TK 642

    // CHỐT CHẶN BẢO MẬT: Chỉ quét các chứng từ phát sinh thực tế từ hoạt động Kinh doanh (Thu, Chi, Nhập, Xuất)
    // Loại bỏ hoàn toàn các chứng từ kết chuyển 'Khac' đã chạy trước đó để tránh lỗi trùng số liệu (Double Counting).
    const operationalVouchers = vouchers.filter(v => v.type !== 'Khac');

    operationalVouchers.forEach(v => {
      v.details?.forEach(d => {
        // 1. Cộng dồn doanh thu thực tế (Có 511)
        if (d.accountCode?.startsWith('511') && d.entryType === 'CR') {
          rev += Math.round(parseFloat(d.amount) || 0);
        }
        // 2. Cộng dồn giá vốn thực tế (Nợ 632)
        if (d.accountCode?.startsWith('632') && d.entryType === 'DR') {
          cogs += Math.round(parseFloat(d.amount) || 0);
        }
        // 3. Cộng dồn chi phí quản lý thực tế (Nợ 642)
        if (d.accountCode?.startsWith('642') && d.entryType === 'DR') {
          adminExp += Math.round(parseFloat(d.amount) || 0);
        }
      });
    });

    if (rev === 0 && cogs === 0 && adminExp === 0) {
      setLog('⚠️ Không tìm thấy phát sinh doanh thu hoặc chi phí hoạt động mới hợp lệ trong kỳ để kết chuyển.');
      setLoading(false);
      return;
    }

    try {
      // -------------------------------------------------------------
      // BÚT TOÁN 1: Kết chuyển Doanh thu thuần (Nợ 5111 / Có 911)
      // -------------------------------------------------------------
      if (rev > 0) {
        await createNewVoucher({
          voucherDate: '2026-12-31',
          description: 'Kết chuyển doanh thu thuần xác định kết quả kinh doanh cuối kỳ',
          type: 'Khac',
          details: [
            { accountCode: '5111', entryType: 'DR', amount: rev },
            { accountCode: '911', entryType: 'CR', amount: rev }
          ]
        });
      }

      // -------------------------------------------------------------
      // BÚT TOÁN 2: Kết chuyển Giá vốn hàng bán (Nợ 911 / Có 632)
      // -------------------------------------------------------------
      if (cogs > 0) {
        await createNewVoucher({
          voucherDate: '2026-12-31',
          description: 'Kết chuyển chi phí giá vốn hàng bán cuối kỳ',
          type: 'Khac',
          details: [
            { accountCode: '911', entryType: 'DR', amount: cogs },
            { accountCode: '632', entryType: 'CR', amount: cogs }
          ]
        });
      }

      // -------------------------------------------------------------
      // BÚT TOÁN 3: Kết chuyển Chi phí quản lý DN (Nợ 911 / Có 642)
      // -------------------------------------------------------------
      if (adminExp > 0) {
        await createNewVoucher({
          voucherDate: '2026-12-31',
          description: 'Kết chuyển chi phí quản lý doanh nghiệp cuối kỳ',
          type: 'Khac',
          details: [
            { accountCode: '911', entryType: 'DR', amount: adminExp },
            { accountCode: '642', entryType: 'CR', amount: adminExp }
          ]
        });
      }

      // -------------------------------------------------------------
      // BÚT TOÁN BỔ SUNG: Xác định Lợi nhuận sau thuế (Tài khoản 421)
      // -------------------------------------------------------------
      const netProfitOrLoss = rev - (cogs + adminExp);
      
      if (netProfitOrLoss !== 0) {
        const isProfit = netProfitOrLoss > 0;
        await createNewVoucher({
          voucherDate: '2026-12-31',
          description: isProfit 
            ? 'Kết chuyển thặng dư lợi nhuận kinh doanh phát sinh trong kỳ (Lãi ròng)' 
            : 'Kết chuyển thâm hụt kết quả kinh doanh phát sinh trong kỳ (Lỗ ròng)',
          type: 'Khac',
          details: isProfit 
            ? [
                { accountCode: '911', entryType: 'DR', amount: netProfitOrLoss },
                { accountCode: '4212', entryType: 'CR', amount: netProfitOrLoss }
              ]
            : [
                { accountCode: '4212', entryType: 'DR', amount: Math.abs(netProfitOrLoss) },
                { accountCode: '911', entryType: 'CR', amount: Math.abs(netProfitOrLoss) }
              ]
        });
      }

      // Xuất log tổng kết chi tiết cho kế toán trưởng giám sát
      const statusText = netProfitOrLoss >= 0 
        ? `🎉 LÃI RÒNG SAU THUẾ TRONG KỲ: ${netProfitOrLoss.toLocaleString('vi-VN')} đ` 
        : `📉 LỖ RÒNG KINH DOANH TRONG KỲ: ${Math.abs(netProfitOrLoss).toLocaleString('vi-VN')} đ`;

      setLog(`[HỆ THỐNG KẾT CHUYỂN HOÀN THÀNH]\n------------------------------------\n` +
             `✓ Kết chuyển Doanh thu (Nợ 5111 / Có 911): ${rev.toLocaleString('vi-VN')} đ\n` +
             `✓ Kết chuyển Giá vốn  (Nợ 911 / Có 632): ${cogs.toLocaleString('vi-VN')} đ\n` +
             `✓ Kết chuyển CP QLDN  (Nợ 911 / Có 642): ${adminExp.toLocaleString('vi-VN')} đ\n` +
             `------------------------------------\n▶ ${statusText}\n` +
             `👉 Sổ cái tài khoản kết quả (911) đã được làm sạch và đưa về số dư bằng 0.`);

    } catch (error) {
      console.error(error);
      setLog('⚠️ Đã xảy ra lỗi hệ thống khi phát hành chứng từ kết chuyển tự động.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <BookOpenCheck className="text-indigo-600" size={24} /> KHÓA SỔ TỰ ĐỘNG & KẾT CHUYỂN KINH DOANH CUỐI KỲ
        </h1>
        <ExportExcelButton endpoint="vouchers" filename="So_Nhật_Ký_Chung" label="Xuất nhật ký" />
      </div>
      
      <div className="bg-white p-6 rounded-2xl border shadow-sm max-w-xl space-y-4">
        <p className="text-xs text-slate-500 leading-relaxed">
          Hệ thống quét toàn bộ Sổ cái, tự động gom số dư tài khoản Doanh thu (511), Chi phí (632, 642) kết chuyển tự động sang 911 để xác định Thặng dư/Thâm hụt tài chính của doanh nghiệp pháp nhân.
        </p>
        
        <button 
          onClick={executeClosing} 
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-md transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 
          {loading ? 'Đang hạch toán kết chuyển...' : 'Chạy tiến trình kết chuyển khóa sổ'}
        </button>
        
        {log && (
          <div className="p-4 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl whitespace-pre-wrap leading-relaxed shadow-inner border border-slate-800">
            {log}
          </div>
        )}
      </div>
    </div>
  );
}