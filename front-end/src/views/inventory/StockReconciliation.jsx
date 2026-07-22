/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * @desc    Giao diện quản lý kiểm kê kho (Stock Reconciliation)
 * @access  Private (admin, ktt)
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Package, Loader2, Plus, Search, CheckCircle, XCircle, AlertTriangle,
  FileText, Calendar, Warehouse, TrendingUp, TrendingDown, DollarSign
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

const ACCOUNT_OPTIONS = [
  { value: 711, label: '711 - Chi phí khác' },
  { value: 642, label: '642 - Chi phí quản lý doanh nghiệp' },
  { value: 632, label: '632 - Giá vốn hàng bán' },
  { value: 811, label: '811 - Chi phí tài chính' }
];

// ====================================================================
// MAIN COMPONENT
// ====================================================================

export default function StockReconciliation() {
  const { activeCompany } = useAuth();
  const companyId = activeCompany?.id ?? activeCompany;
  const queryClient = useQueryClient();

  // UI State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedReconciliation, setSelectedReconciliation] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Form State
  const [formData, setFormData] = useState({
    warehouse_id: '',
    reconciliation_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  // ====================================================================
  // QUERIES
  // ====================================================================

  const { data: reconciliations = [], isLoading: loadingList } = useQuery({
    queryKey: ['stockReconciliations', companyId, statusFilter],
    queryFn: async () => {
      if (!companyId) return [];
      const params = { company_id: companyId };
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get('/inventory/reconciliations', { params });
      return Array.isArray(res.data?.data) ? res.data.data : [];
    },
    enabled: !!companyId
  });

  const { data: details, isLoading: loadingDetails } = useQuery({
    queryKey: ['stockReconciliationDetails', selectedReconciliation?.id],
    queryFn: async () => {
      if (!selectedReconciliation?.id) return null;
      const res = await api.get(`/inventory/reconciliations/${selectedReconciliation.id}`);
      return res.data?.data || res.data;
    },
    enabled: !!selectedReconciliation?.id
  });

  // ====================================================================
  // MUTATIONS
  // ====================================================================

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const res = await api.post('/inventory/reconciliations', {
        ...data,
        company_id: companyId
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['stockReconciliations']);
      setShowCreateForm(false);
      setFormData({
        warehouse_id: '',
        reconciliation_date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      alert('Tạo phiếu kiểm kê thành công!');
    },
    onError: (err) => {
      alert(err.response?.data?.error || 'Lỗi khi tạo phiếu kiểm kê!');
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.post(`/inventory/reconciliations/${id}/approve`, {
        company_id: companyId
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['stockReconciliations', 'stockReconciliationDetails']);
      queryClient.invalidateQueries(['stockLevels']); // Invalidate stock levels cache
      alert('Duyệt phiếu kiểm kê thành công! Đã sinh bút toán TK 1381.');
    },
    onError: (err) => {
      alert(err.response?.data?.error || 'Lỗi khi duyệt phiếu kiểm kê!');
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.post(`/inventory/reconciliations/${id}/cancel`, {
        company_id: companyId,
        reason: 'Hủy bởi người dùng'
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['stockReconciliations', 'stockReconciliationDetails']);
      alert('Đã hủy phiếu kiểm kê!');
    },
    onError: (err) => {
      alert(err.response?.data?.error || 'Lỗi khi hủy phiếu!');
    }
  });

  const adjustMutation = useMutation({
    mutationFn: async ({ id, target_account, reason }) => {
      const res = await api.post(`/inventory/reconciliations/${id}/adjust`, {
        company_id: companyId,
        target_account,
        reason
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['stockReconciliations', 'stockReconciliationDetails']);
      alert('Điều chỉnh bút toán thành công!');
    },
    onError: (err) => {
      alert(err.response?.data?.error || 'Lỗi khi điều chỉnh bút toán!');
    }
  });

  // ====================================================================
  // HANDLERS
  // ====================================================================

  const handleCreate = (e) => {
    e.preventDefault();
    if (!formData.warehouse_id) {
      alert('Vui lòng chọn kho!');
      return;
    }
    createMutation.mutate(formData);
  };

  const handleApprove = (id) => {
    if (!window.confirm('Duyệt phiếu kiểm kê sẽ sinh bút toán TK 1381. Tiếp tục?')) return;
    approveMutation.mutate(id);
  };

  const handleCancel = (id) => {
    if (!window.confirm('Hủy phiếu kiểm kê? Hành động này không thể hoàn tác.')) return;
    cancelMutation.mutate(id);
  };

  const handleAdjust = (reconciliationId) => {
    const targetAccount = prompt('Nhập tài khoản điều chỉnh (711, 642, 632, 811):', '711');
    if (!targetAccount) return;
    
    const accountNum = parseInt(targetAccount);
    if (!ACCOUNT_OPTIONS.find(opt => opt.value === accountNum)) {
      alert('Tài khoản không hợp lệ!');
      return;
    }

    const reason = prompt('Lý do điều chỉnh:');
    if (!reason) return;

    adjustMutation.mutate({
      id: reconciliationId,
      target_account: accountNum,
      reason
    });
  };

  // ====================================================================
  // FILTERED DATA
  // ====================================================================

  const filteredReconciliations = useMemo(() => {
    if (!searchTerm) return reconciliations;
    const term = searchTerm.toLowerCase();
    return reconciliations.filter(r =>
      r.reconciliation_number?.toLowerCase().includes(term) ||
      r.warehouse_name?.toLowerCase().includes(term)
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

  const renderDetailsTable = () => {
    if (!details) return null;

    const items = details.items || details.details || [];
    if (items.length === 0) {
      return <p className="text-sm text-slate-400 text-center py-8">Chưa có chi tiết kiểm kê</p>;
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 font-bold">
            <tr>
              <th className="p-3">Mã VT</th>
              <th className="p-3">Tên vật tư</th>
              <th className="p-3 text-right">SL Sổ sách</th>
              <th className="p-3 text-right">SL Thực tế</th>
              <th className="p-3 text-right">Chênh lệch</th>
              <th className="p-3 text-right">Đơn giá</th>
              <th className="p-3 text-right">Thành tiền</th>
              <th className="p-3">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const diff = (item.actual_quantity || 0) - (item.system_quantity || 0);
              const amount = Math.abs(diff) * (item.unit_price || 0);
              return (
                <tr key={idx} className="border-b hover:bg-slate-50/50">
                  <td className="p-3">{item.item_code || '-'}</td>
                  <td className="p-3">{item.item_name || 'N/A'}</td>
                  <td className="p-3 text-right">{item.system_quantity}</td>
                  <td className="p-3 text-right font-medium">{item.actual_quantity}</td>
                  <td className={`p-3 text-right font-bold ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                    {diff > 0 ? `+${diff}` : diff}
                  </td>
                  <td className="p-3 text-right">{item.unit_price ? item.unit_price.toLocaleString('vi-VN') : '-'}</td>
                  <td className="p-3 text-right font-medium">{amount.toLocaleString('vi-VN')}</td>
                  <td className="p-3 text-slate-500">{item.notes || '-'}</td>
                </tr>
              );
            })}
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
            <Package size={22} className="text-indigo-600" />
            Kiểm Kê Kho
          </h1>
          <p className="text-xs text-slate-400 mt-1">Quản lý phiếu kiểm kê và điều chỉnh tồn kho</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition"
        >
          <Plus size={16} />
          Tạo phiếu kiểm kê
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Tạo phiếu kiểm kê mới</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  <Warehouse size={14} className="inline mr-1" />
                  Kho <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.warehouse_id}
                  onChange={(e) => setFormData({ ...formData, warehouse_id: e.target.value })}
                  placeholder="Nhập mã kho (VD: KHO-001)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  <Calendar size={14} className="inline mr-1" />
                  Ngày kiểm kê
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
                {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Tạo phiếu'}
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
            placeholder="Tìm kiếm theo số phiếu, tên kho..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm"
          />
        </div>
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
                  Phiếu kiểm kê: {details?.reconciliation_number || selectedReconciliation.reconciliation_number}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Ngày: {details?.reconciliation_date || selectedReconciliation.reconciliation_date} |
                  Kho: {details?.warehouse_name || selectedReconciliation.warehouse_name}
                </p>
              </div>
              {renderStatusBadge(details?.status || selectedReconciliation.status)}
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
                  Bút toán: Nợ 1381 / Có 156 (Kiểm kê kho)
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
                  Hủy phiếu
                </button>
              </div>
            )}

            {/* Adjust Button (only for approved) */}
            {details?.status === 'approved' && (
              <div className="flex gap-2 mt-4 pt-4 border-t">
                <button
                  onClick={() => handleAdjust(details?.id || selectedReconciliation.id)}
                  disabled={adjustMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 disabled:opacity-50 transition"
                >
                  <DollarSign size={16} />
                  Điều chỉnh TK 1381 → TK khác
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
              <Package size={40} className="mb-2 opacity-30" />
              <p className="text-sm">Chưa có phiếu kiểm kê nào</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold">
                  <tr>
                    <th className="p-3">Số phiếu</th>
                    <th className="p-3">Ngày</th>
                    <th className="p-3">Kho</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3 text-right">Tổng SL</th>
                    <th className="p-3 text-right">Chênh lệch</th>
                    <th className="p-3">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReconciliations.map((rec) => {
                    const totalDiff = rec.items?.reduce((sum, item) => {
                      return sum + ((item.actual_quantity || 0) - (item.system_quantity || 0));
                    }, 0) || 0;
                    
                    return (
                      <tr key={rec.id} className="border-b hover:bg-slate-50/50 transition cursor-pointer"
                          onClick={() => setSelectedReconciliation(rec)}>
                        <td className="p-3 font-medium">{rec.reconciliation_number}</td>
                        <td className="p-3">{rec.reconciliation_date}</td>
                        <td className="p-3">{rec.warehouse_name || '-'}</td>
                        <td className="p-3">{renderStatusBadge(rec.status)}</td>
                        <td className="p-3 text-right">
                          {rec.items?.length || 0} VT
                        </td>
                        <td className={`p-3 text-right font-bold ${totalDiff > 0 ? 'text-green-600' : totalDiff < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                          {totalDiff > 0 ? `+${totalDiff}` : totalDiff}
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
                    );
                  })}
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
            <p className="text-sm font-bold text-blue-800">Hướng dẫn nghiệp vụ kiểm kê kho</p>
            <ul className="text-xs text-blue-700 mt-1 space-y-1 list-disc list-inside">
              <li><strong>Tạo phiếu:</strong> Chọn kho và nhập số lượng thực tế cho từng vật tư</li>
              <li><strong>Duyệt phiếu:</strong> Hệ thống tự động sinh bút toán Nợ 1381 / Có 156</li>
              <li><strong>Điều chỉnh:</strong> Sau khi tìm nguyên nhân, chuyển chênh lệch từ TK 1381 sang TK 711/642/632</li>
              <li><strong>Lưu ý:</strong> Chỉ admin và kế toán trưởng (ktt) có quyền duyệt phiếu kiểm kê</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}