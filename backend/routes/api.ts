import { Router } from 'express';
import { authenticateJwt, requirePermission } from '../middleware/auth.js';
import { documentUpload, photoUpload } from '../middleware/upload.js';
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

// =============================================================
// Auth
// =============================================================
router.post('/auth/login', authCtrl.login);
router.get('/auth/me', authenticateJwt, authCtrl.getMe);
router.post('/auth/refresh', authCtrl.refreshToken);
router.post('/auth/change-password', authenticateJwt, authCtrl.changePassword);

// =============================================================
// Dashboard
// =============================================================
router.get('/dashboard/stats', authenticateJwt, dashCtrl.getDashboardStats);

// =============================================================
// Roles & Dynamic Permissions Matrix (Director only)
// =============================================================
router.get('/roles/permissions', authenticateJwt, requirePermission('roles.manage'), sysCtrl.getRolePermissions);
router.put('/roles/permissions', authenticateJwt, requirePermission('roles.manage'), sysCtrl.updateRolePermissions);

// =============================================================
// Academic Sessions & Classes
// =============================================================
router.get('/academic-years', authenticateJwt, acadCtrl.getAcademicYears);
router.get('/academic-years/export/csv', authenticateJwt, requirePermission('session.export'), acadCtrl.exportSessionsCsv);
router.post('/academic-years', authenticateJwt, requirePermission('settings.manage'), acadCtrl.createAcademicYear);
router.put('/academic-years/:id', authenticateJwt, requirePermission('settings.manage'), acadCtrl.updateAcademicYear);
router.put('/academic-years/:id/activate', authenticateJwt, requirePermission('settings.manage'), acadCtrl.activateAcademicYear);
router.post('/academic-years/:id/archive', authenticateJwt, requirePermission('session.archive'), acadCtrl.archiveAcademicYear);
router.post('/academic-years/:id/unarchive', authenticateJwt, requirePermission('session.archive'), acadCtrl.unarchiveAcademicYear);
router.get('/academic-years/:id/archive-details', authenticateJwt, requirePermission('session.archive'), acadCtrl.getSessionArchiveDetails);
router.put('/academic-years/:id/admission-status', authenticateJwt, requirePermission('admission.manage'), acadCtrl.toggleAdmissionStatus);
router.get('/academic-years/:id/students', authenticateJwt, acadCtrl.getSessionStudents);
router.post('/academic-years/promote', authenticateJwt, requirePermission('student.promote'), acadCtrl.promoteStudents);

router.get('/classes', authenticateJwt, acadCtrl.getClasses);
router.post('/classes', authenticateJwt, requirePermission('settings.manage'), acadCtrl.createClass);
router.post('/classes/:classId/sections', authenticateJwt, requirePermission('settings.manage'), acadCtrl.createSection);

// =============================================================
// Admissions & Students
// =============================================================
router.post('/admissions', authenticateJwt, requirePermission('admission.manage'), admitCtrl.processAdmission);
router.post('/admissions/upload-photo', authenticateJwt, photoUpload.single('photo') as any, admitCtrl.uploadPhoto);
router.post('/admissions/upload-document', authenticateJwt, documentUpload.single('file') as any, admitCtrl.uploadDocument);
router.post('/admissions/:id/cancel', authenticateJwt, requirePermission('admission.manage'), admitCtrl.cancelAdmission);
router.get('/admissions/:id/pdf', admitCtrl.getAdmissionPdf);

// Student Dues, Status & SLC
router.get('/students', authenticateJwt, requirePermission('student.view'), studCtrl.getStudents);
router.get('/students/:id', authenticateJwt, requirePermission('student.view'), studCtrl.getStudentById);
router.get('/students/:id/dues', authenticateJwt, admitCtrl.getStudentDues);
router.get('/students/:id/slc', authenticateJwt, admitCtrl.getStudentSlc);
router.get('/students/:id/admission-pdf', admitCtrl.getAdmissionPdf);
router.post('/students/:id/documents', authenticateJwt, documentUpload.single('file') as any, studCtrl.addStudentDocument);
router.put('/students/:id', authenticateJwt, requirePermission('student.edit'), studCtrl.updateStudent);
router.put('/students/:id/status', authenticateJwt, requirePermission('student.status.change'), studCtrl.updateStudentStatus);
router.post('/students/:id/cancel-admission', authenticateJwt, requirePermission('admission.manage'), admitCtrl.cancelAdmission);
router.put('/students/:id/cancel-admission', authenticateJwt, requirePermission('admission.manage'), admitCtrl.cancelAdmission);

// School Leaving Certificate (SLC) reprint and PDF
router.post('/slc/:slcId/reprint', authenticateJwt, requirePermission('slc.reprint'), admitCtrl.recordSlcReprint);
router.get('/slc/:slcId/pdf', admitCtrl.getSlcPdf);

// =============================================================
// Dynamic Fee Structure & Billing Calculation
// =============================================================
router.get('/fee-types', authenticateJwt, requirePermission('fee.view'), feeCtrl.getFeeTypes);
router.post('/fee-types', authenticateJwt, requirePermission('fee.structure.manage'), feeCtrl.createFeeType);

router.get('/fee-structures', authenticateJwt, requirePermission('fee.view'), feeCtrl.getFeeStructures);
router.post('/fee-structures', authenticateJwt, requirePermission('fee.structure.manage'), feeCtrl.createFeeStructure);
router.post('/fee-structures/copy-previous', authenticateJwt, requirePermission('fee.structure.manage'), feeCtrl.copyFeeStructureFromPreviousYear);

router.post('/fees/admission-bill', authenticateJwt, feeCtrl.calculateAdmissionBill);
router.get('/fees/student-bill/:studentId', authenticateJwt, requirePermission('fee.view'), feeCtrl.getStudentBill);
router.post('/fees/generate-monthly', authenticateJwt, requirePermission('fee.structure.manage'), feeCtrl.generateMonthlyFees);
router.get('/fees/pending', authenticateJwt, requirePermission('due.view'), feeCtrl.getPendingFees);

// Discounts
router.get('/discounts/rules', authenticateJwt, feeCtrl.getDiscountRules);
router.post('/discounts/rules', authenticateJwt, requirePermission('fee.structure.manage'), feeCtrl.createDiscountRule);
router.get('/discounts/pending', authenticateJwt, requirePermission('discount.approve'), feeCtrl.getPendingDiscountRequests);
router.put('/discounts/requests/:id', authenticateJwt, requirePermission('discount.approve'), feeCtrl.approveDiscountRequest);

// Custom Fee Requests
router.post('/fees/custom-requests', authenticateJwt, requirePermission('customfee.manage'), feeCtrl.requestCustomFee);
router.get('/fees/custom-requests', authenticateJwt, requirePermission('customfee.approve'), feeCtrl.getCustomFeeRequests);
router.put('/fees/custom-requests/:id', authenticateJwt, requirePermission('customfee.approve'), feeCtrl.approveCustomFeeRequest);

// =============================================================
// Payments
// =============================================================
router.post('/payments', authenticateJwt, requirePermission('fee.collect'), payCtrl.collectPayment);
router.get('/payments', authenticateJwt, requirePermission('fee.view'), payCtrl.getPayments);
router.put('/payments/:id/cancel', authenticateJwt, requirePermission('payment.cancel'), payCtrl.cancelPayment);

// Online payment initiation & verification
router.post('/payments/online/create-order', payCtrl.createRazorpayOrder);
router.post('/payments/online/verify', payCtrl.verifyRazorpayPayment);

// =============================================================
// Receipts
// =============================================================
router.get('/receipts', authenticateJwt, requirePermission('receipt.print'), rcptCtrl.getReceipts);
router.get('/receipts/:id', authenticateJwt, requirePermission('receipt.print'), rcptCtrl.getReceiptById);
router.post('/receipts/:id/reprint', authenticateJwt, requirePermission('receipt.reprint'), rcptCtrl.recordReprint);
router.get('/receipts/:id/pdf', rcptCtrl.getReceiptPdf);
router.post('/receipts/:id/email', authenticateJwt, rcptCtrl.emailReceipt);

// =============================================================
// Reports (8 SRS Reports)
// =============================================================
router.get('/reports/daily-collection', authenticateJwt, requirePermission('report.view'), repCtrl.getDailyCollectionReport);
router.get('/reports/monthly-collection', authenticateJwt, requirePermission('report.view'), repCtrl.getMonthlyCollectionReport);
router.get('/reports/class-wise-collection', authenticateJwt, requirePermission('report.view'), repCtrl.getClassWiseCollectionReport);
router.get('/reports/fee-head-wise', authenticateJwt, requirePermission('report.view'), repCtrl.getFeeHeadWiseReport);
router.get('/reports/hostel', authenticateJwt, requirePermission('report.view'), repCtrl.getHostelReport);
router.get('/reports/discounts', authenticateJwt, requirePermission('report.view'), repCtrl.getDiscountReport);
router.get('/reports/user-wise', authenticateJwt, requirePermission('report.view'), repCtrl.getUserWiseCollectionReport);
router.get('/reports/student-ledger/:studentId', authenticateJwt, requirePermission('report.view'), repCtrl.getStudentLedger);
router.get('/reports/cancelled-payments', authenticateJwt, requirePermission('report.view'), repCtrl.getCancelledPaymentsReport);

// =============================================================
// Staff, Settings, Backup & Audit
// =============================================================
router.get('/staff', authenticateJwt, requirePermission('user.manage'), sysCtrl.getStaffList);
router.post('/staff', authenticateJwt, requirePermission('user.manage'), sysCtrl.createStaff);
router.put('/staff/:id/status', authenticateJwt, requirePermission('user.manage'), sysCtrl.toggleStaffStatus);
router.put('/staff/:id/reset-password', authenticateJwt, requirePermission('user.manage'), sysCtrl.resetStaffPassword);

router.get('/settings', authenticateJwt, sysCtrl.getSettings);
router.put('/settings', authenticateJwt, requirePermission('settings.manage'), sysCtrl.updateSettings);

router.get('/backup/export', authenticateJwt, requirePermission('backup.manage'), sysCtrl.exportBackup);
router.post('/backup/restore', authenticateJwt, requirePermission('backup.manage'), sysCtrl.restoreBackup);

router.get('/notifications', authenticateJwt, sysCtrl.getNotifications);
router.post('/notifications/mark-read', authenticateJwt, sysCtrl.markNotificationsRead);
router.get('/audit-logs', authenticateJwt, requirePermission('audit.view'), sysCtrl.getAuditLogs);

export default router;
