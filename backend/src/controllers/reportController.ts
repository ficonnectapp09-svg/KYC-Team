import { Request, Response } from 'express';
import { KycRequest } from '../models/KycRequest';
import { PaymentTransaction } from '../models/PaymentTransaction';
import { AgentDepositLiability } from '../models/AgentDepositLiability';
import { FinancialApproval } from '../models/FinancialApproval';
import { QueryTicket } from '../models/QueryTicket';
import { Employee } from '../models/Employee';
import { TaskItem } from '../models/TaskItem';
import { SalaryRecord } from '../models/SalaryRecord';
import { AttendanceRecord } from '../models/AttendanceRecord';
import { AuditTrail } from '../models/AuditTrail';
import { FinancialLedgerService } from '../services/financialLedgerService';
import { ConnectEcosystemReader } from '../services/connectEcosystemReader';
import { ApprovalStatus, Department, KycStatus, QueryStatus, Role, SalaryStatus } from '../config/constants';

export class ReportController {
  static async getOverallDashboard(req: Request, res: Response): Promise<any> {
    try {
      const todayKey = new Date().toISOString().slice(0, 10);
      const kycSlaCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const querySlaCutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);

      // 1. Staff metrics
      const [
        totalTeamLeads,
        totalEmployees,
        activeEmployees,
        employeesOnLeave,
        todayAttendance,
        allEmployees,
        distinctDepartments
      ] = await Promise.all([
        Employee.countDocuments({ role: { $in: ['kyc_lead', 'payment_lead', 'queries_lead'] } }),
        Employee.countDocuments(),
        Employee.countDocuments({ status: 'active' }),
        Employee.countDocuments({ status: 'inactive' }),
        AttendanceRecord.find({ dateKey: todayKey }).lean(),
        Employee.find().select('employeeId name department role status designation').lean(),
        Employee.distinct('department', { department: { $ne: Department.OVERALL } })
      ]);
      const totalDepartments = distinctDepartments.length;

      // 2. KYC metrics
      const [pendingKycRequests, approvedKycRequests, rejectedKycRequests, reuploadRequests, overdueKycCount] =
        await Promise.all([
          KycRequest.countDocuments({
            status: { $in: [KycStatus.UNASSIGNED, KycStatus.ASSIGNED, KycStatus.IN_PROGRESS] }
          }),
          KycRequest.countDocuments({ status: KycStatus.APPROVED }),
          KycRequest.countDocuments({ status: KycStatus.REJECTED }),
          KycRequest.countDocuments({ status: KycStatus.RE_UPLOAD_REQUESTED }),
          KycRequest.countDocuments({
            status: { $nin: [KycStatus.APPROVED, KycStatus.REJECTED] },
            submissionDate: { $lt: kycSlaCutoff }
          })
        ]);

      // 3. Payment metrics
      const financialMetrics = await FinancialLedgerService.getFinancialMetrics();

      // 4. Queries metrics
      const [pendingQueries, resolvedQueries, overdueQueries, escalatedQueries] = await Promise.all([
        QueryTicket.countDocuments({ status: { $nin: [QueryStatus.RESOLVED] } }),
        QueryTicket.countDocuments({ status: QueryStatus.RESOLVED }),
        QueryTicket.countDocuments({
          status: { $ne: QueryStatus.RESOLVED },
          createdAt: { $lt: querySlaCutoff }
        }),
        QueryTicket.countDocuments({ status: { $ne: QueryStatus.RESOLVED }, priority: 'Urgent' })
      ]);

      // 5. Tasks metrics
      const [overdueTasks, completedTasks, allTasks] = await Promise.all([
        TaskItem.countDocuments({
          dueDate: { $lt: new Date() },
          status: { $nin: ['Completed', 'Cancelled'] }
        }),
        TaskItem.countDocuments({ status: 'Completed' }),
        TaskItem.find().select('assignedTo status department updatedAt').lean()
      ]);

      // 6. Salary metrics & Pending Approvals
      const [paidSalaries, pendingSalaries, pendingFinancialApprovals, pendingLeaves, recentActivities] =
        await Promise.all([
          SalaryRecord.find({ status: SalaryStatus.PAID }).lean(),
          SalaryRecord.find({ status: SalaryStatus.SUBMITTED_FOR_OVERALL_APPROVAL }).lean(),
          FinancialApproval.find({
            status: { $in: [ApprovalStatus.SUBMITTED, ApprovalStatus.PENDING_CHECKER] }
          })
            .sort({ submittedAt: -1 })
            .limit(8)
            .lean(),
          AttendanceRecord.find({ leaveApprovalStatus: 'Pending' }).limit(8).lean(),
          AuditTrail.find().sort({ timestamp: -1 }).limit(12).lean()
        ]);

      const totalSalariesPaid = paidSalaries.reduce((sum, s) => sum + s.netSalary, 0);
      const pendingSalaryAmount = pendingSalaries.reduce((sum, s) => sum + s.netSalary, 0);

      // 7. Department Performance Summary
      const departmentPerformance = await Promise.all(
        [Department.KYC, Department.PAYMENT, Department.QUERIES].map(async (dept) => {
          const deptStaffCount = allEmployees.filter((e) => e.department === dept && e.status === 'active').length;
          const deptTasks = allTasks.filter((t) => t.department === dept);
          const deptCompletedTasks = deptTasks.filter((t) => t.status === 'Completed').length;
          let workloadMetric = 0;
          let resolvedMetric = 0;
          if (dept === Department.KYC) {
            workloadMetric = pendingKycRequests;
            resolvedMetric = approvedKycRequests;
          } else if (dept === Department.PAYMENT) {
            workloadMetric = pendingFinancialApprovals.length + pendingSalaries.length;
            resolvedMetric = financialMetrics.statusSummary.completedCount;
          } else {
            workloadMetric = pendingQueries;
            resolvedMetric = resolvedQueries;
          }

          return {
            department: dept,
            activeStaff: deptStaffCount,
            openItems: workloadMetric,
            completedItems: resolvedMetric,
            taskCompletionRate:
              deptTasks.length > 0 ? Math.round((deptCompletedTasks / deptTasks.length) * 100) : 0
          };
        })
      );

      // 8. Team Lead & Employee Performance snapshots
      const leads = allEmployees.filter((e) => ['kyc_lead', 'payment_lead', 'queries_lead'].includes(e.role));
      const teamLeadPerformance = leads.map((lead) => {
        const deptTasks = allTasks.filter((t) => t.department === lead.department);
        const deptDone = deptTasks.filter((t) => t.status === 'Completed').length;
        return {
          employeeId: lead.employeeId,
          name: lead.name,
          department: lead.department,
          status: lead.status,
          departmentTasks: deptTasks.length,
          completedDepartmentTasks: deptDone
        };
      });

      const employeePerformance = await Promise.all(
        allEmployees
          .filter((e) => e.role !== Role.OVERALL_LEAD)
          .slice(0, 10)
          .map(async (emp) => {
            const empTasks = allTasks.filter((t) => t.assignedTo?.employeeId === emp.employeeId);
            const empDone = empTasks.filter((t) => t.status === 'Completed').length;
            const kycDone = await KycRequest.countDocuments({
              assignedEmployeeId: emp.employeeId,
              status: KycStatus.APPROVED
            });
            const qryDone = await QueryTicket.countDocuments({
              assignedEmployeeId: emp.employeeId,
              status: QueryStatus.RESOLVED
            });
            return {
              employeeId: emp.employeeId,
              name: emp.name,
              department: emp.department,
              designation: emp.designation,
              tasksAssigned: empTasks.length,
              tasksCompleted: empDone,
              kycApproved: kycDone,
              queriesResolved: qryDone
            };
          })
      );

      // 9. Attendance today summary
      const attendance = {
        dateKey: todayKey,
        presentToday: todayAttendance.filter((a) => ['Present', 'Remote'].includes(a.status)).length,
        lateToday: todayAttendance.filter((a) => a.status === 'Late').length,
        onLeaveToday: todayAttendance.filter((a) => a.status === 'On Leave').length,
        absentToday: todayAttendance.filter((a) => a.status === 'Absent').length,
        pendingLeaveApprovals: pendingLeaves.length
      };

      // 10. Critical Operational Alerts
      const criticalAlerts: Array<{ severity: 'critical' | 'warning' | 'info'; module: string; message: string; link: string }> = [];
      if (overdueKycCount > 0) {
        criticalAlerts.push({
          severity: 'warning',
          module: 'KYC',
          message: `${overdueKycCount} KYC verification(s) exceeded 24h SLA.`,
          link: '/kyc'
        });
      }
      if (pendingFinancialApprovals.length > 0) {
        criticalAlerts.push({
          severity: 'info',
          module: 'PAYMENT',
          message: `${pendingFinancialApprovals.length} Maker-Checker financial payout(s) awaiting Checker sign-off.`,
          link: '/payment'
        });
      }
      if (pendingSalaries.length > 0) {
        criticalAlerts.push({
          severity: 'critical',
          module: 'SALARY',
          message: `${pendingSalaries.length} salary statement(s) (₹${pendingSalaryAmount.toLocaleString()}) await Overall Lead final approval.`,
          link: '/salary'
        });
      }
      if (overdueQueries > 0 || escalatedQueries > 0) {
        criticalAlerts.push({
          severity: 'critical',
          module: 'QUERIES',
          message: `${overdueQueries} overdue and ${escalatedQueries} urgent escalated query ticket(s).`,
          link: '/queries'
        });
      }
      if (overdueTasks > 0) {
        criticalAlerts.push({
          severity: 'warning',
          module: 'TASKS',
          message: `${overdueTasks} assigned operational task(s) are past their due date.`,
          link: '/tasks'
        });
      }

      return res.json({
        success: true,
        data: {
          staff: {
            totalDepartments,
            totalTeamLeads,
            totalEmployees,
            activeEmployees,
            employeesOnLeave
          },
          kyc: {
            pendingKycRequests,
            approvedKycRequests,
            rejectedKycRequests,
            reuploadRequests,
            overdueKycCount
          },
          payment: {
            totalRecognizedIncome: financialMetrics.totalRecognizedIncome,
            totalOutgoing: financialMetrics.totalOutgoing,
            netFinancialMovement: financialMetrics.netFinancialMovement,
            outstandingAgentDepositLiability: financialMetrics.liabilities.outstandingAgentDepositLiability,
            totalSalariesPaid,
            pendingSalaryPayments: pendingSalaryAmount,
            incomeBreakdown: financialMetrics.incomeBreakdown,
            outgoingBreakdown: financialMetrics.outgoingBreakdown
          },
          queries: {
            pendingQueries,
            resolvedQueries,
            overdueQueries,
            escalatedQueries
          },
          tasks: {
            overdueTasks,
            completedTasks,
            totalTasks: allTasks.length
          },
          attendance,
          departmentPerformance,
          teamLeadPerformance,
          employeePerformance,
          pendingApprovals: {
            salaryApprovalsCount: pendingSalaries.length,
            paymentApprovalsCount: pendingFinancialApprovals.length,
            leaveApprovalsCount: pendingLeaves.length,
            salaryItems: pendingSalaries.slice(0, 5),
            paymentItems: pendingFinancialApprovals.slice(0, 5)
          },
          recentActivities,
          criticalAlerts
        }
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getKycReport(req: Request, res: Response): Promise<any> {
    try {
      const byApplicantType = await KycRequest.aggregate([
        { $group: { _id: '$applicantType', count: { $sum: 1 } } }
      ]);

      const byStatus = await KycRequest.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      return res.json({
        success: true,
        data: {
          byApplicantType,
          byStatus
        }
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getPaymentReport(req: Request, res: Response): Promise<any> {
    try {
      const financialMetrics = await FinancialLedgerService.getFinancialMetrics();
      const liabilities = await AgentDepositLiability.find().lean();

      return res.json({
        success: true,
        data: {
          metrics: financialMetrics,
          agentDepositLiabilities: liabilities
        }
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getQueriesReport(req: Request, res: Response): Promise<any> {
    try {
      const bySource = await QueryTicket.aggregate([
        { $group: { _id: '$userType', count: { $sum: 1 } } }
      ]);

      const byStatus = await QueryTicket.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      const transferredCount = await QueryTicket.countDocuments({
        'transferHistory.0': { $exists: true }
      });

      return res.json({
        success: true,
        data: {
          bySource,
          byStatus,
          transferredCasesCount: transferredCount
        }
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Read-only snapshot of live Connect App ecosystem collections (orders, membership_payments, vendors, agents)
   */
  static async getEcosystemOverview(req: Request, res: Response): Promise<any> {
    try {
      const summary = await ConnectEcosystemReader.getEcosystemSummary();
      return res.json({
        success: true,
        data: summary
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Role-scoped Global Search across Employees, KYC Requests, Payments, Queries & Tasks
   */
  static async globalSearch(req: Request, res: Response): Promise<any> {
    try {
      const q = String(req.query.q || '').trim();
      const currentUser = req.user!;
      if (q.length < 2) {
        return res.json({ success: true, data: { employees: [], kyc: [], payments: [], queries: [], tasks: [] } });
      }

      const regex = { $regex: q, $options: 'i' };
      const isOverall = currentUser.role === Role.OVERALL_LEAD;
      const isKyc = isOverall || currentUser.role.includes('kyc');
      const isPayment = isOverall || currentUser.role.includes('payment');
      const isQueries = isOverall || currentUser.role.includes('queries');

      const [employees, kyc, payments, queries, tasks] = await Promise.all([
        isOverall || currentUser.role.endsWith('_lead')
          ? Employee.find({
              ...(isOverall ? {} : { department: currentUser.department }),
              $or: [{ name: regex }, { employeeId: regex }, { email: regex }]
            })
              .select('employeeId name department designation status')
              .limit(5)
              .lean()
          : Promise.resolve([]),
        isKyc
          ? KycRequest.find({
              $or: [{ requestId: regex }, { applicantId: regex }, { applicantName: regex }, { phone: regex }]
            })
              .select('requestId applicantName applicantType status')
              .limit(5)
              .lean()
          : Promise.resolve([]),
        isPayment
          ? PaymentTransaction.find({
              $or: [{ transactionId: regex }, { referenceId: regex }, { 'fromParty.name': regex }, { 'toParty.name': regex }]
            })
              .select('transactionId transactionType financialClassification finalAmount status')
              .limit(5)
              .lean()
          : Promise.resolve([]),
        isQueries
          ? QueryTicket.find({
              ...(isOverall
                ? {}
                : {
                    $or: [
                      { currentDepartment: currentUser.department },
                      { sharedDepartments: currentUser.department }
                    ]
                  }),
              $and: [{ $or: [{ queryId: regex }, { subject: regex }, { userName: regex }] }]
            })
              .select('queryId subject userName status priority')
              .limit(5)
              .lean()
          : Promise.resolve([]),
        TaskItem.find({
          ...(isOverall ? {} : { department: currentUser.department }),
          $or: [{ taskId: regex }, { title: regex }]
        })
          .select('taskId title department status priority')
          .limit(5)
          .lean()
      ]);

      return res.json({
        success: true,
        data: { employees, kyc, payments, queries, tasks }
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

