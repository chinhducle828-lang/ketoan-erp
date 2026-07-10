/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { 
  Package, 
  Clock, 
  Truck, 
  CheckCircle2, 
  Loader2, 
  RefreshCw,
  ClipboardList
} from 'lucide-react';
import { useRealTimeSync } from '../../hooks/useRealTimeSync.js';
import { useRealtimeInvalidation } from '../../hooks/useRealtimeInvalidation.js';
import { notify } from '../../utils/notify.jsx';

const STATUS_LABELS = {
  pending_loading: 'Chờ phân xe',
  assigned: 'Đã phân xe',
  delivering: 'Đang giao hàng',
  completed: 'Đã xuất kho'
};

const STATUS_COLORS = {
  pending_loading: 'bg-amber-100 text-amber-700 border-amber-200',
  assigned: 'bg-blue-100 text-blue-700 border-blue-200',
  delivering: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200'
};

const STATUS_ICONS = {
  pending_loading: Clock,
  assigned: Truck,
  delivering: Package,
  completed: CheckCircle2
};

export default function LogisticsDashboard() {
  const { activeCompany } = useAuth();
  const [allOrders, setAllOrders] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const companyId = activeCompany?.id;

  const loadAllOrders = async () => {
    if (!companyId) {
      setAllOrders([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/logistics/queue-details', { 
        params: { company_id: companyId, status: 'all' } 
      });
      setAllOrders(res.data || []);
    } catch (err) {
      console.error('Lỗi tải đơn xuất kho:', err);
      setError('Không thể tải danh sách đơn xuất kho');
      setAllOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllOrders().catch(() => setAllOrders([]));
  }, [companyId]);

  // Realtime sync cho logistics
  const loadCallback = useCallback(() => loadAllOrders(), [companyId]);

  const { handlers: realtimeHandlers } = useRealtimeInvalidation(
    { logistics: loadCallback },
    {
      eventMap: {
        'orderStatusChanged': ['logistics'],
        'voucher:created': ['logistics'],
        'voucher:updated': ['logistics'],
        'voucher:deleted': ['logistics'],
        voucherCreated: ['logistics'],
        voucherUpdated: ['logistics'],
        voucherDeleted: ['logistics'],
        'inventory:updated': ['logistics'],
        inventoryUpdated: ['logistics'],
        'closing:completed': ['logistics'],
        closingCompleted: ['logistics']
      }
    }
  );

  useRealTimeSync(realtimeHandlers, { enabled: Boolean(companyId) });

  // Thống kê số lượng theo trạng thái
  const summary = useMemo(() => {
    const counts = { pending_loading: 0, assigned: 0, delivering: 0, completed: 0 };
    allOrders.forEach(o => {
      if (counts[o.loading_status] !== undefined) {
        counts[o.loading_status]++;
      }
    });
    return {
      ...counts,
      total: allOrders.length
    };
  }, [allOrders]);

  // Lọc đơn theo trạng thái
  const filteredOrders = useMemo(() => {
    if (filterStatus === 'all') return allOrders;
    return allOrders.filter(o => o.loading_status === filterStatus);
  }, [allOrders, filterStatus]);

  const assignTruck = async (voucherId) => {
    if (!companyId) return;
    try {
      await api.post('/logistics/assign-truck', { companyId, voucherId, truckId: 1 });
      await loadAllOrders();
      notify.success('Đã phân xe thành công!');
    } catch (err) {
      notify.error(err.response?.data?.error || 'Lỗi khi phân xe!');
    }
  };

  const confirmLoaded = async (voucherId) => {
    if (!companyId) return;
    try {
      await api.post('/logistics/confirm-loaded', { companyId, voucherId });
      await loadAllOrders();
      notify.success('Đã xác nhận bốc hàng!');
    } catch (err) {
      notify.error(err.response?.data?.error || 'Lỗi khi xác nhận!');
    }
  };

  const markCompleted = async (voucherId) => {
    if (!companyId) return;
    try {
      await api.post('/logistics/mark-completed', { companyId, voucherId });
      await loadAllOrders();
      notify.success('Đã hoàn thành xuất kho!');
    } catch (err) {
      notify.error(err.response?.data?.error || 'Lỗi khi hoàn thành!');
    }
  };

  const renderActionButton = (order) => {
    switch (order.loading_status) {
      case 'pending_loading':
        return (
          <button
            onClick={() => assignTruck(order.id)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
          >
            Phân xe
          </button>
        );
      case 'assigned':
        return (
          <button
            onClick={() => confirmLoaded(order.id)}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition"
          >
            Xác nhận đã bốc hàng
          </button>
        );
      case 'delivering':
        return (
          <button
            onClick={() => markCompleted(order.id)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition"
          >
            Hoàn thành xuất kho
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList size={22} className="text-indigo-600" />
            Theo Dõi Đơn Xuất Kho
          </h1>
          <p className="text-xs text-slate-400 mt-1">Quản lý toàn bộ quy trình xuất kho từ phân xe đến hoàn thành</p>
        </div>
        <button
          onClick={loadAllOrders}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {/* Thống kê nhanh - SỐ LƯỢNG ĐƠN XUẤT KHO THEO TRẠNG THÁI */}
      {!loading && allOrders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(STATUS_LABELS).map(([status, label]) => {
            const Icon = STATUS_ICONS[status];
            const count = summary[status] || 0;
            return (
              <button
                key={status}
                onClick={() => setFilterStatus(status === filterStatus ? 'all' : status)}
                className={`p-4 rounded-xl border shadow-sm text-left transition-all ${
                  filterStatus === status 
                    ? 'ring-2 ring-indigo-400 border-indigo-300 bg-white' 
                    : 'bg-white hover:shadow-md'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={18} className="text-slate-500" />
                  <span className="text-xs font-bold text-slate-500">{label}</span>
                </div>
                <p className={`text-2xl font-black ${status === 'completed' ? 'text-emerald-600' : 'text-slate-800'}`}>
                  {count}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Trạng thái lọc hiện tại */}
      {filterStatus !== 'all' && (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border ${STATUS_COLORS[filterStatus]}`}>
          <span>Đang xem:</span>
          <span>{STATUS_LABELS[filterStatus]}</span>
          <button onClick={() => setFilterStatus('all')} className="ml-1 hover:opacity-70">✕</button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-indigo-600" />
          <span className="ml-2 text-sm text-slate-400">Đang tải dữ liệu...</span>
        </div>
      )}

      {/* Danh sách đơn xuất kho */}
      {!loading && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
              <Package size={40} className="mb-2 opacity-30" />
              <p className="text-sm">
                {filterStatus === 'all' 
                  ? 'Chưa có đơn xuất kho nào' 
                  : `Không có đơn nào ở trạng thái "${STATUS_LABELS[filterStatus]}"`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold">
                  <tr>
                    <th className="p-3">Mã đơn</th>
                    <th className="p-3">Diễn giải</th>
                    <th className="p-3">Ngày</th>
                    <th className="p-3">SL</th>
                    <th className="p-3">Trạng thái</th>
                    <th className="p-3">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-slate-50/50 transition">
                      <td className="p-3 font-mono font-bold text-slate-700">
                        {order.voucher_number || `#${order.id}`}
                      </td>
                      <td className="p-3 text-slate-600 max-w-[250px] truncate" title={order.description}>
                        {order.description || '-'}
                      </td>
                      <td className="p-3 text-slate-500">
                        {order.voucher_date ? new Date(order.voucher_date).toLocaleDateString('vi-VN') : '-'}
                      </td>
                      <td className="p-3 font-mono font-bold">
                        {order.total_quantity || order.lines?.reduce((s, l) => s + (l.quantity || 0), 0) || 0}
                      </td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold border ${STATUS_COLORS[order.loading_status] || 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_LABELS[order.loading_status] || order.loading_status}
                        </span>
                      </td>
                      <td className="p-3">
                        {renderActionButton(order)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Chi tiết sản phẩm trong đơn (khi bấm vào) */}
      {filteredOrders.length > 0 && (
        <details className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <summary className="text-xs font-bold text-slate-600 cursor-pointer hover:text-slate-800">
            Xem chi tiết sản phẩm trong từng đơn
          </summary>
          <div className="mt-3 space-y-3">
            {filteredOrders.filter(o => o.lines?.length > 0).map(order => (
              <div key={order.id} className="bg-white rounded-lg p-3 border border-slate-100">
                <p className="text-xs font-bold text-slate-700 mb-2">
                  {order.voucher_number || `#${order.id}`}
                </p>
                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  {order.lines.map((line, idx) => (
                    <div key={idx} className="bg-slate-50 rounded p-2">
                      <p className="font-bold text-slate-700">{line.item_name || line.item_code || 'N/A'}</p>
                      <p className="text-slate-400">SL: {line.quantity}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Hướng dẫn */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <ClipboardList size={18} className="text-indigo-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-indigo-800">Quy trình xuất kho</p>
            <ul className="text-xs text-indigo-700 mt-1 space-y-1 list-disc list-inside">
              <li><strong>Chờ phân xe</strong> - Đơn mới tạo, chờ phân phương tiện vận chuyển</li>
              <li><strong>Đã phân xe</strong> - Đã có xe, chờ bốc hàng lên xe</li>
              <li><strong>Đang giao hàng</strong> - Hàng đã được bốc lên xe và đang giao</li>
              <li><strong>Đã xuất kho</strong> - Đơn đã hoàn thành xuất kho</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
