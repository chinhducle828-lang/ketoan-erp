import React, { useMemo } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { Percent } from 'lucide-react';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';

export default function TaxReporting() {
  const { vouchers } = useVouchers();

  // Đọc hiểu sâu mảng chứng từ đa dòng để bóc tách Thuế
  const { vatInput, vatOutput } = useMemo(() => {
    let input = 0, output = 0;
    vouchers.forEach(v => {
      if (v.details && Array.isArray(v.details)) {
        v.details.forEach(dt => {
          if (dt.accountCode === '1331' && dt.entryType === 'DR') {
            input += parseFloat(dt.amount) || 0;
          }
          if (dt.accountCode === '3331' && dt.entryType === 'CR') {
            output += parseFloat(dt.amount) || 0;
          }
        });
      }
    });
    return { vatInput: input, vatOutput: output };
  }, [vouchers]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <Percent className="text-rose-600" size={24} /> TỔNG HỢP THUẾ GTGT (MẪU 01/GTGT)
        </h1>
        <ExportExcelButton endpoint="vouchers" filename="To_Khai_Thue_GTGT" label="Xuất Excel Dữ Liệu" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
            Thuế GTGT đầu vào được khấu trừ (Nợ TK 1331)
          </span>
          <h3 className="text-2xl font-black text-emerald-600 mt-2">{vatInput.toLocaleString('vi-VN')} đ</h3>
        </div>
        <div className="bg-white p-5 rounded-2xl border shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
            Thuế GTGT đầu ra phải nộp (Có TK 3331)
          </span>
          <h3 className="text-2xl font-black text-orange-600 mt-2">{vatOutput.toLocaleString('vi-VN')} đ</h3>
        </div>
        <div className="p-5 rounded-2xl border shadow-sm bg-slate-900 text-white">
          <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
            {vatOutput > vatInput ? 'Nghĩa vụ phải nộp thêm kỳ này' : 'Thuế còn được khấu trừ chuyển kỳ sau'}
          </span>
          <h3 className="text-2xl font-black text-white mt-2">
            {Math.abs(vatOutput - vatInput).toLocaleString('vi-VN')} đ
          </h3>
        </div>
      </div>
    </div>
  );
}