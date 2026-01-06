/**
 * Firebase Cloud Messaging (FCM) Utility
 * 
 * This module provides functions for sending push notifications to mobile devices.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to Firebase Console -> Project Settings -> Service Accounts
 * 2. Generate a new private key
 * 3. Save the JSON file as 'firebase-service-account.json' in the project root
 * 4. Add FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json to .env
 */

const admin = require('firebase-admin');
const path = require('path');

let firebaseInitialized = false;

// Initialize Firebase Admin SDK
const initializeFirebase = () => {
  if (firebaseInitialized) return true;

  try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    
    if (!serviceAccountPath) {
      console.warn('FCM Warning: FIREBASE_SERVICE_ACCOUNT_PATH not set in .env');
      return false;
    }

    const absolutePath = path.resolve(serviceAccountPath);
    const serviceAccount = require(absolutePath);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    firebaseInitialized = true;
    console.log('Firebase Admin SDK initialized successfully');
    return true;
  } catch (error) {
    console.warn('FCM Warning: Failed to initialize Firebase Admin SDK:', error.message);
    return false;
  }
};

/**
 * Send a push notification to a specific device
 * @param {string} fcmToken - The device's FCM token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data to send with the notification
 * @returns {Promise<object>} - Result of the send operation
 */
const sendNotification = async (fcmToken, title, body, data = {}) => {
  if (!initializeFirebase()) {
    return { success: false, message: 'Firebase not initialized' };
  }

  if (!fcmToken) {
    return { success: false, message: 'No FCM token provided' };
  }

  try {
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...Object.fromEntries(
          Object.entries(data).map(([key, value]) => [key, String(value)])
        ),
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      token: fcmToken,
    };

    const response = await admin.messaging().send(message);
    console.log('FCM notification sent successfully:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('FCM Error sending notification:', error.message);
    return { success: false, message: error.message };
  }
};

/**
 * Send notifications to all students of a parent
 * @param {string} parentPhone - The parent's phone number
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data to send
 * @returns {Promise<object>} - Result with success count
 */
const sendNotificationToParent = async (parentPhone, title, body, data = {}) => {
  if (!initializeFirebase()) {
    return { success: false, message: 'Firebase not initialized', sent: 0, failed: 0 };
  }

  try {
    const User = require('../models/User');
    const students = await User.find({ parentPhone, fcmToken: { $ne: null } });

    if (students.length === 0) {
      return { success: true, message: 'No students with FCM tokens found', sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const student of students) {
      const result = await sendNotification(student.fcmToken, title, body, data);
      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    }

    return { success: true, sent, failed };
  } catch (error) {
    console.error('FCM Error sending to parent:', error.message);
    return { success: false, message: error.message, sent: 0, failed: 0 };
  }
};

/**
 * Send notification to multiple tokens (batch)
 * @param {string[]} fcmTokens - Array of FCM tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data to send
 * @returns {Promise<object>} - Result with success/failure counts
 */
const sendNotificationBatch = async (fcmTokens, title, body, data = {}) => {
  if (!initializeFirebase()) {
    return { success: false, message: 'Firebase not initialized', sent: 0, failed: 0 };
  }

  const validTokens = fcmTokens.filter(token => token);
  
  if (validTokens.length === 0) {
    return { success: true, message: 'No valid FCM tokens', sent: 0, failed: 0 };
  }

  try {
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...Object.fromEntries(
          Object.entries(data).map(([key, value]) => [key, String(value)])
        ),
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      tokens: validTokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`FCM batch sent: ${response.successCount} success, ${response.failureCount} failed`);
    
    return {
      success: true,
      sent: response.successCount,
      failed: response.failureCount,
    };
  } catch (error) {
    console.error('FCM Error sending batch:', error.message);
    return { success: false, message: error.message, sent: 0, failed: 0 };
  }
};

module.exports = {
  initializeFirebase,
  sendNotification,
  sendNotificationToParent,
  sendNotificationBatch,
};
