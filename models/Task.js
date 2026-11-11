const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Enquiry' },
  startDate: { type: Date, default: Date.now },
  dueDate: { type: Date },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
  status: { type: String, enum: ['Pending', 'In Progress', 'On Hold', 'Completed', 'Overdue', 'Cancelled'], default: 'Pending' },
  comments: [{
    text: String,
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }],
  attachments: [String],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Task', TaskSchema);
