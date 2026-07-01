import React, { useState } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { usePersistentState } from '../../utils/persistence.js';
import { Users, Plus } from 'lucide-react';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';

export default function Payroll() {
  const { createNewVoucher } = useVouchers();
  const [salary, setSalary] = usePersistentState('payroll-form', '');

  const handleCalculatePayroll = async (e) => {
    e.preventDefault();
    if (!salary) return;
    const base = parseFloat(salary);
    const bhxh = Math.round(base * 0.105); // 10.5% trừ lương người lao động theo quy định pháp luật

    // 1. Tính chi phí lương doanh nghiệp gánh chịu
    await createNewVoucher({
      voucherDate: '2026-06-30',
      description: 'Trích chi phí tiền lương phải trả bộ phận quản lý trong tháng',
      accountDr: '6422', accountCr: '3341', amount: base, type: 'Khac'
    });

    // 2. Khấu trừ bảo hiểm xã hội bắt buộc vào lương người lao động
    await createNewVoucher({
      voucherDate: '2026-06-30',
      description: 'Trích khấu trừ bảo hiểm bắt buộc (10.5%) vào lương nhân viên',
      accountDr: '3341', accountCr: '3383', amount: bhxh, type: 'Khac'
    });

    alert('Đã chạy bảng lương tự động và tự động hạch toán ghi sổ kế toán kép thành công!');
    setSalary('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Users className="text-orange-600" size={24} /> PHÂN HỆ TÍNH LƯƠNG & KHẤU TRỪ BẢO HIỂM (334 - 338)</h1>
        <ExportExcelButton endpoint="payroll" filename="Bang_Luong_Bao_Hiem" label="Xuất Excel" />
      </div>
      <div className="bg-white p-6 rounded-2xl border shadow-sm max-w-md space-y-4">
        <form onSubmit={handleCalculatePayroll} className="space-y-3">
          <label className="text-xs font-bold text-slate-500 block">Tổng quỹ lương gộp của doanh nghiệp (Gross Salary)</label>
          <input type="number" required placeholder="Nhập số tiền VND..." value={salary} onChange={e => setSalary(e.target.value)} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" />
          <button type="submit" className="w-full bg-orange-600 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1"><Plus size={14} /> Duyệt & Khóa Sổ Bảng Lương</button>
        </form>
      </div>
    </div>
  );
}
// Payroll.jsx  
//