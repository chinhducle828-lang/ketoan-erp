import React, { useMemo } from 'react';

const getERPUrl = () => {
  const env = import.meta.env.VITE_ERP_URL;
  if (env) return env.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return 'https://dazzling-grace-production-03a5.up.railway.app';
  }
  return 'http://localhost:5000';
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

  const openERPDirect = () => {
    const erpUrl = getERPUrl();
    const url = new URL(erpUrl);
    if (companyId) url.searchParams.set('company_id', companyId);
    if (role) url.searchParams.set('role', role);
    url.searchParams.set('erp_token', erpToken);
    window.location.href = url.toString();
  };

  const openERPViaBackend = async () => {
    try {
      const erpBase = getERPUrl().replace(/\/$/, '');
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
