/**
 * Mock Notification Data for Testing
 * Use this to simulate voucher notifications
 */

// Mock notification data
export const mockNotifications = [
  {
    id: 1,
    title: 'Đơn hàng mới',
    message: 'Đơn hàng #SO-001 đã được tạo thành công',
    read: false,
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    title: 'Cập nhật trạng thái',
    message: 'Đơn hàng #SO-001 đã được kho xử lý',
    read: false,
    created_at: new Date().toISOString()
  }
];

// Function to trigger mock notification
export const triggerMockNotification = () => {
  const event = new CustomEvent('notification:new', {
    detail: {
      id: Date.now(),
      title: 'Test Notification',
      message: 'Đây là thông báo test từ hệ thống',
      read: false,
      created_at: new Date().toISOString()
    }
  });
  window.dispatchEvent(event);
};

// Function to test OS notification
export const testOSNotification = () => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Test OS Notification', {
      body: 'Hệ thống thông báo đã hoạt động!',
      icon: '/favicon.svg',
      tag: 'test-notification',
      data: { url: window.location.href }
    });
  } else {
    console.log('Notification permission not granted');
  }
};