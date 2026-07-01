import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePersistentState } from '../../utils/persistence.js';

export default function ChangePassword() {
  const { changePassword } = useAuth();
  const [form, setForm] = usePersistentState('change-password-form', { oldPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirm) return setError('Mật khẩu mới không khớp');
    try {
      await changePassword(form.oldPassword, form.newPassword);
      setSuccess(true);
    } catch (err) { setError(err); }
  };

  if (success) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white p-6 rounded-2xl shadow text-center">
        <h2 className="text-lg font-black text-emerald-600">Đổi mật khẩu thành công</h2>
        <p className="text-sm text-slate-600 mt-2">Vui lòng đăng nhập lại nếu cần.</p>
        <button onClick={() => location.reload()} className="mt-4 bg-emerald-600 text-white py-2 px-4 rounded">Đồng ý</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white p-6 rounded-2xl shadow space-y-4">
        <h2 className="text-base font-black text-slate-800">Thay đổi mật khẩu</h2>
        {error && <div className="p-2 bg-rose-50 text-rose-600 rounded">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="password" placeholder="Mật khẩu hiện tại" required value={form.oldPassword} onChange={e => setForm({...form, oldPassword: e.target.value})} className="w-full p-3 rounded border" />
          <input type="password" placeholder="Mật khẩu mới" required value={form.newPassword} onChange={e => setForm({...form, newPassword: e.target.value})} className="w-full p-3 rounded border" />
          <input type="password" placeholder="Nhập lại mật khẩu mới" required value={form.confirm} onChange={e => setForm({...form, confirm: e.target.value})} className="w-full p-3 rounded border" />
          <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded">Đổi mật khẩu</button>
        </form>
      </div>
    </div>
  );
}
