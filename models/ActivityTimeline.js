const mongoose = require('mongoose');

const ActivityTimelineSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actionType: { type: String, required: true }, // Lead Created, Call Made, Deal Updated, etc.
  title: { type: String, required: true },
  details: { type: String, default: '' },
  relatedEntity: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ActivityTimeline', ActivityTimelineSchema);

