import { Request, Response } from 'express';
import { PrismaClient, RoleType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logAudit } from '../utils/audit.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const prisma = new PrismaClient();

// Staff Management
export const getStaffList = async (req: Request, res: Response): Promise<void> => {
  try {
    const staff = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        username: true,
        phone: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        _count: {
          select: { paymentsCollected: true }
        }
      }
    });

    res.json({ success: true, data: staff });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createStaff = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { fullName, email, username, phone, role, password } = req.body;

    if (!fullName || !email || !username || !password || !role) {
      res.status(400).json({ success: false, message: 'All fields are required' });
      return;
    }

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: email.trim().toLowerCase() }, { username: username.trim() }]
      }
    });

    if (existing) {
      res.status(400).json({ success: false, message: 'Email or Username already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newStaff = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        username: username.trim(),
        phone: phone || null,
        role: role as RoleType,
        passwordHash,
        isActive: true
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'CREATE_STAFF',
      module: 'STAFF',
      recordId: newStaff.id,
      newData: newStaff,
      ipAddress: req.ip
    });

    res.status(201).json({ success: true, message: 'Staff member added successfully', data: newStaff });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleStaffStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: Boolean(isActive) },
      select: { id: true, fullName: true, isActive: true }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'UPDATE_STAFF_STATUS',
      module: 'STAFF',
      recordId: id,
      newData: { isActive },
      ipAddress: req.ip
    });

    res.json({ success: true, message: `Staff status updated to ${isActive ? 'Active' : 'Inactive'}`, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resetStaffPassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id },
      data: { passwordHash }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'RESET_STAFF_PASSWORD',
      module: 'STAFF',
      recordId: id,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Settings
export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.schoolSettings.findFirst() || await prisma.schoolSettings.create({
      data: { id: 'default' }
    });
    res.json({ success: true, data: settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSettings = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const settings = await prisma.schoolSettings.upsert({
      where: { id: 'default' },
      update: {
        schoolName: data.schoolName,
        tagline: data.tagline,
        address: data.address,
        phone: data.phone,
        email: data.email,
        website: data.website,
        registrationNumber: data.registrationNumber,
        principalName: data.principalName,
        receiptFooter: data.receiptFooter,
        authorizedSignatory: data.authorizedSignatory,
        currencySymbol: data.currencySymbol || '₹'
      },
      create: {
        id: 'default',
        schoolName: data.schoolName || 'Pragya Bharti Public School',
        tagline: data.tagline,
        address: data.address,
        phone: data.phone,
        email: data.email,
        website: data.website,
        registrationNumber: data.registrationNumber,
        principalName: data.principalName,
        receiptFooter: data.receiptFooter,
        authorizedSignatory: data.authorizedSignatory,
        currencySymbol: data.currencySymbol || '₹'
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'UPDATE_SETTINGS',
      module: 'SETTINGS',
      recordId: 'default',
      newData: settings,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'School settings updated successfully', data: settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Notifications
export const getNotifications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { userId: req.user?.id },
          { userId: null }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    const unreadCount = await prisma.notification.count({
      where: {
        OR: [{ userId: req.user?.id }, { userId: null }],
        isRead: false
      }
    });

    res.json({ success: true, data: notifications, unreadCount });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const markNotificationsRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await prisma.notification.updateMany({
      where: {
        OR: [{ userId: req.user?.id }, { userId: null }],
        isRead: false
      },
      data: { isRead: true }
    });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Audit Logs
export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string || '20', 10)));
    const moduleFilter = req.query.module as string;

    const where: any = {};
    if (moduleFilter && moduleFilter !== 'ALL') {
      where.module = moduleFilter;
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { timestamp: 'desc' }
      })
    ]);

    res.json({
      success: true,
      data: logs,
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
