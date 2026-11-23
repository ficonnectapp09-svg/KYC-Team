import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Banknote,
  CheckCircle2,
  XCircle,
  Lock,
  Plus,
  FileText,
  Clock,
  AlertTriangle,
  Sliders,
  Printer,
  Search
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { SalaryRecord, Employee } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { StatCard } from '../../components/common/StatCard';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { PaginationBar } from '../../components/common/DepartmentTabHeader';
import { SALARY_NAV_CATEGORIES } from '../../config/categoryCatalog';

function getCurrentMonthPayrollPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const monthIdx = now.getMonth();
  const monthStr = String(monthIdx + 1).padStart(2, '0');
  const lastDay = String(new Date(year, monthIdx + 1, 0).getDate()).padStart(2, '0');
  return {
    periodLabel: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    periodStart: `${year}-${monthStr}-01`,
    periodEnd: `${year}-${monthStr}-${lastDay}`
  };
}

export const SalaryManagement: React.FC = () => {
  const { user } = useAuth();
  const { categorySlug } = useParams<{ categorySlug?: string }>();
  const navigate = useNavigate();

  const activeCategory =
    SALARY_NAV_CATEGORIES.find(c => c.slug === (categorySlug || 'overview')) || SALARY_NAV_CATEGORIES[0];

  const [viewMode, setViewMode] = useState<'records' | 'structures'>('records');
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [editingStruct, setEditingStruct] = useState<any>(null);
  const [kpis, setKpis] = useState<any>({});
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [staffList, setStaffList] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedRecord, setSelectedRecord] = useState<SalaryRecord | null>(null);
  const [showPrepareModal, setShowPrepareModal] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const defaultPeriod = getCurrentMonthPayrollPeriod();
  const [prepareForm, setPrepareForm] = useState({
    employeeId: '',
    periodLabel: defaultPeriod.periodLabel,
    periodStart: defaultPeriod.periodStart,
    periodEnd: defaultPeriod.periodEnd,
    incentives: '0',
    bonus: '0',
    overtime: '0',
    advanceRecovery: '0',
    unpaidLeaveDeduction: '0'
  });

  const loadData = async (targetPage = page) => {
    try {
      setLoading(true);
      setLoadError(null);
      const q = new URLSearchParams();
      q.append('salaryCategory', activeCategory.key);
      q.append('page', String(targetPage));
      q.append('limit', String(limit));
      if (search) q.append('search', search);
      if (statusFilter && statusFilter !== 'All') q.append('status', statusFilter);

      const [recRes, kpiRes, structRes] = await Promise.all([
        apiFetch<any>(`/salary/records?${q.toString()}`),
        apiFetch('/salary/kpis'),
        apiFetch<any[]>('/salary/structures')
      ]);
      if (recRes.success) {
        setRecords(recRes.data || []);
        setCategoryCounts(recRes.categoryCounts || {});
        setTotal(recRes.total ?? (recRes.data || []).length);
        setTotalPages(recRes.totalPages ?? 1);
      } else {
        setLoadError(recRes.message || 'Failed to load salary records.');
      }
      if (kpiRes.success) setKpis(kpiRes.data || {});
      if (structRes.success) setStructures(structRes.data || []);

      if (user?.role === 'overall_lead' || user?.role.includes('payment')) {
        const sRes = await apiFetch<Employee[]>('/staff');
        if (sRes.success) setStaffList(sRes.data || []);
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load payroll records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setViewMode('records');
    setPage(1);
    loadData(1);
  }, [user, activeCategory.key, limit, statusFilter]);

  const handlePrepareSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorAlert(null);
    try {
      const res = await apiFetch('/salary/prepare', {
        method: 'POST',
        body: JSON.stringify({
          ...prepareForm,
          incentives: Number(prepareForm.incentives || 0),
          bonus: Number(prepareForm.bonus || 0),
          overtime: Number(prepareForm.overtime || 0),
          advanceRecovery: Number(prepareForm.advanceRecovery || 0),
          unpaidLeaveDeduction: Number(prepareForm.unpaidLeaveDeduction || 0)
        })
      });
      setFeedback(res.message || 'Salary prepared and submitted for Overall Team Lead approval.');
      setShowPrepareModal(false);
      await loadData();
    } catch (err: any) {
      setErrorAlert(err.message);
    }
  };

  const handleDepartmentReview = async (salaryId: string) => {
    setErrorAlert(null);
    try {
      const res = await apiFetch(`/salary/records/${salaryId}/dept-review`, {
        method: 'POST',
        body: JSON.stringify({ notes: `Attendance & output verified by ${user?.name}` })
      });
      setFeedback(res.message || 'Department review recorded.');
      setSelectedRecord(res.data);
      await loadData();
    } catch (err: any) {
      setErrorAlert(err.message);
    }
  };

  const handleSaveStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStruct) return;
    setErrorAlert(null);
    try {
      const res = await apiFetch(`/salary/structures/${editingStruct.employeeId}`, {
        method: 'PUT',
        body: JSON.stringify({
          salaryCycle: editingStruct.salaryCycle,
          basicSalary: Number(editingStruct.basicSalary || 0),
          hra: Number(editingStruct.hra || 0),
          otherAllowances: Number(editingStruct.otherAllowances || 0),
          pfDeduction: Number(editingStruct.pfDeduction || 0),
          taxDeduction: Number(editingStruct.taxDeduction || 0)
        })
      });
      setFeedback(res.message || 'Salary structure updated.');
      setEditingStruct(null);
      await loadData();
    } catch (err: any) {
      setErrorAlert(err.message);
    }
  };

  const handleOverallApproval = async (salaryId: string, decision: 'APPROVE' | 'REJECT') => {
    setErrorAlert(null);
    try {
      const res = await apiFetch(`/salary/records/${salaryId}/review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          reason: decision === 'REJECT' ? 'Payroll review adjustments needed' : undefined
        })
      });
      setFeedback(res.message || `Salary ${decision.toLowerCase()}d.`);
      setSelectedRecord(null);
      await loadData();
    } catch (err: any) {
      setErrorAlert(err.message);
    }
  };

  const handleDisburseSalary = async (salaryId: string) => {
    setErrorAlert(null);
    try {
      const res = await apiFetch(`/salary/records/${salaryId}/disburse`, {
        method: 'POST',
        body: JSON.stringify({ paymentMethod: 'Direct Bank Deposit' })
      });
      setFeedback(res.message || 'Salary disbursed and paid.');
      setSelectedRecord(null);
      await loadData();
    } catch (err: any) {
      setErrorAlert(err.message);
    }
  };

  const isOverallLead = user?.role === 'overall_lead';
  const isPaymentTeam = isOverallLead || user?.role.includes('payment');

  return (
    <div className="space-y-5">
      {/* Independent Payroll Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Salary Management — {activeCategory.label}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {activeCategory.description}. Workflow: Prepared → Submitted → Overall Team Lead Approval → Processing → Paid / Failed.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              onClick={() => setViewMode('records')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                viewMode === 'records' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Payroll View ({total})
            </button>
            <button
              onClick={() => setViewMode('structures')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                viewMode === 'structures' ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Structures ({structures.length})
            </button>
          </div>

          {isPaymentTeam && (
            <button
              onClick={() => setShowPrepareModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Prepare Payroll Statement</span>
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 text-xs text-emerald-800 dark:text-emerald-200">
          <span className="font-semibold">{feedback}</span>
          <button onClick={() => setFeedback(null)} className="font-bold underline">Dismiss</button>
        </div>
      )}

      {errorAlert && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 text-xs text-rose-800 dark:text-rose-200">
          <span className="font-semibold">{errorAlert}</span>
          <button onClick={() => setErrorAlert(null)} className="font-bold underline">Dismiss</button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Monthly Commitment"
          value={`₹${(kpis.totalMonthlyCommitment || 0).toLocaleString()}`}
          subtitle={`${kpis.monthlyCount || 0} Monthly Statements`}
          icon={Banknote}
          variant="indigo"
          onClick={() => setStatusFilter('All')}
          isActive={statusFilter === 'All'}
        />
        <StatCard
          title="Weekly Commitment"
          value={`₹${(kpis.totalWeeklyCommitment || 0).toLocaleString()}`}
          subtitle={`${kpis.weeklyCount || 0} Weekly Statements`}
          icon={Clock}
          variant="sky"
          onClick={() => setStatusFilter(statusFilter === 'Weekly' ? 'All' : 'Weekly')}
          isActive={statusFilter === 'Weekly'}
        />
        <StatCard
          title="Pending Overall Approval"
          value={`₹${(kpis.totalPendingApproval || 0).toLocaleString()}`}
          subtitle={`${kpis.pendingRecordsCount || 0} Awaiting Sign-off | ${kpis.approvedRecordsCount || 0} Approved (₹${(kpis.totalApproved || 0).toLocaleString()})`}
          icon={Lock}
          variant="amber"
          onClick={() => setStatusFilter(statusFilter === 'Pending' ? 'All' : 'Pending')}
          isActive={statusFilter === 'Pending'}
        />
        <StatCard
          title="Total Salaries Paid"
          value={`₹${(kpis.totalPaid || 0).toLocaleString()}`}
          subtitle={`${kpis.paidRecordsCount || 0} Disbursed | Excluded from Payment Expenses`}
          icon={CheckCircle2}
          variant="emerald"
          onClick={() => setStatusFilter(statusFilter === 'Paid' ? 'All' : 'Paid')}
          isActive={statusFilter === 'Paid'}
        />
      </div>

      <ErrorBanner message={loadError} onRetry={() => loadData(page)} />

      {/* Search Bar */}
      {viewMode === 'records' && (
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadData(1)}
              placeholder="Search by Salary ID, Employee Name, Employee ID or Period..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="button"
            onClick={() => { setPage(1); loadData(1); }}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
          >
            Search
          </button>
        </div>
      )}

      {/* Main Content: Salary Statements vs Configurable Salary Structures */}
      {loading ? (
        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
      ) : viewMode === 'structures' ? (
        <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Employee</th>
                  <th className="py-3.5 px-4">Cycle</th>
                  <th className="py-3.5 px-4">Basic / HRA</th>
                  <th className="py-3.5 px-4">Gross Salary</th>
                  <th className="py-3.5 px-4">Net Payable</th>
                  <th className="py-3.5 px-5 text-right">Config</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {structures.map((st) => (
                  <tr key={st.employeeId}>
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900 dark:text-white">{st.employeeName}</div>
                      <div className="text-[11px] text-slate-400">{st.employeeId} • {st.department}</div>
                    </td>
                    <td className="py-3.5 px-4"><Badge variant="info">{st.salaryCycle}</Badge></td>
                    <td className="py-3.5 px-4">₹{st.basicSalary?.toLocaleString()} / ₹{st.hra?.toLocaleString()}</td>
                    <td className="py-3.5 px-4 font-semibold text-emerald-600">₹{st.grossSalary?.toLocaleString()}</td>
                    <td className="py-3.5 px-4 font-extrabold">₹{st.netPayable?.toLocaleString()}</td>
                    <td className="py-3.5 px-5 text-right">
                      {isPaymentTeam ? (
                        <button
                          onClick={() => setEditingStruct(st)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 font-semibold"
                        >
                          Edit Structure
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          {st.status || 'Active Config'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : records.length === 0 ? (
        <EmptyState title="No Salary Statements" description="No payroll records found for your role scope." icon={Banknote} />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Salary ID & Employee</th>
                  <th className="py-3.5 px-4">Period & Cycle</th>
                  <th className="py-3.5 px-4">Gross / Deductions</th>
                  <th className="py-3.5 px-4">Net Payable</th>
                  <th className="py-3.5 px-4">Approval Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {records.map(rec => (
                  <tr key={rec._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900 dark:text-white">{rec.employeeName}</div>
                      <div className="text-[11px] font-mono text-slate-400">{rec.salaryId} | {rec.department}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold">{rec.periodLabel}</div>
                      <div className="text-[10px] text-slate-400">{rec.salaryCycle} Cycle</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-emerald-600">₹{rec.earnings.gross.toLocaleString()}</div>
                      <div className="text-[11px] text-rose-500">-₹{rec.deductions.total.toLocaleString()}</div>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-900 dark:text-white">
                      ₹{rec.netSalary.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          rec.status === 'Paid' || rec.status === 'Approved'
                            ? 'success'
                            : rec.status === 'Rejected'
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {rec.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-5 text-right space-x-2">
                      <button
                        onClick={() => setSelectedRecord(rec)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Payslip & Gate</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={page}
            limit={limit}
            total={total}
            totalPages={totalPages}
            onPageChange={next => {
              setPage(next);
              loadData(next);
            }}
            onLimitChange={setLimit}
          />
        </div>
      )}

      {/* Prepare Payroll Modal */}
      <Modal
        isOpen={showPrepareModal}
        onClose={() => setShowPrepareModal(false)}
        title="Prepare Employee Salary Statement"
        subtitle="Automatically routed to Overall Team Lead for final sign-off"
        maxWidth="lg"
      >
        <form onSubmit={handlePrepareSalary} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block font-bold mb-1">Select Employee *</label>
              <select
                required
                value={prepareForm.employeeId}
                onChange={e => setPrepareForm({ ...prepareForm, employeeId: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
              >
                <option value="">-- Choose Employee --</option>
                {staffList.map(emp => (
                  <option key={emp.employeeId} value={emp.employeeId}>
                    {emp.name} ({emp.employeeId} - {emp.department})
                  </option>
                ))}
              </select>
            </div>
            {/* Custom / Weekly / Monthly Period Dates */}
            <div>
              <label className="block font-bold mb-1">Period Start *</label>
              <input
                type="date"
                required
                value={prepareForm.periodStart}
                onChange={e => setPrepareForm({ ...prepareForm, periodStart: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Period End *</label>
              <input
                type="date"
                required
                value={prepareForm.periodEnd}
                onChange={e => setPrepareForm({ ...prepareForm, periodEnd: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Period Label *</label>
              <input
                type="text"
                required
                value={prepareForm.periodLabel}
                onChange={e => setPrepareForm({ ...prepareForm, periodLabel: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Incentives (₹)</label>
              <input
                type="number"
                value={prepareForm.incentives}
                onChange={e => setPrepareForm({ ...prepareForm, incentives: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Bonus (₹)</label>
              <input
                type="number"
                value={prepareForm.bonus}
                onChange={e => setPrepareForm({ ...prepareForm, bonus: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Advance Recovery (₹)</label>
              <input
                type="number"
                value={prepareForm.advanceRecovery}
                onChange={e => setPrepareForm({ ...prepareForm, advanceRecovery: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowPrepareModal(false)} className="px-4 py-2">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold">
              Generate & Submit for Approval
            </button>
          </div>
        </form>
      </Modal>

      {/* Payslip & Overall Approval Gate Modal */}
      <Modal
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        title={`Salary Statement & Payslip: ${selectedRecord?.employeeName}`}
        subtitle={`${selectedRecord?.salaryId} | Period: ${selectedRecord?.periodLabel}`}
        maxWidth="lg"
      >
        {selectedRecord && (
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40">
              <div>
                <div className="font-bold text-emerald-600 uppercase text-[10px] mb-2">Earnings Breakdown</div>
                <div className="flex justify-between py-1"><span>Basic Salary</span><span className="font-semibold">₹{selectedRecord.earnings.basic.toLocaleString()}</span></div>
                <div className="flex justify-between py-1"><span>HRA</span><span className="font-semibold">₹{selectedRecord.earnings.hra.toLocaleString()}</span></div>
                <div className="flex justify-between py-1"><span>Allowances</span><span className="font-semibold">₹{selectedRecord.earnings.allowances.toLocaleString()}</span></div>
                <div className="flex justify-between py-1"><span>Incentives & Bonus</span><span className="font-semibold">₹{(selectedRecord.earnings.incentives + selectedRecord.earnings.bonus).toLocaleString()}</span></div>
                <div className="flex justify-between pt-2 border-t font-bold"><span>Gross Salary</span><span>₹{selectedRecord.earnings.gross.toLocaleString()}</span></div>
              </div>

              <div>
                <div className="font-bold text-rose-600 uppercase text-[10px] mb-2">Deductions</div>
                <div className="flex justify-between py-1"><span>Provident Fund (PF)</span><span className="font-semibold">₹{selectedRecord.deductions.pf.toLocaleString()}</span></div>
                <div className="flex justify-between py-1"><span>ESI</span><span className="font-semibold">₹{selectedRecord.deductions.esi.toLocaleString()}</span></div>
                <div className="flex justify-between py-1"><span>Professional / Tax</span><span className="font-semibold">₹{selectedRecord.deductions.tax.toLocaleString()}</span></div>
                <div className="flex justify-between py-1"><span>Advance Recovery</span><span className="font-semibold">₹{selectedRecord.deductions.advanceRecovery.toLocaleString()}</span></div>
                <div className="flex justify-between pt-2 border-t font-bold"><span>Total Deductions</span><span>₹{selectedRecord.deductions.total.toLocaleString()}</span></div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase text-indigo-600">Net Payable Amount</div>
                <div className="text-xl font-black text-indigo-900 dark:text-white">
                  ₹{selectedRecord.netSalary.toLocaleString()}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Bank Account: {selectedRecord.bankDetails.bankName} ({selectedRecord.bankDetails.accountNumberMasked})
                </div>
              </div>
              <Badge variant={selectedRecord.status === 'Paid' ? 'success' : 'warning'}>
                {selectedRecord.status}
              </Badge>
            </div>

            {/* Authorization Chain */}
            <div className="space-y-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px]">
              <div className="flex items-center justify-between">
                <span>
                  Prepared By:{' '}
                  <span className="font-bold">{selectedRecord.preparedBy.name}</span>
                  {selectedRecord.preparedBy.userId && (
                    <span className="font-mono text-[10px] text-slate-400 ml-1">
                      ({selectedRecord.preparedBy.userId})
                    </span>
                  )}
                  {selectedRecord.preparedBy.at && (
                    <span className="text-slate-400 ml-1">
                      • {new Date(selectedRecord.preparedBy.at).toLocaleDateString()}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Payslip
                </button>
              </div>
              {selectedRecord.departmentReviewedBy?.name ? (
                <div className="text-sky-600 font-semibold">
                  Dept Reviewed By: {selectedRecord.departmentReviewedBy.name}
                  {selectedRecord.departmentReviewedBy.userId && (
                    <span className="font-mono text-[10px] ml-1">
                      ({selectedRecord.departmentReviewedBy.userId})
                    </span>
                  )}
                  {selectedRecord.departmentReviewedBy.notes && (
                    <span> — {selectedRecord.departmentReviewedBy.notes}</span>
                  )}
                </div>
              ) : (user?.role.includes('lead') && selectedRecord.status === 'Submitted for Overall Approval' && (
                <button
                  type="button"
                  onClick={() => handleDepartmentReview(selectedRecord.salaryId)}
                  className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 font-bold"
                >
                  Add Department Lead Review Sign-off
                </button>
              ))}
              {selectedRecord.approvedByOverallLead ? (
                <div className="text-emerald-600 font-bold">
                  Approved By Overall Lead: {selectedRecord.approvedByOverallLead.name}
                  {selectedRecord.approvedByOverallLead.userId && (
                    <span className="font-mono text-[10px] ml-1">
                      ({selectedRecord.approvedByOverallLead.userId})
                    </span>
                  )}
                  {selectedRecord.approvedByOverallLead.at && (
                    <span className="text-slate-400 font-normal ml-1">
                      • {new Date(selectedRecord.approvedByOverallLead.at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-amber-600 font-bold flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Strict Gate: Requires Overall Team Lead Approval</span>
                </div>
              )}
              {selectedRecord.paidDetails && (
                <div className="text-indigo-600 font-bold">
                  Paid By: {selectedRecord.paidDetails.paidByName} (Txn: {selectedRecord.paidDetails.transactionId})
                  {selectedRecord.paidDetails.paymentDate && (
                    <span className="text-slate-400 font-normal ml-1">
                      • {new Date(selectedRecord.paidDetails.paymentDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Approval & Disbursement Controls */}
            {selectedRecord.status === 'Submitted for Overall Approval' && (
              <div className="pt-2">
                {isOverallLead ? (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleOverallApproval(selectedRecord.salaryId, 'REJECT')}
                      className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
                    >
                      Reject Payroll
                    </button>
                    <button
                      onClick={() => handleOverallApproval(selectedRecord.salaryId, 'APPROVE')}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md"
                    >
                      Final Approve (Overall Lead)
                    </button>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-amber-800 dark:text-amber-300 font-semibold text-center">
                    Only the Overall Team Lead can provide final payroll approval.
                  </div>
                )}
              </div>
            )}

            {selectedRecord.status === 'Approved' && isPaymentTeam && (
              <button
                onClick={() => handleDisburseSalary(selectedRecord.salaryId)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md"
              >
                Disburse & Mark Salary Paid
              </button>
            )}
          </div>
        )}
      </Modal>

      {/* Edit Salary Structure Modal */}
      <Modal
        isOpen={!!editingStruct}
        onClose={() => setEditingStruct(null)}
        title={`Edit Salary Structure: ${editingStruct?.employeeName}`}
        subtitle={editingStruct?.employeeId}
        maxWidth="md"
      >
        {editingStruct && (
          <form onSubmit={handleSaveStructure} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold mb-1">Salary Cycle</label>
              <select
                value={editingStruct.salaryCycle}
                onChange={(e) => setEditingStruct({ ...editingStruct, salaryCycle: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
              >
                <option value="Monthly">Monthly</option>
                <option value="Weekly">Weekly</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1">Basic Salary (₹)</label>
                <input
                  type="number"
                  value={editingStruct.basicSalary}
                  onChange={(e) => setEditingStruct({ ...editingStruct, basicSalary: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">HRA (₹)</label>
                <input
                  type="number"
                  value={editingStruct.hra}
                  onChange={(e) => setEditingStruct({ ...editingStruct, hra: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Other Allowances (₹)</label>
                <input
                  type="number"
                  value={editingStruct.otherAllowances}
                  onChange={(e) => setEditingStruct({ ...editingStruct, otherAllowances: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">PF + Tax Deduction (₹)</label>
                <input
                  type="number"
                  value={editingStruct.pfDeduction}
                  onChange={(e) => setEditingStruct({ ...editingStruct, pfDeduction: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingStruct(null)} className="px-4 py-2">Cancel</button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold">
                Save Structure
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

