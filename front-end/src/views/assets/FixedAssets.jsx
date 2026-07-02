import React, { useState } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { Calculator, Trash2, Loader2, Plus } from 'lucide-react';

export default function FixedAssets() {
  const { vouchers, createNewVoucher, removeVoucher } = useVouchers();
  const { activeCompany } = useAuth();
  
  const [form, setForm] = useState({ id: '', name: '', originalPrice: '', date: new Date().toISOString().split('T')[0] });
  const [loading, setLoading] = useState(false);

  const assetVouchers = vouchers.filter(v => v.details?.some(d => d.accountCode?.startsWith('211')));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const price = Math.round(parseFloat(form.originalPrice) || 0);
    
    if (price <= 0 || !form.id.trim() || !form.name.trim()) return alert('Vui lòng nhập đầy đủ thông tin!');

    setLoading(true);
    const payload = {
      companyId: activeCompany?.id || activeCompany || 1,
      voucherDate: form.date,
      type: 'TSCD',
      description: `Ghi tăng TSCĐ: ${form.name} (Mã: ${form.id})`,
      details: [
        { accountCode: '2111', entryType: 'DR', amount: price },
        { accountCode: '331', entryType: 'CR', amount: price }
      ]
    };

    try {
      await createNewVoucher(payload);
      setForm({ ...form, id: '', name: '', originalPrice: '' });
    } catch (err) {
      alert('Lỗi ghi sổ TSCĐ!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Calculator className="text-amber-600" size={24} /> QUẢN LÝ TÀI SẢN CỐ ĐỊNH</h1>
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border shadow-sm max-w-xl space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <input type="text" placeholder="Mã TS..." value={form.id} onChange={e => setForm({...form, id: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" required />
          <input type="text" placeholder="Tên Tài sản..." value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <input type="number" placeholder="Nguyên giá (VND)..." value={form.originalPrice} onChange={e => setForm({...form, originalPrice: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" required />
          <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" required />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2.5 rounded-xl flex justify-center items-center gap-1.5 transition">
          {loading ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16} />} Ghi sổ Mua TSCĐ
        </button>
      </form>

      {/* Hiển thị danh sách chứng từ Tài sản */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mt-6">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b font-bold text-slate-600">
              <th className="p-3">Ngày</th><th className="p-3">Mô tả</th><th className="p-3">Định khoản</th><th className="p-3 text-center">Xóa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {assetVouchers.map(v => (
              <tr key={v.id} className="hover:bg-slate-50/50">
                <td className="p-3 font-mono">{v.voucher_date?.slice(0, 10)}</td>
                <td className="p-3">{v.description}</td>
                <td className="p-3 font-mono">
                  {v.details?.map((dt, idx) => (
                    <div key={idx}><span className={dt.entryType === 'DR' ? 'text-blue-600' : 'text-amber-600 pl-3'}>{dt.entryType} {dt.accountCode}:</span> {dt.amount.toLocaleString()} đ</div>
                  ))}
                </td>
                <td className="p-3 text-center"><button onClick={() => removeVoucher(v.id)} className="text-slate-400 hover:text-rose-600"><Trash2 size={14}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}