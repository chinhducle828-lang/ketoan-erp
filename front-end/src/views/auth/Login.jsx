import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePersistentState } from '../../utils/persistence.js';
import { Lock, User, Sparkles, ArrowRight } from 'lucide-react';
import { MODULES_REGISTER } from '../../views/index.js';
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
  const [showPostLoginChoice, setShowPostLoginChoice] = useState(false);
  const [postLoginHref, setPostLoginHref] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLocalLoading(true);
    try {
      const response = await login(form.username, form.password);
      if (response && (response.success || response.accessToken)) {
            // Determine whether this role has any ERP-accessible modules
            const roleToCheck = response.user?.roleId || response.user?.role || (user && (user.roleId || user.role));
            const hasErpAccess = MODULES_REGISTER.some((m) => Array.isArray(m.allowedRoles) && m.allowedRoles.includes(roleToCheck));

        // Prepare storefront URL if configured
        let href = '';
        if (storefrontUrl) {
          const storedCompany = localStorage.getItem('activeCompany');
          let companyId;
          try { companyId = storedCompany ? JSON.parse(storedCompany)?.id : undefined; } catch { companyId = undefined; }
          const role = response.user?.roleId || response.user?.role || '';
          const erpToken = response?.accessToken || localStorage.getItem('accessToken') || '';
          const params = new URLSearchParams();
          if (companyId) params.set('company_id', String(companyId));
          if (role) params.set('role', role);
          if (erpToken) params.set('erp_token', erpToken);
          if (typeof window !== 'undefined') params.set('erp_url', window.location.origin);
          href = `${storefrontUrl}${params.toString() ? `?${params.toString()}` : ''}`;
        }

        // If user already selected a redirect preference, honor it now and skip modal
        setPostLoginHref(href);
        if (postLoginRedirect === 'storefront_newtab' && href) {
          try { window.open(href, '_blank', 'noopener,noreferrer'); } catch { /* ignore */ }
          // ✅ Chỉ navigate về ERP nếu user có quyền ERP, tránh bug StorefrontAccessNotice tự động redirect
          if (hasErpAccess) {
            navigate('/', { replace: true });
          }
          setShowPostLoginChoice(false);
        } else if (postLoginRedirect === 'storefront_replace' && href) {
          // replace current tab with storefront
          window.location.href = href;
          setShowPostLoginChoice(false);
        } else if (postLoginRedirect === 'erp') {
          navigate('/', { replace: true });
          setShowPostLoginChoice(false);
        } else {
          // Show post-login choice modal so user can decide where to go
          setShowPostLoginChoice({ open: true, canStayErp: Boolean(hasErpAccess) });
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

              <div className="mt-2 flex flex-col gap-2 text-sm text-slate-400">
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="postLoginRedirect" value="erp" checked={postLoginRedirect === 'erp'} onChange={() => setPostLoginRedirect('erp')} />
                  <span className="ml-1">Về ERP sau khi đăng nhập</span>
                </label>
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center gap-2">
                    <input type="radio" name="postLoginRedirect" value="storefront_newtab" checked={postLoginRedirect === 'storefront_newtab'} onChange={() => setPostLoginRedirect('storefront_newtab')} />
                    <span className="ml-1">Mở Web Bán Hàng (tab mới, giữ phiên ERP)</span>
                  </label>
                </div>
                <label className="inline-flex items-center gap-2">
                  <input type="radio" name="postLoginRedirect" value="storefront_replace" checked={postLoginRedirect === 'storefront_replace'} onChange={() => setPostLoginRedirect('storefront_replace')} />
                  <span className="ml-1">Chuyển sang Web Bán Hàng (thay tab hiện tại)</span>
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

            {showPostLoginChoice && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="w-full max-w-md rounded-xl bg-white p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Bạn muốn làm gì tiếp theo?</h3>
                  <p className="text-sm text-slate-500 mb-4">Chọn nơi sẽ tiếp tục sau khi đăng nhập.</p>
                  <div className="space-y-3">
                    <button
                      onClick={() => { setShowPostLoginChoice(false); navigate('/', { replace: true }); }}
                      className="w-full rounded-xl border px-4 py-2 text-left"
                      disabled={!showPostLoginChoice.canStayErp}
                    >
                      Ở lại ERP
                    </button>
                    {!showPostLoginChoice.canStayErp && (
                      <div className="text-xs text-rose-500">Tài khoản này hiện không có quyền truy cập các phân hệ ERP.</div>
                    )}
                    <button onClick={() => { if (postLoginHref) { window.open(postLoginHref, '_blank', 'noopener,noreferrer'); } else { alert('Chưa cấu hình URL cửa hàng.'); } }} className="w-full rounded-xl bg-emerald-500 text-white px-4 py-2">Mở Web Bán Hàng (tab mới)</button>
                    <button onClick={() => { if (postLoginHref) { window.location.href = postLoginHref; } else { alert('Chưa cấu hình URL cửa hàng.'); } }} className="w-full rounded-xl border px-4 py-2">Chuyển sang Web Bán Hàng (thay tab)</button>
                  </div>
                  <div className="mt-4 text-right">
                    <button onClick={() => setShowPostLoginChoice(false)} className="text-sm text-slate-500">Đóng</button>
                  </div>
                </div>
              </div>
            )}

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