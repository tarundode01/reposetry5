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
const Notification = require('../models/Notification');

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

    // Match criteria: match by customerId OR customer ObjectId OR email/phone if linked
    const leadFilter = {
      $or: [
        { customerId },
        { customer: customerId }
      ]
    };

    // Enquiries metrics (covers both Assigned and Unassigned leads across all stages)
    const totalEnquiries = await Enquiry.countDocuments(leadFilter);
    const assignedEnquiries = await Enquiry.countDocuments({
      ...leadFilter,
      $or: [
        { assignedSalesId: { $ne: null } },
        { 'assignedSales.name': { $ne: null } }
      ]
    });
    const unassignedEnquiries = await Enquiry.countDocuments({
      ...leadFilter,
      assignedSalesId: null,
      $or: [
        { assignedSales: null },
        { 'assignedSales.name': null }
      ]
    });
    const pendingEnquiries = await Enquiry.countDocuments({
      ...leadFilter,
      status: { $in: ['Submitted', 'Received', 'Under Review', 'New', 'Open'] }
    });
    const activeEnquiries = await Enquiry.countDocuments({
      ...leadFilter,
      status: { $in: ['Assigned', 'Contacted', 'In Discussion', 'Proposal Sent', 'Negotiation', 'Qualified', 'In Progress'] }
    });
    const completedEnquiries = await Enquiry.countDocuments({
      ...leadFilter,
      status: { $in: ['Converted', 'Closed', 'Approved'] }
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

    // Recent activities (populate assigned consultant details so customer immediately sees who is assigned)
    const recentEnquiries = await Enquiry.find(leadFilter)
      .populate('assignedSalesId', 'name phone email designation avatar')
      .sort({ createdAt: -1 })
      .limit(6);
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
          assignedEnquiries,
          unassignedEnquiries,
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
    const customerId = req.user._id;
    const enquiries = await Enquiry.find({
      $or: [
        { customerId },
        { customer: customerId }
      ]
    })
      .populate('assignedSalesId', 'name phone email designation avatar')
      .sort({ createdAt: -1 });

    // Sync embedded assignedSales with populated document if assignedSalesId exists
    const sanitized = enquiries.map(enq => {
      const doc = enq.toObject();
      if (doc.assignedSalesId && typeof doc.assignedSalesId === 'object') {
        doc.assignedSales = {
          name: doc.assignedSalesId.name || doc.assignedSales?.name,
          phone: doc.assignedSalesId.phone || doc.assignedSales?.phone,
          email: doc.assignedSalesId.email || doc.assignedSales?.email,
          designation: doc.assignedSalesId.designation || doc.assignedSales?.designation
        };
      }
      return doc;
    });

    res.json({ success: true, data: sanitized });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createEnquiry = async (req, res) => {
  try {
    const { productService, subject, description, budget, preferredContactTime, priority } = req.body;
    if (!productService || !subject || !description) {
      return res.status(400).json({ success: false, message: 'Service, Subject, and Description are required' });
    }

    const enquiryCount = await Enquiry.countDocuments();
    const enquiryId = `ENQ-${1000 + enquiryCount + 1}`;

    const enquiry = await Enquiry.create({
      customerId: req.user._id,
      enquiryId,
      productService,
      subject,
      description,
      budget: budget || 'Flexible',
      preferredContactTime: preferredContactTime || 'Anytime',
      priority: priority || 'Medium',
      source: 'Customer App',
      status: 'Submitted',
      assignedSalesId: null,
      assignedSales: {
        name: null,
        phone: null,
        email: null,
        designation: null
      },
      timeline: [
        {
          step: 'Requirement Submitted',
          title: 'Submitted by Customer',
          date: new Date().toLocaleDateString('en-GB'),
          note: `Customer submitted request for ${productService}. Awaiting Admin lead dispatch.`,
          timestamp: new Date()
        }
      ]
    });

    const populatedEnquiry = await Enquiry.findById(enquiry._id)
      .populate('customerId', 'name email phone company businessType designation gstNumber avatar')
      .populate('assignedSalesId', 'name email phone designation avatar');

    // Notify Admin of new Project Enquiry
    try {
      await Notification.create({
        recipientRole: 'admin',
        customerId: req.user._id,
        title: `🚀 New Project Enquiry: ${productService}`,
        message: `${req.user.name || 'Client'} has submitted a new project enquiry "${subject}" (Budget: ${budget || 'Flexible'}).`,
        type: 'enquiry',
        senderName: req.user.name,
        senderRole: 'customer',
        linkId: enquiry._id.toString()
      });
    } catch (notifErr) {
      console.error('Error creating enquiry notification:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'Enquiry submitted successfully! Awaiting Admin review & dedicated consultant assignment.',
      data: populatedEnquiry
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

    // Auto-link assigned sales employee if this customer has an assigned lead/enquiry
    let assignedStaff = null;
    const latestEnquiry = await Enquiry.findOne({
      customerId: req.user._id,
      assignedSalesId: { $ne: null }
    }).sort({ updatedAt: -1 });

    if (latestEnquiry && latestEnquiry.assignedSalesId) {
      assignedStaff = latestEnquiry.assignedSalesId;
    }

    const ticket = await Ticket.create({
      customerId: req.user._id,
      assignedTo: assignedStaff,
      subject,
      category: category || 'Technical',
      priority: priority || 'medium',
      description,
      messages: [
        {
          sender: 'customer',
          senderName: req.user.name,
          message: description,
          createdAt: new Date()
        }
      ]
    });

    // Notify Admin of new Ticket
    try {
      await Notification.create({
        recipientRole: 'admin',
        customerId: req.user._id,
        title: `🎫 New Support Ticket: ${ticket.ticketNumber || ticket.subject}`,
        message: `${req.user.name || 'Client'} raised a new ticket "${subject}" [${category || 'General'}].`,
        type: 'ticket',
        senderName: req.user.name,
        senderRole: 'customer',
        linkId: ticket._id.toString()
      });
    } catch (nErr) {
      console.error('Error creating ticket notification:', nErr.message);
    }

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
      message,
      createdAt: new Date()
    });
    if (['resolved', 'closed'].includes(ticket.status)) {
      ticket.status = 'in_progress';
    }
    await ticket.save();

    // Notify Admin of new Client Message
    try {
      await Notification.create({
        recipientRole: 'admin',
        customerId: req.user._id,
        title: `💬 New Client Message on Ticket ${ticket.ticketNumber || ticket.subject}`,
        message: `${req.user.name || 'Client'}: "${message.length > 60 ? message.substring(0, 60) + '...' : message}"`,
        type: 'chat',
        senderName: req.user.name,
        senderRole: 'customer',
        linkId: ticket._id.toString()
      });
    } catch (nErr) {
      console.error('Error creating reply notification:', nErr.message);
    }

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

    // Notify Admin of new Meeting Booking
    try {
      await Notification.create({
        recipientRole: 'admin',
        customerId: req.user._id,
        title: `📅 New Meeting Booked: ${subject || 'Consultation'}`,
        message: `${req.user.name || 'Client'} requested a ${meetingType || 'call'} on ${preferredDate} at ${timeSlot}.`,
        type: 'meeting',
        senderName: req.user.name,
        senderRole: 'customer',
        linkId: meeting._id.toString()
      });
    } catch (nErr) {
      console.error('Error creating meeting notification:', nErr.message);
    }

    res.status(201).json({ success: true, message: 'Meeting scheduled successfully!', data: meeting });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 9. Quotations & Billing
exports.getQuotations = async (req, res) => {
  try {
    const user = req.user;
    
    // Find all enquiries belonging to this user
    const userEnquiries = await Enquiry.find({
      $or: [
        { customerId: user._id },
        { customer: user._id }
      ]
    }).select('_id');
    const enquiryIds = userEnquiries.map(e => e._id);

    // Match criteria:
    // 1. Direct customerId matching user._id
    // 2. customerId populated or linked by email or phone
    // 3. Or linked through customer's enquiries
    const quotations = await Quotation.find({
      $or: [
        { customerId: user._id },
        { 'customerId._id': user._id },
        { 'customerId.email': user.email },
        { 'customerId.phone': user.phone },
        ...(enquiryIds.length > 0 ? [{ customerId: { $in: enquiryIds } }] : [])
      ]
    }).sort({ createdAt: -1 });

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

    let dealResult = null;
    let invoiceResult = null;
    let linkedEnquiry = null;

    // 🏆 Industry Standard Quote-to-Cash (Q2C) Deal Conversion Flow:
    if (status === 'Accepted') {
      const quotationVal = Number(quotation.totalAmount || quotation.subTotal || 0);

      // 1. Find linked Enquiry to identify assigned sales executive
      linkedEnquiry = await Enquiry.findOne({
        customerId: req.user._id,
        $or: [
          { subject: quotation.title },
          { productService: quotation.title },
          { status: { $in: ['Assigned', 'Proposal Sent', 'In Discussion', 'Contacted', 'Qualified', 'Received', 'Submitted'] } }
        ]
      }).sort({ updatedAt: -1 });

      const assignedSalesPersonId = linkedEnquiry?.assignedSalesId || null;

      // 2. Create or Update Deal -> Stage: 'Won'
      let deal = await Deal.findOne({
        customerId: req.user._id,
        $or: [
          { title: quotation.title },
          { title: `Deal - ${quotation.title}` }
        ]
      });

      if (!deal) {
        deal = new Deal({
          customerId: req.user._id,
          title: quotation.title || `Project Deal - ${quotation.quotationNumber}`,
          value: quotationVal,
          currency: 'INR',
          stage: 'Won',
          closingDate: new Date(),
          assignedSales: assignedSalesPersonId,
          notes: `Deal Closed Won automatically via Customer Quotation Acceptance (${quotation.quotationNumber || 'QUOT'}).`
        });
      } else {
        deal.stage = 'Won';
        deal.value = quotationVal || deal.value;
        deal.closingDate = new Date();
        if (assignedSalesPersonId && !deal.assignedSales) {
          deal.assignedSales = assignedSalesPersonId;
        }
        deal.notes = (deal.notes ? deal.notes + ' | ' : '') + `Accepted ${quotation.quotationNumber} on ${new Date().toLocaleDateString('en-GB')}`;
      }
      dealResult = await deal.save();

      // 3. Update linked Enquiry status to 'Converted' & log in timeline
      if (linkedEnquiry) {
        linkedEnquiry.status = 'Converted';
        linkedEnquiry.timeline = linkedEnquiry.timeline || [];
        linkedEnquiry.timeline.push({
          status: 'Converted',
          title: 'Deal Won & Converted 🏆',
          step: 'Quotation Accepted by Customer',
          date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          note: `Customer ${req.user.name || 'Client'} accepted quotation ${quotation.quotationNumber || ''} (₹${quotationVal.toLocaleString('en-IN')}). Deal marked Closed Won.`,
          timestamp: new Date()
        });
        await linkedEnquiry.save();
      }

      // 4. Auto-generate Proforma Commercial Invoice
      try {
        const invCount = await Invoice.countDocuments();
        const generatedInvNum = `INV-${2000 + invCount + 1}`;
        const invoiceDueDate = quotation.validUntil || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days default

        const invoiceItems = (quotation.items && quotation.items.length > 0)
          ? quotation.items.map(it => ({
              description: it.name || quotation.title,
              quantity: it.qty || 1,
              unitPrice: it.rate || it.amount || quotationVal,
              total: it.amount || (it.qty && it.rate ? it.qty * it.rate : quotationVal)
            }))
          : [
              {
                description: quotation.title || 'Professional Service Scope',
                quantity: 1,
                unitPrice: quotationVal,
                total: quotationVal
              }
            ];

        invoiceResult = await Invoice.create({
          customerId: req.user._id,
          invoiceNumber: generatedInvNum,
          amount: quotationVal,
          status: 'pending',
          dueDate: invoiceDueDate,
          items: invoiceItems
        });
      } catch (invErr) {
        console.error('Invoice auto-creation note:', invErr.message);
      }

      // 5. Notify Assigned Sales Employee (if assigned)
      if (assignedSalesPersonId) {
        try {
          await Notification.create({
            recipientRole: 'employee',
            userId: assignedSalesPersonId,
            customerId: req.user._id,
            title: `🏆 Deal Won! ${req.user.name || 'Client'} Accepted Quote`,
            message: `Congratulations! ${req.user.name || 'Client'} accepted quotation ${quotation.quotationNumber || ''} for ₹${quotationVal.toLocaleString('en-IN')}. Lead converted to Deal Won!`,
            type: 'deal',
            senderName: req.user.name,
            senderRole: 'customer',
            linkId: dealResult?._id?.toString() || quotation._id.toString()
          });
        } catch (empNotifErr) {
          console.error('Employee notification error:', empNotifErr.message);
        }
      }
    }

    // 6. Notify Admin of Quotation Response (Accepted / Rejected / Revision Requested)
    try {
      const isWon = status === 'Accepted';
      await Notification.create({
        recipientRole: 'admin',
        customerId: req.user._id,
        title: isWon
          ? `🎉 Deal Won! ${req.user.name || 'Client'} Accepted Quotation`
          : `💰 Quotation ${quotation.quotationNumber || 'Response'}: ${status}`,
        message: isWon
          ? `${req.user.name || 'Client'} accepted quotation ${quotation.quotationNumber || ''} for "${quotation.title}". Deal marked as Won, Lead Converted, and Proforma Invoice generated!`
          : `${req.user.name || 'Client'} responded with "${status}" on quotation for ${quotation.title || 'Project'}.`,
        type: isWon ? 'deal' : 'quotation',
        senderName: req.user.name,
        senderRole: 'customer',
        linkId: quotation._id.toString()
      });
    } catch (nErr) {
      console.error('Error creating quotation notification:', nErr.message);
    }

    res.json({
      success: true,
      message: status === 'Accepted'
        ? `Quotation accepted! Deal successfully converted to Won and Invoice generated.`
        : `Quotation status updated to ${status}`,
      data: {
        quotation,
        deal: dealResult,
        invoice: invoiceResult,
        enquiry: linkedEnquiry
      }
    });
  } catch (error) {
    console.error('respondQuotation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Public / Direct View Official Quotation & Proforma Document
exports.getQuotationPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const isId = id.match(/^[0-9a-fA-F]{24}$/);
    const quotation = await Quotation.findOne({
      $or: [
        ...(isId ? [{ _id: id }] : []),
        { quotationNumber: id }
      ]
    }).populate('customerId', 'name company email phone address');

    if (!quotation) {
      return res.status(404).send('<h1>Quotation Document Not Found</h1>');
    }

    const itemsRows = (quotation.items || []).map((it, idx) => `
      <tr style="border-bottom: 1px solid #E2E8F0;">
        <td style="padding: 10px; font-weight: bold; color: #1E293B;">${idx + 1}</td>
        <td style="padding: 10px; color: #1E293B;">
          <div style="font-weight: 800;">${it.name || quotation.title}</div>
          <div style="font-size: 11px; color: #64748B;">Official commercial deliverables & architecture module</div>
        </td>
        <td style="padding: 10px; text-align: center; color: #1E293B;">${it.qty || 1}</td>
        <td style="padding: 10px; text-align: right; color: #1E293B;">₹${Number(it.rate || it.amount || 0).toLocaleString()}</td>
        <td style="padding: 10px; text-align: right; font-weight: 800; color: #047857;">₹${Number(it.amount || ((it.qty || 1) * (it.rate || 0))).toLocaleString()}</td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Quotation #${quotation.quotationNumber}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #F8FAFC; margin: 0; padding: 24px; color: #0F172A; }
          .container { max-width: 800px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1.5px solid #CBD5E1; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #E2E8F0; padding-bottom: 18px; margin-bottom: 20px; }
          .badge { background: #EEF2FF; color: #4338CA; padding: 4px 12px; border-radius: 20px; font-weight: 800; font-size: 12px; }
          .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .th { background: #F1F5F9; padding: 10px; text-align: left; font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; }
          .totals { margin-top: 20px; float: right; width: 300px; }
          .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
          .grand-total { border-top: 2px solid #059669; padding-top: 8px; font-size: 18px; font-weight: 900; color: #047857; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div>
              <span class="badge">OFFICIAL PROFORMA PROPOSAL</span>
              <h1 style="margin: 6px 0 0 0; font-size: 24px; color: #1E1B4B;">Commercial Quotation</h1>
              <p style="margin: 2px 0 0 0; color: #64748B; font-weight: 700; font-size: 13px;">Document #${quotation.quotationNumber}</p>
            </div>
            <div style="text-align: right;">
              <h2 style="margin: 0; color: #4338CA; font-size: 20px;">OMNICRM ENTERPRISE</h2>
              <p style="margin: 2px 0 0 0; font-size: 11px; color: #64748B;">Cloud Corporate Solutions</p>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; margin-bottom: 24px;">
            <div>
              <p style="font-size: 11px; font-weight: 800; color: #64748B; margin: 0 0 4px 0; text-transform: uppercase;">PROPOSAL PREPARED FOR:</p>
              <h3 style="margin: 0; color: #1E1B4B; font-size: 16px;">${quotation.customerId?.name || 'Valued Corporate Client'}</h3>
              <p style="margin: 2px 0 0 0; color: #475569; font-size: 13px;">${quotation.customerId?.company || 'Enterprise Account'}</p>
              <p style="margin: 2px 0 0 0; color: #64748B; font-size: 12px;">${quotation.customerId?.email || ''} | ${quotation.customerId?.phone || ''}</p>
            </div>
            <div style="text-align: right;">
              <p style="font-size: 11px; font-weight: 800; color: #64748B; margin: 0 0 4px 0; text-transform: uppercase;">DETAILS:</p>
              <p style="margin: 0; font-size: 12px; color: #475569;">Date: <strong>${new Date(quotation.createdAt).toLocaleDateString()}</strong></p>
              <p style="margin: 2px 0 0 0; font-size: 12px; color: #475569;">Valid Until: <strong>${quotation.validUntil ? new Date(quotation.validUntil).toLocaleDateString() : '30 Days'}</strong></p>
              <p style="margin: 2px 0 0 0; font-size: 12px; color: #059669; font-weight: 800;">Status: ${quotation.status || 'Received'}</p>
            </div>
          </div>

          <h3 style="color: #1E1B4B; margin: 16px 0 8px 0; font-size: 15px;">Scope: ${quotation.title}</h3>

          <table class="table">
            <thead>
              <tr>
                <th class="th" style="width: 40px;">#</th>
                <th class="th">Item / Description</th>
                <th class="th" style="text-align: center; width: 60px;">Qty</th>
                <th class="th" style="text-align: right; width: 110px;">Rate (₹)</th>
                <th class="th" style="text-align: right; width: 120px;">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div style="overflow: hidden;">
            <div class="totals">
              <div class="total-row">
                <span style="color: #64748B;">Gross Subtotal:</span>
                <span style="font-weight: 800;">₹${Number(quotation.subTotal || quotation.totalAmount || 0).toLocaleString()}</span>
              </div>
              <div class="total-row">
                <span style="color: #64748B;">GST / Applicable Tax:</span>
                <span style="font-weight: 800; color: #059669;">+ ₹${Number(quotation.taxGst || 0).toLocaleString()}</span>
              </div>
              <div class="total-row grand-total">
                <span>Net Total:</span>
                <span>₹${Number(quotation.totalAmount || quotation.subTotal || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div style="margin-top: 48px; border-top: 1.5px dashed #CBD5E1; padding-top: 16px; display: flex; justify-content: space-between; align-items: center;">
            <p style="font-size: 11px; color: #94A3B8; margin: 0;">This is a system generated proforma quotation. Delivered securely via OmniCRM.</p>
            <button onclick="window.print()" style="background: #4338CA; color: #FFFFFF; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 800; cursor: pointer;">🖨️ Print / Save as PDF</button>
          </div>
        </div>
      </body>
      </html>
    `;

    res.send(htmlContent);
  } catch (err) {
    res.status(500).send('Error generating document');
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

// 10. Customer Notifications
exports.getCustomerNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      $or: [
        { customerId: req.user._id },
        { userId: req.user._id },
        { recipientRole: 'customer' }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(40);

    const unreadCount = await Notification.countDocuments({
      $or: [
        { customerId: req.user._id },
        { userId: req.user._id },
        { recipientRole: 'customer' }
      ],
      read: false
    });

    res.json({ success: true, data: notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markCustomerNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === 'all') {
      await Notification.updateMany(
        {
          $or: [
            { customerId: req.user._id },
            { userId: req.user._id },
            { recipientRole: 'customer' }
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
