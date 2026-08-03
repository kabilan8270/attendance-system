import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/token.service';
import { AdminRole, AuthenticatedRequestUser, UserType } from '../utils/types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedRequestUser;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No access token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      userType: payload.userType,
      role: payload.role,
      employeeId: payload.employeeId,
    };
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired access token' });
  }
};

/** Restrict a route to a given user type: 'admin' or 'employee' */
export const requireUserType = (...types: UserType[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !types.includes(req.user.userType)) {
      return res.status(403).json({ success: false, message: 'Access denied for this user type' });
    }
    next();
  };
};

/** Restrict a route to specific admin roles (RBAC) */
export const requireRole = (...roles: AdminRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || req.user.userType !== 'admin' || !req.user.role || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
  };
};
