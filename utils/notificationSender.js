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
    
    if (!user || !user.fcmToken) {
      // If user not found or no FCM token, try sending to parent
      const normalizedPhone = normalizePhone(phone);
      const result = await sendNotificationToParent(
        normalizedPhone,
        title,
        body,
        {
          type: 'general',
          timestamp: new Date().toISOString(),
          ...details
        }
      );
      
      if (result.sent > 0) {
        return { success: true, data: result, message: `Sent to ${result.sent} device(s)` };
      }
      
      return { 
        success: false, 
        message: 'No user found with FCM token for this phone number' 
      };
    }
    
    // Send notification to the user
    const result = await sendNotification(
      user.fcmToken,
      title,
      body,
      {
        type: 'general',
        timestamp: new Date().toISOString(),
        ...details
      }
    );
    
    if (result.success) {
      return { success: true, data: result };
    } else {
      return { success: false, message: result.message || 'Failed to send notification' };
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
 * Send verification code notification
 * @param {string} phone - Phone number
 * @param {string} code - Verification code
 * @param {string} countryCode - Country code (optional)
 * @returns {Promise<{success: boolean, message?: string, data?: any}>}
 */
async function sendVerificationCodeNotification(phone, code, countryCode = '20') {
  const message = `Verification Code: ${code}\n\nPlease use this code to verify your account. This code will expire in 15 minutes.`;
  
  return await sendNotificationMessage(phone, message, {
    type: 'verification',
    code: code
  }, countryCode);
}

/**
 * Send password reset notification
 * @param {string} phone - Phone number
 * @param {string} resetLink - Password reset link
 * @param {string} countryCode - Country code (optional)
 * @returns {Promise<{success: boolean, message?: string, data?: any}>}
 */
async function sendPasswordResetNotification(phone, resetLink, countryCode = '20') {
  const message = `Password Reset Request\n\nClick the link below to reset your password:\n${resetLink}\n\nThis link will expire in 15 minutes.`;
  
  return await sendNotificationMessage(phone, message, {
    type: 'password_reset',
    link: resetLink
  }, countryCode);
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
  sendVerificationCodeNotification,
  sendPasswordResetNotification,
  sendNotificationBatchByPhones,
  formatNotificationMessage,
  findUserByPhone,
};

