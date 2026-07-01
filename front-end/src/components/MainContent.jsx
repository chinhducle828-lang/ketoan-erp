import React, { Suspense } from 'react';
import { MODULES_REGISTER } from '../views/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import ResponsiveContainer from './ResponsiveContainer.jsx';

export default function MainContent({ activeTab }) {
  const { activeCompany } = useAuth();

  // Luồng xử lý phân hệ hạch toán thông thường
  const currentModule = MODULES_REGISTER.find(m => m.id === activeTab);

  if (!currentModule) {
    return <div className="p-4 text-xs text-rose-600">Phân hệ không hợp lệ.</div>;
  }

  // ĐỒNG BỘ: Kiểm tra thuộc tính id của Object activeCompany thay vì check trực tiếp biến
  if (currentModule.requiresActiveCompany && !activeCompany?.id) {
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

  const LazyComponent = currentModule.component;

  return (
    <Suspense fallback={
      <div className="h-full w-full flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
        <RefreshCw className="animate-spin text-emerald-600" size={16} />
        <span>Đang nạp dữ liệu phân hệ hạch toán...</span>
      </div>
    }>
      <ResponsiveContainer>
        <LazyComponent />
      </ResponsiveContainer>
    </Suspense>
  );
}
