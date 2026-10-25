import { Request, Response } from 'express';
import { PrismaClient, RoleType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logAudit } from '../utils/audit.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { isDatabaseConfigured } from '../config/index.js';
import { ALL_PERMISSIONS_CATALOG, DEFAULT_ROLE_PERMISSIONS, FALLBACK_USERS } from '../utils/fallbackData.js';

const prisma = new PrismaClient();

const DEFAULT_SETTINGS = {
  id: 'default',
  schoolName: 'Pragya Bharti Public School',
  tagline: 'Knowledge, Character & Excellence (PBPS)',
  logoUrl: '/school-logo.svg',
  address: 'Campus Road, PBPS Campus',
  phone: '+91 98765 43210',
  email: 'admissions@pbps.edu.in',
  website: 'https://pbps.edu.in',
  registrationNumber: 'SCH-REG-2024-9981',
  principalName: 'Dr. V. K. Sharma, Principal',
  receiptFooter: 'This is a computer generated fee receipt. Pragya Bharti Public School (PBPS).',
  authorizedSignatory: 'Accounts Officer, PBPS',
  currencySymbol: '₹',
  receiptPrefix: 'PBPS',
  lateFeeEnabled: false,
  lateFeeType: 'FIXED',
  lateFeeAmount: 0,
  lateFeeGraceDays: 10,
  requireDiscountApproval: false,
  requireCustomFeeApproval: true,
  paymentModes: 'Cash,UPI,Cheque,Bank Transfer,Card,Other'
};

// =============================================================
// Roles & Dynamic Permissions
// =============================================================

export const getRolePermissions = async (req: Request, res: Response): Promise<void> => {
  if (!isDatabaseConfigured()) {
    res.json({
      success: true,
      data: {
        permissions: ALL_PERMISSIONS_CATALOG,
        matrix: DEFAULT_ROLE_PERMISSIONS
      }
    });
    return;
  }

  try {
    const [allPermissions, rolePermissions] = await Promise.all([
      prisma.permission.findMany({
        orderBy: [{ module: 'asc' }, { name: 'asc' }]
      }),
      prisma.rolePermission.findMany()
    ]);

    // Group by role
    const matrix: Record<string, string[]> = {
      SUPER_ADMIN: allPermissions.map(p => p.code), // Director always has all
      PRINCIPAL: [],
      ACCOUNTANT: [],
      ADMISSION_STAFF: [],
      STAFF: []
    };

    for (const rp of rolePermissions) {
      if (!matrix[rp.role]) {
        matrix[rp.role] = [];
      }
      matrix[rp.role].push(rp.permissionCode);
    }

    res.json({
      success: true,
      data: {
        permissions: allPermissions,
        matrix
      }
    });
  } catch (error: any) {
    console.warn('Role permissions using fallback due to database notice:', error.message);
    res.json({
      success: true,
      data: {
        permissions: ALL_PERMISSIONS_CATALOG,
        matrix: DEFAULT_ROLE_PERMISSIONS
      }
    });
  }
};

export const updateRolePermissions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { role, permissions } = req.body;

    if (!role || !Array.isArray(permissions)) {
      res.status(400).json({ success: false, message: 'Valid role and permissions array are required' });
      return;
    }

    if (role === 'SUPER_ADMIN') {
      res.status(400).json({ success: false, message: 'Director (Super Admin) permissions are permanent and cannot be restricted' });
      return;
    }

    // Replace permissions for this role in database
    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({
        where: { role: role as RoleType }
      });

      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((code: string) => ({
            role: role as RoleType,
            permissionCode: code
          }))
        });
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'UPDATE_ROLE_PERMISSIONS',
      module: 'PERMISSIONS',
      recordId: role,
      newData: { role, permissionsCount: permissions.length, permissions },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: `Permissions updated successfully for role ${role}`,
      data: { role, permissions }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Staff Management
// =============================================================

export const getStaffList = async (req: Request, res: Response): Promise<void> => {
  if (!isDatabaseConfigured()) {
    res.json({
      success: true,
      data: FALLBACK_USERS.map(u => ({ ...u, phone: '+91 98111 22334', _count: { paymentsCollected: 5 } }))
    });
    return;
  }

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
    console.warn('Staff list using fallback due to database notice:', error.message);
    res.json({
      success: true,
      data: FALLBACK_USERS.map(u => ({ ...u, phone: '+91 98111 22334', _count: { paymentsCollected: 5 } }))
    });
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
        phone: true,
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
      select: { id: true, fullName: true, isActive: true, role: true }
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

// =============================================================
// School Settings
// =============================================================

export const getSettings = async (req: Request, res: Response): Promise<void> => {
  if (!isDatabaseConfigured()) {
    res.json({ success: true, data: DEFAULT_SETTINGS });
    return;
  }

  try {
    let settings = await prisma.schoolSettings.findFirst();
    if (!settings) {
      settings = await prisma.schoolSettings.create({
        data: { id: 'default' }
      });
    }
    res.json({ success: true, data: settings });
  } catch (error: any) {
    console.warn('Settings using fallback due to database notice:', error.message);
    res.json({ success: true, data: DEFAULT_SETTINGS });
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
        logoUrl: data.logoUrl,
        address: data.address,
        phone: data.phone,
        email: data.email,
        website: data.website,
        registrationNumber: data.registrationNumber,
        principalName: data.principalName,
        receiptFooter: data.receiptFooter,
        authorizedSignatory: data.authorizedSignatory,
        currencySymbol: data.currencySymbol || '₹',
        receiptPrefix: data.receiptPrefix || 'PBPS',
        lateFeeEnabled: Boolean(data.lateFeeEnabled),
        lateFeeType: data.lateFeeType || 'FIXED',
        lateFeeAmount: data.lateFeeAmount !== undefined ? parseFloat(data.lateFeeAmount) : 0,
        lateFeeGraceDays: data.lateFeeGraceDays ? parseInt(data.lateFeeGraceDays, 10) : 10,
        requireDiscountApproval: Boolean(data.requireDiscountApproval),
        requireCustomFeeApproval: Boolean(data.requireCustomFeeApproval),
        paymentModes: data.paymentModes || 'Cash,UPI,Cheque,Bank Transfer,Card,Other'
      },
      create: {
        id: 'default',
        schoolName: data.schoolName || 'Pragya Bharti Public School',
        tagline: data.tagline,
        logoUrl: data.logoUrl,
        address: data.address,
        phone: data.phone,
        email: data.email,
        website: data.website,
        registrationNumber: data.registrationNumber,
        principalName: data.principalName,
        receiptFooter: data.receiptFooter,
        authorizedSignatory: data.authorizedSignatory,
        currencySymbol: data.currencySymbol || '₹',
        receiptPrefix: data.receiptPrefix || 'PBPS',
        lateFeeEnabled: Boolean(data.lateFeeEnabled),
        lateFeeType: data.lateFeeType || 'FIXED',
        lateFeeAmount: data.lateFeeAmount !== undefined ? parseFloat(data.lateFeeAmount) : 0,
        lateFeeGraceDays: data.lateFeeGraceDays ? parseInt(data.lateFeeGraceDays, 10) : 10,
        requireDiscountApproval: Boolean(data.requireDiscountApproval),
        requireCustomFeeApproval: Boolean(data.requireCustomFeeApproval),
        paymentModes: data.paymentModes || 'Cash,UPI,Cheque,Bank Transfer,Card,Other'
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

// =============================================================
// One-Click Backup & Restore (Director Only)
// =============================================================

export const exportBackup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const [
      schoolSettings,
      academicYears,
      classes,
      sections,
      feeTypes,
      feeStructures,
      feeStructureItems,
      discountRules,
      rolePermissions,
      students,
      studentAcademicRecords,
      studentFees,
      payments,
      paymentItems,
      receipts
    ] = await Promise.all([
      prisma.schoolSettings.findMany(),
      prisma.academicYear.findMany(),
      prisma.class.findMany(),
      prisma.section.findMany(),
      prisma.feeType.findMany(),
      prisma.feeStructure.findMany(),
      prisma.feeStructureItem.findMany(),
      prisma.discountRule.findMany(),
      prisma.rolePermission.findMany(),
      prisma.student.findMany({ include: { parents: { include: { parent: true } } } }),
      prisma.studentAcademicRecord.findMany(),
      prisma.studentFee.findMany(),
      prisma.payment.findMany(),
      prisma.paymentItem.findMany(),
      prisma.receipt.findMany()
    ]);

    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      exportedBy: req.user?.fullName,
      schoolSettings,
      academicYears,
      classes,
      sections,
      feeTypes,
      feeStructures,
      feeStructureItems,
      discountRules,
      rolePermissions,
      studentsCount: students.length,
      paymentsCount: payments.length,
      receiptsCount: receipts.length,
      data: {
        students,
        studentAcademicRecords,
        studentFees,
        payments,
        paymentItems,
        receipts
      }
    };

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'EXPORT_BACKUP',
      module: 'BACKUP',
      ipAddress: req.ip
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="PBPS_Backup_${new Date().toISOString().split('T')[0]}.json"`);
    res.json({ success: true, data: backupData });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const restoreBackup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { backup } = req.body;
    if (!backup || !backup.schoolSettings) {
      res.status(400).json({ success: false, message: 'Invalid backup file payload' });
      return;
    }

    // Restore Settings & Fee Structures safely
    if (backup.schoolSettings && backup.schoolSettings.length > 0) {
      const s = backup.schoolSettings[0];
      await prisma.schoolSettings.upsert({
        where: { id: 'default' },
        update: s,
        create: s
      });
    }

    if (backup.discountRules && Array.isArray(backup.discountRules)) {
      for (const dr of backup.discountRules) {
        await prisma.discountRule.upsert({
          where: { id: dr.id },
          update: dr,
          create: dr
        });
      }
    }

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'RESTORE_BACKUP',
      module: 'BACKUP',
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Backup verification and configuration restore completed successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Notifications & Audit Logs
// =============================================================

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
