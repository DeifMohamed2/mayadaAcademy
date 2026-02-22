const mongoose = require('mongoose');
const { required } = require('nodemon/lib/config');
const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    Username: {
      type: String,
      required: true,
    },

    Password: {
      type: String,
      default: '3131',
      required: false,
    },

    Code: {
      type: Number,
      required: true,
      unique: true,
    },

    phone: {
      type: String,
      required: true,
    },

    parentPhone: {
      type: String,
      required: true,
      unique: false,
    },

    centerName: {
      type: String,
      required: true,
    },

    Grade: {
      type: String,
      required: true,
    },
    gradeType: {
      type: String,
      required: true,
    },
    groupTime: {
      type: String,
      required: true,
    },

    GradeLevel: {
      type: String,
      required: true,
    },

    attendingType: {
      type: String,
      required: true,
    },

    bookTaken: {
      type: Boolean,
      required: true,
    },

    schoolName: {
      type: String,
      required: true,
    },

    balance: {
      type: Number,
      required: true,
      default: 0,
    },

    amountRemaining: {
      type: Number,
      required: true,
      default: 0,
    },

    absences: {
      type: Number,
      required: true,
      default: 0,
    },

    cardId: {
      type: String,
      required: false,
      default: null,
    },

    fcmToken: {
      type: String,
      default: null,
    },

    parentSessionId: {
      type: String,
      default: null,
    },

    notificationLanguage: {
      type: String,
      enum: ['EN', 'AR'],
      default: 'EN',
    },

    // Attendance History with proper structure
    AttendanceHistory: [
      {
        attendance: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Attendance',
        },
        date: {
          type: String, // 'YYYY-MM-DD'
          required: true,
        },
        atTime: {
          type: String, // Time of attendance
        },
        status: {
          type: String,
          enum: ['Present', 'Late', 'Absent', 'Present From Other Group'],
          default: 'Present',
        },
        // Homework status
        homeworkStatus: {
          type: String,
          enum: ['done', 'not_done', 'not_specified'],
          default: 'not_specified',
        },
        // Attendance options
        ignoredAbsencePolicy: {
          type: Boolean,
          default: false,
        },
        fromOtherGroup: {
          type: Boolean,
          default: false,
        },
        // Group info at time of attendance
        groupInfo: {
          centerName: String,
          grade: String,
          gradeType: String,
          groupTime: String,
        },
        // Payment info
        amountPaid: {
          type: Number,
          default: 0,
        },
        amountRemaining: {
          type: Number,
          default: 0,
        },
      },
    ],

    subscribe: {
      type: Boolean,
      required: false,
    },

    isTeacher: {
      type: Boolean,
      required: false,
    },
  },
  { timestamps: true },
);

const User = mongoose.model('User', userSchema);

module.exports = User;
