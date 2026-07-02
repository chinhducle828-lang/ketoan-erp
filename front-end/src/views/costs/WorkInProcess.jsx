import React, { useState, useMemo } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { calculateBalances } from '../../utils/accountingEngine.js'; // Import Engine lõi
import { BookOpenCheck, Layers, ArrowRightLeft, Loader2 } from 'lucide-react';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';

export default function WorkInProcess() {
  const { vouchers, createNewVoucher } = useVouchers();
  const { activeCompany } = useAuth();
  const [wipAmount, setWipAmount] = useState('');
  const [loading, setLoading] = useState(false);

  // SỬ DỤNG ENGINE ĐỂ TÍNH TOÁN ĐỒNG BỘ (Loại bỏ vòng lặp thô sơ)
  const materialCosts = useMemo(() => {
    const ledger = calculateBalances(vouchers);
    return ledger['154'] ? ledger['154'].patsinhDr : 0;
  }, [vouchers]);

  const handleProductIn = async () => {
    const amount = Math.round(parseFloat(wipAmount) || 0);
    if (amount <= 0) {
      alert('Vui lòng nhập giá trị thành phẩm hoàn thành hợp lệ!');
      return;
    }

    setLoading(true);
    const payload = {
      companyId: activeCompany?.id || activeCompany || 1,
      voucherDate: new Date().toISOString().split('T')[0],
      type: 'Kho',
      description: `Kết chuyển chi phí dở dang nhập kho thành phẩm`,
      details: [
        { accountCode: '155', entryType: 'DR', amount },
        { accountCode: '154', entryType: 'CR', amount }
      ]
    };

    try {
      await createNewVoucher(payload);
      setWipAmount('');
      alert('Hạch toán nhập kho thành phẩm thành công!');
    } catch (err) {
      alert('Lỗi hạch toán. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <Layers className="text-sky-600" size={24} /> KẾ TOÁN SẢN XUẤT (TK 154)
        </h1>
        <ExportExcelButton endpoint="vouchers" filename="Chi_Phi_San_Xuat" label="Xuất Excel" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-slate-50 text-slate-400 rounded-xl"><BookOpenCheck size={28} /></div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">Tổng chi phí sản xuất đã tập hợp (Phát sinh Nợ 154)</span>
            <h3 className="text-xl font-black text-slate-800 mt-0.5">{materialCosts.toLocaleString()} đ</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Hạch toán hoàn thành nhập kho thành phẩm</h4>
          <div className="space-y-2">
            <input 
              type="number" placeholder="Giá trị thành phẩm hoàn thành (VND)..." value={wipAmount} onChange={e => setWipAmount(e.target.value)} 
              className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl font-semibold focus:outline-none focus:border-sky-500 transition" 
            />
            <button onClick={handleProductIn} disabled={loading} className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md transition">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRightLeft size={16} />} Ghi Nợ 155 / Có 154
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

//