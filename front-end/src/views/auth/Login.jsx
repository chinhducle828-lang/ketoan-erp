/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePersistentState } from '../../utils/persistence.js';
import api from '../../utils/api.js';
import { Lock, User, Sparkles, ArrowRight, ExternalLink } from 'lucide-react';
import { MODULES_REGISTER } from '../../views/index.js';
import { useNavigate } from 'react-router-dom';
import getStorefrontURL from '../../utils/storefrontUrl.js';

export default function Login({ onFirstRun }) {
  const { login, logout, user, token, activeCompany } = useAuth();
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
  const [tokenTimestamp, setTokenTimestamp] = useState(null);
  const submitLockRef = useRef(false);

  // Consolidated redirect handler — single source of truth for all post-login navigation
  const handleRedirect = useCallback((href, mode, hasErpAccess) => {
    if (mode === 'storefront_newtab' && href) {
      const popup = window.open(href, '_blank', 'noopener,noreferrer');
      if (!popup) {
        // Popup bị chặn (trên mobile) → fallback: thay tab hiện tại
        window.location.href = href;
      } else if (hasErpAccess) {
        navigate('/', { replace: true });
      }
    } else if (mode === 'storefront_replace' && href) {
      // Redirect current tab directly — eliminates race condition of open+setTimeout(close)
      window.location.href = href;
    } else {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  // Check if the erp_token obtained at login is still fresh enough
  const isTokenExpired = useCallback(() => {
    if (!tokenTimestamp) return true;
    // Token issued > 10 minutes ago → likely expired (15 min TTL)
    return Date.now() - tokenTimestamp > 10 * 60 * 1000;
  }, [tokenTimestamp]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setError('');
    setLocalLoading(true);
    try {
      const response = await login(form.username, form.password);
      if (response && (response.success || response.accessToken)) {
            // If backend returned a dedicated storefront token for storefront-only roles,
            // persist it so storefront app can use it immediately without extra exchange.
            if (response.storefrontToken) {
              try {
                localStorage.setItem('storefrontAccessToken', response.storefrontToken);
              } catch (e) {
                // ignore storage errors
              }
            }
            const roleToCheck = response.user?.roleId || response.user?.role || (user && (user.roleId || user.role));
            const hasErpAccess = MODULES_REGISTER.some((m) => Array.isArray(m.allowedRoles) && m.allowedRoles.includes(roleToCheck));

            // gd_kinhdoanh có route riêng → điều hướng trong Router (không reload trang)
            if (roleToCheck === 'gd_kinhdoanh') {
              navigate('/gd-kinhdoanh/dashboard', { replace: true });
              return;
            }

        // Record token issue time for expiration checks
        setTokenTimestamp(Date.now());

        let href = '';
        if (storefrontUrl) {
          const storedCompany = localStorage.getItem('activeCompany');
          let companyId;
          try { companyId = storedCompany ? JSON.parse(storedCompany)?.id : undefined; } catch { companyId = undefined; }
          const role = response.user?.roleId || response.user?.role || '';
          // Use storefrontAccessToken (7-day) instead of accessToken (15-min) to avoid expiry issues
          const erpToken = localStorage.getItem('storefrontAccessToken') || '';
          const params = new URLSearchParams();
          if (companyId) params.set('company_id', String(companyId));
          if (role) params.set('role', role);
          if (erpToken) params.set('erp_token', erpToken);
          if (typeof window !== 'undefined') params.set('erp_url', window.location.origin);
          href = `${storefrontUrl}${params.toString() ? `?${params.toString()}` : ''}`;
        }

        setPostLoginHref(href);
        if (postLoginRedirect === 'storefront_newtab' && href) {
          handleRedirect(href, 'storefront_newtab', hasErpAccess);
        } else if (postLoginRedirect === 'storefront_replace' && href) {
          handleRedirect(href, 'storefront_replace', hasErpAccess);
        } else if (postLoginRedirect === 'erp') {
          handleRedirect('', 'erp', hasErpAccess);
        } else {
          setShowPostLoginChoice({ open: true, canStayErp: Boolean(hasErpAccess) });
        }
      } else {
        setError(response?.message || 'Tên người dùng hoặc mật khẩu không chính xác.');
      }
    } catch (err) {
      if (err.response?.status === 429) {
        setError(err.response?.data?.error || err.response?.data?.message || 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng đợi một lát rồi thử lại.');
      } else {
        setError(err.response?.data?.error || err.response?.data?.message || 'Tên đăng nhập hoặc mật khẩu không chính xác.');
      }
    } finally {
      setLocalLoading(false);
      submitLockRef.current = false;
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

  const openStorefront = async () => {
    if (!storefrontUrl) {
      setError('Chưa cấu hình VITE_STOREFRONT_URL cho storefront độc lập.');
      return;
    }

    const companyId = activeCompany?.id ? String(activeCompany.id) : undefined;
    const role = user?.roleId || user?.role || '';
    // Prefer storefrontAccessToken (7-day) to avoid expiry issues
    let erpToken = localStorage.getItem('storefrontAccessToken') || '';
    if (!erpToken) {
      // Fallback: try refreshing the access token
      try {
        const { data } = await api.post('/auth/refresh');
        if (data?.accessToken) {
          erpToken = data.accessToken;
          localStorage.setItem('accessToken', data.accessToken);
        }
      } catch {
        // Keep current token as fallback if refresh is unavailable.
      }
    }

    const params = new URLSearchParams();
    if (companyId) params.set('company_id', companyId);
    if (role) params.set('role', role);
    if (erpToken) params.set('erp_token', erpToken);
    if (typeof window !== 'undefined') params.set('erp_url', window.location.origin);
    const href = `${storefrontUrl}${params.toString() ? `?${params.toString()}` : ''}`;
    const popup = window.open(href, '_blank', 'noopener,noreferrer');
    if (!popup) {
      // Popup bị chặn trên mobile → fallback thay tab hiện tại
      window.location.href = href;
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-3 sm:p-4">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70 shadow-2xl shadow-black/40 backdrop-blur xl:grid xl:grid-cols-2">
        {/* Left panel - hero (hidden on mobile) */}
        <div className="relative bg-gradient-to-br from-emerald-600/20 via-slate-900 to-slate-950 p-6 lg:p-8 xl:flex xl:flex-col xl:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,_rgba(16,185,129,0.3),_transparent_55%)]" />
          <div className="relative space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">
              <Sparkles size={14} />
              ERP + Commerce Platform
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-black leading-tight text-white lg:text-4xl">
                Quản lý bán hàng, kho và kế toán
              </h1>
              <p className="max-w-md text-sm leading-relaxed text-slate-300">
                Từ đăng nhập nội bộ tới web bán hàng riêng, mọi dữ liệu đều được nối vào quy trình kế toán chuẩn.
              </p>
            </div>
          </div>
          <div className="relative mt-6 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
            <p className="text-xs font-bold text-white">Truy cập nhanh</p>
            <div className="mt-2 flex items-center justify-between gap-2 text-sm text-slate-200">
              <span className="text-xs font-medium">Phân hệ bán hàng riêng</span>
              <button
                type="button"
                onClick={openStorefront}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30"
              >
                Mở ngay <ExternalLink size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Right panel - login form */}
        <div className="flex flex-col justify-center p-5 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-sm">
              {/* Header */}
              <div className="mb-6 text-center xl:text-left">
                <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 xl:mx-0">
                  <Sparkles size={20} />
                </div>
                <h2 className="text-xl font-black text-white sm:text-2xl">Đăng nhập hệ thống</h2>
                <p className="mt-1 text-xs font-medium text-slate-300">Truy cập khu vực kế toán và vận hành doanh nghiệp</p>
              </div>

            {/* Error */}
            {error && (
              <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-bold text-rose-300">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <div className="relative">
                  <label htmlFor="username" className="sr-only">Tên người dùng</label>
                  <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    disabled={localLoading}
                    placeholder="Tên người dùng"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="w-full rounded-xl border border-slate-600 bg-slate-950 py-2.5 pl-9 pr-3 text-sm font-medium text-slate-100 outline-none placeholder:text-slate-500 disabled:opacity-60"
                  />
                </div>
                <div className="relative">
                  <label htmlFor="password" className="sr-only">Mật khẩu</label>
                  <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    disabled={localLoading}
                    placeholder="Mật khẩu"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full rounded-xl border border-slate-600 bg-slate-950 py-2.5 pl-9 pr-3 text-sm font-medium text-slate-100 outline-none placeholder:text-slate-500 disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Redirect options */}
              <fieldset className="space-y-2 rounded-xl border border-slate-700 bg-slate-950/50 p-3">
                <legend className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Sau khi đăng nhập
                </legend>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-800/50">
                  <input
                    type="radio"
                    name="postLoginRedirect"
                    value="erp"
                    checked={postLoginRedirect === 'erp'}
                    onChange={() => setPostLoginRedirect('erp')}
                    className="mt-0.5 accent-emerald-500"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-slate-200">Về ERP</span>
                    <span className="text-[10px] text-slate-400">Tiếp tục làm việc trên hệ thống kế toán</span>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-800/50">
                  <input
                    type="radio"
                    name="postLoginRedirect"
                    value="storefront_newtab"
                    checked={postLoginRedirect === 'storefront_newtab'}
                    onChange={() => setPostLoginRedirect('storefront_newtab')}
                    className="mt-0.5 accent-emerald-500"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-slate-200">Mở Web Bán Hàng (tab mới)</span>
                    <span className="text-[10px] text-slate-400">Giữ phiên ERP, mở storefront ở tab riêng</span>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-800/50">
                  <input
                    type="radio"
                    name="postLoginRedirect"
                    value="storefront_replace"
                    checked={postLoginRedirect === 'storefront_replace'}
                    onChange={() => setPostLoginRedirect('storefront_replace')}
                    className="mt-0.5 accent-emerald-500"
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-slate-200">Chuyển sang Web Bán Hàng</span>
                    <span className="text-[10px] text-slate-400">Mở storefront, đóng tab ERP hiện tại</span>
                  </div>
                </label>
              </fieldset>

              <button
                type="submit"
                disabled={localLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {localLoading ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                    Đang xác thực...
                  </>
                ) : (
                  <>
                    Đăng nhập
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Post-login choice modal */}
            {showPostLoginChoice && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <div className="w-full max-w-sm rounded-2xl border border-slate-600 bg-slate-900 p-5 shadow-2xl">
                  <h3 className="text-base font-black text-white">Bạn muốn làm gì tiếp theo?</h3>
                  <p className="mt-1 text-xs font-medium text-slate-300">Chọn nơi sẽ tiếp tục sau khi đăng nhập.</p>
                  <div className="mt-4 space-y-2">
                    <button
                      onClick={() => { setShowPostLoginChoice(false); handleRedirect('', 'erp', showPostLoginChoice.canStayErp); }}
                      disabled={!showPostLoginChoice.canStayErp}
                      className="w-full rounded-xl border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-left text-sm font-bold text-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span>Ở lại ERP</span>
                        {!showPostLoginChoice.canStayErp && (
                          <span className="text-[10px] text-rose-400">Tài khoản này không có quyền truy cập ERP</span>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        if (!postLoginHref) { alert('Chưa cấu hình URL cửa hàng.'); return; }
                        if (isTokenExpired()) { setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'); return; }
                        handleRedirect(postLoginHref, 'storefront_newtab', showPostLoginChoice.canStayErp);
                      }}
                      className="w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span>Mở Web Bán Hàng</span>
                        <ExternalLink size={14} />
                      </div>
                      <span className="block text-[10px] font-semibold text-slate-700">(tab mới, giữ phiên ERP)</span>
                    </button>
                    <button
                      onClick={() => {
                        if (!postLoginHref) { alert('Chưa cấu hình URL cửa hàng.'); return; }
                        if (isTokenExpired()) { setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'); return; }
                        handleRedirect(postLoginHref, 'storefront_replace', showPostLoginChoice.canStayErp);
                      }}
                      className="w-full rounded-xl border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-slate-800"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span>Chuyển sang Web Bán Hàng</span>
                        <ArrowRight size={14} />
                      </div>
                      <span className="block text-[10px] font-semibold text-slate-400">(thay tab hiện tại)</span>
                    </button>
                  </div>
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={() => setShowPostLoginChoice(false)}
                      className="text-xs font-semibold text-slate-400 hover:text-slate-300"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Footer actions */}
            <div className="mt-5 space-y-2 border-t border-slate-700 pt-4 text-center">
              {isStorefrontOnlyRole && (
                <button
                  type="button"
                  onClick={handleLogoutAndSwitch}
                  className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-700"
                >
                  Đăng xuất & đăng nhập ERP khác
                </button>
              )}
              <button
                type="button"
                onClick={openStorefront}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300"
              >
                <ExternalLink size={12} />
                Mở phân hệ bán hàng web riêng
              </button>
              <button
                type="button"
                onClick={onFirstRun}
                className="block w-full text-xs font-semibold text-slate-400 hover:text-slate-300"
              >
                Chưa có hệ thống? Đăng ký quản trị viên
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}