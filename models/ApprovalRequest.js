const mongoose = require('mongoose');

const ApprovalRequestSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  requestType: { 
    type: String, 
    enum: [
      'New Customer Registration',
      'New Employee Registration',
      'Discount Approval',
      'Special Pricing',
      'Quotation Approval',
      'Deal Approval',
      'Payment Exception',
      'Order Cancellation',
      'Lead Reassignment',
      'Task Extension'
    ],
    required: true 
  },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  requestedByName: { type: String, default: '' },
  targetRole: { type: String, default: 'customer' },
  relatedDeal: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal' },
  relatedQuotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  managerComment: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ApprovalRequest', ApprovalRequestSchema);

