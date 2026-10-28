import { Request, Response } from 'express';
import { PrismaClient, StudentStatus, FeeStatus, FeeFrequency } from '@prisma/client';
import { logAudit } from '../utils/audit.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { maskAadhaar } from '../utils/verhoeff.js';

const prisma = new PrismaClient();

// Helper to check sensitive data viewing permission
const canViewSensitiveData = (req: AuthenticatedRequest): boolean => {
  const permissions = req.user?.permissions || [];
  const role = req.user?.role || '';
  return permissions.includes('sensitive.view') || ['SUPER_ADMIN', 'DIRECTOR', 'PRINCIPAL'].includes(role);
};

export const getStudents = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.max(1, Math.min(500, parseInt(req.query.limit as string || '10', 10)));
    const search = (req.query.search as string || '').trim();
    const classId = req.query.classId as string;
    const sectionId = req.query.sectionId as string;
    const academicYearId = req.query.academicYearId as string;
    const status = req.query.status as string;
    const isHostel = req.query.isHostel as string;

    const where: any = {};

    // Status filter - defaults to ACTIVE if status not specified or empty, but respects ALL or explicit filters
    if (status && status !== 'ALL') {
      where.status = status as StudentStatus;
    } else if (!status) {
      // Default to ACTIVE for standard views
      where.status = StudentStatus.ACTIVE;
    }

    if (isHostel !== undefined && isHostel !== '') {
      where.isHostelStudent = isHostel === 'true';
    }

    if (search) {
      where.OR = [
        { admissionNumber: { contains: search } },
        { firstName: { contains: search} },
        { lastName: { contains: search } },
        { aadhaarNumber: { contains: search } },
        { parents: { some: { parent: { primaryPhone: { contains: search } } } } },
        { parents: { some: { parent: { fatherName: { contains: search } } } } },
        { parents: { some: { parent: { motherName: { contains: search} } } } },
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

    const showFullSensitive = canViewSensitiveData(req);

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
        fullName: `${s.firstName} ${s.middleName ? s.middleName + ' ' : ''}${s.lastName}`.trim(),
        firstName: s.firstName,
        lastName: s.lastName,
        photoUrl: s.photoUrl,
        gender: s.gender,
        dateOfBirth: s.dateOfBirth,
        status: s.status,
        isHostelStudent: s.isHostelStudent,
        hostelRoomNumber: s.hostelRoomNumber,
        isNonAttending: s.isNonAttending,
        usesTransport: s.usesTransport,
        // Aadhaar numbers masked if user lacks sensitive.view permission (Part B2)
        aadhaarNumber: showFullSensitive ? s.aadhaarNumber : maskAadhaar(s.aadhaarNumber),
        fatherAadhaarNumber: showFullSensitive ? s.fatherAadhaarNumber : maskAadhaar(s.fatherAadhaarNumber),
        motherAadhaarNumber: showFullSensitive ? s.motherAadhaarNumber : maskAadhaar(s.motherAadhaarNumber),
        cancellationReason: s.cancellationReason,
        cancelledAt: s.cancelledAt,
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

export const getStudentById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' }
        },
        leavingCertificate: true,
        feeWaivers: {
          include: { studentFee: true },
          orderBy: { waivedAt: 'desc' }
        },
        transportAssignments: {
          include: { route: true, stop: true },
          orderBy: { createdAt: 'desc' }
        },
        transportHistory: {
          include: { route: true, stop: true },
          orderBy: { createdAt: 'desc' }
        },
        discountApplications: {
          include: { discountRule: true },
          orderBy: { createdAt: 'desc' }
        },
        storeSales: {
          include: { items: { include: { item: true } }, returns: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found', errorCode: 'NOT_FOUND' });
      return;
    }

    const showFullSensitive = canViewSensitiveData(req);

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

    // Mask sensitive fields if not permitted
    const sanitizedStudent = {
      ...student,
      aadhaarNumber: showFullSensitive ? student.aadhaarNumber : maskAadhaar(student.aadhaarNumber),
      fatherAadhaarNumber: showFullSensitive ? student.fatherAadhaarNumber : maskAadhaar(student.fatherAadhaarNumber),
      motherAadhaarNumber: showFullSensitive ? student.motherAadhaarNumber : maskAadhaar(student.motherAadhaarNumber),
      parents: student.parents.map(p => ({
        ...p,
        parent: {
          ...p.parent,
          fatherAadhaarNumber: showFullSensitive ? p.parent.fatherAadhaarNumber : maskAadhaar(p.parent.fatherAadhaarNumber),
          motherAadhaarNumber: showFullSensitive ? p.parent.motherAadhaarNumber : maskAadhaar(p.parent.motherAadhaarNumber)
        }
      })),
      feeSummary: {
        totalFee,
        paid: totalPaid,
        pending: totalPending,
        overdue: totalOverdue
      },
      schoolLeavingCertificates: student.leavingCertificate ? [student.leavingCertificate] : []
    };

    res.json({
      success: true,
      data: sanitizedStudent
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateStudent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const data = req.body;

    const student = await prisma.student.findUnique({
      where: { id },
      include: { academicRecords: true }
    });

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    const wasHostel = student.isHostelStudent;
    const isNowHostel = data.isHostelStudent !== undefined ? Boolean(data.isHostelStudent) : wasHostel;

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.student.update({
        where: { id },
        data: {
          firstName: data.firstName !== undefined ? data.firstName.trim() : undefined,
          middleName: data.middleName !== undefined ? (data.middleName?.trim() || null) : undefined,
          lastName: data.lastName !== undefined ? data.lastName.trim() : undefined,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
          gender: data.gender,
          bloodGroup: data.bloodGroup || null,
          aadhaarNumber: data.aadhaarNumber || null,
          fatherAadhaarNumber: data.fatherAadhaarNumber || null,
          motherAadhaarNumber: data.motherAadhaarNumber || null,
          photoUrl: data.photoUrl !== undefined ? data.photoUrl : undefined,
          // Residence address
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          pincode: data.pincode || null,
          // Present address
          sameAsResidence: data.sameAsResidence !== undefined ? Boolean(data.sameAsResidence) : undefined,
          presentAddress: data.presentAddress || null,
          presentCity: data.presentCity || null,
          presentState: data.presentState || null,
          presentPincode: data.presentPincode || null,
          // Previous school details
          isPreviouslyEnrolled: data.isPreviouslyEnrolled !== undefined ? Boolean(data.isPreviouslyEnrolled) : undefined,
          previousSchoolName: data.previousSchoolName || null,
          previousClassPassed: data.previousClassPassed || null,
          previousMedium: data.previousMedium || null,
          previousLeavingDate: data.previousLeavingDate ? new Date(data.previousLeavingDate) : null,
          previousTcNumber: data.previousTcNumber || null,
          previousTcDate: data.previousTcDate ? new Date(data.previousTcDate) : null,
          emergencyPhone: data.emergencyPhone || null,
          isHostelStudent: isNowHostel,
          hostelRoomNumber: isNowHostel ? (data.hostelRoomNumber || student.hostelRoomNumber) : null,
          hostelAdmissionDate: isNowHostel ? (data.hostelAdmissionDate ? new Date(data.hostelAdmissionDate) : (student.hostelAdmissionDate || new Date())) : null,
          isNonAttending: data.isNonAttending !== undefined ? Boolean(data.isNonAttending) : undefined
        }
      });

      // Update parent record if parent details provided
      if (data.parentInfo && data.parentInfo.id) {
        await tx.parent.update({
          where: { id: data.parentInfo.id },
          data: {
            fatherName: data.parentInfo.fatherName || undefined,
            motherName: data.parentInfo.motherName || undefined,
            fatherAadhaarNumber: data.fatherAadhaarNumber || undefined,
            motherAadhaarNumber: data.motherAadhaarNumber || undefined
          }
        });
      }

      return u;
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'UPDATE_STUDENT',
      module: 'STUDENTS',
      recordId: id,
      newData: { ...updated, hostelStatusChanged: wasHostel !== isNowHostel },
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Student updated successfully', data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================================
// PART C3: STUDENT STATUS ACTIONS & LIFECYCLE (ACTIVE, INACTIVE, WITHDRAWN, CANCELLED)
// =====================================================================
export const updateStudentStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status: targetStatus, reason, effectiveDate, generateSlc } = req.body;

    if (!targetStatus || !['ACTIVE', 'INACTIVE', 'WITHDRAWN', 'CANCELLED'].includes(targetStatus)) {
      res.status(400).json({ success: false, message: 'Valid status is required (ACTIVE, INACTIVE, WITHDRAWN, CANCELLED).' });
      return;
    }

    if (!reason || !reason.trim()) {
      res.status(400).json({ success: false, message: 'Status change reason is mandatory.' });
      return;
    }

    const effDate = effectiveDate ? new Date(effectiveDate) : new Date();
    if (isNaN(effDate.getTime())) {
      res.status(400).json({ success: false, message: 'Please provide a valid effective date.' });
      return;
    }

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        parents: { include: { parent: true } },
        academicRecords: {
          include: { class: true, section: true, academicYear: true },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        studentFees: {
          where: { remainingAmount: { gt: 0 } }
        }
      }
    });

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' });
      return;
    }

    const currentStatus = student.status;

    // Check transition rules
    const ALLOWED_TRANSITIONS: Record<string, string[]> = {
      ACTIVE: ['INACTIVE', 'WITHDRAWN', 'CANCELLED'],
      INACTIVE: ['ACTIVE', 'WITHDRAWN', 'CANCELLED'],
      WITHDRAWN: ['ACTIVE', 'CANCELLED'],
      CANCELLED: ['ACTIVE'] // Only Super Admin
    };

    if (!ALLOWED_TRANSITIONS[currentStatus]?.includes(targetStatus)) {
      res.status(400).json({
        success: false,
        message: `Invalid status transition from ${currentStatus} to ${targetStatus}.`
      });
      return;
    }

    // Cancelled is final: can only be reactivated by SUPER_ADMIN
    if (currentStatus === StudentStatus.CANCELLED) {
      if (req.user?.role !== 'SUPER_ADMIN') {
        res.status(403).json({
          success: false,
          message: 'Cancelled admission is final and can only be reactivated by a Super Admin with reason.'
        });
        return;
      }
    }

    let generatedSlcRecord = null;

    const updated = await prisma.$transaction(async (tx) => {
      // If WITHDRAWN with generateSlc requested
      if (targetStatus === 'WITHDRAWN' && generateSlc) {
        const parentRecord = student.parents[0]?.parent;
        const academicRecord = student.academicRecords[0];
        const currentYear = new Date().getFullYear();
        const slcCount = await tx.schoolLeavingCertificate.count();
        const certificateNumber = `SLC-${currentYear}-${(slcCount + 1).toString().padStart(4, '0')}`;

        const totalDues = student.studentFees.reduce((sum, f) => sum + Number(f.remainingAmount), 0);

        generatedSlcRecord = await tx.schoolLeavingCertificate.create({
          data: {
            certificateNumber,
            studentId: student.id,
            studentName: `${student.firstName} ${student.middleName ? student.middleName + ' ' : ''}${student.lastName}`.trim(),
            photoUrl: student.photoUrl || null,
            admissionNumber: student.admissionNumber,
            fatherName: parentRecord?.fatherName || 'N/A',
            motherName: parentRecord?.motherName || 'N/A',
            dateOfBirth: student.dateOfBirth,
            nationality: student.nationality || 'Indian',
            category: student.category || 'General',
            classAdmitted: academicRecord?.class?.name || 'Standard',
            classLastStudied: academicRecord?.class?.name || 'Standard',
            admissionDate: student.admissionDate,
            leavingDate: effDate,
            reasonForLeaving: reason.trim(),
            feeDuesStatus: totalDues > 0 ? `Dues Pending: ₹${totalDues}` : 'All dues cleared',
            conduct: 'Good',
            remarks: `Withdrawn on request: ${reason.trim()}`,
            issueDate: new Date(),
            issuedById: req.user?.id || 'SYSTEM',
            issuedByName: req.user?.fullName || 'Principal / Administrator',
            reprintCount: 0
          }
        });
      }

      // Update student status
      const u = await tx.student.update({
        where: { id },
        data: {
          status: targetStatus as StudentStatus,
          withdrawalDate: targetStatus === 'WITHDRAWN' ? effDate : undefined,
          withdrawalReason: targetStatus === 'WITHDRAWN' ? reason.trim() : undefined,
          cancellationReason: targetStatus === 'CANCELLED' ? reason.trim() : undefined,
          cancelledAt: targetStatus === 'CANCELLED' ? effDate : undefined
        }
      });

      // Record in status history table (timeline)
      await tx.studentStatusHistory.create({
        data: {
          studentId: id,
          fromStatus: currentStatus,
          toStatus: targetStatus as StudentStatus,
          reason: reason.trim(),
          changedById: req.user?.id || null,
          changedByName: req.user?.fullName || 'Administrator',
          effectiveDate: effDate
        }
      });

      return u;
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'UPDATE_STUDENT_STATUS',
      module: 'STUDENTS',
      recordId: id,
      newData: {
        previousStatus: currentStatus,
        newStatus: targetStatus,
        effectiveDate: effDate,
        reason: reason.trim(),
        slcGenerated: Boolean(generatedSlcRecord)
      },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: `Student status successfully changed from ${currentStatus} to ${targetStatus}.`,
      data: {
        student: updated,
        slc: generatedSlcRecord
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const addStudentDocument = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, documentType } = req.body;

    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }

    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    const fileUrl = `/uploads/documents/${req.file.filename}`;
    const doc = await prisma.studentDocument.create({
      data: {
        studentId: id,
        documentType: documentType || 'OTHER',
        title: title || req.file.originalname,
        fileUrl,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'UPLOAD_DOCUMENT',
      module: 'STUDENTS',
      recordId: id,
      newData: { documentId: doc.id, title: doc.title, fileName: doc.fileName },
      ipAddress: req.ip
    });

    res.status(201).json({ success: true, message: 'Document added successfully', data: doc });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
