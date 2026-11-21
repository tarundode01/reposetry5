const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/adminController');
const { protect, authorize } = require('../../middlewares/authMiddleware');

// Public Auth
router.post('/auth/login', adminController.loginAdmin);

// Protected Admin APIs
router.use(protect);
router.use(authorize('admin'));

// Dashboard
router.get('/dashboard', adminController.getAdminDashboard);

// Employees
router.get('/employees', adminController.getAllEmployees);
router.post('/employees', adminController.createEmployee);
router.put('/employees/:id', adminController.updateEmployee);
router.delete('/employees/:id', adminController.deleteEmployee);

// Leads
router.get('/leads', adminController.getAllLeads);
router.post('/leads', adminController.createLeadAdmin);
router.put('/leads/:id', adminController.updateLeadAdmin);
router.delete('/leads/:id', adminController.deleteLeadAdmin);
router.put('/leads/:id/assign', adminController.assignLead);

// Customers
router.get('/customers', adminController.getAllCustomers);
router.put('/customers/:id', adminController.updateCustomerAdmin);
router.delete('/customers/:id', adminController.deleteCustomer);
router.put('/users/:id/status', adminController.toggleUserStatus);

// Deals & Sales Pipeline
router.get('/deals', adminController.getAllDeals);
router.post('/deals', adminController.createDealAdmin);

// Approvals
router.get('/approvals', adminController.getAllApprovals);
router.put('/approvals/:id', adminController.updateApproval);

// Support
router.get('/tickets', adminController.getAllTickets);
router.post('/tickets/:id/reply', adminController.replyTicketAdmin);
router.put('/tickets/:id/status', adminController.updateTicketStatusAdmin);

// Meetings & Consultations
router.get('/meetings', adminController.getAllMeetings);
router.put('/meetings/:id', adminController.updateMeetingStatusAdmin);

// Quotations & Commercials
router.get('/quotations', adminController.getAllQuotations);
router.post('/quotations', adminController.createQuotationAdmin);
router.put('/quotations/:id', adminController.updateQuotationAdmin);
router.delete('/quotations/:id', adminController.deleteQuotationAdmin);

// Notifications & Realtime Alerts
router.get('/notifications', adminController.getAdminNotifications);
router.put('/notifications/:id/read', adminController.markNotificationRead);

module.exports = router;
