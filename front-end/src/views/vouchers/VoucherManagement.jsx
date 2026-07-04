import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { FileText, Trash2, Loader2, Plus, Search, Filter, X } from 'lucide-react';
import api from '../../utils/api.js';

const VOUCHER_TYPES = [
  { value: 'PT', label: 'Phiếu Thu', color: 'bg-emerald-50 text-emerald-700' },
  { value: 'PC', label: 'Phiếu Chi', color: 'bg-amber-50 text-amber-700' },
  { value: 'NK', label: 'Phiếu Nhập Kho', color: 'bg-blue-50 text-blue-700' },
  { value: 'XK', label: 'Phiếu Xuất Kho', color: 'bg-purple-50 text-purple-700' },
  { value: 'PKT', label: 'Phiếu Kế Toán', color: 'bg-slate-50 text-slate-700' }
];

const CURRENCIES = ['VND', 'USD', 'EUR'];

export default function VoucherManagement() {
  const { activeCompany } = useAuth();
  const { vouchers, createNewVoucher, removeVoucher, reloadVouchers } = useVouchers();
  
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [partners, setPartners] = useState([]);
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({
    voucherType: 'PKT',
    date: new Date().toISOString().split('T')[0],
    desc: '',
    partnerId: '',
    currency: 'VND',
    exchangeRate: 1,
    details: [
      { accountCode: '', entryType: 'DR', amount: '', partnerId: '', itemId: '', quantity: '' }
    ]
  });

  useEffect(() => {
    if (activeCompany) {
      const companyId = activeCompany?.id ?? activeCompany;
      api.get(`/api/partners?company_id=${companyId}`)
         .then(res => setPartners(res.data))
         .catch(() => {});
      api.get(`/api/items?company_id=${companyId}`)
         .then(res => setItems(res.data))
         .catch(() => {});
    }
  }, [activeCompany]);

  const handleDetailChange = (index, field, value) => {
    const newDetails = [...form.details];
    newDetails[index] = { ...newDetails[index], [field]: value };
    setForm({ ...form, details: newDetails });
  };

  const addDetailRow = () => {
    setForm({
      ...form,
      details: [...form.details, { accountCode: '', entryType: 'DR', amount: '', partnerId: '', itemId: '', quantity: '' }]
    });
  };

  const removeDetailRow = (index) => {
    if (form.details.length <= 1) return;
    const newDetails = form.details.filter((_, i) => i !== index);
    setForm({ ...form, details: newDetails });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const companyId = activeCompany?.id ?? activeCompany;
      const rate = parseFloat(form.exchangeRate) || 1;

      const processedDetails = form.details.map(d => ({
        accountCode: d.accountCode,
        entryType: d.entryType,
        amount: Math.round(parseFloat(d.amount || 0) * rate),
        partnerId: d.partnerId || form.partnerId || null,
        itemId: d.itemId || null,
        quantity: parseFloat(d.quantity || 0)
      }));

      // Kiểm tra cân đối Nợ - Có
      const totalDr = processedDetails.filter(d => d.entryType === 'DR').reduce((a, b) => a + b.amount, 0);
      const totalCr = processedDetails.filter(d => d.entryType === 'CR').reduce((a, b) => a + b.amount, 0);
      if (totalDr !== totalCr) {
        alert(`Lỗi định khoản: Tổng Nợ (${totalDr.toLocaleString('vi-VN')}) phải bằng Tổng Có (${totalCr.toLocaleString('vi-VN')})!`);
        setLoading(false);
        return;
      }

      const result = await createNewVoucher({
        company_id: companyId,
        voucher_number: `${form.voucherType}-${Date.now().toString().slice(-6)}`,
        voucher_date: form.date,
        voucher_type: form.voucherType,
        description: form.desc,
        currency: form.currency,
        exchange_rate: rate,
        details: processedDetails
      });

      if (result.success) {
        alert('Tạo chứng từ thành công!');
        setShowForm(false);
        resetForm();
      } else {
        alert(result.error || 'Lỗi tạo chứng từ!');
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi hệ thống khi tạo chứng từ!');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      voucherType: 'PKT',
      date: new Date().toISOString().split('T')[0],
      desc: '',
      partnerId: '',
      currency: 'VND',
      exchangeRate: 1,
      details: [{ accountCode: '', entryType: 'DR', amount: '', partnerId: '', itemId: '', quantity: '' }]
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa chứng từ này?')) return;
    try {
      const result = await removeVoucher(id);
      if (result.success) {
        alert('Xóa chứng từ thành công!');
      } else {
        alert(result.error || 'Lỗi xóa chứng từ!');
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Lỗi xóa chứng từ!');
    }
  };

  // Lọc chứng từ
  const filteredVouchers = vouchers.filter(v => {
    if (filterType && v.type !== filterType) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchDesc = v.description?.toLowerCase().includes(term);
      const matchNumber = v.voucherNumber?.toLowerCase().includes(term);
      const matchDetails = v.details?.some(d => d.accountCode?.toLowerCase().includes(term));
      if (!matchDesc && !matchNumber && !matchDetails) return false;
    }
    return true;
  });

  const getTypeInfo = (type) => {
    return VOUCHER_TYPES.find(t => t.value === type) || { label: type, color: 'bg-gray-50 text-gray-700' };
  };

  const formatAmount = (amount) => {
    return Math.round(amount)?.toLocaleString('vi-VN');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileText size={22} className="text-indigo-600" />
            Quản Lý Chứng Từ Tổng Hợp
          </h1>
          <p className="text-xs text-slate-400 mt-1">Quản lý tất cả chứng từ kế toán (PT, PC, NK, XK, PKT)</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); if (!showForm) resetForm(); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Đóng Form' : 'Tạo Chứng Từ Mới'}
        </button>
      </div>

      {/* Form tạo chứng từ */}
      {showForm && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <h2 className="text-base font-bold text-slate-800 mb-4">Tạo Chứng Từ Kế Toán Mới</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Loại chứng từ</label>
                <select
                  value={form.voucherType}
                  onChange={e => setForm({...form, voucherType: e.target.value})}
                  className="w-full border p-2 rounded-lg text-sm"
                >
                  {VOUCHER_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label} ({t.value})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Ngày chứng từ</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm({...form, date: e.target.value})}
                  className="w-full border p-2 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Loại tiền</label>
                <select
                  value={form.currency}
                  onChange={e => setForm({...form, currency: e.target.value, exchangeRate: e.target.value === 'VND' ? 1 : form.exchangeRate})}
                  className="w-full border p-2 rounded-lg text-sm"
                >
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Tỷ giá</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Tỷ giá"
                  value={form.exchangeRate}
                  onChange={e => setForm({...form, exchangeRate: e.target.value})}
                  disabled={form.currency === 'VND'}
                  className="w-full border p-2 rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Đối tác (nếu có)</label>
              <select
                value={form.partnerId}
                onChange={e => setForm({...form, partnerId: e.target.value})}
                className="w-full border p-2 rounded-lg text-sm"
              >
                <option value="">-- Chọn Đối tác --</option>
                {partners.map(p => <option key={p.id} value={p.id}>{p.partner_name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Diễn giải</label>
              <input
                type="text"
                placeholder="Nội dung chứng từ..."
                value={form.desc}
                onChange={e => setForm({...form, desc: e.target.value})}
                className="w-full border p-2 rounded-lg text-sm"
                required
              />
            </div>

            {/* Chi tiết định khoản */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-500">Chi tiết định khoản</label>
                <button
                  type="button"
                  onClick={addDetailRow}
                  className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1"
                >
                  <Plus size={14} /> Thêm dòng
                </button>
              </div>
              <div className="space-y-2">
                {form.details.map((dt, idx) => (
                  <div key={idx} className="flex flex-wrap gap-2 items-end">
                    <select
                      value={dt.entryType}
                      onChange={e => handleDetailChange(idx, 'entryType', e.target.value)}
                      className="border p-2 rounded-lg text-sm font-bold w-16"
                    >
                      <option value="DR">Nợ</option>
                      <option value="CR">Có</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Mã TK"
                      value={dt.accountCode}
                      onChange={e => handleDetailChange(idx, 'accountCode', e.target.value.toUpperCase())}
                      className="border p-2 rounded-lg text-sm font-mono w-24"
                      required
                    />
                    <input
                      type="number"
                      placeholder="Số tiền"
                      value={dt.amount}
                      onChange={e => handleDetailChange(idx, 'amount', e.target.value)}
                      className="border p-2 rounded-lg text-sm flex-1 min-w-[120px] text-right"
                      required
                    />
                    <select
                      value={dt.partnerId}
                      onChange={e => handleDetailChange(idx, 'partnerId', e.target.value)}
                      className="border p-2 rounded-lg text-sm flex-1 min-w-[140px]"
                    >
                      <option value="">Đối tác</option>
                      {partners.map(p => <option key={p.id} value={p.id}>{p.partner_name}</option>)}
                    </select>
                    <select
                      value={dt.itemId}
                      onChange={e => handleDetailChange(idx, 'itemId', e.target.value)}
                      className="border p-2 rounded-lg text-sm flex-1 min-w-[140px]"
                    >
                      <option value="">Vật tư</option>
                      {items.map(i => <option key={i.id} value={i.id}>{i.item_name}</option>)}
                    </select>
                    <input
                      type="number"
                      placeholder="SL"
                      value={dt.quantity}
                      onChange={e => handleDetailChange(idx, 'quantity', e.target.value)}
                      className="border p-2 rounded-lg text-sm w-20 text-right"
                    />
                    {form.details.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDetailRow(idx)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                Ghi Sổ Chứng Từ
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm(); }}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bộ lọc */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm chứng từ (số, diễn giải, tài khoản)..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="border border-slate-200 p-2 rounded-lg text-sm"
        >
          <option value="">Tất cả loại</option>
          {VOUCHER_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Danh sách chứng từ */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold">
              <tr>
                <th className="p-3">Ngày</th>
                <th className="p-3">Số CT</th>
                <th className="p-3">Loại</th>
                <th className="p-3">Tiền tệ</th>
                <th className="p-3">Diễn giải</th>
                <th className="p-3">Định khoản</th>
                <th className="p-3 text-right">Tổng tiền</th>
                <th className="p-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredVouchers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-slate-400">
                    <FileText size={40} className="mx-auto mb-2 opacity-30" />
                    <p>Không có chứng từ nào</p>
                  </td>
                </tr>
              ) : (
                filteredVouchers.map(v => {
                  const typeInfo = getTypeInfo(v.type);
                  const totalAmount = v.details?.reduce((sum, d) => sum + Math.round(d.amount || 0), 0) || 0;
                  return (
                    <tr key={v.id} className="border-b hover:bg-slate-50/50 transition">
                      <td className="p-3 font-mono whitespace-nowrap">{v.voucherDate?.split('T')[0]}</td>
                      <td className="p-3 font-mono font-bold text-slate-700">{v.voucherNumber}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-xs">{v.currency}</td>
                      <td className="p-3 text-slate-600 max-w-xs truncate" title={v.description}>
                        {v.description}
                      </td>
                      <td className="p-3">
                        <div className="space-y-0.5 max-h-20 overflow-y-auto">
                          {v.details?.map((d, i) => (
                            <div key={i} className="font-mono text-[10px] whitespace-nowrap">
                              <span className={d.entryType === 'DR' ? 'text-red-600' : 'text-blue-600'}>
                                {d.entryType === 'DR' ? 'Nợ' : 'Có'}
                              </span>
                              : <span className="font-bold">{d.accountCode}</span>
                              {' '}{formatAmount(d.amount)}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-700 whitespace-nowrap">
                        {formatAmount(totalAmount)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleDelete(v.id)}
                          className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition"
                          title="Xóa chứng từ"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}