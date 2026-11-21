const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function syncPendingApprovals() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = require('../models/User');
  const ApprovalRequest = require('../models/ApprovalRequest');

  // Find all pending sales users
  const pendingSales = await User.find({ role: 'sales', status: 'pending_approval' });
  console.log('Pending Sales count:', pendingSales.length);

  for (const s of pendingSales) {
    const existing = await ApprovalRequest.findOne({
      $or: [{ employee: s._id }, { requestedBy: s._id }]
    });
    if (!existing) {
      console.log('Creating missing ApprovalRequest for:', s.name, s.email);
      await ApprovalRequest.create({
        employee: s._id,
        requestType: 'New Employee Registration',
        subject: `New Sales Staff Approval: ${s.name} (${s.designation || 'Sales Executive'})`,
        description: `Staff member ${s.name} (${s.email}, ${s.phone || 'N/A'}) registered for ${s.designation || 'Sales Executive'}. Awaiting managerial activation.`,
        requestedBy: s._id,
        requestedByName: `${s.name} (${s.designation || 'Sales Executive'})`,
        targetRole: 'sales',
        status: 'Pending'
      });
    } else {
      console.log('Already has approval request:', s.email, existing.status);
    }
  }

  const allApprovals = await ApprovalRequest.find({}).select('requestType subject status requestedByName');
  console.log('--- Current Approvals in DB ---');
  console.log(allApprovals);

  process.exit(0);
}

syncPendingApprovals().catch(err => {
  console.error(err);
  process.exit(1);
});
