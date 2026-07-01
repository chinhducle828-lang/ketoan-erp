import React, { useState } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { usePersistentState } from '../../utils/persistence.js';
import { Calculator, Plus, Trash2, Landmark, CheckCircle2 } from 'lucide-react';

export default function FixedAssets() {
  const { vouchers, createNewVoucher, removeVoucher } = useVouchers();
  const [assets, setAssets] = useState([]);
  const [form, setForm] = usePersistentState('fixed-assets-form', { id: '', name: '', originalPrice: '', life: 60, deptCode: '6422', date: '2026-01-01' });
  const [msg, setMsg] = useState('');

  const assetVouchers = vouchers.filter(v => v.account_dr === '211' || v.account_cr === '211');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const price = parseFloat(form.originalPrice);
    setAssets([...assets, { ...form, originalPrice: price, life: parseInt(form.life) }]);

    const res = await createNewVoucher({
      voucherDate: form.date,
      description: `Ghi tăng TSCĐ: ${form.name}`,
      accountDr: '211',
      accountCr: '331',
      amount: price,
      type: 'Khac'
    });

    if (res.success) {
      setMsg('Ghi tăng và hạch toán tự động Nợ 211 / Có 331 thành công!');
      setTimeout(() => setMsg(''), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Calculator className="text-emerald-600" size={24} /> PHÂN HỆ TÀI SẢN CỐ ĐỊNH & KHẤU HAO (211 - 214)</h1>
      </div>
      {msg && <div className="p-3 bg-emerald-50 text-emerald-800 border rounded-xl text-xs">{msg}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm h-fit">
          <input type="text" placeholder="Mã tài sản..." required value={form.id} onChange={e => setForm({...form, id: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" />
          <input type="text" placeholder="Tên tài sản..." required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" />
          <input type="number" placeholder="Nguyên giá..." required value={form.originalPrice} onChange={e => setForm({...form, originalPrice: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" />
          <button type="submit" className="w-full bg-emerald-600 text-white font-bold text-xs py-2.5 rounded-xl"><Plus size={14} className="inline mr-1" /> Thêm & Sinh Chứng Từ</button>
        </form>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 col-span-2 shadow-sm">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Sổ theo dõi tài sản</h3>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 font-bold">
                <th className="p-2">Mã</th><th className="p-2">Tên tài sản</th><th className="p-2 text-right">Nguyên giá</th>
              </tr>
            </thead>
            <tbody>
              {assets.map(a => (
                <tr key={a.id} className="border-t">
                  <td className="p-2 font-mono">{a.id}</td><td className="p-2">{a.name}</td><td className="p-2 text-right">{a.originalPrice.toLocaleString()} đ</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}