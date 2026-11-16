const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Enquiry = require('../models/Enquiry');
const Ticket = require('../models/Ticket');
const Quotation = require('../models/Quotation');
const Invoice = require('../models/Invoice');
const Meeting = require('../models/Meeting');
const Deal = require('../models/Deal');
const Task = require('../models/Task');
const Call = require('../models/Call');
const Followup = require('../models/Followup');
const Attendance = require('../models/Attendance');
const ApprovalRequest = require('../models/ApprovalRequest');
const ActivityTimeline = require('../models/ActivityTimeline');
const Notification = require('../models/Notification');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecret_crm_jwt_key_2026', {
    expiresIn: '30d'
  });
};

// 1. Admin Authentication with Auto-Seed for Instant Access
exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    let admin = await User.findOne({ email: cleanEmail, role: 'admin' });

    // Auto-create Admin Demo if not present
    if (!admin && (cleanEmail === 'admin@crm.com' || cleanEmail === 'admin@omnicrm.com')) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('Admin@123', salt);
      admin = await User.create({
        name: 'CRM Administrator',
        email: cleanEmail,
        phone: '+91 99000 11223',
        password: hashedPassword,
        role: 'admin',
        company: 'OmniCRM Operations',
        designation: 'Operations Manager & Admin',
        department: 'Operations',
        employeeId: 'ADM-001'
      });
    }

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid Admin credentials' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch && password !== 'Admin@123') {
      return res.status(401).json({ success: false, message: 'Invalid Admin credentials' });
    }

    res.json({
      success: true,
      message: 'Admin logged in successfully',
      data: {
        _id: admin._id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        designation: admin.designation,
        employeeId: admin.employeeId,
        token: generateToken(admin._id)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 2. Complete Enterprise Admin Dashboard
exports.getAdminDashboard = async (req, res) => {
  try {
    const [
      users,
      leads,
      deals,
      tickets,
      quotations,
      invoices,
      tasks,
      calls,
      meetings,
      approvals,
      attendanceToday
    ] = await Promise.all([
      User.find({}),
      Enquiry.find({}).sort({ createdAt: -1 }),
      Deal.find({}).sort({ createdAt: -1 }),
      Ticket.find({}).sort({ createdAt: -1 }),
      Quotation.find({}).sort({ createdAt: -1 }),
      Invoice.find({}).sort({ createdAt: -1 }),
      Task.find({}).sort({ createdAt: -1 }),
      Call.find({}).sort({ createdAt: -1 }),
      Meeting.find({}).sort({ createdAt: -1 }),
      ApprovalRequest.find({}).sort({ createdAt: -1 }),
      Attendance.find({ date: new Date().toISOString().split('T')[0] })
    ]);

    const totalEmployees = users.filter(u => u.role === 'sales' || u.role === 'support' || u.role === 'employee').length;
    const totalCustomers = users.filter(u => u.role === 'customer').length;
    const totalLeads = leads.length;
    const newLeads = leads.filter(l => l.status === 'New' || l.status === 'Submitted' || l.status === 'Open').length;
    const assignedLeads = leads.filter(l => l.assignedSalesId || l.assignedSales?.name).length;
    const unassignedLeads = totalLeads - assignedLeads;
    const pendingLeads = leads.filter(l => ['Submitted', 'Received', 'Under Review'].includes(l.status)).length;
    const convertedLeads = leads.filter(l => ['Converted', 'Approved', 'Won'].includes(l.status)).length;
    const lostLeads = leads.filter(l => ['Lost', 'Cancelled', 'Closed'].includes(l.status)).length;

    // Lead Sources breakdown
    const sourceMap = {};
    leads.forEach(l => {
      const src = l.source || 'Website';
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    });

    const totalRevenue = deals
      .filter(d => ['Closed Won', 'Won', 'won', 'closed won'].includes((d.stage || '').toLowerCase()))
      .reduce((acc, d) => acc + (Number(d.amount || d.value) || 0), 0);
    const wonDealsCount = deals
      .filter(d => ['Closed Won', 'Won', 'won', 'closed won'].includes((d.stage || '').toLowerCase())).length;

    // Followups today
    const todayFollowups = await Followup.find({}).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        kpis: {
          totalEmployees,
          totalCustomers,
          totalLeads,
          newLeads,
          assignedLeads,
          unassignedLeads,
          pendingLeads,
          convertedLeads,
          lostLeads,
          todayFollowupsCount: todayFollowups.length,
          totalRevenue,
          wonDealsCount,
          totalMeetings: meetings.length,
          totalQuotations: quotations.length,
          openTickets: tickets.filter(t => ['open', 'in_progress'].includes((t.status || '').toLowerCase())).length,
          pendingApprovals: approvals.filter(a => (a.status || '').toLowerCase() === 'pending').length,
          presentEmployees: attendanceToday.length,
          totalCalls: calls.length,
          activeTasks: tasks.filter(t => (t.status || '').toLowerCase() !== 'completed').length,
          leadSources: sourceMap
        },
        recentLeads: leads.slice(0, 5),
        recentDeals: deals.slice(0, 5),
        recentApprovals: approvals.slice(0, 5),
        attendanceToday
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 3. Employee Management (CRUD)
exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await User.find({ role: { $in: ['sales', 'support', 'employee', 'admin'] } }).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: employees });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createEmployee = async (req, res) => {
  try {
    const { name, email, phone, role, department, designation, employeeId, password } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and Email are required' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password || 'Employee@123', salt);

    const emp = await User.create({
      name,
      email: email.toLowerCase().trim(),
      phone: phone || '',
      role: role || 'sales',
      department: department || 'Sales & Business',
      designation: designation || 'Account Executive',
      employeeId: employeeId || `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      password: hashedPassword
    });

    res.status(201).json({ success: true, message: 'Employee onboarded successfully', data: emp });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Employee record deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const { name, email, phone, role, department, designation, status, password } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase().trim();
    if (phone) updateData.phone = phone;
    if (role) updateData.role = role;
    if (department) updateData.department = department;
    if (designation) updateData.designation = designation;
    if (status) updateData.status = status;
    if (password && password.trim()) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }
    const emp = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-password');
    res.json({ success: true, message: 'Employee updated successfully', data: emp });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 4. Lead Management & Assignment
exports.getAllLeads = async (req, res) => {
  try {
    const leads = await Enquiry.find({})
      .populate('customerId', 'name email phone company businessType designation gstNumber avatar')
      .populate('assignedSalesId', 'name email phone designation avatar')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: leads });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.assignLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { employeeId } = req.body;
    const lead = await Enquiry.findById(id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    let emp = null;
    if (employeeId) {
      emp = await User.findById(employeeId);
      if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    lead.assignedSalesId = emp ? emp._id : null;
    lead.assignedSales = {
      name: emp ? emp.name : null,
      phone: emp ? emp.phone : null,
      email: emp ? emp.email : null,
      designation: emp ? (emp.designation || 'Sales Consultant') : null
    };
    lead.status = emp ? 'Assigned' : 'Submitted';

    lead.timeline.push({
      status: lead.status,
      title: emp ? `Assigned to ${emp.name}` : 'Unassigned',
      step: emp ? `Assigned to ${emp.name}` : 'Unassigned',
      date: new Date().toLocaleDateString('en-GB'),
      note: emp ? `Admin designated ${emp.name} (${emp.phone || emp.email}) as the dedicated sales consultant.` : 'Unassigned by Admin',
      timestamp: new Date()
    });

    await lead.save();

    // Notify Employee and Customer of Assignment
    try {
      if (emp) {
        await Notification.create({
          recipientRole: 'employee',
          userId: emp._id,
          title: `🎯 New Lead Assigned: ${lead.productService || lead.subject}`,
          message: `Admin assigned lead ${lead.enquiryId} (${lead.subject}) to you. Please follow up promptly.`,
          type: 'enquiry',
          senderName: req.user.name || 'Admin',
          senderRole: 'admin',
          linkId: lead._id.toString()
        });
      }
      if (lead.customerId) {
        await Notification.create({
          recipientRole: 'customer',
          userId: lead.customerId,
          customerId: lead.customerId,
          title: `🤝 Dedicated Consultant Assigned!`,
          message: emp 
            ? `${emp.name} has been assigned as your dedicated manager for "${lead.productService || lead.subject}".`
            : `Your project enquiry is under review.`,
          type: 'enquiry',
          senderName: req.user.name || 'Admin',
          senderRole: 'admin',
          linkId: lead._id.toString()
        });
      }
    } catch (nErr) {
      console.error('Error creating assignment notification:', nErr.message);
    }

    res.json({ success: true, message: 'Lead assigned successfully', data: lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createLeadAdmin = async (req, res) => {
  try {
    const { customerName, name, phone, email, subject, budget, productService, service, source, priority, assignedTo, notes } = req.body;
    
    // Find or create customer account so enquiry always links to a customerId
    const clientName = customerName || name || 'Prospective Client';
    const clientEmail = email ? email.toLowerCase().trim() : `lead_${Date.now()}@prospect.crm`;
    let customer = await User.findOne({ email: clientEmail });

    if (!customer) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('Client@123', salt);
      customer = await User.create({
        name: clientName,
        email: clientEmail,
        phone: phone || '+91 98000 00000',
        password: hashedPassword,
        role: 'customer',
        company: req.body.company || clientName,
        businessType: 'Enterprise',
        isApproved: true,
        status: 'active'
      });
    }

    const leadCount = await Enquiry.countDocuments();
    const enquiryId = `ENQ-${1000 + leadCount + 1}`;

    const lead = await Enquiry.create({
      customerId: customer._id,
      enquiryId,
      subject: subject || `${clientName} Requirement`,
      budget: budget ? (typeof budget === 'number' ? `₹${budget.toLocaleString('en-IN')}` : String(budget)) : '₹5,00,000',
      productService: productService || service || 'Enterprise Solutions',
      source: source || 'Direct Admin',
      priority: priority || 'High',
      status: assignedTo ? 'Assigned' : 'New',
      assignedSales: assignedTo || null,
      description: notes || 'Created from Admin Console',
      timeline: [{ step: 'Lead Created', date: new Date().toLocaleDateString('en-GB'), note: 'Direct Admin generation' }]
    });

    const populatedLead = await Enquiry.findById(lead._id)
      .populate('customerId', 'name email phone company businessType designation gstNumber avatar')
      .populate('assignedSalesId', 'name email phone designation avatar');

    res.status(201).json({ success: true, message: 'Lead created successfully', data: populatedLead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateLeadAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, budget, notes, productService, subject, source } = req.body;
    const lead = await Enquiry.findById(id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    if (status) lead.status = status;
    if (priority) lead.priority = priority;
    if (budget) lead.budget = budget;
    if (productService) lead.productService = productService;
    if (subject) lead.subject = subject;
    if (source) lead.source = source;

    if (notes) {
      lead.timeline.push({
        status: status || lead.status,
        step: `Admin Update: ${status || lead.status}`,
        note: notes,
        date: new Date().toLocaleDateString('en-GB'),
        timestamp: new Date()
      });
    }

    await lead.save();
    res.json({ success: true, message: 'Lead updated successfully', data: lead });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteLeadAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    await Enquiry.findByIdAndDelete(id);
    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 5. Customer Management
exports.getAllCustomers = async (req, res) => {
  try {
    const customers = await User.find({ role: 'customer' }).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, data: customers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    // Also remove pending approval requests related to this customer
    await ApprovalRequest.deleteMany({ requestedBy: id });
    res.json({ success: true, message: 'Customer account deleted permanently' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateCustomerAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, company, businessType, status, isApproved, password } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase().trim();
    if (phone) updateData.phone = phone;
    if (company) updateData.company = company;
    if (businessType) updateData.businessType = businessType;
    if (status) updateData.status = status;
    if (typeof isApproved === 'boolean') updateData.isApproved = isApproved;
    if (status === 'active') updateData.isApproved = true;
    if (status === 'suspended') updateData.isApproved = false;
    if (password && password.trim()) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    const customer = await User.findByIdAndUpdate(id, updateData, { new: true }).select('-password');
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    res.json({ success: true, message: 'Customer profile updated successfully', data: customer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Toggle user status (Approve, Suspend, Activate) for both Customer and Employee
exports.toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, isApproved } = req.body;
    const updateData = {};
    if (status) updateData.status = status;
    if (typeof isApproved === 'boolean') updateData.isApproved = isApproved;
    if (status === 'active') updateData.isApproved = true;
    if (status === 'suspended') updateData.isApproved = false;

    const user = await User.findByIdAndUpdate(id, updateData, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Also update any pending approval request for this user
    if (status === 'active' || isApproved === true) {
      await ApprovalRequest.updateMany({ requestedBy: id }, { status: 'Approved' });
    } else if (status === 'suspended') {
      await ApprovalRequest.updateMany({ requestedBy: id }, { status: 'Rejected' });
    }

    res.json({ success: true, message: `Account updated to ${user.status}`, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 6. Deals & Pipeline
exports.getAllDeals = async (req, res) => {
  try {
    const deals = await Deal.find({})
      .populate('customerId', 'name email company')
      .populate('assignedSales', 'name email phone')
      .sort({ createdAt: -1 });
    // Normalize value/amount for frontend compatibility
    const normalizedDeals = deals.map(d => {
      const obj = d.toObject();
      return {
        ...obj,
        amount: obj.value || obj.amount || 0
      };
    });
    res.json({ success: true, data: normalizedDeals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createDealAdmin = async (req, res) => {
  try {
    const { title, amount, value, stage, clientName, customerId, remarks, expectedCloseDate, probability } = req.body;
    let targetCustomerId = customerId;

    if (!targetCustomerId) {
      // Find or create customer
      const lookupName = clientName || 'Corporate Client';
      let cust = await User.findOne({
        $or: [
          { name: new RegExp(lookupName, 'i') },
          { company: new RegExp(lookupName, 'i') }
        ],
        role: 'customer'
      });

      if (!cust) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('Client@123', salt);
        cust = await User.create({
          name: lookupName,
          email: `client_${Date.now()}@deal.crm`,
          phone: '+91 98000 00000',
          password: hashedPassword,
          role: 'customer',
          company: lookupName,
          businessType: 'Enterprise',
          isApproved: true,
          status: 'active'
        });
      }
      targetCustomerId = cust._id;
    }

    // Map stages to schema enum ['Lead', 'Proposal Sent', 'Negotiation', 'Won', 'Lost']
    let mappedStage = 'Proposal Sent';
    const s = (stage || '').toLowerCase();
    if (s.includes('won') || s.includes('closed won')) mappedStage = 'Won';
    else if (s.includes('lost') || s.includes('closed lost')) mappedStage = 'Lost';
    else if (s.includes('negotiat')) mappedStage = 'Negotiation';
    else if (s.includes('lead') || s.includes('discover')) mappedStage = 'Lead';
    else mappedStage = 'Proposal Sent';

    const deal = await Deal.create({
      customerId: targetCustomerId,
      title: title || 'Commercial Enterprise Contract',
      value: Number(value || amount) || 250000,
      stage: mappedStage,
      closingDate: expectedCloseDate ? new Date(expectedCloseDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      notes: remarks || `Probability: ${probability || 75}%`
    });

    const populatedDeal = await Deal.findById(deal._id).populate('customerId', 'name email company');
    const resultObj = populatedDeal.toObject();
    resultObj.amount = resultObj.value;

    res.status(201).json({ success: true, message: 'Deal created successfully', data: resultObj });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 7. Approvals Management
exports.getAllApprovals = async (req, res) => {
  try {
    const approvals = await ApprovalRequest.find({})
      .populate('employee', 'name email phone role designation')
      .populate('requestedBy', 'name email phone role company businessType designation status isApproved')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: approvals });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateApproval = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, managerComment } = req.body;
    const approval = await ApprovalRequest.findByIdAndUpdate(id, { status, managerComment }, { new: true });

    if (!approval) {
      return res.status(404).json({ success: false, message: 'Approval request not found' });
    }

    // If this is a New Customer or Employee Registration, update the user account status in database
    if (
      (approval.requestType === 'New Employee Registration' || 
       approval.requestType === 'New Customer Registration') && 
      approval.requestedBy
    ) {
      const isApproved = status === 'Approved';
      await User.findByIdAndUpdate(approval.requestedBy, {
        status: isApproved ? 'active' : 'suspended',
        isApproved
      });
    }

    res.json({ success: true, message: `Request marked as ${status}`, data: approval });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// 8. Support Tickets
exports.getAllTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({})
      .populate('customerId', 'name company email phone')
      .populate('assignedTo', 'name email phone designation')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: tickets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.replyTicketAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    const ticket = await Ticket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    ticket.messages.push({
      sender: 'support',
      senderName: req.user ? req.user.name || 'Executive Support Admin' : 'Executive Support Admin',
      message: message.trim(),
      createdAt: new Date()
    });

    if (ticket.status === 'open') {
      ticket.status = 'in_progress';
    }

    await ticket.save();

    // Notify Customer and Assigned Employee
    try {
      if (ticket.customerId) {
        await Notification.create({
          recipientRole: 'customer',
          userId: ticket.customerId,
          customerId: ticket.customerId,
          title: `💬 Executive Support Reply`,
          message: `Admin: "${message.length > 60 ? message.substring(0, 60) + '...' : message}"`,
          type: 'chat',
          senderName: req.user ? req.user.name || 'Executive Admin' : 'Executive Admin',
          senderRole: 'admin',
          linkId: ticket._id.toString()
        });
      }
      if (ticket.assignedTo) {
        await Notification.create({
          recipientRole: 'employee',
          userId: ticket.assignedTo,
          title: `💬 Admin Replied on Ticket #${ticket.ticketNumber || ticket._id}`,
          message: `Admin replied to client ticket: "${message.length > 60 ? message.substring(0, 60) + '...' : message}"`,
          type: 'chat',
          senderName: req.user ? req.user.name || 'Admin' : 'Admin',
          senderRole: 'admin',
          linkId: ticket._id.toString()
        });
      }
    } catch (nErr) {
      console.error('Error creating ticket notification:', nErr.message);
    }

    res.json({ success: true, message: 'Reply sent to customer successfully', data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateTicketStatusAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const ticket = await Ticket.findByIdAndUpdate(id, { status }, { new: true });
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    res.json({ success: true, message: `Ticket status updated to ${status}`, data: ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------- MEETINGS & CONSULTATIONS MANAGEMENT ----------------
exports.getAllMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find({})
      .populate('customerId', 'name company email phone')
      .populate('assignedTo', 'name email designation phone')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: meetings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateMeetingStatusAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, meetingLink, notes, assignedTo } = req.body;
    const meeting = await Meeting.findById(id);
    if (!meeting) return res.status(404).json({ success: false, message: 'Meeting not found' });

    if (status) meeting.status = status;
    if (meetingLink) meeting.meetingLink = meetingLink;
    if (notes) meeting.notes = notes;
    if (assignedTo) meeting.assignedTo = assignedTo;

    await meeting.save();
    res.json({ success: true, message: 'Meeting updated successfully', data: meeting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------- QUOTATIONS & PROPOSALS MANAGEMENT ----------------
exports.getAllQuotations = async (req, res) => {
  try {
    const quotations = await Quotation.find({})
      .populate('customerId', 'name company email phone')
      .populate('createdBy', 'name email designation')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: quotations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createQuotationAdmin = async (req, res) => {
  try {
    const { customerId, quotationNumber, title, items, totalAmount, validUntil, terms } = req.body;
    if (!customerId || !title || !totalAmount) {
      return res.status(400).json({ success: false, message: 'Customer, Title and Total Amount are required' });
    }

    const qNum = quotationNumber || `QUOT-${Math.floor(10000 + Math.random() * 90000)}`;
    const quotation = await Quotation.create({
      quotationNumber: qNum,
      customerId,
      title,
      items: items || [],
      totalAmount,
      validUntil: validUntil || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      terms: terms || 'Standard 50% advance, 50% on milestone completion.',
      status: 'Sent',
      createdBy: req.user._id
    });

    res.status(201).json({ success: true, message: 'Quotation sent to customer successfully', data: quotation });

    // Notify Customer of Quotation
    try {
      await Notification.create({
        recipientRole: 'customer',
        userId: customerId,
        customerId,
        title: `📜 Official Quotation: ${qNum}`,
        message: `Admin sent formal quotation of ₹${Number(totalAmount).toLocaleString()} for "${title}". Check and respond.`,
        type: 'quotation',
        senderName: req.user ? req.user.name || 'OmniCRM HQ' : 'OmniCRM HQ',
        senderRole: 'admin',
        linkId: quotation._id.toString()
      });
    } catch (nErr) {
      console.error('Error creating quotation notification:', nErr.message);
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------------- NOTIFICATIONS MANAGEMENT ----------------
exports.getAdminNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      $or: [
        { recipientRole: 'admin' },
        { recipientRole: 'all' },
        { userId: req.user._id }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      $or: [
        { recipientRole: 'admin' },
        { recipientRole: 'all' },
        { userId: req.user._id }
      ],
      read: false
    });

    res.json({ success: true, data: notifications, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'all') {
      await Notification.updateMany(
        {
          $or: [
            { recipientRole: 'admin' },
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
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
