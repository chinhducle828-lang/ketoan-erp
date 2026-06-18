import React, { useState } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { ShoppingBag, Plus } from 'lucide-react';

export default function PurchaseInventory() {
  const { createNewVoucher } = useVouchers();
  const [form, setForm] = useState({ item: '', amount: '', tax: '10' });

  const handlePurchase = async (e) => {
    e.preventDefault();
    const baseAmount = parseFloat(form.amount);
    const taxAmount = Math.round(baseAmount * (parseFloat(form.tax) / 100));
    const totalPay = baseAmount + taxAmount;

    // Hạch toán tiền mua hàng hóa nguyên vật liệu nhập kho
    await createNewVoucher({
      voucherDate: '2026-01-15',
      description: `Nhập kho vật tư hàng hóa: ${form.item}`,
      accountDr: '156', accountCr: '331', amount: baseAmount, type: 'Nhap'
    });

    // Hạch toán thuế GTGT đầu vào được khấu trừ
    if (taxAmount > 0) {
      await createNewVoucher({
        voucherDate: '2026-01-15',
        description: `Thuế GTGT đầu vào được khấu trừ của hóa đơn mua hàng ${form.item}`,
        accountDr: '1331', accountCr: '331', amount: taxAmount, type: 'Khac'
      });
    }

    alert(`Đã hạch toán nhập kho hàng hóa. Tổng số tiền phải trả nhà cung cấp (331): ${totalPay.toLocaleString()} đ`);
    setForm({ item: '', amount: '', tax: '10' });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><ShoppingBag className="text-emerald-600" size={24} /> PHÂN HỆ MUA HÀNG VÀ HẠCH TOÁN VẬT TƯ NHẬP KHO</h1>
      <form onSubmit={handlePurchase} className="bg-white p-5 rounded-2xl border shadow-sm max-w-md space-y-3">
        <input type="text" placeholder="Tên nguyên vật liệu / Hàng hóa nhập kho..." value={form.item} onChange={e => setForm({...form, item: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" />
        <input type="number" placeholder="Giá trị mua trước thuế (VND)..." value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" />
        <select value={form.tax} onChange={e => setForm({...form, tax: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl">
          <option value="0">Thuế suất GTGT: 0%</option>
          <option value="5">Thuế suất GTGT: 5%</option>
          <option value="10">Thuế suất GTGT: 10%</option>
        </select>
        <button type="submit" className="w-full bg-emerald-600 text-white font-bold text-xs py-2.5 rounded-xl"><Plus size={14} className="inline mr-1" /> Phát hành chứng từ mua kho</button>
      </form>
    </div>
  );
}