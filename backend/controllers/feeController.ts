import { Request, Response } from 'express';
import { PrismaClient, FeeFrequency, FeeStatus, StudentStatus } from '@prisma/client';
import { logAudit } from '../utils/audit.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { isDatabaseConfigured } from '../config/index.js';
import { FALLBACK_CLASSES, FALLBACK_FEE_RATES } from '../utils/fallbackData.js';
import { broadcastNotification } from '../utils/notificationService.js';

const prisma = new PrismaClient();

const FALLBACK_FEE_TYPES = [
  { id: 'ft-1', name: 'Tuition Fee', code: 'TUIT', frequency: 'MONTHLY', description: 'Monthly core tuition charge' },
  { id: 'ft-2', name: 'Computer Fee', code: 'COMP', frequency: 'MONTHLY', description: 'Computer lab fee (Rs.125 for Class III to X)' },
  { id: 'ft-3', name: 'Prospectus Fee', code: 'PROS', frequency: 'ONE_TIME', description: 'One-time admission form / prospectus fee' },
  { id: 'ft-4', name: 'Admission Charge', code: 'ADM', frequency: 'ONE_TIME', description: 'One-time admission charge for new admissions' },
  { id: 'ft-5', name: 'Term Fee', code: 'TERM', frequency: 'ANNUAL', description: 'Payable twice a year in May and October (Rs.1350)' },
  { id: 'ft-6', name: 'Hostel Fee', code: 'HOSTEL', frequency: 'MONTHLY', description: 'Recurring hostel and boarding charges' },
  { id: 'ft-7', name: 'Transport Fee', code: 'TRANS', frequency: 'MONTHLY', description: 'Optional school bus route fee' },
  { id: 'ft-8', name: 'Uniform Fee', code: 'UNIF', frequency: 'ONE_TIME', description: 'Optional school uniform set fee' },
  { id: 'ft-9', name: 'Books Fee', code: 'BOOKS', frequency: 'ONE_TIME', description: 'Optional textbook and stationery kit' },
  { id: 'ft-10', name: 'Exam Fee', code: 'EXAM', frequency: 'ANNUAL', description: 'Annual semester and evaluation fee' },
];

const getFallbackStructures = () => {
  return FALLBACK_CLASSES.map(cls => {
    const rates = FALLBACK_FEE_RATES[cls.name] || { tuition: 0, computer: 0, prospectus: 0, admission: 0, termFee: 0 };
    const items: any[] = [
      { id: `item-${cls.id}-1`, feeHead: 'TUITION_FEE', feeType: { name: 'Tuition Fee', code: 'TUIT' }, amount: rates.tuition, frequency: 'MONTHLY', componentName: 'Tuition Fee' },
      ...(rates.computer > 0 ? [{ id: `item-${cls.id}-2`, feeHead: 'COMPUTER_FEE', feeType: { name: 'Computer Fee', code: 'COMP' }, amount: rates.computer, frequency: 'MONTHLY', componentName: 'Computer Fee' }] : []),
      { id: `item-${cls.id}-3`, feeHead: 'PROSPECTUS_FEE', feeType: { name: 'Prospectus Fee', code: 'PROS' }, amount: rates.prospectus, frequency: 'ONE_TIME', componentName: 'Prospectus Fee' },
      { id: `item-${cls.id}-4`, feeHead: 'ADMISSION_FEE', feeType: { name: 'Admission Charge', code: 'ADM' }, amount: rates.admission, frequency: 'ONE_TIME', componentName: 'Admission Charge' },
      { id: `item-${cls.id}-5`, feeHead: 'TERM_FEE', feeType: { name: 'Term Fee', code: 'TERM' }, amount: rates.termFee, frequency: 'ANNUAL', componentName: 'Term Fee', dueMonths: '5,10' }
    ];
    return {
      id: `fs-${cls.id}`,
      title: `${cls.name} Fee Structure 2026-27`,
      class: cls,
      academicYear: { id: 'ay-1', name: '2026-27', isActive: true },
      totalAmount: (rates.tuition + rates.computer) * 12 + rates.termFee * 2 + rates.admission + rates.prospectus,
      items
    };
  });
};

// =============================================================
// Fee Types (Configurable Fee Heads)
// =============================================================

export const getFeeTypes = async (req: Request, res: Response): Promise<void> => {
  if (!isDatabaseConfigured()) {
    res.json({ success: true, data: FALLBACK_FEE_TYPES });
    return;
  }

  try {
    const types = await prisma.feeType.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { studentFees: true, structureItems: true } }
      }
    });
    res.json({ success: true, data: types });
  } catch (error: any) {
    console.warn('Fee types using fallback due to database notice:', error.message);
    res.json({ success: true, data: FALLBACK_FEE_TYPES });
  }
};

export const createFeeType = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, code, frequency, description, defaultAmount } = req.body;
    if (!name || !code) {
      res.status(400).json({ success: false, message: 'Fee type name and code are required' });
      return;
    }

    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    // Check if duplicate code or name exists
    const existing = await prisma.feeType.findFirst({
      where: {
        OR: [{ code: cleanCode }, { name: cleanName }]
      }
    });

    if (existing) {
      res.status(400).json({
        success: false,
        message: existing.code === cleanCode
          ? `A fee head with code '${cleanCode}' already exists.`
          : `A fee head with name '${cleanName}' already exists.`
      });
      return;
    }

    const feeType = await prisma.feeType.create({
      data: {
        name: cleanName,
        code: cleanCode,
        frequency: frequency || 'MONTHLY',
        description: description?.trim() || null,
        isActive: true
      }
    });

    // Automatically synchronize this new fee head into ALL existing Class Fee Structures as INACTIVE
    const allStructures = await prisma.feeStructure.findMany();
    for (const struct of allStructures) {
      const exists = await prisma.feeStructureItem.findFirst({
        where: { feeStructureId: struct.id, feeTypeId: feeType.id }
      });
      if (!exists) {
        await prisma.feeStructureItem.create({
          data: {
            feeStructureId: struct.id,
            feeTypeId: feeType.id,
            componentName: feeType.name,
            amount: defaultAmount ? parseFloat(defaultAmount) : 0,
            frequency: feeType.frequency,
            dueMonths: feeType.code === 'TERM' ? '5,10' : null,
            appliesTo: feeType.code === 'HOSTEL' ? 'HOSTEL_ONLY' : (feeType.code === 'PROS' || feeType.code === 'ADM' ? 'NEW_ADMISSION_ONLY' : 'ALL'),
            isActive: false // Added as INACTIVE by default in all class fee structures
          }
        });
      }
    }

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'CREATE_FEE_TYPE',
      module: 'FEES',
      recordId: feeType.id,
      newData: feeType,
      ipAddress: req.ip
    });

    await broadcastNotification({
      title: 'Configurable Fee Head Added',
      message: `Fee head '${cleanName}' (${cleanCode}) was created and added to all class fee structures as inactive.`,
      type: 'INFO',
      linkUrl: `/fees`
    });

    res.status(201).json({
      success: true,
      data: feeType,
      message: `Fee head '${feeType.name}' created and added to all class fee structures as inactive. You can now enable and configure its tariff for each class.`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateFeeType = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, code, frequency, description, isActive } = req.body;

    const existing = await prisma.feeType.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Fee head not found' });
      return;
    }

    const updated = await prisma.feeType.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(code ? { code: code.trim().toUpperCase() } : {}),
        ...(frequency ? { frequency } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {})
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'UPDATE_FEE_TYPE',
      module: 'FEES',
      recordId: id,
      oldData: existing,
      newData: updated,
      ipAddress: req.ip
    });

    res.json({ success: true, data: updated, message: 'Fee head updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteFeeType = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const feeType = await prisma.feeType.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            studentFees: true,
            structureItems: true
          }
        }
      }
    });

    if (!feeType) {
      res.status(404).json({ success: false, message: 'Fee head not found' });
      return;
    }

    // Check if there are any student fees associated with this fee head
    if (feeType._count.studentFees > 0) {
      // Check if any of these student fees have payments attached or paidAmount > 0
      const paidCount = await prisma.studentFee.count({
        where: {
          feeTypeId: id,
          paidAmount: { gt: 0 }
        }
      });

      if (paidCount > 0) {
        // Financial ledger integrity: cannot delete recorded payment transactions. Deactivate instead.
        await prisma.feeType.update({
          where: { id },
          data: { isActive: false }
        });
        await prisma.feeStructureItem.updateMany({
          where: { feeTypeId: id },
          data: { isActive: false }
        });

        await logAudit({
          userId: req.user?.id,
          userName: req.user?.fullName,
          action: 'DEACTIVATE_FEE_TYPE',
          module: 'FEES',
          recordId: id,
          newData: { reason: `Deactivated because ${paidCount} payments exist` },
          ipAddress: req.ip
        });

        res.json({
          success: true,
          actionTaken: 'DEACTIVATED',
          message: `Fee head '${feeType.name}' has ${paidCount} past payment records and cannot be permanently deleted. It has been deactivated across all fee structures instead.`
        });
        return;
      }

      // If all student fees are unpaid (paidAmount == 0):
      // Allow deletion if force is confirmed
      const force = req.query.force === 'true' || req.body?.force === true;
      if (!force) {
        res.status(400).json({
          success: false,
          requiresConfirmation: true,
          unpaidCount: feeType._count.studentFees,
          message: `Fee head '${feeType.name}' is attached to ${feeType._count.studentFees} unpaid student fee items. Please confirm to delete this fee head and remove the unpaid items.`
        });
        return;
      }

      // Delete unpaid student fees, structure items, and the fee type
      await prisma.$transaction([
        prisma.studentFee.deleteMany({ where: { feeTypeId: id, paidAmount: 0 } }),
        prisma.feeStructureItem.deleteMany({ where: { feeTypeId: id } }),
        prisma.feeType.delete({ where: { id } })
      ]);
    } else {
      // No student fees generated at all: safe to delete directly
      await prisma.$transaction([
        prisma.feeStructureItem.deleteMany({ where: { feeTypeId: id } }),
        prisma.feeType.delete({ where: { id } })
      ]);
    }

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'DELETE_FEE_TYPE',
      module: 'FEES',
      recordId: id,
      oldData: feeType,
      ipAddress: req.ip
    });

    res.json({ success: true, message: `Fee head '${feeType.name}' deleted successfully` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Fee Structures (Director Managed)
// =============================================================

export const getFeeStructures = async (req: Request, res: Response): Promise<void> => {
  if (!isDatabaseConfigured()) {
    res.json({ success: true, data: getFallbackStructures() });
    return;
  }

  try {
    const academicYearId = req.query.academicYearId as string;
    const where: any = {};
    if (academicYearId) where.academicYearId = academicYearId;

    // Retrieve all active fee types to ensure every structure represents them
    const allFeeTypes = await prisma.feeType.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });

    const structures = await prisma.feeStructure.findMany({
      where,
      include: {
        academicYear: true,
        class: true,
        items: {
          include: { feeType: true },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { class: { orderNumber: 'asc' } }
    });

    // Auto-synchronize missing fee heads as inactive items in each structure
    for (const struct of structures) {
      const existingFeeTypeIds = new Set(struct.items.map(it => it.feeTypeId));
      for (const ft of allFeeTypes) {
        if (!existingFeeTypeIds.has(ft.id)) {
          const newItem = await prisma.feeStructureItem.create({
            data: {
              feeStructureId: struct.id,
              feeTypeId: ft.id,
              componentName: ft.name,
              amount: 0,
              frequency: ft.frequency,
              dueMonths: ft.code === 'TERM' ? '5,10' : null,
              appliesTo: ft.code === 'HOSTEL' ? 'HOSTEL_ONLY' : (ft.code === 'PROS' || ft.code === 'ADM' ? 'NEW_ADMISSION_ONLY' : 'ALL'),
              isActive: false
            },
            include: { feeType: true }
          });
          struct.items.push(newItem);
        }
      }
    }

    res.json({ success: true, data: structures });
  } catch (error: any) {
    console.warn('Fee structures using fallback due to database notice:', error.message);
    res.json({ success: true, data: getFallbackStructures() });
  }
};

export const createFeeStructure = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { academicYearId, classId, title, items } = req.body;
    if (!academicYearId || !classId || !items || !Array.isArray(items)) {
      res.status(400).json({ success: false, message: 'Academic Year, Class, and fee items are required' });
      return;
    }

    // Compute total amount from active items only
    const totalAmount = items.reduce((sum: number, it: any) => {
      if (it.isActive === false || it.isActive === 'false') return sum;
      return sum + (parseFloat(it.amount) || 0);
    }, 0);

    const structure = await prisma.$transaction(async (tx) => {
      const existing = await tx.feeStructure.findUnique({
        where: { academicYearId_classId: { academicYearId, classId } }
      });

      let strId = existing?.id;
      if (existing) {
        await tx.feeStructureItem.deleteMany({ where: { feeStructureId: existing.id } });
        await tx.feeStructure.update({
          where: { id: existing.id },
          data: { title: title || existing.title, totalAmount, updatedAt: new Date() }
        });
      } else {
        const created = await tx.feeStructure.create({
          data: {
            academicYearId,
            classId,
            title: title || 'Class Fee Structure',
            totalAmount
          }
        });
        strId = created.id;
      }

      for (const it of items) {
        await tx.feeStructureItem.create({
          data: {
            feeStructureId: strId!,
            feeTypeId: it.feeTypeId,
            amount: parseFloat(it.amount) || 0,
            frequency: (it.frequency as FeeFrequency) || FeeFrequency.MONTHLY,
            dueMonth: it.dueMonth ? parseInt(it.dueMonth, 10) : null,
            dueMonths: it.dueMonths || null,
            appliesTo: it.appliesTo || 'ALL',
            componentName: it.componentName || null,
            isActive: it.isActive !== undefined ? Boolean(it.isActive) : true,
            effectiveDate: it.effectiveDate ? new Date(it.effectiveDate) : new Date(),
          }
        });
      }

      return tx.feeStructure.findUnique({
        where: { id: strId },
        include: { items: { include: { feeType: true } }, class: true, academicYear: true }
      });
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'SAVE_FEE_STRUCTURE',
      module: 'FEES',
      recordId: structure?.id,
      newData: { classId, academicYearId, totalAmount, itemsCount: items.length },
      ipAddress: req.ip
    });

    res.status(201).json({ success: true, data: structure, message: 'Fee structure saved successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Copy fee structure from previous academic year
export const copyFeeStructureFromPreviousYear = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { fromYearId, toYearId } = req.body;
    if (!fromYearId || !toYearId) {
      res.status(400).json({ success: false, message: 'fromYearId and toYearId are required' });
      return;
    }

    const previousStructures = await prisma.feeStructure.findMany({
      where: { academicYearId: fromYearId },
      include: { items: true }
    });

    if (previousStructures.length === 0) {
      res.status(404).json({ success: false, message: 'No fee structures found for source academic year' });
      return;
    }

    let copiedCount = 0;
    await prisma.$transaction(async (tx) => {
      for (const src of previousStructures) {
        // Upsert target year structure
        const target = await tx.feeStructure.upsert({
          where: { academicYearId_classId: { academicYearId: toYearId, classId: src.classId } },
          update: { totalAmount: src.totalAmount, title: src.title.replace(/\d{4}-\d{2}/, '') + ' Copied' },
          create: {
            academicYearId: toYearId,
            classId: src.classId,
            title: src.title.replace(/\d{4}-\d{2}/, '') + ' Copied',
            totalAmount: src.totalAmount
          }
        });

        await tx.feeStructureItem.deleteMany({ where: { feeStructureId: target.id } });

        for (const it of src.items) {
          await tx.feeStructureItem.create({
            data: {
              feeStructureId: target.id,
              feeTypeId: it.feeTypeId,
              amount: it.amount,
              dueMonth: it.dueMonth,
              dueMonths: it.dueMonths,
              frequency: it.frequency,
              appliesTo: it.appliesTo,
              componentName: it.componentName,
              isActive: it.isActive,
              effectiveDate: new Date()
            }
          });
        }
        copiedCount++;
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'COPY_FEE_STRUCTURE',
      module: 'FEES',
      newData: { fromYearId, toYearId, copiedCount },
      ipAddress: req.ip
    });

    res.json({ success: true, message: `Successfully copied fee structure for ${copiedCount} classes`, copiedCount });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Admission Bill Calculation (Live quote before admission)
// =============================================================

export const calculateAdmissionBill = async (req: Request, res: Response): Promise<void> => {
  try {
    const { classId, academicYearId, isHostelStudent, admissionMonth, optionalFeeTypeIds } = req.body;

    if (!classId || !academicYearId) {
      res.status(400).json({ success: false, message: 'classId and academicYearId are required' });
      return;
    }

    const [structure, targetClass] = await Promise.all([
      prisma.feeStructure.findUnique({
        where: { academicYearId_classId: { academicYearId, classId } },
        include: { items: { include: { feeType: true } } }
      }),
      prisma.class.findUnique({ where: { id: classId } })
    ]);

    if (!structure || structure.items.length === 0) {
      res.json({
        success: true,
        data: {
          hasConfiguredFee: false,
          className: targetClass?.name,
          items: [],
          totalAmount: 0,
          note: 'No standard fee structure found for this class. Custom discretionary fee may be entered.'
        }
      });
      return;
    }

    const month = admissionMonth ? parseInt(admissionMonth, 10) : (new Date().getMonth() + 1); // 1-12
    const billItems: Array<{ feeHead: string; component?: string; amount: number; frequency: string }> = [];

    // 1. Prospectus Fee (applies to new admissions)
    const prospectusItem = structure.items.find(it => it.feeType.code === 'PROS' || it.componentName === 'Prospectus Fee');
    if (prospectusItem && Number(prospectusItem.amount) > 0) {
      billItems.push({
        feeHead: prospectusItem.feeType.name,
        component: prospectusItem.componentName || 'Prospectus Fee',
        amount: Number(prospectusItem.amount),
        frequency: 'One-Time'
      });
    }

    // 2. Admission Charge (applies to new admissions)
    const admissionItem = structure.items.find(it => it.feeType.code === 'ADM' || it.componentName === 'Admission Charge');
    if (admissionItem) {
      billItems.push({
        feeHead: admissionItem.feeType.name,
        component: admissionItem.componentName || 'Admission Charge',
        amount: Number(admissionItem.amount), // Can be 0 for Nursery
        frequency: 'One-Time'
      });
    }

    // 3. First Month's Tuition & Computer Fee
    const tuitionItems = structure.items.filter(it =>
      it.frequency === 'MONTHLY' &&
      it.appliesTo !== 'HOSTEL_ONLY' &&
      (it.feeType.code === 'TUIT' || it.feeType.code === 'COMP' || it.componentName?.includes('Tuition') || it.componentName?.includes('Computer'))
    );

    for (const ti of tuitionItems) {
      billItems.push({
        feeHead: ti.feeType.name,
        component: ti.componentName || ti.feeType.name,
        amount: Number(ti.amount),
        frequency: 'Monthly (1st Month)'
      });
    }

    // 4. Hostel Fee (if student is hostel student)
    if (isHostelStudent) {
      const hostelItem = structure.items.find(it => it.feeType.code === 'HOSTEL' || it.appliesTo === 'HOSTEL_ONLY');
      if (hostelItem) {
        billItems.push({
          feeHead: hostelItem.feeType.name,
          component: hostelItem.componentName || 'Hostel Fee',
          amount: Number(hostelItem.amount),
          frequency: 'Monthly (1st Month)'
        });
      }
    }

    // 5. Term Fee (if admission month matches term due months e.g. May [5] or October [10])
    const termItem = structure.items.find(it => it.feeType.code === 'TERM' || it.componentName === 'Term Fee');
    if (termItem) {
      const termMonths = termItem.dueMonths ? termItem.dueMonths.split(',').map(m => parseInt(m.trim(), 10)) : [5, 10];
      if (termMonths.includes(month)) {
        billItems.push({
          feeHead: termItem.feeType.name,
          component: `Term Fee (${month === 5 ? 'Term 1 - May' : 'Term 2 - October'})`,
          amount: Number(termItem.amount),
          frequency: 'Term Fee'
        });
      }
    }

    // 6. Optional heads (Transport, Uniform, Books)
    if (optionalFeeTypeIds && Array.isArray(optionalFeeTypeIds)) {
      for (const optId of optionalFeeTypeIds) {
        const optItem = structure.items.find(it => it.feeTypeId === optId);
        if (optItem) {
          billItems.push({
            feeHead: optItem.feeType.name,
            component: optItem.componentName || optItem.feeType.name,
            amount: Number(optItem.amount),
            frequency: optItem.frequency
          });
        }
      }
    }

    const totalAmount = billItems.reduce((acc, it) => acc + it.amount, 0);

    res.json({
      success: true,
      data: {
        hasConfiguredFee: true,
        className: targetClass?.name,
        admissionMonth: month,
        isHostelStudent: Boolean(isHostelStudent),
        items: billItems,
        totalAmount
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Student Billing (Dynamic month selection, part payments, dues)
// =============================================================

export const getStudentBill = async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;
    const { academicYearId, months } = req.query;

    if (!studentId) {
      res.status(400).json({ success: false, message: 'studentId is required' });
      return;
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        academicRecords: {
          include: { class: true, academicYear: true },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        studentFees: {
          include: { feeType: true }
        }
      }
    });

    if (!student || student.academicRecords.length === 0) {
      res.status(404).json({ success: false, message: 'Student or academic record not found' });
      return;
    }

    const record = student.academicRecords[0];
    const targetYearId = (academicYearId as string) || record.academicYearId;

    // Load fee structure for student's class and target year
    const feeStructure = await prisma.feeStructure.findUnique({
      where: {
        academicYearId_classId: {
          academicYearId: targetYearId,
          classId: record.classId
        }
      },
      include: {
        items: {
          where: { isActive: true },
          include: { feeType: true }
        }
      }
    });

    // Parse target billing months (default to current month if unspecified)
    let targetMonths: number[] = [];
    if (months && typeof months === 'string') {
      targetMonths = months.split(',').map(m => parseInt(m.trim(), 10)).filter(m => !isNaN(m) && m >= 1 && m <= 12);
    }
    if (targetMonths.length === 0) {
      targetMonths = [new Date().getMonth() + 1];
    }

    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();

    // Compile line items for the bill
    const billItems: Array<{
      id?: string;
      feeTypeId: string;
      title: string;
      month?: number;
      monthName?: string;
      amount: number;
      paidAmount: number;
      remainingAmount: number;
      isAlreadyGenerated: boolean;
      studentFeeId?: string;
    }> = [];

    const existingFees = student.studentFees.filter(f => f.academicYearId === targetYearId);

    // 1. Process existing unpaid/partial dues already recorded in database
    for (const ef of existingFees) {
      const remaining = Number(ef.remainingAmount);
      if (remaining > 0) {
        billItems.push({
          id: ef.id,
          studentFeeId: ef.id,
          feeTypeId: ef.feeTypeId,
          title: ef.title,
          month: ef.month || undefined,
          monthName: ef.month ? monthNames[ef.month] : undefined,
          amount: Number(ef.netAmount),
          paidAmount: Number(ef.paidAmount),
          remainingAmount: remaining,
          isAlreadyGenerated: true
        });
      }
    }

    // 2. Generate items from Director's fee structure for requested months if not yet in DB
    if (feeStructure && feeStructure.items) {
      for (const m of targetMonths) {
        for (const item of feeStructure.items) {
          if (item.isActive === false) continue;
          // Check hostel status requirement
          if (item.appliesTo === 'HOSTEL_ONLY' && !student.isHostelStudent) continue;
          if (item.appliesTo === 'NEW_ADMISSION_ONLY') continue; // Only for new admission

          let shouldInclude = false;
          let label = `${item.componentName || item.feeType.name} (${monthNames[m]} ${currentYear})`;

          if (item.frequency === 'MONTHLY') {
            shouldInclude = true;
          } else if (item.feeType.code === 'TERM' || item.frequency === 'ANNUAL') {
            const dueMonths = item.dueMonths ? item.dueMonths.split(',').map(x => parseInt(x.trim(), 10)) : [5, 10];
            if (dueMonths.includes(m)) {
              shouldInclude = true;
              label = `Term Fee (${m === 5 ? 'May' : 'Oct'} ${currentYear})`;
            }
          }

          if (shouldInclude) {
            // Check if this month fee is already in billItems from DB
            const alreadyInBill = billItems.some(bi => bi.feeTypeId === item.feeTypeId && bi.month === m);
            const alreadyFullyPaid = existingFees.some(ef => ef.feeTypeId === item.feeTypeId && ef.month === m && Number(ef.remainingAmount) === 0);

            if (!alreadyInBill && !alreadyFullyPaid) {
              const amt = Number(item.amount);
              billItems.push({
                feeTypeId: item.feeTypeId,
                title: label,
                month: m,
                monthName: monthNames[m],
                amount: amt,
                paidAmount: 0,
                remainingAmount: amt,
                isAlreadyGenerated: false
              });
            }
          }
        }
      }
    }

    // 3. Check for student Transport Fee
    let transportInfo = null;
    if (student.usesTransport) {
      const activeTransport = await prisma.studentTransportAssignment.findFirst({
        where: {
          studentId,
          isActive: true
        },
        include: { route: true, stop: true }
      });

      if (activeTransport) {
        transportInfo = {
          routeName: activeTransport.route.name,
          stopName: activeTransport.stop.name,
          serviceType: activeTransport.serviceType,
          monthlyFee: Number(activeTransport.monthlyFee)
        };

        // Find or create TRANS fee type
        let transFeeType = await prisma.feeType.findFirst({
          where: { code: 'TRANS' }
        });
        if (!transFeeType) {
          transFeeType = await prisma.feeType.create({
            data: {
              name: 'Transport Fee',
              code: 'TRANS',
              frequency: 'MONTHLY',
              description: 'Monthly school bus and transport service fee'
            }
          });
        }

        const settings = await prisma.schoolSettings.findFirst();
        let allowedBillingMonths: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        if (settings?.transportBillingMonths) {
          allowedBillingMonths = settings.transportBillingMonths.split(',').map(x => parseInt(x.trim(), 10)).filter(x => !isNaN(x));
        }

        for (const m of targetMonths) {
          if (!allowedBillingMonths.includes(m)) continue;
          if (m < activeTransport.startMonth) continue;
          if (activeTransport.stopMonth && m > activeTransport.stopMonth) continue;

          const alreadyInBill = billItems.some(bi => bi.feeTypeId === transFeeType!.id && bi.month === m);
          const alreadyFullyPaid = existingFees.some(ef => ef.feeTypeId === transFeeType!.id && ef.month === m && Number(ef.remainingAmount) === 0);

          if (!alreadyInBill && !alreadyFullyPaid) {
            const amt = Number(activeTransport.monthlyFee);
            billItems.push({
              feeTypeId: transFeeType.id,
              title: `Transport Fee (${activeTransport.route.name} - ${activeTransport.stop.name}) (${monthNames[m]} ${currentYear})`,
              month: m,
              monthName: monthNames[m],
              amount: amt,
              paidAmount: 0,
              remainingAmount: amt,
              isAlreadyGenerated: false
            });
          }
        }
      }
    }

    // 4. Calculate Concessions / Discounts
    const activeDiscounts = await prisma.discountApplication.findMany({
      where: {
        studentId,
        status: 'APPROVED',
        isEnded: false,
        isDeleted: false
      },
      include: { discountRule: true }
    });

    const feeTypesList = await prisma.feeType.findMany();
    const feeTypeMap = new Map(feeTypesList.map(ft => [ft.id, ft]));

    let totalDiscountApplied = 0;
    const appliedConcessionDetails: Array<{
      ruleName: string;
      ruleCode: string;
      discountAmount: number;
      applicableHead: string;
    }> = [];

    // Apply discounts on ungenerated or active bill items
    for (const item of billItems) {
      if (item.paidAmount > 0) continue; // Skip items already partially paid
      const ft = feeTypeMap.get(item.feeTypeId);
      if (!ft) continue;

      for (const disc of activeDiscounts) {
        if (!disc.discountRule) continue;
        // Check fee head eligibility
        const heads = disc.discountRule.applicableFeeHeads
          ? disc.discountRule.applicableFeeHeads.split(',').map(h => h.trim().toUpperCase())
          : [];
        const isEligibleHead = heads.length === 0 || heads.includes(ft.code.toUpperCase()) || heads.includes(ft.name.toUpperCase());

        if (!isEligibleHead) continue;

        // Check month eligibility
        if (item.month) {
          if (disc.effectiveMonth && item.month < disc.effectiveMonth) continue;
          if (disc.endMonth && item.month > disc.endMonth) continue;
        }

        let discAmt = 0;
        if (disc.discountRule.type === 'PERCENTAGE') {
          const pct = Number(disc.discountRule.value);
          discAmt = Math.round((item.amount * pct) / 100);
        } else {
          discAmt = Number(disc.amount || disc.discountRule.value);
        }

        if (disc.discountRule.maxCapPerStudent && discAmt > Number(disc.discountRule.maxCapPerStudent)) {
          discAmt = Number(disc.discountRule.maxCapPerStudent);
        }

        discAmt = Math.min(discAmt, item.remainingAmount);

        if (discAmt > 0) {
          item.remainingAmount = Math.max(0, item.remainingAmount - discAmt);
          totalDiscountApplied += discAmt;
          appliedConcessionDetails.push({
            ruleName: disc.discountRule.name,
            ruleCode: disc.discountRule.code || 'CONC',
            discountAmount: discAmt,
            applicableHead: ft.name
          });
        }
      }
    }

    const totalDue = billItems.reduce((acc, it) => acc + it.remainingAmount, 0);

    res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          admissionNumber: student.admissionNumber,
          fullName: `${student.firstName} ${student.lastName}`.trim(),
          className: record.class.name,
          classId: record.classId,
          isHostelStudent: student.isHostelStudent,
          hostelRoomNumber: student.hostelRoomNumber,
          isNonAttending: student.isNonAttending,
          usesTransport: student.usesTransport,
          transportInfo
        },
        items: billItems,
        totalDue,
        totalDiscountApplied,
        appliedConcessions: appliedConcessionDetails
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Automatic Monthly Fee Generation (Bulk for classes)
// =============================================================

export const generateMonthlyFees = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { academicYearId, month, year, classId } = req.body;
    const targetMonth = parseInt(month, 10);
    const targetYear = parseInt(year, 10);

    if (!academicYearId || !targetMonth || !targetYear) {
      res.status(400).json({ success: false, message: 'academicYearId, month, and year are required' });
      return;
    }

    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[targetMonth] || `Month ${targetMonth}`;

    const records = await prisma.studentAcademicRecord.findMany({
      where: {
        academicYearId,
        student: { status: StudentStatus.ACTIVE },
        ...(classId ? { classId } : {})
      },
      include: {
        student: true,
        class: {
          include: {
            feeStructures: {
              where: { academicYearId },
              include: { items: { include: { feeType: true } } }
            }
          }
        }
      }
    });

    if (records.length === 0) {
      res.status(404).json({ success: false, message: 'No active students found for specified criteria' });
      return;
    }

    let generatedCount = 0;
    let skippedCount = 0;
    const dueDate = new Date(targetYear, targetMonth - 1, 15);

    for (const rec of records) {
      const feeStructure = rec.class.feeStructures[0];
      if (!feeStructure || !feeStructure.items) continue;

      for (const item of feeStructure.items) {
        if (!item.isActive) continue;
        if (item.appliesTo === 'NEW_ADMISSION_ONLY') continue;
        if (item.appliesTo === 'HOSTEL_ONLY' && !rec.student.isHostelStudent) continue;

        // Check frequency & due month
        let isApplicable = false;
        if (item.frequency === 'MONTHLY') {
          isApplicable = true;
        } else if (item.feeType.code === 'TERM' || item.frequency === 'ANNUAL') {
          const dueMonths = item.dueMonths ? item.dueMonths.split(',').map(x => parseInt(x.trim(), 10)) : [5, 10];
          if (dueMonths.includes(targetMonth)) {
            isApplicable = true;
          }
        }

        if (!isApplicable) continue;

        const existing = await prisma.studentFee.findUnique({
          where: {
            studentId_academicYearId_feeTypeId_month_year: {
              studentId: rec.studentId,
              academicYearId,
              feeTypeId: item.feeTypeId,
              month: targetMonth,
              year: targetYear
            }
          }
        });

        if (existing) {
          skippedCount++;
          continue;
        }

        const amt = Number(item.amount);
        await prisma.studentFee.create({
          data: {
            studentId: rec.studentId,
            academicYearId,
            feeTypeId: item.feeTypeId,
            month: targetMonth,
            year: targetYear,
            title: `${item.componentName || item.feeType.name} - ${monthName} ${targetYear}`,
            amount: amt,
            discountAmount: 0,
            netAmount: amt,
            paidAmount: 0,
            remainingAmount: amt,
            dueDate,
            status: FeeStatus.PENDING
          }
        });
        generatedCount++;
      }

      // Check if student has active transport assignment
      if (rec.student.usesTransport) {
        const transportAssignment = await prisma.studentTransportAssignment.findFirst({
          where: {
            studentId: rec.studentId,
            isActive: true
          },
          include: { route: true, stop: true }
        });

        if (transportAssignment && targetMonth >= transportAssignment.startMonth && (!transportAssignment.stopMonth || targetMonth <= transportAssignment.stopMonth)) {
          let transFeeType = await prisma.feeType.findFirst({ where: { code: 'TRANS' } });
          if (!transFeeType) {
            transFeeType = await prisma.feeType.create({
              data: {
                name: 'Transport Fee',
                code: 'TRANS',
                frequency: 'MONTHLY',
                description: 'Monthly school bus and transport service fee'
              }
            });
          }

          const existingTrans = await prisma.studentFee.findUnique({
            where: {
              studentId_academicYearId_feeTypeId_month_year: {
                studentId: rec.studentId,
                academicYearId,
                feeTypeId: transFeeType.id,
                month: targetMonth,
                year: targetYear
              }
            }
          });

          if (!existingTrans) {
            const transAmt = Number(transportAssignment.monthlyFee);
            await prisma.studentFee.create({
              data: {
                studentId: rec.studentId,
                academicYearId,
                feeTypeId: transFeeType.id,
                month: targetMonth,
                year: targetYear,
                title: `Transport Fee (${transportAssignment.route.name} - ${transportAssignment.stop.name}) - ${monthName} ${targetYear}`,
                amount: transAmt,
                discountAmount: 0,
                netAmount: transAmt,
                paidAmount: 0,
                remainingAmount: transAmt,
                dueDate,
                status: FeeStatus.PENDING
              }
            });
            generatedCount++;
          } else {
            skippedCount++;
          }
        }
      }
    }

    await broadcastNotification({
      title: 'Monthly Fee Batch Generated',
      message: `Generated ${generatedCount} fee records for ${monthName} ${targetYear} (${skippedCount} already existed).`,
      type: 'INFO',
      linkUrl: `/fees`
    });

    res.json({
      success: true,
      message: `Fee generation complete: ${generatedCount} items created, ${skippedCount} existing items skipped.`,
      generatedCount,
      skippedCount
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Pending Fees & Dues Query
// =============================================================

export const getPendingFees = async (req: Request, res: Response): Promise<void> => {
  try {
    const { classId, academicYearId, month, isHostel, usesTransport, feeTypeId } = req.query;

    const where: any = {
      remainingAmount: { gt: 0 }
    };

    if (academicYearId) where.academicYearId = academicYearId;
    if (month) where.month = parseInt(month as string, 10);
    if (feeTypeId) where.feeTypeId = feeTypeId;

    const studentWhere: any = {};
    if (classId) {
      studentWhere.academicRecords = { some: { classId } };
    }
    if (isHostel !== undefined) {
      studentWhere.isHostelStudent = isHostel === 'true';
    }
    if (usesTransport !== undefined) {
      studentWhere.usesTransport = usesTransport === 'true';
    }

    if (Object.keys(studentWhere).length > 0) {
      where.student = studentWhere;
    }

    const fees = await prisma.studentFee.findMany({
      where,
      include: {
        student: {
          include: {
            academicRecords: {
              include: { class: true, section: true },
              orderBy: { createdAt: 'desc' },
              take: 1
            },
            parents: {
              include: { parent: true },
              take: 1
            }
          }
        },
        feeType: true
      },
      orderBy: [{ dueDate: 'asc' }, { student: { firstName: 'asc' } }]
    });

    const totalOutstanding = fees.reduce((sum, f) => sum + Number(f.remainingAmount), 0);

    res.json({
      success: true,
      data: {
        totalOutstanding,
        feesCount: fees.length,
        fees
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Discounts & Concessions Module (Director Configured)
// =============================================================

export const getDiscountRules = async (req: Request, res: Response): Promise<void> => {
  try {
    const rules = await prisma.discountRule.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: rules });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createDiscountRule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, type, value, applicableFeeHeads, requiresApproval, description } = req.body;
    if (!name || !type || value === undefined) {
      res.status(400).json({ success: false, message: 'Name, type, and value are required' });
      return;
    }

    const rule = await prisma.discountRule.create({
      data: {
        name: name.trim(),
        type,
        value: parseFloat(value),
        applicableFeeHeads: applicableFeeHeads || null,
        requiresApproval: Boolean(requiresApproval),
        description
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'CREATE_DISCOUNT_RULE',
      module: 'DISCOUNTS',
      recordId: rule.id,
      newData: rule,
      ipAddress: req.ip
    });

    res.status(201).json({ success: true, data: rule, message: 'Discount rule created successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getPendingDiscountRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const requests = await prisma.discountApplication.findMany({
      where: { status: 'PENDING_APPROVAL' },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: requests });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const approveDiscountRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'APPROVED' or 'REJECTED'

    const updated = await prisma.discountApplication.update({
      where: { id },
      data: {
        status,
        approvedById: req.user?.id,
        approvedAt: new Date()
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'APPROVE_DISCOUNT',
      module: 'DISCOUNTS',
      recordId: id,
      newData: { status },
      ipAddress: req.ip
    });

    res.json({ success: true, message: `Discount application ${status.toLowerCase()} successfully`, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Custom Fee at Director's Discretion
// =============================================================

export const requestCustomFee = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { studentId, academicYearId, classId, feeHeadName, amount, reason } = req.body;

    if (!classId || !academicYearId || !feeHeadName || amount === undefined || !reason) {
      res.status(400).json({ success: false, message: 'All fields including mandatory reason are required' });
      return;
    }

    const settings = await prisma.schoolSettings.findFirst();
    const needsApproval = settings?.requireCustomFeeApproval ?? true;

    const request = await prisma.customFeeRequest.create({
      data: {
        studentId: studentId || null,
        academicYearId,
        classId,
        feeHeadName: feeHeadName.trim(),
        amount: parseFloat(amount),
        reason: reason.trim(),
        status: needsApproval ? 'PENDING' : 'APPROVED',
        requestedById: req.user?.id || 'staff',
        approvedById: needsApproval ? null : req.user?.id,
        approvedAt: needsApproval ? null : new Date()
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'REQUEST_CUSTOM_FEE',
      module: 'FEES',
      recordId: request.id,
      newData: request,
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      message: needsApproval ? 'Custom fee submitted for Director/Principal approval' : 'Custom fee approved automatically',
      data: request
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCustomFeeRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const requests = await prisma.customFeeRequest.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: requests });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const approveCustomFeeRequest = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'APPROVED' or 'REJECTED'

    const updated = await prisma.customFeeRequest.update({
      where: { id },
      data: {
        status,
        approvedById: req.user?.id,
        approvedAt: new Date()
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'APPROVE_CUSTOM_FEE',
      module: 'FEES',
      recordId: id,
      newData: { status },
      ipAddress: req.ip
    });

    res.json({ success: true, message: `Custom fee request marked as ${status}`, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
