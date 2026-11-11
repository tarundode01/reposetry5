const express = require('express');
const router = express.Router();
const salesController = require('../../controllers/salesController');
const { protect } = require('../../middlewares/authMiddleware');

// Public Auth
router.post('/auth/login', salesController.employeeLogin);

// Protected Employee Routes
router.use(protect);

// Dashboard
router.get('/dashboard', salesController.getEmployeeDashboard);

// Leads
router.get('/leads', salesController.getLeads);
router.post('/leads', salesController.createLead);
router.put('/leads/:id/status', salesController.updateLeadStatus);

// Customers
router.get('/customers', salesController.getMyCustomers);

// Tasks
router.get('/tasks', salesController.getTasks);
router.post('/tasks', salesController.createTask);
router.put('/tasks/:id/status', salesController.updateTaskStatus);

// Follow-ups
router.get('/followups', salesController.getFollowups);
router.post('/followups', salesController.createFollowup);

// Calls
router.get('/calls', salesController.getCalls);
router.post('/calls', salesController.logCall);

// Attendance
router.get('/attendance/today', salesController.getTodayAttendance);
router.post('/attendance/checkin', salesController.checkIn);
router.post('/attendance/checkout', salesController.checkOut);

// Deals & Pipeline
router.get('/deals', salesController.getDeals);
router.post('/deals', salesController.createDeal);

// Meetings
router.get('/meetings', salesController.getMeetings);

// Quotations
router.get('/quotations', salesController.getQuotations);

// Activity Timeline
router.get('/timeline', salesController.getActivityTimeline);

// Approvals
router.get('/approvals', salesController.getApprovals);
router.post('/approvals', salesController.createApprovalRequest);

module.exports = router;
