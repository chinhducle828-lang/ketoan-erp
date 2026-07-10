/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useVouchers } from '../../context/VoucherContext.jsx';
import { FileText, Trash2, Loader2, Plus, Search, Filter, X, FileSpreadsheet, Scan } from 'lucide-react';
import api from '../../utils/api.js';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts.js';
import { getDefaultCurrency } from '../../utils/accountingRules.js';
import { notify } from '../../utils/notify.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { useRealtimeInvalidation } from '../../hooks/useRealtimeInvalidation.js';
import { useRealTimeSync } from '../../hooks/useRealTimeSync.js';
import { ACCOUNTS_TT99, getAccountsByDepartment, getAccountByCode } from '../../constants/accountsTT99.js';
import { createWorkflowHandlers, WORKFLOW_EVENTS } from '../../workflow/accountingWorkflow.js';
import ExportExcelButton from '../../components/ExportExcelButton.jsx';
import ImportExcelButton from '../../components/ImportExcelButton.jsx';
import VoucherFormTemplate from '../../components/VoucherFormTemplate.jsx';
import OtpSignModal from '../../components/OtpSignModal.jsx';
import OCRScanner from '../../components/OCRScanner.jsx';

const VOUCHER_TYPES = [
  { value: 'PT', label: 'Phiếu Thu', color: 'bg-emerald-50 text-emerald-700' },
  { value: 'PC', label: 'Phiếu Chi', color: 'bg-amber-50 text-amber-700' },
  { value: 'NK', label: 'Phiếu Nhập Kho', color: 'bg-blue-50 text-blue-700' },
  { value: 'XK', label: 'Phiếu Xuất Kho', color: 'bg-purple-50 text-purple-700' },
  { value: 'PKT', label: 'Phiếu Kế Toán', color: 'bg-slate-50 text-slate-700' }
];

const CURRENCIES = [getDefaultCurrency(), 'USD', 'EUR'];

export default function VoucherManagement() {
  const { activeCompany } = useAuth();
  const { vouchers, createNewVoucher, removeVoucher, reloadVouchers } = useVouchers();
  
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    voucherType: 'PKT',
    date: new Date().toISOString().split('T')[0],
    desc: '',
    partnerId: '',
    currency: getDefaultCurrency(),
    exchangeRate: 1,
    details: [{ accountCode: '', entryType: 'DR', amount: '', partnerId: '', itemId: '', quantity: '' }]
  });
  const [showForm, setShowForm] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [pendingVoucher, setPendingVoucher] = useState(null);
  const [showOCRScanner, setShowOCRScanner] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [partners, setPartners] = useState([]);
  const [items, setItems] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (activeCompany) {
      const companyId = activeCompany?.id ?? activeCompany;
      api.get(`/api/partners/list?company_id=${companyId}`)
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
        notify.error(`Lỗi định khoản: Tổng Nợ (${totalDr.toLocaleString('vi-VN')}) phải bằng Tổng Có (${totalCr.toLocaleString('vi-VN')})!`);
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
        notify.success('Tạo chứng từ thành công!');
        setShowForm(false);
        resetForm();
      } else {
        notify.error(result.error || 'Lỗi tạo chứng từ!');
      }
    } catch (err) {
      notify.error(err.response?.data?.error || 'Lỗi hệ thống khi tạo chứng từ!');
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
      currency: getDefaultCurrency(),
      exchangeRate: 1,
      details: [{ accountCode: '', entryType: 'DR', amount: '', partnerId: '', itemId: '', quantity: '' }]
    });
  };

  const handleDelete = async (id) => {
    const confirmed = await notify.confirm('Bạn có chắc chắn muốn xóa chứng từ này?');
    if (!confirmed) return;
    try {
      const result = await removeVoucher(id);
      if (result.success) {
        notify.success('Xóa chứng từ thành công!');
      } else {
        notify.error(result.error || 'Lỗi xóa chứng từ!');
      }
    } catch (err) {
      notify.error(err.response?.data?.error || 'Lỗi xóa chứng từ!');
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

  const getVoucherStatusBadge = (voucher) => {
    const isLocked = voucher.locked || voucher.isLocked || voucher.lock_date || voucher.lockDate;
    if (isLocked) {
      return <span className="status-badge status-locked">Đã Khóa Sổ</span>;
    }
    if (voucher.isPosted) {
      return <span className="status-badge status-posted">Đã Ghi Sổ</span>;
    }
    return <span className="status-badge status-draft">Sổ Tạm</span>;
  };

  const formatAmount = (amount) => {
    return Math.round(amount)?.toLocaleString('vi-VN');
  };

  const totalVouchers = filteredVouchers.length;
  const postedCount = filteredVouchers.filter(v => v.isPosted).length;
  const lockedCount = filteredVouchers.filter(v => v.locked || v.isLocked || v.lock_date || v.lockDate).length;
  const draftCount = totalVouchers - postedCount - lockedCount;

  // Handle posting voucher from list (for XK/PT types)
  const handlePostDocument = async (voucherId, voucherType) => {
    if (!voucherId) return;
    
    const requiresSigning = ['XK', 'PT'].includes(voucherType);
    
    if (requiresSigning) {
      // Show OTP modal for signing
      setPendingVoucher({ id: voucherId, type: voucherType });
      setShowSignModal(true);
    } else {
      // Direct post for other voucher types
      try {
        const companyId = activeCompany?.id ?? activeCompany;
        const res = await api.post(`/vouchers/${voucherId}/post`, { company_id: companyId });
        if (res.data?.success) {
          notify.success('Ghi sổ chứng từ thành công!');
          reloadVouchers();
        }
      } catch (err) {
        notify.error(err.response?.data?.error || 'Lỗi ghi sổ chứng từ!');
      }
    }
  };

  // Handle OTP success
  const handleSignSuccess = async () => {
    if (pendingVoucher) {
      try {
        const companyId = activeCompany?.id ?? activeCompany;
        const res = await api.post(`/vouchers/${pendingVoucher.id}/post`, { company_id: companyId });
        if (res.data?.success) {
          notify.success('Ghi sổ chứng từ thành công!');
          reloadVouchers();
        }
      } catch (err) {
        notify.error(err.response?.data?.error || 'Lỗi ghi sổ chứng từ!');
      }
    }
    setPendingVoucher(null);
    setShowSignModal(false);
  };

  // Keyboard shortcuts for ERP power users
  const handleSearchFocus = () => {
    searchInputRef.current?.focus();
  };

  const handleCreateNew = () => {
    setShowForm(true);
    resetForm();
  };

  const handlePostFromForm = () => {
    if (showForm) {
      const formElement = document.querySelector('form');
      if (formElement) {
        formElement.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }
  };

  const handleCancel = () => {
    if (showForm) {
      setShowForm(false);
      resetForm();
    }
  };

  useKeyboardShortcuts({
    onSearch: handleSearchFocus,
    onCreate: handleCreateNew,
    onPost: handlePostDocument,
    onCancel: handleCancel,
    enabled: true
  });

  const companyId = activeCompany?.id ?? activeCompany;

  // Realtime: subscribe voucher workflow events
  const { handlers: realtimeHandlers } = useRealtimeInvalidation(
    { vouchers: reloadVouchers },
    {
      eventMap: {
        [WORKFLOW_EVENTS.VOUCHER_CREATED]: ['vouchers'],
        [WORKFLOW_EVENTS.VOUCHER_POSTED]: ['vouchers'],
        [WORKFLOW_EVENTS.VOUCHER_DELETED]: ['vouchers'],
        [WORKFLOW_EVENTS.CLOSING_COMPLETED]: ['vouchers'],
        voucherCreated: ['vouchers'],
        voucherUpdated: ['vouchers'],
        voucherDeleted: ['vouchers'],
        voucherPosted: ['vouchers'],
        closingCompleted: ['vouchers']
      }
    }
  );

  useRealTimeSync(realtimeHandlers, { enabled: Boolean(companyId) });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <FileText size={22} className="text-indigo-600" />
              Quản Lý Chứng Từ Tổng Hợp
            </h1>
            <p className="text-xs text-slate-400 mt-1">Quản lý tất cả chứng từ kế toán (PT, PC, NK, XK, PKT)</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ImportExcelButton endpoint="vouchers" filename="Chung_Tu" accountCodeField="accountCode" />
            <ExportExcelButton endpoint="vouchers" filename="Chung_Tu" accountCodes={ACCOUNTS_TT99.slice(0, 20).map(a => a.code)} />
            <button
              onClick={() => setShowOCRScanner(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 transition"
              title="Quét tài liệu bằng AI OCR"
            >
              <Scan size={16} />
              Quét OCR
            </button>
            <button
              onClick={() => { setShowForm(!showForm); if (!showForm) resetForm(); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition"
              title="[Alt+N] Tạo chứng từ mới"
            >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? 'Đóng Form' : 'Tạo Chứng Từ Mới [Alt+N]'}
          </button>
          </div>
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
                  onChange={e => setForm({...form, currency: e.target.value, exchangeRate: e.target.value === getDefaultCurrency() ? 1 : form.exchangeRate})}
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
                  disabled={form.currency === getDefaultCurrency()}
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
                      {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
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
                Ghi Sổ Chứng Từ [Ctrl+S]
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); resetForm(); }}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
              >
                Hủy [Esc]
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-500">Tổng chứng từ</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{totalVouchers}</p>
          <p className="mt-2 text-sm text-slate-500">Số chứng từ sau khi lọc.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-500">Đã ghi sổ</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{postedCount}</p>
          <p className="mt-2 text-sm text-slate-500">Chứng từ đã hoàn tất.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-500">Chưa hoàn tất</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{draftCount}</p>
          <p className="mt-2 text-sm text-slate-500">Đang chờ kiểm duyệt hoặc chỉnh sửa.</p>
        </div>
      </div>

      {/* Bộ lọc */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Tìm kiếm chứng từ (số, diễn giải, tài khoản)... [F2]"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-2xl text-sm outline-none"
            />
          </div>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none sm:w-auto"
          >
          <option value="">Tất cả loại</option>
          {VOUCHER_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>
    </div>

      {/* Danh sách chứng từ - Sovereign Table with High Density */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs sovereign-table">
            <thead className="bg-slate-50 text-slate-500 font-bold">
              <tr>
                <th className="p-1.5 px-3">Ngày</th>
                <th className="p-1.5 px-3">Số CT</th>
                <th className="p-1.5 px-3">Loại</th>
                <th className="p-1.5 px-3">Tiền tệ</th>
                <th className="p-1.5 px-3">Diễn giải</th>
                <th className="p-1.5 px-3">Định khoản</th>
                <th className="p-1.5 px-3">Trạng thái</th>
                <th className="p-1.5 px-3 text-right">Tổng tiền</th>
                <th className="p-1.5 px-3 text-center">Thao tác</th>
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
                      <td className="p-1.5 px-3 font-mono whitespace-nowrap">{v.voucherDate?.split('T')[0]}</td>
                      <td className="p-1.5 px-3 font-mono font-bold text-slate-700">{v.voucherNumber}</td>
                      <td className="p-1.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="p-1.5 px-3 font-mono text-xs">{v.currency}</td>
                      <td className="p-1.5 px-3 text-slate-600 max-w-xs truncate" title={v.description}>
                        {v.description}
                      </td>
                      <td className="p-1.5 px-3">
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
                      <td className="p-1.5 px-3">{getVoucherStatusBadge(v)}</td>
                      <td className="p-1.5 px-3 text-right tabular-nums font-mono font-bold text-slate-700 whitespace-nowrap">
                        {formatAmount(totalAmount)}
                      </td>
<td className="p-1.5 px-3 text-center">
                         <div className="flex items-center justify-center gap-1">
                           {!v.isPosted && ['XK', 'PT'].includes(v.type) && (
                             <button
                               onClick={() => handlePostDocument(v.id, v.type)}
                               className="text-emerald-600 hover:text-emerald-700 p-1.5 rounded-lg hover:bg-emerald-50 transition"
                               title="Ghi sổ chứng từ"
                             >
                               <Plus size={15} />
                             </button>
                           )}
                           <button
                             onClick={() => handleDelete(v.id)}
                             className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition"
                             title="Xóa chứng từ"
                           >
                             <Trash2 size={15} />
                           </button>
                         </div>
                       </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <VoucherFormTemplate
        moduleType="vouchers"
        title="Tạo chứng từ tổng hợp nhanh"
        description="Hạch toán bút toán kế toán tổng hợp (Nợ = Có)"
        defaultVoucherType="PKT"
      />

      {/* OTP Sign Modal for XK/PT vouchers */}
      <OtpSignModal
        isOpen={showSignModal}
        onClose={() => {
          setShowSignModal(false);
          setPendingVoucher(null);
        }}
        voucherId={pendingVoucher?.id}
        voucherType={pendingVoucher?.type}
        onSuccess={handleSignSuccess}
      />

      {/* OCR Scanner Modal */}
      {showOCRScanner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">OCR Scanner</h2>
              <button
                onClick={() => setShowOCRScanner(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <OCRScanner
                documentType="voucher"
                companyId={companyId}
                onScanComplete={(result) => {
                  console.log('OCR Result:', result);
                  // TODO: Auto-fill form with OCR data
                  notify.success('Đã quét xong! Đang điền dữ liệu vào form...');
                  setShowOCRScanner(false);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
