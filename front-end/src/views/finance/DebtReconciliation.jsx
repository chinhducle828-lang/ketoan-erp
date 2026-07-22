/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * @desc    Giao diện quản lý cấn trừ công nợ (Debt Reconciliation)
 * @access  Private (admin, ktt)
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Users, Loader2, Plus, Search, CheckCircle, XCircle, AlertTriangle,
  FileText, Calendar, Building2, ArrowLeftRight, RefreshCw
} from 'lucide-react';
import api from '../../utils/api.js';

// ====================================================================
// CONSTANTS
// ====================================================================

const STATUS_CONFIG = {
  draft: { label: 'Nháp', color: 'bg-gray-100 text-gray-700', icon: FileText },
  pending: { label: 'Chờ duyệt', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  approved: { label: 'Đã duyệt', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  cancelled: { label: 'Đã hủy', color: 'bg-red-100 text-red-700', icon: XCircle }
};

const TYPE_CONFIG = {
  offsetting: { label: 'Cấn trừ mua-bán', icon: ArrowLeftRight, color: 'text-blue-600' },
  intercompany: { label: 'Cấn trừ nội bộ', icon: Building2, color: 'text-purple-600' }
};

// ====================================================================
// MAIN COMPONENT
// ====================================================================

export default function DebtReconciliation() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id ?? activeCompany;
  const queryClient = useQueryClient();

  // UI State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedReconciliation, setSelectedReconciliation] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Form State
  const [formData, setFormData] = useState({
    type: 'offsetting',
    partner_id: '',
    partner_name: '',
    reconciliation_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // ====================================================================
  // QUERIES
  // ====================================================================

  const { data: reconciliations = [], isLoading: loadingList } = useQuery({
    queryKey: ['debtReconciliations', companyId, typeFilter, statusFilter],
    queryFn: async () => {
      if (!companyId) return [];
      const params = { company_id: companyId };
      if (typeFilter !== 'all') params.type = typeFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get('/debt-reconciliations', { params });
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    enabled: !!companyId
  });

  const { data: details, isLoading: loadingDetails } = useQuery({
    queryKey: ['debtReconciliationDetails', selectedReconciliation?.id],
    queryFn: async () => {
      if (!selectedReconciliation?.id) return null;
      const res = await api.get(`/debt-reconciliations/${selectedReconciliation.id}`);
      return res.data?.data || res.data;
    },
    enabled: !!selectedReconciliation?.id
  });

  // ====================================================================
  // MUTATIONS
  // ====================================================================

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const res = await api.post('/debt-reconciliations', {
        ...data,
        company_id: companyId
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['debtReconciliations']);
      setShowCreateForm(false);
      setFormData({
        type: 'offsetting',
        partner_id: '',
        partner_name: '',
        reconciliation_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      alert('Tạo biên bản cấn trừ công nợ thành công!');
    },
    onError: (err) => {
      alert(err.response?.data?.error || 'Lỗi khi tạo biên bản!');
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.post(`/debt-reconciliations/${id}/approve`, {
        company_id: companyId
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['debtReconciliations', 'debtReconciliationDetails']);
      alert('Duyệt biên bản cấn trừ thành công! Đã sinh bút toán Nợ 331 / Có 131.');
    },
    onError: (err) => {
      alert(err.response?.data?.error || 'Lỗi khi duyệt biên bản!');
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.post(`/debt-reconciliations/${id}/cancel`, {
        company_id: companyId,
        reason: 'Hủy bởi người dùng'
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['debtReconciliations', 'debtReconciliationDetails']);
      alert('Đã hủy biên bản cấn trừ!');
    },
    onError: (err) => {
      alert(err.response?.data?.error || 'Lỗi khi hủy biên bản!');
    }
  });

  // ====================================================================
  // HANDLERS
  // ====================================================================

  const handleCreate = (e) => {
    e.preventDefault();
    if (!formData.partner_id || !formData.partner_name) {
      alert('Vui lòng nhập đầy đủ thông tin đối tác!');
      return;
    }
    createMutation.mutate(formData);
  };

  const handleApprove = (id) => {
    if (!window.confirm('Duyệt biên bản cấn trừ sẽ sinh bút toán Nợ 331 / Có 131. Tiếp tục?')) return;
    approveMutation.mutate(id);
  };

  const handleCancel = (id) => {
    if (!window.confirm('Hủy biên bản cấn trừ? Hành động này không thể hoàn tác.')) return;
    cancelMutation.mutate(id);
  };

  // ====================================================================
  // FILTERED DATA
  // ====================================================================

  const filteredReconciliations = useMemo(() => {
    if (!searchTerm) return reconciliations;
    const term = searchTerm.toLowerCase();
    return reconciliations.filter(r =>
      r.reconciliation_number?.toLowerCase().includes(term) ||
      r.partner_name?.toLowerCase().includes(term)
    );
  }, [reconciliations, searchTerm]);

  // ====================================================================
  // RENDER HELPERS
  // ====================================================================

  const renderStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon size={12} />
        {config.label}
      </span>
    );
  };

  const renderTypeBadge = (type) => {
    const config = TYPE_CONFIG[type] || TYPE_CONFIG.offsetting;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 ${config.color}`}>
        <Icon size={12} />
        {config.label}
      </span>
    );
  };

  const renderDetailsTable = () => {
    if (!details) return null;

    const items = details.items || details.details || [];
    if (items.length === 0) {
      return <p className="text-sm text-slate-400 text-center py-8">Chưa có chi tiết cấn trừ</p>;
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 font-bold">
            <tr>
              <th className="p-3">Đối tác</th>
              <th className="p-3">Loại</th>
              <th className="p-3 text-right">Số tiền cấn trừ</th>
              <th className="p-3">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b hover:bg-slate-50/50">
                <td className="p-3">{item.partner_name || '-'}</td>
                <td className="p-3">
                  {item.reconciliation_type === 'intercompany' ? 'Nội bộ' : 'Mua-bán'}
                </td>
                <td className="p-3 text-right font-medium">
                  {item.amount?.toLocaleString('vi-VN')} đ
                </td>
                <td className="p-3 text-slate-500">{item.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ====================================================================
  // RENDER
  // ====================================================================

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users size={22} className="text-indigo-600" />
            Cấn Trừ Công Nợ
          </h1>
          <p className="text-xs text-slate-400 mt-1">Quản lý biên bản cấn trừ công nợ phải thu/phải trả</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition"
        >
          <Plus size={16} />
          Tạo biên bản cấn trừ
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Tạo biên bản cấn trừ mới</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Loại cấn trừ <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="offsetting">Cấn trừ mua-bán (offetting)</option>
                  <option value="intercompany">Cấn trừ nội bộ (intercompany)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Mã đối tác <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.partner_id}
                  onChange={(e) => setFormData({ ...formData, partner_id: e.target.value })}
                  placeholder="Nhập mã đối tác"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Tên đối tác <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.partner_name}
                  onChange={(e) => setFormData({ ...formData, partner_name: e.target.value })}
                  placeholder="Nhập tên đối tác"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  <Calendar size={14} className="inline mr-1" />
                  Ngày cấn trừ
                </label>
                <input
                  type="date"
                  value={formData.reconciliation_date}
                  onChange={(e) => setFormData({ ...formData, reconciliation_date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Ghi chú</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Nhập ghi chú (nếu có)"
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Tạo biên bản'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition"
              >
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo số biên bản, tên đối tác..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-lg text-sm"
        >
          <option value="all">Tất cả loại</option>
          <option value="offsetting">Cấn trừ mua-bán</option>
          <option value="intercompany">Cấn trừ nội bộ</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-lg text-sm"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="draft">Nháp</option>
          <option value="pending">Chờ duyệt</option>
          <option value="approved">Đã duyệt</option>
          <option value="cancelled">Đã hủy</option>
        </select>
      </div>

      {/* List View or Detail View */}
      {selectedReconciliation ? (
        /* ========== DETAIL VIEW ========== */
        <div className="space-y-4">
          <button
            onClick={() => setSelectedReconciliation(null)}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            ← Quay lại danh sách
          </button>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-800">
                  Biên bản cấn trừ: {details?.reconciliation_number || selectedReconciliation.reconciliation_number}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Ngày: {details?.reconciliation_date || selectedReconciliation.reconciliation_date} |
                  Đối tác: {details?.partner_name || selectedReconciliation.partner_name}
                </p>
              </div>
              <div className="flex gap-2">
                {renderTypeBadge(details?.type || selectedReconciliation.type)}
                {renderStatusBadge(details?.status || selectedReconciliation.status)}
              </div>
            </div>

            {details?.notes && (
              <div className="bg-slate-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-slate-600"><strong>Ghi chú:</strong> {details.notes}</p>
              </div>
            )}

            {/* Accounting Info */}
            {details?.voucher && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-bold text-green-800 mb-2">Thông tin bút toán</h4>
                <p className="text-xs text-green-700">
                  Số chứng từ: {details.voucher.voucher_number} | Ngày: {details.voucher.voucher_date}
                </p>
                <p className="text-xs text-green-700 mt-1">
                  Bút toán: Nợ 331 / Có 131 (Cấn trừ công nợ)
                </p>
              </div>
            )}

            {/* Details Table */}
            {renderDetailsTable()}

            {/* Actions */}
            {(details?.status === 'draft' || details?.status === 'pending') && (
              <div className="flex gap-2 mt-4 pt-4 border-t">
                <button
                  onClick={() => handleApprove(details?.id || selectedReconciliation.id)}
                  disabled={approveMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition"
                >
                  <CheckCircle size={16} />
                  {approveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Duyệt & Sinh bút toán'}
                </button>
                <button
                  onClick={() => handleCancel(details?.id || selectedReconciliation.id)}
                  disabled={cancelMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition"
                >
                  <XCircle size={16} />
                  Hủy biên bản
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========== LIST VIEW ========== */
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          {loadingList ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 size={24} className="animate-spin text-indigo-600" />
              <span className="ml-2 text-sm text-slate-400">Đang tải...</span>
            </div>
          ) : filteredReconciliations.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
              <Users size={40} className="mb-2 opacity-30" />
              <p className="text-sm">Chưa có biên bản cấn trừ nào</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold">
                  <tr>
                    <th className="p-3">Số biên bản</th>
                    <th className="p-3">Ngày</th>
                    <th className="p-3">Đối tác</th>
                    <th className="p-3">Loại</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3 text-right">Số tiền</th>
                    <th className="p-3">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReconciliations.map((rec) => (
                    <tr key={rec.id} className="border-b hover:bg-slate-50/50 transition cursor-pointer"
                        onClick={() => setSelectedReconciliation(rec)}>
                      <td className="p-3 font-medium">{rec.reconciliation_number}</td>
                      <td className="p-3">{rec.reconciliation_date}</td>
                      <td className="p-3">{rec.partner_name || '-'}</td>
                      <td className="p-3">{renderTypeBadge(rec.type)}</td>
                      <td className="p-3">{renderStatusBadge(rec.status)}</td>
                      <td className="p-3 text-right font-medium">
                        {rec.total_amount?.toLocaleString('vi-VN') || '0'} đ
                      </td>
                      <td className="p-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReconciliation(rec);
                          }}
                          className="text-indigo-600 hover:text-indigo-700 text-xs font-medium"
                        >
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Help Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={18} className="text-blue-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-blue-800">Hướng dẫn nghiệp vụ cấn trừ công nợ</p>
            <ul className="text-xs text-blue-700 mt-1 space-y-1 list-disc list-inside">
              <li><strong>Cấn trừ mua-bán:</strong> Cấn trừ công nợ giữa phải trả NCC (331) và phải thu KH (131)</li>
              <li><strong>Cấn trừ nội bộ:</strong> Cấn trừ công nợ giữa các công ty trong tập đoàn</li>
              <li><strong>Duyệt biên bản:</strong> Hệ thống tự động sinh bút toán Nợ 331 / Có 131</li>
              <li><strong>Lưu ý:</strong> Chỉ admin và kế toán trưởng (ktt) có quyền duyệt biên bản</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}