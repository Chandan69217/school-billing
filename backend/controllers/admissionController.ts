import { Request, Response } from 'express';
import { PrismaClient, Gender, StudentStatus, FeeStatus } from '@prisma/client';
import { logAudit } from '../utils/audit.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { generateAdmissionPdf } from '../utils/admissionPdf.js';

const prisma = new PrismaClient();

export const processAdmission = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      studentInfo,
      parentInfo,
      academicInfo,
      documents
    } = req.body;

    if (!studentInfo?.firstName || !studentInfo?.lastName || !studentInfo?.dateOfBirth || !studentInfo?.gender) {
      res.status(400).json({ success: false, message: 'Student basic information is incomplete (first name, last name, DOB, gender required)' });
      return;
    }

    if (!parentInfo?.primaryPhone) {
      res.status(400).json({ success: false, message: 'Parent primary phone number is required' });
      return;
    }

    if (!academicInfo?.classId || !academicInfo?.academicYearId) {
      res.status(400).json({ success: false, message: 'Class and Academic Session are required' });
      return;
    }

    // Verify Academic Session & Check Admission Status
    const session = await prisma.academicYear.findUnique({
      where: { id: academicInfo.academicYearId },
      include: {
        _count: {
          select: { studentsAcademic: true }
        }
      }
    });

    if (!session) {
      res.status(400).json({ success: false, message: 'Selected Academic Session does not exist' });
      return;
    }

    if (session.admissionStatus === 'CLOSED') {
      res.status(400).json({
        success: false,
        message: `Admissions are currently marked CLOSED for Academic Session "${session.name}". Please open admissions in Session Manager or choose an active session.`
      });
      return;
    }

    // Check admission dates if configured
    const now = new Date();
    if (session.admissionEndDate && now > new Date(session.admissionEndDate)) {
      res.status(400).json({
        success: false,
        message: `The admission deadline for Session "${session.name}" passed on ${new Date(session.admissionEndDate).toLocaleDateString()}.`
      });
      return;
    }

    // Auto-generate admission number if not provided, incorporating session prefix
    let admissionNumber = academicInfo.admissionNumber?.trim();
    if (!admissionNumber) {
      const prefix = session.admissionPrefix || 'ADM';
      // extract start year from session name like "2026-27" -> "2026"
      const sessionYear = session.name.split('-')[0] || new Date().getFullYear();
      const count = await prisma.student.count();
      admissionNumber = `${prefix}-${sessionYear}-${(count + 1).toString().padStart(4, '0')}`;
    }

    // Execute in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Upsert Parent
      let parent = await tx.parent.findUnique({
        where: { primaryPhone: parentInfo.primaryPhone.trim() }
      });

      if (!parent) {
        parent = await tx.parent.create({
          data: {
            fatherName: parentInfo.fatherName || null,
            motherName: parentInfo.motherName || null,
            guardianName: parentInfo.guardianName || null,
            primaryPhone: parentInfo.primaryPhone.trim(),
            alternatePhone: parentInfo.alternatePhone || null,
            email: parentInfo.email ? parentInfo.email.trim().toLowerCase() : null,
            occupation: parentInfo.occupation || null,
            annualIncome: parentInfo.annualIncome || null,
            address: parentInfo.address || studentInfo.address || null,
          }
        });
      }

      // 2. Create Student
      const student = await tx.student.create({
        data: {
          admissionNumber,
          firstName: studentInfo.firstName.trim(),
          middleName: studentInfo.middleName?.trim() || null,
          lastName: studentInfo.lastName.trim(),
          dateOfBirth: new Date(studentInfo.dateOfBirth),
          gender: studentInfo.gender as Gender,
          bloodGroup: studentInfo.bloodGroup || null,
          aadhaarNumber: studentInfo.aadhaarNumber?.trim() || null,
          nationality: studentInfo.nationality || 'Indian',
          religion: studentInfo.religion || null,
          category: studentInfo.category || null,
          address: studentInfo.address || parentInfo.address || null,
          city: studentInfo.city || null,
          state: studentInfo.state || null,
          pincode: studentInfo.pincode || null,
          emergencyPhone: studentInfo.emergencyPhone || parentInfo.primaryPhone || null,
          photoUrl: studentInfo.photoUrl || null,
          status: StudentStatus.ACTIVE,
          admissionDate: academicInfo.admissionDate ? new Date(academicInfo.admissionDate) : new Date(),
          previousSchool: academicInfo.previousSchool || null,
          previousClass: academicInfo.previousClass || null,
        }
      });

      // 3. Link Student to Parent
      await tx.studentParent.create({
        data: {
          studentId: student.id,
          parentId: parent.id,
          relationship: parentInfo.relationship || 'Father',
          isPrimary: true
        }
      });

      // 4. Create Student Academic Record linked to session
      await tx.studentAcademicRecord.create({
        data: {
          studentId: student.id,
          academicYearId: academicInfo.academicYearId,
          classId: academicInfo.classId,
          sectionId: academicInfo.sectionId || null,
          rollNumber: academicInfo.rollNumber || null
        }
      });

      // 5. Store documents if provided
      if (documents && Array.isArray(documents) && documents.length > 0) {
        for (const doc of documents) {
          if (doc.title && doc.fileUrl) {
            await tx.studentDocument.create({
              data: {
                studentId: student.id,
                documentType: doc.documentType || 'OTHER',
                title: doc.title,
                fileUrl: doc.fileUrl,
                fileName: doc.fileName || doc.title,
                fileSize: doc.fileSize || 1024,
                mimeType: doc.mimeType || 'application/pdf',
              }
            });
          }
        }
      }

      // 6. Generate Initial Fees if fee structure exists for this session + class
      const feeStructure = await tx.feeStructure.findUnique({
        where: {
          academicYearId_classId: {
            academicYearId: academicInfo.academicYearId,
            classId: academicInfo.classId
          }
        },
        include: { items: { include: { feeType: true } } }
      });

      if (feeStructure && feeStructure.items.length > 0) {
        const currentMonth = new Date().getMonth() + 1; // 1-12
        const currentYear = new Date().getFullYear();

        for (const item of feeStructure.items) {
          const itemAmount = Number(item.amount);
          await tx.studentFee.create({
            data: {
              studentId: student.id,
              academicYearId: academicInfo.academicYearId,
              feeTypeId: item.feeTypeId,
              month: item.frequency === 'MONTHLY' ? currentMonth : null,
              year: currentYear,
              title: `${item.feeType.name} (${item.frequency === 'MONTHLY' ? `Month ${currentMonth}` : 'Annual'})`,
              amount: itemAmount,
              discountAmount: 0,
              fineAmount: 0,
              netAmount: itemAmount,
              paidAmount: 0,
              remainingAmount: itemAmount,
              dueDate: new Date(currentYear, currentMonth - 1, 15),
              status: FeeStatus.PENDING
            }
          });
        }
      }

      return { student, parent, admissionNumber, sessionName: session.name };
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'NEW_ADMISSION',
      module: 'ADMISSIONS',
      recordId: result.student.id,
      newData: {
        admissionNumber: result.admissionNumber,
        studentName: `${result.student.firstName} ${result.student.lastName}`,
        session: result.sessionName,
        classId: academicInfo.classId
      },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      message: `Student admission successfully registered for Session ${result.sessionName}!`,
      data: {
        studentId: result.student.id,
        admissionNumber: result.admissionNumber,
        studentName: `${result.student.firstName} ${result.student.lastName}`,
        sessionName: result.sessionName,
        admissionDate: result.student.admissionDate
      }
    });
  } catch (error: any) {
    console.error('Admission error:', error);
    res.status(500).json({ success: false, message: error.message || 'Admission failed' });
  }
};

/**
 * Upload Admission Document (Birth Certificate, Aadhaar, TC, Marksheet)
 */
export const uploadDocument = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded. Please select a valid document.' });
      return;
    }

    const fileUrl = `/uploads/documents/${req.file.filename}`;
    res.json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        fileUrl,
        fileName: req.file.originalname,
        storedName: req.file.filename,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      }
    });
  } catch (err: any) {
    console.error('Document upload error:', err);
    res.status(500).json({ success: false, message: err.message || 'Document upload failed' });
  }
};

/**
 * Cancel Student Admission
 */
export const cancelAdmission = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason, notes, cancelPendingFees = true } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({ success: false, message: 'A valid cancellation reason is required' });
      return;
    }

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        academicRecords: {
          include: { academicYear: true, class: true, section: true },
          orderBy: { createdAt: 'desc' }
        },
        studentFees: true
      }
    });

    if (!student) {
      res.status(404).json({ success: false, message: 'Student record not found' });
      return;
    }

    if (student.status === StudentStatus.CANCELLED) {
      res.status(400).json({ success: false, message: 'This student admission is already cancelled' });
      return;
    }

    const now = new Date();
    const updatedStudent = await prisma.$transaction(async (tx) => {
      const updated = await tx.student.update({
        where: { id },
        data: {
          status: StudentStatus.CANCELLED,
          cancellationReason: reason.trim(),
          cancellationNotes: notes ? notes.trim() : null,
          cancelledAt: now
        }
      });

      // Optionally waive any pending/overdue fees
      if (cancelPendingFees) {
        await tx.studentFee.updateMany({
          where: {
            studentId: id,
            status: { in: [FeeStatus.PENDING, FeeStatus.OVERDUE] }
          },
          data: {
            status: FeeStatus.WAIVED
          }
        });
      }

      return updated;
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'CANCEL_ADMISSION',
      module: 'ADMISSIONS',
      recordId: student.id,
      newData: {
        admissionNumber: student.admissionNumber,
        studentName: `${student.firstName} ${student.lastName}`,
        reason: reason.trim(),
        notes,
        cancelPendingFees,
        cancelledAt: now
      },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: `Admission for ${student.firstName} ${student.lastName} (${student.admissionNumber}) has been cancelled.`,
      data: updatedStudent
    });
  } catch (err: any) {
    console.error('Cancel admission error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to cancel admission' });
  }
};

/**
 * Generate and Stream Official Student Admission Slip PDF
 */
export const getAdmissionPdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        parents: { include: { parent: true } },
        academicRecords: {
          include: { academicYear: true, class: true, section: true },
          orderBy: { createdAt: 'desc' }
        },
        documents: true,
        studentFees: {
          take: 6,
          orderBy: { dueDate: 'asc' }
        }
      }
    });

    if (!student) {
      res.status(404).json({ success: false, message: 'Student record not found' });
      return;
    }

    const school = await prisma.schoolSettings.findFirst() || {
      schoolName: 'Pragya Bharti Public School',
      tagline: 'Knowledge, Character & Excellence (PBPS)',
      address: 'Plot 42, Sector 18, Institutional Area, Knowledge Park',
      phone: '+91 98765 43210',
      email: 'admissions@pbps.edu.in',
      registrationNumber: 'SCH-REG-2024-9981',
      principalName: 'Dr. V. K. Sharma, Principal',
      authorizedSignatory: 'Accounts Officer, PBPS'
    };

    const primaryParent = student.parents.find(p => p.isPrimary)?.parent || student.parents[0]?.parent;
    const currentAcademic = student.academicRecords[0];

    const pdfBuffer = await generateAdmissionPdf({
      school: {
        name: school.schoolName,
        tagline: school.tagline || undefined,
        address: school.address || 'Knowledge Park',
        phone: school.phone || '+91 98765 43210',
        email: school.email || 'admissions@pbps.edu.in',
        registrationNumber: school.registrationNumber || undefined,
        principalName: school.principalName || undefined,
        authorizedSignatory: school.authorizedSignatory || undefined
      },
      student: {
        admissionNumber: student.admissionNumber,
        admissionDate: new Date(student.admissionDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        fullName: [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' '),
        dateOfBirth: new Date(student.dateOfBirth).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        gender: student.gender,
        bloodGroup: student.bloodGroup || undefined,
        aadhaarNumber: student.aadhaarNumber || undefined,
        nationality: student.nationality,
        category: student.category || undefined,
        address: student.address || undefined,
        city: student.city || undefined,
        state: student.state || undefined,
        pincode: student.pincode || undefined,
        emergencyPhone: student.emergencyPhone || undefined,
        status: student.status,
        cancellationReason: student.cancellationReason || undefined,
        cancelledAt: student.cancelledAt ? new Date(student.cancelledAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined
      },
      academic: {
        sessionName: currentAcademic?.academicYear.name || '2026-27',
        className: currentAcademic?.class.name || 'Class 1',
        sectionName: currentAcademic?.section?.name || 'A',
        rollNumber: currentAcademic?.rollNumber || undefined
      },
      parent: {
        fatherName: primaryParent?.fatherName || undefined,
        motherName: primaryParent?.motherName || undefined,
        guardianName: primaryParent?.guardianName || undefined,
        primaryPhone: primaryParent?.primaryPhone || '—',
        alternatePhone: primaryParent?.alternatePhone || undefined,
        email: primaryParent?.email || undefined,
        occupation: primaryParent?.occupation || undefined,
        relationship: student.parents[0]?.relationship || 'Father'
      },
      documents: student.documents.map(d => ({
        title: d.title,
        documentType: d.documentType,
        fileName: d.fileName,
        uploaded: true
      })),
      fees: student.studentFees.map(f => ({
        title: f.title,
        amount: Number(f.amount)
      }))
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Admission_${student.admissionNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err: any) {
    console.error('Admission PDF generation error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to generate admission PDF' });
  }
};

