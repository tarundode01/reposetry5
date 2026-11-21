const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ticketNumber: {
    type: String,
    unique: true
  },
  subject: {
    type: String,
    required: [true, 'Please provide subject'],
    trim: true
  },
  category: {
    type: String,
    enum: ['Billing', 'Technical', 'Product Inquiry', 'Feedback', 'Other'],
    default: 'General'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open'
  },
  description: {
    type: String,
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  messages: [
    {
      sender: {
        type: String,
        enum: ['customer', 'support', 'system'],
        required: true
      },
      senderName: String,
      message: {
        type: String,
        required: true
      },
      seen: {
        type: Boolean,
        default: false
      },
      seenAt: {
        type: Date,
        default: null
      },
      seenBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }
  ]
}, { timestamps: true });

// Auto-generate ticket number before saving
ticketSchema.pre('save', function (next) {
  if (!this.ticketNumber) {
    this.ticketNumber = `TCK-${Math.floor(100000 + Math.random() * 900000)}`;
  }
  next();
});

module.exports = mongoose.model('Ticket', ticketSchema);

