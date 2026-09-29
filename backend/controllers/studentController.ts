import { Request, Response } from 'express';
import { PrismaClient, StudentStatus } from '@prisma/client';
import { logAudit } from '../utils/audit.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const prisma = new PrismaClient();

export const getStudents = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string || '10', 10)));
    const search = (req.query.search as string || '').trim();
    const classId = req.query.classId as string;
    const sectionId = req.query.sectionId as string;
    const academicYearId = req.query.academicYearId as string;
    const status = req.query.status as string;

    const where: any = {};

    if (status && status !== 'ALL') {
      where.status = status as StudentStatus;
    }

    if (search) {
      where.OR = [
        { admissionNumber: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { aadhaarNumber: { contains: search } },
        { parents: { some: { parent: { primaryPhone: { contains: search } } } } },
        { parents: { some: { parent: { fatherName: { contains: search } } } } },
      ];
    }

    if (classId || sectionId || academicYearId) {
      where.academicRecords = {
        some: {
          ...(classId ? { classId } : {}),
          ...(sectionId ? { sectionId } : {}),
          ...(academicYearId ? { academicYearId } : {}),
        }
      };
    }

    const [total, students] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { admissionNumber: 'asc' },
        include: {
          academicRecords: {
            include: {
              class: true,
              section: true,
              academicYear: true
            },
            take: 1,
            orderBy: { createdAt: 'desc' }
          },
          parents: {
            include: { parent: true },
            where: { isPrimary: true },
            take: 1
          },
          studentFees: {
            select: {
              netAmount: true,
              paidAmount: true,
              remainingAmount: true,
              status: true
            }
          }
        }
      })
    ]);

    const formatted = students.map((s) => {
      const primaryParent = s.parents[0]?.parent;
      const currentAcademic = s.academicRecords[0];

      // Calculate aggregate fee status
      let totalFee = 0;
      let totalPaid = 0;
      let totalPending = 0;
      let hasOverdue = false;

      s.studentFees.forEach((fee) => {
        totalFee += Number(fee.netAmount);
        totalPaid += Number(fee.paidAmount);
        totalPending += Number(fee.remainingAmount);
        if (fee.status === 'OVERDUE') hasOverdue = true;
      });

      let calculatedFeeStatus = 'PAID';
      if (hasOverdue) calculatedFeeStatus = 'OVERDUE';
      else if (totalPending > 0 && totalPaid > 0) calculatedFeeStatus = 'PARTIAL';
      else if (totalPending > 0 && totalPaid === 0) calculatedFeeStatus = 'PENDING';

      return {
        id: s.id,
        admissionNumber: s.admissionNumber,
        fullName: `${s.firstName} ${s.middleName ? s.middleName + ' ' : ''}${s.lastName}`,
        firstName: s.firstName,
        lastName: s.lastName,
        photoUrl: s.photoUrl,
        gender: s.gender,
        dateOfBirth: s.dateOfBirth,
        status: s.status,
        admissionDate: s.admissionDate,
        className: currentAcademic?.class?.name || 'Unassigned',
        classId: currentAcademic?.classId,
        sectionName: currentAcademic?.section?.name || 'A',
        sectionId: currentAcademic?.sectionId,
        rollNumber: currentAcademic?.rollNumber || '',
        academicYear: currentAcademic?.academicYear?.name || '2026-27',
        parentName: primaryParent?.fatherName || primaryParent?.motherName || primaryParent?.guardianName || 'Parent',
        parentPhone: primaryParent?.primaryPhone || 'N/A',
        parentEmail: primaryParent?.email || '',
        feeStatus: calculatedFeeStatus,
        feeSummary: {
          total: totalFee,
          paid: totalPaid,
          pending: totalPending
        }
      };
    });

    res.json({
      success: true,
      data: formatted,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('getStudents error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getStudentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        parents: {
          include: { parent: true }
        },
        academicRecords: {
          include: { class: true, section: true, academicYear: true },
          orderBy: { createdAt: 'desc' }
        },
        studentFees: {
          include: { feeType: true },
          orderBy: [{ year: 'desc' }, { month: 'desc' }]
        },
        payments: {
          include: {
            receipt: true,
            collectedBy: { select: { fullName: true } }
          },
          orderBy: { paidAt: 'desc' }
        },
        receipts: {
          orderBy: { generatedAt: 'desc' }
        },
        documents: {
          orderBy: { uploadedAt: 'desc' }
        }
      }
    });

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found', errorCode: 'NOT_FOUND' });
      return;
    }

    // Compute fee metrics
    let totalFee = 0;
    let totalPaid = 0;
    let totalPending = 0;
    let totalOverdue = 0;

    student.studentFees.forEach((fee) => {
      totalFee += Number(fee.netAmount);
      totalPaid += Number(fee.paidAmount);
      totalPending += Number(fee.remainingAmount);
      if (fee.status === 'OVERDUE') {
        totalOverdue += Number(fee.remainingAmount);
      }
    });

    res.json({
      success: true,
      data: {
        ...student,
        feeSummary: {
          totalFee,
          paid: totalPaid,
          pending: totalPending,
          overdue: totalOverdue
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateStudent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = req.body;

    const updated = await prisma.student.update({
      where: { id },
      data: {
        firstName: data.firstName,
        middleName: data.middleName || null,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        gender: data.gender,
        bloodGroup: data.bloodGroup || null,
        aadhaarNumber: data.aadhaarNumber || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        pincode: data.pincode || null,
        emergencyPhone: data.emergencyPhone || null,
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'UPDATE_STUDENT',
      module: 'STUDENTS',
      recordId: id,
      newData: updated,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Student updated successfully', data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateStudentStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await prisma.student.update({
      where: { id },
      data: { status: status as StudentStatus }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'UPDATE_STATUS',
      module: 'STUDENTS',
      recordId: id,
      newData: { status },
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Student status updated successfully', data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
