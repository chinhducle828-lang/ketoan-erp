import React, { useState } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { BookOpenCheck, RefreshCw } from 'lucide-react';

export default function ClosingProcess() {
  const { vouchers, createNewVoucher } = useVouchers();
  const [log, setLog] = useState('');

  const executeClosing = async () => {
    setLog('Đang bóc tách tổng doanh thu (511) và giá vốn (632)...');
    
    let rev = 0, cogs = 0;
    vouchers.forEach(v => {
      if (v.account_cr === '5111') rev += parseFloat(v.amount);
      if (v.account_dr === '632') cogs += parseFloat(v.amount);
    });

    // Phát sinh bút toán kết chuyển tự động
    if (rev > 0) {
      await createNewVoucher({
        voucherDate: '2026-12-31',
        description: 'Kết chuyển doanh thu thuần xác định kết quả kinh doanh cuối kỳ',
        accountDr: '5111', accountCr: '911', amount: rev, type: 'Khac'
      });
    }
    if (cogs > 0) {
      await createNewVoucher({
        voucherDate: '2026-12-31',
        description: 'Kết chuyển chi phí giá vốn hàng bán cuối kỳ',
        accountDr: '911', accountCr: '632', amount: cogs, type: 'Khac'
      });
    }

    setLog(`Khóa sổ thành công! Đã tự động sinh bút toán kết chuyển doanh thu ${rev.toLocaleString()} đ và giá vốn ${cogs.toLocaleString()} đ sang tài khoản 911.`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><BookOpenCheck className="text-indigo-600" size={24} /> KHÓA SỔ TỰ ĐỘNG & KẾT CHUYỂN KINH DOANH CUỐI KỲ</h1>
      <div className="bg-white p-6 rounded-2xl border shadow-sm max-w-xl space-y-4">
        <p className="text-xs text-slate-500 leading-relaxed">Hệ thống quét toàn bộ Sổ cái, tự động gom số dư tài khoản Doanh thu (511), Chi phí (632, 642) kết chuyển tự động sang 911 để xác định Thặng dư/Thâm hụt tài chính của doanh nghiệp pháp nhân.</p>
        <button onClick={executeClosing} className="bg-indigo-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-md"><RefreshCw size={14} /> Chạy tiến trình kết chuyển khóa sổ</button>
        {log && <div className="p-4 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl whitespace-pre-wrap">{log}</div>}
      </div>
    </div>
  );
}