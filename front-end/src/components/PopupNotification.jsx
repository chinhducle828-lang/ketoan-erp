/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { X, Bell } from 'lucide-react';

/**
 * PopupNotification - Hiển thị popup thông báo thời gian thực
 * Lắng nghe các event từ WebSocket (notification:new) và hiển thị popup góc dưới bên phải
 */
export default function PopupNotification() {
  const { subscribe } = useSocket();
  const { user, activeCompany } = useAuth();
  const [popup, setPopup] = useState(null);

  useEffect(() => {
    if (!subscribe) return;

    const handleNotification = (data) => {
      setPopup({
        id: data.id || Date.now(),
        title: data.title || 'Thông báo mới',
        message: data.message || data.content || '',
        type: data.type || 'info',
        timestamp: new Date()
      });

      // Auto dismiss after 5s
      setTimeout(() => {
        setPopup(prev => (prev?.id === (data.id || Date.now()) ? null : prev));
      }, 5000);
    };

    const unsub = subscribe('notification:new', handleNotification);
    return () => {
      if (unsub) unsub();
    };
  }, [subscribe, user, activeCompany]);

  if (!popup) return null;

  const colors = {
    info: 'bg-blue-600',
    success: 'bg-emerald-600',
    warning: 'bg-amber-600',
    error: 'bg-rose-600'
  };

  const color = colors[popup.type] || colors.info;

  return (
    <div className="fixed bottom-4 right-4 z-[100] max-w-sm">
      <div className={`${color} text-white rounded-xl shadow-2xl p-4 flex items-start gap-3 animate-slide-in`}>
        <div className="shrink-0 mt-0.5">
          <Bell size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide opacity-80 mb-0.5">
            {popup.title}
          </p>
          <p className="text-sm font-medium leading-snug">{popup.message}</p>
          <p className="text-[10px] opacity-70 mt-1">
            {popup.timestamp.toLocaleTimeString('vi-VN')}
          </p>
        </div>
        <button
          onClick={() => setPopup(null)}
          className="shrink-0 opacity-70 hover:opacity-100 transition"
          aria-label="Đóng"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}