/**
 * Script to send test notifications to a specific number
 * Usage: node script/sendNotificationToNumber.js <phone_number>
 */

const mongoose = require('mongoose');
const { 
  sendNotificationMessage, 
  sendStudentRegistrationNotification,
} = require('../utils/notificationSender');
const User = require('../models/User');
require('dotenv').config();

// Configuration
const dbURI = 'mongodb+srv://deif:1qaz2wsx@3devway.aa4i6ga.mongodb.net/mayada?retryWrites=true&w=majority&appName=Cluster0';
const TARGET_PHONE = process.argv[2] || '01156012078';

async function run() {
  try {
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(dbURI);
    console.log('Connected to MongoDB.');

    console.log(`Searching for user with phone: ${TARGET_PHONE}...`);
    // Find user by student phone or parent phone
    const user = await User.findOne({
      $or: [
        { parentPhone: TARGET_PHONE },
        { parentPhone: { $regex: new RegExp(TARGET_PHONE.slice(-9)) } }
      ]
    });

    if (!user) {
      console.error(`Error: No user found with phone number ${TARGET_PHONE}`);
      process.exit(1);
    }

    console.log(`User found: ${user.Username} (${user.Code})`);
    if (!user.fcmToken) {
      console.warn(`Warning: User does not have an FCM token. Notifications may fail unless they are associated with a parent who has one.`);
    } else {
      console.log(`FCM Token found: ${user.fcmToken.substring(0, 20)}...`);
    }

    console.log('\n--- Sending Test Notifications ---');

    // 1. General Notification
    console.log('1. Sending General Notification...');
    const generalResult = await sendNotificationMessage(
      TARGET_PHONE, 
      "General: هذا إشعار تجريبي من نظام Mayada Academy.",
      { type: 'general' }
    );
    console.log('Result:', generalResult);

    // 2. Registration Notification
    console.log('\n2. Sending Registration Notification...');
    const regResult = await sendStudentRegistrationNotification(
      TARGET_PHONE,
      user.Code,
      {
        studentName: user.Username,
        Grade: user.Grade,
        centerName: user.centerName,
        balance: user.balance
      }
    );
    console.log('Result:', regResult);

    console.log('\n--- All notification attempts completed ---');
    console.log('\nFor attendance notifications, use: node script/testAttendanceNotifications.js');
    
    // Wait a bit for async operations to finish logging if any
    setTimeout(() => {
      mongoose.connection.close();
      process.exit(0);
    }, 2000);

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

run();
