import { Request, Response } from 'express';
import { PrismaClient, RoleType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { logAudit } from '../utils/audit.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { isDatabaseConfigured } from '../config/index.js';
import { ALL_PERMISSIONS_CATALOG, DEFAULT_ROLE_PERMISSIONS, FALLBACK_USERS } from '../utils/fallbackData.js';
import { clearLogoCache } from '../config/logo.js';
import { verifyImageMagicBytes, saveLogoBuffer } from '../middleware/upload.js';
import { seedInitialNotificationsIfEmpty } from '../utils/notificationService.js';

const prisma = new PrismaClient();

const DEFAULT_SETTINGS = {
  id: 'default',
  schoolName: 'Pragya Bharti Public School',
  tagline: 'Knowledge, Character & Excellence (PBPS)',
  logoUrl: '/assets/images/school-logo.png',
  address: 'Alipur, P.O. Buniadgang, Manpur, Gaya, Bihar – 823003',
  phone: '+91 9430442800, +91 7247271212, or 0631-2215243',
  email: 'pragyabhartigayabih@gmail.com',
  website: 'www.pragyabhartipschool.com',
  registrationNumber: 'SCH-REG-2024-9981',
  principalName: 'N/A',
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
      data: FALLBACK_USERS.map(u => ({ ...u, phone: ' +91 9430442800, +91 7247271212, or 0631-2215243', _count: { paymentsCollected: 5 } }))
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
        mustChangePassword: true,
        failedPasswordAttempts: true,
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

export const updateStaff = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { fullName, email, phone, role, isActive, mustChangePassword } = req.body;

    if (!fullName || !email || !role) {
      res.status(400).json({ success: false, message: 'Full name, email, and role are required' });
      return;
    }

    const existing = await prisma.user.findUnique({
      where: { id }
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Staff member not found' });
      return;
    }

    // Guardrail 1: Cannot deactivate yourself
    if (req.user?.id === id && isActive === false) {
      res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
      return;
    }

    // Guardrail 2: Cannot demote yourself from SUPER_ADMIN
    if (req.user?.id === id && req.user?.role === 'SUPER_ADMIN' && role !== 'SUPER_ADMIN') {
      res.status(400).json({ success: false, message: 'You cannot remove your own Super Admin role.' });
      return;
    }

    // Guardrail 3: Prevent demoting or deactivating the last active SUPER_ADMIN
    if (existing.role === 'SUPER_ADMIN' && (role !== 'SUPER_ADMIN' || isActive === false)) {
      const otherSuperAdmins = await prisma.user.count({
        where: {
          role: 'SUPER_ADMIN',
          isActive: true,
          NOT: { id }
        }
      });
      if (otherSuperAdmins === 0) {
        res.status(400).json({
          success: false,
          message: 'Cannot demote or deactivate the last remaining active Super Admin in the system.'
        });
        return;
      }
    }

    // Email uniqueness check
    const normalizedEmail = email.trim().toLowerCase();
    const emailConflict = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        NOT: { id }
      }
    });

    if (emailConflict) {
      res.status(400).json({ success: false, message: 'Email address is already in use by another staff member.' });
      return;
    }

    // Invalidate sessions if role changed or account deactivated
    const shouldRevokeTokens = existing.role !== role || (existing.isActive && isActive === false);
    const tokenVersionUpdate = shouldRevokeTokens ? { increment: 1 } : undefined;

    const updated = await prisma.user.update({
      where: { id },
      data: {
        fullName: fullName.trim(),
        email: normalizedEmail,
        phone: phone ? phone.trim() : null,
        role: role as RoleType,
        isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
        mustChangePassword: mustChangePassword !== undefined ? Boolean(mustChangePassword) : existing.mustChangePassword,
        ...(tokenVersionUpdate ? { tokenVersion: tokenVersionUpdate } : {})
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        username: true,
        phone: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        tokenVersion: true,
        lastLoginAt: true,
        createdAt: true
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'UPDATE_STAFF',
      module: 'STAFF',
      recordId: id,
      oldData: {
        fullName: existing.fullName,
        email: existing.email,
        phone: existing.phone,
        role: existing.role,
        isActive: existing.isActive,
        mustChangePassword: existing.mustChangePassword
      },
      newData: updated,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Staff details updated successfully',
      data: updated
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const toggleStaffStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Staff member not found' });
      return;
    }

    // Guardrail: cannot deactivate self
    if (req.user?.id === id && isActive === false) {
      res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
      return;
    }

    // Guardrail: cannot deactivate last super admin
    if (existing.role === 'SUPER_ADMIN' && isActive === false) {
      const otherSuperAdmins = await prisma.user.count({
        where: {
          role: 'SUPER_ADMIN',
          isActive: true,
          NOT: { id }
        }
      });
      if (otherSuperAdmins === 0) {
        res.status(400).json({
          success: false,
          message: 'Cannot deactivate the last remaining active Super Admin in the system.'
        });
        return;
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        isActive: Boolean(isActive),
        // If deactivating, bump tokenVersion to immediately revoke sessions
        ...(!isActive ? { tokenVersion: { increment: 1 } } : {})
      },
      select: { id: true, fullName: true, isActive: true, role: true }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'UPDATE_STAFF_STATUS',
      module: 'STAFF',
      recordId: id,
      oldData: { isActive: existing.isActive },
      newData: { isActive: updated.isActive },
      ipAddress: req.ip
    });

    res.json({ success: true, message: `Staff status updated to ${isActive ? 'Active' : 'Inactive'}`, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const generateSecurePassword = (): string => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%&*';

  let pwd = '';
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  pwd += special[Math.floor(Math.random() * special.length)];

  const all = upper + lower + digits + special;
  for (let i = 0; i < 8; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }
  return pwd.split('').sort(() => 0.5 - Math.random()).join('');
};

export const resetStaffPassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { newPassword, generateRandom, mustChangePassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ success: false, message: 'Staff member not found' });
      return;
    }

    let finalPassword = newPassword;
    if (generateRandom || !finalPassword) {
      finalPassword = generateSecurePassword();
    } else {
      if (finalPassword.length < 8) {
        res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
        return;
      }
    }

    const passwordHash = await bcrypt.hash(finalPassword, 10);
    const forceChange = mustChangePassword !== undefined ? Boolean(mustChangePassword) : true;

    await prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: forceChange,
        failedPasswordAttempts: 0,
        lockedUntil: null,
        tokenVersion: { increment: 1 } // Invalidate all active sessions for this staff member
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'RESET_STAFF_PASSWORD',
      module: 'STAFF',
      recordId: id,
      newData: { mustChangePassword: forceChange, generatedRandom: Boolean(generateRandom) },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Password reset successfully. The user will be required to change it on their next login.',
      data: {
        temporaryPassword: finalPassword,
        mustChangePassword: forceChange
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// School Settings
// =============================================================

export const getSettings = async (req: Request, res: Response): Promise<void> => {
  if (!isDatabaseConfigured()) {
    res.json({ success: true, data: { ...DEFAULT_SETTINGS, bgImageUrl: '/assets/images/school-campus-bg.jpg' } });
    return;
  }

  try {
    let settings = await prisma.schoolSettings.findFirst();
    if (!settings) {
      settings = await prisma.schoolSettings.create({
        data: { id: 'default' }
      });
    }
    res.json({
      success: true,
      data: {
        ...settings,
        bgImageUrl: '/assets/images/school-campus-bg.jpg'
      }
    });
  } catch (error: any) {
    console.warn('Settings using fallback due to database notice:', error.message);
    res.json({ success: true, data: { ...DEFAULT_SETTINGS, bgImageUrl: '/assets/images/school-campus-bg.jpg' } });
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

    clearLogoCache();
    res.json({ success: true, message: 'School settings updated successfully', data: settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Upload new school logo (PNG/JPG only, max 500 KB)
 * Validates real magic bytes and saves to public/uploads/logo/
 */
export const uploadSchoolLogo = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: 'No image file uploaded.' });
      return;
    }

    if (file.size > 500 * 1024) {
      res.status(400).json({
        success: false,
        message: `Logo file must be less than 500 KB (selected: ${(file.size / 1024).toFixed(1)} KB).`
      });
      return;
    }

    // Verify magic bytes
    const check = verifyImageMagicBytes(file.buffer);
    if (!check.isValid) {
      res.status(400).json({
        success: false,
        message: 'Invalid image format. Only real PNG and JPG files are accepted.'
      });
      return;
    }

    const logoUrl = saveLogoBuffer(file.buffer, check.extension);

    // Update School Settings
    await prisma.schoolSettings.upsert({
      where: { id: 'default' },
      update: { logoUrl },
      create: {
        id: 'default',
        schoolName: 'Pragya Bharti Public School',
        logoUrl
      }
    });

    clearLogoCache();

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'UPLOAD_SCHOOL_LOGO',
      module: 'SETTINGS',
      recordId: 'default',
      newData: { logoUrl },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'School logo uploaded successfully.',
      data: { logoUrl }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Reset school logo to the default official PNG emblem
 */
export const resetSchoolLogo = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const defaultLogo = '/assets/images/school-logo.png';

    await prisma.schoolSettings.upsert({
      where: { id: 'default' },
      update: { logoUrl: defaultLogo },
      create: {
        id: 'default',
        schoolName: 'Pragya Bharti Public School',
        logoUrl: defaultLogo
      }
    });

    clearLogoCache();

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'RESET_SCHOOL_LOGO',
      module: 'SETTINGS',
      recordId: 'default',
      newData: { logoUrl: defaultLogo },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'School logo reset to official default emblem.',
      data: { logoUrl: defaultLogo }
    });
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
    // Ensure baseline system notifications exist if database is freshly initialized
    await seedInitialNotificationsIfEmpty();

    const notifications = await prisma.notification.findMany({
      where: {
        OR: [
          { userId: req.user?.id },
          { userId: null }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 50
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
    const { id } = req.body;
    if (id) {
      await prisma.notification.updateMany({
        where: { id },
        data: { isRead: true }
      });
      res.json({ success: true, message: 'Notification marked as read' });
    } else {
      await prisma.notification.updateMany({
        where: {
          OR: [{ userId: req.user?.id }, { userId: null }],
          isRead: false
        },
        data: { isRead: true }
      });
      res.json({ success: true, message: 'All notifications marked as read' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteNotification = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.notification.deleteMany({
      where: {
        id,
        OR: [{ userId: req.user?.id }, { userId: null }]
      }
    });
    res.json({ success: true, message: 'Notification removed successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const clearAllNotifications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await prisma.notification.deleteMany({
      where: {
        OR: [{ userId: req.user?.id }, { userId: null }]
      }
    });
    res.json({ success: true, message: 'All notifications cleared successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string || '50', 10)));
    const moduleFilter = req.query.module as string;
    const search = (req.query.search as string || '').trim();

    const where: any = {};
    if (moduleFilter && moduleFilter !== 'ALL') {
      where.module = moduleFilter;
    }

    if (search) {
      where.OR = [
        { action: { contains: search } },
        { userName: { contains: search } },
        { module: { contains: search } },
        { recordId: { contains: search } }
      ];
    }

    const [total, rawLogs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { timestamp: 'desc' }
      })
    ]);

    // Format logs with human-readable narrative and consistent schema for UI
    const formattedLogs = rawLogs.map((log) => {
      let parsedOld: any = null;
      let parsedNew: any = null;

      if (log.oldData) {
        try { parsedOld = JSON.parse(log.oldData); } catch { parsedOld = log.oldData; }
      }
      if (log.newData) {
        try { parsedNew = JSON.parse(log.newData); } catch { parsedNew = log.newData; }
      }

      // Generate friendly narrative
      let details = '';
      const act = (log.action || '').toUpperCase();
      const mod = (log.module || '').toUpperCase();

      if (act === 'LOGIN') {
        details = `Signed in successfully from IP ${log.ipAddress || '127.0.0.1'}`;
      } else if (act === 'LOGOUT') {
        details = `Signed out of the system`;
      } else if (act === 'UPDATE_SETTINGS') {
        details = `Updated school profile configuration & institution parameters`;
      } else if (act === 'UPLOAD_SCHOOL_LOGO') {
        details = `Uploaded and set new official school branding logo`;
      } else if (act === 'RESET_SCHOOL_LOGO') {
        details = `Reset school emblem to official default PBPS logo`;
      } else if (act === 'UPDATE_ROLE_PERMISSIONS') {
        details = `Updated role permissions matrix for ${parsedNew?.role || 'staff'}`;
      } else if (act === 'RESET_STAFF_PASSWORD') {
        details = `Reset staff user credentials`;
      } else if (act === 'UPDATE_STAFF_STATUS') {
        details = `Changed staff account status to ${parsedNew?.isActive ? 'Active' : 'Inactive'}`;
      } else if (act === 'CREATE_ROUTE') {
        details = `Created transport route "${parsedNew?.name || log.recordId || ''}"`;
      } else if (act === 'UPDATE_ROUTE') {
        details = `Updated transport route particulars`;
      } else if (act === 'DELETE_ROUTE') {
        details = `Removed transport route from fleet master`;
      } else if (act === 'CREATE_STOP') {
        details = `Added designated bus stop "${parsedNew?.name || ''}" (₹${parsedNew?.monthlyFee || 0}/mo)`;
      } else if (act === 'UPDATE_STOP') {
        details = `Updated bus stop fee / stop order`;
      } else if (act === 'ASSIGN_STUDENT_TRANSPORT') {
        details = `Enrolled student into transport (${parsedNew?.route || ''} - ${parsedNew?.stop || ''})`;
      } else if (act === 'CHANGE_STUDENT_STOP') {
        details = `Transferred student to stop "${parsedNew?.stop || ''}" (Fee: ₹${parsedNew?.monthlyFee || 0}/mo)`;
      } else if (act === 'STOP_STUDENT_TRANSPORT') {
        details = `Discontinued transport service. Reason: ${parsedNew?.reason || 'Staff action'}`;
      } else if (act === 'COLLECT_FEE') {
        details = `Collected fee payment for student`;
      } else if (act === 'CANCEL_PAYMENT') {
        details = `Voided/cancelled payment receipt with audit reason`;
      } else if (act === 'CREATE_DISCOUNT_RULE') {
        details = `Created concession rule "${parsedNew?.name || ''}" (${parsedNew?.value || 0}${parsedNew?.type === 'PERCENTAGE' ? '%' : '₹'})`;
      } else if (act === 'UPDATE_DISCOUNT_RULE') {
        details = `Updated concession rule parameters`;
      } else if (act === 'DELETE_DISCOUNT_RULE') {
        details = `Deleted fee concession rule`;
      } else if (act === 'APPLY_DISCOUNT') {
        details = `Applied fee concession to student account`;
      } else if (act === 'CREATE_STORE_SALE') {
        details = `Processed books & uniform counter sale`;
      } else if (act === 'PROCESS_STORE_RETURN') {
        details = `Processed books/uniform return & refund`;
      } else {
        details = `${log.action.replace(/_/g, ' ')} on ${log.module}${log.recordId ? ` (${log.recordId.slice(0, 8)})` : ''}`;
      }

      return {
        id: log.id,
        timestamp: log.timestamp,
        createdAt: log.timestamp, // backward compatibility
        action: log.action,
        module: log.module,
        resource: `${log.module}${log.recordId ? ` · ${log.recordId}` : ''}`,
        recordId: log.recordId,
        userName: log.userName || 'System',
        userId: log.userId,
        user: { fullName: log.userName || 'System', id: log.userId }, // backward compatibility
        ipAddress: log.ipAddress || 'Internal',
        details,
        oldData: parsedOld,
        newData: parsedNew
      };
    });

    res.json({
      success: true,
      data: formattedLogs,
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
