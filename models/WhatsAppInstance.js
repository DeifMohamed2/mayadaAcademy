const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const whatsAppInstanceSchema = new Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['connected', 'disconnected', 'connecting', 'qr'],
    default: 'disconnected'
  },
  qrCode: {
    type: String,
    default: null
  },
  apiKey: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to update the updatedAt field
whatsAppInstanceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('WhatsAppInstance', whatsAppInstanceSchema); 