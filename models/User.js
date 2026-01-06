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
    AttendanceHistory: {
      type: Array,
      required: false,
      default: [],
    },

    subscribe: {
      type: Boolean,
      required: false,
    },

    isTeacher: {
      type: Boolean,
      required: false,
    },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

module.exports = User;
