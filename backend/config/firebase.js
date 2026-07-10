/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * Firebase Admin SDK Configuration for FCM Push Notifications
 */

import admin from 'firebase-admin';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

let firebaseApp = null;

/**
 * Initialize Firebase Admin SDK
 */
export function initializeFirebase() {
  if (firebaseApp) {
    return firebaseApp;
  }

  const fcmKey = process.env.FCM_SERVER_KEY;
  
  if (!fcmKey) {
    console.warn('⚠️ FCM_SERVER_KEY not configured. Firebase push notifications will not work.');
    return null;
  }

  try {
    // Initialize with service account or just the server key
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // Use service account JSON
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      // Use just the server key for basic messaging
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID || 'ketoan-erp',
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
      });
    }
    
    console.log('✅ Firebase Admin SDK initialized successfully');
    return firebaseApp;
  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
    return null;
  }
}

/**
 * Send push notification via FCM
 */
export async function sendFCMNotification({ token, title, body, data = {} }) {
  const app = initializeFirebase();
  
  if (!app) {
    throw new Error('Firebase not initialized');
  }

  try {
    const message = {
      token,
      notification: {
        title,
        body
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      android: {
        priority: 'high',
        notification: {
          channel_id: 'otp_channel',
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            category: 'otp_category'
          }
        }
      }
    };

    const response = await admin.messaging().send(message);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('FCM send error:', error.message);
    throw error;
  }
}

/**
 * Send push notification to multiple tokens
 */
export async function sendFCMMulticast({ tokens, title, body, data = {} }) {
  const app = initializeFirebase();
  
  if (!app) {
    throw new Error('Firebase not initialized');
  }

  if (!tokens || tokens.length === 0) {
    return { success: true, sent: 0, failed: 0 };
  }

  try {
    const message = {
      tokens,
      notification: {
        title,
        body
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      }
    };

    const response = await admin.messaging().sendMulticast(message);
    
    // Handle failed tokens
    const failedTokens = [];
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
        }
      });
    }

    return {
      success: true,
      sent: response.successCount,
      failed: response.failureCount,
      failedTokens
    };
  } catch (error) {
    console.error('FCM multicast error:', error.message);
    throw error;
  }
}

export default {
  initializeFirebase,
  sendFCMNotification,
  sendFCMMulticast
};