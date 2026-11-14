const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide name'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please provide email'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Please provide password'],
    minlength: 6
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  company: {
    type: String,
    trim: true,
    default: ''
  },
  businessType: {
    type: String,
    default: 'Individual' // Individual, Startup, Corporate, Agency
  },
  designation: {
    type: String,
    default: ''
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: { type: String, default: 'India' },
    zipCode: String
  },
  gstNumber: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['admin', 'sales', 'customer'],
    default: 'customer'
  },
  avatar: {
    type: String,
    default: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
  },
  isEmailVerified: {
    type: Boolean,
    default: true
  },
  isPhoneVerified: {
    type: Boolean,
    default: true
  },
  otpCode: String,
  otpExpires: Date,
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending_approval'],
    default: 'active'
  },
  isApproved: {
    type: Boolean,
    default: true
  },
  activeSessions: [
    {
      deviceId: String,
      deviceName: String,
      lastLogin: { type: Date, default: Date.now },
      ipAddress: String
    }
  ],
  deletionRequested: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
