export const requestPermission = async () => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  return Notification.requestPermission();
};

export const showNotification = async (title, message) => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }

  if (Notification.permission !== 'granted') {
    await requestPermission();
  }

  if (Notification.permission === 'granted') {
    return new Notification(title, {
      body: message,
      icon: '/favicon.ico'
    });
  }

  return null;
};
