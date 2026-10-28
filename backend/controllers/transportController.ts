import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';
import { generateReportPdf } from '../utils/pdfGenerator.js';
import { generateStyledExcelReport } from '../utils/excelGenerator.js';

const prisma = new PrismaClient();

// =============================================================
// Transport Routes & Stops Master (transport.manage)
// =============================================================

export const getRoutes = async (req: Request, res: Response): Promise<void> => {
  try {
    const includeInactive = req.query.includeInactive === 'true';

    const routes = await prisma.transportRoute.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        stops: {
          orderBy: { orderNumber: 'asc' }
        },
        _count: {
          select: {
            assignments: {
              where: { isActive: true }
            }
          }
        }
      },
      orderBy: { code: 'asc' }
    });

    res.json({
      success: true,
      data: routes.map(r => ({
        id: r.id,
        code: r.code,
        name: r.name,
        description: r.description,
        vehicleNumber: r.vehicleNumber,
        driverName: r.driverName,
        driverPhone: r.driverPhone,
        isActive: r.isActive,
        stopsCount: r.stops.length,
        activeStudentsCount: r._count.assignments,
        _count: {
          assignments: r._count.assignments,
          studentAssignments: r._count.assignments
        },
        stops: r.stops.map(s => ({
          id: s.id,
          name: s.name,
          order: s.orderNumber,
          orderNumber: s.orderNumber,
          monthlyFee: Number(s.monthlyFee),
          oneWayFee: s.oneWayFee ? Number(s.oneWayFee) : null,
          isActive: s.isActive
        }))
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRouteById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const route = await prisma.transportRoute.findUnique({
      where: { id },
      include: {
        stops: { orderBy: { orderNumber: 'asc' } },
        assignments: {
          where: { isActive: true },
          include: {
            student: {
              include: {
                academicRecords: {
                  include: { class: true, section: true },
                  take: 1
                }
              }
            },
            stop: true
          }
        }
      }
    });

    if (!route) {
      res.status(404).json({ success: false, message: 'Transport route not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        ...route,
        stops: route.stops.map(s => ({
          ...s,
          monthlyFee: Number(s.monthlyFee),
          oneWayFee: s.oneWayFee ? Number(s.oneWayFee) : null
        })),
        assignments: route.assignments.map(a => ({
          id: a.id,
          studentId: a.studentId,
          studentName: `${a.student.firstName} ${a.student.lastName}`.trim(),
          admissionNumber: a.student.admissionNumber,
          className: a.student.academicRecords[0]?.class?.name || 'N/A',
          stopName: a.stop.name,
          serviceType: a.serviceType,
          monthlyFee: Number(a.monthlyFee),
          startMonth: a.startMonth,
          startYear: a.startYear,
          pickupPoint: a.pickupPoint
        }))
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createRoute = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { code, name, description, vehicleNumber, driverName, driverPhone, stops } = req.body;

    if (!code || !name) {
      res.status(400).json({ success: false, message: 'Route code and name are required' });
      return;
    }

    const existing = await prisma.transportRoute.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (existing) {
      res.status(400).json({ success: false, message: `Route code ${code} is already in use` });
      return;
    }

    const route = await prisma.$transaction(async (tx) => {
      const created = await tx.transportRoute.create({
        data: {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          description: description?.trim() || null,
          vehicleNumber: vehicleNumber?.trim() || null,
          driverName: driverName?.trim() || null,
          driverPhone: driverPhone?.trim() || null,
          isActive: true
        }
      });

      if (Array.isArray(stops) && stops.length > 0) {
        for (let i = 0; i < stops.length; i++) {
          const s = stops[i];
          if (s.name && Number(s.monthlyFee) >= 0) {
            await tx.transportStop.create({
              data: {
                routeId: created.id,
                name: s.name.trim(),
                orderNumber: Number(s.orderNumber) || i + 1,
                monthlyFee: Number(s.monthlyFee),
                oneWayFee: s.oneWayFee ? Number(s.oneWayFee) : null,
                isActive: s.isActive !== false
              }
            });
          }
        }
      }

      return created;
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName || req.user?.username,
      action: 'CREATE_TRANSPORT_ROUTE',
      module: 'Transport',
      recordId: route.id,
      newData: { code: route.code, name: route.name }
    });

    res.status(201).json({ success: true, message: 'Route created successfully', data: route });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateRoute = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, vehicleNumber, driverName, driverPhone, isActive } = req.body;

    const existing = await prisma.transportRoute.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Route not found' });
      return;
    }

    const updated = await prisma.transportRoute.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        description: description !== undefined ? description?.trim() : existing.description,
        vehicleNumber: vehicleNumber !== undefined ? vehicleNumber?.trim() : existing.vehicleNumber,
        driverName: driverName !== undefined ? driverName?.trim() : existing.driverName,
        driverPhone: driverPhone !== undefined ? driverPhone?.trim() : existing.driverPhone,
        isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName || req.user?.username,
      action: 'UPDATE_TRANSPORT_ROUTE',
      module: 'Transport',
      recordId: id,
      oldData: existing,
      newData: updated
    });

    res.json({ success: true, message: 'Route updated successfully', data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteRoute = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const route = await prisma.transportRoute.findUnique({
      where: { id },
      include: {
        _count: {
          select: { assignments: { where: { isActive: true } } }
        }
      }
    });

    if (!route) {
      res.status(404).json({ success: false, message: 'Route not found' });
      return;
    }

    // Specification: Routes that already have students assigned cannot be hard-deleted; they can only be deactivated.
    if (route._count.assignments > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete route '${route.name}' because ${route._count.assignments} students are currently assigned. Deactivate the route instead.`
      });
      return;
    }

    await prisma.transportRoute.delete({ where: { id } });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName || req.user?.username,
      action: 'DELETE_TRANSPORT_ROUTE',
      module: 'Transport',
      recordId: id,
      oldData: { code: route.code, name: route.name }
    });

    res.json({ success: true, message: 'Route deleted permanently' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Stops Operations
// =============================================================

export const createStop = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const routeId = req.params.routeId || req.body.routeId;
    const { name, orderNumber, order, monthlyFee, oneWayFee, isActive } = req.body;

    if (!routeId) {
      res.status(400).json({ success: false, message: 'Route ID is required' });
      return;
    }

    if (!name || monthlyFee === undefined || Number(monthlyFee) < 0) {
      res.status(400).json({ success: false, message: 'Stop name and a valid non-negative monthly fee are required' });
      return;
    }

    const route = await prisma.transportRoute.findUnique({ where: { id: routeId } });
    if (!route) {
      res.status(404).json({ success: false, message: 'Route not found' });
      return;
    }

    const orderVal = Number(orderNumber !== undefined ? orderNumber : order) || 1;

    const stop = await prisma.transportStop.create({
      data: {
        routeId,
        name: name.trim(),
        orderNumber: orderVal,
        monthlyFee: Number(monthlyFee),
        oneWayFee: oneWayFee !== undefined && oneWayFee !== null && oneWayFee !== '' ? Number(oneWayFee) : null,
        isActive: isActive !== false
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName || req.user?.username,
      action: 'CREATE_TRANSPORT_STOP',
      module: 'Transport',
      recordId: stop.id,
      newData: { routeId, name: stop.name, monthlyFee: Number(stop.monthlyFee) }
    });

    res.status(201).json({
      success: true,
      message: 'Stop added successfully',
      data: {
        ...stop,
        order: stop.orderNumber,
        monthlyFee: Number(stop.monthlyFee),
        oneWayFee: stop.oneWayFee ? Number(stop.oneWayFee) : null
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateStop = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, orderNumber, order, monthlyFee, oneWayFee, isActive } = req.body;

    const existing = await prisma.transportStop.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Stop not found' });
      return;
    }

    const orderVal = orderNumber !== undefined ? Number(orderNumber) : (order !== undefined ? Number(order) : existing.orderNumber);

    const updated = await prisma.transportStop.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        orderNumber: orderVal,
        monthlyFee: monthlyFee !== undefined ? Number(monthlyFee) : existing.monthlyFee,
        oneWayFee: oneWayFee !== undefined && oneWayFee !== null && oneWayFee !== '' ? Number(oneWayFee) : null,
        isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName || req.user?.username,
      action: 'UPDATE_TRANSPORT_STOP',
      module: 'Transport',
      recordId: id,
      oldData: { name: existing.name, monthlyFee: Number(existing.monthlyFee) },
      newData: { name: updated.name, monthlyFee: Number(updated.monthlyFee) }
    });

    res.json({
      success: true,
      message: 'Stop updated successfully',
      data: {
        ...updated,
        order: updated.orderNumber,
        monthlyFee: Number(updated.monthlyFee),
        oneWayFee: updated.oneWayFee ? Number(updated.oneWayFee) : null
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteStop = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const stop = await prisma.transportStop.findUnique({
      where: { id },
      include: {
        _count: {
          select: { assignments: { where: { isActive: true } } }
        }
      }
    });

    if (!stop) {
      res.status(404).json({ success: false, message: 'Stop not found' });
      return;
    }

    // Specification: Stops that already have students assigned cannot be hard-deleted; they can only be deactivated.
    if (stop._count.assignments > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete stop '${stop.name}' because ${stop._count.assignments} students are currently assigned. Deactivate the stop instead.`
      });
      return;
    }

    await prisma.transportStop.delete({ where: { id } });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName || req.user?.username,
      action: 'DELETE_TRANSPORT_STOP',
      module: 'Transport',
      recordId: id,
      oldData: { name: stop.name }
    });

    res.json({ success: true, message: 'Stop deleted permanently' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Assigning & Managing Student Transport (transport.assign)
// =============================================================

export const getStudentTransport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        transportAssignments: {
          orderBy: { createdAt: 'desc' },
          include: {
            route: true,
            stop: true
          }
        },
        transportHistory: {
          orderBy: { createdAt: 'desc' },
          include: {
            route: true,
            stop: true
          }
        }
      }
    });

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    const activeAssignment = student.transportAssignments.find(a => a.isActive) || null;

    res.json({
      success: true,
      data: {
        usesTransport: student.usesTransport,
        activeAssignment: activeAssignment ? {
          id: activeAssignment.id,
          routeId: activeAssignment.routeId,
          routeName: activeAssignment.route.name,
          routeCode: activeAssignment.route.code,
          stopId: activeAssignment.stopId,
          stopName: activeAssignment.stop.name,
          serviceType: activeAssignment.serviceType,
          startMonth: activeAssignment.startMonth,
          startYear: activeAssignment.startYear,
          monthlyFee: Number(activeAssignment.monthlyFee),
          pickupPoint: activeAssignment.pickupPoint,
          isActive: activeAssignment.isActive,
          createdAt: activeAssignment.createdAt
        } : null,
        history: student.transportHistory.map(h => ({
          id: h.id,
          action: h.action,
          routeName: h.route?.name || 'N/A',
          stopName: h.stop?.name || 'N/A',
          serviceType: h.serviceType,
          monthlyFee: Number(h.monthlyFee),
          effectiveMonth: h.effectiveMonth,
          effectiveYear: h.effectiveYear,
          reason: h.reason,
          changedByName: h.changedByName || 'Staff',
          createdAt: h.createdAt
        }))
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const assignStudentTransport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const studentId = req.params.studentId || req.body.studentId;
    const { routeId, stopId, serviceType, startMonth, startYear, pickupPoint } = req.body;

    if (!studentId) {
      res.status(400).json({ success: false, message: 'Student ID is required' });
      return;
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    const stop = await prisma.transportStop.findUnique({
      where: { id: stopId },
      include: { route: true }
    });

    if (!stop || (routeId && stop.routeId !== routeId)) {
      res.status(400).json({ success: false, message: 'Invalid stop or stop does not belong to specified route' });
      return;
    }

    const targetRouteId = routeId || stop.routeId;

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const sMonth = Number(startMonth) || currentMonth;
    const sYear = Number(startYear) || currentYear;

    // Determine monthly fee based on pricing mode / service type
    const sType = serviceType === 'ONE_WAY' ? 'ONE_WAY' : 'TWO_WAY';
    let feeAmount = Number(stop.monthlyFee);
    if (sType === 'ONE_WAY' && stop.oneWayFee) {
      feeAmount = Number(stop.oneWayFee);
    }

    const assignment = await prisma.$transaction(async (tx) => {
      // Deactivate any existing active transport assignment
      await tx.studentTransportAssignment.updateMany({
        where: { studentId, isActive: true },
        data: { isActive: false, stoppedAt: new Date(), stopReason: 'Replaced with new assignment' }
      });

      // Update student flag
      await tx.student.update({
        where: { id: studentId },
        data: { usesTransport: true }
      });

      // Create new assignment
      const newAssign = await tx.studentTransportAssignment.create({
        data: {
          studentId,
          routeId: targetRouteId,
          stopId,
          serviceType: sType,
          startMonth: sMonth,
          startYear: sYear,
          pickupPoint: pickupPoint?.trim() || null,
          monthlyFee: feeAmount,
          isActive: true
        }
      });

      // Record in history table
      await tx.studentTransportHistory.create({
        data: {
          studentId,
          routeId: targetRouteId,
          stopId,
          action: 'ASSIGNED',
          effectiveMonth: sMonth,
          effectiveYear: sYear,
          monthlyFee: feeAmount,
          serviceType: sType,
          reason: pickupPoint ? `Pickup: ${pickupPoint}` : 'Initial transport enrollment',
          changedById: req.user?.id || null,
          changedByName: req.user?.fullName || req.user?.username || 'Staff'
        }
      });

      return newAssign;
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName || req.user?.username,
      action: 'ASSIGN_STUDENT_TRANSPORT',
      module: 'Transport',
      recordId: studentId,
      newData: { route: stop.route.name, stop: stop.name, monthlyFee: feeAmount, startMonth: sMonth }
    });

    res.status(201).json({
      success: true,
      message: `Transport assigned successfully: ${stop.route.name} (${stop.name}) at ₹${feeAmount}/mo from month ${sMonth}`,
      data: assignment
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const changeStudentTransport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const studentId = req.params.studentId || req.body.studentId;
    const routeId = req.body.newRouteId || req.body.routeId;
    const stopId = req.body.newStopId || req.body.stopId;
    const { serviceType, effectiveMonth, effectiveYear, reason } = req.body;

    if (!studentId) {
      res.status(400).json({ success: false, message: 'Student ID is required' });
      return;
    }

    if (!stopId) {
      res.status(400).json({ success: false, message: 'Stop ID is required' });
      return;
    }

    const stop = await prisma.transportStop.findUnique({
      where: { id: stopId },
      include: { route: true }
    });

    if (!stop || (routeId && stop.routeId !== routeId)) {
      res.status(400).json({ success: false, message: 'Invalid stop or stop does not belong to specified route' });
      return;
    }

    const targetRouteId = routeId || stop.routeId;

    const activeAssign = await prisma.studentTransportAssignment.findFirst({
      where: { studentId, isActive: true }
    });

    if (!activeAssign) {
      res.status(400).json({ success: false, message: 'Student does not have active transport service' });
      return;
    }

    const effMonth = Number(effectiveMonth || req.body.startMonth) || new Date().getMonth() + 1;
    const effYear = Number(effectiveYear || req.body.startYear) || new Date().getFullYear();

    const sType = serviceType === 'ONE_WAY' ? 'ONE_WAY' : (serviceType || activeAssign.serviceType);
    let feeAmount = Number(stop.monthlyFee);
    if (sType === 'ONE_WAY' && stop.oneWayFee) {
      feeAmount = Number(stop.oneWayFee);
    }

    await prisma.$transaction(async (tx) => {
      // Update active assignment with new route, stop, fee
      await tx.studentTransportAssignment.update({
        where: { id: activeAssign.id },
        data: {
          routeId: targetRouteId,
          stopId,
          serviceType: sType,
          monthlyFee: feeAmount,
          startMonth: effMonth,
          startYear: effYear
        }
      });

      // Add audit history
      await tx.studentTransportHistory.create({
        data: {
          studentId,
          routeId: targetRouteId,
          stopId,
          action: activeAssign.routeId !== targetRouteId ? 'ROUTE_CHANGED' : 'STOP_CHANGED',
          effectiveMonth: effMonth,
          effectiveYear: effYear,
          monthlyFee: feeAmount,
          serviceType: sType,
          reason: reason?.trim() || 'Stop change requested',
          changedById: req.user?.id || null,
          changedByName: req.user?.fullName || req.user?.username || 'Staff'
        }
      });
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName || req.user?.username,
      action: 'CHANGE_STUDENT_TRANSPORT',
      module: 'Transport',
      recordId: studentId,
      newData: { stop: stop.name, monthlyFee: feeAmount, effectiveMonth: effMonth, reason }
    });

    res.json({
      success: true,
      message: `Transport updated to ${stop.name} (₹${feeAmount}/mo) effective from month ${effMonth}`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const stopStudentTransport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const studentId = req.params.studentId || req.body.studentId;
    const { stopMonth, effectiveMonth, stopYear, effectiveYear, reason } = req.body;

    if (!reason || reason.trim() === '') {
      res.status(400).json({ success: false, message: 'Mandatory reason is required when stopping transport service' });
      return;
    }

    const activeAssign = await prisma.studentTransportAssignment.findFirst({
      where: { studentId, isActive: true },
      include: { route: true, stop: true }
    });

    if (!activeAssign) {
      res.status(400).json({ success: false, message: 'No active transport assignment found for student' });
      return;
    }

    const sMonth = Number(stopMonth || effectiveMonth) || new Date().getMonth() + 1;
    const sYear = Number(stopYear || effectiveYear) || new Date().getFullYear();

    await prisma.$transaction(async (tx) => {
      // Mark assignment inactive with stop month
      await tx.studentTransportAssignment.update({
        where: { id: activeAssign.id },
        data: {
          isActive: false,
          stopMonth: sMonth,
          stopYear: sYear,
          stopReason: reason.trim(),
          stoppedAt: new Date()
        }
      });

      // Update student flag
      await tx.student.update({
        where: { id: studentId },
        data: { usesTransport: false }
      });

      // Record in history table
      await tx.studentTransportHistory.create({
        data: {
          studentId,
          routeId: activeAssign.routeId,
          stopId: activeAssign.stopId,
          action: 'STOPPED',
          effectiveMonth: sMonth,
          effectiveYear: sYear,
          monthlyFee: activeAssign.monthlyFee,
          serviceType: activeAssign.serviceType,
          reason: reason.trim(),
          changedById: req.user?.id || null,
          changedByName: req.user?.fullName || req.user?.username || 'Staff'
        }
      });
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName || req.user?.username,
      action: 'STOP_STUDENT_TRANSPORT',
      module: 'Transport',
      recordId: studentId,
      newData: { stopMonth: sMonth, stopYear: sYear, reason: reason.trim() }
    });

    res.json({
      success: true,
      message: `Transport service stopped effective from month ${sMonth}. Future dues will not be generated.`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Transport Report (PDF & Excel Exports)
// =============================================================

export const getTransportReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const routeId = req.query.routeId as string;

    const where: any = { isActive: true };
    if (routeId) where.routeId = routeId;

    const assignments = await prisma.studentTransportAssignment.findMany({
      where,
      include: {
        student: {
          include: {
            academicRecords: {
              include: { class: true, section: true },
              take: 1
            },
            studentFees: {
              where: {
                feeType: { code: 'TRANS' }
              }
            }
          }
        },
        route: true,
        stop: true
      },
      orderBy: [
        { route: { code: 'asc' } },
        { stop: { orderNumber: 'asc' } }
      ]
    });

    // Fetch all routes to include in the report along with their stops
    const routesWhere: any = {};
    if (routeId) routesWhere.id = routeId;

    const allRoutes = await prisma.transportRoute.findMany({
      where: routesWhere,
      include: {
        stops: {
          orderBy: { orderNumber: 'asc' }
        }
      },
      orderBy: { code: 'asc' }
    });

    let totalMonthlyBilling = 0;
    let totalCollected = 0;
    let totalPending = 0;

    const list = assignments.map(a => {
      const monthlyFee = Number(a.monthlyFee);
      totalMonthlyBilling += monthlyFee;

      let paid = 0;
      let pending = 0;

      a.student.studentFees.forEach(f => {
        paid += Number(f.paidAmount);
        pending += Number(f.remainingAmount);
      });

      totalCollected += paid;
      totalPending += pending;

      return {
        id: a.id,
        studentId: a.studentId,
        studentName: `${a.student.firstName} ${a.student.lastName}`.trim(),
        admissionNumber: a.student.admissionNumber,
        className: a.student.academicRecords[0]?.class?.name || 'N/A',
        sectionName: a.student.academicRecords[0]?.section?.name || 'A',
        routeId: a.routeId,
        routeName: a.route.name,
        routeCode: a.route.code,
        vehicleNumber: a.route.vehicleNumber || 'N/A',
        driverName: a.route.driverName || 'N/A',
        driverPhone: a.route.driverPhone || 'N/A',
        stopId: a.stopId,
        stopName: a.stop.name,
        serviceType: a.serviceType,
        monthlyFee,
        startMonth: a.startMonth,
        startYear: a.startYear,
        stopMonth: a.stopMonth,
        stopYear: a.stopYear,
        pickupPoint: a.pickupPoint || 'N/A',
        isActive: a.isActive,
        totalPaid: paid,
        totalDue: pending
      };
    });

    // Structure routes with their assigned students & demand
    const routeReports = allRoutes.map(r => {
      const rAssignments = list.filter(st => st.routeId === r.id);
      const rMonthlyDemand = rAssignments.reduce((acc, curr) => acc + curr.monthlyFee, 0);
      const rCollected = rAssignments.reduce((acc, curr) => acc + curr.totalPaid, 0);
      const rPending = rAssignments.reduce((acc, curr) => acc + curr.totalDue, 0);

      return {
        id: r.id,
        name: r.name,
        code: r.code,
        vehicleNumber: r.vehicleNumber || '',
        driverName: r.driverName || '',
        driverPhone: r.driverPhone || '',
        description: r.description || '',
        isActive: r.isActive,
        stops: r.stops.map(s => ({
          ...s,
          order: s.orderNumber,
          monthlyFee: Number(s.monthlyFee),
          oneWayFee: s.oneWayFee ? Number(s.oneWayFee) : null
        })),
        stopsCount: r.stops.length,
        studentCount: rAssignments.length,
        monthlyDemand: rMonthlyDemand,
        totalMonthlyDemand: rMonthlyDemand,
        totalCollected: rCollected,
        totalPending: rPending,
        students: rAssignments
      };
    });

    res.json({
      success: true,
      data: {
        totalStudents: assignments.length,
        totalMonthlyBilling,
        totalCollected,
        totalPending,
        summary: {
          totalAssignedStudents: assignments.length,
          totalMonthlyDemand: totalMonthlyBilling,
          totalCollected,
          totalPending
        },
        routes: routeReports,
        students: list
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Transport Audit Trail & Activity Logs
// =============================================================

export const getTransportAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit as string || '50', 10)));
    const search = (req.query.search as string || '').trim().toLowerCase();
    const actionFilter = (req.query.action as string || '').trim();

    // 1. Fetch AuditLog entries for Transport
    const auditWhere: any = {
      OR: [
        { module: 'Transport' },
        { module: 'transport' },
        { action: { contains: 'TRANSPORT' } },
        { action: { contains: 'ROUTE' } },
        { action: { contains: 'STOP' } }
      ]
    };

    if (actionFilter && actionFilter !== 'ALL') {
      auditWhere.action = actionFilter;
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: auditWhere,
      orderBy: { timestamp: 'desc' },
      take: 100
    });

    // 2. Fetch StudentTransportHistory entries
    const historyLogs = await prisma.studentTransportHistory.findMany({
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, admissionNumber: true }
        },
        route: { select: { id: true, name: true, code: true } },
        stop: { select: { id: true, name: true, monthlyFee: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    // 3. Map into a clean, uniform audit event list
    const combinedEvents: any[] = [];

    for (const log of auditLogs) {
      let parsedNew: any = null;
      let parsedOld: any = null;
      try { parsedNew = log.newData ? JSON.parse(log.newData) : null; } catch { parsedNew = log.newData; }
      try { parsedOld = log.oldData ? JSON.parse(log.oldData) : null; } catch { parsedOld = log.oldData; }

      let friendlyDesc = '';
      if (log.action === 'CREATE_TRANSPORT_ROUTE') {
        friendlyDesc = `Created new route "${parsedNew?.name || ''}" (${parsedNew?.code || ''})`;
      } else if (log.action === 'UPDATE_TRANSPORT_ROUTE') {
        friendlyDesc = `Updated route "${parsedNew?.name || parsedOld?.name || ''}"`;
      } else if (log.action === 'DELETE_TRANSPORT_ROUTE') {
        friendlyDesc = `Deleted route "${parsedOld?.name || ''}"`;
      } else if (log.action === 'CREATE_TRANSPORT_STOP') {
        friendlyDesc = `Added stop "${parsedNew?.name || ''}" with monthly fee ₹${parsedNew?.monthlyFee || 0}`;
      } else if (log.action === 'UPDATE_TRANSPORT_STOP') {
        friendlyDesc = `Updated stop "${parsedNew?.name || parsedOld?.name || ''}" (fee: ₹${parsedNew?.monthlyFee || parsedOld?.monthlyFee || 0})`;
      } else if (log.action === 'DELETE_TRANSPORT_STOP') {
        friendlyDesc = `Deleted stop "${parsedOld?.name || ''}"`;
      } else if (log.action === 'ASSIGN_STUDENT_TRANSPORT') {
        friendlyDesc = `Assigned transport to student on ${parsedNew?.route || ''} - ${parsedNew?.stop || ''} (₹${parsedNew?.monthlyFee || 0}/mo)`;
      } else if (log.action === 'CHANGE_STUDENT_TRANSPORT') {
        friendlyDesc = `Changed student stop to ${parsedNew?.stop || ''} effective month ${parsedNew?.effectiveMonth || ''} (Reason: ${parsedNew?.reason || 'N/A'})`;
      } else if (log.action === 'STOP_STUDENT_TRANSPORT') {
        friendlyDesc = `Discontinued transport from month ${parsedNew?.stopMonth || ''} (Reason: ${parsedNew?.reason || 'N/A'})`;
      } else {
        friendlyDesc = `${log.action} performed in ${log.module}`;
      }

      combinedEvents.push({
        id: log.id,
        source: 'AUDIT_LOG',
        action: log.action,
        module: log.module,
        userName: log.userName || 'Staff',
        timestamp: log.timestamp,
        ipAddress: log.ipAddress || '127.0.0.1',
        recordId: log.recordId,
        details: friendlyDesc,
        oldData: parsedOld,
        newData: parsedNew
      });
    }

    for (const h of historyLogs) {
      const studentName = `${h.student?.firstName || ''} ${h.student?.lastName || ''}`.trim();
      const admNo = h.student?.admissionNumber || '';
      const actionName = h.action === 'ASSIGNED' ? 'ENROLL_STUDENT' :
                         h.action === 'STOPPED' ? 'DISCONTINUE_STUDENT' : 'CHANGE_STUDENT_STOP';

      if (actionFilter && actionFilter !== 'ALL' && actionName !== actionFilter) {
        continue;
      }

      const desc = h.action === 'ASSIGNED'
        ? `Enrolled student ${studentName} (${admNo}) into ${h.route?.name || 'Route'} - ${h.stop?.name || 'Stop'} at ₹${Number(h.monthlyFee)}/mo from month ${h.effectiveMonth}/${h.effectiveYear}`
        : h.action === 'STOPPED'
        ? `Stopped transport for ${studentName} (${admNo}) from month ${h.effectiveMonth}/${h.effectiveYear}. Reason: ${h.reason || 'N/A'}`
        : `Changed stop for ${studentName} (${admNo}) to ${h.stop?.name || 'Stop'} at ₹${Number(h.monthlyFee)}/mo from month ${h.effectiveMonth}/${h.effectiveYear}. Reason: ${h.reason || 'N/A'}`;

      combinedEvents.push({
        id: `th-${h.id}`,
        source: 'STUDENT_HISTORY',
        action: actionName,
        module: 'Transport',
        userName: h.changedByName || 'Staff',
        timestamp: h.createdAt,
        ipAddress: '127.0.0.1',
        recordId: h.studentId,
        details: desc,
        studentName,
        admissionNumber: admNo,
        routeName: h.route?.name,
        stopName: h.stop?.name,
        monthlyFee: Number(h.monthlyFee),
        effectiveMonth: h.effectiveMonth,
        effectiveYear: h.effectiveYear,
        reason: h.reason,
        newData: {
          student: `${studentName} (${admNo})`,
          route: h.route?.name,
          stop: h.stop?.name,
          monthlyFee: Number(h.monthlyFee),
          effectiveMonth: `${h.effectiveMonth}/${h.effectiveYear}`,
          reason: h.reason
        }
      });
    }

    // Sort combined events descending by timestamp
    combinedEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply keyword search
    const filtered = search
      ? combinedEvents.filter(e =>
          e.action.toLowerCase().includes(search) ||
          e.userName.toLowerCase().includes(search) ||
          e.details.toLowerCase().includes(search) ||
          (e.studentName && e.studentName.toLowerCase().includes(search)) ||
          (e.admissionNumber && e.admissionNumber.toLowerCase().includes(search)) ||
          (e.routeName && e.routeName.toLowerCase().includes(search)) ||
          (e.stopName && e.stopName.toLowerCase().includes(search))
        )
      : combinedEvents;

    res.json({
      success: true,
      data: filtered.slice((page - 1) * limit, page * limit),
      pagination: {
        total: filtered.length,
        page,
        limit,
        totalPages: Math.ceil(filtered.length / limit)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

