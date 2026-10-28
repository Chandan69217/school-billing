import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateNotificationParams {
  userId?: string | null;
  title: string;
  message: string;
  type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT';
  linkUrl?: string | null;
}

export async function createNotification(params: CreateNotificationParams) {
  try {
    const sanitizedUserId = typeof params.userId === 'string' && params.userId.trim() ? params.userId.trim() : null;

    let validUserId: string | null = null;
    if (sanitizedUserId) {
      try {
        const userExists = await prisma.user.findUnique({
          where: { id: sanitizedUserId },
          select: { id: true }
        });
        if (userExists) {
          validUserId = sanitizedUserId;
        }
      } catch {
        validUserId = null;
      }
    }

    const notif = await prisma.notification.create({
      data: {
        userId: validUserId,
        title: (params.title || 'System Notification').trim().substring(0, 191),
        message: (params.message || '').trim(),
        type: params.type || 'INFO',
        linkUrl: params.linkUrl?.trim() || null,
        isRead: false
      }
    });

    return notif;
  } catch (err: any) {
    console.error('Failed to create notification:', err.message);
    return null;
  }
}

export async function broadcastNotification(params: Omit<CreateNotificationParams, 'userId'>) {
  return createNotification({ ...params, userId: null });
}

export async function seedInitialNotificationsIfEmpty() {
  try {
    const count = await prisma.notification.count();
    if (count === 0) {
      const now = Date.now();
      await prisma.notification.createMany({
        data: [
          {
            title: 'Welcome to PBPS Finance & Academic Portal',
            message: 'All core modules (Fee Management, Admissions, Dues Realization, and Transport) are running smoothly.',
            type: 'SUCCESS',
            linkUrl: '/',
            isRead: false,
            createdAt: new Date(now - 1000 * 60 * 15) // 15 mins ago
          },
          {
            title: 'Academic Session 2026-27 Active',
            message: 'Admission registrations and class tariffs for Session 2026-27 are active and synchronized.',
            type: 'INFO',
            linkUrl: '/admissions',
            isRead: false,
            createdAt: new Date(now - 1000 * 60 * 60 * 2) // 2 hours ago
          },
          {
            title: 'Automated Fee Generation Ready',
            message: 'Class fee structures and term fee configurations have been verified for automated billing.',
            type: 'INFO',
            linkUrl: '/fees',
            isRead: false,
            createdAt: new Date(now - 1000 * 60 * 60 * 5) // 5 hours ago
          }
        ]
      });
    }
  } catch (err: any) {
    console.warn('Initial notifications seeding notice:', err.message);
  }
}
