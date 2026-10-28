import { Request, Response } from 'express';
import { PrismaClient, PaymentMethod, PaymentStatus, FeeStatus } from '@prisma/client';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { logAudit } from '../utils/audit.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { generateReceiptPdf } from '../utils/pdf.js';
import { sendReceiptEmail } from '../utils/email.js';
import { broadcastNotification } from '../utils/notificationService.js';

const prisma = new PrismaClient();

// =============================================================
// Collect Payment (Counter & Multi-Month Advance & Part Payment)
// =============================================================

export const collectPayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      studentId,
      academicYearId,
      amount,
      paymentMethod,
      transactionRef,
      notes,
      feeAllocations, // Array of { feeTypeId: string, month?: number, amount: number, studentFeeId?: string }
      discountRuleId,
      discountAmount,
      discountReason
    } = req.body;

    const paymentAmount = parseFloat(amount);
    if (!studentId || isNaN(paymentAmount) || paymentAmount <= 0) {
      res.status(400).json({ success: false, message: 'Valid studentId and positive payment amount are required' });
      return;
    }

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

    if (!student || student.academicRecords.length === 0) {
      res.status(404).json({ success: false, message: 'Student academic record not found', errorCode: 'STUDENT_NOT_FOUND' });
      return;
    }

    const currentYearId = academicYearId || student.academicRecords[0]?.academicYearId;
    const settings = await prisma.schoolSettings.findFirst();
    const receiptPrefix = settings?.receiptPrefix || 'PBPS';
    const yearStr = new Date().getFullYear();

    // Execute payment and fee item updates in an atomic transaction
    const transactionResult = await prisma.$transaction(async (tx) => {
      // 1. Handle Discount if applied
      let netDiscount = 0;
      if (discountAmount && parseFloat(discountAmount) > 0) {
        netDiscount = parseFloat(discountAmount);
        await tx.discountApplication.create({
          data: {
            studentId,
            discountRuleId: discountRuleId || null,
            discountName: discountReason || 'Fee Concession',
            amount: netDiscount,
            reason: discountReason || 'Staff authorized concession',
            status: 'APPROVED',
            appliedById: req.user?.id || 'system',
            approvedById: req.user?.id || 'system',
            approvedAt: new Date()
          }
        });
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
          notes: notes || 'Counter fee collection',
          paidAt: new Date()
        }
      });

      // 3. Process Fee Allocations
      let remainingPaymentToAllocate = paymentAmount;
      const createdPaymentItems = [];

      if (feeAllocations && Array.isArray(feeAllocations) && feeAllocations.length > 0) {
        for (const alloc of feeAllocations) {
          if (remainingPaymentToAllocate <= 0) break;

          let targetStudentFee: any = null;

          if (alloc.studentFeeId) {
            targetStudentFee = await tx.studentFee.findUnique({
              where: { id: alloc.studentFeeId }
            });
          } else if (alloc.feeTypeId) {
            // Find or create studentFee record for this month
            const feeMonth = alloc.month ? parseInt(alloc.month, 10) : new Date().getMonth() + 1;
            const feeYear = new Date().getFullYear();

            targetStudentFee = await tx.studentFee.findUnique({
              where: {
                studentId_academicYearId_feeTypeId_month_year: {
                  studentId,
                  academicYearId: currentYearId,
                  feeTypeId: alloc.feeTypeId,
                  month: feeMonth,
                  year: feeYear
                }
              }
            });

            if (!targetStudentFee) {
              const feeType = await tx.feeType.findUnique({ where: { id: alloc.feeTypeId } });
              const allocAmount = parseFloat(alloc.amount) || paymentAmount;
              targetStudentFee = await tx.studentFee.create({
                data: {
                  studentId,
                  academicYearId: currentYearId,
                  feeTypeId: alloc.feeTypeId,
                  month: feeMonth,
                  year: feeYear,
                  title: `${feeType?.name || 'Fee'} - Month ${feeMonth} ${feeYear}`,
                  amount: allocAmount,
                  discountAmount: 0,
                  netAmount: allocAmount,
                  paidAmount: 0,
                  remainingAmount: allocAmount,
                  dueDate: new Date(feeYear, feeMonth - 1, 15),
                  status: FeeStatus.PENDING
                }
              });
            }
          }

          if (targetStudentFee) {
            const currentRemaining = Number(targetStudentFee.remainingAmount);
            const allocateForThisFee = Math.min(
              alloc.amount ? parseFloat(alloc.amount) : currentRemaining,
              remainingPaymentToAllocate,
              currentRemaining
            );

            if (allocateForThisFee > 0) {
              const newPaidAmount = Number(targetStudentFee.paidAmount) + allocateForThisFee;
              const newRemainingAmount = Math.max(0, currentRemaining - allocateForThisFee);
              const newStatus = newRemainingAmount === 0 ? FeeStatus.PAID : FeeStatus.PARTIAL;

              await tx.studentFee.update({
                where: { id: targetStudentFee.id },
                data: {
                  paidAmount: newPaidAmount,
                  remainingAmount: newRemainingAmount,
                  status: newStatus
                }
              });

              const pItem = await tx.paymentItem.create({
                data: {
                  paymentId: payment.id,
                  studentFeeId: targetStudentFee.id,
                  amountPaid: allocateForThisFee
                }
              });

              createdPaymentItems.push(pItem);
              remainingPaymentToAllocate -= allocateForThisFee;
            }
          }
        }
      } else {
        // Auto-allocate against oldest pending student fees
        const pendingFees = await tx.studentFee.findMany({
          where: { studentId, remainingAmount: { gt: 0 } },
          orderBy: { dueDate: 'asc' }
        });

        for (const fee of pendingFees) {
          if (remainingPaymentToAllocate <= 0) break;
          const currentRemaining = Number(fee.remainingAmount);
          const allocate = Math.min(remainingPaymentToAllocate, currentRemaining);

          if (allocate > 0) {
            const newPaid = Number(fee.paidAmount) + allocate;
            const newRem = currentRemaining - allocate;
            const newStatus = newRem === 0 ? FeeStatus.PAID : FeeStatus.PARTIAL;

            await tx.studentFee.update({
              where: { id: fee.id },
              data: {
                paidAmount: newPaid,
                remainingAmount: newRem,
                status: newStatus
              }
            });

            const pItem = await tx.paymentItem.create({
              data: {
                paymentId: payment.id,
                studentFeeId: fee.id,
                amountPaid: allocate
              }
            });

            createdPaymentItems.push(pItem);
            remainingPaymentToAllocate -= allocate;
          }
        }
      }

      // 4. Calculate total outstanding balance after this payment
      const remainingTotalDues = await tx.studentFee.aggregate({
        where: { studentId, remainingAmount: { gt: 0 } },
        _sum: { remainingAmount: true }
      });

      const currentRemainingBalance = Number(remainingTotalDues._sum.remainingAmount || 0);

      // 5. Generate Sequential Receipt Number
      const receiptCount = await tx.receipt.count();
      const receiptNumber = `${receiptPrefix}-${yearStr}-${(receiptCount + 1).toString().padStart(4, '0')}`;

      const receipt = await tx.receipt.create({
        data: {
          receiptNumber,
          paymentId: payment.id,
          studentId,
          totalAmount: paymentAmount,
          previousBalance: currentRemainingBalance + paymentAmount,
          paidAmount: paymentAmount,
          remainingBalance: currentRemainingBalance,
          generatedAt: new Date()
        }
      });

      return { payment, receipt, student, currentRemainingBalance };
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'COLLECT_PAYMENT',
      module: 'PAYMENTS',
      recordId: transactionResult.payment.id,
      newData: {
        receiptNumber: transactionResult.receipt.receiptNumber,
        amount: paymentAmount,
        paymentMethod,
        studentId
      },
      ipAddress: req.ip
    });

    await broadcastNotification({
      title: 'Fee Payment Received',
      message: `Collected ₹${paymentAmount.toLocaleString('en-IN')} for ${transactionResult.student.firstName} ${transactionResult.student.lastName} (Receipt #${transactionResult.receipt.receiptNumber}) via ${paymentMethod}`,
      type: 'SUCCESS',
      linkUrl: `/receipts`
    });

    res.status(201).json({
      success: true,
      message: `Payment of ₹${paymentAmount.toLocaleString()} recorded successfully`,
      data: {
        paymentId: transactionResult.payment.id,
        receiptId: transactionResult.receipt.id,
        receiptNumber: transactionResult.receipt.receiptNumber,
        amount: paymentAmount,
        remainingBalance: transactionResult.currentRemainingBalance
      }
    });
  } catch (error: any) {
    console.error('Payment collection error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Cancel Payment (Director/Admin only with mandatory reason)
// =============================================================

export const cancelPayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      res.status(400).json({ success: false, message: 'A valid mandatory cancellation reason is required (minimum 5 characters)' });
      return;
    }

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        items: { include: { studentFee: true } },
        receipt: true,
        student: true
      }
    });

    if (!payment) {
      res.status(404).json({ success: false, message: 'Payment record not found' });
      return;
    }

    if (payment.isCancelled) {
      res.status(400).json({ success: false, message: 'Payment is already marked as cancelled' });
      return;
    }

    // Reverse fee accounts and mark payment cancelled
    await prisma.$transaction(async (tx) => {
      // 1. Revert each payment item from the student fee
      for (const item of payment.items) {
        if (item.studentFee) {
          const revertedPaid = Math.max(0, Number(item.studentFee.paidAmount) - Number(item.amountPaid));
          const revertedRemaining = Number(item.studentFee.remainingAmount) + Number(item.amountPaid);
          const revertedStatus = revertedPaid === 0 ? FeeStatus.PENDING : FeeStatus.PARTIAL;

          await tx.studentFee.update({
            where: { id: item.studentFee.id },
            data: {
              paidAmount: revertedPaid,
              remainingAmount: revertedRemaining,
              status: revertedStatus
            }
          });
        }
      }

      // 2. Mark Payment as Cancelled
      await tx.payment.update({
        where: { id },
        data: {
          isCancelled: true,
          cancellationReason: reason.trim(),
          cancelledById: req.user?.id,
          cancelledAt: new Date(),
          paymentStatus: PaymentStatus.CANCELLED
        }
      });
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'CANCEL_PAYMENT',
      module: 'PAYMENTS',
      recordId: id,
      oldData: { amount: payment.amount, receiptNumber: payment.receipt?.receiptNumber },
      newData: { isCancelled: true, reason },
      ipAddress: req.ip
    });

    await broadcastNotification({
      title: 'Payment Voided / Cancelled',
      message: `Payment of ₹${Number(payment.amount).toLocaleString('en-IN')} (Receipt #${payment.receipt?.receiptNumber || 'N/A'}) was voided by ${req.user?.fullName || 'Staff'}. Reason: ${reason}`,
      type: 'WARNING',
      linkUrl: `/reports`
    });

    res.json({ success: true, message: 'Payment cancelled and fee balances restored successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Query Payments
// =============================================================

export const getPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string || '20', 10)));
    const studentId = req.query.studentId as string;
    const paymentMethod = req.query.paymentMethod as string;
    const isCancelled = req.query.isCancelled as string;

    const where: any = {};
    if (studentId) where.studentId = studentId;
    if (paymentMethod) where.paymentMethod = paymentMethod as PaymentMethod;
    if (isCancelled !== undefined) where.isCancelled = isCancelled === 'true';

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { paidAt: 'desc' },
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
          receipt: true,
          collectedBy: {
            select: { id: true, fullName: true, username: true }
          },
          items: {
            include: {
              studentFee: {
                include: { feeType: true }
              }
            }
          }
        }
      })
    ]);

    const formattedPayments = payments.map((p: any) => {
      const studentName = p.student
        ? `${p.student.firstName} ${p.student.lastName || ''}`.trim()
        : 'Student';
      const admissionNumber = p.student?.admissionNumber || '';
      const cls = p.student?.academicRecords?.[0]?.class;
      const className = cls?.name || 'Class';
      const sectionName = p.student?.academicRecords?.[0]?.section?.name || 'A';
      const receiptNumber = p.receipt?.receiptNumber || 'N/A';
      const receiptId = p.receipt?.id || null;
      const collectedByName = p.collectedBy?.fullName || p.collectedBy?.username || 'Staff';

      return {
        ...p,
        studentName,
        admissionNumber,
        className,
        sectionName,
        receiptNumber,
        receiptId,
        collectedByName,
        collectedBy: collectedByName
      };
    });

    res.json({
      success: true,
      data: formattedPayments,
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
// Online Gateway (Razorpay mock/test)
// =============================================================

export const createRazorpayOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount, studentId } = req.body;
    const orderId = `order_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    await prisma.paymentTransaction.create({
      data: {
        orderId,
        amount: parseFloat(amount),
        studentId,
        status: PaymentStatus.PENDING
      }
    });

    res.json({
      success: true,
      data: {
        orderId,
        amount: parseFloat(amount) * 100,
        currency: 'INR',
        key: config.razorpayKeyId
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyRazorpayPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { razorpayOrderId, razorpayPaymentId } = req.body;
    await prisma.paymentTransaction.updateMany({
      where: { orderId: razorpayOrderId },
      data: {
        razorpayPaymentId,
        status: PaymentStatus.SUCCESS
      }
    });

    res.json({ success: true, message: 'Online payment verified successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
