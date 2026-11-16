const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipientRole: {
    type: String,
    enum: ['admin', 'employee', 'customer', 'all'],
    default: 'admin'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Backward compatibility with legacy schema
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['enquiry', 'ticket', 'chat', 'meeting', 'quotation', 'invoice', 'approval', 'system'],
    default: 'system'
  },
  read: {
    type: Boolean,
    default: false
  },
  senderName: {
    type: String,
    default: null
  },
  senderRole: {
    type: String,
    default: null
  },
  linkId: String
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);

