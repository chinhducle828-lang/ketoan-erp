import React, { useState } from 'react';
import { Package, Plus, Trash2 } from 'lucide-react';

export default function ItemManagement() {
  const [items, setItems] = useState([
    { code: 'VT001', name: 'Thép cuộn xây dựng Hòa Phát F10', unit: 'Tấn' },
    { code: 'HH002', name: 'Xi măng Hoàng Thạch P400', unit: 'Bao' }
  ]);
  const [form, setForm] = useState({ code: '', name: '', unit: 'Cái' });

  const handleAdd = (e) => {
    e.preventDefault();
    setItems([...items, form]);
    setForm({ code: '', name: '', unit: 'Cái' });
  };

  const handleDelete = (code) => {
    if (!window.confirm(`Xóa sản phẩm "${code}"? Hành động này không thể hoàn tác.`)) return;
    setItems(items.filter(i => i.code !== code));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Package className="text-amber-600" size={24} /> DANH MỤC MÃ VẬT TƯ, SẢN PHẨM HÀNG HÓA TỒN KHO</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <form onSubmit={handleAdd} className="bg-white p-5 rounded-2xl border shadow-sm space-y-3 h-fit">
          <input type="text" placeholder="Mã vật tư..." required value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" />
          <input type="text" placeholder="Tên quy cách vật tư..." required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" />
          <input type="text" placeholder="Đơn vị tính..." required value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" />
          <button type="submit" className="w-full bg-amber-600 text-white font-bold text-xs py-2.5 rounded-xl">Đăng ký mã mới</button>
        </form>
        <div className="bg-white p-5 rounded-2xl border shadow-sm col-span-2">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 font-bold border-b"><th className="p-2">Mã SKU</th><th className="p-2">Tên vật tư hàng hóa</th><th className="p-2">ĐVT</th><th className="p-2 text-center">Hành động</th></tr>
            </thead>
            <tbody>
              {items.map(i => (
                <tr key={i.code} className="border-b hover:bg-slate-50/50 transition"><td className="p-2 font-mono font-bold text-slate-600">{i.code}</td><td className="p-2">{i.name}</td><td className="p-2">{i.unit}</td><td className="p-2 text-center"><button onClick={() => handleDelete(i.code)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition" title="Xóa sản phẩm"><Trash2 size={16} /></button></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}