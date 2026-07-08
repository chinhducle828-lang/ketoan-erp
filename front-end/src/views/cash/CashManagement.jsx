/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState, useEffect } from 'react';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { Wallet, Trash2, Loader2 } from 'lucide-react';
import api from '../../utils/api.js';
import { getDefaultCurrency } from '../../utils/accountingRules.js';

export default function CashManagement() {
  const { vouchers, createNewVoucher, removeVoucher } = useVouchers();
  const { activeCompany } = useAuth();
  
  const [partners, setPartners] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    desc: '',
    partnerId: '',
    currency: getDefaultCurrency(),
    exchangeRate: 1,     
    details: [
      { accountCode: '1111', entryType: 'DR', amount: '' },
      { accountCode: '131', entryType: 'CR', amount: '' }
    ]
  });

  useEffect(() => {
    if (activeCompany) {
      const companyId = activeCompany?.id ?? activeCompany;
      api.get(`/partners?company_id=${companyId}`)
         .then(res => setPartners(res.data))
         .catch(() => {});
    }
  }, [activeCompany]);

  const handleDetailChange = (index, field, value) => {
    const newDetails = [...form.details];
    newDetails[index][field] = field === 'accountCode' ? value.toUpperCase() : value;
    setForm({ ...form, details: newDetails });
  };

  const handleAddVoucher = async (e, type) => {
    e.preventDefault();
    setLoading(true);
    try {
      const companyId = activeCompany?.id ?? activeCompany;
      if (!companyId) {
        alert('Vui lòng chọn doanh nghiệp trước khi tạo phiếu thu/chi!');
        setLoading(false);
        return;
      }
      if (!form.partnerId) {
        alert('Vui lòng chọn đối tác công nợ cho phiếu thu/chi!');
        setLoading(false);
        return;
      }
      const rate = parseFloat(form.exchangeRate) || 1;
      const processedDetails = form.details.map(d => ({
        ...d,
        amount: Math.round(parseFloat(d.amount || 0) * rate),
        partnerId: Number(form.partnerId)
      }));

      // Kiểm tra cân đối Nợ - Có cơ bản trước khi đẩy lên API
      const totalDr = processedDetails.filter(d => d.entryType === 'DR').reduce((a, b) => a + b.amount, 0);
      const totalCr = processedDetails.filter(d => d.entryType === 'CR').reduce((a, b) => a + b.amount, 0);
      if (totalDr !== totalCr) {
        alert('Lỗi định khoản: Tổng số tiền bên NỢ phải bằng tổng số tiền bên CÓ!');
        setLoading(false);
        return;
      }

      await createNewVoucher({
        company_id: companyId,
        voucher_number: `${type}-${Date.now().toString().slice(-6)}`,
        voucher_date: form.date,
        voucher_type: type,
        description: form.desc,
        currency: form.currency,
        exchange_rate: rate,
        details: processedDetails
      });
      
      alert('Tạo phiếu thu/chi dòng tiền thành công!');
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi hệ thống khi tạo chứng từ dòng tiền!');
    } finally {
      setLoading(false);
    }
  };

  const cashVouchers = vouchers.filter(v => v.type === 'PT' || v.type === 'PC');

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <h2 className="text-base font-black flex items-center gap-2 text-slate-800 mb-4"><Wallet size={18}/> Quản Lý Thu - Chi Đa Tiền Tệ</h2>
        <form className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="border p-2 rounded-lg text-sm" />
            <select value={form.partnerId} onChange={e => setForm({...form, partnerId: e.target.value})} className="border p-2 rounded-lg text-sm">
              <option value="">-- Chọn Đối tác công nợ --</option>
              {partners.map(p => <option key={p.id} value={p.id}>{p.partner_name}</option>)}
            </select>
            <select value={form.currency} onChange={e => setForm({...form, currency: e.target.value, exchangeRate: e.target.value==='VND'?1:form.exchangeRate})} className="border p-2 rounded-lg text-sm">
              <option value={getDefaultCurrency()}>{getDefaultCurrency()} (Việt Nam Đồng)</option>
              <option value="USD">USD (Đô la Mỹ)</option>
              <option value="EUR">EUR (Đồng Euro)</option>
            </select>
            <input type="number" placeholder="Tỷ giá hạch toán" value={form.exchangeRate} onChange={e => setForm({...form, exchangeRate: e.target.value})} disabled={form.currency===getDefaultCurrency()} className="border p-2 rounded-lg text-sm" />
          </div>
          <input type="text" placeholder="Lý do nộp / nội dung chi..." value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} className="w-full border p-2 rounded-lg text-sm" />
          
          <div className="space-y-2">
            {form.details.map((dt, idx) => (
              <div key={idx} className="flex gap-2">
                <select value={dt.entryType} onChange={e => handleDetailChange(idx, 'entryType', e.target.value)} className="border p-2 rounded-lg text-sm font-bold">
                  <option value="DR">NỢ</option>
                  <option value="CR">CÓ</option>
                </select>
                <input type="text" placeholder="Mã TK" value={dt.accountCode} onChange={e => handleDetailChange(idx, 'accountCode', e.target.value)} className="border p-2 rounded-lg text-sm font-mono w-28" required />
                <input type="number" placeholder="Số tiền nguyên tệ" value={dt.amount} onChange={e => handleDetailChange(idx, 'amount', e.target.value)} className="border p-2 rounded-lg text-sm flex-1 text-right" required />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={e => handleAddVoucher(e, 'PT')} disabled={loading} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold">Tạo Phiếu Thu (PT)</button>
            <button type="button" onClick={e => handleAddVoucher(e, 'PC')} disabled={loading} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold">Tạo Phiếu Chi (PC)</button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 font-bold">
            <tr>
              <th className="p-3">Ngày</th>
              <th className="p-3">Loại</th>
              <th className="p-3">Tiền tệ / Tỷ giá</th>
              <th className="p-3">Diễn giải</th>
              <th className="p-3 text-right">Hạch toán (VND)</th>
              <th className="p-3 text-center">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {cashVouchers.map(v => (
              <tr key={v.id} className="border-b hover:bg-slate-50/50 transition">
                <td className="p-3 font-mono">{v.voucherDate?.split('T')[0]}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-black ${v.type === 'PT' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{v.type}</span></td>
                <td className="p-3 font-mono">{v.currency} / {parseFloat(v.exchangeRate || 1).toLocaleString('vi-VN')}</td>
                <td className="p-3 text-slate-600 max-w-xs truncate">{v.description}</td>
                <td className="p-3 text-right space-y-1">
                  {v.details?.map((d, i) => (
                    <div key={i} className="font-mono text-[10px]">
                      <span>{d.entryType}:</span> <span className="font-bold text-blue-600">{d.accountCode}</span> → {Math.round(d.amount)?.toLocaleString('vi-VN')}
                    </div>
                  ))}
                </td>
                <td className="p-3 text-center">
                  <button onClick={() => removeVoucher(v.id).catch(e => alert(e.response?.data?.error || 'Lỗi khóa sổ!'))} className="text-rose-600 font-bold hover:underline">Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}