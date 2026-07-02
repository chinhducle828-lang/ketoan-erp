import React, { useState } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePersistentState } from '../../utils/persistence.js';
import { Users, Plus } from 'lucide-react';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';

export default function Payroll() {
  const { createNewVoucher } = useVouchers();
  const { activeCompany } = useAuth(); // Theo dõi công ty động đang làm việc
  const [salary, setSalary] = usePersistentState('payroll-form-v2', '');
  const [msg, setMsg] = useState('');

  const handleCalculatePayroll = async (e) => {
    e.preventDefault();
    setMsg('');
    const base = Math.round(parseFloat(salary) || 0);

    if (base <= 0) {
      alert('Vui lòng nhập tổng quỹ lương hợp lệ!');
      return;
    }

    // Đọc thông tin mã công ty hiện tại từ context lõi của hệ thống
    const currentCompanyId = activeCompany?.id || activeCompany || 1;
    
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    // -----------------------------------------------------------------
    // LOGIC CẤU TRÚC ĐỊNH KHOẢN ĐA DÒNG (MULTI-ROW CHUẨN TỶ LỆ TRÍCH 32%)
    // -----------------------------------------------------------------
    const companyInsurance = Math.round(base * 0.215);  // 21.5% tính trực tiếp vào chi phí doanh nghiệp gánh
    const employeeInsurance = Math.round(base * 0.105); // 10.5% khấu trừ trực tiếp vào lương người lao động
    
    // Tách chi tiết cấu trúc tài khoản cấp 4 để bộ Engine tính toán tự động gom nhóm lên TK cha 338
    const bhxhCr = Math.round(base * 0.175) + Math.round(base * 0.08);   // Tổng 25.5% BHXH (TK 3383)
    const bhytCr = Math.round(base * 0.03) + Math.round(base * 0.015);    // Tổng 4.5% BHYT (TK 3384)
    const bhtnCr = Math.round(base * 0.01) + Math.round(base * 0.01);     // Tổng 2% BHTN (TK 3386)

    const details = [
      {
        accountCode: '6422', // Dòng 1: Tính vào Chi phí QLDN
        entryType: 'DR',
        amount: companyInsurance
      },
      {
        accountCode: '334',  // Dòng 2: Giảm khoản phải trả công nhân viên (khấu trừ lương)
        entryType: 'DR',
        amount: employeeInsurance
      },
      {
        accountCode: '3383', // Dòng 3: Tăng nghĩa vụ phải nộp Quỹ BHXH
        entryType: 'CR',
        amount: bhxhCr
      },
      {
        accountCode: '3384', // Dòng 4: Tăng nghĩa vụ phải nộp Quỹ BHYT
        entryType: 'CR',
        amount: bhytCr
      },
      {
        accountCode: '3386', // Dòng 5: Tăng nghĩa vụ phải nộp Quỹ BHTN
        entryType: 'CR',
        amount: bhtnCr
      }
    ];

    const payload = {
      company_id: currentCompanyId,
      voucher_date: lastDayOfMonth,
      type: 'TL', // Ký hiệu Phân hệ Tiền lương
      description: `Trích tính chi phí lương & bảo hiểm bắt buộc tỷ lệ 32% - Tháng ${today.getMonth() + 1}/${today.getFullYear()}`,
      amount: base, 
      details: details // Đẩy mảng đa dòng trực tiếp phục vụ Engine tính toán
    };

    try {
      await createNewVoucher(payload);
      setSalary('');
      setMsg('Đã trích tính bảo hiểm lương và tự động ghi Sổ cái thành công!');
    } catch (err) {
      alert('Lỗi đẩy chứng từ tiền lương lên hệ thống.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <Users className="text-orange-600" size={24} /> PHÂN HỆ TIỀN LƯƠNG & TRÍCH THEO LƯƠNG
        </h1>
        <ExportExcelButton endpoint="vouchers" filename="Bang_Trich_Luong_BHXH" label="Xuất bảng trích" />
      </div>
      
      <div className="bg-white p-6 rounded-2xl border shadow-sm max-w-md space-y-4">
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] rounded-xl font-medium leading-relaxed">
          💡 <b>Quy tắc trích lương hệ thống:</b> Tự động tính 10.5% trừ vào lương nhân viên (Nợ 334) và tính thêm 21.5% vào tài khoản chi phí quản lý doanh nghiệp (Nợ 6422), đối ứng ghi tăng toàn bộ các quỹ bảo hiểm bắt buộc (Có 338).
        </div>

        {msg && (
          <div className="p-3 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl">
            {msg}
          </div>
        )}

        <form onSubmit={handleCalculatePayroll} className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1 tracking-wider">
              Tổng quỹ lương gộp của doanh nghiệp (Gross Salary)
            </label>
            <input 
              type="number" 
              required 
              placeholder="Nhập số tiền VND..." 
              value={salary} 
              onChange={e => setSalary(e.target.value)} 
              className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl font-semibold focus:outline-none focus:border-orange-500 transition" 
            />
          </div>
          
          <button 
            type="submit" 
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all"
          >
            <Plus size={14} /> Trích BHXH & Ghi Sổ Hệ Thống
          </button>
        </form>
      </div>
    </div>
  );
}