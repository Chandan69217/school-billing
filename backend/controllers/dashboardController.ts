import { Request, Response } from 'express';
import { PrismaClient, PaymentStatus, StudentStatus } from '@prisma/client';

const prisma = new PrismaClient();

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const activeYear = await prisma.academicYear.findFirst({
      where: { isActive: true }
    });

    const activeYearId = activeYear ? activeYear.id : undefined;

    // 1. Total Active Students
    const totalStudents = await prisma.student.count({
      where: { status: StudentStatus.ACTIVE }
    });

    // 2. New Admissions (this active academic year)
    let newAdmissions = 0;
    if (activeYearId) {
      newAdmissions = await prisma.studentAcademicRecord.count({
        where: { academicYearId: activeYearId }
      });
    } else {
      newAdmissions = await prisma.student.count();
    }

    // 3. Total Fee Collection (all time or active year)
    const totalCollectionResult = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { paymentStatus: PaymentStatus.SUCCESS }
    });
    const totalFeeCollection = Number(totalCollectionResult._sum.amount || 0);

    // 4. Pending Fees
    const pendingFeesResult = await prisma.studentFee.aggregate({
      _sum: { remainingAmount: true },
      where: {
        status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
        ...(activeYearId ? { academicYearId: activeYearId } : {})
      }
    });
    const pendingFees = Number(pendingFeesResult._sum.remainingAmount || 0);

    // 5. Today's Collection
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayCollectionResult = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        paymentStatus: PaymentStatus.SUCCESS,
        paidAt: { gte: todayStart, lte: todayEnd }
      }
    });
    const todayCollection = Number(todayCollectionResult._sum.amount || 0);

    // 6. This Month's Collection
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const monthCollectionResult = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        paymentStatus: PaymentStatus.SUCCESS,
        paidAt: { gte: monthStart, lte: monthEnd }
      }
    });
    const thisMonthCollection = Number(monthCollectionResult._sum.amount || 0);

    // Chart 1: Monthly Fee Collection (last 6-12 months)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyTrend: { month: string; amount: number; count: number }[] = [];

    // Create 6 monthly buckets
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const mLabel = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;

      const agg = await prisma.payment.aggregate({
        _sum: { amount: true },
        _count: { id: true },
        where: {
          paymentStatus: PaymentStatus.SUCCESS,
          paidAt: { gte: start, lte: end }
        }
      });

      monthlyTrend.push({
        month: mLabel,
        amount: Number(agg._sum.amount || 0),
        count: agg._count.id
      });
    }

    // Chart 2: Pending vs Paid Fees
    const feeStatusBreakdown = await prisma.studentFee.groupBy({
      by: ['status'],
      _sum: { netAmount: true, paidAmount: true, remainingAmount: true },
      _count: { id: true },
      where: activeYearId ? { academicYearId: activeYearId } : {}
    });

    // Chart 3: Payment Method Distribution
    const paymentMethodsGroup = await prisma.payment.groupBy({
      by: ['paymentMethod'],
      _sum: { amount: true },
      _count: { id: true },
      where: { paymentStatus: PaymentStatus.SUCCESS }
    });

    const paymentMethods = paymentMethodsGroup.map(item => ({
      method: item.paymentMethod,
      amount: Number(item._sum.amount || 0),
      count: item._count.id
    }));

    // Recent Payments table
    const recentPayments = await prisma.payment.findMany({
      take: 6,
      orderBy: { paidAt: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            admissionNumber: true,
            firstName: true,
            lastName: true,
            academicRecords: {
              where: activeYearId ? { academicYearId: activeYearId } : undefined,
              include: { class: true, section: true },
              take: 1
            }
          }
        },
        receipt: { select: { id: true, receiptNumber: true } },
        collectedBy: { select: { fullName: true } }
      }
    });

    // Recent Admissions table
    const recentAdmissions = await prisma.student.findMany({
      take: 6,
      orderBy: { admissionDate: 'desc' },
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
    });

    res.json({
      success: true,
      data: {
        cards: {
          totalStudents,
          newAdmissions,
          totalFeeCollection,
          pendingFees,
          todayCollection,
          thisMonthCollection,
          activeAcademicYear: activeYear?.name || '2026-27'
        },
        charts: {
          monthlyTrend,
          feeStatusBreakdown: feeStatusBreakdown.map(item => ({
            status: item.status,
            count: item._count.id,
            totalAmount: Number(item._sum.netAmount || 0),
            paidAmount: Number(item._sum.paidAmount || 0),
            remainingAmount: Number(item._sum.remainingAmount || 0)
          })),
          paymentMethods
        },
        recentPayments: recentPayments.map(p => ({
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
          paidAt: p.paidAt,
          status: p.paymentStatus,
          collectedBy: p.collectedBy?.fullName || 'Bursar'
        })),
        recentAdmissions: recentAdmissions.map(s => ({
          id: s.id,
          admissionNumber: s.admissionNumber,
          studentName: `${s.firstName} ${s.lastName}`,
          className: s.academicRecords[0]?.class?.name || 'N/A',
          sectionName: s.academicRecords[0]?.section?.name || 'A',
          parentName: s.parents[0]?.parent?.fatherName || s.parents[0]?.parent?.motherName || 'Parent',
          parentPhone: s.parents[0]?.parent?.primaryPhone || 'N/A',
          admissionDate: s.admissionDate,
          status: s.status
        }))
      }
    });
  } catch (error: any) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
