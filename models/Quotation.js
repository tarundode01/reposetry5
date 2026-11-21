const mongoose = require('mongoose');

const quotationSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdByName: {
    type: String,
    default: null
  },
  createdByRole: {
    type: String,
    default: 'sales'
  },
  quotationNumber: {
    type: String,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  subTotal: Number,
  taxGst: Number,
  totalAmount: Number,
  status: {
    type: String,
    enum: ['Received', 'Accepted', 'Rejected', 'Revision Requested'],
    default: 'Received'
  },
  validUntil: Date,
  items: [
    {
      name: String,
      qty: Number,
      rate: Number,
      amount: Number
    }
  ]
}, { timestamps: true });

quotationSchema.pre('save', function (next) {
  if (!this.quotationNumber) {
    this.quotationNumber = `QUOT-${Math.floor(10000 + Math.random() * 90000)}`;
  }
  next();
});

module.exports = mongoose.model('Quotation', quotationSchema);

