const mongoose = require('mongoose');

const FieldVisitSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customerName: { type: String, required: true },
  purpose: { type: String, required: true },
  visitDate: { type: Date, required: true },
  visitTime: { type: String, default: '12:00 PM' },
  location: { type: String, required: true },
  status: { type: String, enum: ['Scheduled', 'In Progress', 'Completed', 'Cancelled'], default: 'Scheduled' },
  notes: { type: String, default: '' },
  feedback: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('FieldVisit', FieldVisitSchema);

