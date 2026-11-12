const mongoose = require('mongoose');

const FollowupSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Enquiry' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  followupDate: { type: Date, required: true },
  followupTime: { type: String, default: '11:00 AM' },
  type: { type: String, enum: ['Phone Call', 'WhatsApp', 'Email', 'Meeting', 'Video Call', 'Other'], default: 'Phone Call' },
  status: { type: String, enum: ['Pending', 'Completed', 'Cancelled', 'Overdue'], default: 'Pending' },
  notes: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Followup', FollowupSchema);

