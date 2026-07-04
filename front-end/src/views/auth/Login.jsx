import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePersistentState } from '../../utils/persistence.js';
import { Lock, User, Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const getStorefrontURL = () => {
  if (import.meta.env.VITE_STOREFRONT_URL) {
    return import.meta.env.VITE_STOREFRONT_URL;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.endsWith('.railway.app') || host.endsWith('.railway.sh')) {
      return 'http://banhang.railway.internal';
    }
  }

  return '';
};

export default function Login({ onFirstRun }) {
  const { login, logout, user } = useAuth();
  const navigate = useNavigate();
  const storefrontUrl = getStorefrontURL();
  const roleCode = user?.roleId || user?.role;
  const isStorefrontOnlyRole = roleCode === 'nv_banhang' || roleCode === 'nv_kho';

  const [form, setForm] = usePersistentState('login-form', { username: '', password: '' });
  const [postLoginRedirect, setPostLoginRedirect] = usePersistentState('post-login-redirect', 'erp');
  const [error, setError] = useState('');
  const [localLoading, setLocalLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLocalLoading(true);
    try {
      const response = await login(form.username, form.password);
      if (response && (response.success || response.accessToken)) {
        // Redirect according to user preference: ERP (default) or Storefront
        if (postLoginRedirect === 'storefront' && storefrontUrl) {
          const storedCompany = localStorage.getItem('activeCompany');
          let companyId;
          try { companyId = storedCompany ? JSON.parse(storedCompany)?.id : undefined; } catch { companyId = undefined; }
          const role = response.user?.roleId || response.user?.role || '';
          const erpToken = localStorage.getItem('accessToken');
          const params = new URLSearchParams();
          if (companyId) params.set('company_id', String(companyId));
          if (role) params.set('role', role);
          if (erpToken) params.set('erp_token', erpToken);
          const href = `${storefrontUrl}${params.toString() ? `?${params.toString()}` : ''}`;
          // Navigate to storefront (same tab)
          window.location.href = href;
        } else {
          navigate('/', { replace: true });
        }
      } else {
        setError(response?.message || 'Tên người dùng hoặc mật khẩu không chính xác.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Tên đăng nhập hoặc mật khẩu không chính xác.');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleLogoutAndSwitch = async () => {
    setError('');
    setLocalLoading(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      setError('Không thể đăng xuất phiên bán hàng hiện tại. Vui lòng thử lại.');
    } finally {
      setLocalLoading(false);
    }
  };

  const openStorefront = () => {
    if (!storefrontUrl) {
      setError('Chưa cấu hình VITE_STOREFRONT_URL cho storefront độc lập.');
      return;
    }

    window.open(storefrontUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.2),_transparent_35%),linear-gradient(135deg,_#07111f_0%,_#111827_45%,_#0f172a_100%)] p-4 text-slate-100 sm:p-6 lg:p-8">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center">
        <div className="grid overflow-hidden rounded-[32px] border border-white/10 bg-slate-900/70 shadow-2xl shadow-black/40 backdrop-blur xl:grid-cols-[1.05fr_0.95fr]">
          <div className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-500/20 via-slate-900 to-slate-950 p-8 xl:flex xl:flex-col xl:justify-between">
            <div className="absolute inset-0 bg-[radial-gradient(circle,_rgba(16,185,129,0.25),_transparent_55%)]" />
            <div className="relative space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm font-semibold text-emerald-200">
                <Sparkles size={16} />
                ERP + Commerce Platform
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-black leading-tight">Quản lý bán hàng, kho và kế toán trong một hệ thống</h1>
                <p className="max-w-lg text-sm leading-7 text-slate-300">
                  Từ đăng nhập nội bộ tới web bán hàng riêng, mọi dữ liệu đều được nối vào quy trình kế toán chuẩn.
                </p>
              </div>
            </div>
            <div className="relative rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              <p className="text-sm font-semibold text-white">Truy cập nhanh</p>
              <div className="mt-3 flex items-center justify-between text-sm text-slate-300">
                <span>Phân hệ bán hàng riêng</span>
                <button onClick={openStorefront} className="inline-flex items-center gap-2 font-semibold text-emerald-300 hover:text-emerald-200">
                  Mở ngay <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 lg:p-10">
            <div className="mb-8 text-center xl:text-left">
              <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300 xl:mx-0">
                <Sparkles size={24} />
              </div>
              <h2 className="text-2xl font-black text-white">Đăng nhập hệ thống</h2>
              <p className="mt-2 text-sm text-slate-400">Truy cập khu vực kế toán và vận hành doanh nghiệp</p>
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm font-medium text-rose-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <div className="relative">
                  <label htmlFor="username" className="sr-only">Tên người dùng</label>
                  <User className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    disabled={localLoading}
                    placeholder="Tên người dùng"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 py-3 pl-10 pr-4 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500"
                  />
                </div>

                <div className="relative">
                  <label htmlFor="password" className="sr-only">Mật khẩu</label>
                  <Lock className="pointer-events-none absolute left-3 top-3 text-slate-400" size={16} />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    disabled={localLoading}
                    placeholder="Mật khẩu"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 py-3 pl-10 pr-4 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="mt-2 flex items-center gap-4 text-sm text-slate-400">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="postLoginRedirect" value="erp" checked={postLoginRedirect === 'erp'} onChange={() => setPostLoginRedirect('erp')} />
                  <span className="ml-1">Về ERP sau khi đăng nhập</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="postLoginRedirect" value="storefront" checked={postLoginRedirect === 'storefront'} onChange={() => setPostLoginRedirect('storefront')} />
                  <span className="ml-1">Chuyển tới Web Bán Hàng</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={localLoading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
              >
                {localLoading ? 'Đang xác thực...' : 'Đăng nhập'}
                <ArrowRight size={16} />
              </button>
            </form>

            <div className="mt-6 space-y-2 border-t border-slate-800 pt-4 text-center text-sm">
              {isStorefrontOnlyRole && (
                <button type="button" onClick={handleLogoutAndSwitch} className="block w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700">
                  Đăng xuất phiên bán hàng và đăng nhập ERP khác
                </button>
              )}
              <button onClick={openStorefront} className="font-semibold text-emerald-300 hover:text-emerald-200">
                Mở phân hệ bán hàng web riêng
              </button>
              <button onClick={onFirstRun} className="block w-full font-medium text-slate-400 hover:text-slate-200">
                Chưa có hệ thống? Đăng ký quản trị viên
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}