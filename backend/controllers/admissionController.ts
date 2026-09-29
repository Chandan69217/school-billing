import { Request, Response } from 'express';
import { PrismaClient, Gender, StudentStatus, FeeStatus } from '@prisma/client';
import { logAudit } from '../utils/audit.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

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
