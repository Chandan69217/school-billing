import { PrismaClient, RoleType, Gender, StudentStatus, FeeFrequency, FeeStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding for EduManage Pro...');

  // 1. School Settings
  await prisma.schoolSettings.upsert({
    where: { id: 'default' },
    update: {
      schoolName: 'Pragya Bharti Public School',
      tagline: 'Knowledge, Character & Excellence (PBPS)',
      email: 'admissions@pbps.edu.in',
      website: 'https://pbps.edu.in',
      receiptFooter: 'This is a computer generated fee receipt. Pragya Bharti Public School (PBPS).',
      principalName: 'Dr. V. K. Sharma, Principal',
      authorizedSignatory: 'Accounts Officer, PBPS',
    },
    create: {
      id: 'default',
      schoolName: 'Pragya Bharti Public School',
      tagline: 'Knowledge, Character & Excellence (PBPS)',
      logoUrl: '/school-logo.svg',
      address: 'Knowledge Park, Campus Road',
      phone: '+91 98765 43210',
      email: 'admissions@pbps.edu.in',
      website: 'https://pbps.edu.in',
      registrationNumber: 'SCH-REG-2024-9981',
      principalName: 'Dr. V. K. Sharma, Principal',
      receiptFooter: 'This is a computer generated fee receipt. Pragya Bharti Public School (PBPS).',
      authorizedSignatory: 'Accounts Officer, PBPS',
      currencySymbol: '₹',
    },
  });

  // 2. Users (Super Admin, Principal, Accountant, Admission Staff, Staff)
  const defaultPassword = await bcrypt.hash('Admin@123', 10);
  const staffPassword = await bcrypt.hash('Staff@123', 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@greenwoodhigh.edu' },
    update: {},
    create: {
      email: 'admin@greenwoodhigh.edu',
      username: 'superadmin',
      passwordHash: defaultPassword,
      fullName: 'Vikramaditya Rathore',
      phone: '+91 98111 22233',
      role: RoleType.SUPER_ADMIN,
      isActive: true,
    },
  });

  const principal = await prisma.user.upsert({
    where: { email: 'principal@greenwoodhigh.edu' },
    update: {},
    create: {
      email: 'principal@greenwoodhigh.edu',
      username: 'principal',
      passwordHash: defaultPassword,
      fullName: 'Dr. Sunita Deshmukh',
      phone: '+91 98222 33344',
      role: RoleType.PRINCIPAL,
      isActive: true,
    },
  });

  const accountant = await prisma.user.upsert({
    where: { email: 'accountant@greenwoodhigh.edu' },
    update: {},
    create: {
      email: 'accountant@greenwoodhigh.edu',
      username: 'accountant',
      passwordHash: defaultPassword,
      fullName: 'Rajesh K. Mehta',
      phone: '+91 98333 44455',
      role: RoleType.ACCOUNTANT,
      isActive: true,
    },
  });

  const admissionStaff = await prisma.user.upsert({
    where: { email: 'admission@greenwoodhigh.edu' },
    update: {},
    create: {
      email: 'admission@greenwoodhigh.edu',
      username: 'admission_staff',
      passwordHash: staffPassword,
      fullName: 'Pooja Verma',
      phone: '+91 98444 55566',
      role: RoleType.ADMISSION_STAFF,
      isActive: true,
    },
  });

  const regularStaff = await prisma.user.upsert({
    where: { email: 'staff@greenwoodhigh.edu' },
    update: {},
    create: {
      email: 'staff@greenwoodhigh.edu',
      username: 'staff_user',
      passwordHash: staffPassword,
      fullName: 'Arun Kumar',
      phone: '+91 98555 66677',
      role: RoleType.STAFF,
      isActive: true,
    },
  });

  console.log('✅ Users seeded: Super Admin, Principal, Accountant, Admission Staff, Staff');

  // 3. Academic Year (Active 2026-27)
  const academicYear = await prisma.academicYear.upsert({
    where: { name: '2026-27' },
    update: { isActive: true },
    create: {
      name: '2026-27',
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2027-03-31T23:59:59.000Z'),
      isActive: true,
      isArchived: false,
    },
  });

  // Previous year for comparison
  await prisma.academicYear.upsert({
    where: { name: '2025-26' },
    update: { isActive: false },
    create: {
      name: '2025-26',
      startDate: new Date('2025-04-01T00:00:00.000Z'),
      endDate: new Date('2026-03-31T23:59:59.000Z'),
      isActive: false,
      isArchived: true,
    },
  });

  console.log('✅ Academic Years seeded: 2026-27 (Active)');

  // 4. Classes and Sections
  const classNames = [
    'Nursery', 'LKG', 'UKG',
    'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
    'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
    'Class 11', 'Class 12'
  ];

  const sectionNames = ['A', 'B', 'C'];
  const createdClasses: Record<string, any> = {};
  const createdSections: Record<string, any[]> = {};

  for (let i = 0; i < classNames.length; i++) {
    const cName = classNames[i];
    const cls = await prisma.class.upsert({
      where: { name: cName },
      update: { orderNumber: i + 1 },
      create: {
        name: cName,
        orderNumber: i + 1,
        description: `Primary and secondary education section for ${cName}`,
      },
    });
    createdClasses[cName] = cls;
    createdSections[cName] = [];

    for (const sName of sectionNames) {
      const section = await prisma.section.upsert({
        where: {
          classId_name: {
            classId: cls.id,
            name: sName,
          },
        },
        update: {},
        create: {
          name: sName,
          classId: cls.id,
          capacity: 40,
        },
      });
      createdSections[cName].push(section);
    }
  }

  console.log('✅ Classes (Nursery - 12) & Sections (A, B, C) seeded');

  // 5. Fee Types
  const feeTypesData = [
    { name: 'Tuition Fee', code: 'TUIT', frequency: FeeFrequency.MONTHLY, description: 'Monthly academic instruction fee' },
    { name: 'Admission Fee', code: 'ADM', frequency: FeeFrequency.ONE_TIME, description: 'One-time admission processing fee' },
    { name: 'Annual Development Fee', code: 'ANN', frequency: FeeFrequency.ANNUAL, description: 'Annual campus and sports development charges' },
    { name: 'Exam Fee', code: 'EXAM', frequency: FeeFrequency.ANNUAL, description: 'Semester and board exam administration fee' },
    { name: 'Computer & Smart Class Fee', code: 'COMP', frequency: FeeFrequency.MONTHLY, description: 'Lab computing and digital learning resources' },
    { name: 'Library Fee', code: 'LIB', frequency: FeeFrequency.ANNUAL, description: 'Library and digital archives access fee' },
    { name: 'Sports & Activities Fee', code: 'SPORT', frequency: FeeFrequency.ANNUAL, description: 'Athletics, fitness and co-curriculars' },
    { name: 'Transport Fee', code: 'TRANS', frequency: FeeFrequency.MONTHLY, description: 'School bus service fee' },
  ];

  const createdFeeTypes: Record<string, any> = {};
  for (const ft of feeTypesData) {
    const created = await prisma.feeType.upsert({
      where: { code: ft.code },
      update: {},
      create: ft,
    });
    createdFeeTypes[ft.code] = created;
  }

  console.log('✅ Fee Types seeded');

  // 6. Fee Structures for Classes (e.g. Class 8 and Class 1)
  const class8 = createdClasses['Class 8'];
  if (class8) {
    const struct8 = await prisma.feeStructure.upsert({
      where: {
        academicYearId_classId: {
          academicYearId: academicYear.id,
          classId: class8.id,
        },
      },
      update: {},
      create: {
        academicYearId: academicYear.id,
        classId: class8.id,
        title: 'Class 8 Standard Fee Structure 2026-27',
        totalAmount: 48000,
      },
    });

    // Structure items
    await prisma.feeStructureItem.deleteMany({ where: { feeStructureId: struct8.id } });
    await prisma.feeStructureItem.createMany({
      data: [
        { feeStructureId: struct8.id, feeTypeId: createdFeeTypes['TUIT'].id, amount: 3000, frequency: FeeFrequency.MONTHLY },
        { feeStructureId: struct8.id, feeTypeId: createdFeeTypes['COMP'].id, amount: 500, frequency: FeeFrequency.MONTHLY },
        { feeStructureId: struct8.id, feeTypeId: createdFeeTypes['EXAM'].id, amount: 2000, frequency: FeeFrequency.ANNUAL },
        { feeStructureId: struct8.id, feeTypeId: createdFeeTypes['ANN'].id, amount: 4000, frequency: FeeFrequency.ANNUAL },
      ],
    });
  }

  const class1 = createdClasses['Class 1'];
  if (class1) {
    const struct1 = await prisma.feeStructure.upsert({
      where: {
        academicYearId_classId: {
          academicYearId: academicYear.id,
          classId: class1.id,
        },
      },
      update: {},
      create: {
        academicYearId: academicYear.id,
        classId: class1.id,
        title: 'Class 1 Primary Fee Structure 2026-27',
        totalAmount: 38000,
      },
    });

    await prisma.feeStructureItem.deleteMany({ where: { feeStructureId: struct1.id } });
    await prisma.feeStructureItem.createMany({
      data: [
        { feeStructureId: struct1.id, feeTypeId: createdFeeTypes['TUIT'].id, amount: 2500, frequency: FeeFrequency.MONTHLY },
        { feeStructureId: struct1.id, feeTypeId: createdFeeTypes['COMP'].id, amount: 300, frequency: FeeFrequency.MONTHLY },
        { feeStructureId: struct1.id, feeTypeId: createdFeeTypes['ANN'].id, amount: 3500, frequency: FeeFrequency.ANNUAL },
      ],
    });
  }

  // 7. Seed Sample Students with Parents, Academic Records, and Fees
  const sampleStudents = [
    {
      admissionNumber: 'ADM-2026-001',
      firstName: 'Aarav',
      lastName: 'Sharma',
      gender: Gender.MALE,
      dob: new Date('2013-05-14'),
      bloodGroup: 'B+',
      aadhaar: '7482-9102-3841',
      className: 'Class 8',
      sectionName: 'A',
      rollNo: '8A01',
      parent: {
        fatherName: 'Rajesh Sharma',
        motherName: 'Meenakshi Sharma',
        phone: '+91 98711 00221',
        email: 'rajesh.sharma@example.com',
        occupation: 'Software Architect',
        address: 'Villa 14, Palm Meadows, Bangalore',
      },
      feeStatus: FeeStatus.PAID,
    },
    {
      admissionNumber: 'ADM-2026-002',
      firstName: 'Ananya',
      lastName: 'Patel',
      gender: Gender.FEMALE,
      dob: new Date('2013-08-22'),
      bloodGroup: 'O+',
      aadhaar: '4928-1093-5712',
      className: 'Class 8',
      sectionName: 'A',
      rollNo: '8A02',
      parent: {
        fatherName: 'Bhavin Patel',
        motherName: 'Dipti Patel',
        phone: '+91 98711 00222',
        email: 'bhavin.patel@example.com',
        occupation: 'Business Owner',
        address: 'B-402, Shivalik Residency, Ahmedabad',
      },
      feeStatus: FeeStatus.PENDING,
    },
    {
      admissionNumber: 'ADM-2026-003',
      firstName: 'Rohan',
      lastName: 'Iyer',
      gender: Gender.MALE,
      dob: new Date('2013-11-03'),
      bloodGroup: 'A+',
      aadhaar: '6192-3847-1902',
      className: 'Class 8',
      sectionName: 'B',
      rollNo: '8B01',
      parent: {
        fatherName: 'Suresh Iyer',
        motherName: 'Lakshmi Iyer',
        phone: '+91 98711 00223',
        email: 'suresh.iyer@example.com',
        occupation: 'Chartered Accountant',
        address: '12-C, Emerald Greens, Chennai',
      },
      feeStatus: FeeStatus.PARTIAL,
    },
    {
      admissionNumber: 'ADM-2026-004',
      firstName: 'Diya',
      lastName: 'Choudhury',
      gender: Gender.FEMALE,
      dob: new Date('2020-03-15'),
      bloodGroup: 'AB+',
      aadhaar: '8492-4820-1934',
      className: 'Class 1',
      sectionName: 'A',
      rollNo: '1A01',
      parent: {
        fatherName: 'Amit Choudhury',
        motherName: 'Rina Choudhury',
        phone: '+91 98711 00224',
        email: 'amit.c@example.com',
        occupation: 'Civil Engineer',
        address: 'Flat 301, Lakeview Heights, Kolkata',
      },
      feeStatus: FeeStatus.OVERDUE,
    },
    {
      admissionNumber: 'ADM-2026-005',
      firstName: 'Kabir',
      lastName: 'Malhotra',
      gender: Gender.MALE,
      dob: new Date('2020-07-29'),
      bloodGroup: 'O-',
      aadhaar: '3920-5819-2940',
      className: 'Class 1',
      sectionName: 'B',
      rollNo: '1B01',
      parent: {
        fatherName: 'Vikram Malhotra',
        motherName: 'Natasha Malhotra',
        phone: '+91 98711 00225',
        email: 'vikram.malhotra@example.com',
        occupation: 'Corporate Lawyer',
        address: 'House 88, Defence Colony, New Delhi',
      },
      feeStatus: FeeStatus.PAID,
    },
  ];

  for (const s of sampleStudents) {
    const parent = await prisma.parent.upsert({
      where: { primaryPhone: s.parent.phone },
      update: {},
      create: {
        fatherName: s.parent.fatherName,
        motherName: s.parent.motherName,
        primaryPhone: s.parent.phone,
        email: s.parent.email,
        occupation: s.parent.occupation,
        address: s.parent.address,
      },
    });

    const student = await prisma.student.upsert({
      where: { admissionNumber: s.admissionNumber },
      update: {},
      create: {
        admissionNumber: s.admissionNumber,
        firstName: s.firstName,
        lastName: s.lastName,
        dateOfBirth: s.dob,
        gender: s.gender,
        bloodGroup: s.bloodGroup,
        aadhaarNumber: s.aadhaar,
        address: s.parent.address,
        status: StudentStatus.ACTIVE,
      },
    });

    await prisma.studentParent.upsert({
      where: {
        studentId_parentId: {
          studentId: student.id,
          parentId: parent.id,
        },
      },
      update: {},
      create: {
        studentId: student.id,
        parentId: parent.id,
        relationship: 'Father',
        isPrimary: true,
      },
    });

    const targetClass = createdClasses[s.className];
    const targetSection = createdSections[s.className]?.find(sec => sec.name === s.sectionName);

    if (targetClass) {
      await prisma.studentAcademicRecord.upsert({
        where: {
          studentId_academicYearId: {
            studentId: student.id,
            academicYearId: academicYear.id,
          },
        },
        update: {
          classId: targetClass.id,
          sectionId: targetSection?.id,
          rollNumber: s.rollNo,
        },
        create: {
          studentId: student.id,
          academicYearId: academicYear.id,
          classId: targetClass.id,
          sectionId: targetSection?.id,
          rollNumber: s.rollNo,
        },
      });

      // Generate April, May, June fees
      const months = [
        { month: 4, name: 'April' },
        { month: 5, name: 'May' },
        { month: 6, name: 'June' },
      ];

      for (const m of months) {
        const isPaid = s.feeStatus === FeeStatus.PAID;
        const isPartial = s.feeStatus === FeeStatus.PARTIAL && m.month === 4;
        const isOverdue = s.feeStatus === FeeStatus.OVERDUE && m.month === 4;
        const feeAmount = s.className === 'Class 8' ? 3500 : 2800;
        const paidAmount = isPaid ? feeAmount : (isPartial ? 1500 : 0);
        const remaining = feeAmount - paidAmount;
        const currentStatus = isPaid ? FeeStatus.PAID : (isPartial ? FeeStatus.PARTIAL : (isOverdue ? FeeStatus.OVERDUE : FeeStatus.PENDING));

        const studentFee = await prisma.studentFee.upsert({
          where: {
            studentId_academicYearId_feeTypeId_month_year: {
              studentId: student.id,
              academicYearId: academicYear.id,
              feeTypeId: createdFeeTypes['TUIT'].id,
              month: m.month,
              year: 2026,
            },
          },
          update: {},
          create: {
            studentId: student.id,
            academicYearId: academicYear.id,
            feeTypeId: createdFeeTypes['TUIT'].id,
            month: m.month,
            year: 2026,
            title: `${m.name} Tuition Fee`,
            amount: feeAmount,
            discountAmount: 0,
            fineAmount: isOverdue ? 200 : 0,
            netAmount: feeAmount + (isOverdue ? 200 : 0),
            paidAmount: paidAmount,
            remainingAmount: remaining + (isOverdue ? 200 : 0),
            dueDate: new Date(2026, m.month - 1, 10),
            status: currentStatus,
          },
        });

        // If paid, create payment and receipt
        if (paidAmount > 0) {
          const payment = await prisma.payment.create({
            data: {
              studentId: student.id,
              academicYearId: academicYear.id,
              collectedById: accountant.id,
              amount: paidAmount,
              paymentMethod: PaymentMethod.UPI,
              paymentStatus: PaymentStatus.SUCCESS,
              transactionRef: `UPI-${Date.now().toString().slice(-8)}`,
              notes: `${m.name} term fee collection`,
              paidAt: new Date(2026, m.month - 1, 5),
              items: {
                create: [
                  {
                    studentFeeId: studentFee.id,
                    amountPaid: paidAmount,
                  },
                ],
              },
            },
          });

          const receiptCount = await prisma.receipt.count();
          const receiptNo = `REC-2026-${(receiptCount + 1).toString().padStart(6, '0')}`;

          await prisma.receipt.create({
            data: {
              receiptNumber: receiptNo,
              paymentId: payment.id,
              studentId: student.id,
              totalAmount: feeAmount,
              previousBalance: 0,
              paidAmount: paidAmount,
              remainingBalance: remaining,
              generatedAt: payment.paidAt,
            },
          });
        }
      }
    }
  }

  // 8. Notifications & Audit Log
  await prisma.notification.createMany({
    data: [
      {
        title: 'Academic Year 2026-27 Active',
        message: 'The academic session 2026-27 is configured and live for admissions and fee billing.',
        type: 'SUCCESS',
        isRead: false,
      },
      {
        title: 'Pending Fee Reminders',
        message: 'Automated pending fee digest for April 2026 is ready for review.',
        type: 'WARNING',
        isRead: false,
      },
    ],
  });

  await prisma.auditLog.create({
    data: {
      userId: superAdmin.id,
      userName: superAdmin.fullName,
      action: 'SYSTEM_INITIALIZE',
      module: 'SETTINGS',
      recordId: 'default',
      newData: JSON.stringify({ event: 'Initial database seeding completed successfully' }),
      ipAddress: '127.0.0.1',
    },
  });

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
