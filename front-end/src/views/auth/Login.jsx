import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Lock, User, Terminal } from 'lucide-react';

export default function Login({ onFirstRun }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(form.username, form.password);
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể kết nối đến máy chủ.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm bg-white p-6 rounded-2xl shadow-xl space-y-6">
        <div className="text-center space-y-1">
          <div className="inline-flex p-3 bg-emerald-50 text-emerald-600 rounded-xl mb-2">
            <Terminal size={24} />
          </div>
          <h1 className="text-base font-black text-slate-800 uppercase tracking-wider">Hệ thống hạch toán ERP</h1>
          <p className="text-xs text-slate-400">Đăng nhập tài khoản kế toán doanh nghiệp</p>
        </div>

        {error && <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs font-semibold text-rose-600">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div className="relative">
              <User className="absolute left-3 top-3 text-slate-400" size={16} />
              <input 
                type="text" 
                required 
                placeholder="Tên người dùng..." 
                value={form.username}
                onChange={e => setForm({...form, username: e.target.value})}
                className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" 
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-slate-400" size={16} />
              <input 
                type="password" 
                required 
                placeholder="Mật khẩu bảo mật..." 
                value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" 
              />
            </div>
          </div>

          <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl shadow-md transition-all">
            Xác thực & Vào hệ thống
          </button>
        </form>

        <div className="border-t border-slate-100 pt-4 text-center">
          <button onClick={onFirstRun} className="text-xs font-bold text-emerald-600 hover:underline">
            Chưa có hệ thống? Đăng ký Quản trị viên khởi tạo
          </button>
        </div>
      </div>
    </div>
  );
}

// Login.jsx 
//  