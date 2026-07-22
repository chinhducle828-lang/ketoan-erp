/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState, useEffect } from 'react';
import { RefreshCw, Trash2, Eye, Search, Filter, AlertCircle, Activity } from 'lucide-react';

export default function EventList({ events, loading, onRetry, onDelete, onViewDetail, error }) {
  const [filters, setFilters] = useState({
    status: '',
    eventType: '',
    search: ''
  });
  const [filteredEvents, setFilteredEvents] = useState(events);

  useEffect(() => {
    let result = events;

    if (filters.status) {
      result = result.filter(e => e.status === filters.status);
    }

    if (filters.eventType) {
      result = result.filter(e => e.event_type === filters.eventType);
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(e => 
        e.id?.toString().includes(searchLower) ||
        e.event_type?.toLowerCase().includes(searchLower) ||
        e.description?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredEvents(result);
  }, [filters, events]);

  const getStatusBadge = (status) => {
    const statusConfig = {
      PENDING: { label: 'Chờ xử lý', className: 'bg-amber-100 text-amber-700 border-amber-200' },
      PROCESSING: { label: 'Đang xử lý', className: 'bg-blue-100 text-blue-700 border-blue-200' },
      COMPLETED: { label: 'Hoàn thành', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
      FAILED: { label: 'Thất bại', className: 'bg-rose-100 text-rose-700 border-rose-200' },
      RETRYING: { label: 'Đang thử lại', className: 'bg-purple-100 text-purple-700 border-purple-200' }
    };

    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-700 border-gray-200' };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-lg border ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getUniqueEventTypes = () => {
    const types = [...new Set(events.map(e => e.event_type))];
    return types.sort();
  };

  if (loading) {
    return (
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-sm text-slate-600">Đang tải dữ liệu...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-sm">
        <div className="flex items-start gap-3 p-4 bg-rose-50 rounded-xl">
          <AlertCircle size={20} className="text-rose-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-rose-800">Lỗi tải danh sách sự kiện</p>
            <p className="text-sm text-rose-600 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <p className="text-sm text-slate-500 text-center py-6">Chưa có sự kiện nào.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Activity size={16} className="text-blue-600" /> Danh sách sự kiện
        </h3>
        <span className="text-xs text-slate-500">
          {filteredEvents.length} / {events.length} sự kiện
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo ID, loại sự kiện, mô tả..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-2">
          <div className="relative">
            <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="PENDING">Chờ xử lý</option>
              <option value="PROCESSING">Đang xử lý</option>
              <option value="COMPLETED">Hoàn thành</option>
              <option value="FAILED">Thất bại</option>
              <option value="RETRYING">Đang thử lại</option>
            </select>
          </div>

          <select
            value={filters.eventType}
            onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
          >
            <option value="">Tất cả loại</option>
            {getUniqueEventTypes().map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
              <th className="p-3">ID</th>
              <th className="p-3">Loại sự kiện</th>
              <th className="p-3">Trạng thái</th>
              <th className="p-3">Thời gian tạo</th>
              <th className="p-3 text-center">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredEvents.map(event => (
              <tr key={event.id} className="hover:bg-slate-50/50 transition">
                <td className="p-3 font-mono text-slate-700">#{event.id}</td>
                <td className="p-3">
                  <div>
                    <p className="font-medium text-slate-700">{event.event_type}</p>
                    {event.description && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">
                        {event.description}
                      </p>
                    )}
                  </div>
                </td>
                <td className="p-3">{getStatusBadge(event.status)}</td>
                <td className="p-3 text-slate-600">{formatDate(event.created_at)}</td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onViewDetail(event)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded-xl hover:bg-blue-50 transition"
                      title="Xem chi tiết"
                    >
                      <Eye size={15} />
                    </button>
                    
                    {(event.status === 'FAILED' || event.status === 'PENDING') && (
                      <button
                        onClick={() => onRetry(event.id)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 rounded-xl hover:bg-amber-50 transition"
                        title="Thử lại"
                      >
                        <RefreshCw size={15} />
                      </button>
                    )}
                    
                    <button
                      onClick={() => onDelete(event.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition"
                      title="Xóa"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredEvents.length === 0 && events.length > 0 && (
        <p className="text-sm text-slate-500 text-center py-6">
          Không tìm thấy sự kiện nào phù hợp với bộ lọc.
        </p>
      )}
    </div>
  );
}