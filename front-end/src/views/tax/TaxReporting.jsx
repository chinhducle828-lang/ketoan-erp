/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

// FILE_PATH: front-end/src/views/tax/TaxReporting.jsx
import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVoucherQueries } from '../../hooks/useVoucherQueries.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Percent, ArrowUpRight, ArrowDownRight, Users, Landmark, Building2, Calendar, AlertTriangle, FileText, ToggleLeft, ToggleRight } from 'lucide-react';
import { notify } from '../../utils/notify.jsx';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';
import ImportExcelButton from '../../components/ImportExcelButton.jsx';

export default function TaxReporting() {
  const { activeCompany, fiscalYear } = useAuth();
  const companyId = activeCompany?.id ?? activeCompany;
  const [error, setError] = useState(null);
  
  // Get vouchers from React Query
  const { vouchers, isLoading: loadingVouchers, error: vouchersError } = useVoucherQueries();
  
  // State for non-deductible expenses management
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [updatingDetail, setUpdatingDetail] = useState(null);
  const [showNonDeductiblePanel, setShowNonDeductiblePanel] = useState(false);

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

  // Mutation for updating non-deductible flag
  const updateNonDeductibleMutation = useMutation({
    mutationFn: async ({ voucherId, detailId, isNonDeductible }) => {
      const response = await api.put(`/vouchers/${voucherId}/details/${detailId}`, {
        is_tax_deductible: !isNonDeductible
      });
      return response.data;
    },
    onSuccess: () => {
      notify.success('Đã cập nhật trạng thái khấu trừ thuế!');
      setUpdatingDetail(null);
      // Invalidate queries to refresh data
      queryClient.invalidateQueries(['vouchers']);
    },
    onError: (err) => {
      notify.error(err.response?.data?.error || 'Lỗi khi cập nhật!');
      setUpdatingDetail(null);
    }
  });

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

  // Extract non-deductible expenses for TNDN calculation
  const nonDeductibleExpenses = useMemo(() => {
    if (!vouchers || !Array.isArray(vouchers)) return [];
    
    const expenses = [];
    vouchers.forEach(v => {
      if (v.details && Array.isArray(v.details)) {
        v.details.forEach(dt => {
          const accCode = dt.accountCode || dt.account_code;
          const isExpense = ['632', '635', '641', '642', '811'].some(prefix => accCode?.startsWith(prefix));
          const isNonDeductible = dt.is_tax_deductible === false;
          
          if (isExpense && isNonDeductible) {
            expenses.push({
              ...dt,
              voucherId: v.id,
              voucherNumber: v.voucher_number,
              voucherDate: v.voucher_date,
              accountCode: accCode
            });
          }
        });
      }
    });
    return expenses;
  }, [vouchers]);

  const totalNonDeductible = useMemo(() => {
    return nonDeductibleExpenses.reduce((sum, dt) => sum + (parseFloat(dt.amount) || 0), 0);
  }, [nonDeductibleExpenses]);

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

       {/* PHÂN HỆ 4: CHI PHÍ KHÔNG ĐƯỢC TRỪ (TK 8211) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
            <span className="w-1.5 h-3 bg-red-500 rounded-sm inline-block"></span>
            Chi Phí Không Được Trừ Thuế TNDN (TK 8211)
          </h2>
          <button
            onClick={() => setShowNonDeductiblePanel(!showNonDeductiblePanel)}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
          >
            {showNonDeductiblePanel ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
            {showNonDeductiblePanel ? 'Ẩn chi tiết' : 'Quản lý chi phí'}
          </button>
        </div>
        
        {showNonDeductiblePanel && (
          <div className="bg-white p-5 rounded-2xl border border-red-50 shadow-sm space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                <span className="text-[10px] font-bold text-red-500 uppercase block tracking-wider">
                  Tổng chi phí không được trừ
                </span>
                <h3 className="text-2xl font-black text-red-700 mt-2">
                  {totalNonDeductible.toLocaleString('vi-VN')} đ
                </h3>
                <p className="text-[11px] text-red-600 mt-1">
                  {nonDeductibleExpenses.length} khoản chi phí
                </p>
              </div>
              
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                <span className="text-[10px] font-bold text-amber-600 uppercase block tracking-wider">
                  Ảnh hưởng đến thuế TNDN
                </span>
                <h3 className="text-2xl font-black text-amber-700 mt-2">
                  {(totalNonDeductible * 0.2).toLocaleString('vi-VN')} đ
                </h3>
                <p className="text-[11px] text-amber-600 mt-1">
                  Thuế TNDN phải nộp thêm (20%)
                </p>
              </div>
            </div>

            {/* Help text */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                <strong>Hướng dẫn:</strong> Chọn chi phí từ danh sách chứng từ bên dưới và đánh dấu "Không được trừ" nếu thuế TNDN không cho phép khấu trừ khoản chi phí này (theo Thông tư 99/2025/TT-BTC).
              </p>
            </div>

            {/* List of expense vouchers with toggle */}
            {loadingVouchers ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <p className="text-xs text-slate-500">Đang tải danh sách chi phí...</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {nonDeductibleExpenses.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    Chưa có chi phí nào được đánh dấu "không được trừ"
                  </p>
                ) : (
                  nonDeductibleExpenses.map((expense, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText size={14} className="text-slate-400" />
                          <span className="text-xs font-bold text-slate-700">
                            {expense.voucherNumber}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {expense.voucherDate}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 ml-6">
                          <span className="text-[10px] font-mono font-bold text-slate-500">
                            TK {expense.accountCode}
                          </span>
                          <span className="text-xs text-slate-600">
                            {expense.amount?.toLocaleString('vi-VN')} đ
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => updateNonDeductibleMutation.mutate({
                          voucherId: expense.voucherId,
                          detailId: expense.id,
                          isNonDeductible: true
                        })}
                        disabled={updatingDetail === expense.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition disabled:opacity-50"
                        title="Bỏ đánh dấu không được trừ"
                      >
                        {updatingDetail === expense.id ? (
                          <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <ToggleRight size={14} />
                        )}
                        Không được trừ
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* All expenses list for tagging */}
            {!loadingVouchers && vouchers && vouchers.length > 0 && (
              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-xs font-bold text-slate-700 mb-3">
                  Tất cả chi phí (chọn để đánh dấu không được trừ)
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {vouchers.map(v => 
                    v.details?.filter(dt => {
                      const accCode = dt.accountCode || dt.account_code;
                      return ['632', '635', '641', '642', '811'].some(prefix => accCode?.startsWith(prefix));
                    }).map(dt => {
                      const accCode = dt.accountCode || dt.account_code;
                      const isNonDeductible = dt.is_tax_deductible === false;
                      
                      return (
                        <div key={`${v.id}-${dt.id}`} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200 hover:border-indigo-300 transition">
                          <div className="flex-1">
                            <span className="text-xs text-slate-600">
                              {v.voucher_number} - TK {accCode}
                            </span>
                            <span className="text-xs text-slate-500 ml-2">
                              {parseFloat(dt.amount)?.toLocaleString('vi-VN')} đ
                            </span>
                          </div>
                          <button
                            onClick={() => updateNonDeductibleMutation.mutate({
                              voucherId: v.id,
                              detailId: dt.id,
                              isNonDeductible
                            })}
                            disabled={updatingDetail === dt.id}
                            className={`px-2 py-1 rounded text-xs font-medium transition disabled:opacity-50 ${
                              isNonDeductible
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {updatingDetail === dt.id ? (
                              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : isNonDeductible ? (
                              '✓ Không được trừ'
                            ) : (
                              'Đánh dấu'
                            )}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
