import { Request, Response } from 'express';
import { PrismaClient, FeeStatus } from '@prisma/client';
import { logAudit } from '../utils/audit.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const prisma = new PrismaClient();

// Academic Years / Sessions
export const getAcademicYears = async (req: Request, res: Response): Promise<void> => {
  try {
    const years = await prisma.academicYear.findMany({
      orderBy: { startDate: 'desc' },
      include: {
        _count: {
          select: {
            studentsAcademic: true,
            feeStructures: true,
            payments: true
          }
        },
        studentsAcademic: {
          select: {
            classId: true,
            class: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    const enriched = years.map(y => {
      // Group class counts
      const classCountsMap: Record<string, { classId: string; className: string; count: number }> = {};
      y.studentsAcademic.forEach(sa => {
        if (!classCountsMap[sa.classId]) {
          classCountsMap[sa.classId] = {
            classId: sa.classId,
            className: sa.class?.name || 'Unknown',
            count: 0
          };
        }
        classCountsMap[sa.classId].count += 1;
      });

      const { studentsAcademic, ...rest } = y;
      const enrolledCount = y._count.studentsAcademic;
      const target = y.targetEnrollment || 300;
      const capacityPercent = Math.min(100, Math.round((enrolledCount / target) * 100));

      return {
        ...rest,
        enrolledStudentsCount: enrolledCount,
        capacityPercent,
        classDistribution: Object.values(classCountsMap)
      };
    });

    res.json({ success: true, data: enriched });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createAcademicYear = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      name,
      startDate,
      endDate,
      isActive,
      admissionStatus = 'OPEN',
      admissionStartDate,
      admissionEndDate,
      admissionPrefix = 'ADM',
      targetEnrollment = 300,
      description
    } = req.body;

    if (!name || !startDate || !endDate) {
      res.status(400).json({ success: false, message: 'Name, startDate, and endDate are required' });
      return;
    }

    if (isActive) {
      await prisma.academicYear.updateMany({ data: { isActive: false } });
    }

    const year = await prisma.academicYear.create({
      data: {
        name: name.trim(),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: !!isActive,
        admissionStatus: admissionStatus || 'OPEN',
        admissionStartDate: admissionStartDate ? new Date(admissionStartDate) : null,
        admissionEndDate: admissionEndDate ? new Date(admissionEndDate) : null,
        admissionPrefix: admissionPrefix ? admissionPrefix.trim().toUpperCase() : 'ADM',
        targetEnrollment: targetEnrollment ? parseInt(String(targetEnrollment), 10) : 300,
        description: description ? description.trim() : null
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'CREATE_ACADEMIC_SESSION',
      module: 'ACADEMIC_YEARS',
      recordId: year.id,
      newData: year,
      ipAddress: req.ip
    });

    res.status(201).json({ success: true, data: year, message: 'Academic session created successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAcademicYear = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      startDate,
      endDate,
      admissionStatus,
      admissionStartDate,
      admissionEndDate,
      admissionPrefix,
      targetEnrollment,
      description,
      isArchived
    } = req.body;

    const existing = await prisma.academicYear.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Academic session not found' });
      return;
    }

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (startDate) updateData.startDate = new Date(startDate);
    if (endDate) updateData.endDate = new Date(endDate);
    if (admissionStatus !== undefined) updateData.admissionStatus = admissionStatus;
    if (admissionStartDate !== undefined) updateData.admissionStartDate = admissionStartDate ? new Date(admissionStartDate) : null;
    if (admissionEndDate !== undefined) updateData.admissionEndDate = admissionEndDate ? new Date(admissionEndDate) : null;
    if (admissionPrefix !== undefined) updateData.admissionPrefix = admissionPrefix ? admissionPrefix.trim().toUpperCase() : 'ADM';
    if (targetEnrollment !== undefined) updateData.targetEnrollment = parseInt(String(targetEnrollment), 10);
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (isArchived !== undefined) updateData.isArchived = !!isArchived;

    const updated = await prisma.academicYear.update({
      where: { id },
      data: updateData
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'UPDATE_ACADEMIC_SESSION',
      module: 'ACADEMIC_YEARS',
      recordId: id,
      oldData: existing,
      newData: updated,
      ipAddress: req.ip
    });

    res.json({ success: true, data: updated, message: 'Academic session updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const activateAcademicYear = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.$transaction([
      prisma.academicYear.updateMany({ data: { isActive: false } }),
      prisma.academicYear.update({
        where: { id },
        data: { isActive: true, isArchived: false }
      })
    ]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'ACTIVATE_ACADEMIC_YEAR',
      module: 'ACADEMIC_YEARS',
      recordId: id,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Academic session activated successfully as primary active session' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleAdmissionStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { admissionStatus } = req.body;

    if (!admissionStatus || !['OPEN', 'CLOSING_SOON', 'CLOSED', 'UPCOMING'].includes(admissionStatus)) {
      res.status(400).json({ success: false, message: 'Valid admission status is required (OPEN, CLOSING_SOON, CLOSED, UPCOMING)' });
      return;
    }

    const updated = await prisma.academicYear.update({
      where: { id },
      data: { admissionStatus }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'UPDATE_SESSION_ADMISSION_STATUS',
      module: 'ACADEMIC_YEARS',
      recordId: id,
      newData: { admissionStatus },
      ipAddress: req.ip
    });

    res.json({ success: true, data: updated, message: `Admission status updated to ${admissionStatus}` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSessionStudents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { classId } = req.query;

    const whereClause: any = {
      academicYearId: id
    };

    if (classId) {
      whereClause.classId = String(classId);
    }

    const records = await prisma.studentAcademicRecord.findMany({
      where: whereClause,
      include: {
        student: {
          include: {
            parents: {
              where: { isPrimary: true },
              include: { parent: true }
            },
            studentFees: {
              where: { academicYearId: id }
            }
          }
        },
        class: true,
        section: true
      },
      orderBy: [
        { class: { orderNumber: 'asc' } },
        { rollNumber: 'asc' },
        { student: { firstName: 'asc' } }
      ]
    });

    const students = records.map(rec => {
      const s = rec.student;
      const primaryParent = s.parents[0]?.parent;

      const totalFeeAmount = s.studentFees.reduce((acc, f) => acc + Number(f.amount), 0);
      const totalPaidAmount = s.studentFees.reduce((acc, f) => acc + Number(f.paidAmount), 0);
      const totalRemaining = s.studentFees.reduce((acc, f) => acc + Number(f.remainingAmount), 0);

      let feeStatus: 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE' = 'PAID';
      if (totalRemaining > 0) {
        if (totalPaidAmount > 0) feeStatus = 'PARTIAL';
        else feeStatus = 'PENDING';
      }

      return {
        recordId: rec.id,
        studentId: s.id,
        admissionNumber: s.admissionNumber,
        firstName: s.firstName,
        lastName: s.lastName,
        fullName: `${s.firstName} ${s.lastName}`,
        gender: s.gender,
        dateOfBirth: s.dateOfBirth,
        admissionDate: s.admissionDate,
        status: s.status,
        promoted: rec.promoted,
        rollNumber: rec.rollNumber,
        classId: rec.classId,
        className: rec.class.name,
        sectionId: rec.sectionId,
        sectionName: rec.section?.name || 'A',
        parentName: primaryParent ? (primaryParent.fatherName || primaryParent.motherName || primaryParent.guardianName) : 'N/A',
        parentPhone: primaryParent?.primaryPhone || 'N/A',
        parentEmail: primaryParent?.email || '',
        feeSummary: {
          totalAmount: totalFeeAmount,
          paidAmount: totalPaidAmount,
          remainingAmount: totalRemaining,
          feeStatus
        }
      };
    });

    res.json({ success: true, data: students, count: students.length });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const promoteStudents = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { fromSessionId, toSessionId, promotions } = req.body;

    if (!fromSessionId || !toSessionId || !Array.isArray(promotions) || promotions.length === 0) {
      res.status(400).json({ success: false, message: 'Source session, target session, and promotions list are required.' });
      return;
    }

    if (fromSessionId === toSessionId) {
      res.status(400).json({ success: false, message: 'Source and target academic sessions must be different.' });
      return;
    }

    const [fromSession, toSession] = await Promise.all([
      prisma.academicYear.findUnique({ where: { id: fromSessionId } }),
      prisma.academicYear.findUnique({ where: { id: toSessionId } })
    ]);

    if (!fromSession || !toSession) {
      res.status(404).json({ success: false, message: 'One or both academic sessions not found.' });
      return;
    }

    let successCount = 0;
    const promotedDetails: any[] = [];

    await prisma.$transaction(async (tx) => {
      for (const item of promotions) {
        const { studentId, toClassId, toSectionId, rollNumber } = item;
        if (!studentId || !toClassId) continue;

        // Check if student already has a record in the target session
        const existingRecord = await tx.studentAcademicRecord.findUnique({
          where: {
            studentId_academicYearId: {
              studentId,
              academicYearId: toSessionId
            }
          }
        });

        if (existingRecord) {
          // Update existing
          await tx.studentAcademicRecord.update({
            where: { id: existingRecord.id },
            data: {
              classId: toClassId,
              sectionId: toSectionId || null,
              rollNumber: rollNumber || existingRecord.rollNumber
            }
          });
        } else {
          // Create new record in target session
          await tx.studentAcademicRecord.create({
            data: {
              studentId,
              academicYearId: toSessionId,
              classId: toClassId,
              sectionId: toSectionId || null,
              rollNumber: rollNumber || null,
              promoted: false
            }
          });
        }

        // Mark source session record as promoted
        await tx.studentAcademicRecord.updateMany({
          where: {
            studentId,
            academicYearId: fromSessionId
          },
          data: { promoted: true }
        });

        // Initialize target session fee structure if exists
        const feeStructure = await tx.feeStructure.findUnique({
          where: {
            academicYearId_classId: {
              academicYearId: toSessionId,
              classId: toClassId
            }
          },
          include: { items: { include: { feeType: true } } }
        });

        if (feeStructure && feeStructure.items.length > 0) {
          const currentMonth = new Date().getMonth() + 1;
          const currentYear = new Date().getFullYear();

          for (const fItem of feeStructure.items) {
            const amount = Number(fItem.amount);
            // check if fee already exists
            const feeExists = await tx.studentFee.findFirst({
              where: {
                studentId,
                academicYearId: toSessionId,
                feeTypeId: fItem.feeTypeId
              }
            });

            if (!feeExists) {
              await tx.studentFee.create({
                data: {
                  studentId,
                  academicYearId: toSessionId,
                  feeTypeId: fItem.feeTypeId,
                  month: fItem.frequency === 'MONTHLY' ? currentMonth : null,
                  year: currentYear,
                  title: `${fItem.feeType.name} (${toSession.name})`,
                  amount,
                  discountAmount: 0,
                  fineAmount: 0,
                  netAmount: amount,
                  paidAmount: 0,
                  remainingAmount: amount,
                  dueDate: new Date(currentYear, currentMonth - 1, 15),
                  status: FeeStatus.PENDING
                }
              });
            }
          }
        }

        successCount++;
        promotedDetails.push({ studentId, toClassId });
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'PROMOTE_STUDENTS_SESSION',
      module: 'ACADEMIC_YEARS',
      recordId: toSessionId,
      newData: {
        fromSession: fromSession.name,
        toSession: toSession.name,
        promotedCount: successCount
      },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: `Successfully promoted/enrolled ${successCount} student(s) to Session ${toSession.name}`,
      data: {
        count: successCount,
        fromSession: fromSession.name,
        toSession: toSession.name
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Classes & Sections
export const getClasses = async (req: Request, res: Response): Promise<void> => {
  try {
    const classes = await prisma.class.findMany({
      orderBy: { orderNumber: 'asc' },
      include: {
        sections: {
          orderBy: { name: 'asc' },
          include: {
            _count: {
              select: { academicRecords: true }
            }
          }
        },
        _count: {
          select: { academicRecords: true }
        }
      }
    });
    res.json({ success: true, data: classes });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createClass = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, orderNumber, description, sections } = req.body;
    if (!name) {
      res.status(400).json({ success: false, message: 'Class name is required' });
      return;
    }

    const cls = await prisma.class.create({
      data: {
        name,
        orderNumber: orderNumber ? parseInt(orderNumber, 10) : 0,
        description,
        sections: {
          create: (sections && Array.isArray(sections) && sections.length > 0)
            ? sections.map((s: string) => ({ name: s.trim() }))
            : [{ name: 'A' }]
        }
      },
      include: { sections: true }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'CREATE_CLASS',
      module: 'CLASSES',
      recordId: cls.id,
      newData: cls,
      ipAddress: req.ip
    });

    res.status(201).json({ success: true, data: cls, message: 'Class created successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createSection = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { classId } = req.params;
    const { name, capacity } = req.body;
    if (!name) {
      res.status(400).json({ success: false, message: 'Section name is required' });
      return;
    }

    const section = await prisma.section.create({
      data: {
        classId,
        name: name.trim().toUpperCase(),
        capacity: capacity ? parseInt(capacity, 10) : 40
      }
    });

    res.status(201).json({ success: true, data: section, message: 'Section created successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
