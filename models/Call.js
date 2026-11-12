const mongoose = require('mongoose');

const CallSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Enquiry' },
  customerName: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  callType: { type: String, enum: ['Incoming', 'Outgoing'], default: 'Outgoing' },
  duration: { type: String, default: '00:00' },
  outcome: { 
    type: String, 
    enum: ['Connected', 'Not Answered', 'Busy', 'Switched Off', 'Interested', 'Not Interested', 'Call Back Later', 'Wrong Number'],
    default: 'Connected'
  },
  notes: { type: String, default: '' },
  callbackDate: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Call', CallSchema);

