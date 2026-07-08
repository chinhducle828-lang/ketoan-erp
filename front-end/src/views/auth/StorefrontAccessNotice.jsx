/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../utils/api.js';
import { normalizeStorefrontRole } from '../../constants/storefrontRoles.js';

const getStorefrontURL = () => {
  const fromEnv = String(import.meta.env.VITE_STOREFRONT_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = String(params.get('storefront_url') || params.get('sf_url') || '').trim();
    if (fromQuery) return fromQuery.replace(/\/$/, '');
  }

  return '';
};

export default function StorefrontAccessNotice({ skipAutoRedirect }) {
  const { user, token, activeCompany } = useAuth();
  const [redirecting, setRedirecting] = useState(false);
  const [erpToken, setErpToken] = useState(() => token || localStorage.getItem('accessToken') || '');

  useEffect(() => {
    let cancelled = false;

    const refreshToken = async () => {
      try {
        const { data } = await api.post('/auth/refresh');
        if (!cancelled && data?.accessToken) {
          localStorage.setItem('accessToken', data.accessToken);
          setErpToken(data.accessToken);
          return;
        }
      } catch {
        // Keep current token when refresh fails.
      }
      if (!cancelled) {
        setErpToken(token || localStorage.getItem('accessToken') || '');
      }
    };

    refreshToken();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const storefrontHref = useMemo(() => {
    const baseUrl = getStorefrontURL();
    if (!baseUrl) return '';

    const params = new URLSearchParams();
    const companyId = activeCompany?.id ? String(activeCompany.id) : '';
    const storefrontRole = normalizeStorefrontRole(user?.roleId || user?.role);
    const latestErpToken = erpToken || token || localStorage.getItem('accessToken') || '';

    if (companyId) params.set('company_id', companyId);
    params.set('role', storefrontRole);
    if (latestErpToken) params.set('erp_token', latestErpToken);
    if (typeof window !== 'undefined') params.set('erp_url', window.location.origin);

    return `${baseUrl}${params.toString() ? `?${params.toString()}` : ''}`;
  }, [activeCompany?.id, erpToken, token, user?.role, user?.roleId]);

  useEffect(() => {
    // ✅ Nếu skipAutoRedirect = true, không tự động chuyển hướng
    if (skipAutoRedirect) return;
    if (!storefrontHref || redirecting) return;
    setRedirecting(true);

    // Auto-redirect should stay in current tab to avoid popup blockers on mobile.
    window.location.replace(storefrontHref);
  }, [storefrontHref, redirecting, skipAutoRedirect]);

  const openStorefront = () => {
    const url = storefrontHref;
    if (!url) return;
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      window.location.href = url;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-2xl rounded-2xl border bg-white p-8 text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Phân hệ bán hàng (Storefront)</h2>
        <p className="text-sm text-slate-600 mb-6">
          {storefrontHref
            ? 'Đang chuyển sang web bán hàng. Nếu chưa chuyển, bấm nút bên dưới.'
            : 'Chưa cấu hình URL storefront. Vui lòng đặt VITE_STOREFRONT_URL hoặc truyền storefront_url trên link.'}
        </p>
        <button
          onClick={openStorefront}
          disabled={!storefrontHref}
          className="rounded-xl bg-emerald-500 px-4 py-2 text-white font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          Mở Web Bán Hàng
        </button>
      </div>
    </div>
  );
}
