/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, CheckCheck, Loader2, AlertTriangle } from 'lucide-react';
import { usePushNotification } from '../hooks/usePushNotification';
import { useRealTimeBase } from '../hooks/useRealTime-base';
import wsService from '../services/websocket.js';
import api from '../utils/api.js';

export default function NotificationBell({ companyId, userId }) {
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const { isSupported, permission, requestPermission, subscribe, isLoading } = usePushNotification();

  // Auto-connect WebSocket via base hook
  useRealTimeBase(companyId, userId);

  // Load notifications from API
  const loadNotifications = useCallback(() => {
    if (!companyId) return;

    setLoading(true);
    setError(null);
    api
      .get('/notifications', { params: { company_id: companyId } })
      .then((res) => {
        const data = res.data;
        if (data?.success) {
          setNotifications(data.data || []);
        } else {
          setNotifications([]);
        }
      })
      .catch((err) => {
        console.error('Failed to load notifications:', err);
        setError('Không thể tải thông báo. Vui lòng thử lại sau.');
        setNotifications([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [companyId]);

  // Load notifications on mount / when company changes
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // WebSocket listener for real-time notification updates
  useEffect(() => {
    if (!companyId) return;

    const handleNotificationNew = (notification) => {
      // Prepend new notification to list
      setNotifications((prev) => [notification, ...prev]);
    };

    wsService.on('notification:new', handleNotificationNew);

    return () => {
      wsService.off('notification:new', handleNotificationNew);
    };
  }, [companyId]);

  // Đóng dropdown khi click ra ngoài hoặc nhấn Escape
  useEffect(() => {
    if (!showDropdown) return;

    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setShowDropdown(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showDropdown]);

  // Request permission button handler
  const handleEnableNotifications = async () => {
    const result = await requestPermission();
    if (result.success) {
      await subscribe(companyId);
    }
  };

  // Đánh dấu tất cả đã đọc (best-effort: gọi API, cập nhật local lạc quan)
  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await api.put('/notifications/mark-read', { company_id: companyId });
    } catch (err) {
      // Không làm hỏng UI nếu endpoint chưa tồn tại; chỉ log
      console.warn('Mark-all-read API not available:', err?.message);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="relative p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200 active:scale-95"
        onClick={() => setShowDropdown((v) => !v)}
        title="Thông báo"
        aria-label="Thông báo"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold leading-none ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] z-50 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-900/10 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Thông báo</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 transition-colors"
                title="Đánh dấu tất cả đã đọc"
              >
                <CheckCheck size={14} />
                Đã đọc
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-slate-400 text-xs font-medium">
                <Loader2 size={16} className="animate-spin" />
                Đang tải thông báo...
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 px-4 py-8 text-rose-500 text-xs font-medium">
                <AlertTriangle size={16} className="shrink-0" />
                {error}
              </div>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-slate-400 text-xs font-medium">
                Không có thông báo mới
              </p>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors ${
                    notif.is_read ? 'opacity-60' : ''
                  }`}
                >
                  <h4 className="text-sm font-semibold text-slate-800">{notif.title}</h4>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{notif.message}</p>
                  <span className="block mt-1 text-[10px] text-slate-400">
                    {notif.created_at ? new Date(notif.created_at).toLocaleString() : ''}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Enable notifications banner */}
          {isSupported && permission === 'default' && (
            <div className="px-4 py-3 bg-emerald-50 border-t border-emerald-100 flex items-center justify-between gap-2">
              <p className="text-[11px] text-emerald-700 font-medium leading-snug">
                Bật thông báo để không bỏ lỡ cập nhật?
              </p>
              <button
                type="button"
                onClick={handleEnableNotifications}
                disabled={isLoading}
                className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-[11px] font-semibold hover:bg-emerald-600 disabled:opacity-60 transition-colors"
              >
                {isLoading ? 'Đang bật...' : 'Bật'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}