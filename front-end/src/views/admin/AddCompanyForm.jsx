import React, { useState } from 'react';
import api from '../../utils/api.js';
import { Plus } from 'lucide-react';

export default function AddCompanyForm({ onRefresh }) {
  const [form, setForm] = useState({ name: '', taxCode: '', address: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/companies', form);
      setForm({ name: '', taxCode: '', address: '' });
      onRefresh();
    } catch (err) {
      alert('Không thể thêm pháp nhân mới.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
      <h2 className="text-xs font-black text-slate-400 uppercase tracking-wider">Khai báo pháp nhân doanh nghiệp mới</h2>
      <div className="space-y-3">
        <input 
          type="text" 
          required 
          placeholder="Tên doanh nghiệp đầy đủ..." 
          value={form.name}
          onChange={e => setForm({...form, name: e.target.value})}
          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" 
        />
        <input 
          type="text" 
          required 
          placeholder="Mã số thuế pháp nhân..." 
          value={form.taxCode}
          onChange={e => setForm({...form, taxCode: e.target.value})}
          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" 
        />
        <input 
          type="text" 
          placeholder="Địa chỉ trụ sở đăng ký..." 
          value={form.address}
          onChange={e => setForm({...form, address: e.target.value})}
          className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" 
        />
      </div>
      <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1">
        <Plus size={14} /> Thêm pháp nhân mới
      </button>
    </form>
  );
}

// AddCompanyForm.jsx 