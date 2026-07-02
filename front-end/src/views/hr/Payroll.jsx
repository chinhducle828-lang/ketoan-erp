import React, { useState } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { usePersistentState } from '../../utils/persistence.js';
import { Users, Plus, Calendar } from 'lucide-react';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';

// Hàm helper: Tính ngày cuối cùng của tháng hiện tại (Định dạng YYYY-MM-DD)
const getDefaultVoucherDate = () => {
  const today = new Date();
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const year = lastDay.getFullYear();
  const month = String(lastDay.getMonth() + 1).padStart(2, '0');
  const day = String(lastDay.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function Payroll() {
  const { createNewVoucher } = useVouchers();
  const [salary, setSalary] = usePersistentState('payroll-form-v2', '');
  
  // 1. CHUYỂN NGÀY THÀNH STATE: Khởi tạo giá trị mặc định là ngày cuối tháng này
  const [voucherDate, setVoucherDate] = useState(getDefaultVoucherDate());

  const handleCalculatePayroll = async (e) => {
    e.preventDefault();
    const base = Math.round(parseFloat(salary) || 0);

    if (base <= 0) {
      alert('Vui lòng nhập tổng quỹ lương hợp lệ!');
      return;
    }

    if (!voucherDate) {
      alert('Vui lòng chọn ngày hạch toán chứng từ!');
      return;
    }

    // Lấy ID doanh nghiệp hiện tại từ LocalStorage
    const currentCompanyId = Number(localStorage.getItem('current_company_id')) || 1;
    
    // Trích xuất tháng/năm động dựa trên ngày hạch toán mà kế toán đã chọn trên UI
    const chosenDate = new Date(voucherDate);
    const selectedMonth = chosenDate.getMonth() + 1;
    const selectedYear = chosenDate.getFullYear();

    // -----------------------------------------------------------------
    // LOGIC TÍNH TOÁN BẢO HIỂM CHUẨN DOANH NGHIỆP VIỆT NAM (Tổng 32%)
    // -----------------------------------------------------------------
    const envInsurance = Math.round(base * 0.105); // 10.5% Người lao động chịu
    const compInsurance = Math.round(base * 0.215); // 21.5% Doanh nghiệp gánh chịu
    
    const netSalary = base - envInsurance;          // Lương Net thực lĩnh
    const totalInsurance = envInsurance + compInsurance; // Tổng nghĩa vụ nộp BHXH (32%)

    // Khởi tạo lưới định khoản đa dòng (Multi-line Ledger)
    const details = [
      { accountCode: '6422', entryType: 'DR', amount: base }, 
      { accountCode: '6422', entryType: 'DR', amount: compInsurance }, 
      { accountCode: '3341', entryType: 'CR', amount: netSalary }, 
      { accountCode: '3383', entryType: 'CR', amount: totalInsurance }
    ];

    // KIỂM TRA CÂN ĐỐI KẾ TOÁN (Sửa sai số 1 đồng nếu có)
    const drSum = details.filter(d => d.entryType === 'DR').reduce((sum, d) => sum + d.amount, 0);
    const crSum = details.filter(d => d.entryType === 'CR').reduce((sum, d) => sum + d.amount, 0);
    const diff = drSum - crSum;
    
    if (diff !== 0) {
      details[2].amount += diff; // Bù trừ chênh lệch vào dòng 3341
    }

    try {
      // Đẩy payload với ngày hạch toán động đã chọn
      const response = await createNewVoucher({
        voucherDate: voucherDate, // Sử dụng State ngày hạch toán động
        description: `Tính lương và trích các khoản bảo hiểm bắt buộc (32%) kỳ tháng ${selectedMonth}/${selectedYear}`,
        type: 'Khac',
        companyId: currentCompanyId,
        details: details
      });

      if (response && !response.success) {
        throw new Error(response.error || 'Backend từ chối ghi sổ!');
      }

      alert(
        `🎉 DUYỆT & TRÍCH LƯƠNG THÀNH CÔNG!\n` +
        `-----------------------------------------\n` +
        `Ngày hạch toán: ${voucherDate}\n` +
        `Kỳ kế toán: Tháng ${selectedMonth}/${selectedYear}\n` +
        `-----------------------------------------\n` +
        `1. Tổng Chi phí DN chịu (6422): ${(base + compInsurance).toLocaleString()} đ\n` +
        `2. Lương thực trả nhân viên (3341): ${details[2].amount.toLocaleString()} đ\n` +
        `3. Tổng tiền phải nộp cơ quan BHXH (3383): ${totalInsurance.toLocaleString()} đ`
      );
      setSalary('');
    } catch (error) {
      console.error(error);
      alert(`Thao tác thất bại: ${error.message || 'Lỗi hệ thống CSDL không thể ghi sổ.'}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <Users className="text-orange-600" size={24} /> PHÂN HỆ TÍNH LƯƠNG & TRÍCH BẢO HIỂM CHUẨN (32%)
        </h1>
        <ExportExcelButton endpoint="payroll" filename="Bang_Luong_Bao_Hiem" label="Xuất Excel" />
      </div>
      
      <div className="bg-white p-6 rounded-2xl border shadow-sm max-w-md space-y-4">
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] rounded-xl font-medium leading-relaxed">
          💡 <b>Quy tắc trích lương thực tế:</b> Hệ thống tự động bóc tách 10.5% trừ vào lương nhân viên và tự động tính thêm 21.5% vào tài khoản chi phí quản lý doanh nghiệp (6422).
        </div>

        <form onSubmit={handleCalculatePayroll} className="space-y-4">
          {/* 2. GIAO DIỆN CHỌN NGÀY ĐỘNG CHO KẾ TOÁN */}
          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1 mb-1.5 tracking-wider">
              <Calendar size={12} className="text-slate-400" /> Ngày hạch toán chứng từ
            </label>
            <input 
              type="date" 
              required 
              value={voucherDate} 
              onChange={e => setVoucherDate(e.target.value)} 
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-orange-500 focus:bg-white transition" 
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1.5 tracking-wider">
              Tổng quỹ lương gộp của doanh nghiệp (Gross Salary)
            </label>
            <input 
              type="number" 
              required 
              placeholder="Nhập số tiền VND..." 
              value={salary} 
              onChange={e => setSalary(e.target.value)} 
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold focus:outline-none focus:border-orange-500 focus:bg-white transition" 
            />
          </div>
          
          <button 
            type="submit" 
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1 shadow-sm transition duration-200"
          >
            <Plus size={14} /> Duyệt & Khóa Sổ Bảng Lương
          </button>
        </form>
      </div>
    </div>
  );
}