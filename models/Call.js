const mongoose = require('mongoose');

const CallSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Enquiry' },
  customerName: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  company: { type: String, default: '' },
  callType: { type: String, enum: ['Incoming', 'Outgoing'], default: 'Outgoing' },
  duration: { type: String, default: '00:00' },
  callStartTime: { type: String, default: '' },
  callEndTime: { type: String, default: '' },
  outcome: { 
    type: String, 
    enum: ['Connected', 'Not Answered', 'Busy', 'Switched Off', 'Interested', 'Not Interested', 'Call Back Later', 'Wrong Number'],
    default: 'Connected'
  },
  notes: { type: String, default: '' },
  clientRequirement: { type: String, default: '' },
  recordingUrl: { type: String, default: '' },
  recordingFileName: { type: String, default: '' },
  sharedWithAdmin: { type: Boolean, default: false },
  sharedAt: { type: Date },
  callbackDate: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Call', CallSchema);

