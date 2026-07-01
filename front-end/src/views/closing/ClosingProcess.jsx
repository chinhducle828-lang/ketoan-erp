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
    setLog('Đang bóc tách tổng doanh thu (511) và giá vốn (632) từ sổ chi tiết chi tiết...');
    
    let rev = 0;   // Tổng doanh thu phát sinh bên Có TK 511
    let cogs = 0;  // Tổng giá vốn phát sinh bên Nợ TK 632

    // SỬA LOGIC DUYỆT SÂU: Quét sâu vào mảng details của từng chứng từ
    vouchers.forEach(v => {
      v.details?.forEach(d => {
        // Cộng dồn doanh thu phát sinh (Có 511)
        if (d.accountCode?.startsWith('511') && d.entryType === 'CR') {
          rev += parseFloat(d.amount) || 0;
        }
        // Cộng dồn giá vốn phát sinh (Nợ 632)
        if (d.accountCode?.startsWith('632') && d.entryType === 'DR') {
          cogs += parseFloat(d.amount) || 0;
        }
      });
    });

    if (rev === 0 && cogs === 0) {
      setLog('⚠️ Không tìm thấy phát sinh doanh thu (511) hoặc giá vốn (632) hợp lệ trong kỳ để kết chuyển.');
      setLoading(false);
      return;
    }

    try {
      // 1. Phát hành bút toán kết chuyển Doanh thu: Nợ 5111 / Có 911
      if (rev > 0) {
        const revDetails = [
          { accountCode: '5111', entryType: 'DR', amount: rev },
          { accountCode: '911', entryType: 'CR', amount: rev }
        ];
        
        await createNewVoucher({
          voucherDate: '2026-12-31',
          description: 'Kết chuyển doanh thu thuần xác định kết quả kinh doanh cuối kỳ',
          type: 'Khac',
          details: revDetails
        });
      }

      // 2. Phát hành bút toán kết chuyển Giá vốn: Nợ 911 / Có 632
      if (cogs > 0) {
        const cogsDetails = [
          { accountCode: '911', entryType: 'DR', amount: cogs },
          { accountCode: '632', entryType: 'CR', amount: cogs }
        ];

        await createNewVoucher({
          voucherDate: '2026-12-31',
          description: 'Kết chuyển chi phí giá vốn hàng bán cuối kỳ',
          type: 'Khac',
          details: cogsDetails
        });
      }

      // Tính toán nhanh Lãi/Lỗ gộp để hiển thị lên log cho trực quan
      const profitOrLoss = rev - cogs;
      const statusText = profitOrLoss >= 0 ? `LÃI GỘP KINH DOANH: ${profitOrLoss.toLocaleString()} đ` : `LỖ GỘP KINH DOANH: ${Math.abs(profitOrLoss).toLocaleString()} đ`;

      setLog(`[HỆ THỐNG KẾT CHUYỂN HOÀN THÀNH]\n------------------------------------\n` +
             `✓ Kết chuyển Doanh thu (Nợ 5111 / Có 911): ${rev.toLocaleString()} đ\n` +
             `✓ Kết chuyển Giá vốn (Nợ 911 / Có 632): ${cogs.toLocaleString()} đ\n` +
             `------------------------------------\n▶ ${statusText}`);

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