import React, { useState } from 'react';
import api from '../../utils/api.js';
import { usePersistentState } from '../../utils/persistence.js';
import { ShieldCheck, Terminal } from 'lucide-react';

export default function Register({ onSwitch }) {
  const [form, setForm] = usePersistentState('register-form', { username: '', password: '' });
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/auth/register-admin', form);
      if (res.data.success) {
        setSuccess(true);
        setTimeout(() => onSwitch(), 2000);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi đăng ký');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm md:max-w-md bg-white p-5 sm:p-6 rounded-2xl shadow-xl space-y-6">
        <div className="text-center space-y-1">
          <div className="inline-flex p-3 bg-blue-50 text-blue-600 rounded-xl mb-2">
            <ShieldCheck size={24} />
          </div>
          <h1 className="text-base font-black text-slate-800 uppercase tracking-wider">Khởi tạo Hệ thống gốc</h1>
          <p className="text-xs text-slate-400">Đăng ký tài khoản Root Admin ban đầu</p>
        </div>

        {success && <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-semibold text-emerald-700">Khởi tạo Admin thành công! Đang chuyển hướng...</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <input 
              type="text" 
              required 
              placeholder="Tên đăng nhập hệ thống gốc (Ví dụ: admin)..." 
              value={form.username}
              onChange={e => setForm({...form, username: e.target.value})}
              className="w-full text-sm px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" 
            />
            <input 
              type="password" 
              required 
              placeholder="Mật khẩu bảo mật cấp cao..." 
              value={form.password}
              onChange={e => setForm({...form, password: e.target.value})}
              className="w-full text-sm px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none" 
            />
          </div>

          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl shadow-md transition-all">
            Kích hoạt tài khoản gốc
          </button>
        </form>

        <div className="border-t border-slate-100 pt-4 text-center">
          <button onClick={onSwitch} className="text-xs font-bold text-slate-500 hover:underline">
            Quay lại trang Đăng nhập
          </button>
        </div>
      </div>
    </div>
  );
}

// Register.jsx 