import { Request, Response } from 'express';
import { PrismaClient, Gender, StudentStatus, FeeStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { logAudit } from '../utils/audit.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { generateAdmissionPdf } from '../utils/admissionPdf.js';
import { generateSlcPdf } from '../utils/slcPdf.js';
import { validateAadhaarNumber, cleanAadhaarDigits, maskAadhaar } from '../utils/verhoeff.js';
import { verifyImageMagicBytes, savePhotoBuffer } from '../middleware/upload.js';

const prisma = new PrismaClient();

// Student Photo Upload endpoint with magic bytes check and strict 200 KB limit
export const uploadPhoto = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'Please select an image file to upload.' });
      return;
    }

    if (req.file.size > 200 * 1024) {
      res.status(400).json({
        success: false,
        message: `Photo must be less than 200 KB (selected: ${(req.file.size / 1024).toFixed(1)} KB).`
      });
      return;
    }

    const { isValid, extension } = verifyImageMagicBytes(req.file.buffer);
    if (!isValid) {
      res.status(400).json({
        success: false,
        message: 'Invalid image format. Only authentic JPG, JPEG, and PNG images are accepted.'
      });
      return;
    }

    const photoUrl = savePhotoBuffer(req.file.buffer, extension);

    res.json({
      success: true,
      message: 'Student photograph uploaded successfully.',
      data: {
        photoUrl,
        size: req.file.size
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const processAdmission = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      studentInfo,
      parentInfo,
      academicInfo,
      documents,
      customFeeInfo,
      paymentInfo
    } = req.body;

    const errors: Record<string, string> = {};

    // 1. Student basic validation
    const firstName = (studentInfo?.firstName || '').trim();
    const lastName = (studentInfo?.lastName || '').trim();

    if (!firstName) {
      errors['studentInfo.firstName'] = 'First name is required.';
    } else if (!/^[A-Za-z\s.'-]+$/.test(firstName) || firstName.length < 2) {
      errors['studentInfo.firstName'] = 'First name must contain at least 2 alphabetic characters.';
    }

    if (!lastName) {
      errors['studentInfo.lastName'] = 'Last name is required.';
    } else if (!/^[A-Za-z\s.'-]+$/.test(lastName) || lastName.length < 2) {
      errors['studentInfo.lastName'] = 'Last name must contain at least 2 alphabetic characters.';
    }

    if (!studentInfo?.gender) {
      errors['studentInfo.gender'] = 'Please select student gender.';
    }

    if (!studentInfo?.dateOfBirth) {
      errors['studentInfo.dateOfBirth'] = 'Date of birth is required.';
    } else {
      const dob = new Date(studentInfo.dateOfBirth);
      const now = new Date();
      if (isNaN(dob.getTime())) {
        errors['studentInfo.dateOfBirth'] = 'Invalid date of birth.';
      } else if (dob >= now) {
        errors['studentInfo.dateOfBirth'] = 'Date of birth cannot be today or in the future.';
      } else {
        const ageYears = (now.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (ageYears < 2.5 || ageYears > 25) {
          errors['studentInfo.dateOfBirth'] = 'Student age must be between 3 and 25 years.';
        }
      }
    }

    // 2. Student Aadhaar Validation (Optional, but if given must pass Verhoeff)
    if (studentInfo?.aadhaarNumber) {
      const rawAadhaar = cleanAadhaarDigits(studentInfo.aadhaarNumber);
      if (rawAadhaar.length > 0) {
        const valRes = validateAadhaarNumber(rawAadhaar);
        if (!valRes.valid) {
          errors['studentInfo.aadhaarNumber'] = valRes.message || 'Invalid student Aadhaar number.';
        }
      }
    }

    // 3. Parent Info Validation
    const parentPhone = (parentInfo?.primaryPhone || '').trim();
    if (!parentPhone) {
      errors['parentInfo.primaryPhone'] = 'Parent primary phone number is required.';
    } else if (!/^[6-9]\d{9}$/.test(parentPhone.replace(/[\s-]/g, ''))) {
      errors['parentInfo.primaryPhone'] = 'Phone must be a valid 10-digit Indian mobile number starting with 6-9.';
    }

    if (parentInfo?.email && parentInfo.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(parentInfo.email.trim())) {
        errors['parentInfo.email'] = 'Invalid email address format.';
      }
    }

    // 4. Parents' Aadhaar Validation
    if (studentInfo?.fatherAadhaarNumber || parentInfo?.fatherAadhaarNumber) {
      const fa = cleanAadhaarDigits(studentInfo?.fatherAadhaarNumber || parentInfo?.fatherAadhaarNumber);
      if (fa.length > 0) {
        const valRes = validateAadhaarNumber(fa);
        if (!valRes.valid) {
          errors['parentInfo.fatherAadhaarNumber'] = valRes.message || 'Invalid Father\'s Aadhaar number.';
        }
      }
    }

    if (studentInfo?.motherAadhaarNumber || parentInfo?.motherAadhaarNumber) {
      const ma = cleanAadhaarDigits(studentInfo?.motherAadhaarNumber || parentInfo?.motherAadhaarNumber);
      if (ma.length > 0) {
        const valRes = validateAadhaarNumber(ma);
        if (!valRes.valid) {
          errors['parentInfo.motherAadhaarNumber'] = valRes.message || 'Invalid Mother\'s Aadhaar number.';
        }
      }
    }

    // 5. Academic Info & Archived Session Check
    if (!academicInfo?.classId) {
      errors['academicInfo.classId'] = 'Class is required.';
    }

    if (!academicInfo?.academicYearId) {
      errors['academicInfo.academicYearId'] = 'Academic session is required.';
    }

    let session = null;
    if (academicInfo?.academicYearId) {
      session = await prisma.academicYear.findUnique({
        where: { id: academicInfo.academicYearId }
      });

      if (!session) {
        errors['academicInfo.academicYearId'] = 'Selected academic session does not exist.';
      } else if (session.isArchived) {
        // Enforce PART A2: Block creating admissions with an archived session on server side too
        errors['academicInfo.academicYearId'] = `Academic session "${session.name}" is archived. Admissions cannot be created in an archived session.`;
      } else if (session.admissionStatus === 'CLOSED') {
        errors['academicInfo.academicYearId'] = `Admissions are currently marked CLOSED for session "${session.name}".`;
      }
    }

    // 6. Previous School Details (PART B4)
    const isPreviouslyEnrolled = Boolean(studentInfo?.isPreviouslyEnrolled || academicInfo?.isPreviouslyEnrolled);
    if (isPreviouslyEnrolled) {
      const prevSchoolName = (studentInfo?.previousSchoolName || academicInfo?.previousSchool || '').trim();
      const prevClass = (studentInfo?.previousClassPassed || academicInfo?.previousClass || '').trim();
      const prevMedium = (studentInfo?.previousMedium || '').trim();
      const prevLeavingDate = studentInfo?.previousLeavingDate || academicInfo?.previousLeavingDate;

      if (!prevSchoolName) {
        errors['studentInfo.previousSchoolName'] = 'Previous school name is required for transfer students.';
      }
      if (!prevClass) {
        errors['studentInfo.previousClassPassed'] = 'Class passed at previous school is required.';
      }
      if (!prevMedium) {
        errors['studentInfo.previousMedium'] = 'Medium of instruction at previous school is required.';
      }

      if (!prevLeavingDate) {
        errors['studentInfo.previousLeavingDate'] = 'Last date of leaving previous school is required.';
      } else {
        const lDate = new Date(prevLeavingDate);
        const admDate = academicInfo?.admissionDate ? new Date(academicInfo.admissionDate) : new Date();
        const today = new Date();

        if (isNaN(lDate.getTime())) {
          errors['studentInfo.previousLeavingDate'] = 'Invalid date of leaving previous school.';
        } else if (lDate > today) {
          errors['studentInfo.previousLeavingDate'] = 'Date of leaving previous school cannot be in the future.';
        } else if (lDate > admDate) {
          errors['studentInfo.previousLeavingDate'] = 'Date of leaving previous school cannot be after admission date.';
        }
      }
    }

    // Return field-level errors if validation failed
    if (Object.keys(errors).length > 0) {
      res.status(400).json({
        success: false,
        message: Object.values(errors)[0],
        errors
      });
      return;
    }

    // Auto-generate admission number if not provided
    let admissionNumber = academicInfo.admissionNumber?.trim();
    if (!admissionNumber) {
      const prefix = session?.admissionPrefix || 'PBPS';
      const yearStr = session?.name.split('-')[0] || new Date().getFullYear();
      const count = await prisma.student.count();
      admissionNumber = `${prefix}-${yearStr}-${(count + 1).toString().padStart(4, '0')}`;
    }

    const isHostel = Boolean(studentInfo.isHostelStudent);
    const isNonAttending = Boolean(academicInfo.isNonAttending);
    const sameAsResidence = Boolean(studentInfo.sameAsResidence ?? true);

    const cleanStudentAadhaar = studentInfo.aadhaarNumber ? cleanAadhaarDigits(studentInfo.aadhaarNumber) : null;
    const cleanFatherAadhaar = (studentInfo.fatherAadhaarNumber || parentInfo.fatherAadhaarNumber)
      ? cleanAadhaarDigits(studentInfo.fatherAadhaarNumber || parentInfo.fatherAadhaarNumber)
      : null;
    const cleanMotherAadhaar = (studentInfo.motherAadhaarNumber || parentInfo.motherAadhaarNumber)
      ? cleanAadhaarDigits(studentInfo.motherAadhaarNumber || parentInfo.motherAadhaarNumber)
      : null;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Upsert Parent
      let parent = await tx.parent.findUnique({
        where: { primaryPhone: parentPhone.replace(/[\s-]/g, '') }
      });

      if (!parent) {
        parent = await tx.parent.create({
          data: {
            fatherName: parentInfo.fatherName?.trim() || null,
            motherName: parentInfo.motherName?.trim() || null,
            guardianName: parentInfo.guardianName?.trim() || null,
            primaryPhone: parentPhone.replace(/[\s-]/g, ''),
            alternatePhone: parentInfo.alternatePhone?.trim() || null,
            email: parentInfo.email ? parentInfo.email.trim().toLowerCase() : null,
            occupation: parentInfo.occupation || null,
            annualIncome: parentInfo.annualIncome || null,
            address: parentInfo.address || studentInfo.address || null,
            fatherAadhaarNumber: cleanFatherAadhaar,
            motherAadhaarNumber: cleanMotherAadhaar
          }
        });
      } else {
        // Update parent Aadhaar if provided
        if (cleanFatherAadhaar || cleanMotherAadhaar) {
          await tx.parent.update({
            where: { id: parent.id },
            data: {
              ...(cleanFatherAadhaar ? { fatherAadhaarNumber: cleanFatherAadhaar } : {}),
              ...(cleanMotherAadhaar ? { motherAadhaarNumber: cleanMotherAadhaar } : {})
            }
          });
        }
      }

      // 2. Create Student with all Part B fields
      const student = await tx.student.create({
        data: {
          admissionNumber,
          firstName: firstName,
          middleName: studentInfo.middleName?.trim() || null,
          lastName: lastName,
          dateOfBirth: new Date(studentInfo.dateOfBirth),
          gender: studentInfo.gender as Gender,
          bloodGroup: studentInfo.bloodGroup || null,
          aadhaarNumber: cleanStudentAadhaar,
          fatherAadhaarNumber: cleanFatherAadhaar,
          motherAadhaarNumber: cleanMotherAadhaar,
          nationality: studentInfo.nationality || 'Indian',
          religion: studentInfo.religion || null,
          category: studentInfo.category || null,
          // Permanent / Residence Address
          address: studentInfo.address || parentInfo.address || null,
          city: studentInfo.city || null,
          state: studentInfo.state || null,
          pincode: studentInfo.pincode || null,
          // Present Address (Part B3)
          sameAsResidence,
          presentAddress: sameAsResidence ? (studentInfo.address || parentInfo.address || null) : (studentInfo.presentAddress || null),
          presentCity: sameAsResidence ? (studentInfo.city || null) : (studentInfo.presentCity || null),
          presentState: sameAsResidence ? (studentInfo.state || null) : (studentInfo.presentState || null),
          presentPincode: sameAsResidence ? (studentInfo.pincode || null) : (studentInfo.presentPincode || null),
          emergencyPhone: studentInfo.emergencyPhone || parentPhone || null,
          photoUrl: studentInfo.photoUrl || null,
          status: StudentStatus.ACTIVE,
          admissionDate: academicInfo.admissionDate ? new Date(academicInfo.admissionDate) : new Date(),
          // Previous school details (Part B4)
          isPreviouslyEnrolled,
          previousSchoolName: isPreviouslyEnrolled ? (studentInfo.previousSchoolName || academicInfo.previousSchool || null) : null,
          previousClassPassed: isPreviouslyEnrolled ? (studentInfo.previousClassPassed || academicInfo.previousClass || null) : null,
          previousMedium: isPreviouslyEnrolled ? (studentInfo.previousMedium || null) : null,
          previousLeavingDate: (isPreviouslyEnrolled && studentInfo.previousLeavingDate) ? new Date(studentInfo.previousLeavingDate) : null,
          previousTcNumber: (isPreviouslyEnrolled && studentInfo.previousTcNumber) ? studentInfo.previousTcNumber.trim() : null,
          previousTcDate: (isPreviouslyEnrolled && studentInfo.previousTcDate) ? new Date(studentInfo.previousTcDate) : null,
          isHostelStudent: isHostel,
          hostelRoomNumber: isHostel ? (studentInfo.hostelRoomNumber || null) : null,
          hostelAdmissionDate: isHostel ? (studentInfo.hostelAdmissionDate ? new Date(studentInfo.hostelAdmissionDate) : new Date()) : null,
          isNonAttending: isNonAttending
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

      // 4. Create Student Academic Record
      await tx.studentAcademicRecord.create({
        data: {
          studentId: student.id,
          academicYearId: academicInfo.academicYearId,
          classId: academicInfo.classId,
          sectionId: academicInfo.sectionId || null,
          rollNumber: academicInfo.rollNumber || null
        }
      });

      // 5. Initial Status History Entry (Part C3)
      await tx.studentStatusHistory.create({
        data: {
          studentId: student.id,
          fromStatus: null,
          toStatus: StudentStatus.ACTIVE,
          reason: 'Initial admission completed',
          changedById: req.user?.id || 'SYSTEM',
          changedByName: req.user?.fullName || 'Admission Officer',
          effectiveDate: academicInfo.admissionDate ? new Date(academicInfo.admissionDate) : new Date()
        }
      });

      // 6. Store documents if any
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

      // 7. Generate Initial Admission Fees from Fee Structure
      const feeStructure = await tx.feeStructure.findUnique({
        where: {
          academicYearId_classId: {
            academicYearId: academicInfo.academicYearId,
            classId: academicInfo.classId
          }
        },
        include: { items: { include: { feeType: true } } }
      });

      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const initialStudentFees = [];

      if (feeStructure && feeStructure.items.length > 0) {
        for (const item of feeStructure.items) {
          if (!item.isActive) continue;

          let shouldInclude = false;
          let label = `${item.componentName || item.feeType.name}`;

          if (item.appliesTo === 'HOSTEL_ONLY') {
            if (isHostel) {
              shouldInclude = true;
              label = `Hostel Fee (${monthNames[currentMonth]} ${currentYear})`;
            }
          } else if (item.appliesTo === 'NEW_ADMISSION_ONLY') {
            shouldInclude = true;
          } else if (item.frequency === 'MONTHLY') {
            shouldInclude = true;
            label = `${item.componentName || item.feeType.name} (${monthNames[currentMonth]} ${currentYear})`;
          } else if (item.feeType.code === 'TERM' || item.frequency === 'ANNUAL') {
            const dueMonths = item.dueMonths ? item.dueMonths.split(',').map(x => parseInt(x.trim(), 10)) : [5, 10];
            if (dueMonths.includes(currentMonth)) {
              shouldInclude = true;
              label = `Term Fee (${currentMonth === 5 ? 'May' : 'Oct'} ${currentYear})`;
            }
          }

          if (shouldInclude) {
            const itemAmount = Number(item.amount);
            const sf = await tx.studentFee.create({
              data: {
                studentId: student.id,
                academicYearId: academicInfo.academicYearId,
                feeTypeId: item.feeTypeId,
                month: item.frequency === 'MONTHLY' ? currentMonth : null,
                year: currentYear,
                title: label,
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
            initialStudentFees.push(sf);
          }
        }
      } else if (customFeeInfo && customFeeInfo.amount) {
        const settings = await tx.schoolSettings.findFirst();
        const requireApproval = settings?.requireCustomFeeApproval ?? true;

        await tx.customFeeRequest.create({
          data: {
            studentId: student.id,
            academicYearId: academicInfo.academicYearId,
            classId: academicInfo.classId,
            feeHeadName: customFeeInfo.feeHeadName || 'Discretionary Admission Fee',
            amount: parseFloat(customFeeInfo.amount),
            reason: customFeeInfo.reason || 'Admission into class without standard fee structure',
            status: requireApproval ? 'PENDING' : 'APPROVED',
            requestedById: req.user?.id || 'staff',
            approvedById: requireApproval ? null : req.user?.id,
            approvedAt: requireApproval ? null : new Date()
          }
        });
      }

      // 8. Optional Payment Collection at Admission
      let admissionPayment = null;
      let admissionReceipt = null;

      if (paymentInfo && parseFloat(paymentInfo.amount) > 0) {
        const payAmount = parseFloat(paymentInfo.amount);
        const settings = await tx.schoolSettings.findFirst();
        const prefix = settings?.receiptPrefix || 'PBPS';
        const year = new Date().getFullYear();
        const receiptCount = await tx.receipt.count();
        const receiptNumber = `${prefix}-${year}-${(receiptCount + 1).toString().padStart(4, '0')}`;

        admissionPayment = await tx.payment.create({
          data: {
            studentId: student.id,
            academicYearId: academicInfo.academicYearId,
            collectedById: req.user?.id || null,
            amount: payAmount,
            paymentMethod: (paymentInfo.paymentMethod as PaymentMethod) || PaymentMethod.CASH,
            paymentStatus: PaymentStatus.SUCCESS,
            transactionRef: paymentInfo.transactionRef || `ADM-PAY-${Date.now().toString().slice(-6)}`,
            notes: 'Admission first fee payment',
            paidAt: new Date()
          }
        });

        let remainingToAllocate = payAmount;
        for (const sf of initialStudentFees) {
          if (remainingToAllocate <= 0) break;
          const currentRem = Number(sf.remainingAmount);
          const alloc = Math.min(remainingToAllocate, currentRem);
          if (alloc > 0) {
            await tx.studentFee.update({
              where: { id: sf.id },
              data: {
                paidAmount: alloc,
                remainingAmount: currentRem - alloc,
                status: currentRem - alloc === 0 ? FeeStatus.PAID : FeeStatus.PARTIAL
              }
            });

            await tx.paymentItem.create({
              data: {
                paymentId: admissionPayment.id,
                studentFeeId: sf.id,
                amountPaid: alloc
              }
            });

            remainingToAllocate -= alloc;
          }
        }

        const remainingTotal = await tx.studentFee.aggregate({
          where: { studentId: student.id, remainingAmount: { gt: 0 } },
          _sum: { remainingAmount: true }
        });

        admissionReceipt = await tx.receipt.create({
          data: {
            receiptNumber,
            paymentId: admissionPayment.id,
            studentId: student.id,
            totalAmount: payAmount,
            previousBalance: payAmount + Number(remainingTotal._sum.remainingAmount || 0),
            paidAmount: payAmount,
            remainingBalance: Number(remainingTotal._sum.remainingAmount || 0),
            generatedAt: new Date()
          }
        });
      }

      return {
        student,
        parent,
        admissionNumber,
        sessionName: session?.name || '2026-27',
        payment: admissionPayment,
        receipt: admissionReceipt
      };
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
        isHostel,
        session: result.sessionName,
        paymentCollected: result.payment?.amount
      },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      message: `Student admission registered successfully! Admission No: ${result.admissionNumber}`,
      data: {
        studentId: result.student.id,
        admissionNumber: result.admissionNumber,
        studentName: `${result.student.firstName} ${result.student.lastName}`,
        isHostel: result.student.isHostelStudent,
        receiptId: result.receipt?.id,
        receiptNumber: result.receipt?.receiptNumber
      }
    });
  } catch (error: any) {
    console.error('Admission error:', error);
    res.status(500).json({ success: false, message: error.message || 'Admission failed' });
  }
};

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
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================================
// PART C2: CANCEL ADMISSION WITH DUES CHECK, WAIVER LEDGER & SLC GENERATION
// =====================================================================
export const cancelAdmission = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      reason,
      notes,
      cancellationDate,
      waiveDues,
      waiverReason,
      conduct = 'Good'
    } = req.body;

    if (!reason || !reason.trim()) {
      res.status(400).json({ success: false, message: 'Cancellation reason is mandatory.' });
      return;
    }

    const effectiveDate = cancellationDate ? new Date(cancellationDate) : new Date();
    if (isNaN(effectiveDate.getTime())) {
      res.status(400).json({ success: false, message: 'Please provide a valid cancellation date.' });
      return;
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (effectiveDate > today) {
      res.status(400).json({ success: false, message: 'Cancellation date cannot be in the future.' });
      return;
    }

    // 1. Fetch student and verify existence
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
          where: { remainingAmount: { gt: 0 } },
          include: { feeType: true }
        }
      }
    });

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found.' });
      return;
    }

    if (student.status === StudentStatus.CANCELLED) {
      res.status(400).json({ success: false, message: 'Admission has already been cancelled.' });
      return;
    }

    // 2. Check pending dues across all fee heads
    const unpaidFees = student.studentFees;
    const totalPendingDues = unpaidFees.reduce((sum, f) => sum + Number(f.remainingAmount), 0);

    // Business rule C2:
    // If waiveDues is unchecked and dues are still pending: BLOCK cancellation
    if (totalPendingDues > 0 && !waiveDues) {
      res.status(400).json({
        success: false,
        message: 'Clear all pending dues or select Waive to cancel this admission.',
        pendingDues: totalPendingDues,
        unpaidFees: unpaidFees.map(f => ({
          id: f.id,
          title: f.title,
          feeType: f.feeType?.name,
          remainingAmount: Number(f.remainingAmount)
        }))
      });
      return;
    }

    // If waiveDues is checked: check permission 'fee.waive' and mandatory reason
    if (totalPendingDues > 0 && waiveDues) {
      const userPermissions = req.user?.permissions || [];
      const userRole = req.user?.role;
      const canWaive = userPermissions.includes('fee.waive') || ['SUPER_ADMIN', 'DIRECTOR', 'PRINCIPAL'].includes(userRole);

      if (!canWaive) {
        res.status(403).json({
          success: false,
          message: 'Permission denied: Waiving outstanding dues requires the "fee.waive" permission.'
        });
        return;
      }

      if (!waiverReason || !waiverReason.trim()) {
        res.status(400).json({
          success: false,
          message: 'A mandatory waiver justification reason is required to waive outstanding dues.'
        });
        return;
      }
    }

    // 3. Execute cancellation, waiver ledger entries, and SLC creation in ONE database transaction
    const cancelResult = await prisma.$transaction(async (tx) => {
      // Step A: Record waiver ledger entries and clear dues if requested
      if (totalPendingDues > 0 && waiveDues) {
        for (const fee of unpaidFees) {
          const waiveAmt = Number(fee.remainingAmount);

          await tx.feeWaiver.create({
            data: {
              studentId: student.id,
              studentFeeId: fee.id,
              feeHeadName: fee.title || 'Fee Due',
              amount: waiveAmt,
              reason: waiverReason.trim(),
              waivedById: req.user?.id || 'SYSTEM',
              waivedByName: req.user?.fullName || 'Administrator',
              approvedById: req.user?.id || 'SYSTEM',
              approvedByName: req.user?.fullName || 'Administrator'
            }
          });

          // Zero out the remaining amount
          await tx.studentFee.update({
            where: { id: fee.id },
            data: {
              paidAmount: Number(fee.paidAmount) + waiveAmt,
              remainingAmount: 0,
              status: FeeStatus.PAID
            }
          });
        }
      }

      // Step B: Update student status to CANCELLED
      const updatedStudent = await tx.student.update({
        where: { id },
        data: {
          status: StudentStatus.CANCELLED,
          cancellationReason: reason.trim(),
          cancellationNotes: notes?.trim() || null,
          cancelledAt: effectiveDate
        }
      });

      // Step C: Log status transition history
      await tx.studentStatusHistory.create({
        data: {
          studentId: student.id,
          fromStatus: student.status,
          toStatus: StudentStatus.CANCELLED,
          reason: `Admission Cancelled: ${reason.trim()}${notes ? ` - ${notes.trim()}` : ''}`,
          changedById: req.user?.id || null,
          changedByName: req.user?.fullName || 'Administrator',
          effectiveDate
        }
      });

      // Step D: Automatically generate sequential SLC
      const parentRecord = student.parents[0]?.parent;
      const academicRecord = student.academicRecords[0];

      const currentYear = new Date().getFullYear();
      const slcCount = await tx.schoolLeavingCertificate.count();
      const certificateNumber = `SLC-${currentYear}-${(slcCount + 1).toString().padStart(4, '0')}`;

      const slc = await tx.schoolLeavingCertificate.create({
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
          leavingDate: effectiveDate,
          reasonForLeaving: reason.trim(),
          feeDuesStatus: totalPendingDues > 0 ? 'All dues cleared / waived' : 'All dues cleared',
          conduct: conduct.trim() || 'Good',
          remarks: notes?.trim() || null,
          issueDate: new Date(),
          issuedById: req.user?.id || 'SYSTEM',
          issuedByName: req.user?.fullName || 'Principal / Administrator',
          reprintCount: 0
        }
      });

      return {
        student: updatedStudent,
        slc,
        waivedDues: totalPendingDues > 0 && waiveDues ? totalPendingDues : 0
      };
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'CANCEL_ADMISSION',
      module: 'ADMISSIONS',
      recordId: id,
      newData: {
        admissionNumber: student.admissionNumber,
        reason,
        notes,
        cancellationDate: effectiveDate,
        waivedAmount: cancelResult.waivedDues,
        slcNumber: cancelResult.slc.certificateNumber
      },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: `Admission for ${student.firstName} ${student.lastName} cancelled successfully. School Leaving Certificate (${cancelResult.slc.certificateNumber}) generated.`,
      data: {
        studentId: cancelResult.student.id,
        status: cancelResult.student.status,
        slcId: cancelResult.slc.id,
        certificateNumber: cancelResult.slc.certificateNumber,
        waivedDues: cancelResult.waivedDues
      }
    });
  } catch (error: any) {
    console.error('Cancel admission error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to cancel admission.' });
  }
};

// Fetch student outstanding dues calculation for cancel modal / fee checks
export const getStudentDues = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const unpaidFees = await prisma.studentFee.findMany({
      where: {
        studentId: id,
        remainingAmount: { gt: 0 }
      },
      include: { feeType: true },
      orderBy: { dueDate: 'asc' }
    });

    const totalDues = unpaidFees.reduce((sum, f) => sum + Number(f.remainingAmount), 0);

    res.json({
      success: true,
      data: {
        studentId: id,
        totalDues,
        hasPendingDues: totalDues > 0,
        unpaidFees: unpaidFees.map(f => ({
          id: f.id,
          title: f.title,
          feeType: f.feeType?.name,
          amount: Number(f.amount),
          paidAmount: Number(f.paidAmount),
          remainingAmount: Number(f.remainingAmount),
          dueDate: f.dueDate,
          status: f.status
        }))
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Fetch SLC for a student
export const getStudentSlc = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const slc = await prisma.schoolLeavingCertificate.findFirst({
      where: { studentId: id },
      orderBy: { createdAt: 'desc' }
    });

    if (!slc) {
      res.status(404).json({ success: false, message: 'No School Leaving Certificate found for this student.' });
      return;
    }

    res.json({ success: true, data: slc });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Record SLC Reprint action with permission slc.reprint
export const recordSlcReprint = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { slcId } = req.params;
    const slc = await prisma.schoolLeavingCertificate.findUnique({ where: { id: slcId } });

    if (!slc) {
      res.status(404).json({ success: false, message: 'School Leaving Certificate not found.' });
      return;
    }

    const updated = await prisma.schoolLeavingCertificate.update({
      where: { id: slcId },
      data: {
        reprintCount: { increment: 1 },
        lastReprintedAt: new Date(),
        lastReprintedById: req.user?.id || null
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'REPRINT_SLC',
      module: 'ADMISSIONS',
      recordId: slcId,
      newData: { certificateNumber: slc.certificateNumber, reprintCount: updated.reprintCount },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'SLC reprint recorded successfully.',
      data: updated
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Generate & stream SLC PDF
export const getSlcPdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slcId } = req.params;
    const slc = await prisma.schoolLeavingCertificate.findUnique({ where: { id: slcId } });

    if (!slc) {
      res.status(404).json({ success: false, message: 'Certificate not found.' });
      return;
    }

    const settings = await prisma.schoolSettings.findFirst();

    const formatDate = (d: Date | string | null | undefined): string => {
      if (!d) return 'N/A';
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return 'N/A';
      const day = dt.getDate().toString().padStart(2, '0');
      const month = (dt.getMonth() + 1).toString().padStart(2, '0');
      const year = dt.getFullYear();
      return `${day}-${month}-${year}`;
    };

    const pdfBuffer = await generateSlcPdf({
      school: {
        name: settings?.schoolName || 'Pragya Bharti Public School',
        tagline: settings?.tagline || 'Knowledge, Character & Excellence (PBPS)',
        address: settings?.address || 'Campus Road, PBPS Campus',
        phone: settings?.phone || '+91 98765 43210',
        email: settings?.email || 'office@pbps.edu.in',
        affiliationNumber: settings?.registrationNumber || 'CBSE-AFF-2026',
        schoolCode: 'PBPS-8491',
        principalName: settings?.principalName || 'Principal'
      },
      slc: {
        certificateNumber: slc.certificateNumber,
        issueDate: formatDate(slc.issueDate),
        reprintCount: slc.reprintCount,
        studentName: slc.studentName,
        photoUrl: slc.photoUrl,
        admissionNumber: slc.admissionNumber,
        fatherName: slc.fatherName,
        motherName: slc.motherName,
        dateOfBirth: formatDate(slc.dateOfBirth),
        nationality: slc.nationality,
        category: slc.category || 'General',
        classAdmitted: slc.classAdmitted,
        classLeaving: slc.classLastStudied,
        admissionDate: formatDate(slc.admissionDate),
        leavingDate: formatDate(slc.leavingDate),
        leavingReason: slc.reasonForLeaving,
        feeDuesStatus: slc.feeDuesStatus,
        conduct: slc.conduct,
        remarks: slc.remarks || undefined
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    const safeAdmNo = slc.admissionNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Disposition', `inline; filename="SLC_${safeAdmNo}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAdmissionPdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        parents: { include: { parent: true } },
        academicRecords: {
          include: { class: true, section: true, academicYear: true },
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    const parentRec = student.parents?.[0]?.parent;
    const academicRec = student.academicRecords?.[0];
    const settings = await prisma.schoolSettings.findFirst();

    const pdfBuffer = await generateAdmissionPdf({
      school: {
        name: settings?.schoolName || 'Pragya Bharti Public School',
        tagline: settings?.tagline || 'Knowledge, Character & Excellence (PBPS)',
        address: settings?.address || 'Campus Road, PBPS Campus',
        phone: settings?.phone || '+91 98765 43210',
        email: settings?.email || 'admissions@pbps.edu.in',
        registrationNumber: settings?.registrationNumber || 'PBPS-REG',
        principalName: settings?.principalName || 'Principal, PBPS',
        authorizedSignatory: settings?.authorizedSignatory || 'Head of Admissions, PBPS'
      },
      student: {
        admissionNumber: student.admissionNumber,
        admissionDate: student.admissionDate.toISOString().split('T')[0],
        fullName: `${student.firstName} ${student.middleName ? student.middleName + ' ' : ''}${student.lastName}`.trim(),
        dateOfBirth: student.dateOfBirth.toISOString().split('T')[0],
        gender: student.gender,
        bloodGroup: student.bloodGroup || undefined,
        aadhaarNumber: student.aadhaarNumber || undefined,
        nationality: student.nationality || 'Indian',
        category: student.category || 'General',
        address: student.address || undefined,
        city: student.city || undefined,
        state: student.state || undefined,
        pincode: student.pincode || undefined,
        emergencyPhone: student.emergencyPhone || undefined,
        status: student.status,
        cancellationReason: student.cancellationReason || undefined,
        cancelledAt: student.cancelledAt ? student.cancelledAt.toISOString() : undefined
      },
      academic: {
        sessionName: academicRec?.academicYear?.name || '2026-27',
        className: academicRec?.class?.name || 'Standard',
        sectionName: academicRec?.section?.name || 'A',
        rollNumber: academicRec?.rollNumber || undefined
      },
      parent: {
        fatherName: parentRec?.fatherName || undefined,
        motherName: parentRec?.motherName || undefined,
        guardianName: parentRec?.guardianName || undefined,
        primaryPhone: parentRec?.primaryPhone || 'N/A',
        alternatePhone: parentRec?.alternatePhone || undefined,
        email: parentRec?.email || undefined,
        occupation: parentRec?.occupation || undefined,
        relationship: student.parents?.[0]?.relationship || 'Father'
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Admission_Form_${student.admissionNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
