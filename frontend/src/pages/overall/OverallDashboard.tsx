import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  ShieldCheck,
  CreditCard,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  Building2,
  Clock,
  Scale,
  CheckCircle2,
  CalendarCheck2,
  Activity,
  Banknote,
  FileWarning,
  Database
} from 'lucide-react';
import { StatCard } from '../../components/common/StatCard';
import { Badge } from '../../components/common/Badge';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { apiFetch } from '../../services/api';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const OverallDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [ecosystem, setEcosystem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ecosystemError, setEcosystemError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      setEcosystemError(null);
      const [overallRes, ecoRes] = await Promise.allSettled([
        apiFetch('/reports/overall'),
        apiFetch('/reports/ecosystem')
      ]);

      if (overallRes.status === 'fulfilled' && overallRes.value.success && overallRes.value.data) {
        setData(overallRes.value.data);
      } else {
        const msg =
          overallRes.status === 'rejected'
            ? overallRes.reason?.message
            : overallRes.value?.message;
        setLoadError(msg || 'Failed to load overall dashboard telemetry from backend.');
      }

      if (ecoRes.status === 'fulfilled' && ecoRes.value.success && ecoRes.value.data) {
        setEcosystem(ecoRes.value.data);
      } else {
        const msg =
          ecoRes.status === 'rejected'
            ? ecoRes.reason?.message
            : ecoRes.value?.message;
        setEcosystemError(msg || 'Connect App live ecosystem telemetry failed to load.');
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load dashboard telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (loadError && !data) {
    return (
      <div className="space-y-4">
        <ErrorBanner message={loadError} onRetry={fetchDashboard} />
      </div>
    );
  }

  const staff = data?.staff || {};
  const kyc = data?.kyc || {};
  const payment = data?.payment || {};
  const queries = data?.queries || {};
  const tasks = data?.tasks || {};
  const attendance = data?.attendance || {};
  const pendingApprovals = data?.pendingApprovals || {};
  const departmentPerformance: any[] = data?.departmentPerformance || [];
  const teamLeadPerformance: any[] = data?.teamLeadPerformance || [];
  const employeePerformance: any[] = data?.employeePerformance || [];
  const recentActivities: any[] = data?.recentActivities || [];
  const criticalAlerts: any[] = data?.criticalAlerts || [];

  const financialComparisonData = [
    { category: 'Recognized Income', amount: payment.totalRecognizedIncome || 0 },
    { category: 'Total Outgoing', amount: payment.totalOutgoing || 0 },
    { category: 'Agent Deposit Liability', amount: payment.outstandingAgentDepositLiability || 0 },
    { category: 'Salaries Paid', amount: payment.totalSalariesPaid || 0 }
  ];

  const taskTrendsData = [
    { metric: 'Completed Tasks', count: tasks.completedTasks || 0 },
    { metric: 'Overdue Tasks', count: tasks.overdueTasks || 0 },
    { metric: 'Pending KYC', count: kyc.pendingKycRequests || 0 },
    { metric: 'Approved KYC', count: kyc.approvedKycRequests || 0 },
    { metric: 'Pending Queries', count: queries.pendingQueries || 0 },
    { metric: 'Resolved Queries', count: queries.resolvedQueries || 0 }
  ];

  return (
    <div className="space-y-6">
      {/* Executive Command Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-indigo-900 to-slate-900 text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30">
              Level 1 Executive View
            </span>
            <span className="text-xs text-indigo-200">Live Persisted MongoDB Telemetry</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">Overall Team Lead Command Center</h2>
          <p className="text-xs text-indigo-200/80 mt-1 max-w-2xl">
            Enterprise command across KYC Verification, Maker-Checker Financial Authorizations, Liability-Segregated Accounting, Shared Support Transfers, Attendance & Payroll Final Approvals.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-white/10 px-4 py-3 rounded-xl border border-white/10 backdrop-blur-sm shrink-0">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">
              Net Financial Movement
            </div>
            <div className="text-lg font-black text-white">
              ₹{(payment.netFinancialMovement || 0).toLocaleString()}
            </div>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">
              Pending Final Approvals
            </div>
            <div className="text-lg font-black text-amber-300">
              {(pendingApprovals.salaryApprovalsCount || 0) + (pendingApprovals.paymentApprovalsCount || 0)}
            </div>
          </div>
        </div>
      </div>

      {/* All 19 Database-Backed Spec KPIs organized in clean enterprise rows */}
      {/* Row 1: Staff & Attendance + Org Structure (5 KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Departments"
          value={staff.totalDepartments ?? 0}
          subtitle="KYC, Payment & Queries"
          icon={Building2}
          variant="indigo"
        />
        <StatCard
          title="Total Team Leads"
          value={staff.totalTeamLeads || 0}
          subtitle="Independent Dept Leads"
          icon={Users}
          variant="sky"
        />
        <StatCard
          title="Total Employees"
          value={staff.totalEmployees || 0}
          subtitle="Across Organization"
          icon={Users}
          variant="purple"
        />
        <StatCard
          title="Active Employees"
          value={staff.activeEmployees || 0}
          subtitle={`${attendance.presentToday ?? 0} Present Today`}
          icon={CheckCircle2}
          variant="emerald"
        />
        <StatCard
          title="Employees on Leave"
          value={staff.employeesOnLeave || 0}
          subtitle={`${attendance.onLeaveToday ?? 0} Scheduled Leave`}
          icon={CalendarCheck2}
          variant="amber"
        />
      </div>

      {/* Row 2: KYC, Queries & Tasks (7 KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Pending KYC Requests"
          value={kyc.pendingKycRequests || 0}
          subtitle={`${kyc.overdueKycCount || 0} Exceeded 24h SLA`}
          icon={ShieldCheck}
          variant="amber"
        />
        <StatCard
          title="Approved KYC & Re-uploads"
          value={`${kyc.approvedKycRequests || 0} Approved`}
          subtitle={`${kyc.reuploadRequests || 0} Re-upload Requests Pending`}
          icon={FileWarning}
          variant="emerald"
        />
        <StatCard
          title="Customer & Partner Queries"
          value={`${queries.pendingQueries || 0} Pending`}
          subtitle={`${queries.resolvedQueries || 0} Resolved | ${queries.overdueQueries || 0} Overdue`}
          icon={MessageSquare}
          variant="sky"
        />
        <StatCard
          title="Operational Tasks"
          value={`${tasks.completedTasks || 0} Completed`}
          subtitle={`${tasks.overdueTasks || 0} Overdue Tasks`}
          icon={AlertTriangle}
          variant={tasks.overdueTasks > 0 ? 'rose' : 'indigo'}
        />
      </div>

      {/* Row 3: Financial & Payroll KPIs (7 KPIs: Recognized Income, Outgoing, Agent Liabilities, Salaries Paid, Pending Salary, Pending Payments, Completed Payments) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Recognized Income"
          value={`₹${(payment.totalRecognizedIncome || 0).toLocaleString()}`}
          subtitle="Orders, Bookings, Memberships"
          icon={TrendingUp}
          variant="emerald"
        />
        <StatCard
          title="Total Outgoing"
          value={`₹${(payment.totalOutgoing || 0).toLocaleString()}`}
          subtitle="Settlements, Payouts & Payroll"
          icon={CreditCard}
          variant="rose"
        />
        <StatCard
          title="Agent Deposit Liabilities"
          value={`₹${(payment.outstandingAgentDepositLiability || 0).toLocaleString()}`}
          subtitle="Balance Sheet Liability Only"
          icon={Scale}
          variant="purple"
        />
        <StatCard
          title="Total Salaries Paid"
          value={`₹${(payment.totalSalariesPaid || 0).toLocaleString()}`}
          subtitle={`${pendingApprovals.paymentApprovalsCount || 0} Pending Payments`}
          icon={Banknote}
          variant="indigo"
        />
        <StatCard
          title="Pending Salary Payments"
          value={`₹${(payment.pendingSalaryPayments || 0).toLocaleString()}`}
          subtitle={`${pendingApprovals.salaryApprovalsCount || 0} Awaiting Overall Lead`}
          icon={Clock}
          variant="amber"
        />
      </div>

      {/* Critical Operational Alerts + Live Connect App Ecosystem Telemetry (Read-Only) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Critical Operational Alerts & Pending Approvals
            </h3>
            <Badge variant={criticalAlerts.length > 0 ? 'warning' : 'success'}>
              {criticalAlerts.length} Active Alerts
            </Badge>
          </div>
          {criticalAlerts.length === 0 ? (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-xs text-emerald-700 dark:text-emerald-300">
              All operational queues are within SLA thresholds.
            </div>
          ) : (
            <div className="space-y-2">
              {criticalAlerts.map((alert, idx) => (
                <div
                  key={idx}
                  onClick={() => navigate(alert.link)}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer text-xs transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Badge variant={alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'info'}>
                      {alert.module}
                    </Badge>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{alert.message}</span>
                  </div>
                  <span className="text-indigo-600 dark:text-indigo-400 font-semibold shrink-0 ml-2">Review →</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Read-Only Connect App Production Telemetry */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600" />
              Connect App Live Ecosystem Bridge (Read-Only)
            </h3>
            <Badge variant="info">connect_db Sync</Badge>
          </div>
          {ecosystem ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div className="text-slate-400 text-[10px] font-bold uppercase">Live Orders</div>
                <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                  {ecosystem.ordersCount}
                </div>
                <div className="text-[11px] text-slate-500">
                  {ecosystem.productOrdersCount} Orders • {ecosystem.serviceBookingsCount} Bookings
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div className="text-slate-400 text-[10px] font-bold uppercase">Memberships</div>
                <div className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                  ₹{(ecosystem.membershipRevenueInr || 0).toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500">{ecosystem.membershipPaymentsCount} Verified Payments</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div className="text-slate-400 text-[10px] font-bold uppercase">Vendors & Agents</div>
                <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                  {ecosystem.vendorsCount}V / {ecosystem.agentsCount}A
                </div>
                <div className="text-[11px] text-amber-600 font-semibold">
                  {ecosystem.pendingVendorKycCount + ecosystem.pendingAgentKycCount} Pending Ecosystem KYC
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-rose-500 p-4 font-semibold">
              {ecosystemError || 'Connect App live collection summary failed to load.'}
            </div>
          )}
        </div>
      </div>

      {/* Charts: Financial Flow + Operational Task & Resolution Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Income vs Outgoing & Financial Liabilities
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Agent deposits are strictly isolated as balance sheet liabilities.
              </p>
            </div>
            <Badge variant="primary">Decision 1 Confirmed</Badge>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financialComparisonData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: number) => [`₹${val.toLocaleString()}`, 'Amount']}
                  contentStyle={{ borderRadius: '12px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                />
                <Bar dataKey="amount" fill="#4f46e5" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Task, KYC & Query Completion Trends
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Cross-department queue Throughput & Backlog health.
              </p>
            </div>
            <Badge variant="info">Live Workflow Counts</Badge>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={taskTrendsData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="metric" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', background: '#0f172a', border: '1px solid #334155', color: '#fff' }}
                />
                <Bar dataKey="count" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Department Performance + Team Lead Performance + Attendance Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Department Performance
          </h3>
          <div className="space-y-3">
            {departmentPerformance.map((dept) => (
              <div
                key={dept.department}
                className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-900 dark:text-white">{dept.department}</span>
                  <Badge variant="primary">{dept.taskCompletionRate}% Tasks Done</Badge>
                </div>
                <div className="text-slate-500 dark:text-slate-400">
                  {dept.activeStaff} Active Staff • {dept.openItems} Open • {dept.completedItems} Completed
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Team Lead Performance
          </h3>
          <div className="space-y-3">
            {teamLeadPerformance.map((lead) => (
              <div
                key={lead.employeeId}
                className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">{lead.name}</span>
                  <Badge variant="success">{lead.department}</Badge>
                </div>
                <div className="text-slate-500 mt-1">
                  Dept Tasks: {lead.completedDepartmentTasks}/{lead.departmentTasks} completed • ID: {lead.employeeId}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Employee Attendance Today ({attendance.dateKey || 'Today'})
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
              <div className="text-emerald-700 dark:text-emerald-300 font-bold">Present</div>
              <div className="text-xl font-black text-emerald-800 dark:text-emerald-200">{attendance.presentToday || 0}</div>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30">
              <div className="text-amber-700 dark:text-amber-300 font-bold">On Leave</div>
              <div className="text-xl font-black text-amber-800 dark:text-amber-200">{attendance.onLeaveToday || 0}</div>
            </div>
            <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30">
              <div className="text-sky-700 dark:text-sky-300 font-bold">Late Check-in</div>
              <div className="text-xl font-black text-sky-800 dark:text-sky-200">{attendance.lateToday || 0}</div>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30">
              <div className="text-rose-700 dark:text-rose-300 font-bold">Leave Requests</div>
              <div className="text-xl font-black text-rose-800 dark:text-rose-200">{attendance.pendingLeaveApprovals || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Performance Table + Recent Activities Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-3">
            Employee Performance Snapshot
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase text-slate-400">
                  <th className="py-2">Employee</th>
                  <th className="py-2">Dept</th>
                  <th className="py-2">Tasks</th>
                  <th className="py-2">KYC/Queries</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {employeePerformance.map((emp) => (
                  <tr key={emp.employeeId}>
                    <td className="py-2.5 font-semibold text-slate-900 dark:text-white">{emp.name}</td>
                    <td className="py-2.5 text-slate-500">{emp.department}</td>
                    <td className="py-2.5 font-mono">{emp.tasksCompleted}/{emp.tasksAssigned}</td>
                    <td className="py-2.5">{emp.kycApproved} KYC • {emp.queriesResolved} Qry</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            Recent Operational Activities (Audit Feed)
          </h3>
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {recentActivities.length === 0 ? (
              <div className="text-xs text-slate-400 py-4">No recent activities recorded yet.</div>
            ) : (
              recentActivities.map((act, idx) => (
                <div
                  key={act._id || idx}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">{act.action}</div>
                    <div className="text-slate-500 dark:text-slate-400 mt-0.5">{act.details}</div>
                  </div>
                  <Badge variant="neutral">{act.module}</Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
