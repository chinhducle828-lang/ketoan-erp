import React, { useState, useEffect } from 'react';
import api from '../../utils/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ShieldAlert, Search, Filter, Calendar, User, Activity, Monitor } from 'lucide-react';

export default function AuditLogs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });

  // Filters
  const [filters, setFilters] = useState({
    user_id: '',
    action: '',
    entity_type: '',
    start_date: '',
    end_date: ''
  });

  const [showFilters, setShowFilters] = useState(false);

  // Fetch audit logs
  useEffect(() => {
    fetchAuditLogs();
  }, [pagination.page, filters]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', pagination.page);
      params.append('limit', pagination.limit);

      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });

      const response = await api.get(`/inventory/audit-logs?${params.toString()}`);
      if (response.data?.success) {
        setLogs(response.data.data);
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Lỗi tải audit logs:', error);
      const errorMessage = error.response?.data?.error || 'Không thể tải nhật ký hệ thống';
      alert(`Lỗi: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  const clearFilters = () => {
    setFilters({
      user_id: '',
      action: '',
      entity_type: '',
      start_date: '',
      end_date: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getActionBadge = (action) => {
    const badges = {
      'LOGIN': 'bg-emerald-100 text-emerald-700 border-emerald-200',
      'CREATE': 'bg-blue-100 text-blue-700 border-blue-200',
      'UPDATE': 'bg-amber-100 text-amber-700 border-amber-200',
      'DELETE': 'bg-rose-100 text-rose-700 border-rose-200',
      'GOODSISSUE': 'bg-orange-100 text-orange-700 border-orange-200'
    };
    return badges[action] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getEntityBadge = (entityType) => {
    const badges = {
      'VOUCHERS': 'bg-indigo-100 text-indigo-700 border-indigo-200',
      'USERS': 'bg-purple-100 text-purple-700 border-purple-200',
      'PARTNERS': 'bg-pink-100 text-pink-700 border-pink-200',
      'COMPANIES': 'bg-teal-100 text-teal-700 border-teal-200',
      'ITEMS': 'bg-orange-100 text-orange-700 border-orange-200',
      'INVENTORY_VOUCHERS': 'bg-cyan-100 text-cyan-700 border-cyan-200',
      'VOUCHER_DETAILS': 'bg-violet-100 text-violet-700 border-violet-200'
    };
    return badges[entityType] || 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const formatJSON = (json) => {
    if (!json) return '—';
    try {
      const obj = typeof json === 'string' ? JSON.parse(json) : json;
      return JSON.stringify(obj, null, 2);
    } catch {
      return json;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="space-y-6 bg-slate-50/50 p-4 rounded-3xl min-h-screen">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2 tracking-tight uppercase">
            <ShieldAlert className="text-rose-600" size={24} />
            Nhật Ký An Ninh & Hệ Thống
          </h1>
          <p className="text-xs text-slate-400 mt-1 italic">
            Theo dõi toàn bộ vết biến động dữ liệu và lịch sử đăng nhập hệ thống
          </p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Filter size={14} />
          {showFilters ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* User ID Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                <User size={12} className="inline mr-1" />
                Mã người dùng
              </label>
              <input
                type="number"
                value={filters.user_id}
                onChange={(e) => handleFilterChange('user_id', e.target.value)}
                placeholder="VD: 1, 2, 3..."
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500"
              />
            </div>

            {/* Action Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                <Activity size={12} className="inline mr-1" />
                Hành động
              </label>
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500"
              >
                <option value="">Tất cả</option>
                <option value="LOGIN">LOGIN</option>
                <option value="CREATE">CREATE</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
                <option value="GOODSISSUE">GOODSISSUE</option>
              </select>
            </div>

            {/* Entity Type Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                <Monitor size={12} className="inline mr-1" />
                Loại đối tượng
              </label>
              <select
                value={filters.entity_type}
                onChange={(e) => handleFilterChange('entity_type', e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500"
              >
                <option value="">Tất cả</option>
                <option value="VOUCHERS">VOUCHERS</option>
                <option value="VOUCHER_DETAILS">VOUCHER_DETAILS</option>
                <option value="USERS">USERS</option>
                <option value="PARTNERS">PARTNERS</option>
                <option value="COMPANIES">COMPANIES</option>
                <option value="ITEMS">ITEMS</option>
                <option value="INVENTORY_VOUCHERS">INVENTORY_VOUCHERS</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                <Calendar size={12} className="inline mr-1" />
                Từ ngày
              </label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                <Calendar size={12} className="inline mr-1" />
                Đến ngày
              </label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/10 focus:border-rose-500"
              />
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Xóa bộ lọc
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tổng bản ghi</div>
          <div className="text-2xl font-black text-slate-800">{pagination.total}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Trang hiện tại</div>
          <div className="text-2xl font-black text-slate-800">{pagination.page} / {pagination.totalPages}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bản ghi/trang</div>
          <div className="text-2xl font-black text-slate-800">{pagination.limit}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Vai trò của bạn</div>
          <div className="text-2xl font-black text-rose-600">{user?.role?.toUpperCase()}</div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider text-[11px]">
                <th className="p-3.5 w-16">ID</th>
                <th className="p-3.5">Người dùng</th>
                <th className="p-3.5">Hành động</th>
                <th className="p-3.5">Đối tượng</th>
                <th className="p-3.5">IP Address</th>
                <th className="p-3.5">Thời gian</th>
                <th className="p-3.5 text-center">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-slate-500 text-xs font-medium">Đang tải nhật ký hệ thống...</p>
                    </div>
                  </td>
                </tr>
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="p-3.5 font-mono text-slate-600">#{log.id}</td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-800">{log.username || 'Hệ thống'}</div>
                      {log.user_id && <div className="text-[10px] text-slate-400">ID: {log.user_id}</div>}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${getActionBadge(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${getEntityBadge(log.entity_type)}`}>
                        {log.entity_type}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <code className="text-[10px] bg-slate-100 px-2 py-1 rounded font-mono text-slate-600">
                        {log.ip_address}
                      </code>
                    </td>
                    <td className="p-3.5 text-slate-600 whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="p-3.5 text-center">
                      <details className="inline-block text-left group">
                        <summary className="list-none inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-[10px] font-black text-rose-700 cursor-pointer hover:bg-rose-100 transition-colors uppercase tracking-wider">
                          <span className="group-open:hidden">▶</span>
                          <span className="hidden group-open:inline">▼</span>
                          Xem chi tiết
                        </summary>
                        <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3 w-[22rem] max-w-[80vw] shadow-sm">
                          {log.old_values && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50/60 overflow-hidden">
                              <div className="text-[10px] font-black text-amber-700 uppercase px-2.5 py-1.5 border-b border-amber-200">Dữ liệu cũ</div>
                              <pre className="text-[10px] leading-relaxed bg-white/70 p-2.5 overflow-x-auto max-h-40 overflow-y-auto text-slate-700 font-mono">
                                {formatJSON(log.old_values)}
                              </pre>
                            </div>
                          )}
                          {log.new_values && (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 overflow-hidden">
                              <div className="text-[10px] font-black text-emerald-700 uppercase px-2.5 py-1.5 border-b border-emerald-200">Dữ liệu mới</div>
                              <pre className="text-[10px] leading-relaxed bg-white/70 p-2.5 overflow-x-auto max-h-40 overflow-y-auto text-slate-700 font-mono">
                                {formatJSON(log.new_values)}
                              </pre>
                            </div>
                          )}
                          {!log.old_values && !log.new_values && (
                            <div className="text-[10px] text-slate-500 italic bg-white border border-slate-200 rounded-lg px-2.5 py-2">
                              Không có dữ liệu chi tiết
                            </div>
                          )}
                        </div>
                      </details>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="text-center py-12 text-slate-400 text-xs italic">
                    Không có nhật ký hệ thống nào được tìm thấy.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            disabled={pagination.page === 1}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors"
          >
            ← Trước
          </button>
          <span className="text-xs text-slate-600 font-medium">
            Trang {pagination.page} / {pagination.totalPages}
          </span>
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={pagination.page === pagination.totalPages}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-colors"
          >
            Tiếp →
          </button>
        </div>
      )}
    </div>
  );
}