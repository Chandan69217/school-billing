import { Request, Response } from 'express';
import { PrismaClient, PaymentMethod, PaymentStatus, FeeStatus } from '@prisma/client';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { logAudit } from '../utils/audit.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { generateReceiptPdf } from '../utils/pdf.js';
import { sendReceiptEmail } from '../utils/email.js';

const prisma = new PrismaClient();

export const collectPayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      studentId,
      academicYearId,
      amount,
      paymentMethod,
      transactionRef,
      notes,
      feeAllocations // Array of { studentFeeId: string, amount: number }
    } = req.body;

    const paymentAmount = parseFloat(amount);
    if (!studentId || isNaN(paymentAmount) || paymentAmount <= 0) {
      res.status(400).json({ success: false, message: 'Valid studentId and amount are required' });
      return;
    }

    // Verify student exists
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        academicRecords: {
          include: { class: true, section: true, academicYear: true },
          take: 1,
          orderBy: { createdAt: 'desc' }
        },
        parents: {
          include: { parent: true },
          take: 1
        }
      }
    });

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found', errorCode: 'STUDENT_NOT_FOUND' });
      return;
    }

    const currentYearId = academicYearId || student.academicRecords[0]?.academicYearId;

    // Execute payment in transaction
    const transactionResult = await prisma.$transaction(async (tx) => {
      // 1. Fetch target student fees to settle
      let targetFees: any[] = [];
      if (feeAllocations && Array.isArray(feeAllocations) && feeAllocations.length > 0) {
        const feeIds = feeAllocations.map(a => a.studentFeeId);
        targetFees = await tx.studentFee.findMany({
          where: { id: { in: feeIds }, studentId }
        });
      } else {
        // Auto-allocate to oldest unpaid fees
        targetFees = await tx.studentFee.findMany({
          where: {
            studentId,
            remainingAmount: { gt: 0 }
          },
          orderBy: { dueDate: 'asc' }
        });
      }

      // Calculate total outstanding
      const totalOutstanding = targetFees.reduce((sum, f) => sum + Number(f.remainingAmount), 0);
      if (paymentAmount > totalOutstanding) {
        throw new Error(`Payment amount (₹${paymentAmount}) exceeds total outstanding fees (₹${totalOutstanding})`);
      }

      // 2. Create Payment Record
      const payment = await tx.payment.create({
        data: {
          studentId,
          academicYearId: currentYearId,
          collectedById: req.user?.id || null,
          amount: paymentAmount,
          paymentMethod: (paymentMethod as PaymentMethod) || PaymentMethod.CASH,
          paymentStatus: PaymentStatus.SUCCESS,
          transactionRef: transactionRef || `TXN-${Date.now().toString().slice(-8)}`,
          notes: notes || 'Standard counter fee collection',
          paidAt: new Date()
        }
      });

      // 3. Allocate payment to individual fees and create PaymentItems
      let remainingPaymentToAllocate = paymentAmount;
      const paymentItemsCreated = [];

      for (const fee of targetFees) {
        if (remainingPaymentToAllocate <= 0) break;

        let allocAmt = 0;
        if (feeAllocations && feeAllocations.length > 0) {
          const spec = feeAllocations.find(a => a.studentFeeId === fee.id);
          allocAmt = spec ? Math.min(parseFloat(spec.amount), Number(fee.remainingAmount), remainingPaymentToAllocate) : 0;
        } else {
          allocAmt = Math.min(Number(fee.remainingAmount), remainingPaymentToAllocate);
        }

        if (allocAmt > 0) {
          const newPaid = Number(fee.paidAmount) + allocAmt;
          const newRemaining = Number(fee.remainingAmount) - allocAmt;
          const newStatus: FeeStatus = newRemaining <= 0 ? 'PAID' : 'PARTIAL';

          await tx.studentFee.update({
            where: { id: fee.id },
            data: {
              paidAmount: newPaid,
              remainingAmount: newRemaining,
              status: newStatus
            }
          });

          const item = await tx.paymentItem.create({
            data: {
              paymentId: payment.id,
              studentFeeId: fee.id,
              amountPaid: allocAmt
            }
          });
          paymentItemsCreated.push(item);
          remainingPaymentToAllocate -= allocAmt;
        }
      }

      // 4. Generate Unique Receipt Number: REC-YYYY-000001
      const year = new Date().getFullYear();
      const receiptCount = await tx.receipt.count();
      const receiptNumber = `REC-${year}-${(receiptCount + 1).toString().padStart(6, '0')}`;

      const receipt = await tx.receipt.create({
        data: {
          receiptNumber,
          paymentId: payment.id,
          studentId: student.id,
          totalAmount: totalOutstanding,
          previousBalance: totalOutstanding,
          paidAmount: paymentAmount,
          remainingBalance: totalOutstanding - paymentAmount,
          generatedAt: new Date()
        }
      });

      return { payment, receipt, student };
    });

    // Audit log
    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'COLLECT_FEE',
      module: 'PAYMENTS',
      recordId: transactionResult.payment.id,
      newData: {
        receiptNumber: transactionResult.receipt.receiptNumber,
        amount: paymentAmount,
        studentId,
        paymentMethod
      },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      message: 'Payment collected successfully and receipt generated.',
      data: {
        paymentId: transactionResult.payment.id,
        receiptId: transactionResult.receipt.id,
        receiptNumber: transactionResult.receipt.receiptNumber,
        amount: paymentAmount,
        paidAt: transactionResult.payment.paidAt
      }
    });
  } catch (error: any) {
    console.error('Payment collection error:', error);
    res.status(400).json({ success: false, message: error.message || 'Payment collection failed' });
  }
};

export const getPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string || '10', 10)));
    const search = (req.query.search as string || '').trim();
    const method = req.query.method as string;
    const status = req.query.status as string;
    const academicYearId = req.query.academicYearId as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    const where: any = {};
    if (academicYearId) where.academicYearId = academicYearId;
    if (method && method !== 'ALL') where.paymentMethod = method as PaymentMethod;
    if (status && status !== 'ALL') where.paymentStatus = status as PaymentStatus;

    if (startDate || endDate) {
      where.paidAt = {};
      if (startDate) where.paidAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.paidAt.lte = end;
      }
    }

    if (search) {
      where.OR = [
        { transactionRef: { contains: search } },
        { receipt: { receiptNumber: { contains: search } } },
        { student: { admissionNumber: { contains: search } } },
        { student: { firstName: { contains: search } } },
        { student: { lastName: { contains: search } } }
      ];
    }

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { paidAt: 'desc' },
        include: {
          receipt: true,
          collectedBy: { select: { fullName: true } },
          student: {
            include: {
              academicRecords: {
                include: { class: true, section: true },
                take: 1
              }
            }
          },
          items: {
            include: {
              studentFee: { include: { feeType: true } }
            }
          }
        }
      })
    ]);

    const formatted = payments.map(p => ({
      id: p.id,
      receiptId: p.receipt?.id,
      receiptNumber: p.receipt?.receiptNumber || 'N/A',
      studentId: p.student.id,
      studentName: `${p.student.firstName} ${p.student.lastName}`,
      admissionNumber: p.student.admissionNumber,
      className: p.student.academicRecords[0]?.class?.name || 'Class 8',
      sectionName: p.student.academicRecords[0]?.section?.name || 'A',
      amount: Number(p.amount),
      paymentMethod: p.paymentMethod,
      paymentStatus: p.paymentStatus,
      transactionRef: p.transactionRef,
      paidAt: p.paidAt,
      collectedBy: p.collectedBy?.fullName || 'Online / Portal',
      itemsCount: p.items.length
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

// Razorpay Online Order Creation
export const createRazorpayOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentId, amount } = req.body;
    const numAmount = parseFloat(amount);

    if (!studentId || isNaN(numAmount) || numAmount <= 0) {
      res.status(400).json({ success: false, message: 'Invalid studentId or amount' });
      return;
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { parents: { include: { parent: true }, take: 1 } }
    });

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    // Amount in paise for Razorpay
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Store transaction in database
    await prisma.paymentTransaction.create({
      data: {
        orderId,
        amount: numAmount,
        currency: 'INR',
        status: PaymentStatus.PENDING,
        studentId,
        payload: JSON.stringify({ studentName: `${student.firstName} ${student.lastName}` })
      }
    });

    res.json({
      success: true,
      data: {
        orderId,
        amount: numAmount * 100, // paise
        currency: 'INR',
        keyId: config.razorpayKeyId,
        studentName: `${student.firstName} ${student.lastName}`,
        email: student.parents[0]?.parent?.email || 'parent@example.com',
        phone: student.parents[0]?.parent?.primaryPhone || '9876543210'
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Server-side Razorpay Signature Verification
export const verifyRazorpayPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId, razorpayPaymentId, signature, studentId, amount } = req.body;

    if (!orderId || !razorpayPaymentId) {
      res.status(400).json({ success: false, message: 'Missing orderId or paymentId' });
      return;
    }

    // Verify cryptographic signature if secret configured
    if (config.razorpayKeySecret && signature) {
      const generatedSignature = crypto
        .createHmac('sha256', config.razorpayKeySecret)
        .update(`${orderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (generatedSignature !== signature) {
        res.status(400).json({ success: false, message: 'Invalid payment signature. Payment verification failed.' });
        return;
      }
    }

    const paymentAmount = parseFloat(amount) || 1000;

    // Complete transaction in database
    const result = await prisma.$transaction(async (tx) => {
      // Update transaction record
      await tx.paymentTransaction.updateMany({
        where: { orderId },
        data: {
          razorpayPaymentId,
          signature,
          status: PaymentStatus.SUCCESS
        }
      });

      // Find student and active academic year
      const activeYear = await tx.academicYear.findFirst({ where: { isActive: true } });
      const student = await tx.student.findUnique({
        where: { id: studentId },
        include: {
          parents: { include: { parent: true }, take: 1 },
          academicRecords: { include: { class: true, section: true }, take: 1 }
        }
      });

      if (!student) throw new Error('Student not found');

      // Create Payment
      const payment = await tx.payment.create({
        data: {
          studentId,
          academicYearId: activeYear?.id || student.academicRecords[0]?.academicYearId || '',
          amount: paymentAmount,
          paymentMethod: PaymentMethod.ONLINE,
          paymentStatus: PaymentStatus.SUCCESS,
          transactionRef: razorpayPaymentId,
          notes: `Razorpay Online Payment - Order ID: ${orderId}`,
          paidAt: new Date()
        }
      });

      // Allocate to pending fees
      const fees = await tx.studentFee.findMany({
        where: { studentId, remainingAmount: { gt: 0 } },
        orderBy: { dueDate: 'asc' }
      });

      let remaining = paymentAmount;
      for (const fee of fees) {
        if (remaining <= 0) break;
        const alloc = Math.min(Number(fee.remainingAmount), remaining);
        const newPaid = Number(fee.paidAmount) + alloc;
        const newRemaining = Number(fee.remainingAmount) - alloc;

        await tx.studentFee.update({
          where: { id: fee.id },
          data: {
            paidAmount: newPaid,
            remainingAmount: newRemaining,
            status: newRemaining <= 0 ? 'PAID' : 'PARTIAL'
          }
        });

        await tx.paymentItem.create({
          data: {
            paymentId: payment.id,
            studentFeeId: fee.id,
            amountPaid: alloc
          }
        });
        remaining -= alloc;
      }

      // Generate Receipt
      const receiptCount = await tx.receipt.count();
      const receiptNumber = `REC-${new Date().getFullYear()}-${(receiptCount + 1).toString().padStart(6, '0')}`;

      const receipt = await tx.receipt.create({
        data: {
          receiptNumber,
          paymentId: payment.id,
          studentId,
          totalAmount: paymentAmount,
          previousBalance: paymentAmount,
          paidAmount: paymentAmount,
          remainingBalance: 0,
          generatedAt: new Date()
        }
      });

      return { payment, receipt, student };
    });

    // Send email asynchronously if parent email exists
    const parentEmail = result.student.parents[0]?.parent?.email;
    if (parentEmail) {
      try {
        const school = await prisma.schoolSettings.findFirst() || {
          schoolName: 'Pragya Bharti Public School',
          tagline: 'Knowledge, Character & Excellence (PBPS)',
          address: 'Knowledge Park, Institutional Area',
          phone: '+91 98765 43210',
          email: 'admissions@pbps.edu.in'
        };

        const pdfBuffer = await generateReceiptPdf({
          school: {
            name: school.schoolName,
            tagline: school.tagline || undefined,
            address: school.address,
            phone: school.phone,
            email: school.email
          },
          receiptNumber: result.receipt.receiptNumber,
          paymentDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
          paymentMethod: 'ONLINE (Razorpay)',
          transactionRef: razorpayPaymentId,
          student: {
            admissionNumber: result.student.admissionNumber,
            name: `${result.student.firstName} ${result.student.lastName}`,
            className: result.student.academicRecords[0]?.class?.name || 'Class 8',
            sectionName: result.student.academicRecords[0]?.section?.name || 'A'
          },
          academicYear: '2026-27',
          items: [{ title: 'Online Fee Payment', amount: paymentAmount }],
          totalAmount: paymentAmount,
          previousBalance: 0,
          paidAmount: paymentAmount,
          remainingBalance: 0,
          collectedBy: 'Razorpay Payment Gateway'
        });

        await sendReceiptEmail({
          receiptId: result.receipt.id,
          recipientEmail: parentEmail,
          studentName: `${result.student.firstName} ${result.student.lastName}`,
          receiptNumber: result.receipt.receiptNumber,
          pdfBuffer
        });
      } catch (emailErr) {
        console.warn('Receipt email post-processing warning:', emailErr);
      }
    }

    res.json({
      success: true,
      message: 'Razorpay payment verified and processed successfully',
      data: {
        receiptNumber: result.receipt.receiptNumber,
        paymentId: result.payment.id,
        receiptId: result.receipt.id
      }
    });
  } catch (error: any) {
    console.error('verifyRazorpayPayment error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
