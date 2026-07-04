import React from 'react';

const getStorefrontURL = () => {
  if (import.meta.env.VITE_STOREFRONT_URL) return import.meta.env.VITE_STOREFRONT_URL;
  if (typeof window !== 'undefined') return `${window.location.protocol}//${window.location.hostname}`;
  return 'http://localhost:3001';
};

export default function StorefrontAccessNotice() {
  const openStorefront = () => {
    const url = getStorefrontURL();
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
        <p className="text-sm text-slate-600 mb-6">Giao diện bán hàng được triển khai tách biệt. Vui lòng mở cửa hàng để thao tác bán hàng.</p>
        <button onClick={openStorefront} className="rounded-xl bg-emerald-500 px-4 py-2 text-white font-semibold">Mở Web Bán Hàng</button>
      </div>
    </div>
  );
}
