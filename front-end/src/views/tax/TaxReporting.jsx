/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

// FILE_PATH: front-end/src/views/tax/TaxReporting.jsx
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { Percent, ArrowUpRight, ArrowDownRight, Users, Landmark, Building2, Calendar, AlertTriangle } from 'lucide-react';
import { useRealtimeCacheSync } from '../../hooks/useRealtimeCacheSync.js';
import { notify } from '../../utils/notify.jsx';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';
import ImportExcelButton from '../../components/ImportExcelButton.jsx';

export default function TaxReporting() {
  const { activeCompany, fiscalYear } = useAuth();
  const companyId = activeCompany?.id ?? activeCompany;
  const [error, setError] = useState(null);
  
  // Note: This component uses vouchers from VoucherContext
  // The vouchers are already managed by VoucherList component with React Query
  // We just add realtime cache sync here for completeness
  useRealtimeCacheSync({
    queries: [
      { key: ['vouchers', companyId] }
    ],
    events: ['voucherCreated', 'voucherUpdated', 'voucherDeleted', 'closingCompleted'],
    enabled: !!companyId
  });

  // Get vouchers from context with error handling
  const { vouchers, isLoading: loadingVouchers, error: vouchersError } = useVouchers();

  // Handle errors
  React.useEffect(() => {
    if (vouchersError) {
      setError(vouchersError);
      notify.error('Không thể tải dữ liệu chứng từ: ' + (vouchersError.message || 'Lỗi không xác định'));
    }
  }, [vouchersError]);

  // Đọc hiểu sâu mảng chứng từ đa dòng để bóc tách toàn diện các sắc thuế
  const taxData = useMemo(() => {
    if (!vouchers || !Array.isArray(vouchers)) {
      return { vatInput: 0, vatOutput: 0, tndnPhaiNop: 0, tndnDaNop: 0, tncnKhauTru: 0 };
    }
    let vatInput = 0;
    let vatOutput = 0;
    let tndnPhaiNop = 0;
    let tndnDaNop = 0;
    let tncnKhauTru = 0;

    vouchers.forEach(v => {
      if (v.details && Array.isArray(v.details)) {
        v.details.forEach(dt => {
          // Parse amount - Hệ thống nay đã hỗ trợ số âm (ghi đỏ) để điều chỉnh
          const amount = parseFloat(dt.amount) || 0;
          const accCode = dt.accountCode || dt.account_code;
          const entryType = dt.entryType || dt.entry_type;

          if ((accCode === '1331' || accCode === '133') && entryType === 'DR') {
            vatInput += amount;
          }
          if ((accCode === '3331' || accCode === '333') && entryType === 'CR') {
            vatOutput += amount;
          }

          if (accCode === '3334') {
            if (entryType === 'CR') tndnPhaiNop += amount;
            if (entryType === 'DR') tndnDaNop += amount;
          }

          if ((accCode === '3335' || accCode === '334') && entryType === 'CR') {
            tncnKhauTru += amount;
          }
        });
      }
    });

    return { vatInput, vatOutput, tndnPhaiNop, tndnDaNop, tncnKhauTru };
  }, [vouchers]);

  // Show error state
  if (error) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center">
          <AlertTriangle size={48} className="text-rose-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-rose-800 mb-2">Không thể tải dữ liệu</h2>
          <p className="text-sm text-rose-600 mb-4">{error?.message || 'Đã xảy ra lỗi khi tải báo cáo thuế'}</p>
          <button
            onClick={() => setError(null)}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-bold hover:bg-rose-700 transition"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loadingVouchers) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-xs text-slate-500 font-medium">Đang tải dữ liệu báo cáo thuế...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* TIÊU ĐỀ BÁO CÁO & NGỮ CẢNH */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-slate-200 pb-5 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight uppercase">
            <Landmark className="text-indigo-600" size={28} /> BÁO CÁO NGHĨA VỤ THUẾ (NSNN)
          </h1>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs font-semibold text-slate-500">
            <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md text-slate-700">
              <Building2 size={14} className="text-emerald-600" />
              {activeCompany?.name || 'Chưa chọn doanh nghiệp'}
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md text-slate-700">
              <Calendar size={14} className="text-blue-600" />
              Niên độ: {fiscalYear || new Date().getFullYear()}
            </div>
            <span className="italic text-slate-400">Theo Thông tư 99/2025/TT-BTC</span>
          </div>
        </div>
        <div className="flex gap-2">
          <ImportExcelButton endpoint="vouchers" filename="Chung_Tu" label="Nhập Excel" accountCodeField="accountCode" />
          <ExportExcelButton endpoint="vouchers" filename={`Bao_Cao_Thue_${fiscalYear}`} label="Xuất Excel Dữ Liệu" />
        </div>
      </div>

      {/* PHÂN HỆ 1: THUẾ GIÁ TRỊ GIA TĂNG (GTGT) */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
          <span className="w-1.5 h-3 bg-rose-500 rounded-sm inline-block"></span>
          Thuế Giá Trị Gia Tăng (Mẫu 01/GTGT)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-2xl border shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
              Thuế GTGT đầu vào được khấu trừ (Nợ TK 1331)
            </span>
            <h3 className="text-2xl font-black text-emerald-600 mt-2">
              {taxData.vatInput.toLocaleString('vi-VN')} đ
            </h3>
          </div>
          
          <div className="bg-white p-5 rounded-2xl border shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
              Thuế GTGT đầu ra phải nộp (Có TK 3331)
            </span>
            <h3 className="text-2xl font-black text-orange-600 mt-2">
              {taxData.vatOutput.toLocaleString('vi-VN')} đ
            </h3>
          </div>
          
          <div className="p-5 rounded-2xl border shadow-sm bg-slate-900 text-white">
            <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
              {taxData.vatOutput > taxData.vatInput ? 'Nghĩa vụ phải nộp thêm kỳ này' : 'Thuế còn được khấu trừ chuyển kỳ sau'}
            </span>
            <h3 className="text-2xl font-black text-white mt-2">
              {Math.abs(taxData.vatOutput - taxData.vatInput).toLocaleString('vi-VN')} đ
            </h3>
          </div>
        </div>
      </div>

       {/* PHÂN HỆ 2 & 3: THUẾ TNDN VÀ THUẾ TNCN */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         
         {/* THUẾ THU NHẬP DOANH NGHIỆP */}
         <div className="space-y-3">
           <h2 className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
             <span className="w-1.5 h-3 bg-blue-500 rounded-sm inline-block"></span>
             Thuế Thu Nhập Doanh Nghiệp (TK 3334)
           </h2>
           <div className="bg-white p-5 rounded-2xl border border-blue-50 shadow-sm flex flex-col justify-between h-[130px]">
             <div className="flex justify-between items-start">
               <div>
                 <span className="text-[10px] font-bold text-rose-500 uppercase flex items-center gap-0.5 tracking-wider">
                   <ArrowUpRight size={12} /> Phát sinh (Có 3334)
                 </span>
                 <h4 className="text-lg font-extrabold text-slate-700 mt-1">
                   {taxData.tndnPhaiNop.toLocaleString('vi-VN')} đ
                 </h4>
               </div>
               <div className="text-right">
                 <span className="text-[10px] font-bold text-emerald-600 uppercase flex items-center justify-end gap-0.5 tracking-wider">
                   <ArrowDownRight size={12} /> Đã nộp (Nợ 3334)
                 </span>
                 <h4 className="text-lg font-extrabold text-slate-700 mt-1">
                   {taxData.tndnDaNop.toLocaleString('vi-VN')} đ
                 </h4>
               </div>
             </div>
             
             <div className="pt-2.5 border-t border-dashed border-slate-100 flex justify-between items-center text-xs">
               <span className="text-slate-400 font-medium">Trạng thái nghĩa vụ (Lưỡng tính):</span>
               <span className={`font-bold ${taxData.tndnPhaiNop > taxData.tndnDaNop ? 'text-rose-600' : 'text-emerald-600'}`}>
                 {taxData.tndnPhaiNop > taxData.tndnDaNop 
                   ? `Còn phải nộp: ${(taxData.tndnPhaiNop - taxData.tndnDaNop).toLocaleString('vi-VN')} đ`
                   : `Tạm nộp thừa (Dư Nợ): ${(taxData.tndnDaNop - taxData.tndnPhaiNop).toLocaleString('vi-VN')} đ`
                 }
               </span>
             </div>
           </div>
         </div>

        {/* THUẾ THU NHẬP CÁ NHÂN */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
            <span className="w-1.5 h-3 bg-purple-500 rounded-sm inline-block"></span>
            Thuế Thu Nhập Cá Nhân (TK 3335)
          </h2>
          <div className="bg-white p-5 rounded-2xl border border-purple-50 shadow-sm flex flex-col justify-between h-[130px]">
            <div>
              <span className="text-[10px] font-bold text-purple-500 uppercase flex items-center gap-1 tracking-wider">
                <Users size={12} /> Khấu trừ tại nguồn (Có 3335)
              </span>
              <h3 className="text-2xl font-black text-purple-700 mt-2">
                {taxData.tncnKhauTru.toLocaleString('vi-VN')} đ
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Khoản thuế thu giữ từ thu nhập của người lao động chờ quyết toán chuyển nộp NSNN.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}