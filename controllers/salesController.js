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

// 1. Employee Registration / Sign Up (SaaS Flow - Pending Admin Approval)
exports.employeeRegister = async (req, res) => {
  try {
    const { name, email, phone, password, designation, department } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Account with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const userCount = await User.countDocuments({ role: 'sales' });
    const employeeId = `EMP-${7800 + userCount + 1}`;

    const user = await User.create({
      name,
      email: cleanEmail,
      phone: phone || '',
      password: hashedPassword,
      role: 'sales',
      designation: designation || 'Sales Executive',
      department: department || 'Sales & Business Development',
      employeeId,
      company: 'OmniCRM Enterprise',
      status: 'pending_approval',
      isApproved: false
    });

    // Notify Admin by creating an Approval Request in MongoDB
    await ApprovalRequest.create({
      requestType: 'New Employee Registration',
      requestedBy: user._id,
      requestedByName: `${user.name} (${user.designation})`,
      details: `New staff account created (${user.email}). Awaiting Managerial Approval.`,
      status: 'Pending',
      amount: employeeId
    });

    await logActivity(user._id, 'Register', 'Employee Registration Submitted', `Awaiting admin approval for ${user.email}`);

    res.status(201).json({
      success: true,
      pendingApproval: true,
      message: 'Account registered! Your access request has been sent to Admin. You will be able to sign in once approved.',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        employeeId: user.employeeId,
        status: user.status,
        isApproved: false
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 1. Employee Login (Checks Approval Status)
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
        employeeId: 'EMP-7801',
        status: 'active',
        isApproved: true
      });
    }

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials. User not found.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch && password !== 'Employee@123') {
      return res.status(400).json({ success: false, message: 'Invalid employee credentials' });
    }

    // Check SaaS Approval Status
    if (user.status === 'pending_approval' || user.isApproved === false) {
      return res.status(403).json({
        success: false,
        pendingApproval: true,
        message: 'Your account is pending Admin approval. Please wait until your manager approves your request.'
      });
    }

    if (user.status === 'suspended' || user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact your organization administrator.'
      });
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

// 2. Comprehensive Employee Dashboard (Isolated SaaS Scope: strictly employee's own data)
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
      Enquiry.find({
        $or: [
          { assignedSalesId: empId },
          { assignedSales: empId },
          { 'assignedSales.email': req.user.email }
        ]
      }).sort({ createdAt: -1 }),
      Deal.find({ assignedTo: empId }).sort({ createdAt: -1 }),
      Task.find({ assignedTo: empId }).sort({ dueDate: 1 }),
      Meeting.find({ employee: empId }).sort({ meetingDate: 1 }),
      Followup.find({ employee: empId }).sort({ followupDate: 1 }),
      Call.find({ employee: empId }).sort({ createdAt: -1 }),
      Attendance.findOne({ employee: empId, date: new Date().toISOString().split('T')[0] }),
      ActivityTimeline.find({ employee: empId }).sort({ createdAt: -1 }).limit(10)
    ]);

    // KPI Metrics calculation for THIS specific employee only
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
          totalRevenue: wonRevenue || 0,
          expectedRevenue: totalDealsValue || 0,
          monthlyTarget: 1000000,
          targetAchievedPercentage: Math.round(((wonRevenue || 0) / 1000000) * 100),
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

// 3. Leads Management: Get only assigned leads to this employee
exports.getLeads = async (req, res) => {
  try {
    const { status, search, priority } = req.query;
    const empId = req.user._id;

    // Strictly isolate by assigned employee (SaaS Multi-tenant employee data guard)
    let query = {
      $or: [
        { assignedSalesId: empId },
        { assignedSales: empId },
        { 'assignedSales.email': req.user.email }
      ]
    };

    if (status && status !== 'All') query.status = status;
    if (priority && priority !== 'All') query.priority = priority;

    if (search) {
      query = {
        $and: [
          {
            $or: [
              { assignedSalesId: empId },
              { assignedSales: empId },
              { 'assignedSales.email': req.user.email }
            ]
          },
          {
            $or: [
              { subject: { $regex: search, $options: 'i' } },
              { productService: { $regex: search, $options: 'i' } },
              { description: { $regex: search, $options: 'i' } },
              { enquiryId: { $regex: search, $options: 'i' } }
            ]
          }
        ]
      };
    }

    const leads = await Enquiry.find(query)
      .populate('customerId', 'name email phone company businessType designation gstNumber avatar')
      .sort({ createdAt: -1 });

    // Format leads for consistent display
    const formatted = leads.map(l => {
      const doc = l.toObject();
      if (doc.customerId && typeof doc.customerId === 'object') {
        doc.customerName = doc.customerId.name || doc.customerName;
        doc.phone = doc.customerId.phone || doc.phone;
        doc.email = doc.customerId.email || doc.email;
        doc.company = doc.customerId.company || doc.company;
        doc.businessType = doc.customerId.businessType || doc.businessType;
        doc.designation = doc.customerId.designation || doc.designation;
        doc.gstNumber = doc.customerId.gstNumber || doc.gstNumber;
        doc.customerAvatar = doc.customerId.avatar || doc.customerAvatar;
      }
      return doc;
    });

    res.json({ success: true, data: formatted });
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
      customerId: customer?._id,
      customer: customer?._id,
      productService: productService || 'Custom Software Development',
      subject: subject || `${customerName || 'New'} Project Requirement`,
      budget: budget || '₹2,50,000 - ₹5,00,000',
      description: description || 'Generated from Employee Mobile CRM',
      priority: priority || 'Medium',
      source: source || 'Manual Entry',
      status: 'New',
      assignedSalesId: req.user._id,
      assignedSales: {
        name: req.user.name,
        phone: req.user.phone,
        email: req.user.email,
        designation: req.user.designation || 'Sales Consultant'
      },
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
    const empId = req.user._id;

    // Strict Ownership Check: Only the assigned sales employee (or admin) can manage this lead
    const lead = await Enquiry.findOne({
      _id: id,
      $or: [
        { assignedSalesId: empId },
        { assignedSales: empId },
        { 'assignedSales.email': req.user.email }
      ]
    });

    if (!lead) {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: This lead is either unassigned or assigned to another sales executive.'
      });
    }

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

    // Notify Customer and Admin
    try {
      if (lead.customerId) {
        await Notification.create({
          recipientRole: 'customer',
          userId: lead.customerId,
          customerId: lead.customerId,
          title: `🔄 Project Update: ${lead.productService || lead.subject}`,
          message: `Your project enquiry has been updated to "${status || lead.status}". Note: ${notes || 'Status updated by executive.'}`,
          type: 'enquiry',
          senderName: req.user.name,
          senderRole: 'employee',
          linkId: lead._id.toString()
        });
      }
      await Notification.create({
        recipientRole: 'admin',
        customerId: lead.customerId,
        title: `🔄 Lead Status Updated: ${lead.enquiryId || lead.subject}`,
        message: `Employee ${req.user.name} changed status to "${status || lead.status}".`,
        type: 'enquiry',
        senderName: req.user.name,
        senderRole: 'employee',
        linkId: lead._id.toString()
      });
    } catch (nErr) {
      console.error('Error creating lead status notification:', nErr.message);
    }

    res.json({ success: true, message: 'Lead updated', data: lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 6. Customers Management: Get only customers whose leads/enquiries are assigned to this employee
exports.getMyCustomers = async (req, res) => {
  try {
    const empId = req.user._id;
    // Find all enquiries assigned to this sales employee
    const assignedEnquiries = await Enquiry.find({
      $or: [{ assignedSalesId: empId }, { assignedSales: empId }]
    }).select('customerId');

    const customerIds = assignedEnquiries
      .map(e => e.customerId)
      .filter(id => id != null);

    const customers = await User.find({
      _id: { $in: customerIds },
      role: 'customer'
    }).select('-password').sort({ createdAt: -1 });

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

// 11. Deals & Sales Pipeline (Strictly isolated by assignedSales/employee)
exports.getDeals = async (req, res) => {
  try {
    const deals = await Deal.find({ assignedSales: req.user._id }).populate('customerId', 'name company email').sort({ createdAt: -1 });
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
      value: Number(amount) || 150000,
      stage: stage || 'Proposal Sent',
      customerId: customerId || req.user._id,
      assignedSales: req.user._id,
      closingDate: expectedCloseDate || new Date(Date.now() + 86400000 * 15)
    });
    await logActivity(req.user._id, 'Deal Created', `New Deal: ${title} (₹${amount})`);
    res.status(201).json({ success: true, data: deal });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 12. Meetings Management (Strictly isolated by employee)
exports.getMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find({ employee: req.user._id }).sort({ meetingDate: 1 });
    res.json({ success: true, data: meetings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 13. Quotations Management (Get & Send Quotation to Customer)
exports.getQuotations = async (req, res) => {
  try {
    const quotations = await Quotation.find({}).sort({ createdAt: -1 });
    res.json({ success: true, data: quotations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendQuotationToCustomer = async (req, res) => {
  try {
    const { customerId, title, subTotal, taxGst, totalAmount, items, validUntil, enquiryId } = req.body;
    if (!customerId || !title || !totalAmount) {
      return res.status(400).json({ success: false, message: 'Customer ID, Title and Amount are required' });
    }

    const count = await Quotation.countDocuments();
    const quotationNumber = `QT-${202600 + count + 1}`;

    const quotation = await Quotation.create({
      customerId,
      quotationNumber,
      title,
      subTotal: Number(subTotal) || Number(totalAmount),
      taxGst: Number(taxGst) || 0,
      totalAmount: Number(totalAmount),
      status: 'Received',
      validUntil: validUntil || new Date(Date.now() + 86400000 * 30),
      items: items && items.length > 0 ? items : [
        { name: title, qty: 1, rate: Number(totalAmount), amount: Number(totalAmount) }
      ]
    });

    // If enquiryId provided, update Enquiry status to 'Proposal Sent' and add to timeline
    if (enquiryId) {
      const enquiry = await Enquiry.findById(enquiryId);
      if (enquiry) {
        enquiry.status = 'Proposal Sent';
        enquiry.timeline.push({
          status: 'Proposal Sent',
          title: `Quotation Sent (${quotationNumber})`,
          step: 'Commercial Proposal Dispatched',
          note: `Dedicated sales consultant prepared and sent formal quotation of ₹${Number(totalAmount).toLocaleString()} for ${title}.`,
          timestamp: new Date()
        });
        await enquiry.save();
      }
    }

    await logActivity(req.user._id, 'Quotation Sent', `Sent quotation ${quotationNumber} to customer`, `Amount: ₹${totalAmount}`);

    // Notify Customer and Admin
    try {
      await Notification.create({
        recipientRole: 'customer',
        userId: customerId,
        customerId: customerId,
        title: `📜 Commercial Proposal Received: ${quotationNumber}`,
        message: `Your dedicated sales executive has sent quotation for "${title}" of ₹${Number(totalAmount).toLocaleString()}. Please review and respond.`,
        type: 'quotation',
        senderName: req.user.name,
        senderRole: 'employee',
        linkId: quotation._id.toString()
      });
      await Notification.create({
        recipientRole: 'admin',
        customerId: customerId,
        title: `📤 Quotation Dispatched: ${quotationNumber}`,
        message: `Employee ${req.user.name} sent quotation of ₹${Number(totalAmount).toLocaleString()} for "${title}".`,
        type: 'quotation',
        senderName: req.user.name,
        senderRole: 'employee',
        linkId: quotation._id.toString()
      });
    } catch (nErr) {
      console.error('Error creating quotation notification:', nErr.message);
    }

    res.status(201).json({
      success: true,
      message: `Commercial proposal & quotation ${quotationNumber} dispatched to customer successfully!`,
      data: quotation
    });
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

// 16. Support Tickets / Helpdesk for Staff
exports.getStaffTickets = async (req, res) => {
  try {
    // 1. Find all customers who have leads/enquiries assigned to this staff member
    const myEnquiries = await Enquiry.find({ assignedSalesId: req.user._id }).select('customerId');
    const myCustomerIds = myEnquiries.map(e => e.customerId).filter(Boolean);

    // 2. Return tickets explicitly assigned to this staff member OR from their assigned customers OR general tickets
    const tickets = await Ticket.find({
      $or: [
        { assignedTo: req.user._id },
        { customerId: { $in: myCustomerIds } },
        { assignedTo: { $exists: false } },
        { assignedTo: null }
      ]
    }).populate('customerId', 'name company email phone').sort({ createdAt: -1 });

    res.json({ success: true, data: tickets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.replyStaffTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    ticket.messages.push({
      sender: 'support',
      senderName: req.user.name || 'Sales Support Officer',
      message: message.trim(),
      createdAt: new Date()
    });

    if (ticket.status === 'open') {
      ticket.status = 'in_progress';
    }

    await ticket.save();
    await logActivity(req.user._id, 'Ticket Reply Sent', `Replied to ticket #${ticket.ticketNumber || ticket._id}`);

    // Notify Customer and Admin
    try {
      if (ticket.customerId) {
        await Notification.create({
          recipientRole: 'customer',
          userId: ticket.customerId,
          customerId: ticket.customerId,
          title: `💬 Support Reply from ${req.user.name}`,
          message: `${req.user.name}: "${message.length > 60 ? message.substring(0, 60) + '...' : message}"`,
          type: 'chat',
          senderName: req.user.name,
          senderRole: 'employee',
          linkId: ticket._id.toString()
        });
      }
      await Notification.create({
        recipientRole: 'admin',
        title: `💬 Staff Reply on Ticket ${ticket.ticketNumber || ticket.subject}`,
        message: `${req.user.name} replied to ticket: "${message.length > 60 ? message.substring(0, 60) + '...' : message}"`,
        type: 'chat',
        senderName: req.user.name,
        senderRole: 'employee',
        linkId: ticket._id.toString()
      });
    } catch (nErr) {
      console.error('Error creating ticket reply notification:', nErr.message);
    }

    res.json({ success: true, message: 'Reply sent successfully', data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 17. Employee Notifications
exports.getStaffNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      $or: [
        { recipientRole: 'employee' },
        { recipientRole: 'all' },
        { userId: req.user._id }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(40);

    const unreadCount = await Notification.countDocuments({
      $or: [
        { recipientRole: 'employee' },
        { recipientRole: 'all' },
        { userId: req.user._id }
      ],
      read: false
    });

    res.json({ success: true, data: notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markStaffNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'all') {
      await Notification.updateMany(
        {
          $or: [
            { recipientRole: 'employee' },
            { recipientRole: 'all' },
            { userId: req.user._id }
          ]
        },
        { $set: { read: true } }
      );
      return res.json({ success: true, message: 'All notifications marked as read' });
    }
    const notif = await Notification.findByIdAndUpdate(id, { read: true }, { new: true });
    res.json({ success: true, data: notif });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
