import React from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { usePersistentState } from '../../utils/persistence.js';
import { Users, Plus } from 'lucide-react';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';

export default function Payroll() {
  const { createNewVoucher } = useVouchers();
  const [salary, setSalary] = usePersistentState('payroll-form-v2', '');

  const handleCalculatePayroll = async (e) => {
    e.preventDefault();
    const base = Math.round(parseFloat(salary) || 0);

    if (base <= 0) {
      alert('Vui lòng nhập tổng quỹ lương hợp lệ!');
      return;
    }

    // Lấy ID doanh nghiệp hiện tại từ URL hoặc LocalStorage để tránh ép cứng dữ liệu
    const currentCompanyId = Number(localStorage.getItem('current_company_id')) || 1;
    
    // Tự động lấy ngày cuối cùng của tháng hiện tại thay vì hardcode năm 2026
    const today = new Date();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    // -----------------------------------------------------------------
    // LOGIC TÍNH TOÁN BẢO HIỂM CHUẨN DOANH NGHIỆP VIỆT NAM (Tổng 32%)
    // -----------------------------------------------------------------
    const envInsurance = Math.round(base * 0.105); // 10.5% Người lao động chịu (Trừ vào lương)
    const compInsurance = Math.round(base * 0.215); // 21.5% Doanh nghiệp gánh chịu (Tính vào chi phí)
    
    const netSalary = base - envInsurance;          // Lương Net thực lĩnh của nhân viên
    const totalInsurance = envInsurance + compInsurance; // Tổng nghĩa vụ phải nộp cơ quan BHXH (32%)

    // Khởi tạo lưới định khoản đa dòng (Multi-line Ledger) triệt tiêu hoàn toàn sai số
    const details = [
      {
        accountCode: '6422', // 1. Tính chi phí lương gộp vào CP Quản lý
        entryType: 'DR',
        amount: base
      },
      {
        accountCode: '6422', // 2. Tính phần chi phí BH công ty chịu vào CP Quản lý
        entryType: 'DR',
        amount: compInsurance
      },
      {
        accountCode: '3341', // 3. Ghi nhận nghĩa vụ phải trả lương Net cho CNV
        entryType: 'CR',
        amount: netSalary
      },
      {
        accountCode: '3383', // 4. Ghi nhận tổng nghĩa vụ BHXH phải nộp (32%)
        entryType: 'CR',
        amount: totalInsurance
      }
    ];

    // KIỂM TRA CÂN ĐỐI KẾ TOÁN TRƯỚC KHI BẮN API (Dòng cuối gánh sai số nếu có lệch 1đ)
    const drSum = details.filter(d => d.entryType === 'DR').reduce((sum, d) => sum + d.amount, 0);
    const crSum = details.filter(d => d.entryType === 'CR').reduce((sum, d) => sum + d.amount, 0);
    const diff = drSum - crSum;
    
    if (diff !== 0) {
      // Nếu có lệch 1 đồng do làm tròn, cộng số chênh lệch vào dòng lương phải trả 3341
      details[2].amount += diff;
    }

    try {
      // Đẩy payload đồng bộ hoàn toàn với Zod Validation ở Backend Router
      const response = await createNewVoucher({
        voucherDate: lastDayOfMonth,
        description: `Tính lương và trích các khoản bảo hiểm bắt buộc (32%) kỳ tháng ${today.getMonth() + 1}/${today.getFullYear()}`,
        type: 'Khac',
        companyId: currentCompanyId, // Đồng bộ trường bắt buộc
        details: details
      });

      if (response && !response.success) {
        throw new Error(response.error || 'Backend từ chối ghi sổ!');
      }

      alert(
        `🎉 DUYỆT & TRÍCH LƯƠNG THÀNH CÔNG!\n` +
        `-----------------------------------------\n` +
        `1. Tổng Chi phí DN chịu (6422): ${(base + compInsurance).toLocaleString()} đ\n` +
        `   - Trong đó lương gộp: ${base.toLocaleString()} đ\n` +
        `   - Trong đó BH công ty gánh: ${compInsurance.toLocaleString()} đ\n` +
        `2. Lương thực trả nhân viên (3341): ${netSalary.toLocaleString()} đ\n` +
        `3. Tổng tiền phải nộp cơ quan BHXH (3383 - 32%): ${totalInsurance.toLocaleString()} đ`
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
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1 shadow-sm transition duration-200"
          >
            <Plus size={14} /> Duyệt & Khóa Sổ Bảng Lương
          </button>
        </form>
      </div>
    </div>
  );
}