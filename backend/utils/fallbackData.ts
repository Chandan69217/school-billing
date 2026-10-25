// Fallback data and in-memory store for when external cloud PostgreSQL is unreachable

export interface FallbackUser {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'PRINCIPAL' | 'ACCOUNTANT' | 'ADMISSION_STAFF' | 'STAFF';
  passwordHash: string;
  isActive: boolean;
}

export const ALL_PERMISSIONS_CATALOG = [
  { code: 'student.create', name: 'Register Student', module: 'Student Management', description: 'Create and intake new student registrations' },
  { code: 'student.edit', name: 'Edit Student', module: 'Student Management', description: 'Update student profiles, particulars, and documents' },
  { code: 'student.view', name: 'View Students', module: 'Student Management', description: 'Search and view student profiles and directories' },
  { code: 'student.deactivate', name: 'Deactivate / Mark Left', module: 'Student Management', description: 'Mark students as left or deactivated' },
  { code: 'student.promote', name: 'Bulk Promotion', module: 'Student Management', description: 'Promote students to next class at year-end' },
  { code: 'student.hostel.edit', name: 'Change Hostel Status', module: 'Student Management', description: 'Toggle hostel residency effective from chosen month' },
  { code: 'admission.manage', name: 'Manage Admissions', module: 'Admissions', description: 'Intake and process new admissions with bills' },
  { code: 'admission.view', name: 'View Admissions', module: 'Admissions', description: 'View admission applications and logs' },
  { code: 'fee.structure.manage', name: 'Manage Fee Structure', module: 'Fee Structure', description: 'Director-only tariff, component, and academic year editor' },
  { code: 'fee.view', name: 'View Fees', module: 'Fee Structure', description: 'View class fees and tariffs' },
  { code: 'fee.collect', name: 'Collect Fees', module: 'Billing', description: 'Collect advance, monthly, and partial fee payments' },
  { code: 'discount.apply', name: 'Apply Discounts', module: 'Billing', description: 'Apply configured concession rules to student accounts' },
  { code: 'discount.approve', name: 'Approve Discounts', module: 'Billing', description: 'Approve pending discount applications' },
  { code: 'customfee.request', name: 'Request Custom Fee', module: 'Fee Structure', description: 'Enter discretionary fees for unconfigured classes' },
  { code: 'customfee.approve', name: 'Approve Custom Fee', module: 'Fee Structure', description: 'Approve custom discretionary fees' },
  { code: 'receipt.print', name: 'Print Receipts', module: 'Receipts', description: 'Print newly generated receipts' },
  { code: 'receipt.reprint', name: 'Reprint Receipts (Duplicate)', module: 'Receipts', description: 'Reprint duplicate copies of past receipts' },
  { code: 'payment.cancel', name: 'Cancel Payment', module: 'Billing', description: 'Cancel existing payments with mandatory reason' },
  { code: 'payment.edit', name: 'Edit Payment', module: 'Billing', description: 'Edit notes or references of payment records' },
  { code: 'due.view', name: 'View & Export Dues', module: 'Dues', description: 'View student-wise and class-wise dues and export' },
  { code: 'report.view', name: 'View & Export Reports', module: 'Reports', description: 'Access daily, monthly, class-wise, fee-head collection reports' },
  { code: 'user.manage', name: 'Manage Users & Staff', module: 'Administration', description: 'Create users, assign roles, reset passwords, deactivate' },
  { code: 'roles.manage', name: 'Manage Permissions', module: 'Administration', description: 'Configure role-based dynamic permission matrix' },
  { code: 'settings.manage', name: 'School Settings', module: 'Administration', description: 'Configure school profile, logo, late fees, receipt prefix' },
  { code: 'backup.manage', name: 'Backup & Restore', module: 'Administration', description: 'Perform one-click database export and restore' },
  { code: 'audit.view', name: 'View Audit Logs', module: 'Administration', description: 'Inspect audit trail of all changes' },
  { code: 'session.archive', name: 'Archive / Unarchive Sessions', module: 'Administration', description: 'Archive past sessions and restore archived sessions' },
  { code: 'session.export', name: 'Export Session Register', module: 'Administration', description: 'Export session enrollment lists and session summaries to Excel CSV' },
  { code: 'student.status.change', name: 'Change Student Status', module: 'Students', description: 'Mark students as Active, Inactive, Withdrawn, or Cancelled' },
  { code: 'fee.waive', name: 'Waive Fee Dues', module: 'Billing', description: 'Waive outstanding fee heads upon withdrawal/cancellation' },
  { code: 'slc.generate', name: 'Generate SLC', module: 'Students', description: 'Issue official School Leaving Certificate on withdrawal/cancellation' },
  { code: 'slc.reprint', name: 'Reprint SLC (Duplicate)', module: 'Students', description: 'Reprint duplicate copies of official School Leaving Certificate' },
  { code: 'sensitive.view', name: 'View Sensitive Data', module: 'Administration', description: 'View unmasked Aadhaar numbers and sensitive particulars' },
];

export const FALLBACK_USERS: FallbackUser[] = [

];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ['*'],
  PRINCIPAL: [
    'student.view', 'admission.view', 'fee.view',
    'discount.approve', 'customfee.approve', 'due.view', 'report.view',
    'session.archive', 'session.export', 'student.status.change', 'fee.waive', 'slc.generate', 'slc.reprint', 'sensitive.view'
  ],
  ACCOUNTANT: [
    'student.view', 'fee.collect', 'fee.view', 'receipt.print',
    'receipt.reprint', 'discount.apply', 'due.view', 'report.view',
    'session.export', 'fee.waive', 'slc.reprint'
  ],
  ADMISSION_STAFF: [
    'student.create', 'student.edit', 'student.view', 'admission.manage',
    'admission.view', 'fee.collect', 'fee.view', 'receipt.print', 'receipt.reprint', 'due.view', 'customfee.request',
    'session.export', 'student.status.change', 'slc.generate', 'slc.reprint'
  ],
  STAFF: [
    'student.view', 'fee.view'
  ]
};

export function getDefaultPermissionsForRole(role: string): string[] {
  return DEFAULT_ROLE_PERMISSIONS[role] || [];
}

export const FALLBACK_CLASSES = [
  { id: 'cls-1', name: 'Nursery', orderNumber: 1 },
  { id: 'cls-2', name: 'LKG', orderNumber: 2 },
  { id: 'cls-3', name: 'UKG', orderNumber: 3 },
  { id: 'cls-4', name: 'Class I', orderNumber: 4 },
  { id: 'cls-5', name: 'Class II', orderNumber: 5 },
  { id: 'cls-6', name: 'Class III', orderNumber: 6 },
  { id: 'cls-7', name: 'Class IV', orderNumber: 7 },
  { id: 'cls-8', name: 'Class V', orderNumber: 8 },
  { id: 'cls-9', name: 'Class VI', orderNumber: 9 },
  { id: 'cls-10', name: 'Class VII', orderNumber: 10 },
  { id: 'cls-11', name: 'Class VIII', orderNumber: 11 },
  { id: 'cls-12', name: 'Class IX', orderNumber: 12 },
  { id: 'cls-13', name: 'Class X', orderNumber: 13 },
  { id: 'cls-14', name: 'Class XI', orderNumber: 14 },
  { id: 'cls-15', name: 'Class XII', orderNumber: 15 },
];

export const FALLBACK_FEE_RATES: Record<string, { tuition: number; computer: number; prospectus: number; admission: number; termFee: number }> = {
  'Nursery':   { tuition: 0, computer: 0,   prospectus: 0, admission: 0,    termFee: 0 },
  'LKG':       { tuition: 0, computer: 0,   prospectus: 0, admission: 0, termFee: 0 },
  'UKG':       { tuition: 0, computer: 0,   prospectus: 0, admission: 0, termFee: 0 },
  'Class I':   { tuition: 0, computer: 0,   prospectus: 0, admission: 0, termFee: 0 },
  'Class II':  { tuition: 0, computer: 0,   prospectus: 0, admission: 0, termFee: 0 },
  'Class III': { tuition: 0, computer: 0, prospectus: 0, admission: 0, termFee: 0 },
  'Class IV':  { tuition: 0, computer: 0, prospectus: 0, admission: 0, termFee: 0 },
  'Class V':   { tuition: 0, computer: 0, prospectus: 0, admission: 0, termFee: 0 },
  'Class VI':  { tuition: 0, computer: 0, prospectus: 0, admission: 0, termFee: 0 },
  'Class VII': { tuition: 0, computer: 0, prospectus: 0, admission: 0, termFee: 0 },
  'Class VIII':{ tuition: 0, computer: 0, prospectus: 0, admission: 0, termFee: 0 },
  'Class IX':  { tuition: 0, computer: 0, prospectus: 0, admission: 0, termFee: 0 },
  'Class X':   { tuition: 0, computer: 0, prospectus: 0,   admission: 0,    termFee: 0 },
  'Class XI':  { tuition: 0,    computer: 0,   prospectus: 1000,admission: 0,    termFee: 0 },
  'Class XII': { tuition: 0,    computer: 0,   prospectus: 0,   admission: 0,    termFee: 0 },
};
