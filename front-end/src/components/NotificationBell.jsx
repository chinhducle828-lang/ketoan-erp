import { useState, useEffect } from 'react';
import { usePushNotification } from '../hooks/usePushNotification';

export default function NotificationBell({ companyId }) {
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const { isSupported, permission, requestPermission, subscribe, isLoading } = usePushNotification();

  // Load notifications
  useEffect(() => {
    if (!companyId) return;
    
    fetch(`/api/notifications?company_id=${companyId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setNotifications(data.data || []);
      });
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