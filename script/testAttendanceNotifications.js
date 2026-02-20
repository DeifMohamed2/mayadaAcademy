/**
 * Test Script for All Attendance Notification Types
 * Usage: node script/testAttendanceNotifications.js <phone_number>
 * 
 * This script tests all attendance notification types:
 * - Present (حضور)
 * - Late (تأخير)
 * - Absent (غياب)
 */

const mongoose = require('mongoose');
const { sendAttendanceNotification } = require('../utils/notificationSender');
const User = require('../models/User');
require('dotenv').config();

// Configuration
const dbURI = 'mongodb+srv://deif:1qaz2wsx@3devway.aa4i6ga.mongodb.net/mayada?retryWrites=true&w=majority&appName=Cluster0';
const TARGET_PHONE = process.argv[2] || '01156012078';

// Get today's date formatted
const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Cairo',
}).format(new Date());

async function run() {
  try {
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(dbURI);
    console.log('Connected to MongoDB.\n');

    console.log(`Searching for user with phone: ${TARGET_PHONE}...`);
    // Find user by parent phone
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
    console.log(`Center: ${user.centerName}`);
    console.log(`Grade: ${user.Grade}`);
    console.log(`Group Time: ${user.groupTime}`);
    
    if (!user.fcmToken) {
      console.warn(`\nWarning: User does not have an FCM token.`);
    } else {
      console.log(`FCM Token: ${user.fcmToken.substring(0, 20)}...`);
    }

    const groupInfo = `${user.centerName} - ${user.Grade} - ${user.groupTime}`;

    console.log('\n========================================');
    console.log('   Testing All Attendance Notifications');
    console.log('========================================\n');

    // 1. Present Attendance (without homework)
    console.log('1️⃣  Testing: PRESENT Attendance (No Homework)');
    console.log('   Title: ✅ تأكيد الحضور');
    const presentResult = await sendAttendanceNotification(
      TARGET_PHONE,
      '✅ تأكيد الحضور',
      `تم تسجيل حضور ${user.Username} بنجاح.\n\n📍 المجموعة: ${groupInfo}\n📊 عدد مرات الغياب: ${user.absences || 0}\n📅 التاريخ: ${today}`,
      {
        type: 'attendance_present',
        studentName: user.Username,
        studentCode: user.Code,
        group: groupInfo,
        absences: user.absences || 0,
        homework: 'لم يحدد',
        date: today,
      }
    );
    console.log('   Result:', presentResult.success ? '✅ Success' : '❌ Failed');
    if (!presentResult.success) console.log('   Error:', presentResult.message);

    // Wait 1 second between notifications
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 2. Present Attendance (with homework done)
    console.log('\n2️⃣  Testing: PRESENT Attendance (Homework Done)');
    console.log('   Title: ✅ تأكيد الحضور');
    const presentHWResult = await sendAttendanceNotification(
      TARGET_PHONE,
      '✅ تأكيد الحضور',
      `تم تسجيل حضور ${user.Username} بنجاح.\n✅ الواجب: تم حل الواجب\n\n📍 المجموعة: ${groupInfo}\n📊 عدد مرات الغياب: ${user.absences || 0}\n📅 التاريخ: ${today}`,
      {
        type: 'attendance_present',
        studentName: user.Username,
        studentCode: user.Code,
        group: groupInfo,
        absences: user.absences || 0,
        homework: 'تم الحل',
        date: today,
      }
    );
    console.log('   Result:', presentHWResult.success ? '✅ Success' : '❌ Failed');
    if (!presentHWResult.success) console.log('   Error:', presentHWResult.message);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. Present Attendance (homework not done)
    console.log('\n3️⃣  Testing: PRESENT Attendance (Homework NOT Done)');
    console.log('   Title: ✅ تأكيد الحضور');
    const presentNoHWResult = await sendAttendanceNotification(
      TARGET_PHONE,
      '✅ تأكيد الحضور',
      `تم تسجيل حضور ${user.Username} بنجاح.\n❌ الواجب: لم يحل الواجب\n\n📍 المجموعة: ${groupInfo}\n📊 عدد مرات الغياب: ${user.absences || 0}\n📅 التاريخ: ${today}`,
      {
        type: 'attendance_present',
        studentName: user.Username,
        studentCode: user.Code,
        group: groupInfo,
        absences: user.absences || 0,
        homework: 'لم يحل',
        date: today,
      }
    );
    console.log('   Result:', presentNoHWResult.success ? '✅ Success' : '❌ Failed');
    if (!presentNoHWResult.success) console.log('   Error:', presentNoHWResult.message);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. Late Attendance
    console.log('\n4️⃣  Testing: LATE Attendance');
    console.log('   Title: ⚠️ تأخر في الحضور');
    const lateResult = await sendAttendanceNotification(
      TARGET_PHONE,
      '⚠️ تأخر في الحضور',
      `تم تسجيل حضور ${user.Username} متأخرًا اليوم.\n\n📍 المجموعة: ${groupInfo}\n📊 عدد مرات الغياب: ${user.absences || 0}\n📅 التاريخ: ${today}\n\nيرجى الانتباه لمواعيد الحضور.`,
      {
        type: 'attendance_late',
        studentName: user.Username,
        studentCode: user.Code,
        group: groupInfo,
        absences: user.absences || 0,
        date: today,
      }
    );
    console.log('   Result:', lateResult.success ? '✅ Success' : '❌ Failed');
    if (!lateResult.success) console.log('   Error:', lateResult.message);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 5. Absent (normal)
    console.log('\n5️⃣  Testing: ABSENT (Normal - Less than 3 absences)');
    console.log('   Title: ❌ تسجيل غياب');
    const absentResult = await sendAttendanceNotification(
      TARGET_PHONE,
      '❌ تسجيل غياب',
      `تم تسجيل غياب ${user.Username} اليوم.\n\n📊 عدد مرات الغياب: 2`,
      {
        type: 'attendance_absent',
        studentName: user.Username,
        studentCode: user.Code,
        absences: 2,
        blocked: false,
      }
    );
    console.log('   Result:', absentResult.success ? '✅ Success' : '❌ Failed');
    if (!absentResult.success) console.log('   Error:', absentResult.message);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 6. Absent (blocked - 3+ absences)
    console.log('\n6️⃣  Testing: ABSENT (Blocked - 3+ absences)');
    console.log('   Title: ❌ تسجيل غياب');
    const absentBlockedResult = await sendAttendanceNotification(
      TARGET_PHONE,
      '❌ تسجيل غياب',
      `تم تسجيل غياب ${user.Username} اليوم.\n\n📊 عدد مرات الغياب: 3\n\n⛔ تنبيه: لن يتمكن الطالب من دخول الحصة القادمة بسبب تجاوز عدد مرات الغياب المسموح بها.`,
      {
        type: 'attendance_absent',
        studentName: user.Username,
        studentCode: user.Code,
        absences: 3,
        blocked: true,
      }
    );
    console.log('   Result:', absentBlockedResult.success ? '✅ Success' : '❌ Failed');
    if (!absentBlockedResult.success) console.log('   Error:', absentBlockedResult.message);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 7. Present with payment info (finalize)
    console.log('\n7️⃣  Testing: PRESENT with Payment Info');
    console.log('   Title: ✅ تأكيد الحضور');
    const presentPaymentResult = await sendAttendanceNotification(
      TARGET_PHONE,
      '✅ تأكيد الحضور',
      `تم تسجيل حضور ${user.Username} بنجاح.\n\n💰 المبلغ المتبقي: ${user.amountRemaining || 0} جنيه\n📊 عدد مرات الغياب: ${user.absences || 0}`,
      {
        type: 'attendance_present',
        studentName: user.Username,
        studentCode: user.Code,
        absences: user.absences || 0,
        amountRemaining: user.amountRemaining || 0,
      }
    );
    console.log('   Result:', presentPaymentResult.success ? '✅ Success' : '❌ Failed');
    if (!presentPaymentResult.success) console.log('   Error:', presentPaymentResult.message);

    console.log('\n========================================');
    console.log('   All Tests Completed!');
    console.log('========================================');
    console.log('\nSummary:');
    console.log('  - Present (no HW):', presentResult.success ? '✅' : '❌');
    console.log('  - Present (HW done):', presentHWResult.success ? '✅' : '❌');
    console.log('  - Present (no HW done):', presentNoHWResult.success ? '✅' : '❌');
    console.log('  - Late:', lateResult.success ? '✅' : '❌');
    console.log('  - Absent (normal):', absentResult.success ? '✅' : '❌');
    console.log('  - Absent (blocked):', absentBlockedResult.success ? '✅' : '❌');
    console.log('  - Present (payment):', presentPaymentResult.success ? '✅' : '❌');
    
    // Wait for async operations to complete
    setTimeout(() => {
      mongoose.connection.close();
      process.exit(0);
    }, 2000);

  } catch (error) {
    console.error('Fatal error:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

run();
