import React, { useMemo } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

export default function CashFlowDashboard() {
  const { vouchers } = useVouchers();

  // Bóc tách Dòng tiền Dựa vào Loại Phiếu
  const { inFlow, outFlow, cashVouchers } = useMemo(() => {
    let thu = 0, chi = 0;
    const history = [];

    vouchers.forEach(v => {
      // Xác định số tiền của phiếu dựa vào vế Nợ / Có của các tài khoản Tiền (111, 112)
      let amount = 0;
      if (v.details && Array.isArray(v.details)) {
        v.details.forEach(dt => {
          if (dt.accountCode?.startsWith('111') || dt.accountCode?.startsWith('112')) {
            if (dt.entryType === 'DR') {
              thu += parseFloat(dt.amount || 0);
              amount = parseFloat(dt.amount || 0);
            } else if (dt.entryType === 'CR') {
              chi += parseFloat(dt.amount || 0);
              amount = parseFloat(dt.amount || 0);
            }
          }
        });
      }
      
      if (v.type === 'PT' || v.type === 'PC') {
        history.push({ ...v, calculatedAmount: amount });
      }
    });

    return { inFlow: thu, outFlow: chi, cashVouchers: history };
  }, [vouchers]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><DollarSign className="text-emerald-500"/> TỔNG QUAN DÒNG TIỀN QUỸ</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex items-center gap-4">
          <div className="p-4 bg-emerald-100 text-emerald-600 rounded-full"><TrendingUp size={32}/></div>
          <div>
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Tổng Dòng Tiền Vào (Inflow)</p>
            <h2 className="text-3xl font-black text-emerald-800 mt-1">{inFlow.toLocaleString('vi-VN')} đ</h2>
          </div>
        </div>
        <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 flex items-center gap-4">
          <div className="p-4 bg-rose-100 text-rose-600 rounded-full"><TrendingDown size={32}/></div>
          <div>
            <p className="text-xs font-bold text-rose-600 uppercase tracking-widest">Tổng Dòng Tiền Ra (Outflow)</p>
            <h2 className="text-3xl font-black text-rose-800 mt-1">{outFlow.toLocaleString('vi-VN')} đ</h2>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-50 border-b font-bold text-slate-600 text-xs uppercase tracking-wider">Lịch sử thu chi gần đây</div>
        <table className="w-full text-left text-xs">
          <tbody className="divide-y divide-slate-100">
            {cashVouchers.slice(0, 10).map((v, idx) => (
              <tr key={v.id || idx} className="hover:bg-slate-50">
                <td className="p-3 font-mono text-slate-500">{v.voucherDate?.split('T')[0]}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${v.type === 'PT' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{v.type}</span>
                </td>
                <td className="p-3">{v.description}</td>
                <td className="p-3 text-right font-bold">{v.calculatedAmount.toLocaleString('vi-VN')} đ</td>
              </tr>
            ))}
            {cashVouchers.length === 0 && <tr><td colSpan="4" className="p-6 text-center text-slate-400">Chưa có phát sinh quỹ.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}