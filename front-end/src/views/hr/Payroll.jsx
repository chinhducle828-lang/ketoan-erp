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
    const base = parseFloat(salary) || 0;

    if (base <= 0) {
      alert('Vui lòng nhập tổng quỹ lương hợp lệ!');
      return;
    }

    const bhxh = Math.round(base * 0.105); // 10.5% khấu trừ bảo hiểm xã hội bắt buộc
    const netSalary = base - bhxh;        // Số tiền thực lĩnh phải trả cho CNV

    // Khởi tạo mảng chi tiết hạch toán đồng bộ (Master-Detail) cho nghiệp vụ tính lương
    const details = [
      {
        accountCode: '6422', // Ghi Nợ 6422 - Chi phí quản lý doanh nghiệp (Tổng lương gộp)
        entryType: 'DR',
        amount: base
      },
      {
        accountCode: '3383', // Ghi Có 3383 - Bảo hiểm xã hội bắt buộc trích theo lương
        entryType: 'CR',
        amount: bhxh
      },
      {
        accountCode: '3341', // Ghi Có 3341 - Phải trả công nhân viên (Lương thực nhận Net)
        entryType: 'CR',
        amount: netSalary
      }
    ];

    try {
      // Phát hành 1 chứng từ duy nhất lên Backend
      await createNewVoucher({
        voucherDate: '2026-06-30',
        description: 'Tính lương và trích khấu trừ bảo hiểm bắt buộc (10.5%) cuối tháng',
        type: 'Khac',
        details: details // Mảng hạch toán chi tiết
      });

      alert(`Đã duyệt bảng lương & tự động hạch toán thành công!\n- Chi phí lương (6422): ${base.toLocaleString()} đ\n- Khấu trừ BHXH (3383): ${bhxh.toLocaleString()} đ\n- Thực trả CNV (3341): ${netSalary.toLocaleString()} đ`);
      setSalary('');
    } catch (error) {
      console.error(error);
      alert('Lỗi hệ thống, không thể phát hành chứng từ tiền lương!');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <Users className="text-orange-600" size={24} /> PHÂN HỆ TÍNH LƯƠNG & KHẤU TRỪ BẢO HIỂM (334 - 338)
        </h1>
        <ExportExcelButton endpoint="payroll" filename="Bang_Luong_Bao_Hiem" label="Xuất Excel" />
      </div>
      
      <div className="bg-white p-6 rounded-2xl border shadow-sm max-w-md space-y-4">
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