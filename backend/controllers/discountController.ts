import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';

const prisma = new PrismaClient();

// =============================================================
// Discount Rules Master
// =============================================================

export const getDiscountRules = async (req: Request, res: Response): Promise<void> => {
  try {
    const { includeDeleted = 'false', category, search } = req.query;

    const where: any = {};
    if (includeDeleted !== 'true') {
      where.isDeleted = false;
    }
    if (category && typeof category === 'string') {
      where.category = category;
    }
    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { description: { contains: search } }
      ];
    }

    const rules = await prisma.discountRule.findMany({
      where,
      include: {
        _count: {
          select: {
            applications: true
          }
        }
      },
      orderBy: [{ isDeleted: 'asc' }, { createdAt: 'desc' }]
    });

    res.json({ success: true, data: rules });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getDiscountRuleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const rule = await prisma.discountRule.findUnique({
      where: { id },
      include: {
        applications: {
          include: {
            student: {
              include: {
                academicRecords: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  include: { class: true }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!rule) {
      res.status(404).json({ success: false, message: 'Discount rule not found' });
      return;
    }

    res.json({ success: true, data: rule });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createDiscountRule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      name,
      code,
      type,
      value,
      applicableFeeHeads,
      applicableClasses,
      validFrom,
      validTo,
      category = 'OTHER',
      frequency = 'MONTHLY',
      selectedMonths,
      maxCapPerStudent,
      isStackable = true,
      requiresApproval = false,
      description
    } = req.body;

    if (!name || !code || !type || value === undefined) {
      res.status(400).json({ success: false, message: 'Rule name, code, type, and value are required' });
      return;
    }

    const val = parseFloat(value);
    if (isNaN(val) || val < 0) {
      res.status(400).json({ success: false, message: 'Discount value must be a non-negative number' });
      return;
    }

    if (type === 'PERCENTAGE' && val > 100) {
      res.status(400).json({ success: false, message: 'Percentage discount cannot exceed 100%' });
      return;
    }

    // Check code uniqueness
    const existingCode = await prisma.discountRule.findUnique({
      where: { code: code.trim().toUpperCase() }
    });
    if (existingCode) {
      res.status(400).json({ success: false, message: `Discount rule with code ${code.toUpperCase()} already exists` });
      return;
    }

    const rule = await prisma.discountRule.create({
      data: {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        type: type as string,
        value: val,
        applicableFeeHeads: applicableFeeHeads ? (Array.isArray(applicableFeeHeads) ? applicableFeeHeads.join(',') : applicableFeeHeads) : null,
        applicableClasses: applicableClasses ? (Array.isArray(applicableClasses) ? applicableClasses.join(',') : applicableClasses) : null,
        validFrom: validFrom ? new Date(validFrom) : null,
        validTo: validTo ? new Date(validTo) : null,
        category,
        frequency,
        selectedMonths: selectedMonths ? (Array.isArray(selectedMonths) ? selectedMonths.join(',') : selectedMonths) : null,
        maxCapPerStudent: maxCapPerStudent ? parseFloat(maxCapPerStudent) : null,
        isStackable: Boolean(isStackable),
        requiresApproval: Boolean(requiresApproval),
        description: description?.trim() || null
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'CREATE_DISCOUNT_RULE',
      module: 'DISCOUNTS',
      recordId: rule.id,
      newData: rule,
      ipAddress: req.ip
    });

    res.status(201).json({ success: true, data: rule, message: 'Discount rule created successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateDiscountRule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      code,
      type,
      value,
      applicableFeeHeads,
      applicableClasses,
      validFrom,
      validTo,
      category,
      frequency,
      selectedMonths,
      maxCapPerStudent,
      isStackable,
      requiresApproval,
      description,
      isActive
    } = req.body;

    const existing = await prisma.discountRule.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Discount rule not found' });
      return;
    }

    const val = value !== undefined ? parseFloat(value) : Number(existing.value);
    if (isNaN(val) || val < 0) {
      res.status(400).json({ success: false, message: 'Discount value must be a non-negative number' });
      return;
    }

    const updated = await prisma.discountRule.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(code ? { code: code.trim().toUpperCase() } : {}),
        ...(type ? { type: type as string } : {}),
        ...(value !== undefined ? { value: val } : {}),
        applicableFeeHeads: applicableFeeHeads !== undefined
          ? (Array.isArray(applicableFeeHeads) ? applicableFeeHeads.join(',') : applicableFeeHeads)
          : existing.applicableFeeHeads,
        applicableClasses: applicableClasses !== undefined
          ? (Array.isArray(applicableClasses) ? applicableClasses.join(',') : applicableClasses)
          : existing.applicableClasses,
        validFrom: validFrom !== undefined ? (validFrom ? new Date(validFrom) : null) : existing.validFrom,
        validTo: validTo !== undefined ? (validTo ? new Date(validTo) : null) : existing.validTo,
        ...(category ? { category } : {}),
        ...(frequency ? { frequency } : {}),
        selectedMonths: selectedMonths !== undefined
          ? (Array.isArray(selectedMonths) ? selectedMonths.join(',') : selectedMonths)
          : existing.selectedMonths,
        maxCapPerStudent: maxCapPerStudent !== undefined ? (maxCapPerStudent ? parseFloat(maxCapPerStudent) : null) : existing.maxCapPerStudent,
        isStackable: isStackable !== undefined ? Boolean(isStackable) : existing.isStackable,
        requiresApproval: requiresApproval !== undefined ? Boolean(requiresApproval) : existing.requiresApproval,
        description: description !== undefined ? description?.trim() || null : existing.description,
        isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'UPDATE_DISCOUNT_RULE',
      module: 'DISCOUNTS',
      recordId: id,
      oldData: existing,
      newData: updated,
      ipAddress: req.ip
    });

    res.json({ success: true, data: updated, message: 'Discount rule updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Delete & Soft-Delete Discount Rule
// =============================================================
export const deleteDiscountRule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason, activeAssignmentsTreatment = 'END_FROM_MONTH', endMonth, endYear } = req.body;

    const rule = await prisma.discountRule.findUnique({
      where: { id },
      include: {
        applications: {
          where: { isEnded: false, isDeleted: false }
        }
      }
    });

    if (!rule) {
      res.status(404).json({ success: false, message: 'Discount rule not found' });
      return;
    }

    const activeCount = rule.applications.length;
    const totalApplications = await prisma.discountApplication.count({ where: { discountRuleId: id } });

    // If never used anywhere, perform clean removal
    if (totalApplications === 0) {
      await prisma.discountRule.delete({ where: { id } });

      await logAudit({
        userId: req.user?.id,
        userName: req.user?.fullName,
        action: 'HARD_DELETE_DISCOUNT_RULE',
        module: 'DISCOUNTS',
        recordId: id,
        oldData: rule,
        ipAddress: req.ip
      });

      res.json({ success: true, message: 'Discount rule permanently deleted (no prior usage).' });
      return;
    }

    // Soft delete: rule has historical usage
    const targetEndMonth = endMonth ? parseInt(endMonth, 10) : new Date().getMonth() + 1;
    const targetEndYear = endYear ? parseInt(endYear, 10) : new Date().getFullYear();

    await prisma.$transaction(async (tx) => {
      // 1. Mark rule as deleted
      await tx.discountRule.update({
        where: { id },
        data: {
          isActive: false,
          isDeleted: true,
          deletedAt: new Date(),
          deletedById: req.user?.id,
          deletedReason: reason?.trim() || 'Deleted by admin',
          activeAssignmentsTreatment
        }
      });

      // 2. If treatment is END_FROM_MONTH, end all currently active assignments
      if (activeAssignmentsTreatment === 'END_FROM_MONTH') {
        await tx.discountApplication.updateMany({
          where: {
            discountRuleId: id,
            isEnded: false
          },
          data: {
            isEnded: true,
            endedAt: new Date(),
            endedReason: `Concession rule discontinued: ${reason || 'Rule deleted'}`,
            endMonth: targetEndMonth,
            endYear: targetEndYear
          }
        });
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'SOFT_DELETE_DISCOUNT_RULE',
      module: 'DISCOUNTS',
      recordId: id,
      newData: {
        reason,
        activeAssignmentsTreatment,
        affectedActiveStudents: activeCount
      },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: `Discount rule archived successfully. ${activeCount} active student concessions were ${activeAssignmentsTreatment === 'END_FROM_MONTH' ? 'ended from month ' + targetEndMonth : 'kept running until their expiry'}.`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const restoreDiscountRule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const rule = await prisma.discountRule.findUnique({ where: { id } });
    if (!rule) {
      res.status(404).json({ success: false, message: 'Discount rule not found' });
      return;
    }

    const restored = await prisma.discountRule.update({
      where: { id },
      data: {
        isActive: true,
        isDeleted: false,
        deletedAt: null,
        deletedById: null,
        deletedReason: null
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'RESTORE_DISCOUNT_RULE',
      module: 'DISCOUNTS',
      recordId: id,
      newData: restored,
      ipAddress: req.ip
    });

    res.json({ success: true, data: restored, message: 'Discount rule restored to active catalog successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Student Concession Assignment & Sibling Detector
// =============================================================

export const getStudentDiscounts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;

    const applications = await prisma.discountApplication.findMany({
      where: { studentId, isDeleted: false },
      include: {
        discountRule: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: applications });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const assignDiscountToStudent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      studentId,
      discountRuleId,
      customAmount,
      customPercentage,
      effectiveMonth,
      effectiveYear,
      endMonth,
      endYear,
      remarks,
      supportingDocumentUrl
    } = req.body;

    if (!studentId || !discountRuleId) {
      res.status(400).json({ success: false, message: 'Student ID and Discount Rule ID are required' });
      return;
    }

    const [student, rule, settings] = await Promise.all([
      prisma.student.findUnique({
        where: { id: studentId },
        include: {
          academicRecords: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { class: true }
          }
        }
      }),
      prisma.discountRule.findUnique({ where: { id: discountRuleId } }),
      prisma.schoolSettings.findFirst()
    ]);

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }
    if (!rule || rule.isDeleted || !rule.isActive) {
      res.status(400).json({ success: false, message: 'This discount rule is no longer active or available' });
      return;
    }

    // Check stacking setting
    const stackingMode = settings?.discountStackingMode || 'STACK_ALL';
    const existingActive = await prisma.discountApplication.findMany({
      where: {
        studentId,
        isEnded: false,
        isDeleted: false,
        status: { in: ['APPROVED', 'PENDING_APPROVAL'] }
      },
      include: { discountRule: true }
    });

    if (stackingMode === 'BLOCK_SECOND' && existingActive.length > 0) {
      res.status(400).json({
        success: false,
        message: 'School policy only permits one active discount concession per student.'
      });
      return;
    }

    if (!rule.isStackable && existingActive.length > 0) {
      res.status(400).json({
        success: false,
        message: `Rule "${rule.name}" is marked non-stackable and cannot be combined with existing concessions.`
      });
      return;
    }

    // Requires approval?
    const requiresApproval = rule.requiresApproval;
    const initialStatus = requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED';

    const ruleSnapshot = JSON.stringify({
      id: rule.id,
      name: rule.name,
      code: rule.code,
      type: rule.type,
      value: rule.value,
      applicableFeeHeads: rule.applicableFeeHeads,
      category: rule.category,
      frequency: rule.frequency,
      selectedMonths: rule.selectedMonths
    });

    const currentM = effectiveMonth ? parseInt(effectiveMonth, 10) : new Date().getMonth() + 1;
    const currentY = effectiveYear ? parseInt(effectiveYear, 10) : new Date().getFullYear();

    const application = await prisma.discountApplication.create({
      data: {
        studentId,
        discountRuleId,
        discountName: rule.name,
        amount: customAmount ? parseFloat(customAmount) : (rule.type === 'FIXED' ? rule.value : 0),
        effectiveMonth: currentM,
        effectiveYear: currentY,
        endMonth: endMonth ? parseInt(endMonth, 10) : null,
        endYear: endYear ? parseInt(endYear, 10) : null,
        ruleSnapshot,
        status: initialStatus,
        reason: remarks?.trim() || `Concession under rule ${rule.name}`,
        supportingDocumentUrl: supportingDocumentUrl || null,
        appliedById: req.user?.id || 'admin',
        approvedById: requiresApproval ? null : req.user?.id,
        approvedAt: requiresApproval ? null : new Date()
      },
      include: { discountRule: true }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'ASSIGN_STUDENT_DISCOUNT',
      module: 'DISCOUNTS',
      recordId: application.id,
      newData: { studentId, ruleCode: rule.code, status: initialStatus },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      data: application,
      message: requiresApproval
        ? 'Concession application submitted for administrative approval'
        : 'Concession applied successfully'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const endStudentDiscount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { endMonth, endYear, reason } = req.body;

    const application = await prisma.discountApplication.findUnique({
      where: { id },
      include: { discountRule: true, student: true }
    });

    if (!application) {
      res.status(404).json({ success: false, message: 'Discount application not found' });
      return;
    }

    const currentM = endMonth ? parseInt(endMonth, 10) : new Date().getMonth() + 1;
    const currentY = endYear ? parseInt(endYear, 10) : new Date().getFullYear();

    const updated = await prisma.discountApplication.update({
      where: { id },
      data: {
        isEnded: true,
        endedAt: new Date(),
        endedReason: reason?.trim() || 'Discontinued by staff',
        endMonth: currentM,
        endYear: currentY
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'END_STUDENT_DISCOUNT',
      module: 'DISCOUNTS',
      recordId: id,
      newData: { endMonth: currentM, endYear: currentY, reason },
      ipAddress: req.ip
    });

    res.json({ success: true, data: updated, message: 'Concession ended successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Sibling Detector
export const detectSiblings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        parents: { include: { parent: true } }
      }
    });

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    const parentIds = student.parents.map(p => p.parentId);
    const parentPhones = student.parents.map(p => p.parent.primaryPhone).filter(Boolean);

    const siblingCandidates = await prisma.student.findMany({
      where: {
        id: { not: studentId },
        status: 'ACTIVE',
        parents: {
          some: {
            OR: [
              ...(parentIds.length > 0 ? [{ parentId: { in: parentIds } }] : []),
              ...(parentPhones.length > 0 ? [{ parent: { primaryPhone: { in: parentPhones } } }] : [])
            ]
          }
        }
      },
      include: {
        academicRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { class: true }
        },
        discountApplications: {
          where: { isEnded: false },
          include: { discountRule: true }
        },
        parents: {
          include: { parent: true },
          take: 1
        }
      }
    });

    // Check if school has a sibling discount rule
    const siblingRules = await prisma.discountRule.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        category: 'SIBLING'
      }
    });

    res.json({
      success: true,
      data: {
        targetStudent: {
          id: student.id,
          name: `${student.firstName} ${student.lastName}`.trim(),
          admissionNumber: student.admissionNumber
        },
        siblingsFound: siblingCandidates.length,
        siblings: siblingCandidates.map(s => ({
          id: s.id,
          admissionNumber: s.admissionNumber,
          fullName: `${s.firstName} ${s.lastName}`.trim(),
          className: s.academicRecords[0]?.class?.name || 'N/A',
          phone: s.parents[0]?.parent?.primaryPhone || 'N/A',
          fatherName: s.parents[0]?.parent?.fatherName || 'Parent',
          activeDiscounts: s.discountApplications.map(d => d.discountRule?.name).filter(Boolean)
        })),
        suggestedRules: siblingRules
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
