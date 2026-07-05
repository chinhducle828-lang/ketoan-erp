const CACHE_NAME = 'ketoan-push-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Install');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate');
  event.waitUntil(self.clients.claim());
});

// Push event - nhận push từ FCM/APNs
self.addEventListener('push', (event) => {
  const payload = event.data?.json() || {};
  
  const options = {
    body: payload.body || 'Bạn có thông báo mới',
    icon: payload.icon || '/icons/notification-icon.png',
    badge: payload.badge || '/icons/notification-badge.png',
    vibrate: [200, 100, 200],
    tag: payload.data?.notificationId || 'default',
    renotify: false,
    requireInteraction: false, // Auto-close after 5s
    actions: [
      { action: 'view', title: 'Xem ngay' },
      { action: 'close', title: 'Đóng' }
    ],
    data: payload.data || {}
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Kế Toán ERP', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};
  const url = data.url || '/notifications';

  if (action === 'close') {
    return;
  }

  // Open/focus the app
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // If a window is already open, focus it
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});