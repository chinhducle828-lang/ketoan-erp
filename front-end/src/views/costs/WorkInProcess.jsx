import React, { useState } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { BookOpenCheck, Layers } from 'lucide-react';

export default function WorkInProcess() {
  const { vouchers, createNewVoucher } = useVouchers();
  const [wipAmount, setWipAmount] = useState('');

  const materialCosts = vouchers.filter(v => v.account_dr === '154').reduce((sum, v) => sum + parseFloat(v.amount), 0);

  const handleProductIn = async () => {
    if (!wipAmount) return;
    await createNewVoucher({
      voucherDate: '2026-06-30',
      description: 'Nhập kho thành phẩm hoàn thành từ xưởng sản xuất dở dang',
      accountDr: '156', accountCr: '154', amount: parseFloat(wipAmount), type: 'Khac'
    });
    setWipAmount('');
    alert('Đã hạch toán nhập kho thành phẩm hoàn thành (Nợ 156 / Có 154)!');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><BookOpenCheck className="text-sky-600" size={24} /> TẬP HỢP CHI PHÍ & TÍNH GIÁ THÀNH SẢN XUẤT DỞ DANG (154)</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-sky-50 text-sky-600 rounded-xl"><Layers size={24} /></div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block">Tổng chi phí sản xuất đã tập hợp trong kỳ (Nợ 154)</span>
            <h3 className="text-lg font-black text-slate-800">{materialCosts.toLocaleString()} đ</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border shadow-sm space-y-3">
          <h4 className="text-xs font-bold text-slate-700 uppercase">Hạch toán hoàn thành nhập kho thành phẩm</h4>
          <input type="number" placeholder="Giá trị thành phẩm hoàn thành (VND)..." value={wipAmount} onChange={e => setWipAmount(e.target.value)} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" />
          <button onClick={handleProductIn} className="bg-sky-600 text-white font-bold text-xs px-4 py-2 rounded-xl">Kết chuyển Nợ 156 / Có 154</button>
        </div>
      </div>
    </div>
  );
}