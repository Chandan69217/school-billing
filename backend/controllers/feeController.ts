import { Request, Response } from 'express';
import { PrismaClient, FeeStatus, StudentStatus } from '@prisma/client';
import { logAudit } from '../utils/audit.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const prisma = new PrismaClient();

// Fee Types
export const getFeeTypes = async (req: Request, res: Response): Promise<void> => {
  try {
    const types = await prisma.feeType.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { studentFees: true, structureItems: true } }
      }
    });
    res.json({ success: true, data: types });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createFeeType = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, code, frequency, description } = req.body;
    if (!name || !code) {
      res.status(400).json({ success: false, message: 'Fee type name and code are required' });
      return;
    }

    const feeType = await prisma.feeType.create({
      data: {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        frequency: frequency || 'MONTHLY',
        description
      }
    });

    res.status(201).json({ success: true, data: feeType, message: 'Fee type created successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Fee Structures
export const getFeeStructures = async (req: Request, res: Response): Promise<void> => {
  try {
    const academicYearId = req.query.academicYearId as string;
    const where: any = {};
    if (academicYearId) where.academicYearId = academicYearId;

    const structures = await prisma.feeStructure.findMany({
      where,
      include: {
        academicYear: true,
        class: true,
        items: {
          include: { feeType: true }
        }
      },
      orderBy: { class: { orderNumber: 'asc' } }
    });

    res.json({ success: true, data: structures });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createFeeStructure = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { academicYearId, classId, title, items } = req.body;
    if (!academicYearId || !classId || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: 'Academic Year, Class, and fee items are required' });
      return;
    }

    // Calculate total
    const totalAmount = items.reduce((sum: number, it: any) => sum + (parseFloat(it.amount) || 0), 0);

    const structure = await prisma.$transaction(async (tx) => {
      // Upsert structure
      const existing = await tx.feeStructure.findUnique({
        where: { academicYearId_classId: { academicYearId, classId } }
      });

      let strId = existing?.id;
      if (existing) {
        await tx.feeStructureItem.deleteMany({ where: { feeStructureId: existing.id } });
        await tx.feeStructure.update({
          where: { id: existing.id },
          data: { title: title || `${existing.title}`, totalAmount }
        });
      } else {
        const created = await tx.feeStructure.create({
          data: {
            academicYearId,
            classId,
            title: title || 'Standard Fee Structure',
            totalAmount
          }
        });
        strId = created.id;
      }

      // Add items
      for (const it of items) {
        await tx.feeStructureItem.create({
          data: {
            feeStructureId: strId!,
            feeTypeId: it.feeTypeId,
            amount: parseFloat(it.amount),
            frequency: it.frequency || 'MONTHLY',
            dueMonth: it.dueMonth ? parseInt(it.dueMonth, 10) : null
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
      newData: structure,
      ipAddress: req.ip
    });

    res.status(201).json({ success: true, data: structure, message: 'Fee structure saved successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Automatic Monthly Fee Generation
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

    // Find all active students in target academic year (and optional class)
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
              include: {
                items: {
                  include: { feeType: true }
                }
              }
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
        // Only generate for monthly items OR annual items if month matches
        if (item.frequency === 'MONTHLY' || (item.frequency === 'ANNUAL' && item.dueMonth === targetMonth)) {
          // Check for existing fee to prevent duplicate
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
              title: `${monthName} ${item.feeType.name}`,
              amount: amt,
              discountAmount: 0,
              fineAmount: 0,
              netAmount: amt,
              paidAmount: 0,
              remainingAmount: amt,
              dueDate,
              status: FeeStatus.PENDING
            }
          });
          generatedCount++;
        }
      }
    }

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'GENERATE_MONTHLY_FEES',
      module: 'FEES',
      newData: { month: targetMonth, year: targetYear, generatedCount, skippedCount },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: `Fee generation complete: ${generatedCount} fees generated, ${skippedCount} existing skipped to prevent duplicates.`,
      data: { generatedCount, skippedCount }
    });
  } catch (error: any) {
    console.error('generateMonthlyFees error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Pending Fees Dashboard
export const getPendingFees = async (req: Request, res: Response): Promise<void> => {
  try {
    const classId = req.query.classId as string;
    const academicYearId = req.query.academicYearId as string;
    const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;
    const status = req.query.status as string;

    const where: any = {
      remainingAmount: { gt: 0 }
    };

    if (academicYearId) where.academicYearId = academicYearId;
    if (month) where.month = month;
    if (status && status !== 'ALL') {
      where.status = status as FeeStatus;
    } else {
      where.status = { in: ['PENDING', 'PARTIAL', 'OVERDUE'] };
    }

    const fees = await prisma.studentFee.findMany({
      where,
      include: {
        feeType: true,
        academicYear: true,
        student: {
          include: {
            academicRecords: {
              where: academicYearId ? { academicYearId } : undefined,
              include: { class: true, section: true },
              take: 1
            },
            parents: {
              include: { parent: true },
              take: 1
            }
          }
        }
      },
      orderBy: { dueDate: 'asc' }
    });

    const now = new Date();

    const formatted = fees
      .filter((f) => {
        if (!classId) return true;
        return f.student.academicRecords[0]?.classId === classId;
      })
      .map((f) => {
        const dueDate = new Date(f.dueDate);
        const diffTime = now.getTime() - dueDate.getTime();
        const daysOverdue = diffTime > 0 ? Math.floor(diffTime / (1000 * 60 * 60 * 24)) : 0;
        const currentStatus = daysOverdue > 0 && f.status !== 'PAID' ? 'OVERDUE' : f.status;

        const parent = f.student.parents[0]?.parent;
        const academic = f.student.academicRecords[0];

        return {
          id: f.id,
          studentId: f.student.id,
          admissionNumber: f.student.admissionNumber,
          studentName: `${f.student.firstName} ${f.student.lastName}`,
          className: academic?.class?.name || 'Class 8',
          sectionName: academic?.section?.name || 'A',
          parentName: parent?.fatherName || parent?.motherName || 'Parent',
          parentPhone: parent?.primaryPhone || 'N/A',
          parentEmail: parent?.email || '',
          feeTitle: f.title,
          feeType: f.feeType.name,
          month: f.month,
          year: f.year,
          netAmount: Number(f.netAmount),
          paidAmount: Number(f.paidAmount),
          remainingAmount: Number(f.remainingAmount),
          dueDate: f.dueDate,
          daysOverdue,
          status: currentStatus
        };
      });

    res.json({ success: true, data: formatted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
