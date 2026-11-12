import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/security';
import { Employee } from '../models/Employee';

export interface AuthenticatedUser {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: string;
  department: string;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authenticateJwt = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token missing or invalid.'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session token.'
      });
    }

    const employee = await Employee.findById(decoded.id).select('-password');
    if (!employee) {
      return res.status(401).json({
        success: false,
        message: 'Employee record not found or account removed.'
      });
    }

    if (employee.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: `Account is ${employee.status}. Access denied.`
      });
    }

    req.user = {
      id: employee._id.toString(),
      employeeId: employee.employeeId,
      name: employee.name,
      email: employee.email,
      role: employee.role,
      department: employee.department,
      permissions: employee.permissions || []
    };

    next();
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Authentication error: ' + error.message
    });
  }
};

