const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  checkIn: { type: Date },
  checkOut: { type: Date },
  workingHours: { type: String, default: '0h 0m' },
  status: { type: String, enum: ['Present', 'Absent', 'Half Day', 'On Leave', 'Late'], default: 'Present' },
  location: { type: String, default: 'Office / Field' },
  workSummary: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Attendance', AttendanceSchema);
