/**
 * Notification Sender Utility
 * 
 * This module provides functions for sending push notifications to users
 * via Firebase Cloud Messaging (FCM), replacing SMS functionality.
 * 
 * Features:
 * - Send notifications to users by phone number
 * - Send notifications to parents (all students of a parent)
 * - Professional, detailed notification messages
 * - Automatic FCM token lookup from User model
 */

const { sendNotification, sendNotificationToParent, sendNotificationBatch } = require('./fcm');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { 
  buildAttendanceNotification, 
  buildHomeworkNotification, 
  buildQuizNotification,
  getHomeworkStatusLine,
  getHomeworkStatusLabel,
} = require('./notificationTranslations');

/**
 * Normalize phone number for lookup
 * @param {string} phone - Phone number to normalize
 * @returns {string} - Normalized phone number
 */
function normalizePhone(phone) {
  if (!phone) return '';
  // Remove all non-digit characters
  return String(phone).replace(/\D/g, '');
}

/**
 * Find user by phone number (student or parent)
 * @param {string} phone - Phone number to search for
 * @returns {Promise<Object|null>} - User object or null
 */
async function findUserByPhone(phone) {
  if (!phone) return null;
  
  const normalizedPhone = normalizePhone(phone);
  
  // Try to find by student phone first
  let user = await User.findOne({ 
    $or: [
      { phone: normalizedPhone },
      { phone: { $regex: new RegExp(normalizedPhone.slice(-9)) } } // Last 9 digits
    ],
    fcmToken: { $ne: null }
  });
  
  // If not found, try parent phone
  if (!user) {
    user = await User.findOne({ 
      $or: [
        { parentPhone: normalizedPhone },
        { parentPhone: { $regex: new RegExp(normalizedPhone.slice(-9)) } } // Last 9 digits
      ],
      fcmToken: { $ne: null }
    });
  }
  
  return user;
}

/**
 * Get user's notification language preference
 * @param {string} phone - Phone number to search for
 * @returns {Promise<string>} - Language code (EN/AR), defaults to EN
 */
async function getUserLanguage(phone) {
  if (!phone) return 'EN';
  
  const normalizedPhone = normalizePhone(phone);
  
  // Find user by parent phone to get language preference
  const user = await User.findOne({ 
    $or: [
      { parentPhone: normalizedPhone },
      { parentPhone: { $regex: new RegExp(normalizedPhone.slice(-9)) } }
    ]
  });
  
  return user?.notificationLanguage || 'EN';
}

/**
 * Format professional notification message with details
 * @param {string} baseMessage - Base message text
 * @param {object} details - Additional details to include
 * @returns {object} - Formatted title and body
 */
function formatNotificationMessage(baseMessage, details = {}) {
  let title = 'Mayada Academy';
  let body = baseMessage;
  
  // Extract title from message if it contains a colon or newline
  if (baseMessage.includes(':')) {
    const parts = baseMessage.split(':');
    if (parts.length > 1) {
      title = parts[0].trim();
      body = parts.slice(1).join(':').trim();
    }
  }
  
  // Add details to body if provided
  if (Object.keys(details).length > 0) {
    const detailLines = [];
    
    if (details.studentCode) {
      detailLines.push(`Student Code: ${details.studentCode}`);
    }
    if (details.studentName) {
      detailLines.push(`Student: ${details.studentName}`);
    }
    if (details.grade) {
      detailLines.push(`Grade: ${details.grade}`);
    }
    if (details.centerName) {
      detailLines.push(`Center: ${details.centerName}`);
    }
    if (details.balance !== undefined) {
      detailLines.push(`Balance: ${details.balance}`);
    }
    if (details.link) {
      detailLines.push(`\n${details.link}`);
    }
    
    if (detailLines.length > 0) {
      body = `${body}\n\n${detailLines.join('\n')}`;
    }
  }
  
  return { title, body };
}

/**
 * Save notification to the database
 * @param {object} notificationData - Notification data to save
 * @returns {Promise<object|null>} - Saved notification or null
 */
async function saveNotificationToDatabase(notificationData) {
  try {
    // Valid notification types from the Notification model
    const validTypes = [
      'attendance', 'attendance_present', 'attendance_late', 'attendance_absent',
      'homework', 'payment', 'custom', 'block', 'unblock', 'registration', 'general'
    ];
    
    // Map unknown types to 'custom'
    const notificationType = validTypes.includes(notificationData.type) 
      ? notificationData.type 
      : 'custom';
    
    // Duplicate prevention: Check if an identical notification was saved in the last 60 seconds
    const deduplicationWindow = new Date(Date.now() - 60 * 1000);
    const deduplicationQuery = {
      parentPhone: notificationData.parentPhone,
      type: notificationType,
      title: notificationData.title,
      body: notificationData.body,
      createdAt: { $gte: deduplicationWindow }
    };
    // Include studentId in dedup check if provided
    if (notificationData.studentId) {
      deduplicationQuery.studentId = notificationData.studentId;
    }
    
    const existingNotification = await Notification.findOne(deduplicationQuery);
    
    if (existingNotification) {
      console.log('Duplicate notification detected, reusing existing ID:', existingNotification._id);
      existingNotification._isDuplicate = true;
      return existingNotification;
    }
    
    const notification = new Notification({
      studentId: notificationData.studentId || null,
      teacherId: notificationData.teacherId || null,
      parentPhone: notificationData.parentPhone,
      type: notificationType,
      title: notificationData.title,
      body: notificationData.body,
      data: notificationData.data || {},
      status: notificationData.status || 'sent',
      isRead: false,
    });
    
    await notification.save();
    console.log('Notification saved to database:', notification._id);
    notification._isDuplicate = false;
    return notification;
  } catch (error) {
    console.error('Error saving notification to database:', error.message);
    return null;
  }
}

/**
 * Send notification to a user by phone number
 * @param {string} phone - Phone number (student or parent)
 * @param {string} message - Message text
 * @param {object} details - Additional details (studentCode, studentName, grade, etc.)
 * @param {string} countryCode - Country code (optional, for compatibility)
 * @returns {Promise<{success: boolean, message?: string, data?: any}>}
 */
async function sendNotificationMessage(phone, message, details = {}, countryCode = '20') {
  try {
    if (!phone || !message) {
      return { success: false, message: 'Phone number and message are required' };
    }
    
    // Format the notification message
    const { title, body } = formatNotificationMessage(message, details);
    
    // Find user by phone
    const user = await findUserByPhone(phone);
    const normalizedPhone = normalizePhone(phone);
    
    // Determine notification type from details
    const notificationType = details.type || 'custom';
    
    // Get studentId from details if provided, otherwise use found user's ID
    const studentId = details.studentId || null;
    
    // Step 1: Save notification to database FIRST with 'pending' status
    // This also handles deduplication - returns existing notification if duplicate
    const savedNotification = await saveNotificationToDatabase({
      studentId: studentId || (user ? user._id : null),
      teacherId: details.teacherId || null,
      parentPhone: (user ? user.parentPhone : null) || normalizedPhone,
      title,
      body,
      type: notificationType,
      data: details,
      status: 'pending'
    });
    
    // Get the notification ID to include in FCM data payload
    const notificationId = savedNotification ? savedNotification._id.toString() : '';
    
    // If this is a duplicate that was already sent successfully, skip re-sending
    if (savedNotification && savedNotification._isDuplicate && savedNotification.status === 'sent') {
      console.log('Duplicate notification already sent, skipping FCM. ID:', notificationId);
      return { success: true, message: 'Notification already sent', notificationId, duplicate: true };
    }
    
    // Build FCM data payload with notificationId so the mobile app can read it
    const fcmData = {
      type: 'general',
      timestamp: new Date().toISOString(),
      notificationId,
      ...details
    };
    
    if (!user || !user.fcmToken) {
      // If user not found or no FCM token, try sending to parent
      const result = await sendNotificationToParent(
        normalizedPhone,
        title,
        body,
        fcmData
      );
      
      // Update notification status based on result
      if (savedNotification && !savedNotification._isDuplicate) {
        savedNotification.status = result.sent > 0 ? 'sent' : 'failed';
        await savedNotification.save();
      }
      
      if (result.sent > 0) {
        return { success: true, data: result, message: `Sent to ${result.sent} device(s)`, notificationId };
      }
      
      return { 
        success: false, 
        message: 'No user found with FCM token for this phone number',
        notificationId
      };
    }
    
    // Step 2: Send notification to the user with notificationId in data payload
    const result = await sendNotification(
      user.fcmToken,
      title,
      body,
      fcmData
    );
    
    // Step 3: Update notification status based on FCM result
    if (savedNotification && !savedNotification._isDuplicate) {
      savedNotification.status = result.success ? 'sent' : 'failed';
      await savedNotification.save();
    }
    
    if (result.success) {
      return { success: true, data: result, notificationId };
    } else {
      return { success: false, message: result.message || 'Failed to send notification', notificationId };
    }
  } catch (error) {
    console.error('Error sending notification:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to send notification',
      error: error
    };
  }
}

/**
 * Send student registration notification with detailed information
 * @param {string} phone - Student or parent phone number
 * @param {string} studentCode - Student code
 * @param {object} studentInfo - Student information object
 * @returns {Promise<{success: boolean, message?: string, data?: any}>}
 */
async function sendStudentRegistrationNotification(phone, studentCode, studentInfo = {}) {
  const message = `Welcome to Mayada Academy! Your account has been created successfully.`;
  
  const details = {
    type: 'registration',
    studentCode: studentCode,
    studentName: studentInfo.studentName || studentInfo.Username,
    grade: studentInfo.Grade,
    gradeLevel: studentInfo.GradeLevel,
    gradeType: studentInfo.gradeType,
    attendingType: studentInfo.attendingType,
    centerName: studentInfo.centerName,
    groupTime: studentInfo.groupTime,
    schoolName: studentInfo.schoolName,
    balance: studentInfo.balance,
    bookTaken: studentInfo.bookTaken ? 'Yes' : 'No',
  };
  
  return await sendNotificationMessage(phone, message, details);
}

/**
 * Send attendance notification to parent (legacy - keeps backward compatibility)
 * @param {string} phone - Parent phone number
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data (studentName, type, etc.)
 * @returns {Promise<{success: boolean, message?: string, data?: any}>}
 */
async function sendAttendanceNotification(phone, title, body, data = {}) {
  const message = `${title}: ${body}`;
  
  return await sendNotificationMessage(phone, message, {
    type: data.type || 'attendance',
    ...data
  });
}

/**
 * Send localized attendance notification based on user's language preference
 * @param {string} phone - Parent phone number
 * @param {string} attendanceType - Type: 'present', 'late', 'absent'
 * @param {object} data - Data for notification template
 * @returns {Promise<{success: boolean, message?: string, data?: any}>}
 */
async function sendLocalizedAttendanceNotification(phone, attendanceType, data = {}) {
  try {
    // Get user's language preference
    const language = await getUserLanguage(phone);
    
    // Build notification using translations
    const notification = buildAttendanceNotification(attendanceType, data, language);
    
    const message = `${notification.title}: ${notification.body}`;
    
    return await sendNotificationMessage(phone, message, {
      type: data.type || `attendance_${attendanceType}`,
      language,
      ...data
    });
  } catch (error) {
    console.error('Error sending localized attendance notification:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Send localized homework notification based on user's language preference
 * @param {string} phone - Parent phone number
 * @param {object} data - Data for notification template { studentName, hwStatus, solvText }
 * @returns {Promise<{success: boolean, message?: string, data?: any}>}
 */
async function sendLocalizedHomeworkNotification(phone, data = {}) {
  try {
    const language = await getUserLanguage(phone);
    const notification = buildHomeworkNotification(data, language);
    
    const message = `${notification.title}: ${notification.body}`;
    
    return await sendNotificationMessage(phone, message, {
      type: 'homework',
      language,
      ...data
    });
  } catch (error) {
    console.error('Error sending localized homework notification:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Send localized quiz result notification based on user's language preference
 * @param {string} phone - Parent phone number
 * @param {object} data - Data for notification template { studentName, quizName, grade, maxGrade }
 * @returns {Promise<{success: boolean, message?: string, data?: any}>}
 */
async function sendLocalizedQuizNotification(phone, data = {}) {
  try {
    const language = await getUserLanguage(phone);
    const notification = buildQuizNotification(data, language);
    
    const message = `${notification.title}: ${notification.body}`;
    
    return await sendNotificationMessage(phone, message, {
      type: 'custom',
      language,
      ...data
    });
  } catch (error) {
    console.error('Error sending localized quiz notification:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Send notification to multiple users by phone numbers
 * @param {string[]} phones - Array of phone numbers
 * @param {string} message - Message text
 * @param {object} details - Additional details
 * @returns {Promise<{success: boolean, sent: number, failed: number, results: array}>}
 */
async function sendNotificationBatchByPhones(phones, message, details = {}) {
  try {
    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      return { success: false, message: 'Phone numbers array is required', sent: 0, failed: 0 };
    }
    
    if (!message) {
      return { success: false, message: 'Message is required', sent: 0, failed: 0 };
    }
    
    // Format the notification message
    const { title, body } = formatNotificationMessage(message, details);
    
    // Find all users with FCM tokens
    const normalizedPhones = phones.map(p => normalizePhone(p));
    const users = await User.find({
      $or: [
        { phone: { $in: normalizedPhones } },
        { parentPhone: { $in: normalizedPhones } }
      ],
      fcmToken: { $ne: null }
    });
    
    if (users.length === 0) {
      return { success: true, message: 'No users with FCM tokens found', sent: 0, failed: 0 };
    }
    
    // Collect FCM tokens
    const fcmTokens = users.map(u => u.fcmToken).filter(token => token);
    
    if (fcmTokens.length === 0) {
      return { success: true, message: 'No valid FCM tokens found', sent: 0, failed: 0 };
    }
    
    // Send batch notification
    const result = await sendNotificationBatch(
      fcmTokens,
      title,
      body,
      {
        type: 'batch',
        timestamp: new Date().toISOString(),
        ...details
      }
    );
    
    return {
      success: true,
      sent: result.sent,
      failed: result.failed,
      total: fcmTokens.length
    };
  } catch (error) {
    console.error('Error sending batch notifications:', error);
    return { 
      success: false, 
      message: error.message || 'Failed to send batch notifications',
      sent: 0,
      failed: 0
    };
  }
}

module.exports = {
  sendNotificationMessage,
  sendStudentRegistrationNotification,
  sendAttendanceNotification,
  sendLocalizedAttendanceNotification,
  sendLocalizedHomeworkNotification,
  sendLocalizedQuizNotification,
  sendNotificationBatchByPhones,
  formatNotificationMessage,
  findUserByPhone,
  getUserLanguage,
  saveNotificationToDatabase,
  getHomeworkStatusLine,
  getHomeworkStatusLabel,
};

