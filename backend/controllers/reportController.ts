import { Request, Response } from 'express';
import { PrismaClient, PaymentStatus, FeeStatus } from '@prisma/client';

const prisma = new PrismaClient();

// 1. Daily Collection Report (Cash vs Other Modes)
export const getDailyCollectionReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const start = new Date(dateStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateStr);
    end.setHours(23, 59, 59, 999);

    const payments = await prisma.payment.findMany({
      where: {
        paymentStatus: PaymentStatus.SUCCESS,
        isCancelled: false,
        paidAt: { gte: start, lte: end }
      },
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
        }
      },
      orderBy: { paidAt: 'asc' }
    });

    const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    const byMethod: Record<string, number> = {};
    let cashTotal = 0;
    let nonCashTotal = 0;

    payments.forEach(p => {
      const amt = Number(p.amount);
      byMethod[p.paymentMethod] = (byMethod[p.paymentMethod] || 0) + amt;
      if (p.paymentMethod === 'CASH') {
        cashTotal += amt;
      } else {
        nonCashTotal += amt;
      }
    });

    res.json({
      success: true,
      data: {
        date: dateStr,
        totalAmount,
        cashTotal,
        nonCashTotal,
        totalTransactions: payments.length,
        byMethod,
        payments: payments.map(p => ({
          id: p.id,
          receiptNumber: p.receipt?.receiptNumber || 'N/A',
          studentName: `${p.student.firstName} ${p.student.lastName}`.trim(),
          admissionNumber: p.student.admissionNumber,
          className: p.student.academicRecords[0]?.class?.name || 'Class',
          isHostel: p.student.isHostelStudent,
          amount: Number(p.amount),
          paymentMethod: p.paymentMethod,
          transactionRef: p.transactionRef,
          paidAt: p.paidAt,
          collectedBy: p.collectedBy?.fullName || 'Counter Staff'
        }))
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Monthly Collection Report
export const getMonthlyCollectionReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const year = parseInt((req.query.year as string) || new Date().getFullYear().toString(), 10);
    const monthsData = [];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    for (let m = 0; m < 12; m++) {
      const start = new Date(year, m, 1);
      const end = new Date(year, m + 1, 0, 23, 59, 59);

      const agg = await prisma.payment.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          paymentStatus: PaymentStatus.SUCCESS,
          isCancelled: false,
          paidAt: { gte: start, lte: end }
        }
      });

      monthsData.push({
        month: monthNames[m],
        monthNumber: m + 1,
        amount: Number(agg._sum.amount || 0),
        count: agg._count.id
      });
    }

    const totalAnnual = monthsData.reduce((sum, item) => sum + item.amount, 0);

    res.json({
      success: true,
      data: {
        year,
        totalAnnual,
        months: monthsData
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Class-Wise Collection and Dues Report
export const getClassWiseCollectionReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const academicYearId = req.query.academicYearId as string;

    const classes = await prisma.class.findMany({
      orderBy: { orderNumber: 'asc' },
      include: {
        academicRecords: {
          where: academicYearId ? { academicYearId } : {},
          include: {
            student: {
              include: {
                studentFees: {
                  where: academicYearId ? { academicYearId } : {}
                }
              }
            }
          }
        }
      }
    });

    const report = classes.map(cls => {
      let totalBilled = 0;
      let totalCollected = 0;
      let totalPending = 0;
      let studentCount = cls.academicRecords.length;
      let hostelCount = 0;

      cls.academicRecords.forEach(rec => {
        if (rec.student.isHostelStudent) hostelCount++;
        rec.student.studentFees.forEach(fee => {
          totalBilled += Number(fee.netAmount);
          totalCollected += Number(fee.paidAmount);
          totalPending += Number(fee.remainingAmount);
        });
      });

      return {
        classId: cls.id,
        className: cls.name,
        studentCount,
        hostelCount,
        totalBilled,
        totalCollected,
        totalPending,
        collectionPercentage: totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0
      };
    });

    res.json({ success: true, data: report });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Fee-Head-Wise Collection Report
export const getFeeHeadWiseReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const feeTypes = await prisma.feeType.findMany({
      orderBy: { name: 'asc' },
      include: {
        studentFees: {
          select: {
            netAmount: true,
            paidAmount: true,
            remainingAmount: true
          }
        }
      }
    });

    const report = feeTypes.map(ft => {
      let billed = 0;
      let collected = 0;
      let dues = 0;

      ft.studentFees.forEach(f => {
        billed += Number(f.netAmount);
        collected += Number(f.paidAmount);
        dues += Number(f.remainingAmount);
      });

      return {
        feeTypeId: ft.id,
        feeHead: ft.name,
        code: ft.code,
        frequency: ft.frequency,
        billed,
        collected,
        dues
      };
    });

    res.json({ success: true, data: report });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5. Hostel Report (Hostel students, fees, collections, room occupancy)
export const getHostelReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const hostelStudents = await prisma.student.findMany({
      where: { isHostelStudent: true },
      include: {
        academicRecords: {
          include: { class: true },
          take: 1,
          orderBy: { createdAt: 'desc' }
        },
        studentFees: {
          include: { feeType: true }
        }
      },
      orderBy: { firstName: 'asc' }
    });

    let totalHostelFeeBilled = 0;
    let totalHostelFeeCollected = 0;
    let totalHostelDues = 0;

    const list = hostelStudents.map(s => {
      let billed = 0;
      let paid = 0;
      let due = 0;

      s.studentFees.forEach(f => {
        billed += Number(f.netAmount);
        paid += Number(f.paidAmount);
        due += Number(f.remainingAmount);
      });

      totalHostelFeeBilled += billed;
      totalHostelFeeCollected += paid;
      totalHostelDues += due;

      return {
        id: s.id,
        admissionNumber: s.admissionNumber,
        name: `${s.firstName} ${s.lastName}`.trim(),
        className: s.academicRecords[0]?.class?.name || 'Class',
        roomNumber: s.hostelRoomNumber || 'Unassigned',
        hostelAdmissionDate: s.hostelAdmissionDate,
        emergencyPhone: s.emergencyPhone,
        totalBilled: billed,
        totalPaid: paid,
        totalDue: due
      };
    });

    res.json({
      success: true,
      data: {
        totalHostelStudents: hostelStudents.length,
        totalHostelFeeBilled,
        totalHostelFeeCollected,
        totalHostelDues,
        students: list
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 6. Discount & Concessions Report
export const getDiscountReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const discounts = await prisma.discountApplication.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const totalDiscountAmount = discounts.reduce((sum, d) => sum + Number(d.amount), 0);

    res.json({
      success: true,
      data: {
        totalApplications: discounts.length,
        totalDiscountAmount,
        discounts
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 7. Staff / User-Wise Collection Report
export const getUserWiseCollectionReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      where: {
        paymentsCollected: { some: { isCancelled: false } }
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        paymentsCollected: {
          where: { isCancelled: false },
          select: {
            amount: true,
            paymentMethod: true,
            paidAt: true
          }
        }
      }
    });

    const report = users.map(u => {
      const totalAmount = u.paymentsCollected.reduce((sum, p) => sum + Number(p.amount), 0);
      const byMode: Record<string, number> = {};
      u.paymentsCollected.forEach(p => {
        byMode[p.paymentMethod] = (byMode[p.paymentMethod] || 0) + Number(p.amount);
      });

      return {
        userId: u.id,
        fullName: u.fullName,
        username: u.username,
        role: u.role,
        transactionsCount: u.paymentsCollected.length,
        totalAmount,
        byMode
      };
    });

    res.json({ success: true, data: report });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 8. Student Ledger (Comprehensive Statement of Account)
export const getStudentLedger = async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        academicRecords: {
          include: { class: true, academicYear: true },
          take: 1,
          orderBy: { createdAt: 'desc' }
        },
        studentFees: {
          include: { feeType: true },
          orderBy: { dueDate: 'asc' }
        },
        payments: {
          where: { isCancelled: false },
          include: { receipt: true, collectedBy: { select: { fullName: true } } },
          orderBy: { paidAt: 'asc' }
        }
      }
    });

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    const ledgerEntries: any[] = [];

    // Add fee debits
    student.studentFees.forEach(f => {
      ledgerEntries.push({
        type: 'DEBIT',
        date: f.createdAt,
        title: f.title,
        debit: Number(f.netAmount),
        credit: 0,
        reference: f.feeType.name,
        status: f.status
      });
    });

    // Add payment credits
    student.payments.forEach(p => {
      ledgerEntries.push({
        type: 'CREDIT',
        date: p.paidAt,
        title: `Payment Received - Receipt #${p.receipt?.receiptNumber || 'N/A'}`,
        debit: 0,
        credit: Number(p.amount),
        reference: `${p.paymentMethod} (${p.transactionRef || 'N/A'})`,
        status: 'PAID'
      });
    });

    ledgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    const computedLedger = ledgerEntries.map(entry => {
      runningBalance += entry.debit - entry.credit;
      return {
        ...entry,
        balance: runningBalance
      };
    });

    res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          admissionNumber: student.admissionNumber,
          fullName: `${student.firstName} ${student.lastName}`.trim(),
          className: student.academicRecords[0]?.class?.name || 'Class',
          isHostelStudent: student.isHostelStudent
        },
        currentBalance: runningBalance,
        ledger: computedLedger
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 9. Cancelled / Edited Payments Audit Report
export const getCancelledPaymentsReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const cancelled = await prisma.payment.findMany({
      where: { isCancelled: true },
      include: {
        student: {
          include: {
            academicRecords: {
              include: { class: true },
              take: 1
            }
          }
        },
        receipt: true,
        collectedBy: { select: { fullName: true } }
      },
      orderBy: { cancelledAt: 'desc' }
    });

    res.json({
      success: true,
      data: cancelled.map(p => ({
        id: p.id,
        receiptNumber: p.receipt?.receiptNumber || 'N/A',
        studentName: `${p.student.firstName} ${p.student.lastName}`.trim(),
        admissionNumber: p.student.admissionNumber,
        className: p.student.academicRecords[0]?.class?.name || 'Class',
        amount: Number(p.amount),
        paymentMethod: p.paymentMethod,
        cancellationReason: p.cancellationReason || 'No reason provided',
        cancelledAt: p.cancelledAt,
        collectedBy: p.collectedBy?.fullName || 'Staff'
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
