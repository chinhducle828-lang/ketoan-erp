/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import { useState, useEffect, useCallback } from 'react';
import { usePushNotification } from '../hooks/usePushNotification';
import { useRealTimeBase } from '../hooks/useRealTime-base';
import wsService from '../services/websocket.js';
import api from '../utils/api.js';

export default function NotificationBell({ companyId, userId }) {
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const { isSupported, permission, requestPermission, subscribe, isLoading } = usePushNotification();

  // Auto-connect WebSocket via base hook
  useRealTimeBase(companyId, userId);

  // Load notifications from API
  const loadNotifications = useCallback(() => {
    if (!companyId) return;

    api
      .get('/notifications', { params: { company_id: companyId } })
      .then((res) => {
        const data = res.data;
        if (data?.success) setNotifications(data.data || []);
      })
      .catch((error) => {
        console.error('Failed to load notifications:', error);
      });
  }, [companyId]);

  // Load notifications on mount
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // WebSocket listener for real-time notification updates
  useEffect(() => {
    if (!companyId) return;

    const handleNotificationNew = (notification) => {
      // Prepend new notification to list
      setNotifications(prev => [notification, ...prev]);
    };

    wsService.on('notification:new', handleNotificationNew);

    return () => {
      wsService.off('notification:new', handleNotificationNew);
    };
  }, [companyId]);

  // Request permission button handler
  const handleEnableNotifications = async () => {
    const result = await requestPermission();
    if (result.success) {
      await subscribe(companyId);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="notification-bell">
      <button 
        className="bell-button"
        onClick={() => setShowDropdown(!showDropdown)}
      >
        🔔
        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>

      {showDropdown && (
        <div className="notification-dropdown">
          <div className="dropdown-header">
            <h3>Thông báo</h3>
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <p className="no-notifications">Không có thông báo mới</p>
            ) : (
              notifications.map(notif => (
                <div key={notif.id} className="notification-item">
                  <h4>{notif.title}</h4>
                  <p>{notif.message}</p>
                  <span className="time">{new Date(notif.created_at).toLocaleString()}</span>
                </div>
              ))
            )}
          </div>

          {/* Enable notifications banner */}
          {isSupported && permission === 'default' && (
            <div className="enable-push-banner">
              <p>Bật thông báo để không bỏ lỡ cập nhật?</p>
              <button 
                onClick={handleEnableNotifications}
                disabled={isLoading}
              >
                {isLoading ? 'Đang bật...' : 'Bật thông báo'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}