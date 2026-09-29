import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function logAudit(params: {
  userId?: string | null;
  userName?: string | null;
  action: string;
  module: string;
  recordId?: string | null;
  oldData?: any;
  newData?: any;
  ipAddress?: string | null;
}) {
  const sanitizedUserId = typeof params.userId === 'string' && params.userId.trim() ? params.userId.trim() : null;
  const userName = (params.userName && typeof params.userName === 'string' && params.userName.trim()) || 'System / Staff';

  let oldDataStr: string | null = null;
  if (params.oldData !== undefined && params.oldData !== null) {
    try {
      oldDataStr = typeof params.oldData === 'string' ? params.oldData : JSON.stringify(params.oldData);
    } catch {
      oldDataStr = String(params.oldData);
    }
  }

  let newDataStr: string | null = null;
  if (params.newData !== undefined && params.newData !== null) {
    try {
      newDataStr = typeof params.newData === 'string' ? params.newData : JSON.stringify(params.newData);
    } catch {
      newDataStr = String(params.newData);
    }
  }

  const safeAction = params.action ? String(params.action).substring(0, 100) : 'UNKNOWN_ACTION';
  const safeModule = params.module ? String(params.module).substring(0, 100) : 'SYSTEM';
  const safeRecordId = params.recordId ? String(params.recordId).substring(0, 100) : null;
  const safeIp = params.ipAddress ? String(params.ipAddress).substring(0, 100) : '127.0.0.1';

  try {
    await prisma.auditLog.create({
      data: {
        userId: sanitizedUserId,
        userName,
        action: safeAction,
        module: safeModule,
        recordId: safeRecordId,
        oldData: oldDataStr,
        newData: newDataStr,
        ipAddress: safeIp,
      },
    });
  } catch (err: any) {
    // If it failed because of a foreign key on userId (code P2003) or legacy constraint:
    if (sanitizedUserId && (err.code === 'P2003' || String(err.message).includes('Foreign key'))) {
      try {
        await prisma.auditLog.create({
          data: {
            userId: null,
            userName: `${userName} (${sanitizedUserId})`,
            action: safeAction,
            module: safeModule,
            recordId: safeRecordId,
            oldData: oldDataStr,
            newData: newDataStr,
            ipAddress: safeIp,
          },
        });
        return;
      } catch (retryErr) {
        console.warn('Audit log fallback retry also failed:', retryErr);
      }
    }
    console.error('Audit log failed to record:', err.message || err);
  }
}

