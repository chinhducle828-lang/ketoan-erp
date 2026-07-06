import React, { useState } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { Calculator, Trash2, Loader2, Plus } from 'lucide-react';
import { getDefaultCurrency } from '../../utils/accountingRules.js';

export default function FixedAssets() {
  const { vouchers, createNewVoucher, removeVoucher } = useVouchers();
  const { activeCompany } = useAuth();
  
  const [form, setForm] = useState({ id: '', name: '', originalPrice: '', date: new Date().toISOString().split('T')[0] });
  const [loading, setLoading] = useState(false);

  const assetVouchers = vouchers.filter(v => v.details?.some(d => d.accountCode?.startsWith('211') || d.accountCode?.startsWith('215')));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const price = Math.round(parseFloat(form.originalPrice) || 0);
    const companyId = activeCompany?.id ?? activeCompany;
    
    if (price <= 0 || !form.id.trim() || !form.name.trim()) return alert('Vui lòng nhập đầy đủ thông tin!');
    if (!companyId) return alert('Vui lòng chọn doanh nghiệp làm việc!');

    setLoading(true);
    const payload = {
      companyId: parseInt(companyId, 10),
      voucherDate: form.date,
      type: 'PK', // Phiếu Kế Toán Khác
      description: `Ghi tăng TSCĐ: ${form.name} (Mã: ${form.id})`,
      currency: getDefaultCurrency(),
      exchangeRate: 1,
      details: [
        { accountCode: '2111', entryType: 'DR', amount: price },
        { accountCode: '331', entryType: 'CR', amount: price } // Mặc định ghi nhận công nợ phải trả
      ]
    };

    try {
      await createNewVoucher(payload);
      alert('Đã ghi sổ Tài sản cố định thành công!');
      setForm({ id: '', name: '', originalPrice: '', date: new Date().toISOString().split('T')[0] });
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi khóa sổ hoặc kết nối máy chủ!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Calculator size={24} /></div>
        <div>
          <h1 className="text-xl font-black text-slate-800 uppercase">Quản Lý Tài Sản Cố Định</h1>
          <p className="text-xs text-slate-500">Ghi nhận TSCĐ Hữu hình, Vô hình & Tài sản sinh học (TT99/2025)</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Mã TS</label>
          <input type="text" value={form.id} onChange={e => setForm({...form, id: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl font-mono uppercase" required />
        </div>
        <div className="md:col-span-2">
          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Tên Tài sản</label>
          <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" required />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Nguyên giá (VND)</label>
          <input type="number" value={form.originalPrice} onChange={e => setForm({...form, originalPrice: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" required />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-xs py-2.5 rounded-xl flex justify-center items-center gap-2">
          {loading ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16} />} Ghi sổ Mua TSCĐ
        </button>
      </form>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden mt-6">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b font-bold text-slate-600 uppercase text-[10px]">
              <th className="p-3">Ngày</th><th className="p-3">Mô tả</th><th className="p-3 text-right">Định khoản hạch toán</th><th className="p-3 text-center">Xóa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {assetVouchers.map(v => (
              <tr key={v.id} className="hover:bg-slate-50/50">
                <td className="p-3 font-mono">{v.voucherDate?.slice(0, 10)}</td>
                <td className="p-3 text-slate-700 font-medium">{v.description}</td>
                <td className="p-3 font-mono text-right">
                  {v.details?.map((dt, idx) => (
                    <div key={idx}><span className={dt.entryType === 'DR' ? 'text-blue-600 font-bold' : 'text-amber-600 font-bold pl-3'}>{dt.entryType} {dt.accountCode}:</span> {Math.round(dt.amount).toLocaleString('vi-VN')}</div>
                  ))}
                </td>
                <td className="p-3 text-center">
                  <button onClick={() => removeVoucher(v.id).catch(e => alert(e.response?.data?.error || 'Lỗi khóa sổ!'))} className="text-slate-400 hover:text-rose-600 transition"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}