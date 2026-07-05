import React, { useState, useEffect } from 'react';
import { useVoucherNotifications } from '../hooks/useRealTime';
import { Bell, X, FileText, Check } from 'lucide-react';

// Voucher notification component
export default function VoucherNotification() {
  const { notifications, markAsRead, clearNotifications } = useVoucherNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <Bell size={20} className="text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b flex justify-between items-center">
            <h3 className="font-semibold text-slate-800">Thông báo chứng từ</h3>
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => {
                    notifications.forEach(n => markAsRead(n.id));
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Đánh dấu đã đọc
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X size={16} className="text-slate-500" />
              </button>
            </div>
          </div>

          <div className="divide-y">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-sm">
                Không có thông báo
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-3 hover:bg-slate-50 cursor-pointer ${
                    !notification.read ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex gap-2">
                    <div className="p-1.5 bg-blue-100 rounded">
                      <FileText size={14} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-slate-800">
                        {notification.title}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(notification.timestamp).toLocaleTimeString('vi-VN')}
                      </p>
                    </div>
                    {notification.read && (
                      <Check size={14} className="text-emerald-500" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}