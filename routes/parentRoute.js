const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const parentController = require('../controllers/parentController');

const jwtSecret = process.env.JWTSECRET;

/**
 * JWT Authentication Middleware for Parent API
 * Verifies the token and extracts parent data
 */
const parentAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token required',
      });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, jwtSecret);
      
      // Attach parent data to request
      req.parentData = {
        parentPhone: decoded.parentPhone,
        studentIds: decoded.studentIds || [],
      };
      
      next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during authentication',
    });
  }
};

// ======================= Public Routes =======================

/**
 * @route   POST /api/parent/login
 * @desc    Parent login with phone + student code
 * @access  Public
 */
router.post('/login', parentController.parentLogin);

// ======================= Protected Routes =======================

/**
 * @route   GET /api/parent/students
 * @desc    Get all students for authenticated parent
 * @access  Private
 */
router.get('/students', parentAuthMiddleware, parentController.getStudents);

/**
 * @route   GET /api/parent/dashboard/:studentId
 * @desc    Get dashboard data for a specific student
 * @access  Private
 */
router.get('/dashboard/:studentId', parentAuthMiddleware, parentController.getDashboard);

/**
 * @route   GET /api/parent/attendance/:studentId
 * @desc    Get full attendance history for a student
 * @access  Private
 * @query   start - Start date (YYYY-MM-DD)
 * @query   end - End date (YYYY-MM-DD)
 */
router.get('/attendance/:studentId', parentAuthMiddleware, parentController.getFullAttendance);

/**
 * @route   GET /api/parent/notifications
 * @desc    Get all notifications for the parent
 * @access  Private
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20)
 */
router.get('/notifications', parentAuthMiddleware, parentController.getNotifications);

/**
 * @route   PATCH /api/parent/notifications/:id/read
 * @desc    Mark a notification as read
 * @access  Private
 */
router.patch('/notifications/:id/read', parentAuthMiddleware, parentController.markNotificationRead);

/**
 * @route   PATCH /api/parent/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.patch('/notifications/read-all', parentAuthMiddleware, parentController.markAllNotificationsRead);

module.exports = router;
