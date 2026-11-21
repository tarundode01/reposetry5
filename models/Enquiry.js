const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  enquiryId: {
    type: String,
    unique: true
  },
  productService: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  budget: {
    type: String,
    default: 'Flexible'
  },
  preferredContactTime: {
    type: String,
    default: 'Anytime'
  },
  priority: {
    type: String,
    default: 'Medium'
  },
  source: {
    type: String,
    default: 'Website'
  },
  platformLeadId: {
    type: String,
    default: null
  },
  campaign: {
    type: String,
    default: null
  },
  isDuplicateFlagged: {
    type: Boolean,
    default: false
  },
  duplicateDismissed: {
    type: Boolean,
    default: false
  },
  duplicateMatchReason: {
    type: String,
    default: null
  },
  duplicateLinkedCustomerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: [
      'Submitted',
      'Received',
      'Under Review',
      'Assigned',
      'Contacted',
      'In Discussion',
      'Proposal Sent',
      'Negotiation',
      'Converted',
      'Closed',
      'Cancelled',
      'New',
      'Qualified',
      'Lost'
    ],
    default: 'Submitted'
  },
  // Employee ObjectId assignment for SaaS multi-tenant isolation
  assignedSalesId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Embedded details of assigned employee for fast customer view display
  assignedSales: {
    name: { type: String, default: null },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    designation: { type: String, default: null },
    assignedAt: { type: Date, default: null }
  },
  assignedAt: {
    type: Date,
    default: null
  },
  // ⏰ Scheduled Reminder & Callback Tracking
  reminderDate: {
    type: Date,
    default: null
  },
  reminderTime: {
    type: String,
    default: '11:00 AM'
  },
  reminderNote: {
    type: String,
    default: null
  },
  // 📞 Latest Discussion / Communication Summary
  lastCommunication: {
    channel: { type: String, default: null }, // 'Call', 'WhatsApp', 'Email', 'Meeting'
    note: { type: String, default: null },
    communicatedAt: { type: Date, default: null },
    communicatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    communicatedByName: { type: String, default: null }
  },
  timeline: [
    {
      status: String,
      title: String,
      step: String,
      date: String,
      note: String,
      timestamp: { type: Date, default: Date.now }
    }
  ],
  attachments: [String]
}, { timestamps: true });

enquirySchema.index({ customerId: 1, createdAt: -1 });
enquirySchema.index({ assignedSalesId: 1, status: 1 });

enquirySchema.pre('save', function (next) {
  if (!this.enquiryId) {
    this.enquiryId = `ENQ-${Math.floor(100000 + Math.random() * 900000)}`;
  }
  if (!this.timeline || this.timeline.length === 0) {
    this.timeline = [{
      status: 'Submitted',
      title: 'Enquiry Submitted',
      step: 'Enquiry Submitted',
      note: 'Your enquiry has been received and queued for review.',
      timestamp: new Date()
    }];
  }
  next();
});

module.exports = mongoose.model('Enquiry', enquirySchema);

