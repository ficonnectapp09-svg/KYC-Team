import { Request, Response, NextFunction } from 'express';
import { Role, Department } from '../config/constants';

export const requireRoles = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): any => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    // Overall Team Lead always has supervisory override across all departments
    if (req.user.role === Role.OVERALL_LEAD) {
      return next();
    }

    if (allowedRoles.includes(req.user.role as Role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access Denied: You do not possess the required role permissions for this operation.'
    });
  };
};

export const requireDepartment = (allowedDepartments: Department[]) => {
  return (req: Request, res: Response, next: NextFunction): any => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }

    if (req.user.role === Role.OVERALL_LEAD || req.user.department === Department.OVERALL) {
      return next();
    }

    if (allowedDepartments.includes(req.user.department as Department)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: 'Access Denied: Cross-department access restricted.'
    });
  };
};

export const requireOverallLead = (req: Request, res: Response, next: NextFunction): any => {
  if (!req.user || req.user.role !== Role.OVERALL_LEAD) {
    return res.status(403).json({
      success: false,
      message: 'Strict Security Gate: Only the Overall Team Lead is authorized for this operation.'
    });
  }
  next();
};

