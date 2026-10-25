import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { config } from '../config/index.js';
import { RoleType, UserPayload } from '../types/index.js';

const prisma = new PrismaClient();

export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

export const authenticateJwt = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Authentication required. No token provided.',
      errorCode: 'UNAUTHENTICATED'
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as UserPayload;
    
    let permissions = decoded.permissions || (decoded.role === 'SUPER_ADMIN' ? ['*'] : []);
    try {
      // Dynamically fetch current role permissions from database for real-time enforcement
      const rolePerms = await prisma.rolePermission.findMany({
        where: { role: decoded.role as any },
        select: { permissionCode: true }
      });
      permissions = decoded.role === 'SUPER_ADMIN' ? ['*'] : rolePerms.map(rp => rp.permissionCode);
    } catch (dbErr) {
      // If database is offline, preserve permissions from token or fallback defaults
      if (decoded.role === 'SUPER_ADMIN') {
        permissions = ['*'];
      }
    }

    req.user = {
      ...decoded,
      permissions
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
      errorCode: 'INVALID_TOKEN'
    });
  }
};

export const requireRoles = (allowedRoles: RoleType[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
        errorCode: 'UNAUTHENTICATED'
      });
      return;
    }

    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Forbidden. Role '${req.user.role}' is not authorized for this resource.`,
        errorCode: 'FORBIDDEN'
      });
      return;
    }

    next();
  };
};

export const requirePermission = (permissionCode: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
        errorCode: 'UNAUTHENTICATED'
      });
      return;
    }

    // Director (SUPER_ADMIN) has unconditional full access
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    // Dynamic database permissions check
    const perms = req.user.permissions || [];
    if (perms.includes('*') || perms.includes(permissionCode)) {
      return next();
    }

    res.status(403).json({
      success: false,
      message: `Access denied. Role '${req.user.role}' lacks permission: '${permissionCode}'.`,
      errorCode: 'FORBIDDEN',
      requiredPermission: permissionCode
    });
  };
};
