import React, { useState } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ShoppingBag, Plus, Loader2 } from 'lucide-react';

export default function PurchaseInventory() {
  const { createNewVoucher } = useVouchers();
  const { activeCompany } = useAuth();
  const [form, setForm] = useState({ item: '', amount: '', tax: '10' });
  const [loading, setLoading] = useState(false);

  const handlePurchase = async (e) => {
    e.preventDefault();
    const baseAmount = Math.round(parseFloat(form.amount) || 0);
    const taxRate = parseFloat(form.tax) || 0;
    const taxAmount = Math.round(baseAmount * (taxRate / 100));
    const totalPay = baseAmount + taxAmount;

    if (baseAmount <= 0 || !form.item.trim()) {
      alert('Vui lòng nhập tên hàng hóa và giá trị hợp lệ!');
      return;
    }

    const details = [
      { accountCode: '156', entryType: 'DR', amount: baseAmount }
    ];
    if (taxAmount > 0) {
      details.push({ accountCode: '1331', entryType: 'DR', amount: taxAmount });
    }
    details.push({ accountCode: '331', entryType: 'CR', amount: totalPay });

    setLoading(true);
    try {
      await createNewVoucher({
        companyId: activeCompany?.id || activeCompany || 1,
        voucherDate: new Date().toISOString().split('T')[0],
        type: 'MuaHang',
        description: `Mua hàng hóa/vật tư: ${form.item}`,
        details
      });
      setForm({ item: '', amount: '', tax: '10' });
      alert('Ghi sổ mua hàng thành công!');
    } catch (err) {
      alert('Lỗi hệ thống!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
        <ShoppingBag className="text-indigo-600" size={24} /> KẾ TOÁN MUA HÀNG
      </h1>
      
      <form onSubmit={handlePurchase} className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Mô tả vật tư / Hàng hóa</label>
          <input type="text" value={form.item} onChange={e => setForm({...form, item: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" required />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Giá trị mua trước thuế</label>
          <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" required />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Thuế suất GTGT đầu vào</label>
          <select value={form.tax} onChange={e => setForm({...form, tax: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl">
            <option value="0">0%</option>
            <option value="5">5%</option>
            <option value="10">10%</option>
          </select>
        </div>
        <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl flex justify-center items-center gap-1.5 transition">
          {loading ? <Loader2 size={16} className="animate-spin"/> : <Plus size={16} />} Ghi Nợ 156, 1331 / Có 331
        </button>
      </form>
    </div>
  );
}