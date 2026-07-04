import React, { useMemo } from 'react';

const normalizeAbsoluteUrl = (value) => {
  if (!value) return '';
  let raw = String(value).trim();
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) {
    raw = `https://${raw}`;
  }
  try {
    const parsed = new URL(raw);
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
};

const getERPUrl = () => {
  const env = normalizeAbsoluteUrl(import.meta.env.VITE_ERP_URL);
  if (env) return env;
  if (typeof window !== 'undefined') {
    const query = normalizeAbsoluteUrl(new URLSearchParams(window.location.search).get('erp_url'));
    if (query) return query;
  }
  return '';
};

export default function BackToERP() {
  const params = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search);
    } catch {
      return new URLSearchParams();
    }
  }, []);

  const erpToken = params.get('erp_token');
  const companyId = params.get('company_id');
  const role = params.get('role');

  if (!erpToken) return null;
  const erpBase = getERPUrl();
  if (!erpBase) return null;

  const openERPDirect = () => {
    const url = new URL(erpBase);
    if (!url.pathname || url.pathname === '/') {
      url.pathname = '/login';
    }
    if (companyId) url.searchParams.set('company_id', companyId);
    if (role) url.searchParams.set('role', role);
    url.searchParams.set('erp_token', erpToken);
    window.location.href = url.toString();
  };

  const openERPViaBackend = async () => {
    try {
      const resp = await fetch(`${erpBase}/api/auth/external-login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ erp_token: erpToken, company_id: companyId, role })
      });
      if (resp.ok) {
        window.location.href = erpBase;
      } else {
        const err = await resp.json();
        alert('Không thể đăng nhập về ERP: ' + (err.error || resp.statusText));
      }
    } catch (e) {
      alert('Lỗi kết nối ERP: ' + e.message);
    }
  };

  return (
    <div className="back-to-erp fixed right-4 bottom-4 z-50">
      <div className="flex gap-2">
        <button onClick={openERPViaBackend} className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-semibold">Quay về ERP</button>
        <button onClick={openERPDirect} className="px-3 py-2 rounded-lg bg-slate-50 border">Mở trực tiếp</button>
      </div>
    </div>
  );
}
