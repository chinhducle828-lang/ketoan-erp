/**
 * Push Notification Service
 * Handles web push subscription and notification display
 */

// VAPID public key from environment
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

// Convert base64 to Uint8Array for applicationServerKey
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Check if push notifications are supported
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

// Register service worker
export async function registerServiceWorker() {
  if (!isPushSupported()) {
    throw new Error('Push notifications not supported in this browser');
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  return registration;
}

// Subscribe to push notifications
export async function subscribeToPush(companyId) {
  if (!isPushSupported()) {
    throw new Error('Push notifications not supported');
  }

  const registration = await registerServiceWorker();
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  });

  // Send subscription to backend
  const response = await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('erp_token') || ''}`
    },
    credentials: 'include',
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      p256dh: subscription.getKey('p256dh') ? 
        btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))) : '',
      auth: subscription.getKey('auth') ? 
        btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')))) : '',
      companyId
    })
  });

  if (!response.ok) {
    throw new Error('Failed to subscribe to push notifications');
  }

  return subscription;
}

// Unsubscribe from push notifications
export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  
  if (subscription) {
    await subscription.unsubscribe();
    
    // Notify backend
    await fetch('/api/notifications/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('erp_token') || ''}`
      },
      credentials: 'include',
      body: JSON.stringify({
        endpoint: subscription.endpoint
      })
    });
  }
}

// Request permission and subscribe
export async function requestPushPermission(companyId) {
  const permission = await Notification.requestPermission();
  
  if (permission === 'granted') {
    return await subscribeToPush(companyId);
  }
  
  throw new Error('Permission denied for push notifications');
}