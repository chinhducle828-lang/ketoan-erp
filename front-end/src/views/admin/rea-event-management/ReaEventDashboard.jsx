/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import EventStats from './EventStats';
import EventList from './EventList';
import EventDetail from './EventDetail';
import { useReaEvents } from './useReaEvents';
import './ReaEventDashboard.css';

export default function ReaEventDashboard() {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  const {
    events,
    loading,
    error,
    fetchEvents,
    retryEvent,
    deleteEvent,
    getEventStats
  } = useReaEvents();

  const stats = getEventStats();

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchEvents();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchEvents]);

  const handleRetry = async (eventId) => {
    const result = await retryEvent(eventId);
    if (result.success) {
      alert('Đã thử lại sự kiện thành công!');
    } else {
      alert(`Lỗi: ${result.error}`);
    }
  };

  const handleDelete = async (eventId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa sự kiện này?')) {
      return;
    }

    const result = await deleteEvent(eventId);
    if (result.success) {
      alert('Đã xóa sự kiện thành công!');
    } else {
      alert(`Lỗi: ${result.error}`);
    }
  };

  const handleViewDetail = (event) => {
    setSelectedEvent(event);
  };

  const handleCloseDetail = () => {
    setSelectedEvent(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quản lý Sự kiện REA</h1>
          <p className="text-sm text-slate-500 mt-1">
            Theo dõi và quản lý các sự kiện trong hệ thống kế toán
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-600">Tự động làm mới</span>
          </label>
          <button
            onClick={() => fetchEvents()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Làm mới
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-rose-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-rose-800">Lỗi tải dữ liệu</p>
            <p className="text-sm text-rose-600 mt-1">{error}</p>
          </div>
          <button
            onClick={() => fetchEvents()}
            className="text-sm text-rose-600 hover:text-rose-700 font-medium"
          >
            Thử lại
          </button>
        </div>
      )}

      <EventStats stats={stats} />

      <EventList
        events={events}
        loading={loading}
        onRetry={handleRetry}
        onDelete={handleDelete}
        onViewDetail={handleViewDetail}
      />

      {selectedEvent && (
        <EventDetail event={selectedEvent} onClose={handleCloseDetail} />
      )}
    </div>
  );
}