import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedTransportAndSystemAuditLogs() {
  const existingAuditCount = await prisma.auditLog.count({ where: { module: 'Transport' } });
  if (existingAuditCount > 0) {
    console.log(`Audit logs already present: ${existingAuditCount} transport entries.`);
    return;
  }

  const routes = await prisma.transportRoute.findMany({ include: { stops: true } });
  const students = await prisma.student.findMany({ take: 5 });

  const routeA = routes[0];
  const stop1 = routeA?.stops[0];
  const stop2 = routeA?.stops[1] || routeA?.stops[0];

  const student1 = students[0];
  const student2 = students[1] || students[0];

  console.log('Seeding transport audit logs...');

  // 1. Route creation audit
  if (routeA) {
    await prisma.auditLog.create({
      data: {
        userName: 'Kundan Sharma (Director)',
        action: 'CREATE_TRANSPORT_ROUTE',
        module: 'Transport',
        recordId: routeA.id,
        newData: JSON.stringify({
          code: routeA.code,
          name: routeA.name,
          vehicleNumber: routeA.vehicleNumber,
          driverName: routeA.driverName,
          driverPhone: routeA.driverPhone
        }),
        ipAddress: '192.168.1.10',
        timestamp: new Date(Date.now() - 7 * 24 * 3600 * 1000)
      }
    });
  }

  // 2. Stop 1 creation audit
  if (stop1) {
    await prisma.auditLog.create({
      data: {
        userName: 'Kundan Sharma (Director)',
        action: 'CREATE_TRANSPORT_STOP',
        module: 'Transport',
        recordId: stop1.id,
        newData: JSON.stringify({
          routeId: stop1.routeId,
          name: stop1.name,
          monthlyFee: Number(stop1.monthlyFee),
          orderNumber: stop1.orderNumber
        }),
        ipAddress: '192.168.1.10',
        timestamp: new Date(Date.now() - 6 * 24 * 3600 * 1000)
      }
    });
  }

  // 3. Stop 2 creation audit
  if (stop2 && stop2.id !== stop1?.id) {
    await prisma.auditLog.create({
      data: {
        userName: 'Kundan Sharma (Director)',
        action: 'CREATE_TRANSPORT_STOP',
        module: 'Transport',
        recordId: stop2.id,
        newData: JSON.stringify({
          routeId: stop2.routeId,
          name: stop2.name,
          monthlyFee: Number(stop2.monthlyFee),
          orderNumber: stop2.orderNumber
        }),
        ipAddress: '192.168.1.10',
        timestamp: new Date(Date.now() - 6 * 24 * 3600 * 1000 + 300000)
      }
    });
  }

  // 4. Student assignment and history
  if (student1 && routeA && stop1) {
    // Audit Log entry
    await prisma.auditLog.create({
      data: {
        userName: 'Pooja Verma (Admission Staff)',
        action: 'ASSIGN_STUDENT_TRANSPORT',
        module: 'Transport',
        recordId: student1.id,
        newData: JSON.stringify({
          studentName: `${student1.firstName} ${student1.lastName}`,
          admissionNumber: student1.admissionNumber,
          route: routeA.name,
          stop: stop1.name,
          monthlyFee: Number(stop1.monthlyFee),
          startMonth: 4,
          serviceType: 'TWO_WAY'
        }),
        ipAddress: '192.168.1.15',
        timestamp: new Date(Date.now() - 4 * 24 * 3600 * 1000)
      }
    });

    // StudentTransportHistory entry
    await prisma.studentTransportHistory.create({
      data: {
        studentId: student1.id,
        routeId: routeA.id,
        stopId: stop1.id,
        action: 'ASSIGNED',
        effectiveMonth: 4,
        effectiveYear: 2026,
        monthlyFee: Number(stop1.monthlyFee),
        serviceType: 'TWO_WAY',
        reason: 'Initial enrollment on academic admission',
        changedByName: 'Pooja Verma (Admission Staff)',
        createdAt: new Date(Date.now() - 4 * 24 * 3600 * 1000)
      }
    });

    // Make sure active transport assignment exists for student1
    const activeAssign = await prisma.studentTransportAssignment.findFirst({
      where: { studentId: student1.id, isActive: true }
    });
    if (!activeAssign) {
      await prisma.studentTransportAssignment.create({
        data: {
          studentId: student1.id,
          routeId: routeA.id,
          stopId: stop1.id,
          serviceType: 'TWO_WAY',
          startMonth: 4,
          startYear: 2026,
          monthlyFee: Number(stop1.monthlyFee),
          isActive: true
        }
      });
      await prisma.student.update({
        where: { id: student1.id },
        data: { usesTransport: true }
      });
    }
  }

  // 5. Change stop history & audit
  if (student1 && routeA && stop2 && stop2.id !== stop1?.id) {
    await prisma.auditLog.create({
      data: {
        userName: 'Rajesh K. Mehta (Accountant)',
        action: 'CHANGE_STUDENT_TRANSPORT',
        module: 'Transport',
        recordId: student1.id,
        newData: JSON.stringify({
          studentName: `${student1.firstName} ${student1.lastName}`,
          admissionNumber: student1.admissionNumber,
          route: routeA.name,
          stop: stop2.name,
          monthlyFee: Number(stop2.monthlyFee),
          effectiveMonth: 6,
          reason: 'Parent requested pickup at Main Market gate'
        }),
        ipAddress: '192.168.1.12',
        timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000)
      }
    });

    await prisma.studentTransportHistory.create({
      data: {
        studentId: student1.id,
        routeId: routeA.id,
        stopId: stop2.id,
        action: 'STOP_CHANGED',
        effectiveMonth: 6,
        effectiveYear: 2026,
        monthlyFee: Number(stop2.monthlyFee),
        serviceType: 'TWO_WAY',
        reason: 'Parent requested pickup at Main Market gate',
        changedByName: 'Rajesh K. Mehta (Accountant)',
        createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000)
      }
    });
  }

  // 6. Another student assignment and stop
  if (student2 && student2.id !== student1?.id && routeA && stop1) {
    await prisma.auditLog.create({
      data: {
        userName: 'Pooja Verma (Admission Staff)',
        action: 'ASSIGN_STUDENT_TRANSPORT',
        module: 'Transport',
        recordId: student2.id,
        newData: JSON.stringify({
          studentName: `${student2.firstName} ${student2.lastName}`,
          admissionNumber: student2.admissionNumber,
          route: routeA.name,
          stop: stop1.name,
          monthlyFee: Number(stop1.monthlyFee),
          startMonth: 4,
          serviceType: 'TWO_WAY'
        }),
        ipAddress: '192.168.1.15',
        timestamp: new Date(Date.now() - 10 * 24 * 3600 * 1000)
      }
    });

    await prisma.studentTransportHistory.create({
      data: {
        studentId: student2.id,
        routeId: routeA.id,
        stopId: stop1.id,
        action: 'ASSIGNED',
        effectiveMonth: 4,
        effectiveYear: 2026,
        monthlyFee: Number(stop1.monthlyFee),
        serviceType: 'TWO_WAY',
        reason: 'Enrolled in school bus service',
        changedByName: 'Pooja Verma (Admission Staff)',
        createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000)
      }
    });

    await prisma.auditLog.create({
      data: {
        userName: 'Dr. Sunita Sharma (Principal)',
        action: 'STOP_STUDENT_TRANSPORT',
        module: 'Transport',
        recordId: student2.id,
        newData: JSON.stringify({
          studentName: `${student2.firstName} ${student2.lastName}`,
          admissionNumber: student2.admissionNumber,
          stopMonth: 8,
          stopYear: 2026,
          reason: 'Student switched to private van arranged by parents'
        }),
        ipAddress: '192.168.1.18',
        timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000)
      }
    });

    await prisma.studentTransportHistory.create({
      data: {
        studentId: student2.id,
        routeId: routeA.id,
        stopId: stop1.id,
        action: 'STOPPED',
        effectiveMonth: 8,
        effectiveYear: 2026,
        monthlyFee: Number(stop1.monthlyFee),
        serviceType: 'TWO_WAY',
        reason: 'Student switched to private van arranged by parents',
        changedByName: 'Dr. Sunita Sharma (Principal)',
        createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000)
      }
    });
  }

  // 7. General system audit logs for Settings & Admin
  await prisma.auditLog.createMany({
    data: [
      {
        userName: 'Kundan Sharma (Director)',
        action: 'UPDATE_SETTINGS',
        module: 'Settings',
        recordId: 'default',
        newData: JSON.stringify({ schoolName: 'Pragya Bharti Public School', affiliationNumber: 'CBSE/AFF/2024/9901' }),
        ipAddress: '192.168.1.10',
        timestamp: new Date(Date.now() - 5 * 24 * 3600 * 1000)
      },
      {
        userName: 'Rajesh K. Mehta (Accountant)',
        action: 'CREATE_FEE_STRUCTURE',
        module: 'Billing',
        recordId: 'fee-struct-2026',
        newData: JSON.stringify({ academicYear: '2026-2027', components: ['Tuition', 'Computer', 'Development', 'Transport'] }),
        ipAddress: '192.168.1.12',
        timestamp: new Date(Date.now() - 4 * 24 * 3600 * 1000)
      },
      {
        userName: 'Dr. Sunita Sharma (Principal)',
        action: 'STAFF_LOGIN',
        module: 'Authentication',
        recordId: 'user-principal-2',
        newData: JSON.stringify({ username: 'principal', role: 'PRINCIPAL' }),
        ipAddress: '192.168.1.18',
        timestamp: new Date(Date.now() - 12 * 3600 * 1000)
      }
    ]
  });

  console.log('Transport and system audit logs successfully seeded!');
}

// Auto-run if executed directly
if (process.argv[1]?.includes('seedAuditLogs')) {
  seedTransportAndSystemAuditLogs()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
