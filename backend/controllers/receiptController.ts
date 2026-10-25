import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateReceiptPdf } from '../utils/pdf.js';
import { sendReceiptEmail } from '../utils/email.js';
import { logAudit } from '../utils/audit.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const prisma = new PrismaClient();

// =============================================================
// Query Receipts List
// =============================================================

export const getReceipts = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string || '20', 10)));
    const search = (req.query.search as string || '').trim();
    const classId = req.query.classId as string;

    const where: any = {};
    if (search) {
      where.OR = [
        { receiptNumber: { contains: search, mode: 'insensitive' } },
        { student: { firstName: { contains: search, mode: 'insensitive' } } },
        { student: { lastName: { contains: search, mode: 'insensitive' } } },
        { student: { admissionNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (classId) {
      where.student = {
        academicRecords: { some: { classId } }
      };
    }

    const [total, receipts] = await Promise.all([
      prisma.receipt.count({ where }),
      prisma.receipt.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { generatedAt: 'desc' },
        include: {
          student: {
            include: {
              academicRecords: {
                include: { class: true },
                orderBy: { createdAt: 'desc' },
                take: 1
              }
            }
          },
          payment: {
            include: {
              collectedBy: { select: { fullName: true } }
            }
          }
        }
      })
    ]);

    const formatted = receipts.map((r) => ({
      id: r.id,
      receiptNumber: r.receiptNumber,
      studentId: r.studentId,
      studentName: `${r.student.firstName} ${r.student.lastName}`.trim(),
      admissionNumber: r.student.admissionNumber,
      className: r.student.academicRecords[0]?.class?.name || 'Class',
      isHostelStudent: r.student.isHostelStudent,
      totalAmount: Number(r.totalAmount),
      paidAmount: Number(r.paidAmount),
      remainingBalance: Number(r.remainingBalance),
      paymentMethod: r.payment.paymentMethod,
      transactionRef: r.payment.transactionRef,
      isCancelled: r.payment.isCancelled,
      reprintCount: r.reprintCount,
      isDuplicate: r.isDuplicate || r.reprintCount > 0,
      generatedAt: r.generatedAt,
      collectedByName: r.payment.collectedBy?.fullName || 'Staff'
    }));

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
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Get Single Receipt with Full SRS Detail Breakdown
// =============================================================

export const getReceiptById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const isReprint = req.query.isReprint === 'true';

    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: {
        payment: {
          include: {
            collectedBy: { select: { fullName: true, username: true } },
            academicYear: true,
            items: {
              include: {
                studentFee: {
                  include: { feeType: true }
                }
              }
            }
          }
        },
        student: {
          include: {
            academicRecords: {
              include: { class: true, section: true },
              take: 1,
              orderBy: { createdAt: 'desc' }
            },
            parents: {
              include: { parent: true },
              take: 1
            }
          }
        },
        emailLogs: {
          orderBy: { sentAt: 'desc' }
        }
      }
    });

    if (!receipt) {
      res.status(404).json({ success: false, message: 'Receipt not found' });
      return;
    }

    // If marked as reprint, increment count
    let updatedDuplicate = receipt.isDuplicate;
    let reprintCount = receipt.reprintCount;
    if (isReprint) {
      reprintCount += 1;
      updatedDuplicate = true;
      await prisma.receipt.update({
        where: { id },
        data: { reprintCount, isDuplicate: true }
      });
    }

    const school = await prisma.schoolSettings.findFirst() || {
      schoolName: 'Pragya Bharti Public School',
      tagline: 'Knowledge, Character & Excellence (PBPS)',
      logoUrl: '/school-logo.svg',
      address: 'Knowledge Park, Institutional Area',
      phone: '+91 98765 43210',
      email: 'admissions@pbps.edu.in',
      registrationNumber: 'SCH-REG-2024-9981',
      receiptFooter: 'This is a computer generated fee receipt. Pragya Bharti Public School (PBPS).',
      authorizedSignatory: 'Accounts Officer, PBPS'
    };

    const academic = receipt.student.academicRecords[0];
    const parent = receipt.student.parents[0]?.parent;

    const feeBreakdown = receipt.payment.items.map((it) => {
      const sf = it.studentFee;
      return {
        id: it.id,
        feeHead: sf.title || sf.feeType.name,
        month: sf.month || null,
        year: sf.year,
        amount: Number(sf.amount),
        discount: Number(sf.discountAmount),
        netAmount: Number(sf.netAmount),
        amountPaid: Number(it.amountPaid),
        remainingAmount: Number(sf.remainingAmount)
      };
    });

    res.json({
      success: true,
      data: {
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        generatedAt: receipt.generatedAt,
        totalAmount: Number(receipt.totalAmount),
        paidAmount: Number(receipt.paidAmount),
        previousBalance: Number(receipt.previousBalance),
        remainingBalance: Number(receipt.remainingBalance),
        reprintCount,
        isDuplicate: updatedDuplicate,
        isCancelled: receipt.payment.isCancelled,
        cancellationReason: receipt.payment.cancellationReason,
        payment: {
          id: receipt.payment.id,
          paymentMethod: receipt.payment.paymentMethod,
          transactionRef: receipt.payment.transactionRef,
          paidAt: receipt.payment.paidAt,
          notes: receipt.payment.notes,
          collectedBy: receipt.payment.collectedBy?.fullName || 'Fee Counter Staff',
          academicYear: receipt.payment.academicYear?.name || '2026-27'
        },
        student: {
          id: receipt.student.id,
          name: `${receipt.student.firstName} ${receipt.student.lastName}`.trim(),
          admissionNumber: receipt.student.admissionNumber,
          className: academic?.class?.name || 'Class',
          sectionName: academic?.section?.name || 'A',
          rollNumber: academic?.rollNumber || '',
          isHostelStudent: receipt.student.isHostelStudent,
          studentType: receipt.student.isHostelStudent ? 'Hostel Student' : 'Day Scholar',
          hostelRoom: receipt.student.hostelRoomNumber,
          isNonAttending: receipt.student.isNonAttending,
          fatherName: parent?.fatherName || parent?.motherName || 'Parent',
          phone: parent?.primaryPhone || 'N/A',
          email: parent?.email || ''
        },
        school,
        feeBreakdown
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Mark Receipt as Duplicate Reprint (Record Reprint Audit)
// =============================================================

export const recordReprint = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: { payment: true, student: true }
    });

    if (!receipt) {
      res.status(404).json({ success: false, message: 'Receipt not found' });
      return;
    }

    const updated = await prisma.receipt.update({
      where: { id },
      data: {
        reprintCount: receipt.reprintCount + 1,
        isDuplicate: true
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'REPRINT_RECEIPT',
      module: 'RECEIPTS',
      recordId: id,
      newData: {
        receiptNumber: receipt.receiptNumber,
        reprintCount: updated.reprintCount,
        studentAdmissionNumber: receipt.student.admissionNumber
      },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Receipt marked as DUPLICATE COPY',
      data: updated
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Download Printable Receipt PDF
// =============================================================

export const getReceiptPdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const isReprint = req.query.isReprint === 'true';

    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: {
        payment: {
          include: {
            collectedBy: { select: { fullName: true } },
            academicYear: true,
            items: {
              include: {
                studentFee: {
                  include: { feeType: true }
                }
              }
            }
          }
        },
        student: {
          include: {
            academicRecords: {
              include: { class: true, section: true },
              take: 1,
              orderBy: { createdAt: 'desc' }
            },
            parents: {
              include: { parent: true },
              take: 1
            }
          }
        }
      }
    });

    if (!receipt) {
      res.status(404).json({ success: false, message: 'Receipt not found' });
      return;
    }

    if (isReprint) {
      await prisma.receipt.update({
        where: { id },
        data: { reprintCount: receipt.reprintCount + 1, isDuplicate: true }
      });
    }

    const school = await prisma.schoolSettings.findFirst() || {
      schoolName: 'Pragya Bharti Public School',
      tagline: 'Knowledge, Character & Excellence (PBPS)',
      address: 'Knowledge Park, Institutional Area',
      phone: '+91 98765 43210',
      email: 'admissions@pbps.edu.in',
      registrationNumber: 'SCH-REG-2024-9981',
      receiptFooter: 'This is a computer generated fee receipt. Pragya Bharti Public School (PBPS).',
      authorizedSignatory: 'Accounts Officer, PBPS'
    };

    const academic = receipt.student.academicRecords[0];
    const parent = receipt.student.parents[0]?.parent;

    const items = receipt.payment.items.map(item => ({
      title: item.studentFee.title,
      amount: Number(item.amountPaid),
      month: item.studentFee.month ? `Month ${item.studentFee.month}` : 'Annual'
    }));

    const isDuplicate = receipt.isDuplicate || receipt.reprintCount > 0 || isReprint;

    const pdfBuffer = await generateReceiptPdf({
      school: {
        name: school.schoolName,
        tagline: school.tagline || undefined,
        address: school.address,
        phone: school.phone,
        email: school.email,
        registrationNumber: school.registrationNumber || undefined,
        receiptFooter: school.receiptFooter || undefined,
        authorizedSignatory: school.authorizedSignatory || undefined
      },
      receiptNumber: receipt.receiptNumber + (isDuplicate ? ' (DUPLICATE COPY)' : ''),
      paymentDate: new Date(receipt.payment.paidAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }),
      paymentMethod: receipt.payment.paymentMethod,
      transactionRef: receipt.payment.transactionRef || undefined,
      student: {
        admissionNumber: receipt.student.admissionNumber,
        name: `${receipt.student.firstName} ${receipt.student.lastName}`,
        className: `${academic?.class?.name || 'Class'} (${receipt.student.isHostelStudent ? 'Hostel' : 'Day Scholar'})`,
        sectionName: academic?.section?.name || 'A',
        rollNumber: academic?.rollNumber || '',
        fatherName: parent?.fatherName || parent?.motherName || 'Parent',
        phone: parent?.primaryPhone || 'N/A'
      },
      academicYear: receipt.payment.academicYear?.name || '2026-27',
      items: items.length > 0 ? items : [{ title: 'Fee Payment', amount: Number(receipt.paidAmount) }],
      totalAmount: Number(receipt.totalAmount),
      previousBalance: Number(receipt.previousBalance),
      paidAmount: Number(receipt.paidAmount),
      remainingBalance: Number(receipt.remainingBalance),
      collectedBy: receipt.payment.collectedBy?.fullName || 'Counter Staff'
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${receipt.receiptNumber}${isDuplicate ? '_DUPLICATE' : ''}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('getReceiptPdf error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const emailReceipt = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const recipientEmail = req.body.email;

    const receipt = await prisma.receipt.findUnique({
      where: { id },
      include: {
        payment: { include: { collectedBy: true, academicYear: true, items: { include: { studentFee: true } } } },
        student: { include: { parents: { include: { parent: true } } } }
      }
    });

    if (!receipt) {
      res.status(404).json({ success: false, message: 'Receipt not found' });
      return;
    }

    const email = recipientEmail || receipt.student.parents[0]?.parent?.email;
    if (!email) {
      res.status(400).json({ success: false, message: 'No recipient email available' });
      return;
    }

    const pdfBuffer = await generateReceiptPdf(receipt as any);

    await sendReceiptEmail({
      receiptId: receipt.id,
      recipientEmail: email,
      studentName: `${receipt.student.firstName} ${receipt.student.lastName}`.trim(),
      receiptNumber: receipt.receiptNumber,
      pdfBuffer
    });

    res.json({ success: true, message: `Receipt successfully emailed to ${email}` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
