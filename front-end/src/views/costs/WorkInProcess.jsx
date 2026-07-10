/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState, useMemo } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { calculateBalances } from '../../utils/accountingEngine.js'; 
import { getDefaultCurrency } from '../../utils/accountingRules.js';
import VoucherFormTemplate from '../../components/VoucherFormTemplate.jsx';
import { BookOpenCheck, Loader2 } from 'lucide-react';

export default function WorkInProcess() {
  const { vouchers, createNewVoucher } = useVouchers();
  const { activeCompany } = useAuth();
  const [wipAmount, setWipAmount] = useState('');
  const [loading, setLoading] = useState(false);

  // Dùng Engine dồn tích để lấy tổng chi phí sản xuất dở dang (Nợ 154)
  const materialCosts = useMemo(() => {
    const ledger = calculateBalances(vouchers);
    return ledger['154'] ? ledger['154'].patsinhDr : 0;
  }, [vouchers]);

  const handleProductIn = async () => {
    const amount = Math.round(parseFloat(wipAmount) || 0);
    const companyId = activeCompany?.id ?? activeCompany;

    if (amount <= 0) return alert('Vui lòng nhập giá trị thành phẩm hoàn thành hợp lệ!');
    if (!companyId) return alert('Vui lòng chọn doanh nghiệp!');

    setLoading(true);
    const payload = {
      companyId: parseInt(companyId, 10),
      voucherDate: new Date().toISOString().split('T')[0],
      type: 'NK', // Phiếu Nhập Kho
      description: `Nhập kho thành phẩm hoàn thành sản xuất`,
      currency: getDefaultCurrency(),
      exchangeRate: 1,
      details: [
        { accountCode: '155', entryType: 'DR', amount: amount },
        { accountCode: '154', entryType: 'CR', amount: amount } 
      ]
    };

    try {
      await createNewVoucher(payload);
      alert('Đã kết chuyển nhập kho thành phẩm thành công!');
      setWipAmount('');
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi khóa sổ hoặc kết nối!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-xl font-black text-slate-800">TẬP HỢP CHI PHÍ & TÍNH GIÁ THÀNH (TK 154)</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-slate-50 text-slate-400 rounded-xl"><BookOpenCheck size={28} /></div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase block tracking-wider">Tổng chi phí sản xuất dở dang (Phát sinh Nợ 154)</span>
            <h3 className="text-xl font-black text-slate-800 mt-0.5">{materialCosts.toLocaleString('vi-VN')} đ</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Hạch toán hoàn thành nhập kho thành phẩm</h4>
          <div className="space-y-2">
            <input 
              type="number" placeholder="Giá trị thành phẩm hoàn thành (VND)..." 
              value={wipAmount} onChange={e => setWipAmount(e.target.value)} 
              className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl font-semibold outline-none" 
            />
            <button onClick={handleProductIn} disabled={loading} className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 text-white font-bold text-xs py-2.5 rounded-xl flex justify-center items-center gap-2 transition">
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Ghi sổ Nợ 155 / Có 154'}
            </button>
          </div>
        </div>
      </div>

      <VoucherFormTemplate
        moduleType="costs"
        title="Tạo chứng từ chi phí / giá thành"
        description="Hạch toán chi phí sản xuất, giá thành (TK 154, 155, 621, 622, 627...)"
        defaultVoucherType="PKT"
        accountGroupFilter={['wip', 'costs', 'manufacturing', 'inventory', 'prepaid']}
      />
    </div>
  );
}
