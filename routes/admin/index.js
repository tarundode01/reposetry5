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
router.delete('/employees/:id', adminController.deleteEmployee);

// Leads
router.get('/leads', adminController.getAllLeads);
router.post('/leads', adminController.createLeadAdmin);
router.put('/leads/:id/assign', adminController.assignLead);

// Customers
router.get('/customers', adminController.getAllCustomers);

// Deals & Sales Pipeline
router.get('/deals', adminController.getAllDeals);
router.post('/deals', adminController.createDealAdmin);

// Approvals
router.get('/approvals', adminController.getAllApprovals);
router.put('/approvals/:id', adminController.updateApproval);

// Support
router.get('/tickets', adminController.getAllTickets);

module.exports = router;
