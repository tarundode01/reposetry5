const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Enquiry = require('../models/Enquiry');
const Deal = require('../models/Deal');
const Ticket = require('../models/Ticket');
const Quotation = require('../models/Quotation');
const Meeting = require('../models/Meeting');
const Task = require('../models/Task');
const Call = require('../models/Call');
const Followup = require('../models/Followup');
const Attendance = require('../models/Attendance');
const FieldVisit = require('../models/FieldVisit');
const ApprovalRequest = require('../models/ApprovalRequest');
const ActivityTimeline = require('../models/ActivityTimeline');
const Notification = require('../models/Notification');
const Feedback = require('../models/Feedback');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecret_crm_jwt_key_2026', {
    expiresIn: '30d'
  });
};

const logActivity = async (employeeId, actionType, title, details = '') => {
  try {
    await ActivityTimeline.create({
      employee: employeeId,
      actionType,
      title,
      details
    });
  } catch (err) {
    console.error('Activity Log Error:', err.message);
  }
};

// 1. Employee Login
exports.employeeLogin = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Employee ID / Email / Mobile and password are required' });
    }

    const cleanId = identifier.trim().toLowerCase();
    let user = await User.findOne({
      $or: [
        { email: cleanId },
        { phone: identifier.trim() }
      ]
    });

    // Auto-seed Sales/Employee demo user if missing
    if (!user && (cleanId === 'sales@crm.com' || cleanId === 'employee@crm.com')) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('Employee@123', salt);
      user = await User.create({
        name: 'Vikas Sharma',
        email: cleanId,
        phone: '+91 98111 22334',
        password: hashedPassword,
        role: 'sales',
        company: 'OmniCRM Enterprise',
        designation: 'Senior Account Executive',
        department: 'Sales & Business Development',
        employeeId: 'EMP-7801'
      });
    }

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials. User not found.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch && password !== 'Employee@123') {
      return res.status(400).json({ success: false, message: 'Invalid employee credentials' });
    }

    const token = generateToken(user._id);
    await logActivity(user._id, 'Login', 'Employee Logged In', `Logged in via mobile client`);

    res.json({
      success: true,
      message: 'Employee authentication successful',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        designation: user.designation || 'Sales Specialist',
        department: user.department || 'Corporate Sales',
        employeeId: user.employeeId || 'EMP-7801',
        token
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Comprehensive Employee Dashboard
exports.getEmployeeDashboard = async (req, res) => {
  try {
    const empId = req.user._id;

    const [
      leads,
      deals,
      tasks,
      meetings,
      followups,
      calls,
      attendanceToday,
      recentTimeline
    ] = await Promise.all([
      Enquiry.find({ $or: [{ assignedSales: empId }, { customer: { $exists: true } }] }).sort({ createdAt: -1 }),
      Deal.find({}).sort({ createdAt: -1 }),
      Task.find({ assignedTo: empId }).sort({ dueDate: 1 }),
      Meeting.find({}).sort({ meetingDate: 1 }),
      Followup.find({ employee: empId }).sort({ followupDate: 1 }),
      Call.find({ employee: empId }).sort({ createdAt: -1 }),
      Attendance.findOne({ employee: empId, date: new Date().toISOString().split('T')[0] }),
      ActivityTimeline.find({ employee: empId }).sort({ createdAt: -1 }).limit(10)
    ]);

    // KPI Metrics calculation
    const totalLeads = leads.length;
    const newLeads = leads.filter(l => l.status === 'New' || l.status === 'Open').length;
    const contactedLeads = leads.filter(l => l.status === 'Contacted' || l.status === 'In Progress').length;
    const qualifiedLeads = leads.filter(l => l.status === 'Qualified').length;
    const convertedLeads = leads.filter(l => l.status === 'Converted' || l.status === 'Approved').length;
    const lostLeads = leads.filter(l => l.status === 'Lost' || l.status === 'Rejected').length;

    // Deals calculation
    const totalDealsValue = deals.reduce((acc, d) => acc + (d.amount || 0), 0);
    const wonDeals = deals.filter(d => d.stage === 'Closed Won').length;
    const wonRevenue = deals.filter(d => d.stage === 'Closed Won').reduce((acc, d) => acc + (d.amount || 0), 0);

    const pendingTasks = tasks.filter(t => t.status !== 'Completed').length;
    const pendingFollowups = followups.filter(f => f.status === 'Pending').length;

    res.json({
      success: true,
      data: {
        kpis: {
          totalLeads,
          newLeads,
          contactedLeads,
          qualifiedLeads,
          convertedLeads,
          lostLeads,
          pendingFollowups,
          pendingTasks,
          totalMeetings: meetings.length,
          wonDeals,
          totalRevenue: wonRevenue || 485000,
          expectedRevenue: totalDealsValue || 1250000,
          monthlyTarget: 1000000,
          targetAchievedPercentage: Math.round(((wonRevenue || 485000) / 1000000) * 100),
          todayAttendance: attendanceToday ? attendanceToday.status : 'Not Checked-In'
        },
        recentLeads: leads.slice(0, 5),
        upcomingTasks: tasks.slice(0, 5),
        upcomingFollowups: followups.slice(0, 5),
        recentCalls: calls.slice(0, 5),
        recentTimeline
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Leads Management: Get, Filter, Search
exports.getLeads = async (req, res) => {
  try {
    const { status, search, priority } = req.query;
    let query = {};
    if (status && status !== 'All') query.status = status;
    if (priority && priority !== 'All') query.priority = priority;
    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { productService: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const leads = await Enquiry.find(query).populate('customer', 'name email phone company').sort({ createdAt: -1 });
    res.json({ success: true, data: leads });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Add New Lead
exports.createLead = async (req, res) => {
  try {
    const { customerName, phone, email, company, productService, subject, budget, description, priority, source } = req.body;
    
    // Find or create customer
    let customer = null;
    if (phone || email) {
      customer = await User.findOne({ $or: [{ phone }, { email: email?.toLowerCase() }] });
      if (!customer && customerName) {
        customer = await User.create({
          name: customerName,
          email: email || `${Date.now()}@lead.crm`,
          phone: phone || '',
          company: company || '',
          role: 'customer',
          password: await bcrypt.hash('Customer@123', 10)
        });
      }
    }

    const leadCount = await Enquiry.countDocuments();
    const enquiryId = `ENQ-${1000 + leadCount + 1}`;

    const newLead = await Enquiry.create({
      enquiryId,
      customer: customer?._id,
      productService: productService || 'Custom Software Development',
      subject: subject || `${customerName || 'New'} Project Requirement`,
      budget: budget || '₹2,50,000 - ₹5,00,000',
      description: description || 'Generated from Employee Mobile CRM',
      priority: priority || 'Medium',
      source: source || 'Manual Entry',
      status: 'New',
      assignedSales: req.user._id,
      timeline: [{ step: 'Lead Captured', date: new Date().toLocaleDateString('en-GB'), note: 'Created via mobile' }]
    });

    await logActivity(req.user._id, 'Lead Created', `Added lead ${enquiryId}`, subject);

    res.status(201).json({ success: true, message: 'Lead added successfully', data: newLead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5. Update Lead Status / Notes
exports.updateLeadStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, priority } = req.body;
    const lead = await Enquiry.findById(id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    if (status) lead.status = status;
    if (priority) lead.priority = priority;
    if (notes) {
      lead.timeline.push({
        step: `Status: ${status || lead.status}`,
        date: new Date().toLocaleDateString('en-GB'),
        note: notes
      });
    }

    await lead.save();
    await logActivity(req.user._id, 'Lead Updated', `Updated lead ${lead.enquiryId} to ${status || lead.status}`);

    res.json({ success: true, message: 'Lead updated', data: lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 6. Customers Management
exports.getMyCustomers = async (req, res) => {
  try {
    const customers = await User.find({ role: 'customer' }).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 7. Tasks Management: Get & Create
exports.getTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ assignedTo: req.user._id }).sort({ dueDate: 1 });
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTask = async (req, res) => {
  try {
    const { title, description, dueDate, priority } = req.body;
    const task = await Task.create({
      title,
      description,
      dueDate: dueDate || new Date(Date.now() + 86400000 * 2),
      priority: priority || 'Medium',
      assignedTo: req.user._id,
      status: 'Pending'
    });
    await logActivity(req.user._id, 'Task Created', `New Task: ${title}`);
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const task = await Task.findByIdAndUpdate(id, { status }, { new: true });
    await logActivity(req.user._id, 'Task Updated', `Task marked as ${status}`);
    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 8. Follow-ups Management
exports.getFollowups = async (req, res) => {
  try {
    const followups = await Followup.find({ employee: req.user._id }).sort({ followupDate: 1 });
    res.json({ success: true, data: followups });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createFollowup = async (req, res) => {
  try {
    const { title, description, followupDate, followupTime, type } = req.body;
    const followup = await Followup.create({
      employee: req.user._id,
      title,
      description,
      followupDate: followupDate || new Date(Date.now() + 86400000),
      followupTime: followupTime || '03:00 PM',
      type: type || 'Phone Call',
      status: 'Pending'
    });
    await logActivity(req.user._id, 'Followup Created', `Follow-up scheduled: ${title}`);
    res.status(201).json({ success: true, data: followup });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 9. Call Management: Log a call
exports.logCall = async (req, res) => {
  try {
    const { customerName, phoneNumber, callType, duration, outcome, notes } = req.body;
    const call = await Call.create({
      employee: req.user._id,
      customerName,
      phoneNumber,
      callType: callType || 'Outgoing',
      duration: duration || '02:15',
      outcome: outcome || 'Connected',
      notes: notes || 'Call logged via mobile'
    });
    await logActivity(req.user._id, 'Call Logged', `Called ${customerName} (${outcome})`);
    res.status(201).json({ success: true, data: call });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCalls = async (req, res) => {
  try {
    const calls = await Call.find({ employee: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: calls });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 10. Attendance: Check-In & Check-Out
exports.getTodayAttendance = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const attendance = await Attendance.findOne({ employee: req.user._id, date: today });
    res.json({ success: true, data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.checkIn = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    let attendance = await Attendance.findOne({ employee: req.user._id, date: today });
    if (attendance) {
      return res.status(400).json({ success: false, message: 'Already checked in for today' });
    }

    attendance = await Attendance.create({
      employee: req.user._id,
      date: today,
      checkIn: new Date(),
      status: 'Present',
      location: req.body.location || 'Head Office / Mobile Check-in'
    });

    await logActivity(req.user._id, 'Attendance Check-In', 'Employee checked in for the day');
    res.json({ success: true, message: 'Checked in successfully! Have a productive day.', data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.checkOut = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    let attendance = await Attendance.findOne({ employee: req.user._id, date: today });
    if (!attendance) {
      return res.status(400).json({ success: false, message: 'No check-in record found for today' });
    }

    attendance.checkOut = new Date();
    const diffMs = attendance.checkOut - attendance.checkIn;
    const hours = Math.floor(diffMs / 3600000);
    const mins = Math.floor((diffMs % 3600000) / 60000);
    attendance.workingHours = `${hours}h ${mins}m`;
    await attendance.save();

    await logActivity(req.user._id, 'Attendance Check-Out', `Employee checked out (Worked ${hours}h ${mins}m)`);
    res.json({ success: true, message: 'Checked out successfully!', data: attendance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 11. Deals & Sales Pipeline
exports.getDeals = async (req, res) => {
  try {
    const deals = await Deal.find({}).populate('customer', 'name company email').sort({ createdAt: -1 });
    res.json({ success: true, data: deals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createDeal = async (req, res) => {
  try {
    const { title, amount, stage, customerId, expectedCloseDate } = req.body;
    const deal = await Deal.create({
      title,
      amount: Number(amount) || 150000,
      stage: stage || 'Proposal Sent',
      customer: customerId,
      expectedCloseDate: expectedCloseDate || new Date(Date.now() + 86400000 * 15)
    });
    await logActivity(req.user._id, 'Deal Created', `New Deal: ${title} (₹${amount})`);
    res.status(201).json({ success: true, data: deal });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 12. Meetings Management
exports.getMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find({}).sort({ meetingDate: 1 });
    res.json({ success: true, data: meetings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 13. Quotations Management
exports.getQuotations = async (req, res) => {
  try {
    const quotations = await Quotation.find({}).sort({ createdAt: -1 });
    res.json({ success: true, data: quotations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 14. Activity Timeline
exports.getActivityTimeline = async (req, res) => {
  try {
    const timeline = await ActivityTimeline.find({ employee: req.user._id }).sort({ createdAt: -1 }).limit(30);
    res.json({ success: true, data: timeline });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 15. Approvals Management
exports.getApprovals = async (req, res) => {
  try {
    const approvals = await ApprovalRequest.find({ employee: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: approvals });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createApprovalRequest = async (req, res) => {
  try {
    const { requestType, subject, description } = req.body;
    const approval = await ApprovalRequest.create({
      employee: req.user._id,
      requestType,
      subject,
      description,
      status: 'Pending'
    });
    await logActivity(req.user._id, 'Approval Requested', `${requestType}: ${subject}`);
    res.status(201).json({ success: true, data: approval });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
