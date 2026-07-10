/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

// FILE_PATH: front-end/src/views/hr/Payroll.jsx
import React, { useState } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { usePersistentState } from '../../utils/persistence.js';
import { buildPayrollInsuranceDetails } from '../../utils/accountingRules.js';
import { Users, Plus } from 'lucide-react';
import { useSocket } from '../../context/SocketContext.jsx';
import { useRealtimeInvalidation } from '../../hooks/useRealtimeInvalidation.js';
import { useRealTimeSync } from '../../hooks/useRealTimeSync.js';
import { getAccountsByDepartment, ACCOUNTS_TT99 } from '../../constants/accountsTT99.js';
import { WORKFLOW_EVENTS } from '../../workflow/accountingWorkflow.js';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';

export default function Payroll() {
  const { createNewVoucher } = useVouchers();
  const { activeCompany } = useAuth(); // Theo dõi công ty động đang làm việc
  const [salary, setSalary] = usePersistentState('payroll-form-v2', '');
  // BỔ SUNG STATE: Quản lý Thuế TNCN ước tính từ bảng lương
  const [taxTNCN, setTaxTNCN] = useState('');
  const [msg, setMsg] = useState('');

  const handleCalculatePayroll = async (e) => {
    e.preventDefault();
    setMsg('');
    const base = Math.round(parseFloat(salary) || 0);
    const totalTaxTNCN = Math.round(parseFloat(taxTNCN) || 0);

    if (base <= 0) {
      alert('Vui lòng nhập tổng quỹ lương hợp lệ!');
      return;
    }

    // Đọc thông tin mã công ty hiện tại từ context lõi của hệ thống
    const currentCompanyId = activeCompany?.id || activeCompany || 1;
    
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    const { details } = buildPayrollInsuranceDetails(base, totalTaxTNCN);

    const payload = {
      company_id: currentCompanyId,
      voucher_date: lastDayOfMonth,
      type: 'TL', 
      description: `Hạch toán tổng hợp chi phí tiền lương, thuế TNCN và các khoản trích bảo hiểm bắt buộc - Tháng ${today.getMonth() + 1}/${today.getFullYear()}`,
      amount: base, 
      details: details // Toàn bộ mảng 7 dòng cân bằng Nợ - Có đẩy lên Engine
    };

    try {
      await createNewVoucher(payload);
      setSalary('');
      setTaxTNCN('');
      setMsg('Đã tự động hạch toán lương, trích bảo hiểm và khấu trừ thuế TNCN thành công!');
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
        <ExportExcelButton endpoint="vouchers" filename="Bang_Trich_Luong_BHXH" label="Xuất bảng trích" accountCodes={ACCOUNTS_TT99.filter(a => a.group === 'payroll' || a.group === 'tax').map(a => a.code)} />
      </div>
      
      <div className="bg-white p-6 rounded-2xl border shadow-sm max-w-md space-y-4">
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] rounded-xl font-medium leading-relaxed">
          💡 <b>Quy tắc hạch toán kép tích hợp:</b> Ghi nhận toàn bộ chi phí lương (Nợ 6422/Có 334), trích khấu trừ thuế TNCN (Nợ 334/Có 3331). Đồng thời, tự động tính trích 32% BHXH, BHYT, BHTN tương ứng phân bổ theo quy định.
        </div>

        {msg && (
          <div className="p-3 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl">
            {msg}
          </div>
        )}

        <form onSubmit={handleCalculatePayroll} className="space-y-3">
          {/* Input 1: Tổng quỹ lương */}
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1 tracking-wider">
              Tổng quỹ lương gộp của doanh nghiệp (Gross Salary)
            </label>
            <input 
              type="number" 
              required 
              placeholder="Nhập tổng quỹ lương gộp VND..." 
              value={salary} 
              onChange={e => setSalary(e.target.value)} 
              className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl font-semibold focus:outline-none focus:border-orange-500 transition" 
            />
          </div>

          {/* BỔ SUNG INPUT 2: Tổng số thuế TNCN khấu trừ */}
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1 tracking-wider">
              Tổng số thuế TNCN khấu trừ tại nguồn (Nếu có)
            </label>
            <input 
              type="number" 
              placeholder="Nhập tổng thuế TNCN VND..." 
              value={taxTNCN} 
              onChange={e => setTaxTNCN(e.target.value)} 
              className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl font-semibold focus:outline-none focus:border-orange-500 transition" 
            />
          </div>
          
          <button 
            type="submit" 
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all"
          >
            <Plus size={14} /> Duyệt & Hạch Toán Sổ Cái
          </button>
        </form>
      </div>
    </div>
  );
}