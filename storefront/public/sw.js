/**
 * Service Worker for Web Push Notifications
 * Handles push events and notification clicks
 */

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Ketoan ERP';
  const options = {
    body: data.body || 'Bạn có một thông báo mới',
    icon: data.icon || '/favicon.svg',
    badge: data.badge || '/favicon.svg',
    data: data.data || {},
    tag: data.tag || 'default',
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.openWindow(url)
  );
});

self.addEventListener('notificationclose', (event) => {
  // Optional: Track notification close events
});