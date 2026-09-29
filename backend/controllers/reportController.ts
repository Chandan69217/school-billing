import { Request, Response } from 'express';
import { PrismaClient, PaymentStatus, FeeStatus } from '@prisma/client';

const prisma = new PrismaClient();

export const getDailyCollectionReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const dateStr = req.query.date as string || new Date().toISOString().split('T')[0];
    const start = new Date(dateStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateStr);
    end.setHours(23, 59, 59, 999);

    const payments = await prisma.payment.findMany({
      where: {
        paymentStatus: PaymentStatus.SUCCESS,
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
    payments.forEach(p => {
      byMethod[p.paymentMethod] = (byMethod[p.paymentMethod] || 0) + Number(p.amount);
    });

    res.json({
      success: true,
      data: {
        date: dateStr,
        totalAmount,
        totalTransactions: payments.length,
        byMethod,
        payments: payments.map(p => ({
          id: p.id,
          receiptNumber: p.receipt?.receiptNumber || 'N/A',
          studentName: `${p.student.firstName} ${p.student.lastName}`,
          admissionNumber: p.student.admissionNumber,
          className: p.student.academicRecords[0]?.class?.name || 'Class 8',
          sectionName: p.student.academicRecords[0]?.section?.name || 'A',
          amount: Number(p.amount),
          paymentMethod: p.paymentMethod,
          paidAt: p.paidAt,
          collectedBy: p.collectedBy?.fullName || 'Online / Counter'
        }))
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMonthlyCollectionReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const year = parseInt(req.query.year as string || new Date().getFullYear().toString(), 10);

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

export const getClassWiseCollectionReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } });
    const classes = await prisma.class.findMany({
      orderBy: { orderNumber: 'asc' },
      include: {
        academicRecords: {
          where: activeYear ? { academicYearId: activeYear.id } : undefined,
          include: {
            student: {
              include: {
                payments: {
                  where: { paymentStatus: PaymentStatus.SUCCESS }
                },
                studentFees: true
              }
            }
          }
        }
      }
    });

    const report = classes.map(cls => {
      let studentCount = cls.academicRecords.length;
      let totalCollected = 0;
      let totalBilled = 0;
      let totalPending = 0;

      cls.academicRecords.forEach(rec => {
        rec.student.payments.forEach(p => {
          totalCollected += Number(p.amount);
        });
        rec.student.studentFees.forEach(f => {
          totalBilled += Number(f.netAmount);
          totalPending += Number(f.remainingAmount);
        });
      });

      return {
        classId: cls.id,
        className: cls.name,
        studentCount,
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
