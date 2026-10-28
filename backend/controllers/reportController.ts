import { Request, Response } from 'express';
import { PrismaClient, PaymentStatus, FeeStatus } from '@prisma/client';
import { generateReportPdf } from '../utils/pdfGenerator.js';
import { generateStyledExcelReport, ExcelColumnDef } from '../utils/excelGenerator.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

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

// =============================================================
// Helper: Extract Report Data for PDF and Excel Export
// =============================================================
async function buildReportExportData(type: string, req: AuthenticatedRequest) {
  const settings = await prisma.schoolSettings.findFirst();
  const school = {
    name: settings?.schoolName || 'Pragya Bharti Public School',
    tagline: settings?.tagline || 'Darkness to Light — PBPS Institutional Excellence',
    address: settings?.address || 'Knowledge Park, Institutional Area',
    phone: settings?.phone || '+91 98765 43210',
    email: settings?.email || 'admissions@pbps.edu.in',
    affiliationNumber: settings?.registrationNumber || 'CBSE-AFF-2026'
  };

  const user = req.user?.fullName || req.user?.username || 'Authorized Staff';
  const session = (req.query.session as string) || 'Academic Session 2026-27';

  switch (type) {
    case 'daily': {
      const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
      const start = new Date(dateStr);
      start.setHours(0, 0, 0, 0);
      const end = new Date(dateStr);
      end.setHours(23, 59, 59, 999);

      const payments = await prisma.payment.findMany({
        where: { paymentStatus: PaymentStatus.SUCCESS, isCancelled: false, paidAt: { gte: start, lte: end } },
        include: {
          receipt: true,
          collectedBy: { select: { fullName: true } },
          student: { include: { academicRecords: { include: { class: true }, take: 1 } } }
        },
        orderBy: { paidAt: 'asc' }
      });

      const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);
      let cashTotal = 0;
      let nonCashTotal = 0;
      payments.forEach(p => {
        const amt = Number(p.amount);
        if (p.paymentMethod === 'CASH') cashTotal += amt;
        else nonCashTotal += amt;
      });

      return {
        school,
        title: `Daily Collection Report (${dateStr})`,
        session,
        generatedBy: user,
        baseFilename: `Daily_Collection_${dateStr}`,
        summaryCards: [
          { label: 'Total Collections', value: `₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
          { label: 'Cash Collection', value: `₹${cashTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
          { label: 'Non-Cash Modes', value: `₹${nonCashTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
          { label: 'Transactions', value: `${payments.length}` }
        ],
        pdfColumns: [
          { header: 'Receipt #', width: 80 },
          { header: 'Student Name', width: 120 },
          { header: 'Adm #', width: 65 },
          { header: 'Class', width: 65 },
          { header: 'Type', width: 55 },
          { header: 'Mode', width: 60 },
          { header: 'Amount (₹)', width: 85, align: 'right' as const },
          { header: 'Officer', width: 90 },
          { header: 'Time', width: 60, align: 'center' as const }
        ],
        pdfRows: payments.map(p => [
          p.receipt?.receiptNumber || 'N/A',
          `${p.student.firstName} ${p.student.lastName}`.trim(),
          p.student.admissionNumber,
          p.student.academicRecords[0]?.class?.name || 'Class',
          p.student.isHostelStudent ? 'Hostel' : 'Day',
          p.paymentMethod,
          `₹${Number(p.amount).toFixed(2)}`,
          p.collectedBy?.fullName || 'Staff',
          new Date(p.paidAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        ]),
        pdfTotals: ['TOTAL', '', '', '', '', '', `₹${totalAmount.toFixed(2)}`, '', ''],
        excelColumns: [
          { header: 'Receipt Number', key: 'receiptNumber', width: 16 },
          { header: 'Student Name', key: 'studentName', width: 22 },
          { header: 'Admission #', key: 'admissionNumber', width: 14 },
          { header: 'Class', key: 'className', width: 12 },
          { header: 'Category', key: 'category', width: 12 },
          { header: 'Payment Mode', key: 'paymentMethod', width: 14 },
          { header: 'Transaction Ref', key: 'transactionRef', width: 18 },
          { header: 'Amount (₹)', key: 'amount', width: 16, type: 'currency' as const },
          { header: 'Collected By', key: 'collectedBy', width: 18 },
          { header: 'Payment Date', key: 'paidAt', width: 16, type: 'date' as const }
        ],
        excelData: payments.map(p => ({
          receiptNumber: p.receipt?.receiptNumber || 'N/A',
          studentName: `${p.student.firstName} ${p.student.lastName}`.trim(),
          admissionNumber: p.student.admissionNumber,
          className: p.student.academicRecords[0]?.class?.name || 'Class',
          category: p.student.isHostelStudent ? 'Hostel' : 'Day Scholar',
          paymentMethod: p.paymentMethod,
          transactionRef: p.transactionRef || '-',
          amount: Number(p.amount),
          collectedBy: p.collectedBy?.fullName || 'Staff',
          paidAt: p.paidAt.toISOString().split('T')[0]
        })),
        excelTotalCols: ['amount']
      };
    }

    case 'monthly': {
      const year = parseInt((req.query.year as string) || new Date().getFullYear().toString(), 10);
      const monthsData = [];
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

      for (let m = 0; m < 12; m++) {
        const start = new Date(year, m, 1);
        const end = new Date(year, m + 1, 0, 23, 59, 59);

        const agg = await prisma.payment.aggregate({
          _sum: { amount: true },
          _count: { id: true },
          where: { paymentStatus: PaymentStatus.SUCCESS, isCancelled: false, paidAt: { gte: start, lte: end } }
        });

        monthsData.push({
          month: monthNames[m],
          monthNumber: m + 1,
          amount: Number(agg._sum.amount || 0),
          count: agg._count.id
        });
      }

      const totalAnnual = monthsData.reduce((sum, item) => sum + item.amount, 0);
      const totalCount = monthsData.reduce((sum, item) => sum + item.count, 0);

      return {
        school,
        title: `Annual Fee Collection Trend (${year})`,
        session: `Calendar Year ${year}`,
        generatedBy: user,
        baseFilename: `Monthly_Collection_${year}`,
        summaryCards: [
          { label: 'Calendar Year', value: `${year}` },
          { label: 'Annual Collection', value: `₹${totalAnnual.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
          { label: 'Total Transactions', value: `${totalCount}` }
        ],
        pdfColumns: [
          { header: 'Month', width: 220 },
          { header: 'Transactions Count', width: 180, align: 'right' as const },
          { header: 'Total Collected (₹)', width: 240, align: 'right' as const }
        ],
        pdfRows: monthsData.map(m => [
          m.month,
          m.count,
          `₹${m.amount.toFixed(2)}`
        ]),
        pdfTotals: ['ANNUAL TOTAL', totalCount, `₹${totalAnnual.toFixed(2)}`],
        excelColumns: [
          { header: 'Month', key: 'month', width: 20 },
          { header: 'Transactions', key: 'count', width: 16, type: 'number' as const },
          { header: 'Amount Collected (₹)', key: 'amount', width: 22, type: 'currency' as const }
        ],
        excelData: monthsData,
        excelTotalCols: ['count', 'amount']
      };
    }

    case 'classWise': {
      const classes = await prisma.class.findMany({
        orderBy: { orderNumber: 'asc' },
        include: {
          academicRecords: {
            include: {
              student: { include: { studentFees: true } }
            }
          }
        }
      });

      let totalStudents = 0;
      let totalBilled = 0;
      let totalCollected = 0;
      let totalPending = 0;

      const report = classes.map(cls => {
        let billed = 0;
        let collected = 0;
        let pending = 0;
        let hostelCount = 0;

        cls.academicRecords.forEach(rec => {
          if (rec.student.isHostelStudent) hostelCount++;
          rec.student.studentFees.forEach(fee => {
            billed += Number(fee.netAmount);
            collected += Number(fee.paidAmount);
            pending += Number(fee.remainingAmount);
          });
        });

        totalStudents += cls.academicRecords.length;
        totalBilled += billed;
        totalCollected += collected;
        totalPending += pending;

        return {
          className: cls.name,
          studentCount: cls.academicRecords.length,
          hostelCount,
          billed,
          collected,
          pending,
          rate: billed > 0 ? Math.round((collected / billed) * 100) : 0
        };
      });

      return {
        school,
        title: 'Class-Wise Fee Collection & Dues Analysis',
        session,
        generatedBy: user,
        baseFilename: `Class_Wise_Report_${new Date().getFullYear()}`,
        summaryCards: [
          { label: 'Total Enrolled', value: `${totalStudents}` },
          { label: 'Total Billed', value: `₹${totalBilled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
          { label: 'Total Realized', value: `₹${totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
          { label: 'Outstanding Dues', value: `₹${totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` }
        ],
        pdfColumns: [
          { header: 'Class', width: 100 },
          { header: 'Students', width: 70, align: 'right' as const },
          { header: 'Hostel', width: 65, align: 'right' as const },
          { header: 'Billed (₹)', width: 110, align: 'right' as const },
          { header: 'Collected (₹)', width: 110, align: 'right' as const },
          { header: 'Dues (₹)', width: 110, align: 'right' as const },
          { header: 'Recovery %', width: 75, align: 'right' as const }
        ],
        pdfRows: report.map(r => [
          r.className,
          r.studentCount,
          r.hostelCount,
          `₹${r.billed.toFixed(2)}`,
          `₹${r.collected.toFixed(2)}`,
          `₹${r.pending.toFixed(2)}`,
          `${r.rate}%`
        ]),
        pdfTotals: ['TOTAL', totalStudents, '', `₹${totalBilled.toFixed(2)}`, `₹${totalCollected.toFixed(2)}`, `₹${totalPending.toFixed(2)}`, `${totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0}%`],
        excelColumns: [
          { header: 'Class', key: 'className', width: 16 },
          { header: 'Enrolled Students', key: 'studentCount', width: 16, type: 'number' as const },
          { header: 'Hostel Students', key: 'hostelCount', width: 16, type: 'number' as const },
          { header: 'Total Billed (₹)', key: 'billed', width: 18, type: 'currency' as const },
          { header: 'Total Collected (₹)', key: 'collected', width: 18, type: 'currency' as const },
          { header: 'Outstanding Dues (₹)', key: 'pending', width: 18, type: 'currency' as const },
          { header: 'Recovery %', key: 'rate', width: 14, type: 'number' as const }
        ],
        excelData: report,
        excelTotalCols: ['studentCount', 'hostelCount', 'billed', 'collected', 'pending']
      };
    }

    case 'feeHead': {
      const feeTypes = await prisma.feeType.findMany({
        orderBy: { name: 'asc' },
        include: {
          studentFees: { select: { netAmount: true, paidAmount: true, remainingAmount: true } }
        }
      });

      let grandBilled = 0;
      let grandCollected = 0;
      let grandDues = 0;

      const report = feeTypes.map(ft => {
        let billed = 0;
        let collected = 0;
        let dues = 0;
        ft.studentFees.forEach(f => {
          billed += Number(f.netAmount);
          collected += Number(f.paidAmount);
          dues += Number(f.remainingAmount);
        });
        grandBilled += billed;
        grandCollected += collected;
        grandDues += dues;

        return {
          feeHead: ft.name,
          code: ft.code,
          frequency: ft.frequency,
          billed,
          collected,
          dues
        };
      });

      return {
        school,
        title: 'Fee-Head-Wise Collection & Dues Report',
        session,
        generatedBy: user,
        baseFilename: `Fee_Head_Report_${new Date().getFullYear()}`,
        summaryCards: [
          { label: 'Fee Heads', value: `${report.length}` },
          { label: 'Total Billed', value: `₹${grandBilled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
          { label: 'Total Collected', value: `₹${grandCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
          { label: 'Total Dues', value: `₹${grandDues.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` }
        ],
        pdfColumns: [
          { header: 'Fee Head', width: 160 },
          { header: 'Code', width: 70 },
          { header: 'Frequency', width: 85 },
          { header: 'Billed (₹)', width: 110, align: 'right' as const },
          { header: 'Collected (₹)', width: 110, align: 'right' as const },
          { header: 'Dues (₹)', width: 110, align: 'right' as const }
        ],
        pdfRows: report.map(r => [
          r.feeHead,
          r.code,
          r.frequency,
          `₹${r.billed.toFixed(2)}`,
          `₹${r.collected.toFixed(2)}`,
          `₹${r.dues.toFixed(2)}`
        ]),
        pdfTotals: ['TOTAL', '', '', `₹${grandBilled.toFixed(2)}`, `₹${grandCollected.toFixed(2)}`, `₹${grandDues.toFixed(2)}`],
        excelColumns: [
          { header: 'Fee Head', key: 'feeHead', width: 24 },
          { header: 'Code', key: 'code', width: 12 },
          { header: 'Frequency', key: 'frequency', width: 14 },
          { header: 'Total Billed (₹)', key: 'billed', width: 18, type: 'currency' as const },
          { header: 'Collected (₹)', key: 'collected', width: 18, type: 'currency' as const },
          { header: 'Dues (₹)', key: 'dues', width: 18, type: 'currency' as const }
        ],
        excelData: report,
        excelTotalCols: ['billed', 'collected', 'dues']
      };
    }

    case 'hostel': {
      const hostelStudents = await prisma.student.findMany({
        where: { isHostelStudent: true },
        include: {
          academicRecords: { include: { class: true }, take: 1, orderBy: { createdAt: 'desc' } },
          studentFees: true
        },
        orderBy: { firstName: 'asc' }
      });

      let totalBilled = 0;
      let totalPaid = 0;
      let totalDue = 0;

      const list = hostelStudents.map(s => {
        let billed = 0;
        let paid = 0;
        let due = 0;
        s.studentFees.forEach(f => {
          billed += Number(f.netAmount);
          paid += Number(f.paidAmount);
          due += Number(f.remainingAmount);
        });
        totalBilled += billed;
        totalPaid += paid;
        totalDue += due;

        return {
          name: `${s.firstName} ${s.lastName}`.trim(),
          admissionNumber: s.admissionNumber,
          className: s.academicRecords[0]?.class?.name || 'Class',
          roomNumber: s.hostelRoomNumber || 'Unassigned',
          emergencyPhone: s.emergencyPhone || 'N/A',
          totalBilled: billed,
          totalPaid: paid,
          totalDue: due
        };
      });

      return {
        school,
        title: 'Hostel Boarders & Fee Status Report',
        session,
        generatedBy: user,
        baseFilename: `Hostel_Report_${new Date().getFullYear()}`,
        summaryCards: [
          { label: 'Hostel Boarders', value: `${hostelStudents.length}` },
          { label: 'Total Billed', value: `₹${totalBilled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
          { label: 'Total Paid', value: `₹${totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
          { label: 'Hostel Dues', value: `₹${totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` }
        ],
        pdfColumns: [
          { header: 'Student Name', width: 130 },
          { header: 'Adm #', width: 65 },
          { header: 'Class', width: 65 },
          { header: 'Room #', width: 60 },
          { header: 'Emergency Contact', width: 95 },
          { header: 'Billed (₹)', width: 85, align: 'right' as const },
          { header: 'Paid (₹)', width: 85, align: 'right' as const },
          { header: 'Due (₹)', width: 85, align: 'right' as const }
        ],
        pdfRows: list.map(s => [
          s.name,
          s.admissionNumber,
          s.className,
          s.roomNumber,
          s.emergencyPhone,
          `₹${s.totalBilled.toFixed(2)}`,
          `₹${s.totalPaid.toFixed(2)}`,
          `₹${s.totalDue.toFixed(2)}`
        ]),
        pdfTotals: ['TOTAL', '', '', '', '', `₹${totalBilled.toFixed(2)}`, `₹${totalPaid.toFixed(2)}`, `₹${totalDue.toFixed(2)}`],
        excelColumns: [
          { header: 'Student Name', key: 'name', width: 22 },
          { header: 'Admission #', key: 'admissionNumber', width: 14 },
          { header: 'Class', key: 'className', width: 12 },
          { header: 'Room #', key: 'roomNumber', width: 12 },
          { header: 'Emergency Phone', key: 'emergencyPhone', width: 16 },
          { header: 'Total Billed (₹)', key: 'totalBilled', width: 16, type: 'currency' as const },
          { header: 'Total Paid (₹)', key: 'totalPaid', width: 16, type: 'currency' as const },
          { header: 'Total Due (₹)', key: 'totalDue', width: 16, type: 'currency' as const }
        ],
        excelData: list,
        excelTotalCols: ['totalBilled', 'totalPaid', 'totalDue']
      };
    }

    case 'discounts': {
      const discounts = await prisma.discountApplication.findMany({
        orderBy: { createdAt: 'desc' }
      });

      const totalDiscount = discounts.reduce((sum, d) => sum + Number(d.amount), 0);

      return {
        school,
        title: 'Fee Discounts & Concessions Report',
        session,
        generatedBy: user,
        baseFilename: `Discounts_Report_${new Date().getFullYear()}`,
        summaryCards: [
          { label: 'Applications', value: `${discounts.length}` },
          { label: 'Total Granted', value: `₹${totalDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` }
        ],
        pdfColumns: [
          { header: 'Application ID / Rule', width: 300 },
          { header: 'Date Granted', width: 180 },
          { header: 'Discount Amount (₹)', width: 180, align: 'right' as const }
        ],
        pdfRows: discounts.map(d => [
          d.discountRuleId || 'Special Concession Application',
          new Date(d.createdAt).toLocaleDateString('en-IN'),
          `₹${Number(d.amount).toFixed(2)}`
        ]),
        pdfTotals: ['TOTAL', '', `₹${totalDiscount.toFixed(2)}`],
        excelColumns: [
          { header: 'Application ID / Rule', key: 'rule', width: 30 },
          { header: 'Date Granted', key: 'createdAt', width: 16, type: 'date' as const },
          { header: 'Amount (₹)', key: 'amount', width: 18, type: 'currency' as const }
        ],
        excelData: discounts.map(d => ({
          rule: d.discountRuleId || 'Special Concession Application',
          createdAt: d.createdAt.toISOString().split('T')[0],
          amount: Number(d.amount)
        })),
        excelTotalCols: ['amount']
      };
    }

    case 'staff': {
      const users = await prisma.user.findMany({
        where: { paymentsCollected: { some: { isCancelled: false } } },
        select: {
          id: true,
          fullName: true,
          username: true,
          role: true,
          paymentsCollected: {
            where: { isCancelled: false },
            select: { amount: true, paymentMethod: true }
          }
        }
      });

      let grandTotal = 0;
      let grandTx = 0;

      const report = users.map(u => {
        const total = u.paymentsCollected.reduce((sum, p) => sum + Number(p.amount), 0);
        grandTotal += total;
        grandTx += u.paymentsCollected.length;

        return {
          fullName: u.fullName,
          username: u.username,
          role: u.role,
          count: u.paymentsCollected.length,
          total
        };
      });

      return {
        school,
        title: 'Staff Counter Collections Performance Report',
        session,
        generatedBy: user,
        baseFilename: `Staff_Collections_${new Date().getFullYear()}`,
        summaryCards: [
          { label: 'Active Cashiers', value: `${report.length}` },
          { label: 'Total Collected', value: `₹${grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
          { label: 'Transactions', value: `${grandTx}` }
        ],
        pdfColumns: [
          { header: 'Officer Name', width: 180 },
          { header: 'Username', width: 110 },
          { header: 'Role', width: 110 },
          { header: 'Transactions', width: 100, align: 'right' as const },
          { header: 'Total Collected (₹)', width: 150, align: 'right' as const }
        ],
        pdfRows: report.map(r => [
          r.fullName,
          r.username,
          r.role,
          r.count,
          `₹${r.total.toFixed(2)}`
        ]),
        pdfTotals: ['TOTAL', '', '', grandTx, `₹${grandTotal.toFixed(2)}`],
        excelColumns: [
          { header: 'Officer Name', key: 'fullName', width: 24 },
          { header: 'Username', key: 'username', width: 16 },
          { header: 'Role', key: 'role', width: 16 },
          { header: 'Transactions', key: 'count', width: 14, type: 'number' as const },
          { header: 'Total Collected (₹)', key: 'total', width: 20, type: 'currency' as const }
        ],
        excelData: report,
        excelTotalCols: ['count', 'total']
      };
    }

    case 'cancelled':
    default: {
      const cancelled = await prisma.payment.findMany({
        where: { isCancelled: true },
        include: {
          student: { include: { academicRecords: { include: { class: true }, take: 1 } } },
          receipt: true,
          collectedBy: { select: { fullName: true } }
        },
        orderBy: { cancelledAt: 'desc' }
      });

      const totalCancelled = cancelled.reduce((sum, p) => sum + Number(p.amount), 0);

      return {
        school,
        title: 'Cancelled Payments Audit Trail',
        session,
        generatedBy: user,
        baseFilename: `Cancelled_Payments_Audit_${new Date().toISOString().split('T')[0]}`,
        summaryCards: [
          { label: 'Cancelled Receipts', value: `${cancelled.length}` },
          { label: 'Total Value Cancelled', value: `₹${totalCancelled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` }
        ],
        pdfColumns: [
          { header: 'Receipt #', width: 85 },
          { header: 'Student Name', width: 120 },
          { header: 'Adm #', width: 65 },
          { header: 'Amount (₹)', width: 85, align: 'right' as const },
          { header: 'Mode', width: 60 },
          { header: 'Cancelled Date', width: 90 },
          { header: 'Cancellation Reason', width: 140 },
          { header: 'Officer', width: 90 }
        ],
        pdfRows: cancelled.map(p => [
          p.receipt?.receiptNumber || 'N/A',
          `${p.student.firstName} ${p.student.lastName}`.trim(),
          p.student.admissionNumber,
          `₹${Number(p.amount).toFixed(2)}`,
          p.paymentMethod,
          p.cancelledAt ? new Date(p.cancelledAt).toLocaleDateString('en-IN') : 'N/A',
          p.cancellationReason || 'No reason provided',
          p.collectedBy?.fullName || 'Staff'
        ]),
        pdfTotals: ['TOTAL', '', '', `₹${totalCancelled.toFixed(2)}`, '', '', '', ''],
        excelColumns: [
          { header: 'Receipt Number', key: 'receiptNumber', width: 16 },
          { header: 'Student Name', key: 'studentName', width: 22 },
          { header: 'Admission #', key: 'admissionNumber', width: 14 },
          { header: 'Amount (₹)', key: 'amount', width: 16, type: 'currency' as const },
          { header: 'Payment Method', key: 'paymentMethod', width: 14 },
          { header: 'Cancelled At', key: 'cancelledAt', width: 18, type: 'date' as const },
          { header: 'Cancellation Reason', key: 'reason', width: 28 },
          { header: 'Collected By', key: 'collectedBy', width: 18 }
        ],
        excelData: cancelled.map(p => ({
          receiptNumber: p.receipt?.receiptNumber || 'N/A',
          studentName: `${p.student.firstName} ${p.student.lastName}`.trim(),
          admissionNumber: p.student.admissionNumber,
          amount: Number(p.amount),
          paymentMethod: p.paymentMethod,
          cancelledAt: p.cancelledAt ? p.cancelledAt.toISOString().split('T')[0] : 'N/A',
          reason: p.cancellationReason || 'No reason provided',
          collectedBy: p.collectedBy?.fullName || 'Staff'
        })),
        excelTotalCols: ['amount']
      };
    }
  }
}

// Download Report as Master PDF
export const exportReportPdf = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { type } = req.params;
    const reportData: any = await buildReportExportData(type, req);

    const pdfBuffer = await generateReportPdf({
      school: reportData.school,
      title: reportData.title,
      sessionName: reportData.session,
      generatedBy: reportData.generatedBy,
      kpis: reportData.summaryCards,
      columns: reportData.excelColumns.map((c: any) => ({
        header: c.header,
        key: c.key,
        type: c.type,
        width: Math.max((c.width || 14) * 6, 60),
        align: c.type === 'currency' || c.type === 'number' ? 'right' : 'left'
      })),
      rows: reportData.excelData,
      totals: reportData.excelTotalCols?.reduce((acc: any, k: string) => {
        acc[k] = reportData.excelData.reduce((sum: number, r: any) => sum + (Number(r[k]) || 0), 0);
        return acc;
      }, {})
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${reportData.baseFilename}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('exportReportPdf error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Download Report as Master Excel (.xlsx)
export const exportReportExcel = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { type } = req.params;
    const reportData: any = await buildReportExportData(type, req);

    const excelBuffer = await generateStyledExcelReport({
      school: reportData.school,
      title: reportData.title,
      sessionName: reportData.session,
      generatedBy: reportData.generatedBy,
      summaryMetrics: reportData.summaryCards,
      columns: reportData.excelColumns,
      rows: reportData.excelData,
      totalColumns: reportData.excelTotalCols
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${reportData.baseFilename}.xlsx"`);
    res.send(excelBuffer);
  } catch (error: any) {
    console.error('exportReportExcel error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
