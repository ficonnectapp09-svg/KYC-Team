import { Request, Response } from 'express';
import { Employee } from '../models/Employee';
import { AttendanceRecord } from '../models/AttendanceRecord';
import { TaskItem } from '../models/TaskItem';
import { SalaryRecord } from '../models/SalaryRecord';
import { SalaryStructure } from '../models/SalaryStructure';
import { AuditTrail } from '../models/AuditTrail';
import { KycRequest } from '../models/KycRequest';
import { QueryTicket } from '../models/QueryTicket';
import { Role, Department, SalaryCycle } from '../config/constants';
import { STAFF_CATEGORIES, resolveStaffCategory } from '../config/categoryCatalog';
import { hashPassword, generateId, buildIdFilter } from '../utils/security';
import { logAudit } from '../middleware/auditLogger';

export class StaffController {
  /**
   * Onboard an employee following the strict 2-step hierarchy:
   * Step 1: Overall Team Lead onboards Department Team Leads.
   * Step 2: Department Team Leads onboard employees under their department.
   */
  static async onboardEmployee(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const {
        name,
        email,
        phone,
        password,
        department,
        designation,
        role,
        employmentType,
        workLocation,
        salaryCycle,
        bankDetails,
        address,
        emergencyContact
      } = req.body;

      // Validation of Hierarchical Onboarding Permissions
      const isOverallLead = currentUser.role === Role.OVERALL_LEAD;
      const isDeptLead = [Role.KYC_LEAD, Role.PAYMENT_LEAD, Role.QUERIES_LEAD].includes(currentUser.role as Role);

      // Rule 1: Only Overall Lead can onboard Department Team Leads
      if ([Role.KYC_LEAD, Role.PAYMENT_LEAD, Role.QUERIES_LEAD].includes(role)) {
        if (!isOverallLead) {
          return res.status(403).json({
            success: false,
            message: 'Hierarchy Rule Violation: Only the Overall Team Lead is authorized to onboard Department Team Leads.'
          });
        }
      }

      // Rule 2: Department Leads can ONLY onboard employees within their own department
      if (isDeptLead && !isOverallLead) {
        if (department !== currentUser.department) {
          return res.status(403).json({
            success: false,
            message: `Hierarchy Rule Violation: As ${currentUser.role}, you can only onboard employees within ${currentUser.department}.`
          });
        }
        // Cannot onboard another Team Lead or Overall Lead
        if ([Role.OVERALL_LEAD, Role.KYC_LEAD, Role.PAYMENT_LEAD, Role.QUERIES_LEAD].includes(role)) {
          return res.status(403).json({
            success: false,
            message: 'Hierarchy Rule Violation: Department Team Leads cannot onboard other Team Leads.'
          });
        }
      }

      // Check existing email
      const existing = await Employee.findOne({ email: email.toLowerCase().trim() });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'An employee with this email address already exists.'
        });
      }

      if (!password || String(password).trim().length < 6) {
        return res.status(400).json({
          success: false,
          message: 'An initial password of at least 6 characters is required to onboard staff.'
        });
      }

      const hashedPassword = await hashPassword(String(password));
      const employeeId = generateId('EMP');

      const newEmployee = new Employee({
        employeeId,
        name,
        email: email.toLowerCase().trim(),
        phone,
        password: hashedPassword,
        department,
        designation,
        role,
        reportingLead: isDeptLead ? currentUser.id : null,
        employmentType: employmentType || 'Full-time',
        workLocation: workLocation || 'Main Operations Center',
        salaryCycle: salaryCycle || SalaryCycle.MONTHLY,
        bankDetails: bankDetails || {},
        address: address || '',
        emergencyContact: emergencyContact || {},
        status: 'active',
        permissions: ['read', 'write', `dept:${department.toLowerCase()}`]
      });

      await newEmployee.save();

      // Auto-provision initial SalaryStructure when compensation fields are passed during onboarding
      if (req.body.baseSalary !== undefined || req.body.salaryCycle) {
        const basicSalary = Number(req.body.baseSalary ?? 35000);
        const hra = Number(req.body.hraAllowance ?? Math.round(basicSalary * 0.25));
        const otherAllowances = Number(req.body.specialAllowance ?? 3000);
        const pfDeduction = Number(req.body.pfDeduction ?? 1800);
        const taxDeduction = Number(req.body.taxDeduction ?? 0);
        const grossSalary = basicSalary + hra + otherAllowances;
        const totalDeductions = pfDeduction + taxDeduction;
        await SalaryStructure.create({
          employeeId,
          employeeName: newEmployee.name,
          department: newEmployee.department,
          designation: newEmployee.designation,
          salaryCycle: newEmployee.salaryCycle,
          basicSalary,
          hra,
          otherAllowances,
          pfDeduction,
          taxDeduction,
          grossSalary,
          totalDeductions,
          netPayable: Math.max(0, grossSalary - totalDeductions),
          isActive: true
        });
      }

      await logAudit(
        req,
        'EMPLOYEE_ONBOARDED',
        'STAFF',
        employeeId,
        `${currentUser.name} onboarded ${newEmployee.name} (${newEmployee.designation}) to ${department}.`
      );

      return res.status(201).json({
        success: true,
        message: 'Employee onboarded successfully.',
        data: newEmployee
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  private static buildCategoryFilter(catKey: string) {
    const standardRoles = [
      Role.OVERALL_LEAD,
      Role.KYC_LEAD,
      Role.KYC_EMPLOYEE,
      Role.PAYMENT_LEAD,
      Role.PAYMENT_EMPLOYEE,
      Role.QUERIES_LEAD,
      Role.QUERIES_EMPLOYEE
    ];
    const cat = resolveStaffCategory(catKey);
    if (!cat) return null;
    if (cat.key === 'ALL') return {};
    if (cat.roleFilter === 'OTHER') {
      return { role: { $nin: standardRoles } };
    }
    return { role: cat.roleFilter };
  }

  static async getCategoryCounts(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const scope: any = {};
      if (currentUser.role !== Role.OVERALL_LEAD) {
        scope.department = currentUser.department;
      }

      const employees = await Employee.find(scope).select('role').lean();
      const byRole = new Map<string, number>();
      let allTotal = 0;
      let otherCount = 0;
      const standardRoles = new Set<string>([
        Role.OVERALL_LEAD,
        Role.KYC_LEAD,
        Role.KYC_EMPLOYEE,
        Role.PAYMENT_LEAD,
        Role.PAYMENT_EMPLOYEE,
        Role.QUERIES_LEAD,
        Role.QUERIES_EMPLOYEE
      ]);

      for (const emp of employees) {
        allTotal += 1;
        byRole.set(emp.role, (byRole.get(emp.role) || 0) + 1);
        if (!standardRoles.has(emp.role)) otherCount += 1;
      }

      const counts: Record<string, number> = { ALL: allTotal };
      for (const cat of STAFF_CATEGORIES) {
        if (cat.key === 'ALL') continue;
        if (cat.roleFilter === 'OTHER') counts[cat.key] = otherCount;
        else if (cat.roleFilter) counts[cat.key] = byRole.get(cat.roleFilter) || 0;
      }

      return res.json({ success: true, data: counts });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async listEmployees(req: Request, res: Response): Promise<any> {
    try {
      const { category, staffCategory, department, role, status, search, startDate, endDate, page = '1', limit = '50' } = req.query;
      const currentUser = req.user!;

      const rawCategory = (staffCategory as string) || (category as string) || 'ALL';
      const resolvedCategory = resolveStaffCategory(rawCategory);
      if (!resolvedCategory) {
        return res.status(400).json({
          success: false,
          message: `Unsupported Staff category filter: "${rawCategory}".`
        });
      }

      // Enforce category-level RBAC isolation for cross-department direct calls
      if (
        currentUser.role !== Role.OVERALL_LEAD &&
        resolvedCategory.expectedDepartment &&
        resolvedCategory.expectedDepartment !== currentUser.department
      ) {
        return res.status(403).json({
          success: false,
          message: `Access denied: You cannot access "${resolvedCategory.label}" outside your department.`
        });
      }

      const filter: any = {};
      const scopeFilter: any = {};

      if (currentUser.role !== Role.OVERALL_LEAD) {
        filter.department = currentUser.department;
        scopeFilter.department = currentUser.department;
      } else if (department && department !== 'All') {
        filter.department = department;
      }

      const catFilter = StaffController.buildCategoryFilter(resolvedCategory.key);
      if (catFilter && Object.keys(catFilter).length > 0) {
        Object.assign(filter, catFilter);
      }

      if (role && role !== 'All') filter.role = role;
      if (status && status !== 'All') filter.status = status;
      if (startDate || endDate) {
        filter.joiningDate = {};
        if (startDate) filter.joiningDate.$gte = new Date(startDate as string);
        if (endDate) {
          const endDt = new Date(endDate as string);
          endDt.setHours(23, 59, 59, 999);
          filter.joiningDate.$lte = endDt;
        }
      }
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { employeeId: { $regex: search, $options: 'i' } },
          { designation: { $regex: search, $options: 'i' } }
        ];
      }

      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
      const skip = (pageNum - 1) * limitNum;

      const categoryBaseFilter: any = { ...scopeFilter, ...(catFilter || {}) };
      const [employees, total, catItems, allScopedStaff] = await Promise.all([
        Employee.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limitNum),
        Employee.countDocuments(filter),
        Employee.find(categoryBaseFilter).select('status').lean(),
        Employee.find(scopeFilter).select('role').lean()
      ]);

      const standardRoles = new Set<string>([
        Role.OVERALL_LEAD,
        Role.KYC_LEAD,
        Role.KYC_EMPLOYEE,
        Role.PAYMENT_LEAD,
        Role.PAYMENT_EMPLOYEE,
        Role.QUERIES_LEAD,
        Role.QUERIES_EMPLOYEE
      ]);
      const byRole = new Map<string, number>();
      let otherCount = 0;
      for (const s of allScopedStaff) {
        byRole.set(s.role, (byRole.get(s.role) || 0) + 1);
        if (!standardRoles.has(s.role)) otherCount += 1;
      }
      const categoryCounts: Record<string, number> = { ALL: allScopedStaff.length };
      for (const cat of STAFF_CATEGORIES) {
        if (cat.key === 'ALL') continue;
        if (cat.roleFilter === 'OTHER') categoryCounts[cat.key] = otherCount;
        else if (cat.roleFilter) categoryCounts[cat.key] = byRole.get(cat.roleFilter) || 0;
      }

      const summary = {
        totalCount: catItems.length,
        pendingCount: catItems.filter((e) => e.status === 'inactive').length,
        inProgressCount: catItems.filter((e) => e.status === 'suspended').length,
        completedCount: catItems.filter((e) => e.status === 'active').length
      };

      return res.json({
        success: true,
        category: resolvedCategory,
        count: employees.length,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
        summary,
        categoryCounts,
        data: employees
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getEmployeeById(req: Request, res: Response): Promise<any> {
    try {
      const { id } = req.params;
      const currentUser = req.user!;
      const employee = await Employee.findOne(buildIdFilter('employeeId', id)).select('-password');

      if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
      }

      if (currentUser.role !== Role.OVERALL_LEAD && employee.department !== currentUser.department) {
        return res.status(403).json({ success: false, message: 'Access denied: Cross-department staff record is restricted.' });
      }

      return res.json({
        success: true,
        data: employee
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateEmployeeStatus(req: Request, res: Response): Promise<any> {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;

      if (!['active', 'inactive', 'suspended'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status value.' });
      }

      const currentUser = req.user!;
      const employee = await Employee.findOne(buildIdFilter('employeeId', id));

      if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
      }

      // Prevent self-modification of account status / suspension
      const isSelf = currentUser.employeeId === employee.employeeId || currentUser.id === employee._id.toString();
      if (isSelf) {
        return res.status(403).json({
          success: false,
          message: 'Self-modification of account status or account suspension is not permitted.'
        });
      }

      const oldStatus = employee.status;
      employee.status = status;
      await employee.save();

      await logAudit(
        req,
        'EMPLOYEE_STATUS_CHANGED',
        'STAFF',
        employee.employeeId,
        `Status changed from ${oldStatus} to ${status}. Reason: ${reason || 'N/A'}`
      );

      return res.json({
        success: true,
        message: `Employee status successfully updated to ${status}.`,
        data: employee
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateEmployee(req: Request, res: Response): Promise<any> {
    try {
      const { id } = req.params;
      const currentUser = req.user!;
      const updates = req.body;

      // Do not allow direct password or employeeId changes via this endpoint
      delete updates.password;
      delete updates.employeeId;

      const targetEmp = await Employee.findOne(buildIdFilter('employeeId', id));
      if (!targetEmp) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
      }

      // Prevent self-modification of status, role or department
      const isSelf = currentUser.employeeId === targetEmp.employeeId || currentUser.id === targetEmp._id.toString();
      if (isSelf && (updates.status || updates.role || updates.department)) {
        return res.status(403).json({
          success: false,
          message: 'Self-modification of status, role, or department is not permitted.'
        });
      }

      const employee = await Employee.findOneAndUpdate(
        buildIdFilter('employeeId', id),
        { $set: updates },
        { new: true }
      ).select('-password');

      if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
      }

      await logAudit(
        req,
        'EMPLOYEE_UPDATED',
        'STAFF',
        employee.employeeId,
        `Employee ${employee.name} details updated.`
      );

      return res.json({
        success: true,
        message: 'Employee updated successfully.',
        data: employee
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Consolidated Profile Overview: Attendance, Performance, Salary History & Activity Trail
   */
  static async getEmployeeOverview(req: Request, res: Response): Promise<any> {
    try {
      const { id } = req.params;
      const currentUser = req.user!;
      const employee = await Employee.findOne(buildIdFilter('employeeId', id)).select('-password');

      if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
      }

      if (
        currentUser.role !== Role.OVERALL_LEAD &&
        employee.department !== currentUser.department &&
        employee.employeeId !== currentUser.employeeId
      ) {
        return res.status(403).json({
          success: false,
          message: 'Department isolation policy denies access to another department employee overview.'
        });
      }

      const [attendance, tasks, salaryRecords, salaryStructure, recentActivity, kycHandled, queriesHandled] =
        await Promise.all([
          AttendanceRecord.find({ employeeId: employee.employeeId }).sort({ dateKey: -1 }).limit(15).lean(),
          TaskItem.find({ 'assignedTo.employeeId': employee.employeeId }).sort({ updatedAt: -1 }).limit(20).lean(),
          SalaryRecord.find({ employeeId: employee.employeeId }).sort({ createdAt: -1 }).limit(12).lean(),
          SalaryStructure.findOne({ employeeId: employee.employeeId }).lean(),
          AuditTrail.find({
            $or: [{ actorId: employee.employeeId }, { targetId: employee.employeeId }]
          })
            .sort({ timestamp: -1 })
            .limit(20)
            .lean(),
          KycRequest.countDocuments({ assignedEmployeeId: employee.employeeId }),
          QueryTicket.countDocuments({ assignedEmployeeId: employee.employeeId })
        ]);

      const completedTasks = tasks.filter((t) => t.status === 'Completed').length;

      return res.json({
        success: true,
        data: {
          employee,
          attendance,
          salaryStructure,
          salaryHistory: salaryRecords,
          tasks,
          performance: {
            totalTasks: tasks.length,
            completedTasks,
            completionRate: tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0,
            kycAssignedCount: kycHandled,
            queriesAssignedCount: queriesHandled
          },
          recentActivity
        }
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Self-service Profile Update (Phone, Address, Work Location)
   */
  static async updateSelfProfile(req: Request, res: Response): Promise<any> {
    try {
      const { id } = req.params;
      const { phone, address, workLocation } = req.body;
      const currentUser = req.user!;

      const employee = await Employee.findOne(buildIdFilter('employeeId', id));
      if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
      }

      if (
        currentUser.role !== Role.OVERALL_LEAD &&
        employee.employeeId !== currentUser.employeeId &&
        employee._id.toString() !== currentUser.id
      ) {
        return res.status(403).json({
          success: false,
          message: 'You can only update your own employee contact profile.'
        });
      }

      if (phone) employee.phone = phone.trim();
      if (address !== undefined) employee.address = address.trim();
      if (workLocation) employee.workLocation = workLocation.trim();
      employee.updatedAt = new Date();
      await employee.save();

      await logAudit(
        req,
        'STAFF_SELF_PROFILE_UPDATED',
        'STAFF',
        employee.employeeId,
        `Contact details updated by ${currentUser.name} for ${employee.name}.`
      );

      return res.json({
        success: true,
        message: 'Profile details updated successfully.',
        data: employee
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Self-service Bank Details Update
   */
  static async updateSelfBankDetails(req: Request, res: Response): Promise<any> {
    try {
      const { id } = req.params;
      const { bankName, accountHolder, accountNumber, ifscCode } = req.body;
      const currentUser = req.user!;

      const employee = await Employee.findOne(buildIdFilter('employeeId', id));
      if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
      }

      if (
        currentUser.role !== Role.OVERALL_LEAD &&
        employee.employeeId !== currentUser.employeeId &&
        employee._id.toString() !== currentUser.id
      ) {
        return res.status(403).json({
          success: false,
          message: 'You can only update your own bank disbursement details.'
        });
      }

      if (!accountNumber || !ifscCode) {
        return res.status(400).json({
          success: false,
          message: 'Account number and IFSC code are mandatory.'
        });
      }

      employee.bankDetails = {
        bankName: bankName?.trim() || employee.bankDetails?.bankName || 'Connect Partner Bank',
        accountHolder: accountHolder?.trim() || employee.name,
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase()
      };
      employee.updatedAt = new Date();
      await employee.save();

      await logAudit(
        req,
        'STAFF_BANK_DETAILS_UPDATED',
        'STAFF',
        employee.employeeId,
        `Bank account details updated by ${currentUser.name} for ${employee.name}.`
      );

      return res.json({
        success: true,
        message: 'Bank details updated successfully.',
        data: employee
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

