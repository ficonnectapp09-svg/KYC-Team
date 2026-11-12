import React, { useEffect, useState } from 'react';
import { BarChart3, Download, ShieldCheck, CreditCard, MessageSquare } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../../components/common/Badge';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const ReportsManagement: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'KYC' | 'PAYMENT' | 'QUERIES'>('KYC');
  const [kycReport, setKycReport] = useState<any>(null);
  const [payReport, setPayReport] = useState<any>(null);
  const [queryReport, setQueryReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReports = async () => {
      try {
        setLoading(true);
        const isOverall = user?.role === 'overall_lead';
        if (isOverall || user?.role === 'kyc_lead') {
          const r = await apiFetch('/reports/kyc');
          if (r.success) setKycReport(r.data);
        }
        if (isOverall || user?.role === 'payment_lead') {
          const r = await apiFetch('/reports/payment');
          if (r.success) setPayReport(r.data);
        }
        if (isOverall || user?.role === 'queries_lead') {
          const r = await apiFetch('/reports/queries');
          if (r.success) setQueryReport(r.data);
        }
      } catch (err) {
        console.error('Report load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, [user]);

  const handleExportCsv = () => {
    let csv = '';
    if (activeTab === 'PAYMENT' && payReport?.metrics) {
      const m = payReport.metrics;
      csv = `Metric,Amount\nRecognized Income,${m.totalRecognizedIncome}\nTotal Outgoing,${m.totalOutgoing}\nNet Financial Movement,${m.netFinancialMovement}\nAgent Deposit Liability,${m.liabilities?.outstandingAgentDepositLiability || 0}`;
    } else if (activeTab === 'KYC' && kycReport) {
      csv = `Category,Count\n` + (kycReport.byApplicantType || []).map((i: any) => `${i._id},${i.count}`).join('\n');
    } else if (activeTab === 'QUERIES' && queryReport) {
      csv = `Source,Count\n` + (queryReport.bySource || []).map((i: any) => `${i._id},${i.count}`).join('\n');
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `connect_backoffice_${activeTab.toLowerCase()}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Enterprise Reports & Analytics
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Role-authorized operational intelligence across KYC, Financial Ledgers, and Shared Support Queries.
          </p>
        </div>
        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV Report</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {(user?.role === 'overall_lead' || user?.role === 'kyc_lead') && (
          <button
            onClick={() => setActiveTab('KYC')}
            className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === 'KYC' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400'}`}
          >
            KYC Processing Reports
          </button>
        )}
        {(user?.role === 'overall_lead' || user?.role === 'payment_lead') && (
          <button
            onClick={() => setActiveTab('PAYMENT')}
            className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === 'PAYMENT' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400'}`}
          >
            Financial & Liability Reports
          </button>
        )}
        {(user?.role === 'overall_lead' || user?.role === 'queries_lead') && (
          <button
            onClick={() => setActiveTab('QUERIES')}
            className={`px-4 py-2 rounded-xl text-xs font-bold ${activeTab === 'QUERIES' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400'}`}
          >
            Query Resolution Reports
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
      ) : activeTab === 'KYC' && kycReport ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-indigo-600" /> KYC by Applicant Type</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kycReport.byApplicantType}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#4f46e5" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-bold">KYC Status Breakdown</h3>
            <div className="space-y-3">
              {kycReport.byStatus.map((s: any) => (
                <div key={s._id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                  <span className="font-bold">{s._id}</span>
                  <Badge variant="primary">{s.count} Requests</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : activeTab === 'PAYMENT' && payReport ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2"><CreditCard className="w-4 h-4 text-emerald-600" /> Recognized Income Categories</h3>
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
                Confirmed Decision: Excluded from Total Recognized Income.
              </p>
            </div>
          </div>
        </div>
      ) : activeTab === 'QUERIES' && queryReport ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2"><MessageSquare className="w-4 h-4 text-sky-600" /> Source-wise Queries</h3>
            {queryReport.bySource.map((s: any) => (
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
      ) : null}
    </div>
  );
};

