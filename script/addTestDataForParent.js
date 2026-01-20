/**
 * Script to add comprehensive test data for all students related to a parent phone number
 * 
 * Usage:
 *   node script/addTestDataForParent.js <parent_phone_number>
 * 
 * Examples:
 *   node script/addTestDataForParent.js 01003202768
 *   node script/addTestDataForParent.js 201003202768
 * 
 * This script:
 * 1. DELETES all existing attendance data for the parent's students
 * 2. Creates comprehensive NEW test data including:
 *    - Attendance records for the last 30 days (Present, Absent, Late, Present From Other Group)
 *    - Homework status (Attend With Homework / Attend Without Homework)
 *    - Updates student AttendanceHistory with realistic data including homework status
 *    - Creates finalized attendance records for older dates
 *    - Sets realistic balance and amountRemaining values
 *    - Updates absences count based on attendance status
 *    - Handles group creation if student's group doesn't exist
 * 
 * Features:
 * - Automatically finds all students linked to the parent phone number
 * - Removes ALL existing attendance records and history before creating new data
 * - Creates realistic attendance patterns (50% present, 20% absent, 15% late, 15% other group)
 * - Adds homework status: 70% with homework, 30% without homework (for present students)
 * - Skips weekends for more realistic data
 * - Creates finalized attendance records for historical data
 * - Includes homework status in attendance history and notifications
 * - Provides detailed progress and summary reports
 * 
 * WARNING: This script DELETES all existing attendance data for the students!
 *          Use only for testing purposes.
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Group = require('../models/Group');
const Attendance = require('../models/Attendance');
require('dotenv').config();

// Configuration
const dbURI = process.env.MONGODB_URI || 'mongodb+srv://deif:1qaz2wsx@3devway.aa4i6ga.mongodb.net/mayada?retryWrites=true&w=majority&appName=Cluster0';
const TARGET_PARENT_PHONE = process.argv[2] || '01003202768';

// Helper function to normalize phone number
function normalizePhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

// Helper function to get date string in YYYY-MM-DD format
function getDateString(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
  }).format(date);
}

// Helper function to get random status
function getRandomStatus() {
  const statuses = ['Present', 'Absent', 'Late', 'Present From Other Group'];
  return statuses[Math.floor(Math.random() * statuses.length)];
}

// Create attendance record for a student with homework status
async function createAttendanceRecord(student, group, date, status, homeworkStatus = null) {
  try {
    // Find or create attendance record for this date and group
    let attendance = await Attendance.findOne({
      date: date,
      groupId: group._id,
    });

    if (!attendance) {
      attendance = new Attendance({
        date: date,
        groupId: group._id,
        studentsPresent: [],
        studentsAbsent: [],
        studentsLate: [],
        studentsExcused: [],
        isFinalized: false,
      });
    }

    // Remove student from all arrays first
    attendance.studentsPresent = attendance.studentsPresent.filter(
      (id) => !id.equals(student._id)
    );
    attendance.studentsAbsent = attendance.studentsAbsent.filter(
      (id) => !id.equals(student._id)
    );
    attendance.studentsLate = attendance.studentsLate.filter(
      (id) => !id.equals(student._id)
    );
    attendance.studentsExcused = attendance.studentsExcused.filter(
      (id) => !id.equals(student._id)
    );

    // Add student to appropriate array based on status
    switch (status) {
      case 'Present':
        if (!attendance.studentsPresent.includes(student._id)) {
          attendance.studentsPresent.push(student._id);
        }
        break;
      case 'Absent':
        if (!attendance.studentsAbsent.includes(student._id)) {
          attendance.studentsAbsent.push(student._id);
        }
        break;
      case 'Late':
        if (!attendance.studentsLate.includes(student._id)) {
          attendance.studentsLate.push(student._id);
        }
        break;
      case 'Present From Other Group':
        if (!attendance.studentsExcused.includes(student._id)) {
          attendance.studentsExcused.push(student._id);
        }
        break;
    }

    await attendance.save();
    return attendance;
  } catch (error) {
    console.error(`Error creating attendance record for ${student.Username}:`, error.message);
    return null;
  }
}

// Update student's AttendanceHistory with homework status
async function updateStudentAttendanceHistory(student, attendance, date, status, homeworkStatus = null) {
  try {
    // Check if history entry already exists for this date
    const existingIndex = student.AttendanceHistory.findIndex(
      (record) => record.date === date
    );

    const historyEntry = {
      attendance: attendance._id,
      date: date,
      atTime: new Date().toLocaleTimeString('en-US', { hour12: false }),
      status: status,
      amountPaid: student.balance || 0,
      amountRemaining: student.amountRemaining || 0,
    };

    // Add homework status if provided (only for Present, Late, or Present From Other Group)
    if (homeworkStatus !== null && (status === 'Present' || status === 'Late' || status === 'Present From Other Group')) {
      historyEntry.homeworkStatus = homeworkStatus; // 'With Homework' or 'Without Homework'
      historyEntry.attendWithHW = homeworkStatus === 'With Homework';
      historyEntry.attendWithoutHW = homeworkStatus === 'Without Homework';
    }

    if (existingIndex >= 0) {
      // Update existing entry
      student.AttendanceHistory[existingIndex] = historyEntry;
    } else {
      // Add new entry
      student.AttendanceHistory.push(historyEntry);
    }

    // Update absences count based on status
    if (status === 'Absent') {
      student.absences = (student.absences || 0) + 1;
    } else if (status === 'Present' || status === 'Late' || status === 'Present From Other Group') {
      // Reduce absences if present (but don't go below 0)
      if (student.absences > 0) {
        student.absences = Math.max(0, student.absences - 1);
      }
    }

    // Mark AttendanceHistory as modified
    student.markModified('AttendanceHistory');
    
    // Save with validation disabled to avoid required field errors
    await student.save({ validateBeforeSave: false });
    
    return true;
  } catch (error) {
    console.error(`Error updating attendance history for ${student.Username}:`, error.message);
    return false;
  }
}

// Delete all existing attendance data for a student
async function deleteExistingAttendanceData(student) {
  try {
    console.log(`  🗑️  Deleting existing attendance data for ${student.Username}...`);
    
    // Find all groups the student belongs to
    const groups = await Group.find({ students: student._id });
    let deletedAttendanceCount = 0;
    let deletedHistoryCount = 0;

    // Delete attendance records for all groups
    for (const group of groups) {
      const attendances = await Attendance.find({ groupId: group._id });
      
      for (const attendance of attendances) {
        // Remove student from all arrays
        let modified = false;
        
        if (attendance.studentsPresent.some(id => id.equals(student._id))) {
          attendance.studentsPresent = attendance.studentsPresent.filter(
            id => !id.equals(student._id)
          );
          modified = true;
        }
        
        if (attendance.studentsAbsent.some(id => id.equals(student._id))) {
          attendance.studentsAbsent = attendance.studentsAbsent.filter(
            id => !id.equals(student._id)
          );
          modified = true;
        }
        
        if (attendance.studentsLate.some(id => id.equals(student._id))) {
          attendance.studentsLate = attendance.studentsLate.filter(
            id => !id.equals(student._id)
          );
          modified = true;
        }
        
        if (attendance.studentsExcused.some(id => id.equals(student._id))) {
          attendance.studentsExcused = attendance.studentsExcused.filter(
            id => !id.equals(student._id)
          );
          modified = true;
        }
        
        if (modified) {
          await attendance.save();
          deletedAttendanceCount++;
        }
      }
    }

    // Clear student's attendance history
    if (student.AttendanceHistory && student.AttendanceHistory.length > 0) {
      deletedHistoryCount = student.AttendanceHistory.length;
      student.AttendanceHistory = [];
      student.markModified('AttendanceHistory');
      await student.save({ validateBeforeSave: false });
    }

    // Reset absences
    student.absences = 0;
    await student.save({ validateBeforeSave: false });

    console.log(`  ✅ Deleted ${deletedAttendanceCount} attendance records and ${deletedHistoryCount} history entries`);
    return { attendanceRecords: deletedAttendanceCount, historyEntries: deletedHistoryCount };
  } catch (error) {
    console.error(`  ⚠️  Error deleting attendance data: ${error.message}`);
    return { attendanceRecords: 0, historyEntries: 0 };
  }
}

// Create test data for a single student
async function createTestDataForStudent(student) {
  console.log(`\n--- Creating test data for ${student.Username} (Code: ${student.Code}) ---`);

  try {
    // Find the student's group
    const group = await Group.findOne({
      CenterName: student.centerName,
      Grade: student.Grade,
      gradeType: student.gradeType,
      GroupTime: student.groupTime,
      students: student._id,
    });

    if (!group) {
      console.log(`⚠️  Warning: No group found for ${student.Username}. Creating group...`);
      
      // Try to find or create group
      let newGroup = await Group.findOne({
        CenterName: student.centerName,
        Grade: student.Grade,
        gradeType: student.gradeType,
        GroupTime: student.groupTime,
      });

      if (!newGroup) {
        newGroup = new Group({
          CenterName: student.centerName,
          Grade: student.Grade,
          gradeType: student.gradeType,
          GroupTime: student.groupTime,
          students: [student._id],
        });
        await newGroup.save();
        console.log(`✅ Created new group for ${student.Username}`);
      } else {
        if (!newGroup.students.includes(student._id)) {
          newGroup.students.push(student._id);
          await newGroup.save();
        }
        console.log(`✅ Added student to existing group`);
      }
      
      // Use the group we found/created
      const updatedGroup = await Group.findOne({
        CenterName: student.centerName,
        Grade: student.Grade,
        gradeType: student.gradeType,
        GroupTime: student.groupTime,
      });
      
      if (!updatedGroup) {
        console.error(`❌ Failed to create/find group for ${student.Username}`);
        return { success: false, error: 'Group not found' };
      }
      
      return await createTestDataForStudentWithGroup(student, updatedGroup);
    }

    return await createTestDataForStudentWithGroup(student, group);
  } catch (error) {
    console.error(`Error creating test data for ${student.Username}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Create test data for student with group
async function createTestDataForStudentWithGroup(student, group) {
  const results = {
    attendanceRecords: 0,
    historyEntries: 0,
    finalizedRecords: 0,
    homeworkWithCount: 0,
    homeworkWithoutCount: 0,
    errors: [],
  };

  try {
    // Create attendance records for the last 30 days with various statuses
    const statuses = ['Present', 'Absent', 'Late', 'Present From Other Group'];
    const statusWeights = [0.5, 0.2, 0.15, 0.15]; // 50% present, 20% absent, 15% late, 15% other group

    console.log(`  📅 Creating attendance records for the last 30 days with homework status...`);

    for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
      const date = getDateString(daysAgo);
      
      // Skip weekends (Saturday = 6, Sunday = 0)
      const dateObj = new Date(date);
      const dayOfWeek = dateObj.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        continue; // Skip weekends
      }

      // Select status based on weights
      const random = Math.random();
      let cumulative = 0;
      let selectedStatus = 'Present';
      
      for (let i = 0; i < statuses.length; i++) {
        cumulative += statusWeights[i];
        if (random <= cumulative) {
          selectedStatus = statuses[i];
          break;
        }
      }

      // Determine homework status (only for Present, Late, or Present From Other Group)
      let homeworkStatus = null;
      if (selectedStatus === 'Present' || selectedStatus === 'Late' || selectedStatus === 'Present From Other Group') {
        // 70% with homework, 30% without homework
        homeworkStatus = Math.random() < 0.7 ? 'With Homework' : 'Without Homework';
        if (homeworkStatus === 'With Homework') {
          results.homeworkWithCount++;
        } else {
          results.homeworkWithoutCount++;
        }
      }

      // Create attendance record
      const attendance = await createAttendanceRecord(student, group, date, selectedStatus, homeworkStatus);
      
      if (attendance) {
        results.attendanceRecords++;
        
        // Update student's attendance history with homework status
        const historyUpdated = await updateStudentAttendanceHistory(
          student,
          attendance,
          date,
          selectedStatus,
          homeworkStatus
        );
        
        if (historyUpdated) {
          results.historyEntries++;
        }
        
        // Log with homework status
        if (daysAgo % 5 === 0) {
          const hwInfo = homeworkStatus ? ` (${homeworkStatus})` : '';
          console.log(`  ✅ ${date}: ${selectedStatus}${hwInfo}`);
        }
      } else {
        results.errors.push(`Failed to create attendance for ${date}`);
      }
    }

    // Create some finalized attendance records (older dates, weekly)
    console.log(`  📋 Creating finalized attendance records (older dates)...`);
    for (let daysAgo = 30; daysAgo < 60; daysAgo += 7) {
      const date = getDateString(daysAgo);
      const status = getRandomStatus();
      
      // Add homework status for present students
      let homeworkStatus = null;
      if (status === 'Present' || status === 'Late' || status === 'Present From Other Group') {
        homeworkStatus = Math.random() < 0.7 ? 'With Homework' : 'Without Homework';
        if (homeworkStatus === 'With Homework') {
          results.homeworkWithCount++;
        } else {
          results.homeworkWithoutCount++;
        }
      }
      
      let attendance = await Attendance.findOne({
        date: date,
        groupId: group._id,
      });

      if (!attendance) {
        attendance = await createAttendanceRecord(student, group, date, status, homeworkStatus);
        if (attendance) {
          results.attendanceRecords++;
        }
      }

      if (attendance && !attendance.isFinalized) {
        attendance.isFinalized = true;
        await attendance.save();
        results.finalizedRecords++;
        
        // Update history for finalized records too with homework status
        await updateStudentAttendanceHistory(student, attendance, date, status, homeworkStatus);
        
        const hwInfo = homeworkStatus ? ` (${homeworkStatus})` : '';
        console.log(`  ✅ Finalized attendance for ${date}: ${status}${hwInfo}`);
      }
    }

    // Ensure student has realistic balance and amountRemaining if not set
    if (!student.balance || student.balance === 0) {
      student.balance = Math.floor(Math.random() * 500) + 100; // Random between 100-600
      console.log(`  💰 Set balance to ${student.balance}`);
    }
    
    if (student.amountRemaining === undefined || student.amountRemaining === null) {
      student.amountRemaining = Math.floor(student.balance * (Math.random() * 0.5 + 0.3)); // 30-80% of balance
      console.log(`  💵 Set amount remaining to ${student.amountRemaining}`);
    }

    // Save student with updated balance
    try {
      await student.save({ validateBeforeSave: false });
    } catch (saveError) {
      console.warn(`  ⚠️  Warning: Could not save student balance update: ${saveError.message}`);
    }

    console.log(`\n✅ Completed for ${student.Username}:`);
    console.log(`   - Attendance records created: ${results.attendanceRecords}`);
    console.log(`   - History entries updated: ${results.historyEntries}`);
    console.log(`   - Finalized records: ${results.finalizedRecords}`);
    console.log(`   - With Homework: ${results.homeworkWithCount}`);
    console.log(`   - Without Homework: ${results.homeworkWithoutCount}`);
    console.log(`   - Current absences: ${student.absences || 0}`);
    console.log(`   - Balance: ${student.balance || 0} EGP`);
    console.log(`   - Amount remaining: ${student.amountRemaining || 0} EGP`);
    
    if (results.errors.length > 0) {
      console.log(`   - Errors: ${results.errors.length}`);
      results.errors.slice(0, 3).forEach(err => {
        console.log(`     • ${err}`);
      });
      if (results.errors.length > 3) {
        console.log(`     ... and ${results.errors.length - 3} more errors`);
      }
    }

    return { success: true, ...results };
  } catch (error) {
    console.error(`Error in createTestDataForStudentWithGroup:`, error.message);
    return { success: false, error: error.message, ...results };
  }
}

// Main function
async function run() {
  try {
    console.log(`\n🔗 Connecting to MongoDB...`);
    await mongoose.connect(dbURI);
    console.log('✅ Connected to MongoDB.');

    const normalizedPhone = normalizePhone(TARGET_PARENT_PHONE);
    console.log(`\n🔍 Searching for students with parent phone: ${TARGET_PARENT_PHONE} (normalized: ${normalizedPhone})...`);

    // Find all students where parentPhone matches
    const students = await User.find({
      $or: [
        { parentPhone: normalizedPhone },
        { parentPhone: { $regex: new RegExp(normalizedPhone.slice(-9) + '$') } },
        // Also try with different formats
        { parentPhone: normalizedPhone.replace(/^20/, '0') },
        { parentPhone: normalizedPhone.replace(/^0/, '20') },
      ],
      isTeacher: { $ne: true }, // Exclude teachers
    });

    if (students.length === 0) {
      console.error(`\n❌ Error: No students found with parent phone number ${TARGET_PARENT_PHONE}`);
      console.log('\n💡 Tip: Try different phone number formats:');
      console.log('   - With country code: 201003202768');
      console.log('   - Without country code: 01003202768');
      console.log('   - Last 9 digits: 01003202768');
      process.exit(1);
    }

    console.log(`\n✅ Found ${students.length} student(s) associated with parent phone ${TARGET_PARENT_PHONE}:`);
    students.forEach((student, index) => {
      console.log(`   ${index + 1}. ${student.Username} (Code: ${student.Code}, Phone: ${student.phone})`);
    });

    console.log(`\n⚠️  WARNING: This will DELETE all existing attendance data for these students!`);
    console.log(`📊 Starting to delete existing data and create new test data...\n`);
    console.log('='.repeat(60));

    // First, delete all existing attendance data
    let totalDeletedRecords = 0;
    let totalDeletedHistory = 0;
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      console.log(`\n[${i + 1}/${students.length}] Deleting existing data for: ${student.Username}`);
      const deleteResult = await deleteExistingAttendanceData(student);
      totalDeletedRecords += deleteResult.attendanceRecords;
      totalDeletedHistory += deleteResult.historyEntries;
    }

    console.log(`\n✅ Deletion complete:`);
    console.log(`   - Deleted ${totalDeletedRecords} attendance records`);
    console.log(`   - Deleted ${totalDeletedHistory} history entries`);
    console.log(`\n📝 Now creating new test data...\n`);
    console.log('='.repeat(60));

    const allResults = [];
    let totalAttendanceRecords = 0;
    let totalHistoryEntries = 0;
    let totalHomeworkWith = 0;
    let totalHomeworkWithout = 0;
    let successCount = 0;
    let errorCount = 0;

    // Process each student
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      console.log(`\n[${i + 1}/${students.length}] Processing: ${student.Username}`);
      
      const result = await createTestDataForStudent(student);
      allResults.push({
        student: student.Username,
        code: student.Code,
        ...result,
      });

      if (result.success) {
        successCount++;
        totalAttendanceRecords += result.attendanceRecords || 0;
        totalHistoryEntries += result.historyEntries || 0;
        totalHomeworkWith += result.homeworkWithCount || 0;
        totalHomeworkWithout += result.homeworkWithoutCount || 0;
      } else {
        errorCount++;
      }

      // Small delay between students
      if (i < students.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n📈 FINAL SUMMARY');
    console.log('='.repeat(60));
    console.log(`\n👥 Students:`);
    console.log(`   Total found: ${students.length}`);
    console.log(`   ✅ Successfully processed: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    
    console.log(`\n📊 Test Data Created:`);
    console.log(`   📝 Attendance records: ${totalAttendanceRecords}`);
    console.log(`   📚 History entries: ${totalHistoryEntries}`);
    console.log(`   ✅ With Homework: ${totalHomeworkWith}`);
    console.log(`   ❌ Without Homework: ${totalHomeworkWithout}`);
    
    // Calculate average per student
    if (successCount > 0) {
      console.log(`\n📈 Averages per student:`);
      console.log(`   Attendance records: ${Math.round(totalAttendanceRecords / successCount)}`);
      console.log(`   History entries: ${Math.round(totalHistoryEntries / successCount)}`);
    }
    
    // Show breakdown by student
    console.log(`\n📋 Detailed Results:`);
    allResults.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${index + 1}. ${status} ${result.student} (Code: ${result.code})`);
      if (result.success) {
        console.log(`      - Records: ${result.attendanceRecords || 0}, History: ${result.historyEntries || 0}`);
      } else {
        console.log(`      - Error: ${result.error || 'Unknown error'}`);
      }
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✨ Test data creation completed!');
    console.log('💡 You can now test:');
    console.log('   - Attendance features (Present, Absent, Late, Other Group)');
    console.log('   - Homework status (With Homework / Without Homework)');
    console.log('   - Attendance reports and Excel exports');
    console.log('   - Notifications with homework status');
    console.log('\n' + '='.repeat(60));

    // Wait a bit before closing
    setTimeout(() => {
      mongoose.connection.close();
      console.log('\n✅ Database connection closed.');
      process.exit(0);
    }, 2000);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
run();
