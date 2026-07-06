import React, { useState } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ShoppingBag, Loader2 } from 'lucide-react';
import { buildPurchaseInventoryDetails, getDefaultCurrency, getDefaultTaxRate } from '../../utils/accountingRules.js';

export default function PurchaseInventory() {
  const { createNewVoucher } = useVouchers();
  const { activeCompany } = useAuth();
  const [form, setForm] = useState({ item: '', amount: '', tax: String(getDefaultTaxRate() * 100), quantity: '1', partnerId: '', unitCost: '' });
  const [loading, setLoading] = useState(false);

  const handlePurchase = async (e) => {
    e.preventDefault();
    const companyId = activeCompany?.id ?? activeCompany;
    const baseAmount = Math.round(parseFloat(form.amount) || 0);
    const quantity = Math.max(1, Number(form.quantity || 1));
    const taxRate = parseFloat(form.tax) || 0;

    if (baseAmount <= 0 || !form.item.trim()) return alert('Vui lòng nhập tên hàng hóa và giá trị hợp lệ!');
    if (!companyId) return alert('Vui lòng chọn doanh nghiệp!');

    setLoading(true);
    const details = buildPurchaseInventoryDetails({
      baseAmount,
      quantity,
      partnerId: form.partnerId || null,
      itemName: form.item,
      taxRate
    });

    const payload = {
      companyId: parseInt(companyId, 10),
      voucherDate: new Date().toISOString().split('T')[0],
      type: 'NK',
      description: `Mua vật tư / hàng hóa: ${form.item}`,
      currency: getDefaultCurrency(),
      exchangeRate: 1,
      details: details
    };

    try {
      await createNewVoucher(payload);
      alert('Đã ghi sổ nhập kho hàng hóa thành công!');
      setForm({ item: '', amount: '', tax: String(getDefaultTaxRate() * 100), quantity: '1', partnerId: '', unitCost: '' });
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi hệ thống!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl p-6 bg-white rounded-3xl border border-slate-100 shadow-sm mx-auto mt-6">
      <div className="flex items-center gap-3 mb-6">
        <ShoppingBag className="text-indigo-600" size={24} />
        <h2 className="font-black text-slate-800 text-lg uppercase">Nhập Kho Mua Hàng Nhanh</h2>
      </div>
      <form onSubmit={handlePurchase} className="space-y-4">
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Mô tả vật tư / Hàng hóa</label>
          <input type="text" value={form.item} onChange={e => setForm({...form, item: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl outline-none" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Giá trị trước thuế (VND)</label>
            <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl outline-none" required />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Thuế suất GTGT</label>
            <select value={form.tax} onChange={e => setForm({...form, tax: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl outline-none">
              <option value="0">0%</option><option value="5">5%</option><option value="10">10%</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Số lượng</label>
            <input type="number" min="1" value={form.quantity} onChange={e => setForm({...form, quantity: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl outline-none" required />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Đơn giá / đơn vị</label>
            <input type="number" value={form.unitCost || form.amount} onChange={e => setForm({...form, unitCost: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl outline-none" required />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Đối tác công nợ (tuỳ chọn)</label>
          <input type="number" value={form.partnerId} onChange={e => setForm({...form, partnerId: e.target.value})} placeholder="ID đối tác" className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl outline-none" />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl flex justify-center items-center mt-2 transition">
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Ghi sổ Phiếu Nhập Kho'}
        </button>
      </form>
    </div>
  );
}