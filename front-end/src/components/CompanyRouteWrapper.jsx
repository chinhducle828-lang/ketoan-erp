import React, { Suspense } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export default function CompanyRouteWrapper({ component: Component, requiresActiveCompany }) {
  const { activeCompany } = useAuth();

  // Kiểm tra nếu phân hệ yêu cầu công ty mà người dùng chưa chọn pháp nhân
  if (requiresActiveCompany && !activeCompany?.id) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-white border border-slate-200 rounded-2xl shadow-sm max-w-lg mx-auto mt-12 animate-fade-in">
        <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl mb-4 border border-amber-100">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-1">Chưa chọn pháp nhân hạch toán</h2>
        <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
          Vui lòng chọn doanh nghiệp cần ghi sổ, hạch toán báo cáo ở thanh công cụ phía trên đỉnh màn hình để mở khóa dữ liệu phân hệ này.
        </p>
      </div>
    );
  }

  // Nếu hợp lệ, render component đó trong Suspense mượt mà
  return (
    <Suspense fallback={
      <div className="h-full w-full flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
        <RefreshCw className="animate-spin text-emerald-600" size={16} />
        <span>Đang nạp dữ liệu phân hệ hạch toán...</span>
      </div>
    }>
      <Component />
    </Suspense>
  );
}