import { Request, Response } from 'express';
import { AttendanceRecord } from '../models/AttendanceRecord';
import { Employee } from '../models/Employee';
import { Department, Role } from '../config/constants';
import { buildIdFilter, generateId } from '../utils/security';
import { logAudit } from '../middleware/auditLogger';

function getTodayDateKey(inputDate?: string): string {
  const d = inputDate ? new Date(inputDate) : new Date();
  return d.toISOString().slice(0, 10);
}

export class AttendanceController {
  static async listAttendance(req: Request, res: Response): Promise<any> {
    try {
      const { employeeId, department, dateKey, status } = req.query;
      const currentUser = req.user!;

      const filter: any = {};

      if (
        [Role.KYC_EMPLOYEE, Role.PAYMENT_EMPLOYEE, Role.QUERIES_EMPLOYEE].includes(currentUser.role as Role)
      ) {
        filter.employeeId = currentUser.employeeId;
      } else if (currentUser.role !== Role.OVERALL_LEAD) {
        filter.department = currentUser.department;
      } else if (department && department !== 'All') {
        filter.department = department;
      }

      if (employeeId && employeeId !== 'All' && currentUser.role !== Role.KYC_EMPLOYEE && currentUser.role !== Role.PAYMENT_EMPLOYEE && currentUser.role !== Role.QUERIES_EMPLOYEE) {
        filter.employeeId = employeeId;
      }
      if (dateKey) filter.dateKey = dateKey;
      if (status && status !== 'All') filter.status = status;

      const records = await AttendanceRecord.find(filter).sort({ dateKey: -1, createdAt: -1 }).limit(150);

      return res.json({
        success: true,
        count: records.length,
        data: records
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async markAttendance(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const { employeeId, dateKey, status, workHours, leaveType, leaveReason, remarks } = req.body;

      const targetEmpId =
        currentUser.role === Role.OVERALL_LEAD || currentUser.role.endsWith('_lead')
          ? employeeId || currentUser.employeeId
          : currentUser.employeeId;

      const employee = await Employee.findOne({ employeeId: targetEmpId }).select('-password');
      if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
      }

      if (
        currentUser.role !== Role.OVERALL_LEAD &&
        currentUser.role.endsWith('_lead') &&
        employee.department !== currentUser.department
      ) {
        return res.status(403).json({
          success: false,
          message: 'Department Leads can only manage attendance within their own department.'
        });
      }

      const dayKey = getTodayDateKey(dateKey);
      const validStatus = status || 'Present';
      const isLeave = validStatus === 'On Leave';

      const existing = await AttendanceRecord.findOne({ employeeId: targetEmpId, dateKey: dayKey });
      if (existing) {
        existing.status = validStatus;
        existing.workHours = workHours !== undefined ? Number(workHours) : existing.workHours;
        if (validStatus === 'Present' || validStatus === 'Remote' || validStatus === 'Late') {
          existing.checkInTime = existing.checkInTime || new Date();
          if (Number(workHours || 0) >= 8) {
            existing.checkOutTime = new Date();
          }
        }
        if (isLeave) {
          existing.leaveType = leaveType || 'Casual';
          existing.leaveReason = leaveReason || remarks || '';
          existing.leaveApprovalStatus = 'Pending';
        }
        existing.remarks = remarks || existing.remarks;
        await existing.save();

        await logAudit(
          req,
          'ATTENDANCE_UPDATED',
          'STAFF',
          existing.attendanceId,
          `Attendance updated to ${validStatus} for ${employee.name} (${dayKey}).`
        );

        return res.json({ success: true, message: 'Attendance updated successfully.', data: existing });
      }

      const record = await AttendanceRecord.create({
        attendanceId: generateId('ATT'),
        employeeId: employee.employeeId,
        employeeName: employee.name,
        department: employee.department,
        dateKey: dayKey,
        date: new Date(`${dayKey}T09:00:00.000Z`),
        status: validStatus,
        checkInTime: ['Present', 'Remote', 'Late', 'Half Day'].includes(validStatus) ? new Date() : null,
        workHours: workHours !== undefined ? Number(workHours) : validStatus === 'Present' ? 8 : 0,
        leaveType: isLeave ? (leaveType || 'Casual') : null,
        leaveReason: isLeave ? (leaveReason || remarks || '') : '',
        leaveApprovalStatus: isLeave ? 'Pending' : 'N/A',
        remarks: remarks || ''
      });

      await logAudit(
        req,
        'ATTENDANCE_MARKED',
        'STAFF',
        record.attendanceId,
        `Attendance marked as ${validStatus} for ${employee.name} (${dayKey}).`
      );

      return res.status(201).json({ success: true, message: 'Attendance recorded.', data: record });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async reviewLeave(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const { id } = req.params;
      const { decision, remarks } = req.body;

      if (!['Approved', 'Rejected'].includes(decision)) {
        return res.status(400).json({ success: false, message: 'Decision must be Approved or Rejected.' });
      }

      const record = await AttendanceRecord.findOne(buildIdFilter('attendanceId', id));
      if (!record) {
        return res.status(404).json({ success: false, message: 'Attendance/leave record not found.' });
      }

      if (record.employeeId === currentUser.employeeId) {
        return res.status(403).json({
          success: false,
          message: 'Self-approval of leave is prohibited. Lead leave requests must be approved by the Overall Team Lead.'
        });
      }

      const targetEmp = await Employee.findOne({ employeeId: record.employeeId });
      const isLeadApplicant = targetEmp && (targetEmp.role.endsWith('_lead') || targetEmp.role === Role.OVERALL_LEAD);
      if (isLeadApplicant && currentUser.role !== Role.OVERALL_LEAD) {
        return res.status(403).json({
          success: false,
          message: 'Leave requests submitted by Team Leads must be reviewed and approved by the Overall Team Lead.'
        });
      }

      if (currentUser.role !== Role.OVERALL_LEAD && record.department !== currentUser.department) {
        return res.status(403).json({
          success: false,
          message: 'Cross-department leave review denied.'
        });
      }

      record.leaveApprovalStatus = decision;
      record.reviewedBy = {
        userId: currentUser.employeeId,
        name: currentUser.name,
        role: currentUser.role,
        department: currentUser.department,
        at: new Date()
      };
      if (remarks) record.remarks = remarks;
      if (decision === 'Rejected') {
        record.status = 'Absent';
      }
      await record.save();

      await logAudit(
        req,
        'LEAVE_REVIEWED',
        'STAFF',
        record.attendanceId,
        `${currentUser.name} ${decision.toLowerCase()} leave request for ${record.employeeName} (${record.dateKey}).`
      );

      return res.json({ success: true, message: `Leave request ${decision.toLowerCase()}.`, data: record });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getAttendanceSummary(req: Request, res: Response): Promise<any> {
    try {
      const todayKey = getTodayDateKey();
      const currentUser = req.user!;

      const scopeFilter: any = {};
      if (currentUser.role !== Role.OVERALL_LEAD) {
        scopeFilter.department = currentUser.department;
      }

      const [todayRecords, pendingLeaveApprovals, totalEmployees] = await Promise.all([
        AttendanceRecord.find({ ...scopeFilter, dateKey: todayKey }).lean(),
        AttendanceRecord.countDocuments({ ...scopeFilter, leaveApprovalStatus: 'Pending' }),
        Employee.countDocuments(currentUser.role === Role.OVERALL_LEAD ? {} : { department: currentUser.department })
      ]);

      const presentToday = todayRecords.filter((r) => ['Present', 'Remote'].includes(r.status)).length;
      const lateToday = todayRecords.filter((r) => r.status === 'Late').length;
      const halfDayToday = todayRecords.filter((r) => r.status === 'Half Day').length;
      const onLeaveToday = todayRecords.filter((r) => r.status === 'On Leave').length;
      const absentToday = todayRecords.filter((r) => r.status === 'Absent').length;

      const byDepartment = await AttendanceRecord.aggregate([
        { $match: { dateKey: todayKey } },
        { $group: { _id: { department: '$department', status: '$status' }, count: { $sum: 1 } } }
      ]);

      return res.json({
        success: true,
        data: {
          dateKey: todayKey,
          totalEmployees,
          presentToday,
          lateToday,
          halfDayToday,
          onLeaveToday,
          absentToday,
          pendingLeaveApprovals,
          byDepartment
        }
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async checkIn(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const todayKey = getTodayDateKey();

      const employee = await Employee.findOne({ employeeId: currentUser.employeeId });
      if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
      }

      let record = await AttendanceRecord.findOne({ employeeId: currentUser.employeeId, dateKey: todayKey });
      if (record) {
        if (record.checkInTime) {
          return res.status(400).json({
            success: false,
            message: `Already checked in today at ${new Date(record.checkInTime).toLocaleTimeString()}.`,
            data: record
          });
        }
        record.checkInTime = new Date();
        record.status = 'Present';
        await record.save();
      } else {
        record = await AttendanceRecord.create({
          attendanceId: generateId('ATT'),
          employeeId: employee.employeeId,
          employeeName: employee.name,
          department: employee.department,
          dateKey: todayKey,
          date: new Date(`${todayKey}T09:00:00.000Z`),
          status: 'Present',
          checkInTime: new Date(),
          workHours: 0,
          leaveApprovalStatus: 'N/A',
          remarks: 'Checked in via operational portal'
        });
      }

      await logAudit(
        req,
        'ATTENDANCE_CHECK_IN',
        'STAFF',
        record.attendanceId,
        `${employee.name} checked in at ${new Date().toLocaleTimeString()} (${todayKey}).`
      );

      return res.json({
        success: true,
        message: 'Check-in successful. Your work shift has started.',
        data: record
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async checkOut(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const todayKey = getTodayDateKey();

      const record = await AttendanceRecord.findOne({ employeeId: currentUser.employeeId, dateKey: todayKey });
      if (!record || !record.checkInTime) {
        return res.status(400).json({
          success: false,
          message: 'No active check-in found for today. Please check in first.'
        });
      }

      const now = new Date();
      record.checkOutTime = now;
      const durationHours = (now.getTime() - new Date(record.checkInTime).getTime()) / (1000 * 60 * 60);
      record.workHours = Math.round(durationHours * 10) / 10;
      await record.save();

      await logAudit(
        req,
        'ATTENDANCE_CHECK_OUT',
        'STAFF',
        record.attendanceId,
        `${record.employeeName} checked out at ${now.toLocaleTimeString()} (${record.workHours} hours logged).`
      );

      return res.json({
        success: true,
        message: `Check-out successful. Total logged time: ${record.workHours} hours.`,
        data: record
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getTodayStatus(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const todayKey = getTodayDateKey();

      const record = await AttendanceRecord.findOne({ employeeId: currentUser.employeeId, dateKey: todayKey }).lean();
      return res.json({
        success: true,
        data: record || null
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

