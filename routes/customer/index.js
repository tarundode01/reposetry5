const express = require('express');
const router = express.Router();
const {
  registerCustomer,
  loginCustomer,
  sendOtp,
  getDashboardStats,
  getCustomerProfile,
  updateCustomerProfile,
  getEnquiries,
  createEnquiry,
  cancelEnquiry,
  getCustomerTickets,
  createTicket,
  replyTicket,
  getMeetings,
  bookMeeting,
  getQuotations,
  respondQuotation,
  getInvoices,
  getCustomerNotifications,
  markCustomerNotificationRead
} = require('../../controllers/customerController');
const { protect, authorize } = require('../../middlewares/authMiddleware');

// Public Auth APIs
router.post('/auth/register', registerCustomer);
router.post('/auth/login', loginCustomer);
router.post('/auth/send-otp', sendOtp);

// Protected Customer APIs
router.use(protect);
router.use(authorize('customer', 'admin'));

// 1. Dashboard
router.get('/dashboard', getDashboardStats);

// 2. Profile Management
router.get('/profile', getCustomerProfile);
router.put('/profile', updateCustomerProfile);

// 3. Enquiry Management & Tracking
router.get('/enquiries', getEnquiries);
router.post('/enquiries', createEnquiry);
router.post('/enquiries/:id/cancel', cancelEnquiry);

// 4. Support Tickets & Complaints
router.get('/tickets', getCustomerTickets);
router.post('/tickets', createTicket);
router.post('/tickets/:id/reply', replyTicket);

// 5. Appointments & Meetings
router.get('/meetings', getMeetings);
router.post('/meetings', bookMeeting);

// 6. Quotations
router.get('/quotations', getQuotations);
router.post('/quotations/:id/respond', respondQuotation);

// 7. Invoices & Billing
router.get('/invoices', getInvoices);

// 8. Notifications
router.get('/notifications', getCustomerNotifications);
router.put('/notifications/:id/read', markCustomerNotificationRead);

module.exports = router;
