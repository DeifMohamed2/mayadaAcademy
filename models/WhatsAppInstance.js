const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const whatsAppInstanceSchema = new Schema({
  instanceId: {
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
    enum: ['connected', 'disconnected', 'connecting' , 'qr'],
    default: 'disconnected'
  },
  qrCode: {
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

module.exports = mongoose.model('WhatsAppInstance', whatsAppInstanceSchema); 