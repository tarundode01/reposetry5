const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Deal = require('../models/Deal');
const Invoice = require('../models/Invoice');
const Enquiry = require('../models/Enquiry');
const Meeting = require('../models/Meeting');
const Quotation = require('../models/Quotation');
const ApprovalRequest = require('../models/ApprovalRequest');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'supersecret_crm_jwt_key_2026', {
    expiresIn: '30d'
  });
};

// 1. Auth: Register with Email or Mobile (Requires Admin Approval)
exports.registerCustomer = async (req, res) => {
  try {
    const { name, email, phone, password, company, businessType } = req.body;
    if (!name || (!email && !phone) || !password) {
      return res.status(400).json({ success: false, message: 'Name, Email/Phone, and Password are required' });
    }

    const emailToCheck = email ? email.toLowerCase().trim() : `${phone}@crmcustomer.in`;
    const userExists = await User.findOne({ $or: [{ email: emailToCheck }, { phone: phone || '___' }] });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Customer with this email or phone already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email: emailToCheck,
      phone: phone || '',
      password: hashedPassword,
      company: company || '',
      businessType: businessType || 'Individual',
      role: 'customer',
      status: 'pending_approval',
      isApproved: false
    });

    // Notify Admin by creating an ApprovalRequest
    await ApprovalRequest.create({
      requestType: 'New Customer Registration',
      requestedBy: user._id,
      requestedByName: `${user.name} (${user.company || 'Customer'})`,
      subject: `New Customer Registration: ${user.name}`,
      description: `New customer account registered for ${user.email} (Phone: ${user.phone || 'N/A'}, Company: ${user.company || 'Individual'}). Awaiting Admin authorization.`,
      status: 'Pending',
      targetRole: 'customer'
    });

    res.status(201).json({
      success: true,
      pendingApproval: true,
      message: 'Account registered successfully! Your account is pending Admin approval. You can login once approved.',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        company: user.company,
        role: user.role,
        status: user.status,
        isApproved: false
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Auth: Secure Login (Verifies Approval Status)
exports.loginCustomer = async (req, res) => {
  try {
    const { identifier, email, phone, password } = req.body;
    const loginKey = (identifier || email || phone || '').toLowerCase().trim();

    if (!loginKey || !password) {
      return res.status(400).json({ success: false, message: 'Email/Phone and Password are required' });
    }

    const user = await User.findOne({
      $or: [{ email: loginKey }, { phone: loginKey }]
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Incorrect password.' });
    }

    // Check Approval Status
    if (user.status === 'pending_approval' || user.isApproved === false) {
      return res.status(403).json({
        success: false,
        pendingApproval: true,
        message: 'Your account is pending Admin approval. Please wait until Admin approves your registration.'
      });
    }

    if (user.status === 'suspended' || user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated/suspended by Admin. Please contact customer support.'
      });
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        company: user.company,
        businessType: user.businessType,
        gstNumber: user.gstNumber,
        designation: user.designation,
        role: user.role,
        avatar: user.avatar,
        token: generateToken(user._id)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Auth: Send OTP / Verify OTP Mock
exports.sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    res.json({
      success: true,
      message: `OTP sent to ${phone}: ${otp}`,
      otp
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Customer Comprehensive Dashboard
exports.getDashboardStats = async (req, res) => {
  try {
    const customerId = req.user._id;

    // Enquiries metrics
    const totalEnquiries = await Enquiry.countDocuments({ customerId });
    const pendingEnquiries = await Enquiry.countDocuments({
      customerId,
      status: { $in: ['Submitted', 'Received', 'Under Review'] }
    });
    const activeEnquiries = await Enquiry.countDocuments({
      customerId,
      status: { $in: ['Contacted', 'In Discussion', 'Proposal Sent', 'Negotiation'] }
    });
    const completedEnquiries = await Enquiry.countDocuments({
      customerId,
      status: { $in: ['Converted', 'Closed'] }
    });

    // Tickets
    const totalTickets = await Ticket.countDocuments({ customerId });
    const openTickets = await Ticket.countDocuments({
      customerId,
      status: { $in: ['open', 'in_progress'] }
    });

    // Invoices & Billing
    const pendingInvoices = await Invoice.find({ customerId, status: 'pending' });
    const pendingPayments = pendingInvoices.reduce((acc, inv) => acc + inv.amount, 0);

    // Upcoming Meetings
    const upcomingMeetings = await Meeting.find({
      customerId,
      status: { $in: ['Confirmed', 'Pending Confirmation'] }
    }).sort({ createdAt: -1 }).limit(3);

    // Recent activities
    const recentEnquiries = await Enquiry.find({ customerId }).sort({ createdAt: -1 }).limit(4);
    const recentTickets = await Ticket.find({ customerId }).sort({ createdAt: -1 }).limit(3);

    res.json({
      success: true,
      data: {
        profileSummary: {
          name: req.user.name,
          email: req.user.email,
          phone: req.user.phone,
          company: req.user.company,
          avatar: req.user.avatar
        },
        kpis: {
          totalEnquiries,
          pendingEnquiries,
          activeEnquiries,
          completedEnquiries,
          openTickets,
          totalTickets,
          pendingPayments
        },
        upcomingMeetings,
        recentEnquiries,
        recentTickets
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5. Customer Profile
exports.getCustomerProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCustomerProfile = async (req, res) => {
  try {
    const { name, phone, company, businessType, designation, address, gstNumber, avatar } = req.body;
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = name || user.name;
      user.phone = phone !== undefined ? phone : user.phone;
      user.company = company !== undefined ? company : user.company;
      user.businessType = businessType || user.businessType;
      user.designation = designation !== undefined ? designation : user.designation;
      user.gstNumber = gstNumber !== undefined ? gstNumber : user.gstNumber;
      user.avatar = avatar || user.avatar;
      if (address) {
        user.address = { ...user.address, ...address };
      }
      const updatedUser = await user.save();
      res.json({ success: true, message: 'Profile updated successfully', data: updatedUser });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 6. Enquiry Management
exports.getEnquiries = async (req, res) => {
  try {
    const enquiries = await Enquiry.find({ customerId: req.user._id })
      .populate('assignedSalesId', 'name phone email designation')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: enquiries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createEnquiry = async (req, res) => {
  try {
    const { productService, subject, description, budget, preferredContactTime } = req.body;
    if (!productService || !subject || !description) {
      return res.status(400).json({ success: false, message: 'Service, Subject, and Description are required' });
    }

    const enquiry = await Enquiry.create({
      customerId: req.user._id,
      productService,
      subject,
      description,
      budget: budget || 'Flexible',
      preferredContactTime: preferredContactTime || 'Anytime',
      status: 'Submitted',
      assignedSalesId: null,
      assignedSales: {
        name: null,
        phone: null,
        email: null,
        designation: null
      }
    });

    res.status(201).json({
      success: true,
      message: 'Enquiry submitted successfully! Awaiting Admin review & dedicated consultant assignment.',
      data: enquiry
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.cancelEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findOne({ _id: req.params.id, customerId: req.user._id });
    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }
    if (['Converted', 'Closed'].includes(enquiry.status)) {
      return res.status(400).json({ success: false, message: 'Processed enquiries cannot be cancelled' });
    }
    enquiry.status = 'Cancelled';
    enquiry.timeline.push({
      status: 'Cancelled',
      title: 'Cancelled by Customer',
      note: 'The customer requested cancellation of this enquiry.'
    });
    await enquiry.save();
    res.json({ success: true, message: 'Enquiry cancelled successfully', data: enquiry });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 7. Support Tickets & Complaint Management
exports.getCustomerTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find({ customerId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: tickets });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTicket = async (req, res) => {
  try {
    const { subject, category, priority, description } = req.body;
    if (!subject || !description) {
      return res.status(400).json({ success: false, message: 'Subject and description are required' });
    }

    const ticket = await Ticket.create({
      customerId: req.user._id,
      subject,
      category: category || 'Technical',
      priority: priority || 'medium',
      description,
      messages: [
        {
          sender: 'customer',
          senderName: req.user.name,
          message: description
        }
      ]
    });

    res.status(201).json({ success: true, message: 'Support Ticket Raised!', data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.replyTicket = async (req, res) => {
  try {
    const { message } = req.body;
    const ticket = await Ticket.findOne({ _id: req.params.id, customerId: req.user._id });
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    ticket.messages.push({
      sender: 'customer',
      senderName: req.user.name,
      message
    });
    if (['resolved', 'closed'].includes(ticket.status)) {
      ticket.status = 'in_progress';
    }
    await ticket.save();
    res.json({ success: true, message: 'Message sent', data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 8. Meetings & Appointments
exports.getMeetings = async (req, res) => {
  try {
    const meetings = await Meeting.find({ customerId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: meetings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.bookMeeting = async (req, res) => {
  try {
    const { meetingType, subject, preferredDate, timeSlot, notes } = req.body;
    const meeting = await Meeting.create({
      customerId: req.user._id,
      meetingType: meetingType || 'Online (Google Meet/Zoom)',
      subject,
      preferredDate,
      timeSlot,
      notes
    });
    res.status(201).json({ success: true, message: 'Meeting scheduled successfully!', data: meeting });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 9. Quotations & Billing
exports.getQuotations = async (req, res) => {
  try {
    const quotations = await Quotation.find({ customerId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: quotations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.respondQuotation = async (req, res) => {
  try {
    const { status } = req.body; // 'Accepted' | 'Rejected' | 'Revision Requested'
    const quotation = await Quotation.findOne({ _id: req.params.id, customerId: req.user._id });
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }
    quotation.status = status;
    await quotation.save();
    res.json({ success: true, message: `Quotation status updated to ${status}`, data: quotation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find({ customerId: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: invoices });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
