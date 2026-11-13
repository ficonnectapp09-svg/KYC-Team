import { Request, Response } from 'express';
import { Employee } from '../models/Employee';
import { comparePassword, generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/security';
import { logAudit } from '../middleware/auditLogger';

export class AuthController {
  static async login(req: Request, res: Response): Promise<any> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required.'
        });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const aliasVariant = normalizedEmail
        .replace(/^kyclead@/, 'kyc.lead@')
        .replace(/^kycstaff@/, 'kyc.staff@')
        .replace(/^paymentlead@/, 'payment.lead@')
        .replace(/^paymentstaff@/, 'payment.staff@')
        .replace(/^querieslead@/, 'queries.lead@')
        .replace(/^queriesstaff@/, 'queries.staff@')
        .replace(/^overalllead@/, 'lead@');

      const employee = await Employee.findOne({
        email: { $in: [normalizedEmail, aliasVariant] }
      });
      if (!employee) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials. Staff account not found.'
        });
      }

      if (employee.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: `Your account status is ${employee.status}. Contact the Overall Team Lead.`
        });
      }

      const isMatch = await comparePassword(password, employee.password || '');
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials. Password incorrect.'
        });
      }

      // Update last login
      employee.lastLogin = new Date();
      await employee.save();

      const tokenPayload = {
        id: employee._id.toString(),
        employeeId: employee.employeeId,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        department: employee.department,
        permissions: employee.permissions || []
      };

      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      req.user = tokenPayload;
      await logAudit(
        req,
        'LOGIN_SUCCESS',
        'AUTH',
        employee.employeeId,
        `Staff member ${employee.name} (${employee.role}) logged in successfully.`
      );

      return res.json({
        success: true,
        message: 'Login successful.',
        data: {
          accessToken,
          refreshToken,
          user: {
            id: employee._id,
            employeeId: employee.employeeId,
            name: employee.name,
            email: employee.email,
            phone: employee.phone,
            department: employee.department,
            designation: employee.designation,
            role: employee.role,
            photo: employee.photo,
            permissions: employee.permissions
          }
        }
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Login error: ' + error.message
      });
    }
  }

  static async getMe(req: Request, res: Response): Promise<any> {
    try {
      const employee = await Employee.findById(req.user?.id).select('-password');
      if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
      }

      return res.json({
        success: true,
        data: employee
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async refreshToken(req: Request, res: Response): Promise<any> {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ success: false, message: 'Refresh token is required.' });
      }

      const decoded = verifyRefreshToken(refreshToken);
      if (!decoded || !decoded.id) {
        return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
      }

      const employee = await Employee.findById(decoded.id);
      if (!employee || employee.status !== 'active') {
        return res.status(401).json({ success: false, message: 'Account invalid or inactive.' });
      }

      const tokenPayload = {
        id: employee._id.toString(),
        employeeId: employee.employeeId,
        email: employee.email,
        role: employee.role,
        department: employee.department
      };

      const newAccessToken = generateAccessToken(tokenPayload);

      return res.json({
        success: true,
        data: { accessToken: newAccessToken }
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

