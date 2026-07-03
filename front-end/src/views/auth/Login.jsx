import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePersistentState } from '../../utils/persistence.js';
import { Lock, User, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // ✅ ĐÃ BỔ SUNG: Import công cụ điều hướng chuyển trang

export default function Login({ onFirstRun }) {
  const { login } = useAuth();
  const navigate = useNavigate(); // ✅ ĐÃ BỔ SUNG: Khởi tạo thực thể điều hướng tuyến đường
  
  const [form, setForm] = usePersistentState('login-form', { username: '', password: '' });
  const [error, setError] = useState('');
  
  // ✅ ĐÃ ĐỔI TÊN: Dùng localLoading để quản lý riêng trạng thái nút bấm, chống xung đột State toàn cục
  const [localLoading, setLocalLoading] = useState(false); 

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLocalLoading(true);
    try {
      // 1. Gửi yêu cầu đăng nhập lên AuthContext và nhận kết quả trả về
      const response = await login(form.username, form.password);
      
      // 2. ✅ ĐÃ SỬA ĐỔI: Kiểm tra linh hoạt, nếu có cờ success HOẶC có accessToken trả về thì coi như thành công
      if (response && (response.success || response.accessToken)) {
        navigate('/', { replace: true }); // Tự động chuyển giao diện vào thẳng hệ thống ERP không cần F5
      } else {
        setError(response?.message || 'Tên người dùng hoặc mật khẩu không chính xác.');
      }
    } catch (err) {
      // Đọc thông báo lỗi chi tiết từ server trả về nếu có
      setError(err.response?.data?.error || err.response?.data?.message || 'Tên đăng nhập hoặc mật khẩu không chính xác.');
    } finally {
      setLocalLoading(false);
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

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs font-semibold text-rose-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div className="relative">
              <label htmlFor="username" className="sr-only">Tên người dùng</label>
              <User className="absolute left-3 top-3 text-slate-400" size={16} />
              <input 
                id="username"
                name="username"
                type="text" 
                required 
                disabled={localLoading}
                placeholder="Tên người dùng..." 
                value={form.username}
                onChange={e => setForm({...form, username: e.target.value})}
                className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60" 
              />
            </div>

            <div className="relative">
              <label htmlFor="password" className="sr-only">Mật khẩu bảo mật</label>
              <Lock className="absolute left-3 top-3 text-slate-400" size={16} />
              <input 
                id="password"
                name="password"
                type="password" 
                required 
                disabled={localLoading}
                placeholder="Mật khẩu bảo mật..." 
                value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60" 
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={localLoading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl shadow-md transition-all disabled:opacity-60"
          >
            {localLoading ? 'Đang xác thực thông tin...' : 'Xác thực & Vào hệ thống'}
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