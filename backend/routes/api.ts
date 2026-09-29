import { Router } from 'express';
import { authenticateJwt, requireRoles } from '../middleware/auth.js';
import * as authCtrl from '../controllers/authController.js';
import * as dashCtrl from '../controllers/dashboardController.js';
import * as acadCtrl from '../controllers/academicController.js';
import * as admitCtrl from '../controllers/admissionController.js';
import * as studCtrl from '../controllers/studentController.js';
import * as feeCtrl from '../controllers/feeController.js';
import * as payCtrl from '../controllers/paymentController.js';
import * as rcptCtrl from '../controllers/receiptController.js';
import * as repCtrl from '../controllers/reportController.js';
import * as sysCtrl from '../controllers/systemControllers.js';

const router = Router();

// -------------------------------------------------------------
// Auth
// -------------------------------------------------------------
router.post('/auth/login', authCtrl.login);
router.get('/auth/me', authenticateJwt, authCtrl.getMe);
router.post('/auth/refresh', authCtrl.refreshToken);
router.post('/auth/change-password', authenticateJwt, authCtrl.changePassword);

// -------------------------------------------------------------
// Dashboard
// -------------------------------------------------------------
router.get('/dashboard/stats', authenticateJwt, dashCtrl.getDashboardStats);

// -------------------------------------------------------------
// Academic Structure (Years / Sessions, Classes, Sections)
// -------------------------------------------------------------
router.get('/academic-years', authenticateJwt, acadCtrl.getAcademicYears);
router.post('/academic-years', authenticateJwt, requireRoles(['SUPER_ADMIN', 'PRINCIPAL']), acadCtrl.createAcademicYear);
router.put('/academic-years/:id', authenticateJwt, requireRoles(['SUPER_ADMIN', 'PRINCIPAL', 'ADMISSION_STAFF']), acadCtrl.updateAcademicYear);
router.put('/academic-years/:id/activate', authenticateJwt, requireRoles(['SUPER_ADMIN', 'PRINCIPAL']), acadCtrl.activateAcademicYear);
router.put('/academic-years/:id/admission-status', authenticateJwt, requireRoles(['SUPER_ADMIN', 'PRINCIPAL', 'ADMISSION_STAFF']), acadCtrl.toggleAdmissionStatus);
router.get('/academic-years/:id/students', authenticateJwt, acadCtrl.getSessionStudents);
router.post('/academic-years/promote', authenticateJwt, requireRoles(['SUPER_ADMIN', 'PRINCIPAL', 'ADMISSION_STAFF']), acadCtrl.promoteStudents);

router.get('/classes', authenticateJwt, acadCtrl.getClasses);
router.post('/classes', authenticateJwt, requireRoles(['SUPER_ADMIN', 'PRINCIPAL']), acadCtrl.createClass);
router.post('/classes/:classId/sections', authenticateJwt, requireRoles(['SUPER_ADMIN', 'PRINCIPAL']), acadCtrl.createSection);

// -------------------------------------------------------------
// Admissions & Students
// -------------------------------------------------------------
router.post('/admissions', authenticateJwt, requireRoles(['SUPER_ADMIN', 'PRINCIPAL', 'ADMISSION_STAFF']), admitCtrl.processAdmission);

router.get('/students', authenticateJwt, studCtrl.getStudents);
router.get('/students/:id', authenticateJwt, studCtrl.getStudentById);
router.put('/students/:id', authenticateJwt, requireRoles(['SUPER_ADMIN', 'PRINCIPAL', 'ADMISSION_STAFF']), studCtrl.updateStudent);
router.put('/students/:id/status', authenticateJwt, requireRoles(['SUPER_ADMIN', 'PRINCIPAL']), studCtrl.updateStudentStatus);

// -------------------------------------------------------------
// Fee Management
// -------------------------------------------------------------
router.get('/fee-types', authenticateJwt, feeCtrl.getFeeTypes);
router.post('/fee-types', authenticateJwt, requireRoles(['SUPER_ADMIN', 'ACCOUNTANT']), feeCtrl.createFeeType);

router.get('/fee-structures', authenticateJwt, feeCtrl.getFeeStructures);
router.post('/fee-structures', authenticateJwt, requireRoles(['SUPER_ADMIN', 'ACCOUNTANT']), feeCtrl.createFeeStructure);

router.post('/fees/generate-monthly', authenticateJwt, requireRoles(['SUPER_ADMIN', 'ACCOUNTANT']), feeCtrl.generateMonthlyFees);
router.get('/fees/pending', authenticateJwt, feeCtrl.getPendingFees);

// -------------------------------------------------------------
// Payments & Online Gateway
// -------------------------------------------------------------
router.post('/payments', authenticateJwt, requireRoles(['SUPER_ADMIN', 'PRINCIPAL', 'ACCOUNTANT']), payCtrl.collectPayment);
router.get('/payments', authenticateJwt, payCtrl.getPayments);

// Online payment initiation & verification
router.post('/payments/online/create-order', payCtrl.createRazorpayOrder);
router.post('/payments/online/verify', payCtrl.verifyRazorpayPayment);

// -------------------------------------------------------------
// Receipts & PDF & Email
// -------------------------------------------------------------
router.get('/receipts/:id', authenticateJwt, rcptCtrl.getReceiptById);
router.get('/receipts/:id/pdf', rcptCtrl.getReceiptPdf); // public or token-based download
router.post('/receipts/:id/email', authenticateJwt, rcptCtrl.emailReceipt);

// -------------------------------------------------------------
// Reports
// -------------------------------------------------------------
router.get('/reports/daily-collection', authenticateJwt, repCtrl.getDailyCollectionReport);
router.get('/reports/monthly-collection', authenticateJwt, repCtrl.getMonthlyCollectionReport);
router.get('/reports/class-wise-collection', authenticateJwt, repCtrl.getClassWiseCollectionReport);

// -------------------------------------------------------------
// Staff, Settings, Notifications, Audit
// -------------------------------------------------------------
router.get('/staff', authenticateJwt, requireRoles(['SUPER_ADMIN']), sysCtrl.getStaffList);
router.post('/staff', authenticateJwt, requireRoles(['SUPER_ADMIN']), sysCtrl.createStaff);
router.put('/staff/:id/status', authenticateJwt, requireRoles(['SUPER_ADMIN']), sysCtrl.toggleStaffStatus);
router.put('/staff/:id/reset-password', authenticateJwt, requireRoles(['SUPER_ADMIN']), sysCtrl.resetStaffPassword);

router.get('/settings', authenticateJwt, sysCtrl.getSettings);
router.put('/settings', authenticateJwt, requireRoles(['SUPER_ADMIN']), sysCtrl.updateSettings);

router.get('/notifications', authenticateJwt, sysCtrl.getNotifications);
router.post('/notifications/mark-read', authenticateJwt, sysCtrl.markNotificationsRead);

router.get('/audit-logs', authenticateJwt, requireRoles(['SUPER_ADMIN']), sysCtrl.getAuditLogs);

export default router;
