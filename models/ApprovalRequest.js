const mongoose = require('mongoose');

const ApprovalRequestSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requestType: { 
    type: String, 
    enum: ['Discount Approval', 'Special Pricing', 'Quotation Approval', 'Deal Approval', 'Payment Exception', 'Order Cancellation', 'Lead Reassignment', 'Task Extension'],
    required: true 
  },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  relatedDeal: { type: mongoose.Schema.Types.ObjectId, ref: 'Deal' },
  relatedQuotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  managerComment: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ApprovalRequest', ApprovalRequestSchema);
