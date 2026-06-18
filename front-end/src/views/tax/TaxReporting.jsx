import React from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { Percent, Landmark } from 'lucide-react';

export default function TaxReporting() {
  const { vouchers } = useVouchers();

  let vatInput = 0;  // Thuế GTGT đầu vào được khấu trừ (1331)
  let vatOutput = 0; // Thuế GTGT đầu ra phải nộp (3331)

  vouchers.forEach(v => {
    if (v.account_dr === '1331') vatInput += parseFloat(v.amount);
    if (v.account_cr === '3331') vatOutput += parseFloat(v.amount);
  });

  const payableVat = vatOutput - vatInput;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Percent className="text-rose-600" size={24} /> TỜ KHAI TỔNG HỢP NGHĨA VỤ THUẾ GTGT (MẪU 01/GTGT)</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Thuế GTGT đầu vào tích lũy (TK 1331)</span>
          <h3 className="text-lg font-black text-emerald-600">{vatInput.toLocaleString()} đ</h3>
        </div>
        <div className="bg-white p-5 rounded-2xl border shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Thuế GTGT đầu ra phát sinh (TK 3331)</span>
          <h3 className="text-lg font-black text-orange-600">{vatOutput.toLocaleString()} đ</h3>
        </div>
        <div className="bg-white p-5 rounded-2xl border shadow-sm bg-slate-900 text-white">
          <span className="text-[10px] font-bold text-slate-400 uppercase block text-slate-400">Nghĩa vụ Thuế GTGT cuối kỳ phải nộp ngân sách</span>
          <h3 className="text-lg font-black text-white">{payableVat > 0 ? `${payableVat.toLocaleString()} đ` : '0 đ (Còn được khấu trừ chuyển kỳ sau)'}</h3>
        </div>
      </div>
    </div>
  );
}