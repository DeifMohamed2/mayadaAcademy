const User = require('../models/User');
const Notification = require('../models/Notification');
const Attendance = require('../models/Attendance');
const Group = require('../models/Group');
const jwt = require('jsonwebtoken');
const { sendNotification } = require('../utils/fcm');

const jwtSecret = process.env.JWTSECRET;

/**
 * Parent Login API
 * Authenticates parent using phone number and any of their student's codes
 * Returns JWT token and list of all students associated with this parent
 */
const parentLogin = async (req, res) => {
  try {
    const { parentPhone, studentCode, fcmToken } = req.body;

    // Validate required fields
    if (!parentPhone || !studentCode) {
      return res.status(400).json({
        success: false,
        message: 'Parent phone and student code are required',
      });
    }

    // Clean the phone number (remove spaces, dashes, etc.)
    const cleanPhone = parentPhone.replace(/\D/g, '');

    // Find the student by code first
    const studentByCode = await User.findOne({ Code: studentCode.trim() });

    if (!studentByCode) {
      return res.status(401).json({
        success: false,
        message: 'Invalid student code',
      });
    }

    // Verify this student belongs to the parent phone
    const studentParentPhone = studentByCode.parentPhone.replace(/\D/g, '');
    if (!studentParentPhone.includes(cleanPhone) && !cleanPhone.includes(studentParentPhone)) {
      return res.status(401).json({
        success: false,
        message: 'This student is not associated with this phone number',
      });
    }

    // Find all students associated with this parent phone
    const students = await User.find(
      { parentPhone: studentByCode.parentPhone },
      {
        _id: 1,
        Username: 1,
        Code: 1,
        Grade: 1,
        gradeType: 1,
        centerName: 1,
        groupTime: 1,
        balance: 1,
        amountRemaining: 1,
        absences: 1,
      }
    );

    // Update FCM token for all students of this parent if provided
    if (fcmToken) {
      await User.updateMany(
        { parentPhone: studentByCode.parentPhone },
        { $set: { fcmToken: fcmToken } }
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        parentPhone: studentByCode.parentPhone,
        studentIds: students.map((s) => s._id),
      },
      jwtSecret,
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      students,
    });
  } catch (error) {
    console.error('Parent login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
};

/**
 * Dashboard API
 * Returns last session status, payment info, attendance totals, and recent notifications
 */
const getDashboard = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { parentPhone } = req.parentData;

    // Find the student
    const student = await User.findById(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Verify this student belongs to the authenticated parent
    if (student.parentPhone !== parentPhone) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this student',
      });
    }

    // Get last session status from AttendanceHistory
    const attendanceHistory = student.AttendanceHistory || [];
    const sortedHistory = attendanceHistory.sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
    const lastSession = sortedHistory[0] || null;

    // Calculate attendance totals
    const totals = {
      present: 0,
      late: 0,
      absent: 0,
    };

    attendanceHistory.forEach((record) => {
      const status = (record.status || '').toLowerCase();
      if (status.includes('present')) {
        totals.present++;
      } else if (status.includes('late')) {
        totals.late++;
      } else if (status.includes('absent')) {
        totals.absent++;
      }
    });

    // Get last 6 notifications for this parent
    const recentNotifications = await Notification.find({
      $or: [{ studentId: studentId }, { parentPhone: parentPhone }],
    })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    // Prepare response
    const response = {
      success: true,
      student: {
        _id: student._id,
        Username: student.Username,
        Code: student.Code,
        Grade: student.Grade,
        gradeType: student.gradeType,
        centerName: student.centerName,
        groupTime: student.groupTime,
      },
      lastSession: lastSession
        ? {
            date: lastSession.date,
            status: lastSession.status,
            time: lastSession.atTime,
            homeworkStatus: lastSession.homeworkStatus || 'N/A',
          }
        : null,
      payment: {
        balance: student.balance || 0,
        amountRemaining: student.amountRemaining || 0,
      },
      totals,
      recentNotifications,
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error('Dashboard error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
};

/**
 * Full Attendance API
 * Returns complete attendance history with optional date range filtering
 */
const getFullAttendance = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { start, end } = req.query;
    const { parentPhone } = req.parentData;

    // Find the student
    const student = await User.findById(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Verify this student belongs to the authenticated parent
    if (student.parentPhone !== parentPhone) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view this student',
      });
    }

    let attendanceHistory = student.AttendanceHistory || [];

    // Filter by date range if provided
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);

      attendanceHistory = attendanceHistory.filter((record) => {
        const recordDate = new Date(record.date);
        return recordDate >= startDate && recordDate <= endDate;
      });
    }

    // Sort by date descending (most recent first)
    attendanceHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Format the attendance records with full details
    const formattedAttendance = attendanceHistory.map((record) => ({
      date: record.date,
      status: record.status,
      time: record.atTime,
      homeworkStatus: record.homeworkStatus || 'N/A',
      amountPaid: record.amountPaid || 0,
      amountRemaining: record.amountRemaining || 0,
    }));

    return res.status(200).json({
      success: true,
      student: {
        _id: student._id,
        Username: student.Username,
        Code: student.Code,
        Grade: student.Grade,
        centerName: student.centerName,
        groupTime: student.groupTime,
      },
      totalRecords: formattedAttendance.length,
      attendance: formattedAttendance,
    });
  } catch (error) {
    console.error('Full attendance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
};

/**
 * Get Notifications API
 * Returns all notifications for the authenticated parent
 */
const getNotifications = async (req, res) => {
  try {
    const { parentPhone, studentIds } = req.parentData;
    const { page = 1, limit = 20 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find({
      $or: [{ parentPhone: parentPhone }, { studentId: { $in: studentIds } }],
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('studentId', 'Username Code')
      .lean();

    const total = await Notification.countDocuments({
      $or: [{ parentPhone: parentPhone }, { studentId: { $in: studentIds } }],
    });

    return res.status(200).json({
      success: true,
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
};

/**
 * Mark Notification as Read
 */
const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const { parentPhone, studentIds } = req.parentData;

    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        $or: [{ parentPhone: parentPhone }, { studentId: { $in: studentIds } }],
      },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or not authorized',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      notification,
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
};

/**
 * Mark All Notifications as Read
 */
const markAllNotificationsRead = async (req, res) => {
  try {
    const { parentPhone, studentIds } = req.parentData;

    const result = await Notification.updateMany(
      {
        $or: [{ parentPhone: parentPhone }, { studentId: { $in: studentIds } }],
        isRead: false,
      },
      { $set: { isRead: true } }
    );

    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`,
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
};

/**
 * Get All Students for Parent
 * Returns all students associated with the authenticated parent
 */
const getStudents = async (req, res) => {
  try {
    const { parentPhone } = req.parentData;

    const students = await User.find(
      { parentPhone: parentPhone },
      {
        _id: 1,
        Username: 1,
        Code: 1,
        Grade: 1,
        gradeType: 1,
        centerName: 1,
        groupTime: 1,
        balance: 1,
        amountRemaining: 1,
        absences: 1,
        blocked: 1,
      }
    );

    return res.status(200).json({
      success: true,
      students,
    });
  } catch (error) {
    console.error('Get students error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
};

module.exports = {
  parentLogin,
  getDashboard,
  getFullAttendance,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getStudents,
};
