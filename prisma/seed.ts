import { PrismaClient, RoleType, Gender, StudentStatus, FeeFrequency, FeeStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export const ALL_PERMISSIONS = [
  { code: 'student.view', name: 'View Students', module: 'Students', description: 'View student profiles, details and lists' },
  { code: 'student.create', name: 'Register Student', module: 'Students', description: 'Register new students in admission and enrollment' },
  { code: 'student.edit', name: 'Edit Student Details', module: 'Students', description: 'Modify student profile, parent details, hostel status' },
  { code: 'student.delete', name: 'Deactivate / Mark Left', module: 'Students', description: 'Deactivate or mark student as withdrawn' },
  { code: 'student.promote', name: 'Promote Students', module: 'Students', description: 'Perform year-end bulk student promotion' },
  { code: 'admission.manage', name: 'Process Admissions', module: 'Admissions', description: 'Create and process new admissions' },
  { code: 'admission.view', name: 'View Admissions', module: 'Admissions', description: 'View admission applications and details' },
  { code: 'fee.collect', name: 'Collect Fees', module: 'Billing', description: 'Collect fees, part payments, multi-month payments' },
  { code: 'fee.view', name: 'View Fee Information', module: 'Billing', description: 'View student fee accounts, history and dues' },
  { code: 'fee.structure.manage', name: 'Manage Fee Structure', module: 'Fee Structure', description: 'Add, edit, deactivate class fee structures and heads' },
  { code: 'discount.apply', name: 'Apply Discounts', module: 'Discounts', description: 'Apply sibling, staff, scholarship discounts' },
  { code: 'discount.approve', name: 'Approve Discounts', module: 'Discounts', description: 'Approve or reject discount applications' },
  { code: 'customfee.manage', name: 'Request Custom Fee', module: 'Fee Structure', description: 'Enter custom fee at director discretion' },
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
  // Transport Module Permissions
  { code: 'transport.manage', name: 'Manage Transport Masters', module: 'Transport', description: 'Create and configure bus routes, stops, vehicle details, and pricing modes' },
  { code: 'transport.assign', name: 'Assign Student Transport', module: 'Transport', description: 'Assign routes and stops to students, change stops, and stop transport service' },
  // Store / Books & Uniform Permissions
  { code: 'store.manage', name: 'Manage Store Items & Stock', module: 'Store', description: 'Create items, book kits, uniform sizes, pricing, and stock adjustments' },
  { code: 'store.sell', name: 'Sell Books & Uniform', module: 'Store', description: 'Process counter sales of books and uniforms, generate BU receipts' },
  { code: 'store.return', name: 'Process Store Returns', module: 'Store', description: 'Process sales returns and exchanges, reverse stock with mandatory reasons' },
  { code: 'store.oversell', name: 'Allow Store Oversell', module: 'Store', description: 'Sell items beyond currently available stock count when tracking is enabled' },
  // Discount Engine Permissions
  { code: 'discount.manage', name: 'Manage Discount Rules', module: 'Discounts', description: 'Create and configure concession rules, categories, caps, and stacking' },
  { code: 'discount.assign', name: 'Assign Discounts', module: 'Discounts', description: 'Assign concessions to students, link siblings, and end active assignments' },
  { code: 'discount.manual', name: 'Counter Manual Discount', module: 'Discounts', description: 'Apply manual discretionary discounts at the billing counter up to max limit' },
  { code: 'discount.delete', name: 'Delete / Archive Discount Rules', module: 'Discounts', description: 'Permanently delete unused discount rules or soft-archive rules with audit logs' },
];

async function main() {
  console.log('🌱 Starting database seeding for Pragya Bharti Public School (PBPS)...');

  // 1. Seed Permissions Catalog
  for (const perm of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: { name: perm.name, module: perm.module, description: perm.description },
      create: perm,
    });
  }
  console.log('✅ Permissions catalog seeded');

  // 2. Seed Default Dynamic Role Permissions
  const defaultRolePermissions: Record<RoleType, string[]> = {
    SUPER_ADMIN: ALL_PERMISSIONS.map(p => p.code),
    PRINCIPAL: [
      'student.view', 'admission.view', 'fee.view',
      'discount.approve', 'customfee.approve', 'due.view', 'report.view',
      'session.archive', 'session.export', 'student.status.change', 'fee.waive', 'slc.generate', 'slc.reprint', 'sensitive.view',
      'transport.manage', 'transport.assign', 'store.manage', 'store.sell', 'store.return', 'store.oversell',
      'discount.manage', 'discount.assign', 'discount.manual', 'discount.delete'
    ],
    ACCOUNTANT: [
      'student.view', 'fee.collect', 'fee.view', 'receipt.print',
      'receipt.reprint', 'discount.apply', 'due.view', 'report.view',
      'session.export', 'fee.waive', 'slc.reprint',
      'transport.assign', 'store.sell', 'store.return', 'discount.assign', 'discount.manual'
    ],
    ADMISSION_STAFF: [
      'student.create', 'student.edit', 'student.view', 'admission.manage',
      'admission.view', 'fee.collect', 'fee.view', 'receipt.print', 'receipt.reprint', 'due.view',
      'session.export', 'student.status.change', 'slc.generate', 'slc.reprint',
      'transport.assign', 'discount.assign'
    ],
    STAFF: ['student.view', 'fee.view']
  };

  for (const [role, codes] of Object.entries(defaultRolePermissions)) {
    for (const code of codes) {
      await prisma.rolePermission.upsert({
        where: { role_permissionCode: { role: role as RoleType, permissionCode: code } },
        update: {},
        create: { role: role as RoleType, permissionCode: code },
      });
    }
  }
  console.log('✅ Role permissions matrix initialized');

  // 3. School Settings
  await prisma.schoolSettings.upsert({
    where: { id: 'default' },
    update: {
      schoolName: 'Pragya Bharti Public School',
      tagline: 'Knowledge, Character & Excellence (PBPS)',
      email: 'admissions@pbps.edu.in',
      website: 'https://pbps.edu.in',
      registrationNumber: 'SCH-REG-2024-9981',
      principalName: 'Dr. V. K. Sharma, Principal',
      receiptFooter: 'This is a computer generated fee receipt. Pragya Bharti Public School (PBPS).',
      authorizedSignatory: 'Accounts Officer, PBPS',
      currencySymbol: '₹',
      receiptPrefix: 'PBPS',
      lateFeeEnabled: false, // Default DISABLED as per SRS
      lateFeeType: 'FIXED',
      lateFeeAmount: 0,
      lateFeeGraceDays: 10,
      requireDiscountApproval: false,
      requireCustomFeeApproval: true,
      paymentModes: 'Cash,UPI,Cheque,Bank Transfer,Card,Other'
    },
    create: {
      id: 'default',
      schoolName: 'Pragya Bharti Public School',
      tagline: 'Knowledge, Character & Excellence (PBPS)',
      logoUrl: '/assets/images/school-logo.png',
      address: 'Knowledge Park, Campus Road',
      phone: '+91 98765 43210',
      email: 'admissions@pbps.edu.in',
      website: 'https://pbps.edu.in',
      registrationNumber: 'SCH-REG-2024-9981',
      principalName: 'Dr. V. K. Sharma, Principal',
      receiptFooter: 'This is a computer generated fee receipt. Pragya Bharti Public School (PBPS).',
      authorizedSignatory: 'Accounts Officer, PBPS',
      currencySymbol: '₹',
      receiptPrefix: 'PBPS',
      lateFeeEnabled: false,
      lateFeeType: 'FIXED',
      lateFeeAmount: 0,
      lateFeeGraceDays: 10,
      requireDiscountApproval: false,
      requireCustomFeeApproval: true,
      paymentModes: 'Cash,UPI,Cheque,Bank Transfer,Card,Other'
    },
  });

  // 4. Default Users
  const defaultPassword = await bcrypt.hash('Admin@123', 10);
  const staffPassword = await bcrypt.hash('Staff@123', 10);

  // Director (SUPER_ADMIN)
  await prisma.user.upsert({
    where: { email: 'admin@greenwoodhigh.edu' },
    update: { role: RoleType.SUPER_ADMIN },
    create: {
      email: 'admin@greenwoodhigh.edu',
      username: 'superadmin',
      passwordHash: defaultPassword,
      fullName: 'Vikramaditya Rathore (Director)',
      phone: '+91 98111 22233',
      role: RoleType.SUPER_ADMIN,
      isActive: true,
    },
  });

  // Principal
  await prisma.user.upsert({
    where: { email: 'principal@greenwoodhigh.edu' },
    update: { role: RoleType.PRINCIPAL },
    create: {
      email: 'principal@greenwoodhigh.edu',
      username: 'principal',
      passwordHash: defaultPassword,
      fullName: 'Dr. Sunita Deshmukh (Principal)',
      phone: '+91 98222 33344',
      role: RoleType.PRINCIPAL,
      isActive: true,
    },
  });

  // Accountant
  await prisma.user.upsert({
    where: { email: 'accountant@greenwoodhigh.edu' },
    update: { role: RoleType.ACCOUNTANT },
    create: {
      email: 'accountant@greenwoodhigh.edu',
      username: 'accountant',
      passwordHash: defaultPassword,
      fullName: 'Rajesh K. Mehta (Accountant)',
      phone: '+91 98333 44455',
      role: RoleType.ACCOUNTANT,
      isActive: true,
    },
  });

  // Admission Staff
  await prisma.user.upsert({
    where: { email: 'admission@greenwoodhigh.edu' },
    update: { role: RoleType.ADMISSION_STAFF },
    create: {
      email: 'admission@greenwoodhigh.edu',
      username: 'admission_staff',
      passwordHash: staffPassword,
      fullName: 'Pooja Verma (Admission Staff)',
      phone: '+91 98444 55566',
      role: RoleType.ADMISSION_STAFF,
      isActive: true,
    },
  });

  // Regular Staff
  await prisma.user.upsert({
    where: { email: 'staff@greenwoodhigh.edu' },
    update: { role: RoleType.STAFF },
    create: {
      email: 'staff@greenwoodhigh.edu',
      username: 'staff_user',
      passwordHash: staffPassword,
      fullName: 'Arun Kumar (Teacher / Staff)',
      phone: '+91 98555 66677',
      role: RoleType.STAFF,
      isActive: true,
    },
  });
  console.log('✅ Users seeded with Director, Principal, Accountant, Admission Staff');

  // 5. Academic Sessions (2026-27 active, 2025-26 previous)
  const academicYear = await prisma.academicYear.upsert({
    where: { name: '2026-27' },
    update: { isActive: true },
    create: {
      name: '2026-27',
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2027-03-31T23:59:59.000Z'),
      isActive: true,
      isArchived: false,
      admissionStatus: 'OPEN',
      admissionPrefix: 'PBPS',
    },
  });

  await prisma.academicYear.upsert({
    where: { name: '2025-26' },
    update: { isActive: false },
    create: {
      name: '2025-26',
      startDate: new Date('2025-04-01T00:00:00.000Z'),
      endDate: new Date('2026-03-31T23:59:59.000Z'),
      isActive: false,
      isArchived: true,
      admissionStatus: 'CLOSED',
      admissionPrefix: 'PBPS-25',
    },
  });
  console.log('✅ Academic Years seeded: 2026-27 (Active)');

  // 6. Classes (exact SRS classes)
  const classList = [
    { name: 'Nursery', order: 1, desc: 'Pre-primary Nursery' },
    { name: 'LKG', order: 2, desc: 'Lower Kindergarten' },
    { name: 'UKG', order: 3, desc: 'Upper Kindergarten' },
    { name: 'Class I', order: 4, desc: 'Class 1' },
    { name: 'Class II', order: 5, desc: 'Class 2' },
    { name: 'Class III', order: 6, desc: 'Class 3 (Includes Computer Fee)' },
    { name: 'Class IV', order: 7, desc: 'Class 4 (Includes Computer Fee)' },
    { name: 'Class V', order: 8, desc: 'Class 5 (Includes Computer Fee)' },
    { name: 'Class VI', order: 9, desc: 'Class 6 (Includes Computer Fee)' },
    { name: 'Class VII', order: 10, desc: 'Class 7 (Includes Computer Fee)' },
    { name: 'Class VIII', order: 11, desc: 'Class 8 (Includes Computer Fee)' },
    { name: 'Class IX', order: 12, desc: 'Class 9 (Includes Computer Fee)' },
    { name: 'Class X', order: 13, desc: 'Class 10 (Includes Computer Fee)' },
    { name: 'Class XI', order: 14, desc: 'Senior Secondary - Non-attending' },
    { name: 'Class XII', order: 15, desc: 'Senior Secondary - Non-attending' },
  ];

  const createdClasses: Record<string, any> = {};
  for (const c of classList) {
    const cls = await prisma.class.upsert({
      where: { name: c.name },
      update: { orderNumber: c.order, description: c.desc },
      create: { name: c.name, orderNumber: c.order, description: c.desc },
    });
    createdClasses[c.name] = cls;

    // Sections A, B, C
    for (const sec of ['A', 'B', 'C']) {
      await prisma.section.upsert({
        where: { classId_name: { classId: cls.id, name: sec } },
        update: {},
        create: { name: sec, classId: cls.id, capacity: 40 },
      });
    }
  }
  console.log('✅ All SRS Classes & Sections created');

  // 7. Fee Types (Configurable heads)
  const feeTypes = [
    { name: 'Tuition Fee', code: 'TUIT', frequency: FeeFrequency.MONTHLY, description: 'Monthly tuition component' },
    { name: 'Computer Fee', code: 'COMP', frequency: FeeFrequency.MONTHLY, description: 'Computer lab fee (Rs.125 for Class III to X)' },
    { name: 'Prospectus Fee', code: 'PROS', frequency: FeeFrequency.ONE_TIME, description: 'One-time admission form / prospectus fee' },
    { name: 'Admission Charge', code: 'ADM', frequency: FeeFrequency.ONE_TIME, description: 'One-time admission charge for new admissions' },
    { name: 'Term Fee', code: 'TERM', frequency: FeeFrequency.ANNUAL, description: 'Payable twice a year in May and October (Rs.1350)' },
    { name: 'Hostel Fee', code: 'HOSTEL', frequency: FeeFrequency.MONTHLY, description: 'Recurring hostel and boarding charges' },
    { name: 'Transport Fee', code: 'TRANS', frequency: FeeFrequency.MONTHLY, description: 'Optional school bus route fee' },
    { name: 'Uniform Fee', code: 'UNIF', frequency: FeeFrequency.ONE_TIME, description: 'Optional school uniform set fee' },
    { name: 'Books Fee', code: 'BOOKS', frequency: FeeFrequency.ONE_TIME, description: 'Optional textbook and stationery kit' },
    { name: 'Exam Fee', code: 'EXAM', frequency: FeeFrequency.ANNUAL, description: 'Annual semester and evaluation fee' },
  ];

  const createdFeeTypes: Record<string, any> = {};
  for (const ft of feeTypes) {
    const res = await prisma.feeType.upsert({
      where: { code: ft.code },
      update: { name: ft.name, frequency: ft.frequency, description: ft.description },
      create: ft,
    });
    createdFeeTypes[ft.code] = res;
  }
  console.log('✅ Configurable Fee Heads created');

  // 8. Dynamic Fee Structure Matrix per SRS specification:
  // Tuition & Computer Fee amounts:
  // Nursery: 1190 tuition, 0 computer = 1190 monthly total; Prospectus: 700; Admission: 0; Term: 1350
  // LKG: 1290 tuition, 0 computer = 1290 monthly total; Prospectus: 700; Admission: 2000; Term: 1350
  // UKG: 1290 tuition, 0 computer = 1290 monthly total; Prospectus: 700; Admission: 2000; Term: 1350
  // Class I: 1390 tuition, 0 computer = 1390 monthly total; Prospectus: 700; Admission: 2000; Term: 1350
  // Class II: 1390 tuition, 0 computer = 1390 monthly total; Prospectus: 700; Admission: 2000; Term: 1350
  // Class III: 1490 tuition, 125 computer = 1615 monthly total; Prospectus: 700; Admission: 3000; Term: 1350
  // Class IV: 1490 tuition, 125 computer = 1615 monthly total; Prospectus: 700; Admission: 3000; Term: 1350
  // Class V: 1725 tuition, 125 computer = 1850 monthly total; Prospectus: 700; Admission: 3000; Term: 1350
  // Class VI: 1725 tuition, 125 computer = 1850 monthly total; Prospectus: 700; Admission: 3000; Term: 1350
  // Class VII: 1890 tuition, 125 computer = 2015 monthly total; Prospectus: 700; Admission: 5000; Term: 1350
  // Class VIII: 1925 tuition, 125 computer = 2050 monthly total; Prospectus: 700; Admission: 5000; Term: 1350
  // Class IX: 2390 tuition, 125 computer = 2515 monthly total; Prospectus: 700; Admission: 5000; Term: 1350
  // Class X: 2490 tuition, 125 computer = 2615 monthly total; Prospectus: 0; Admission: 0; Term: 1350
  // Class XI: 0 tuition, 0 computer; Prospectus: 1000; Admission: 0; Term: 1350
  // Class XII: 0 tuition, 0 computer; Prospectus: 0; Admission: 0; Term: 1350
  const srsFeeMatrix: Record<string, { tuition: number; computer: number; prospectus: number; admission: number; termFee: number; hostel: number }> = {
    'Nursery':   { tuition: 1190, computer: 0,   prospectus: 700,  admission: 0,    termFee: 1350, hostel: 0 },
    'LKG':       { tuition: 1290, computer: 0,   prospectus: 700,  admission: 2000, termFee: 1350, hostel: 0 },
    'UKG':       { tuition: 1290, computer: 0,   prospectus: 700,  admission: 2000, termFee: 1350, hostel: 0 },
    'Class I':   { tuition: 1390, computer: 0,   prospectus: 700,  admission: 2000, termFee: 1350, hostel: 0 },
    'Class II':  { tuition: 1390, computer: 0,   prospectus: 700,  admission: 2000, termFee: 1350, hostel: 0 },
    'Class III': { tuition: 1490, computer: 125, prospectus: 700,  admission: 3000, termFee: 1350, hostel: 0 },
    'Class IV':  { tuition: 1490, computer: 125, prospectus: 700,  admission: 3000, termFee: 1350, hostel: 0 },
    'Class V':   { tuition: 1725, computer: 125, prospectus: 700,  admission: 3000, termFee: 1350, hostel: 0 },
    'Class VI':  { tuition: 1725, computer: 125, prospectus: 700,  admission: 3000, termFee: 1350, hostel: 0 },
    'Class VII': { tuition: 1890, computer: 125, prospectus: 700,  admission: 5000, termFee: 1350, hostel: 0 },
    'Class VIII':{ tuition: 1925, computer: 125, prospectus: 700,  admission: 5000, termFee: 1350, hostel: 0 },
    'Class IX':  { tuition: 2390, computer: 125, prospectus: 700,  admission: 5000, termFee: 1350, hostel: 0 },
    'Class X':   { tuition: 2490, computer: 125, prospectus: 0,    admission: 0,    termFee: 1350, hostel: 0 },
    'Class XI':  { tuition: 0,    computer: 0,   prospectus: 1000, admission: 0,    termFee: 1350, hostel: 0 },
    'Class XII': { tuition: 0,    computer: 0,   prospectus: 0,    admission: 0,    termFee: 1350, hostel: 0 },
  };

  for (const [cName, fees] of Object.entries(srsFeeMatrix)) {
    const cls = createdClasses[cName];
    if (!cls) continue;

    // Total yearly estimate for structure
    const totalAmount = (fees.tuition + fees.computer) * 12 + fees.termFee * 2 + fees.admission + fees.prospectus;

    const struct = await prisma.feeStructure.upsert({
      where: { academicYearId_classId: { academicYearId: academicYear.id, classId: cls.id } },
      update: { totalAmount, title: `${cName} Fee Structure 2026-27` },
      create: {
        academicYearId: academicYear.id,
        classId: cls.id,
        title: `${cName} Fee Structure 2026-27`,
        totalAmount,
      },
    });

    await prisma.feeStructureItem.deleteMany({ where: { feeStructureId: struct.id } });

    const itemsToCreate = [];

    // Monthly Tuition
    if (fees.tuition > 0) {
      itemsToCreate.push({
        feeStructureId: struct.id,
        feeTypeId: createdFeeTypes['TUIT'].id,
        amount: fees.tuition,
        frequency: FeeFrequency.MONTHLY,
        appliesTo: 'ALL',
        componentName: 'Tuition Fee',
        isActive: true,
      });
    }

    // Computer Fee (Class III and above)
    if (fees.computer > 0) {
      itemsToCreate.push({
        feeStructureId: struct.id,
        feeTypeId: createdFeeTypes['COMP'].id,
        amount: fees.computer,
        frequency: FeeFrequency.MONTHLY,
        appliesTo: 'ALL',
        componentName: 'Computer Fee',
        isActive: true,
      });
    }

    // Prospectus Fee (One-time, new admission only)
    if (fees.prospectus > 0) {
      itemsToCreate.push({
        feeStructureId: struct.id,
        feeTypeId: createdFeeTypes['PROS'].id,
        amount: fees.prospectus,
        frequency: FeeFrequency.ONE_TIME,
        appliesTo: 'NEW_ADMISSION_ONLY',
        componentName: 'Prospectus Fee',
        isActive: true,
      });
    }

    // Admission Charge (One-time, new admission only)
    if (fees.admission >= 0) {
      itemsToCreate.push({
        feeStructureId: struct.id,
        feeTypeId: createdFeeTypes['ADM'].id,
        amount: fees.admission,
        frequency: FeeFrequency.ONE_TIME,
        appliesTo: 'NEW_ADMISSION_ONLY',
        componentName: 'Admission Charge',
        isActive: true,
      });
    }

    // Term Fee (Payable in May [month 5] and October [month 10])
    if (fees.termFee > 0) {
      itemsToCreate.push({
        feeStructureId: struct.id,
        feeTypeId: createdFeeTypes['TERM'].id,
        amount: fees.termFee,
        frequency: FeeFrequency.ANNUAL,
        dueMonths: '5,10', // May and October
        appliesTo: 'ALL',
        componentName: 'Term Fee',
        isActive: true,
      });
    }

    // Hostel Fee Head (Configured per class by Director, default 0 or class 8 sample)
    const hostelFeeAmount = cName === 'Class VIII' ? 3500 : 0;
    itemsToCreate.push({
      feeStructureId: struct.id,
      feeTypeId: createdFeeTypes['HOSTEL'].id,
      amount: hostelFeeAmount,
      frequency: FeeFrequency.MONTHLY,
      appliesTo: 'HOSTEL_ONLY',
      componentName: 'Hostel Fee',
      isActive: true,
    });

    for (const item of itemsToCreate) {
      await prisma.feeStructureItem.create({ data: item });
    }
  }
  console.log('✅ SRS Fee Structures created for all classes (Nursery to Class XII)');

  // 9. Discount Rules
  const discountRules = [
    { name: 'Sibling Concession', type: 'PERCENTAGE', value: 10, applicableFeeHeads: 'Tuition Fee', requiresApproval: false, description: '10% concession on tuition fee for younger sibling' },
    { name: 'Staff Child Benefit', type: 'PERCENTAGE', value: 25, applicableFeeHeads: 'Tuition Fee', requiresApproval: false, description: '25% concession on tuition fee for children of school employees' },
    { name: 'Merit Scholarship', type: 'PERCENTAGE', value: 50, applicableFeeHeads: 'Tuition Fee,Term Fee', requiresApproval: true, description: '50% academic merit waiver requires Principal/Director approval' },
    { name: 'Director Discretion Concession', type: 'FIXED', value: 1000, applicableFeeHeads: null, requiresApproval: true, description: 'Special discretionary relief approved by Director' },
  ];

  for (const dr of discountRules) {
    const existing = await prisma.discountRule.findFirst({ where: { name: dr.name } });
    if (!existing) {
      await prisma.discountRule.create({ data: dr });
    }
  }
  console.log('✅ Flexible Discount Rules initialized');

  // 10. Seed Sample Students with both Day Scholars and Hostel Students
  const sampleStudents = [
    {
      admissionNumber: 'PBPS-2026-0001',
      firstName: 'Aarav',
      lastName: 'Sharma',
      gender: Gender.MALE,
      dob: new Date('2013-05-14'),
      className: 'Class VIII',
      isHostel: true,
      hostelRoom: 'B-204',
      parentName: 'Rajesh Sharma',
      phone: '+91 98711 00221',
      email: 'rajesh.sharma@example.com',
    },
    {
      admissionNumber: 'PBPS-2026-0002',
      firstName: 'Ananya',
      lastName: 'Patel',
      gender: Gender.FEMALE,
      dob: new Date('2017-08-22'),
      className: 'Class IV',
      isHostel: false,
      parentName: 'Bhavesh Patel',
      phone: '+91 98722 00332',
      email: 'bhavesh.patel@example.com',
    },
    {
      admissionNumber: 'PBPS-2026-0003',
      firstName: 'Vihaan',
      lastName: 'Verma',
      gender: Gender.MALE,
      dob: new Date('2019-11-10'),
      className: 'Class II',
      isHostel: false,
      parentName: 'Sanjay Verma',
      phone: '+91 98733 00443',
      email: 'sanjay.verma@example.com',
    },
    {
      admissionNumber: 'PBPS-2026-0004',
      firstName: 'Diya',
      lastName: 'Reddy',
      gender: Gender.FEMALE,
      dob: new Date('2022-02-18'),
      className: 'Nursery',
      isHostel: false,
      parentName: 'K. V. Reddy',
      phone: '+91 98744 00554',
      email: 'kv.reddy@example.com',
    },
    {
      admissionNumber: 'PBPS-2026-0005',
      firstName: 'Rohan',
      lastName: 'Singh',
      gender: Gender.MALE,
      dob: new Date('2016-03-25'),
      className: 'Class V',
      isHostel: false,
      parentName: 'Manish Singh',
      phone: '+91 98755 00665',
      email: 'manish.singh@example.com',
    },
    {
      admissionNumber: 'PBPS-2026-0006',
      firstName: 'Ishaan',
      lastName: 'Gupta',
      gender: Gender.MALE,
      dob: new Date('2010-09-15'),
      className: 'Class XI',
      isHostel: false,
      isNonAttending: true,
      parentName: 'Sunil Gupta',
      phone: '+91 98766 00776',
      email: 'sunil.gupta@example.com',
    }
  ];

  for (const s of sampleStudents) {
    const cls = createdClasses[s.className];
    if (!cls) continue;

    const parent = await prisma.parent.upsert({
      where: { primaryPhone: s.phone },
      update: {},
      create: {
        fatherName: s.parentName,
        primaryPhone: s.phone,
        email: s.email,
        address: 'PBPS Campus Area, New Delhi',
      },
    });

    const student = await prisma.student.upsert({
      where: { admissionNumber: s.admissionNumber },
      update: {
        isHostelStudent: s.isHostel,
        hostelRoomNumber: s.hostelRoom || null,
        isNonAttending: !!(s as any).isNonAttending,
      },
      create: {
        admissionNumber: s.admissionNumber,
        firstName: s.firstName,
        lastName: s.lastName,
        dateOfBirth: s.dob,
        gender: s.gender,
        status: StudentStatus.ACTIVE,
        isHostelStudent: s.isHostel,
        hostelRoomNumber: s.hostelRoom || null,
        hostelAdmissionDate: s.isHostel ? new Date('2026-04-01') : null,
        isNonAttending: !!(s as any).isNonAttending,
        admissionDate: new Date('2026-04-01'),
        address: 'PBPS Campus Area, New Delhi',
        city: 'New Delhi',
        state: 'Delhi',
        pincode: '110001',
      },
    });

    await prisma.studentParent.upsert({
      where: { studentId_parentId: { studentId: student.id, parentId: parent.id } },
      update: {},
      create: {
        studentId: student.id,
        parentId: parent.id,
        relationship: 'Father',
        isPrimary: true,
      },
    });

    await prisma.studentAcademicRecord.upsert({
      where: { studentId_academicYearId: { studentId: student.id, academicYearId: academicYear.id } },
      update: {},
      create: {
        studentId: student.id,
        academicYearId: academicYear.id,
        classId: cls.id,
        rollNumber: `R-${student.admissionNumber.slice(-3)}`,
      },
    });
  }

  // 11. Seed Store Categories & Sample Items
  const storeCategories = [
    { name: 'Books', code: 'BOOKS', description: 'Curriculum textbooks and exercise workbooks' },
    { name: 'Uniform', code: 'UNIFORM', description: 'Official school uniform apparel and accessories' },
    { name: 'Stationery', code: 'STATIONERY', description: 'Notebooks, writing materials, and geometry boxes' },
    { name: 'Other', code: 'OTHER', description: 'Bags, water bottles, and supplementary school store items' }
  ];
  const createdCats: Record<string, any> = {};
  for (const cat of storeCategories) {
    createdCats[cat.code] = await prisma.storeCategory.upsert({
      where: { code: cat.code },
      update: { name: cat.name, description: cat.description },
      create: cat
    });
  }

  // Seed standard Uniform and Book Kit items
  if (createdCats['UNIFORM']) {
    await prisma.storeItem.upsert({
      where: { sku: 'UNIF-SHIRT-STD' },
      update: { price: 450, sizes: '28,30,32,34,36' },
      create: {
        sku: 'UNIF-SHIRT-STD',
        name: 'Shirt',
        categoryId: createdCats['UNIFORM'].id,
        sizes: '28,30,32,34,36',
        price: 450,
        costPrice: 280,
        trackStock: true,
        currentStock: 100,
        lowStockAlert: 10,
        applicableClasses: 'ALL'
      }
    });

    await prisma.storeItem.upsert({
      where: { sku: 'UNIF-TROUSER-STD' },
      update: { price: 550, sizes: '28,30,32,34,36' },
      create: {
        sku: 'UNIF-TROUSER-STD',
        name: 'Trousers',
        categoryId: createdCats['UNIFORM'].id,
        sizes: '28,30,32,34,36',
        price: 550,
        costPrice: 320,
        trackStock: true,
        currentStock: 80,
        lowStockAlert: 10,
        applicableClasses: 'ALL'
      }
    });
  }

  if (createdCats['BOOKS'] && createdClasses['Class V']) {
    await prisma.storeItem.upsert({
      where: { sku: 'BK-CL5-KIT' },
      update: { price: 2200 },
      create: {
        sku: 'BK-CL5-KIT',
        name: 'Class V Book Set',
        categoryId: createdCats['BOOKS'].id,
        isKit: true,
        price: 2200,
        costPrice: 1600,
        trackStock: true,
        currentStock: 60,
        lowStockAlert: 10,
        applicableClasses: createdClasses['Class V'].id
      }
    });
  }

  // 12. Seed Transport Routes & Stops
  const routeA = await prisma.transportRoute.upsert({
    where: { code: 'RT-A' },
    update: { name: 'Route A' },
    create: {
      code: 'RT-A',
      name: 'Route A',
      description: 'Main highway route covering Manpur, Buniadganj Chowk, and Campus Gate',
      vehicleNumber: 'BR-02-P-1234',
      driverName: 'Ramesh Singh',
      driverPhone: '+91 94304 42801',
      isActive: true
    }
  });

  await prisma.transportStop.upsert({
    where: { routeId_name: { routeId: routeA.id, name: 'Stop 1' } },
    update: { monthlyFee: 800, orderNumber: 1 },
    create: {
      routeId: routeA.id,
      name: 'Stop 1',
      orderNumber: 1,
      monthlyFee: 800,
      oneWayFee: 500,
      isActive: true
    }
  });

  await prisma.transportStop.upsert({
    where: { routeId_name: { routeId: routeA.id, name: 'Stop 2' } },
    update: { monthlyFee: 1000, orderNumber: 2 },
    create: {
      routeId: routeA.id,
      name: 'Stop 2',
      orderNumber: 2,
      monthlyFee: 1000,
      oneWayFee: 650,
      isActive: true
    }
  });

  console.log('✅ Sample Students seeded (Day Scholars & Hostel Students)');
  console.log('✅ Transport Routes, Stops, Store Categories & Items initialized');
  console.log('🎉 Seeding successfully finished!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
