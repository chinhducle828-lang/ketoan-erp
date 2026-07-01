import React, { useState } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { usePersistentState } from '../../utils/persistence.js';
import { Wallet, Plus, Trash2 } from 'lucide-react';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';

export default function CashManagement() {
  const { vouchers, createNewVoucher, removeVoucher } = useVouchers();
  const [form, setForm] = usePersistentState('cash-management-form', { date: '2026-01-01', desc: '', dr: '1111', cr: '131', amount: '' });

  const cashVouchers = vouchers.filter(v => v.voucher_type === 'Thu' || v.voucher_type === 'Chi');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const type = (form.dr === '1111' || form.dr === '1121') ? 'Thu' : 'Chi';
    await createNewVoucher({
      voucherDate: form.date,
      description: form.desc,
      accountDr: form.dr,
      accountCr: form.cr,
      amount: parseFloat(form.amount),
      type
    });
    setForm({ date: '2026-01-01', desc: '', dr: '1111', cr: '131', amount: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Wallet className="text-emerald-600" size={24} /> PHÂN HỆ QUỸ TIỀN MẶT & TIỀN GỬI NGÂN HÀNG</h1>
        <div className="flex items-center gap-2">
          <ExportExcelButton endpoint="cashbook" filename="So_Quy" label="Xuất sổ quỹ" />
          <ExportExcelButton endpoint="vouchers" filename="So_Nhat_Ky" label="Xuất nhật ký" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3 shadow-sm h-fit">
          <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" />
          <input type="text" placeholder="Nội dung nghiệp vụ..." value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" />
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="TK Nợ" value={form.dr} onChange={e => setForm({...form, dr: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl font-mono" />
            <input type="text" placeholder="TK Có" value={form.cr} onChange={e => setForm({...form, cr: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl font-mono" />
          </div>
          <input type="number" placeholder="Số tiền phát sinh (VND)..." value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" />
          <button type="submit" className="w-full bg-emerald-600 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1"><Plus size={14} /> Lập Phiếu Ghi Sổ</button>
        </form>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 col-span-2 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 font-bold border-b"><th className="p-3">Ngày</th><th className="p-3">Loại</th><th className="p-3">Định khoản</th><th className="p-3">Diễn giải</th><th className="p-3 text-right">Số tiền</th><th className="p-3 text-center">Hành động</th></tr>
            </thead>
            <tbody>
              {cashVouchers.map(v => (
                <tr key={v.id} className="border-b">
                  <td className="p-3">{v.voucher_date}</td><td className="p-3 font-bold">{v.voucher_type}</td><td className="p-3 font-mono text-emerald-700">{v.account_dr} / {v.account_cr}</td><td className="p-3">{v.description}</td><td className="p-3 text-right font-bold">{parseFloat(v.amount).toLocaleString()} đ</td>
                  <td className="p-3 text-center"><button onClick={() => removeVoucher(v.id)} className="text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}