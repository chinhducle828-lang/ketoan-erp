import React from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { Percent, Landmark } from 'lucide-react';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';

export default function TaxReporting() {
  const { vouchers } = useVouchers();

  let vatInput = 0;  // Thuế GTGT đầu vào được khấu trừ (TK 1331)
  let vatOutput = 0; // Thuế GTGT đầu ra phải nộp (TK 3331)

  // Đọc hiểu sâu mảng chứng từ kết hợp cơ chế Fallback an toàn dữ liệu
  vouchers.forEach(v => {
    if (v.details && Array.isArray(v.details)) {
      // 1. Quét cấu trúc hạch toán đa dòng mới tương thích Engine lõi
      v.details.forEach(dt => {
        if (dt.accountCode === '1331' && dt.entryType === 'DR') {
          vatInput += parseFloat(dt.amount) || 0;
        }
        if (dt.accountCode === '3331' && dt.entryType === 'CR') {
          vatOutput += parseFloat(dt.amount) || 0;
        }
      });
    } else {
      // 2. Cơ chế Fallback dự phòng cho chứng từ phẳng ngày xưa
      if (v.account_dr === '1331') vatInput += parseFloat(v.amount) || 0;
      if (v.account_cr === '3331') vatOutput += parseFloat(v.amount) || 0;
    }
  });

  const payableVat = vatOutput - vatInput;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <Percent className="text-rose-600" size={24} /> TỜ KHAI TỔNG HỢP NGHĨA VỤ THUẾ GTGT (MẪU 01/GTGT)
        </h1>
        <ExportExcelButton endpoint="vouchers" filename="To_Khai_Thue_GTGT" label="Xuất Excel" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
            Thuế GTGT đầu vào tích lũy (TK 1331)
          </span>
          <h3 className="text-lg font-black text-emerald-600 mt-1">{vatInput.toLocaleString()} đ</h3>
        </div>
        <div className="bg-white p-5 rounded-2xl border shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
            Thuế GTGT đầu ra phát sinh (TK 3331)
          </span>
          <h3 className="text-lg font-black text-orange-600 mt-1">{vatOutput.toLocaleString()} đ</h3>
        </div>
        <div className="bg-white p-5 rounded-2xl border shadow-sm bg-slate-900 text-white">
          <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
            Nghĩa vụ Thuế GTGT cuối kỳ (+ Phải nộp / - Khấu trừ)
          </span>
          <h3 className={`text-lg font-black mt-1 ${payableVat >= 0 ? 'text-rose-400' : 'text-cyan-400'}`}>
            {payableVat.toLocaleString()} đ
          </h3>
        </div>
      </div>
    </div>
  );
}