import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, ExternalLink, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL || 'http://localhost:3001';

export default function StorefrontAccessNotice() {
  const { activeCompany, user, logout } = useAuth();
  const navigate = useNavigate();
  const [isRedirecting, setIsRedirecting] = useState(true);

  const companyId = activeCompany?.id ? Number(activeCompany.id) : null;
  const roleCode = user?.roleId || user?.role;
  const erpAccessToken = localStorage.getItem('accessToken');
  const params = new URLSearchParams();
  if (companyId) params.set('company_id', String(companyId));
  if (roleCode) params.set('role', roleCode);
  if (erpAccessToken) params.set('erp_token', erpAccessToken);
  const storefrontHref = `${STOREFRONT_URL}${params.toString() ? `?${params.toString()}` : ''}`;

  useEffect(() => {
    if (!storefrontHref) {
      setIsRedirecting(false);
      return;
    }

    // Chuyển hướng cùng tab để liền mạch sau đăng nhập.
    const redirectTimer = window.setTimeout(() => window.location.replace(storefrontHref), 1500);

    // Fallback hiển thị nút thủ công nếu môi trường không cho chuyển hướng tự động.
    const fallbackTimer = window.setTimeout(() => setIsRedirecting(false), 1800);
    return () => {
      window.clearTimeout(redirectTimer);
      window.clearTimeout(fallbackTimer);
    };
  }, [storefrontHref]);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-sm p-8">
        <div className="flex items-center gap-3 text-slate-900 mb-4">
          <Store className="h-6 w-6 text-blue-700" />
          <h1 className="text-xl font-bold">Tài khoản này thuộc hệ bán hàng</h1>
        </div>

        <p className="text-slate-700 leading-relaxed mb-4">
          Vai trò của bạn là nhân sự vận hành web bán hàng. Web kế toán ERP không mở các phân hệ nghiệp vụ cho nhóm vai trò này.
        </p>

        {isRedirecting && (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700 mb-4">
            Đang tự động chuyển sang web bán hàng...
          </div>
        )}

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 mb-6">
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-5 w-5 mt-0.5" />
            <div>
              Nếu bạn được phân công theo nhiều doanh nghiệp, vui lòng chọn doanh nghiệp ở thanh trên trước khi mở web bán hàng để đi đúng dữ liệu.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href={storefrontHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 text-white px-4 py-2 font-semibold hover:bg-blue-800 transition-colors"
          >
            Mở web bán hàng
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại ERP
          </button>
        </div>
      </div>
    </div>
  );
}
