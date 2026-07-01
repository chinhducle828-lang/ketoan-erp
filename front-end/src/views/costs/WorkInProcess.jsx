import React from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { usePersistentState } from '../../utils/persistence.js';
import { BookOpenCheck, Layers, ArrowRightLeft } from 'lucide-react';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';

export default function WorkInProcess() {
  const { vouchers, createNewVoucher } = useVouchers();
  const [wipAmount, setWipAmount] = usePersistentState('work-in-process-form-v2', '');

  // SỬA LOGIC LỌC: Duyệt sâu vào mảng details của từng chứng từ để tính tổng chi phí phát sinh bên Nợ TK 154
  const materialCosts = vouchers.reduce((sum, v) => {
    const dr154Amount = v.details?.reduce((subSum, d) => {
      if (d.accountCode?.startsWith('154') && d.entryType === 'DR') {
        return subSum + (parseFloat(d.amount) || 0);
      }
      return subSum;
    }, 0) || 0;
    return sum + dr154Amount;
  }, 0);

  const handleProductIn = async () => {
    const amount = parseFloat(wipAmount) || 0;
    if (amount <= 0) {
      alert('Vui lòng nhập giá trị thành phẩm hoàn thành hợp lệ!');
      return;
    }

    // Khởi tạo cấu trúc Master-Detail kết chuyển: Nợ 155 / Có 154 (Chuẩn kế toán sản xuất)
    const details = [
      {
        accountCode: '155', // Ghi Nợ 155 - Tăng kho thành phẩm
        entryType: 'DR',
        amount: amount
      },
      {
        accountCode: '154', // Ghi Có 154 - Giảm chi phí sản xuất dở dang
        entryType: 'CR',
        amount: amount
      }
    ];

    try {
      await createNewVoucher({
        voucherDate: '2026-06-30',
        description: 'Nhập kho thành phẩm hoàn thành từ xưởng sản xuất dở dang',
        type: 'Khac',
        details: details // Đẩy mảng định khoản chi tiết cân bằng Nợ-Có
      });

      setWipAmount('');
      alert(`Đã hạch toán nhập kho thành phẩm thành công!\n- Nợ TK 155 / Có TK 154: ${amount.toLocaleString()} đ`);
    } catch (error) {
      console.error(error);
      alert('Lỗi hệ thống, không thể kết chuyển giá thành!');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <BookOpenCheck className="text-sky-600" size={24} /> TẬP HỢP CHI PHÍ & TÍNH GIÁ THÀNH SẢN XUẤT DỞ DANG (154)
        </h1>
        <ExportExcelButton endpoint="production-costs" filename="Chi_Phi_San_Xuat" label="Xuất Excel" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Khối hiển thị tổng chi phí tập hợp */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-sky-50 text-sky-600 rounded-xl"><Layers size={24} /></div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">
              Tổng chi phí sản xuất đã tập hợp (Phát sinh Nợ 154)
            </span>
            <h3 className="text-xl font-black text-slate-800 mt-0.5">
              {materialCosts.toLocaleString()} đ
            </h3>
          </div>
        </div>

        {/* Khối xử lý kết chuyển thành phẩm */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
            Hạch toán hoàn thành nhập kho thành phẩm
          </h4>
          <div className="space-y-2">
            <input 
              type="number" 
              placeholder="Giá trị thành phẩm hoàn thành (VND)..." 
              value={wipAmount} 
              onChange={e => setWipAmount(e.target.value)} 
              className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl font-semibold focus:outline-none focus:border-sky-500 transition" 
            />
            <button 
              onClick={handleProductIn} 
              className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1 shadow-sm transition"
            >
              <ArrowRightLeft size={14} /> Kết chuyển Nợ 155 / Có 154
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}