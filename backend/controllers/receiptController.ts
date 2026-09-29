import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateReceiptPdf } from '../utils/pdf.js';
import { sendReceiptEmail } from '../utils/email.js';
import { logAudit } from '../utils/audit.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const prisma = new PrismaClient();

export const getReceiptById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
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

    res.json({
      success: true,
      data: {
        ...receipt,
        school,
        studentDetails: {
          name: `${receipt.student.firstName} ${receipt.student.lastName}`,
          admissionNumber: receipt.student.admissionNumber,
          className: academic?.class?.name || 'Class 8',
          sectionName: academic?.section?.name || 'A',
          rollNumber: academic?.rollNumber || '',
          fatherName: parent?.fatherName || 'Parent',
          phone: parent?.primaryPhone || 'N/A',
          email: parent?.email || ''
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getReceiptPdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
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
      receiptNumber: receipt.receiptNumber,
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
        className: academic?.class?.name || 'Class 8',
        sectionName: academic?.section?.name || 'A',
        rollNumber: academic?.rollNumber || '',
        fatherName: parent?.fatherName || parent?.motherName || 'Parent',
        phone: parent?.primaryPhone || 'N/A'
      },
      academicYear: receipt.payment.academicYear?.name || '2026-27',
      items: items.length > 0 ? items : [{ title: 'Term Fee Payment', amount: Number(receipt.paidAmount) }],
      totalAmount: Number(receipt.totalAmount),
      previousBalance: Number(receipt.previousBalance),
      paidAmount: Number(receipt.paidAmount),
      remainingBalance: Number(receipt.remainingBalance),
      collectedBy: receipt.payment.collectedBy?.fullName || 'Counter Staff'
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${receipt.receiptNumber}.pdf"`);
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
              take: 1
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

    const emailToSend = recipientEmail || receipt.student.parents[0]?.parent?.email;
    if (!emailToSend) {
      res.status(400).json({ success: false, message: 'No valid recipient email address found or provided' });
      return;
    }

    const school = await prisma.schoolSettings.findFirst() || {
      schoolName: 'Pragya Bharti Public School',
      tagline: 'Knowledge, Character & Excellence (PBPS)',
      address: 'Knowledge Park, Institutional Area',
      phone: '+91 98765 43210',
      email: 'admissions@pbps.edu.in'
    };

    const academic = receipt.student.academicRecords[0];
    const parent = receipt.student.parents[0]?.parent;

    const items = receipt.payment.items.map(item => ({
      title: item.studentFee.title,
      amount: Number(item.amountPaid),
      month: item.studentFee.month ? `Month ${item.studentFee.month}` : 'Annual'
    }));

    const pdfBuffer = await generateReceiptPdf({
      school: {
        name: school.schoolName,
        tagline: school.tagline || undefined,
        address: school.address,
        phone: school.phone,
        email: school.email
      },
      receiptNumber: receipt.receiptNumber,
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
        className: academic?.class?.name || 'Class 8',
        sectionName: academic?.section?.name || 'A',
        rollNumber: academic?.rollNumber || '',
        fatherName: parent?.fatherName || 'Parent',
        phone: parent?.primaryPhone || 'N/A'
      },
      academicYear: receipt.payment.academicYear?.name || '2026-27',
      items: items.length > 0 ? items : [{ title: 'Fee Payment', amount: Number(receipt.paidAmount) }],
      totalAmount: Number(receipt.totalAmount),
      previousBalance: Number(receipt.previousBalance),
      paidAmount: Number(receipt.paidAmount),
      remainingBalance: Number(receipt.remainingBalance),
      collectedBy: receipt.payment.collectedBy?.fullName || 'Cashier'
    });

    const result = await sendReceiptEmail({
      receiptId: receipt.id,
      recipientEmail: emailToSend,
      studentName: `${receipt.student.firstName} ${receipt.student.lastName}`,
      receiptNumber: receipt.receiptNumber,
      pdfBuffer
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'EMAIL_RECEIPT',
      module: 'RECEIPTS',
      recordId: receipt.id,
      newData: { recipientEmail: emailToSend, receiptNumber: receipt.receiptNumber },
      ipAddress: req.ip
    });

    res.json({
      success: result.success,
      message: result.message
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
