const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const groupSchema = new Schema(
  {
    CenterName: {
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
    GroupTime: {
      type: String,
      required: true,
    },
    displayText: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    related: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
);

groupSchema.index(
  { CenterName: 1, Grade: 1, gradeType: 1, GroupTime: 1 },
  { unique: true },
);

const Group = mongoose.model('Group', groupSchema);

module.exports = Group;
