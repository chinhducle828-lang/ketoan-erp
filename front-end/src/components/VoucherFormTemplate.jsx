/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * Reusable voucher form template for all modules
 */

import React, { useState } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useVouchers } from '../context/VoucherContext.jsx';
import { getDefaultCurrency } from '../utils/accountingRules.js';
import { notify } from '../utils/notify.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { WORKFLOW_EVENTS } from '../workflow/accountingWorkflow.js';
import { ACCOUNTS_TT99 } from '../constants/accountsTT99.js';

export default function VoucherFormTemplate({ 
  moduleType,
  title,
  description,
  defaultVoucherType,
  accountGroupFilter
}) {
  const { activeCompany } = useAuth();
  const { createNewVoucher } = useVouchers();
  const { socket } = useSocket();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    voucherType: defaultVoucherType || 'PT',
    date: new Date().toISOString().split('T')[0],
    desc: '',
    partnerId: '',
    currency: getDefaultCurrency(),
    exchangeRate: 1,
    details: [{ accountCode: '', entryType: 'DR', amount: '', partnerId: '' }]
  });

  const accounts = accountGroupFilter 
    ? ACCOUNTS_TT99.filter(a => accountGroupFilter.includes(a.group))
    : ACCOUNTS_TT99;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const companyId = activeCompany?.id || activeCompany || 1;
      const rate = parseFloat(form.exchangeRate) || 1;

      const processedDetails = form.details.map(d => ({
        accountCode: d.accountCode,
        entryType: d.entryType,
        amount: Math.round(parseFloat(d.amount || 0) * rate)
      }));

      const totalDr = processedDetails.filter(d => d.entryType === 'DR').reduce((a, b) => a + b.amount, 0);
      const totalCr = processedDetails.filter(d => d.entryType === 'CR').reduce((a, b) => a + b.amount, 0);
      if (totalDr !== totalCr) {
        notify.error(`Tổng Nợ (${totalDr.toLocaleString('vi-VN')}) phải bằng Tổng Có (${totalCr.toLocaleString('vi-VN')})!`);
        return;
      }

      const voucherNumber = `${form.voucherType}-${Date.now().toString().slice(-6)}`;

      const payload = {
        company_id: companyId,
        voucher_number: voucherNumber,
        voucher_date: form.date,
        voucher_type: form.voucherType,
        description: form.desc || description,
        currency: form.currency,
        exchange_rate: rate,
        details: processedDetails
      };

      const result = await createNewVoucher(payload);
      if (!result.error) {
        if (socket) {
          socket.emit(WORKFLOW_EVENTS.VOUCHER_CREATED, {
            companyId,
            voucherId: result.id,
            voucherType: form.voucherType,
            amount: totalDr
          });
        }
        notify.success('Tạo chứng từ thành công!');
        setForm({ voucherType: defaultVoucherType || 'PT', date: new Date().toISOString().split('T')[0], desc: '', partnerId: '', currency: getDefaultCurrency(), exchangeRate: 1, details: [{ accountCode: '', entryType: 'DR', amount: '', partnerId: '' }] });
      } else {
        throw new Error(result.error || 'Lỗi tạo chứng từ');
      }
    } catch (err) {
      notify.error(err.message || 'Lỗi tạo chứng từ!');
    } finally {
      setLoading(false);
    }
  };

  const addDetailRow = () => {
    setForm({ ...form, details: [...form.details, { accountCode: '', entryType: 'DR', amount: '', partnerId: '' }] });
  };

  const removeDetailRow = (index) => {
    if (form.details.length <= 1) return;
    setForm({ ...form, details: form.details.filter((_, i) => i !== index) });
  };

  const handleDetailChange = (index, field, value) => {
    const newDetails = [...form.details];
    newDetails[index] = { ...newDetails[index], [field]: value };
    setForm({ ...form, details: newDetails });
  };

  return (
    <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
      <h2 className="text-lg font-bold text-slate-800">{title || 'Tạo Chứng Từ'}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Loại chứng từ</label>
            <select value={form.voucherType} onChange={e => setForm({...form, voucherType: e.target.value})} className="w-full border p-2 rounded-lg text-sm">
              <option value="PT">Phiếu Thu</option>
              <option value="PC">Phiếu Chi</option>
              <option value="NK">Nhập Kho</option>
              <option value="XK">Xuất Kho</option>
              <option value="PKT">Phiếu Kế Toán</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Ngày</label>
            <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full border p-2 rounded-lg text-sm" required />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Diễn giải</label>
          <input type="text" value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} placeholder="Nội dung chứng từ..." className="w-full border p-2 rounded-lg text-sm" required />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-500">Chi tiết định khoản</label>
            <button type="button" onClick={addDetailRow} className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1">
              <Plus size={14} /> Thêm dòng
            </button>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {form.details.map((dt, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select value={dt.entryType} onChange={e => handleDetailChange(idx, 'entryType', e.target.value)} className="border p-2 rounded-lg text-sm w-16">
                  <option value="DR">Nợ</option>
                  <option value="CR">Có</option>
                </select>
                <input list="accounts" value={dt.accountCode} onChange={e => handleDetailChange(idx, 'accountCode', e.target.value.toUpperCase())} placeholder="Mã TK" className="border p-2 rounded-lg text-sm font-mono w-28" required />
                <datalist id="accounts">{accounts.map(a => <option key={a.code} value={a.code} />)}</datalist>
                <input type="number" value={dt.amount} onChange={e => handleDetailChange(idx, 'amount', e.target.value)} placeholder="Số tiền" className="border p-2 rounded-lg text-sm flex-1" required />
                {form.details.length > 1 && (
                  <button type="button" onClick={() => removeDetailRow(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Lưu Chứng Từ
        </button>
      </form>
    </div>
  );
}