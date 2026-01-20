require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendNotification } = require('../utils/fcm');

const TARGET_PHONE = '01003202768';
const DB_URI = 'mongodb+srv://deif:1qaz2wsx@3devway.aa4i6ga.mongodb.net/mayada?retryWrites=true&w=majority&appName=Cluster0';

async function sendAllNotifications(user, type) {
  const titles = {
    attendance: 'Attendance Update',
    homework: 'Homework Status',
    payment: 'Payment Received',
    custom: 'Special Message',
    block: 'Account Restricted',
    unblock: 'Account Restored',
  };

  const bodies = {
    attendance: `Student ${user.Username} was marked Present today.`,
    homework: `New homework has been assigned for ${user.Grade}.`,
    payment: `Payment of 100 EGP recorded for ${user.Username}.`,
    custom: `This is a test notification for all types from Elkably Team.`,
    block: `Your account for student ${user.Username} has been blocked. Reason: Administrative review.`,
    unblock: `Your account for student ${user.Username} has been unblocked. Welcome back!`,
  };

  console.log(`Sending ${type} notification to ${user.Username} (${user.phone})...`);

  if (!user.fcmToken) {
    console.warn(`No FCM token for user ${user.Username}. Skipping FCM.`);
  } else {
    try {
      const result = await sendNotification(user.fcmToken, titles[type], bodies[type], {
        type: type,
        studentId: user._id.toString(),
        studentName: user.Username,
      });
      console.log(`FCM result for ${type}:`, result.success ? 'Success' : `Failed (${result.message})`);
    } catch (err) {
      console.error(`Error sending FCM for ${type}:`, err.message);
    }
  }

  // Also create a database notification record
  try {
    const newNotif = new Notification({
      studentId: user._id,
      parentPhone: user.parentPhone || user.phone,
      type: type,
      title: titles[type],
      body: bodies[type],
      data: {
        studentName: user.Username,
        test: true,
      },
    });
    await newNotif.save();
    console.log(`Database notification record created for ${type}`);
  } catch (err) {
    console.error(`Error saving database notification for ${type}:`, err.message);
  }
}

async function run() {
  try {
    console.log(`Connecting to database...`);
    await mongoose.connect(DB_URI);
    console.log('Connected to MongoDB');

    const normalizedPhone = TARGET_PHONE.replace(/\D/g, '');
    
    // Search for users where this phone is either their phone or parentPhone
    const users = await User.find({
      $or: [
        { phone: normalizedPhone },
        { parentPhone: normalizedPhone },
        { phone: { $regex: new RegExp(normalizedPhone.slice(-9) + '$') } },
        { parentPhone: { $regex: new RegExp(normalizedPhone.slice(-9) + '$') } }
      ]
    });

    if (users.length === 0) {
      console.log(`No users found with phone ${TARGET_PHONE}`);
      return;
    }

    console.log(`Found ${users.length} user(s) associated with ${TARGET_PHONE}`);

    const types = ['attendance', 'homework', 'payment', 'custom', 'block', 'unblock'];

    for (const user of users) {
      console.log(`\n--- Processing Notifications for ${user.Username} (Code: ${user.Code}) ---`);
      for (const type of types) {
        await sendAllNotifications(user, type);
        // Small delay between notifications
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    console.log('\nAll notifications processed.');
  } catch (err) {
    console.error('Script error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

run();
