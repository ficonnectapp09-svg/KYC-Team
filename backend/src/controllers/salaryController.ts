import { Request, Response } from 'express';
import { SalaryRecord } from '../models/SalaryRecord';
import { SalaryStructure } from '../models/SalaryStructure';
import { Employee } from '../models/Employee';
import { SalaryStatus, Role, Department, SalaryCycle } from '../config/constants';
import { SALARY_CATEGORIES, resolveSalaryCategory } from '../config/categoryCatalog';
import { PayrollEngineService } from '../services/payrollEngineService';
import { PaymentTransaction } from '../models/PaymentTransaction';
import { FinancialClassification } from '../config/constants';
import { generateId, buildIdFilter } from '../utils/security';
import { logAudit } from '../middleware/auditLogger';

function buildSalaryRoleScope(currentUser: NonNullable<Request['user']>, department?: unknown) {
  const scope: any = {};
  if (
    currentUser.role === Role.KYC_EMPLOYEE ||
    currentUser.role === Role.PAYMENT_EMPLOYEE ||
    currentUser.role === Role.QUERIES_EMPLOYEE
  ) {
    scope.employeeId = currentUser.employeeId;
  } else if (currentUser.role === Role.KYC_LEAD || currentUser.role === Role.QUERIES_LEAD) {
    scope.department = currentUser.department;
  } else if (department && department !== 'All') {
    scope.department = department;
  }
  return scope;
}

export class SalaryController {
  private static async computeCategoryCounts(roleScope: Record<string, any>) {
    const counts: Record<string, number> = {};
    await Promise.all(
      SALARY_CATEGORIES.map(async (cat) => {
        const f: any = { ...roleScope };
        if (cat.cycleFilter) f.salaryCycle = cat.cycleFilter;
        if (cat.statusFilter) f.status = { $in: cat.statusFilter };
        counts[cat.key] = await SalaryRecord.countDocuments(f);
      })
    );
    return counts;
  }

  static async getCategoryCounts(req: Request, res: Response): Promise<any> {
    try {
      const roleScope = buildSalaryRoleScope(req.user!);
      const counts = await SalaryController.computeCategoryCounts(roleScope);
      return res.json({ success: true, data: counts });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async listSalaryRecords(req: Request, res: Response): Promise<any> {
    try {
      const { salaryCategory, salaryCycle, department, status, periodLabel, search, startDate, endDate, page = '1', limit = '50' } = req.query;
      const currentUser = req.user!;

      const filter: any = buildSalaryRoleScope(currentUser, department);

      let resolvedCat = SALARY_CATEGORIES[1]; // RECORDS
      if (salaryCategory && salaryCategory !== 'All') {
        const found = resolveSalaryCategory(String(salaryCategory));
        if (!found) {
          return res.status(400).json({
            success: false,
            message: `Unsupported Salary category filter: "${salaryCategory}".`
          });
        }
        resolvedCat = found;
        if (found.cycleFilter) filter.salaryCycle = found.cycleFilter;
        if (found.statusFilter) filter.status = { $in: found.statusFilter };
      }

      if (salaryCycle && salaryCycle !== 'All') filter.salaryCycle = salaryCycle;
      if (status && status !== 'All') {
        const s = String(status).toLowerCase();
        if (s === 'pending' || s === 'pending approval' || s === 'submitted for overall approval') {
          filter.status = { $in: [SalaryStatus.DRAFT, SalaryStatus.PREPARED, SalaryStatus.SUBMITTED_FOR_OVERALL_APPROVAL] };
        } else if (s === 'approved') {
          filter.status = { $in: [SalaryStatus.APPROVED, SalaryStatus.PROCESSING] };
        } else if (s === 'paid' || s === 'disbursed') {
          filter.status = SalaryStatus.PAID;
        } else {
          filter.status = status;
        }
      }
      if (periodLabel && periodLabel !== 'All') filter.periodLabel = periodLabel;
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate as string);
        if (endDate) {
          const endDt = new Date(endDate as string);
          endDt.setHours(23, 59, 59, 999);
          filter.createdAt.$lte = endDt;
        }
      }
      if (search) {
        filter.$or = [
          { salaryId: { $regex: search, $options: 'i' } },
          { employeeName: { $regex: search, $options: 'i' } },
          { employeeId: { $regex: search, $options: 'i' } },
          { periodLabel: { $regex: search, $options: 'i' } }
        ];
      }

      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
      const skip = (pageNum - 1) * limitNum;

      const roleScope = buildSalaryRoleScope(currentUser, department);

      const [records, total, allItems, categoryCounts] = await Promise.all([
        SalaryRecord.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
        SalaryRecord.countDocuments(filter),
        SalaryRecord.find(roleScope).select('status netSalary salaryCycle').lean(),
        SalaryController.computeCategoryCounts(buildSalaryRoleScope(currentUser))
      ]);

      const summary = {
        totalCount: allItems.length,
        pendingCount: allItems.filter((r) => [SalaryStatus.DRAFT, SalaryStatus.PREPARED, SalaryStatus.SUBMITTED_FOR_OVERALL_APPROVAL].includes(r.status as SalaryStatus)).length,
        inProgressCount: allItems.filter((r) => [SalaryStatus.APPROVED, SalaryStatus.PROCESSING].includes(r.status as SalaryStatus)).length,
        completedCount: allItems.filter((r) => r.status === SalaryStatus.PAID).length,
        totalAmount: allItems.reduce((sum, r) => sum + (r.netSalary || 0), 0)
      };

      return res.json({
        success: true,
        category: resolvedCat,
        count: records.length,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
        summary,
        categoryCounts,
        data: records
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getSalaryRecordById(req: Request, res: Response): Promise<any> {
    try {
      const { id } = req.params;
      const currentUser = req.user!;

      const record = await SalaryRecord.findOne(buildIdFilter('salaryId', id));

      if (!record) {
        return res.status(404).json({ success: false, message: 'Salary record not found.' });
      }

      // Check access permission: Regular employees can only view their own
      if (
        [Role.KYC_EMPLOYEE, Role.PAYMENT_EMPLOYEE, Role.QUERIES_EMPLOYEE].includes(currentUser.role as Role) &&
        record.employeeId !== currentUser.employeeId
      ) {
        return res.status(403).json({ success: false, message: 'Access denied: You cannot view another employee\'s salary record.' });
      }

      return res.json({
        success: true,
        data: record
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Prepare a salary statement (typically initiated by Payment team or HR operator)
   */
  static async prepareSalary(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const {
        employeeId,
        periodStart,
        periodEnd,
        periodLabel,
        incentives,
        bonus,
        overtime,
        advanceRecovery,
        unpaidLeaveDeduction
      } = req.body;

      if (!employeeId || !periodStart || !periodEnd || !periodLabel) {
        return res.status(400).json({
          success: false,
          message: 'employeeId, periodStart, periodEnd, and periodLabel are required.'
        });
      }

      const record = await PayrollEngineService.prepareSalaryRecord({
        employeeId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        periodLabel,
        incentives: Number(incentives || 0),
        bonus: Number(bonus || 0),
        overtime: Number(overtime || 0),
        advanceRecovery: Number(advanceRecovery || 0),
        unpaidLeaveDeduction: Number(unpaidLeaveDeduction || 0),
        preparedByUser: {
          id: currentUser.employeeId,
          name: currentUser.name,
          role: currentUser.role
        }
      });

      await logAudit(
        req,
        'SALARY_PREPARED',
        'SALARY',
        record.salaryId,
        `Prepared salary for ${record.employeeName} (${record.periodLabel}) for ₹${record.netSalary}. Submitted for Overall Lead approval.`
      );

      return res.status(201).json({
        success: true,
        message: 'Salary record generated and submitted to Overall Team Lead for approval.',
        data: record
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * CONFIRMED DECISION 3: Overall Team Lead is the SOLE FINAL APPROVING AUTHORITY.
   */
  static async reviewSalaryApproval(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const { id } = req.params;
      const { decision, reason, notes } = req.body;

      // STRICT BACKEND AUTHORIZATION: ONLY OVERALL TEAM LEAD CAN APPROVE
      if (currentUser.role !== Role.OVERALL_LEAD) {
        return res.status(403).json({
          success: false,
          message: 'SECURITY POLICY VIOLATION: Only the Overall Team Lead is authorized to approve salary payments.'
        });
      }

      const record = await SalaryRecord.findOne(buildIdFilter('salaryId', id));

      if (!record) {
        return res.status(404).json({ success: false, message: 'Salary record not found.' });
      }

      if (decision === 'APPROVE') {
        record.status = SalaryStatus.APPROVED;
        record.approvedByOverallLead = {
          userId: currentUser.employeeId,
          name: currentUser.name,
          role: currentUser.role,
          at: new Date(),
          notes: notes || 'Approved for disbursement.'
        };
        await record.save();

        await logAudit(
          req,
          'SALARY_APPROVED_BY_OVERALL_LEAD',
          'SALARY',
          record.salaryId,
          `Overall Team Lead ${currentUser.name} APPROVED salary ${record.salaryId} (₹${record.netSalary}) for ${record.employeeName}.`
        );

        return res.json({
          success: true,
          message: 'Salary statement approved by Overall Team Lead. Eligible for disbursement.',
          data: record
        });
      }

      if (decision === 'REJECT') {
        record.status = SalaryStatus.REJECTED;
        record.rejectionReason = reason || 'Rejected by Overall Team Lead.';
        await record.save();

        await logAudit(
          req,
          'SALARY_REJECTED_BY_OVERALL_LEAD',
          'SALARY',
          record.salaryId,
          `Overall Team Lead ${currentUser.name} REJECTED salary ${record.salaryId}. Reason: ${reason}`
        );

        return res.json({
          success: true,
          message: 'Salary statement rejected.',
          data: record
        });
      }

      return res.status(400).json({ success: false, message: 'Invalid decision. Must be APPROVE or REJECT.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Disburse/Pay approved salary (Payment Team operator or Payroll Officer)
   */
  static async disburseSalary(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const { id } = req.params;
      const { paymentMethod } = req.body;

      const record = await SalaryRecord.findOne(buildIdFilter('salaryId', id));

      if (!record) {
        return res.status(404).json({ success: false, message: 'Salary record not found.' });
      }

      // Mandatory approval check
      if (record.status !== SalaryStatus.APPROVED) {
        return res.status(403).json({
          success: false,
          message: `Cannot pay salary. Current status is "${record.status}". Overall Team Lead approval is required before payment.`
        });
      }

      const transactionId = generateId('TXN-SAL');

      record.status = SalaryStatus.PAID;
      record.paidDetails = {
        paidByUserId: currentUser.employeeId,
        paidByName: currentUser.name,
        paymentDate: new Date(),
        transactionId,
        paymentMethod: paymentMethod || 'Direct Bank Deposit'
      };
      await record.save();

      // Record in Payment Transactions ledger under OUTGOING
      await PaymentTransaction.create({
        transactionId,
        referenceId: record.salaryId,
        transactionType: 'Salary Payment',
        financialClassification: FinancialClassification.OUTGOING,
        fromParty: { id: 'CONNECT_PAYROLL', name: 'Connect App Payroll Account', type: 'Platform' },
        toParty: { id: record.employeeId, name: record.employeeName, type: 'Employee' },
        amount: record.netSalary,
        grossAmount: record.earnings.gross,
        deductions: record.deductions.total,
        finalAmount: record.netSalary,
        paymentMethod: paymentMethod || 'Direct Bank Deposit',
        status: 'COMPLETED',
        handledByEmployeeId: currentUser.employeeId,
        handledByEmployeeName: currentUser.name,
        department: 'Payment Team',
        transactionDate: new Date(),
        notes: `Salary payout for period ${record.periodLabel}`
      });

      await logAudit(
        req,
        'SALARY_PAID',
        'SALARY',
        record.salaryId,
        `Salary of ₹${record.netSalary} disbursed to ${record.employeeName}. Txn ID: ${transactionId}`
      );

      return res.json({
        success: true,
        message: `Salary of ₹${record.netSalary} marked as Paid.`,
        data: record
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getSalaryDashboardKpis(req: Request, res: Response): Promise<any> {
    try {
      const roleScope = buildSalaryRoleScope(req.user!);
      const records = await SalaryRecord.find(roleScope).lean();
      const structures = await SalaryStructure.find({ ...roleScope, isActive: true }).lean();

      const totalMonthlyCommitment = structures
        .filter((s) => s.salaryCycle === 'Monthly')
        .reduce((sum, s) => sum + s.netPayable, 0);

      const totalWeeklyCommitment = structures
        .filter((s) => s.salaryCycle === 'Weekly')
        .reduce((sum, s) => sum + s.netPayable, 0);

      const totalPaid = records
        .filter((r) => r.status === SalaryStatus.PAID)
        .reduce((sum, r) => sum + r.netSalary, 0);

      const pendingItems = records.filter((r) =>
        [SalaryStatus.DRAFT, SalaryStatus.PREPARED, SalaryStatus.SUBMITTED_FOR_OVERALL_APPROVAL].includes(
          r.status as SalaryStatus
        )
      );
      const approvedItems = records.filter((r) =>
        [SalaryStatus.APPROVED, SalaryStatus.PROCESSING].includes(r.status as SalaryStatus)
      );
      const failedItems = records.filter((r) => r.status === SalaryStatus.FAILED);

      const totalPendingApproval = pendingItems.reduce((sum, r) => sum + r.netSalary, 0);
      const totalApproved = approvedItems.reduce((sum, r) => sum + r.netSalary, 0);
      const totalFailed = failedItems.reduce((sum, r) => sum + r.netSalary, 0);

      return res.json({
        success: true,
        data: {
          totalMonthlyCommitment,
          totalWeeklyCommitment,
          totalPaid,
          totalPendingApproval,
          totalApproved,
          totalFailed,
          pendingRecordsCount: pendingItems.length,
          approvedRecordsCount: approvedItems.length,
          paidRecordsCount: records.filter((r) => r.status === SalaryStatus.PAID).length,
          failedRecordsCount: failedItems.length,
          weeklyCount: records.filter((r) => r.salaryCycle === 'Weekly').length,
          monthlyCount: records.filter((r) => r.salaryCycle === 'Monthly').length
        }
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * List employee salary structures (scoped by role)
   */
  static async listSalaryStructures(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const filter: any = {};
      if ([Role.KYC_EMPLOYEE, Role.PAYMENT_EMPLOYEE, Role.QUERIES_EMPLOYEE].includes(currentUser.role as Role)) {
        filter.employeeId = currentUser.employeeId;
      } else if ([Role.KYC_LEAD, Role.QUERIES_LEAD].includes(currentUser.role as Role)) {
        filter.department = currentUser.department;
      }

      const structures = await SalaryStructure.find(filter).sort({ department: 1, employeeName: 1 });
      return res.json({
        success: true,
        count: structures.length,
        data: structures
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Create or update an employee's configurable Salary Structure
   */
  static async upsertSalaryStructure(req: Request, res: Response): Promise<any> {
    try {
      const { employeeId } = req.params;
      const employee = await Employee.findOne(buildIdFilter('employeeId', employeeId)).select('-password');
      if (!employee) {
        return res.status(404).json({ success: false, message: 'Employee not found.' });
      }

      const basicSalary = Number(req.body.basicSalary ?? 0);
      const hra = Number(req.body.hra ?? 0);
      const otherAllowances = Number(req.body.otherAllowances ?? 0);
      const incentives = Number(req.body.incentives ?? 0);
      const bonus = Number(req.body.bonus ?? 0);
      const pfDeduction = Number(req.body.pfDeduction ?? 0);
      const esiDeduction = Number(req.body.esiDeduction ?? 0);
      const taxDeduction = Number(req.body.taxDeduction ?? 0);
      const otherDeductions = Number(req.body.otherDeductions ?? 0);
      const salaryCycle = req.body.salaryCycle || employee.salaryCycle || SalaryCycle.MONTHLY;

      const grossSalary = basicSalary + hra + otherAllowances + incentives + bonus;
      const totalDeductions = pfDeduction + esiDeduction + taxDeduction + otherDeductions;
      const netPayable = Math.max(0, grossSalary - totalDeductions);

      const updated = await SalaryStructure.findOneAndUpdate(
        { employeeId: employee.employeeId },
        {
          $set: {
            employeeId: employee.employeeId,
            employeeName: employee.name,
            department: employee.department,
            designation: employee.designation,
            salaryCycle,
            basicSalary,
            hra,
            otherAllowances,
            incentives,
            bonus,
            pfDeduction,
            esiDeduction,
            taxDeduction,
            otherDeductions,
            grossSalary,
            totalDeductions,
            netPayable,
            isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true
          }
        },
        { upsert: true, new: true }
      );

      await logAudit(
        req,
        'SALARY_STRUCTURE_UPDATED',
        'SALARY',
        employee.employeeId,
        `Updated salary structure for ${employee.name} (${salaryCycle}). Net payable: ₹${netPayable}.`
      );

      return res.json({
        success: true,
        message: 'Salary structure saved successfully.',
        data: updated
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Optional pre-approval Departmental Review note by Department Team Lead
   */
  static async departmentReviewSalary(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const { id } = req.params;
      const { notes } = req.body;

      const record = await SalaryRecord.findOne(buildIdFilter('salaryId', id));
      if (!record) {
        return res.status(404).json({ success: false, message: 'Salary record not found.' });
      }

      if (currentUser.role !== Role.OVERALL_LEAD && record.department !== currentUser.department) {
        return res.status(403).json({
          success: false,
          message: 'Department Leads can only add departmental review notes for their own team.'
        });
      }

      record.departmentReviewedBy = {
        userId: currentUser.employeeId,
        name: currentUser.name,
        role: currentUser.role,
        at: new Date(),
        notes: notes || 'Verified attendance and incentives by Department Lead.'
      };
      await record.save();

      await logAudit(
        req,
        'SALARY_DEPT_REVIEWED',
        'SALARY',
        record.salaryId,
        `${currentUser.name} added departmental review sign-off for ${record.employeeName}.`
      );

      return res.json({
        success: true,
        message: 'Departmental salary review recorded. Awaiting Overall Team Lead final approval.',
        data: record
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

