import { Request, Response } from 'express';
import { PrismaClient, PaymentMethod, PaymentStatus } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logAudit } from '../utils/audit.js';
import { generateReceiptPdf } from '../utils/pdf.js';

const prisma = new PrismaClient();

// =============================================================
// Helper: Sequential Receipt & Return Numbers
// =============================================================
async function getNextStoreReceiptNumber(prefix = 'BU'): Promise<string> {
  const currentYear = new Date().getFullYear();
  const count = await prisma.storeSale.count();
  const seq = (count + 1).toString().padStart(4, '0');
  return `${prefix}-${currentYear}-${seq}`;
}

async function getNextReturnNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const count = await prisma.storeReturn.count();
  const seq = (count + 1).toString().padStart(4, '0');
  return `RET-${currentYear}-${seq}`;
}

// =============================================================
// Categories
// =============================================================
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.storeCategory.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { items: true } }
      },
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, data: categories });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCategory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, code, description } = req.body;
    if (!name || !code) {
      res.status(400).json({ success: false, message: 'Category name and code are required' });
      return;
    }

    const category = await prisma.storeCategory.create({
      data: {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description?.trim()
      }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'CREATE_STORE_CATEGORY',
      module: 'STORE',
      recordId: category.id,
      newData: category,
      ipAddress: req.ip
    });

    res.status(201).json({ success: true, data: category, message: 'Category created' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Items & Kits
// =============================================================
export const getItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryId, classId, isKit, search } = req.query;

    const where: any = { isActive: true };
    if (categoryId) where.categoryId = categoryId;
    if (isKit !== undefined) where.isKit = isKit === 'true';
    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } }
      ];
    }

    const items = await prisma.storeItem.findMany({
      where,
      include: {
        category: true
      },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }]
    });

    res.json({ success: true, data: items });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getItemById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const item = await prisma.storeItem.findUnique({
      where: { id },
      include: {
        category: true,
        adjustments: {
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });

    if (!item) {
      res.status(404).json({ success: false, message: 'Item not found' });
      return;
    }

    res.json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      categoryId,
      name,
      code,
      description,
      sizes,
      applicableClasses,
      costPrice,
      price,
      sellingPrice,
      trackStock,
      currentStock,
      lowStockAlert,
      isKit,
      kitItemIds
    } = req.body;

    const finalPrice = price !== undefined ? price : sellingPrice;

    if (!categoryId || !name || !code || finalPrice === undefined) {
      res.status(400).json({ success: false, message: 'Category, name, item code, and price are required' });
      return;
    }

    const initialStock = currentStock ? parseInt(currentStock, 10) : 0;

    const item = await prisma.storeItem.create({
      data: {
        categoryId,
        name: name.trim(),
        sku: (req.body.sku || code).trim().toUpperCase(),
        description: description?.trim() || null,
        sizes: sizes?.trim() || null,
        applicableClasses: applicableClasses?.trim() || 'ALL',
        costPrice: costPrice ? parseFloat(costPrice) : 0,
        price: parseFloat(finalPrice),
        trackStock: trackStock !== undefined ? Boolean(trackStock) : true,
        currentStock: initialStock,
        lowStockAlert: lowStockAlert ? parseInt(lowStockAlert, 10) : 5,
        isKit: Boolean(isKit),
        kitItemIds: kitItemIds ? (typeof kitItemIds === 'string' ? kitItemIds : JSON.stringify(kitItemIds)) : null
      },
      include: { category: true }
    });

    // Record initial stock if > 0
    if (initialStock > 0) {
      await prisma.stockAdjustment.create({
        data: {
          itemId: item.id,
          previousStock: 0,
          quantity: initialStock,
          newStock: initialStock,
          reason: 'Initial Opening Stock',
          adjustedById: req.user?.id,
          adjustedByName: req.user?.fullName
        }
      });
    }

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'CREATE_STORE_ITEM',
      module: 'STORE',
      recordId: item.id,
      newData: item,
      ipAddress: req.ip
    });

    res.status(201).json({ success: true, data: item, message: 'Store item created successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateItem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      categoryId,
      name,
      code,
      description,
      sizes,
      applicableClasses,
      costPrice,
      price,
      sellingPrice,
      trackStock,
      lowStockAlert,
      isActive,
      isKit,
      kitItemIds
    } = req.body;

    const existing = await prisma.storeItem.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Store item not found' });
      return;
    }

    const finalPrice = price !== undefined ? price : sellingPrice;

    const updated = await prisma.storeItem.update({
      where: { id },
      data: {
        ...(categoryId ? { categoryId } : {}),
        ...(name ? { name: name.trim() } : {}),
        ...(code || req.body.sku ? { sku: (req.body.sku || code).trim().toUpperCase() } : {}),
        description: description !== undefined ? description?.trim() || null : existing.description,
        sizes: sizes !== undefined ? sizes?.trim() || null : existing.sizes,
        applicableClasses: applicableClasses !== undefined ? applicableClasses?.trim() || 'ALL' : existing.applicableClasses,
        costPrice: costPrice !== undefined ? (costPrice ? parseFloat(costPrice) : 0) : existing.costPrice,
        price: finalPrice !== undefined ? parseFloat(finalPrice) : existing.price,
        trackStock: trackStock !== undefined ? Boolean(trackStock) : existing.trackStock,
        lowStockAlert: lowStockAlert !== undefined ? parseInt(lowStockAlert, 10) : existing.lowStockAlert,
        isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
        isKit: isKit !== undefined ? Boolean(isKit) : existing.isKit,
        kitItemIds: kitItemIds !== undefined ? (typeof kitItemIds === 'string' ? kitItemIds : JSON.stringify(kitItemIds)) : existing.kitItemIds
      },
      include: { category: true }
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'UPDATE_STORE_ITEM',
      module: 'STORE',
      recordId: id,
      oldData: existing,
      newData: updated,
      ipAddress: req.ip
    });

    res.json({ success: true, data: updated, message: 'Item updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Stock Adjustment
// =============================================================
export const adjustStock = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { itemId, adjustmentQty, reason } = req.body;
    const qty = parseInt(adjustmentQty, 10);

    if (!itemId || isNaN(qty) || qty === 0 || !reason) {
      res.status(400).json({ success: false, message: 'Item ID, non-zero adjustment quantity, and reason are required' });
      return;
    }

    const item = await prisma.storeItem.findUnique({ where: { id: itemId } });
    if (!item) {
      res.status(404).json({ success: false, message: 'Item not found' });
      return;
    }

    const previousStock = item.currentStock;
    const newStock = previousStock + qty;

    if (newStock < 0) {
      res.status(400).json({ success: false, message: `Cannot reduce stock below 0. Current stock is ${previousStock}.` });
      return;
    }

    const [updatedItem, adjustment] = await prisma.$transaction([
      prisma.storeItem.update({
        where: { id: itemId },
        data: { currentStock: newStock }
      }),
      prisma.stockAdjustment.create({
        data: {
          itemId,
          previousStock,
          quantity: qty,
          newStock,
          reason: reason.trim(),
          adjustedById: req.user?.id,
          adjustedByName: req.user?.fullName
        }
      })
    ]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'ADJUST_STORE_STOCK',
      module: 'STORE',
      recordId: itemId,
      oldData: { currentStock: previousStock },
      newData: { currentStock: newStock, reason },
      ipAddress: req.ip
    });

    res.json({ success: true, data: { item: updatedItem, adjustment }, message: 'Stock adjusted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Counter Sales (POS)
// =============================================================
export const createSale = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      studentId,
      academicYearId,
      walkInCustomerName,
      walkInName,
      walkInPhone,
      items, // Array of { itemId, quantity, unitPrice, discountAmount, size }
      discountAmount = 0,
      paymentMethod = 'CASH',
      transactionRef,
      remarks,
      notes,
      addToStudentDues = false
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: 'At least one sale item is required' });
      return;
    }

    const settings = await prisma.schoolSettings.findFirst();
    const allowWalkIn = settings?.storeAllowWalkIn ?? true;
    const allowAddToDues = settings?.storeAllowAddToDues ?? true;
    const stockTracking = settings?.storeStockTracking ?? true;
    const prefix = settings?.storeReceiptPrefix || 'BU';

    const customerName = walkInCustomerName || walkInName;

    if (!studentId && !allowWalkIn) {
      res.status(400).json({ success: false, message: 'Walk-in sales are disabled by administration' });
      return;
    }

    if (!studentId && addToStudentDues) {
      res.status(400).json({ success: false, message: 'Walk-in sales cannot be added to student dues' });
      return;
    }

    if (addToStudentDues && !allowAddToDues) {
      res.status(400).json({ success: false, message: 'Adding store sales to student dues is disabled by administration' });
      return;
    }

    let student = null;
    if (studentId) {
      student = await prisma.student.findUnique({
        where: { id: studentId },
        include: {
          academicRecords: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { class: true, academicYear: true }
          }
        }
      });
      if (!student) {
        res.status(404).json({ success: false, message: 'Student not found' });
        return;
      }
    }

    const dbItems = await prisma.storeItem.findMany({
      where: { id: { in: items.map(i => i.itemId) } },
      include: { category: true }
    });

    const itemMap = new Map(dbItems.map(i => [i.id, i]));
    const saleItemsData: Array<{
      itemId: string;
      itemName: string;
      categoryName: string;
      size: string | null;
      quantity: number;
      unitPrice: number;
      discount: number;
      totalPrice: number;
    }> = [];

    let calculatedSubtotal = 0;
    let calculatedItemDiscounts = 0;

    for (const line of items) {
      const dbItem = itemMap.get(line.itemId);
      if (!dbItem) {
        res.status(400).json({ success: false, message: `Item ID ${line.itemId} not found` });
        return;
      }

      const qty = parseInt(line.quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        res.status(400).json({ success: false, message: `Invalid quantity for item ${dbItem.name}` });
        return;
      }

      if (stockTracking && dbItem.trackStock && dbItem.currentStock < qty) {
        const userPermissions: string[] = req.user?.permissions || [];
        const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
        if (!isSuperAdmin && !userPermissions.includes('store.oversell')) {
          res.status(400).json({
            success: false,
            message: `Insufficient stock for ${dbItem.name}. Current stock: ${dbItem.currentStock}, Requested: ${qty}`
          });
          return;
        }
      }

      const unitPrice = line.unitPrice !== undefined ? parseFloat(line.unitPrice) : Number(dbItem.price);
      const lineDiscount = line.discountAmount ? parseFloat(line.discountAmount) : (line.discount ? parseFloat(line.discount) : 0);
      const lineTotal = (qty * unitPrice) - lineDiscount;

      calculatedSubtotal += (qty * unitPrice);
      calculatedItemDiscounts += lineDiscount;

      saleItemsData.push({
        itemId: dbItem.id,
        itemName: dbItem.name,
        categoryName: dbItem.category.name,
        size: line.size || dbItem.sizes || null,
        quantity: qty,
        unitPrice,
        discount: lineDiscount,
        totalPrice: lineTotal
      });
    }

    const overallDiscount = parseFloat(discountAmount) || 0;
    const totalDiscount = calculatedItemDiscounts + overallDiscount;
    const grandTotal = Math.max(0, calculatedSubtotal - totalDiscount);

    const receiptNumber = await getNextStoreReceiptNumber(prefix);
    const activeYearId = academicYearId || student?.academicRecords[0]?.academicYearId;

    const sale = await prisma.$transaction(async (tx) => {
      let createdStudentFeeId: string | null = null;

      // If added to student dues, create StudentFee record first
      if (addToStudentDues && studentId && activeYearId) {
        let feeType = await tx.feeType.findFirst({
          where: { code: { in: ['BOOKS', 'UNIF', 'STORE'] } }
        });
        if (!feeType) {
          feeType = await tx.feeType.findFirst();
        }

        if (feeType) {
          const sf = await tx.studentFee.create({
            data: {
              studentId,
              academicYearId: activeYearId,
              feeTypeId: feeType.id,
              month: new Date().getMonth() + 1,
              year: new Date().getFullYear(),
              title: `Books/Uniform Store Sale (${receiptNumber})`,
              amount: grandTotal,
              discountAmount: 0,
              netAmount: grandTotal,
              paidAmount: 0,
              remainingAmount: grandTotal,
              dueDate: new Date(),
              status: 'PENDING'
            }
          });
          createdStudentFeeId = sf.id;
        }
      }

      // 1. Create StoreSale
      const createdSale = await tx.storeSale.create({
        data: {
          receiptNumber,
          studentId: studentId || null,
          academicYearId: activeYearId || null,
          walkInName: !studentId ? (customerName?.trim() || 'Walk-in Customer') : null,
          walkInPhone: !studentId ? (walkInPhone?.trim() || null) : null,
          totalAmount: calculatedSubtotal,
          discountAmount: totalDiscount,
          netAmount: grandTotal,
          paymentMethod: addToStudentDues ? PaymentMethod.CASH : (paymentMethod as PaymentMethod),
          transactionRef: transactionRef?.trim() || null,
          paymentStatus: addToStudentDues ? PaymentStatus.PENDING : PaymentStatus.SUCCESS,
          isAddedToDues: Boolean(addToStudentDues),
          studentFeeId: createdStudentFeeId,
          notes: notes?.trim() || remarks?.trim() || null,
          soldById: req.user?.id || null,
          soldByName: req.user?.fullName || 'Cashier',
          items: {
            create: saleItemsData.map(item => ({
              itemId: item.itemId,
              itemName: item.itemName,
              categoryName: item.categoryName,
              size: item.size,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              totalPrice: item.totalPrice
            }))
          }
        },
        include: {
          items: true,
          student: true
        }
      });

      // 2. Decrement stock
      if (stockTracking) {
        for (const item of saleItemsData) {
          await tx.storeItem.update({
            where: { id: item.itemId },
            data: {
              currentStock: { decrement: item.quantity }
            }
          });
        }
      }

      return createdSale;
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'CREATE_STORE_SALE',
      module: 'STORE',
      recordId: sale.id,
      newData: { receiptNumber: sale.receiptNumber, netAmount: grandTotal, studentId },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      data: sale,
      message: `Sale completed successfully with Receipt #${sale.receiptNumber}`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSales = async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentId, startDate, endDate, paymentStatus, page = '1', limit = '20' } = req.query;

    const where: any = {};
    if (studentId) where.studentId = studentId;
    if (paymentStatus) where.paymentStatus = paymentStatus as PaymentStatus;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) {
        const d = new Date(endDate as string);
        d.setHours(23, 59, 59, 999);
        where.createdAt.lte = d;
      }
    }

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 20;

    const [sales, totalCount] = await Promise.all([
      prisma.storeSale.findMany({
        where,
        include: {
          student: {
            include: {
              academicRecords: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                include: { class: true }
              }
            }
          },
          items: true,
          returns: true
        },
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum
      }),
      prisma.storeSale.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        sales,
        pagination: {
          total: totalCount,
          page: pageNum,
          totalPages: Math.ceil(totalCount / limitNum)
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSaleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const sale = await prisma.storeSale.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            academicRecords: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { class: true, section: true }
            }
          }
        },
        items: true,
        returns: true
      }
    });

    if (!sale) {
      res.status(404).json({ success: false, message: 'Sale not found' });
      return;
    }

    res.json({ success: true, data: sale });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Sale PDF Receipt
// =============================================================
export const getSalePdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const sale = await prisma.storeSale.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            academicRecords: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { class: true, section: true }
            }
          }
        },
        items: true
      }
    });

    if (!sale) {
      res.status(404).json({ success: false, message: 'Sale not found' });
      return;
    }

    const settings = await prisma.schoolSettings.findFirst();
    const className = sale.student?.academicRecords[0]?.class?.name || 'Walk-in';
    const customerName = sale.student
      ? `${sale.student.firstName} ${sale.student.lastName}`.trim()
      : (sale.walkInName || 'Walk-in Customer');

    const pdfBuffer = await generateReceiptPdf({
      school: {
        name: settings?.schoolName || 'Pragya Bharti Public School',
        tagline: settings?.tagline || undefined,
        address: settings?.address || 'Vill-Dumri, PO-Gardanibagh, Patna - 800002',
        phone: settings?.phone || '+91 9876543210',
        email: settings?.email || 'info@pbpspatna.edu.in',
        logoUrl: settings?.logoUrl || '/assets/images/school-logo.png',
        registrationNumber: settings?.registrationNumber || undefined,
        receiptFooter: settings?.receiptFooter || 'Books & Uniform counter purchase receipt',
        authorizedSignatory: settings?.authorizedSignatory || 'Store In-Charge'
      },
      receiptNumber: sale.receiptNumber,
      paymentDate: new Date(sale.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      paymentMethod: sale.paymentMethod,
      transactionRef: sale.transactionRef || undefined,
      student: {
        admissionNumber: sale.student?.admissionNumber || 'Walk-in',
        name: customerName,
        className,
        fatherName: sale.walkInPhone ? `Contact: ${sale.walkInPhone}` : 'Parent',
        phone: sale.walkInPhone || 'N/A'
      },
      academicYear: '2026-27',
      items: sale.items.map(it => ({
        title: `${it.itemName}${it.size ? ` (Size: ${it.size})` : ''} [${it.categoryName}] x ${it.quantity}`,
        amount: Number(it.totalPrice)
      })),
      totalAmount: Number(sale.totalAmount),
      previousBalance: 0,
      paidAmount: Number(sale.netAmount),
      remainingBalance: 0,
      collectedBy: sale.soldByName || 'Store Staff'
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Store_Receipt_${sale.receiptNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Process Returns & Reversals
// =============================================================
export const processReturn = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // Sale ID
    const { saleItemId, quantityReturned, refundAmount, reason } = req.body;

    const qty = parseInt(quantityReturned, 10);
    if (!saleItemId || isNaN(qty) || qty <= 0 || !reason) {
      res.status(400).json({ success: false, message: 'Sale item ID, valid return quantity, and reason are required' });
      return;
    }

    const sale = await prisma.storeSale.findUnique({
      where: { id },
      include: { items: true, returns: true }
    });

    if (!sale) {
      res.status(404).json({ success: false, message: 'Sale not found' });
      return;
    }

    if (sale.isCancelled) {
      res.status(400).json({ success: false, message: 'Cannot return items from a cancelled sale' });
      return;
    }

    const saleItem = sale.items.find(i => i.id === saleItemId);
    if (!saleItem) {
      res.status(404).json({ success: false, message: 'Sale item not found' });
      return;
    }

    const prevReturnedQty = sale.returns
      .filter(r => r.saleItemId === saleItemId)
      .reduce((sum, r) => sum + r.quantity, 0);

    const maxReturnable = saleItem.quantity - prevReturnedQty;
    if (qty > maxReturnable) {
      res.status(400).json({
        success: false,
        message: `Cannot return ${qty} units. Maximum returnable quantity is ${maxReturnable}.`
      });
      return;
    }

    const refund = refundAmount !== undefined
      ? parseFloat(refundAmount)
      : (Number(saleItem.unitPrice) * qty);

    const returnNumber = await getNextReturnNumber();

    const [storeReturn] = await prisma.$transaction([
      prisma.storeReturn.create({
        data: {
          saleId: id,
          returnNumber,
          saleItemId,
          quantity: qty,
          refundAmount: refund,
          reason: reason.trim(),
          returnedById: req.user?.id,
          returnedByName: req.user?.fullName
        }
      }),
      prisma.storeItem.update({
        where: { id: saleItem.itemId },
        data: { currentStock: { increment: qty } }
      }),
      prisma.storeSaleItem.update({
        where: { id: saleItemId },
        data: { returnedQuantity: { increment: qty } }
      })
    ]);

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'STORE_SALE_RETURN',
      module: 'STORE',
      recordId: storeReturn.id,
      newData: { saleId: id, saleItemId, quantity: qty, refundAmount: refund, reason },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      data: storeReturn,
      message: `Return processed successfully with #${returnNumber}`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Cancel Sale
// =============================================================
export const cancelSale = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({ success: false, message: 'Cancellation reason is required' });
      return;
    }

    const sale = await prisma.storeSale.findUnique({
      where: { id },
      include: { items: true, returns: true }
    });

    if (!sale) {
      res.status(404).json({ success: false, message: 'Sale not found' });
      return;
    }

    if (sale.isCancelled) {
      res.status(400).json({ success: false, message: 'Sale is already cancelled' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      for (const item of sale.items) {
        const returnedQty = sale.returns
          .filter(r => r.saleItemId === item.id)
          .reduce((sum, r) => sum + r.quantity, 0);

        const qtyToRevert = item.quantity - returnedQty;
        if (qtyToRevert > 0) {
          await tx.storeItem.update({
            where: { id: item.itemId },
            data: { currentStock: { increment: qtyToRevert } }
          });
        }
      }

      await tx.storeSale.update({
        where: { id },
        data: {
          isCancelled: true,
          cancelledAt: new Date(),
          cancellationReason: reason.trim(),
          cancelledById: req.user?.id
        }
      });
    });

    await logAudit({
      userId: req.user?.id,
      userName: req.user?.fullName,
      action: 'CANCEL_STORE_SALE',
      module: 'STORE',
      recordId: id,
      newData: { reason },
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Sale cancelled and stock reversed successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =============================================================
// Store Reports (Sales & Stock)
// =============================================================
export const getStockReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryId, lowStockOnly } = req.query;

    const where: any = { isActive: true };
    if (categoryId) where.categoryId = categoryId;

    const items = await prisma.storeItem.findMany({
      where,
      include: { category: true },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }]
    });

    const filtered = lowStockOnly === 'true'
      ? items.filter(it => it.currentStock <= it.lowStockAlert)
      : items;

    res.json({ success: true, data: filtered });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
