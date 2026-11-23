import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Download,
  ShieldCheck,
  CreditCard,
  MessageSquare,
  Users,
  CheckCircle2,
  Clock,
  Layers,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../../components/common/Badge';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const ReportsManagement: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'KYC' | 'PAYMENT' | 'QUERIES' | 'STAFF'>(
    user?.role === 'payment_lead' ? 'PAYMENT' : user?.role === 'queries_lead' ? 'QUERIES' : 'KYC'
  );
  const [kycReport, setKycReport] = useState<any>(null);
  const [payReport, setPayReport] = useState<any>(null);
  const [queryReport, setQueryReport] = useState<any>(null);
  const [staffReport, setStaffReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role === 'payment_lead' && activeTab === 'KYC') {
      setActiveTab('PAYMENT');
    } else if (user?.role === 'queries_lead' && activeTab === 'KYC') {
      setActiveTab('QUERIES');
    }
  }, [user?.role]);

  const loadReports = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const isOverall = user?.role === 'overall_lead';
      const isLead = isOverall || (user?.role && user.role.includes('lead'));

      const tasks: Promise<void>[] = [];

      if (isOverall || user?.role === 'kyc_lead') {
        tasks.push(
          apiFetch<any>('/reports/kyc').then((r) => {
            if (r.success) setKycReport(r.data);
          })
        );
      }
      if (isOverall || user?.role === 'payment_lead') {
        tasks.push(
          apiFetch<any>('/reports/payment').then((r) => {
            if (r.success) setPayReport(r.data);
          })
        );
      }
      if (isOverall || user?.role === 'queries_lead') {
        tasks.push(
          apiFetch<any>('/reports/queries').then((r) => {
            if (r.success) setQueryReport(r.data);
          })
        );
      }
      if (isLead) {
        tasks.push(
          apiFetch<any>('/reports/staff').then((r) => {
            if (r.success) setStaffReport(r.data);
          })
        );
      }

      await Promise.allSettled(tasks);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load analytics reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [user]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/reports/export-csv?module=${activeTab.toLowerCase()}`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : ''
        }
      });
      if (!res.ok) throw new Error('Failed to download CSV export');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `connect_backoffice_${activeTab.toLowerCase()}_records_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Error exporting CSV report.');
    } finally {
      setExporting(false);
    }
  };

  const isOverall = user?.role === 'overall_lead';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Enterprise Reports & Analytics
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Role-authorized operational intelligence across KYC, Financial Ledgers, Support Queries, and Staff.
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-md transition-all"
        >
          {exporting ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>{exporting ? 'Exporting...' : 'Export Row-Level CSV'}</span>
        </button>
      </div>

      <ErrorBanner message={loadError} onRetry={loadReports} />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto">
        {(isOverall || user?.role === 'kyc_lead') && (
          <button
            onClick={() => setActiveTab('KYC')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'KYC'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            KYC Processing
          </button>
        )}
        {(isOverall || user?.role === 'payment_lead') && (
          <button
            onClick={() => setActiveTab('PAYMENT')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'PAYMENT'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Financial & Liabilities
          </button>
        )}
        {(isOverall || user?.role === 'queries_lead') && (
          <button
            onClick={() => setActiveTab('QUERIES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'QUERIES'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Query Resolution
          </button>
        )}
        {(isOverall || user?.role?.includes('lead')) && (
          <button
            onClick={() => setActiveTab('STAFF')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'STAFF'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Staff Performance
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : activeTab === 'KYC' && kycReport ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" /> KYC by Applicant Type
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kycReport.byApplicantType}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderRadius: '12px',
                      border: '1px solid #334155',
                      fontSize: '11px',
                      color: '#ffffff'
                    }}
                    itemStyle={{ color: '#ffffff', fontWeight: 600 }}
                    labelStyle={{ color: '#cbd5e1', fontWeight: 600 }}
                  />
                  <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold">KYC Status Breakdown</h3>
            <div className="space-y-3">
              {(kycReport.byStatus || []).map((s: any) => (
                <div key={s._id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                  <span className="font-bold">{s._id}</span>
                  <Badge variant="primary">{s.count} Requests</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : activeTab === 'PAYMENT' && payReport ? (
        <div className="space-y-6">
          {/* Payment Top KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-[10px] font-bold uppercase text-slate-400">Total Recognized Income</div>
              <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                ₹{(payReport.metrics?.totalRecognizedIncome || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Customer Orders, Bookings & Subs</div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-[10px] font-bold uppercase text-slate-400">Total Disbursed Outgoing</div>
              <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
                ₹{(payReport.metrics?.totalOutgoing || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Vendor settlements & partner payouts</div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-[10px] font-bold uppercase text-slate-400">Net Movement</div>
              <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
                ₹{(payReport.metrics?.netFinancialMovement || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Operating inflow vs outflow</div>
            </div>
            <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 shadow-sm">
              <div className="text-[10px] font-bold uppercase text-purple-600">Deposit Liability</div>
              <div className="text-xl font-extrabold text-purple-900 dark:text-purple-200 mt-1">
                ₹{(payReport.metrics?.liabilities?.outstandingAgentDepositLiability || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-purple-600 dark:text-purple-300 mt-0.5">Balance Sheet liability</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" /> Recognized Income Categories
              </h3>
              <div className="flex justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span>Customer Order Payments</span>
                <span className="font-bold">₹{(payReport.metrics?.incomeBreakdown?.customerOrderPayments || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span>Customer Booking Payments</span>
                <span className="font-bold">₹{(payReport.metrics?.incomeBreakdown?.customerBookingPayments || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span>Membership Revenue</span>
                <span className="font-bold">₹{(payReport.metrics?.incomeBreakdown?.membershipRevenue || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span>Vendor Subscriptions</span>
                <span className="font-bold">₹{(payReport.metrics?.incomeBreakdown?.vendorSubscriptionIncome || 0).toLocaleString()}</span>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-purple-600">Agent Deposit Liabilities (Balance Sheet)</h3>
              <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800">
                <div className="text-[10px] font-bold uppercase text-purple-600">Total Outstanding Deposit Liability</div>
                <div className="text-2xl font-black text-purple-900 dark:text-white mt-1">
                  ₹{(payReport.metrics?.liabilities?.outstandingAgentDepositLiability || 0).toLocaleString()}
                </div>
                <p className="text-[11px] text-purple-700 dark:text-purple-300 mt-1">
                  Confirmed Decision: Excluded from Total Recognized Income. Held as security deposit liabilities.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div className="text-[10px] font-bold uppercase text-slate-500">Maker-Checker Approvals Status</div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
                  Compliance verification active on all disbursements & refunds.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'QUERIES' && queryReport ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-sky-600" /> Source-wise Queries
            </h3>
            {(queryReport.bySource || []).map((s: any) => (
              <div key={s._id} className="flex justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span className="font-bold">{s._id}</span>
                <Badge variant="info">{s.count}</Badge>
              </div>
            ))}
          </div>
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="text-sm font-bold">Cross-Department Transfers</h3>
            <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200">
              <div className="text-2xl font-black text-sky-700 dark:text-sky-300">
                {queryReport.transferredCasesCount || 0} Shared Cases
              </div>
              <div className="text-[11px] text-sky-600 mt-1">
                All transferred queries maintain single linked history across source & destination teams.
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'STAFF' && staffReport ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-[10px] font-bold uppercase text-slate-400">Total Staff Registered</div>
              <div className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
                {staffReport.totalStaff ?? staffReport.totalEmployees ?? 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Across all departments</div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-[10px] font-bold uppercase text-slate-400">Active Staff</div>
              <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                {staffReport.activeCount ?? staffReport.activeEmployees ?? 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Active operational roster</div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-[10px] font-bold uppercase text-slate-400">On Leave / Inactive</div>
              <div className="text-2xl font-extrabold text-amber-500 mt-1">
                {staffReport.inactiveCount ?? staffReport.inactiveEmployees ?? 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Pending return or off-duty</div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-[10px] font-bold uppercase text-slate-400">Suspended Accounts</div>
              <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 mt-1">
                {staffReport.suspendedCount ?? staffReport.suspendedEmployees ?? 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Access restricted</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" /> Department Breakdown
              </h3>
              {(staffReport.byDepartment || staffReport.departmentBreakdown || []).map((d: any) => (
                <div key={d._id} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                  <span className="font-bold">{d._id}</span>
                  <Badge variant="primary">{d.count} Members</Badge>
                </div>
              ))}
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Role Distribution
              </h3>
              {(staffReport.byRole || staffReport.roleBreakdown || []).map((r: any) => (
                <div key={r._id} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                  <span className="font-bold font-mono">{r._id}</span>
                  <Badge variant="info">{r.count} Staff</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
