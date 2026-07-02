import React, { useState } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { Wallet, Plus, Trash2, Loader2 } from 'lucide-react';

export default function CashManagement() {
  const { vouchers, createNewVoucher, removeVoucher } = useVouchers();
  const { activeCompany } = useAuth();
  
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    desc: '',
    details: [
      { accountCode: '1111', entryType: 'DR', amount: '' },
      { accountCode: '131', entryType: 'CR', amount: '' }
    ]
  });
  const [loading, setLoading] = useState(false);

  const cashVouchers = vouchers.filter(v => v.type === 'PT' || v.type === 'PC');

  const handleDetailChange = (index, field, value) => {
    const newDetails = [...form.details];
    newDetails[index][field] = field === 'accountCode' ? value.toUpperCase() : value;
    setForm({ ...form, details: newDetails });
  };

  const handleAddVoucher = async (e, type) => {
    e.preventDefault();
    
    // Validate Cân đối Nợ / Có
    const processedDetails = form.details.map(d => ({ ...d, amount: Math.round(parseFloat(d.amount) || 0) }));
    const totalDr = processedDetails.filter(d => d.entryType === 'DR').reduce((s, d) => s + d.amount, 0);
    const totalCr = processedDetails.filter(d => d.entryType === 'CR').reduce((s, d) => s + d.amount, 0);

    if (totalDr !== totalCr || totalDr === 0) return alert('Hạch toán mất cân đối hoặc bằng 0!');

    setLoading(true);
    try {
      await createNewVoucher({
        companyId: activeCompany?.id || activeCompany || 1,
        voucherDate: form.date,
        type: type,
        description: form.desc,
        details: processedDetails
      });
      setForm({ date: new Date().toISOString().split('T')[0], desc: '', details: [{ accountCode: '1111', entryType: 'DR', amount: '' }, { accountCode: '', entryType: 'CR', amount: '' }]});
    } catch (err) { alert('Lỗi tạo chứng từ!'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-black text-slate-800 flex items-center gap-2"><Wallet className="text-emerald-600" size={24} /> PHIẾU THU / CHI TIỀN</h1>
      
      <div className="bg-white p-6 rounded-2xl border shadow-sm max-w-2xl space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" required />
          <input type="text" placeholder="Nội dung thu/chi..." value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} className="w-full text-xs p-2.5 bg-slate-50 border rounded-xl" required />
        </div>

        <div className="space-y-2 border rounded-xl p-4 bg-slate-50">
          {form.details.map((dt, idx) => (
            <div key={idx} className="flex gap-2">
              <select value={dt.entryType} onChange={e => handleDetailChange(idx, 'entryType', e.target.value)} className="p-2 border rounded-lg text-xs font-bold text-slate-700 outline-none">
                <option value="DR">NỢ</option>
                <option value="CR">CÓ</option>
              </select>
              <input type="text" placeholder="TK (1111, 112)" value={dt.accountCode} onChange={e => handleDetailChange(idx, 'accountCode', e.target.value)} className="w-24 p-2 border rounded-lg text-xs font-mono outline-none" required />
              <input type="number" placeholder="Số tiền..." value={dt.amount} onChange={e => handleDetailChange(idx, 'amount', e.target.value)} className="flex-1 p-2 border rounded-lg text-xs outline-none text-right font-mono" required />
            </div>
          ))}
          <button type="button" onClick={() => setForm({...form, details: [...form.details, { accountCode: '', entryType: 'DR', amount: '' }]})} className="text-[10px] font-bold text-slate-500 hover:text-emerald-600">+ Thêm dòng hạch toán</button>
        </div>

        <div className="flex gap-3">
          <button onClick={e => handleAddVoucher(e, 'PT')} disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 rounded-xl flex justify-center items-center">Phiếu Thu (PT)</button>
          <button onClick={e => handleAddVoucher(e, 'PC')} disabled={loading} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2.5 rounded-xl flex justify-center items-center">Phiếu Chi (PC)</button>
        </div>
      </div>
    </div>
  );
}