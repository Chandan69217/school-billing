import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function logAudit(params: {
  userId?: string;
  userName?: string;
  action: string;
  module: string;
  recordId?: string;
  oldData?: any;
  newData?: any;
  ipAddress?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        userName: params.userName || 'System / Staff',
        action: params.action,
        module: params.module,
        recordId: params.recordId,
        oldData: params.oldData ? JSON.stringify(params.oldData) : null,
        newData: params.newData ? JSON.stringify(params.newData) : null,
        ipAddress: params.ipAddress || '127.0.0.1',
      },
    });
  } catch (err) {
    console.error('Audit log failed to record:', err);
  }
}
