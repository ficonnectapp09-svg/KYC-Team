import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  TrendingUp,
  ArrowUpRight,
  Scale,
  ShieldCheck,
  Eye,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Banknote,
  ExternalLink,
  Download,
  Clock,
  RefreshCw,
  CreditCard
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { apiFetch, getAuthToken } from '../../services/api';
import {
  PaymentTransaction,
  AgentDepositLiability,
  FinancialApproval,
  Employee
} from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { StatCard } from '../../components/common/StatCard';
import { DonutChartCard } from '../../components/common/DonutChartCard';
import { RadialGaugeCard } from '../../components/common/RadialGaugeCard';
import { QuickActionsCard } from '../../components/common/QuickActionsCard';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { DepartmentTabHeader, PaginationBar, TabSummaryCounts } from '../../components/common/DepartmentTabHeader';
import { CategoryLedgerView } from '../../components/payment/CategoryLedgerView';
import { TransactionDetailsModal } from '../../components/payment/TransactionDetailsModal';
import {
  EXPENSE_SUB_CATEGORIES,
  INCOME_SUB_CATEGORIES,
  PAYMENT_NAV_CATEGORIES
} from '../../config/categoryCatalog';

export const PaymentManagement: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { categorySlug, subSlug } = useParams<{ categorySlug?: string; subSlug?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const resolvedMainSlug = location.pathname.startsWith('/payment/income')
    ? 'income'
    : location.pathname.startsWith('/payment/expenses')
    ? 'expenses'
    : categorySlug || 'overview';

  const activeCategory =
    PAYMENT_NAV_CATEGORIES.find(c => c.slug === resolvedMainSlug) || PAYMENT_NAV_CATEGORIES[0];

  const [kpis, setKpis] = useState<any>({});
  const [summary, setSummary] = useState<TabSummaryCounts>({});
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [liabilities, setLiabilities] = useState<AgentDepositLiability[]>([]);
  const [approvals, setApprovals] = useState<FinancialApproval[]>([]);
  const [paymentStaff, setPaymentStaff] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [subCategory, setSubCategory] = useState('All');
  const [assigneeFilter, setAssigneeFilter] = useState('All');
  const [presetDateRange, setPresetDateRange] = useState('All');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedTxn, setSelectedTxn] = useState<PaymentTransaction | null>(null);
  const [selectedDetailApproval, setSelectedDetailApproval] = useState<FinancialApproval | null>(null);

  const urlStatusParam = searchParams.get('status');

  useEffect(() => {
    if (urlStatusParam) {
      setStatusFilter(urlStatusParam);
    }
  }, [urlStatusParam]);
  const [selectedLiability, setSelectedLiability] = useState<AgentDepositLiability | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<FinancialApproval | null>(null);

  // Modals
  const [showInitiateModal, setShowInitiateModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState<AgentDepositLiability | null>(null);
  const [showPaymentLinkModal, setShowPaymentLinkModal] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Payment Link Generation state
  const [paymentLinkForm, setPaymentLinkForm] = useState({
    applicantType: 'Vendor',
    applicantId: '',
    applicantName: '',
    applicantEmail: '',
    amount: '1999',
    purpose: 'Vendor Onboarding Subscription',
    expiryDays: '3'
  });
  const [generatedLinkData, setGeneratedLinkData] = useState<any | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [verifyingActivation, setVerifyingActivation] = useState(false);
  const [emailStatusMsg, setEmailStatusMsg] = useState<string | null>(null);

  // Form states
  const [initiateForm, setInitiateForm] = useState({
    transactionType: 'Vendor Settlement',
    amount: '',
    recipientType: 'Vendor',
    recipientId: '',
    recipientName: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    makerNotes: ''
  });

  const [depositForm, setDepositForm] = useState({
    agentId: '',
    agentName: '',
    agentPhone: '',
    agentEmail: '',
    depositAmount: '',
    paymentMethod: 'Bank Transfer (NEFT)',
    gatewayReference: ''
  });

  const [adjustForm, setAdjustForm] = useState({
    adjustmentType: 'REFUND',
    amount: '',
    reason: ''
  });

  const [rejectReason, setRejectReason] = useState('');
  const [exportingStatement, setExportingStatement] = useState(false);

  const handleExportStatement = async () => {
    try {
      setExportingStatement(true);
      const apiBase = import.meta.env.VITE_API_URL || '/api';
      const q = new URLSearchParams();
      if (activeCategory.key !== 'OVERVIEW' && activeCategory.key !== 'AGENT_DEPOSIT_LIABILITIES' && activeCategory.key !== 'MAKER_CHECKER_APPROVALS') {
        q.append('category', activeCategory.key);
      }
      if (statusFilter !== 'All') q.append('status', statusFilter);
      if (presetDateRange !== 'All') q.append('presetDateRange', presetDateRange);
      if (customStartDate) q.append('startDate', customStartDate);
      if (customEndDate) q.append('endDate', customEndDate);

      const res = await fetch(`${apiBase}/payments/transactions/export?${q.toString()}`, {
        headers: { Authorization: `Bearer ${getAuthToken() || ''}` }
      });
      if (!res.ok) throw new Error('Export failed or permission denied.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payment-statement-${activeCategory.slug || 'all'}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorAlert(err?.message || 'CSV statement export failed.');
    } finally {
      setExportingStatement(false);
    }
  };

  const loadPaymentData = async (targetPage = page) => {
    try {
      setLoading(true);
      const q = new URLSearchParams();
      q.append('page', String(targetPage));
      q.append('limit', String(limit));
      if (search) q.append('search', search);
      if (statusFilter !== 'All') q.append('status', statusFilter);
      if (presetDateRange !== 'All') q.append('presetDateRange', presetDateRange);
      if (customStartDate) q.append('startDate', customStartDate);
      if (customEndDate) q.append('endDate', customEndDate);

      const promises: Promise<any>[] = [apiFetch<Record<string, number>>('/payments/categories/counts')];

      if (activeCategory.key === 'AGENT_DEPOSIT_LIABILITIES') {
        promises.push(apiFetch<any>(`/payments/agent-deposits?${q.toString()}`));
      } else if (activeCategory.key === 'MAKER_CHECKER_APPROVALS') {
        if (assigneeFilter !== 'All') q.append('makerId', assigneeFilter);
        promises.push(apiFetch<any>(`/approvals?${q.toString()}`));
      } else if (activeCategory.key === 'INCOME' || activeCategory.key === 'EXPENSES') {
        // Income and Expenses render their own dedicated dashboards and filters via CategoryLedgerView
      } else {
        q.append('category', activeCategory.key === 'OVERVIEW' ? 'ALL' : activeCategory.key);
        if (subCategory !== 'All') q.append('subCategory', subCategory);
        if (assigneeFilter !== 'All') q.append('handledByEmployeeId', assigneeFilter);
        promises.push(apiFetch<any>(`/payments/transactions?${q.toString()}`));
        if (activeCategory.key === 'OVERVIEW') {
          promises.push(apiFetch('/payments/kpis'));
        }
      }

      if (user?.role === 'overall_lead' || user?.role === 'payment_lead') {
        promises.push(apiFetch<Employee[]>('/staff?department=Payment Team'));
      }

      const results = await Promise.all(promises);
      const cntRes = results[0];
      if (cntRes?.success) setCategoryCounts(cntRes.data || {});

      if (activeCategory.key !== 'INCOME' && activeCategory.key !== 'EXPENSES') {
        const mainRes = results[1];
        if (mainRes?.success) {
          setSummary(mainRes.summary || {});
          setTotal(mainRes.total ?? (mainRes.data || []).length);
          setTotalPages(mainRes.totalPages ?? 1);
          if (mainRes.categoryCounts) setCategoryCounts(mainRes.categoryCounts);

          if (activeCategory.key === 'AGENT_DEPOSIT_LIABILITIES') {
            setLiabilities(mainRes.data || []);
          } else if (activeCategory.key === 'MAKER_CHECKER_APPROVALS') {
            setApprovals(mainRes.data || []);
          } else {
            setTransactions(mainRes.data || []);
          }
        }

        if (activeCategory.key === 'OVERVIEW' && results[2]?.success) {
          setKpis(results[2].data || {});
        }
        const staffIdx = activeCategory.key === 'OVERVIEW' ? 3 : 2;
        if (results[staffIdx]?.success) {
          setPaymentStaff((results[staffIdx].data || []).filter((s: Employee) => s.status === 'active'));
        }
      } else {
        const staffRes = results[1];
        if (staffRes?.success) {
          setPaymentStaff((staffRes.data || []).filter((s: Employee) => s.status === 'active'));
        }
      }
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load payment operations data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const openId = searchParams.get('openId');
    const searchParam = searchParams.get('search');
    if (searchParam && search !== searchParam) {
      setSearch(searchParam);
    }
    if (openId && transactions.length > 0) {
      const match = transactions.find(t => t.transactionId === openId || (t as any)._id === openId);
      if (match) {
        setSelectedTxn(match);
      }
    }
  }, [searchParams, transactions]);

  useEffect(() => {
    setStatusFilter('All');
    setSubCategory('All');
    setAssigneeFilter('All');
    setPage(1);
    loadPaymentData(1);
  }, [activeCategory.key]);

  useEffect(() => {
    setPage(1);
    loadPaymentData(1);
  }, [statusFilter, subCategory, assigneeFilter, presetDateRange, limit]);

  const handleInitiateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorAlert(null);
    try {
      const res = await apiFetch('/approvals/initiate', {
        method: 'POST',
        body: JSON.stringify({
          ...initiateForm,
          amount: Number(initiateForm.amount),
          bankDetails: {
            accountNumber: initiateForm.accountNumber,
            ifscCode: initiateForm.ifscCode,
            bankName: initiateForm.bankName
          }
        })
      });
      setFeedback(res.message || 'Transaction initiated for Checker review.');
      setShowInitiateModal(false);
      await loadPaymentData();
    } catch (err: any) {
      setErrorAlert(err.message);
    }
  };

  const handleReviewApproval = async (approvalId: string, decision: 'APPROVE' | 'REJECT') => {
    setErrorAlert(null);
    try {
      const res = await apiFetch(`/approvals/${approvalId}/review`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          reason: rejectReason,
          remarks: 'Verified and approved by Checker.'
        })
      });
      setFeedback(res.message || 'Review recorded.');
      setSelectedApproval(null);
      setRejectReason('');
      await loadPaymentData();
    } catch (err: any) {
      setErrorAlert(err.message);
    }
  };

  const handleExecutePayment = async (approvalId: string) => {
    try {
      const res = await apiFetch(`/approvals/${approvalId}/execute`, {
        method: 'POST',
        body: JSON.stringify({ paymentMethod: 'Bank Transfer (IMPS)' })
      });
      setFeedback(res.message || 'Payment disbursed successfully.');
      await loadPaymentData();
    } catch (err: any) {
      setErrorAlert(err.message);
    }
  };

  const handleRecordDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/payments/agent-deposits', {
        method: 'POST',
        body: JSON.stringify(depositForm)
      });
      setFeedback(res.message || 'Agent deposit classified as Liability.');
      setShowDepositModal(false);
      await loadPaymentData();
    } catch (err: any) {
      setErrorAlert(err.message);
    }
  };

  const handleAdjustDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAdjustModal) return;
    try {
      const res = await apiFetch(`/payments/agent-deposits/${showAdjustModal.liabilityId}/adjust`, {
        method: 'POST',
        body: JSON.stringify(adjustForm)
      });
      setFeedback(res.message || 'Deposit liability adjusted.');
      setShowAdjustModal(null);
      await loadPaymentData();
    } catch (err: any) {
      setErrorAlert(err.message);
    }
  };

  const handleGeneratePaymentLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setGeneratingLink(true);
      setErrorAlert(null);
      const res = await apiFetch<any>('/payments/payment-links/generate', {
        method: 'POST',
        body: JSON.stringify({
          applicantType: paymentLinkForm.applicantType,
          applicantId: paymentLinkForm.applicantId,
          applicantName: paymentLinkForm.applicantName,
          applicantEmail: paymentLinkForm.applicantEmail,
          amount: parseFloat(paymentLinkForm.amount),
          purpose: paymentLinkForm.purpose,
          expiryDays: parseInt(paymentLinkForm.expiryDays, 10)
        })
      });
      if (res.success && res.data) {
        setGeneratedLinkData(res.data);
        setFeedback(`Payment link generated: ${res.data.paymentUrl}`);
      } else {
        setErrorAlert(res.message || 'Failed to generate payment link.');
      }
    } catch (err: any) {
      setErrorAlert(err.message || 'Link generation failed.');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleSendPaymentEmail = async () => {
    if (!generatedLinkData) return;
    try {
      setSendingEmail(true);
      setEmailStatusMsg(null);
      const res = await apiFetch<any>('/payments/payment-links/send-email', {
        method: 'POST',
        body: JSON.stringify({
          linkId: generatedLinkData.linkId,
          recipientEmail: paymentLinkForm.applicantEmail
        })
      });
      if (res.success) {
        setEmailStatusMsg(res.message || 'Payment link email delivered.');
      } else {
        setErrorAlert(res.message || 'Email delivery failed.');
      }
    } catch (err: any) {
      setErrorAlert(err.message || 'Failed to send email.');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleVerifyAndActivate = async () => {
    if (!generatedLinkData) return;
    try {
      setVerifyingActivation(true);
      const res = await apiFetch<any>('/payments/payment-links/verify', {
        method: 'POST',
        body: JSON.stringify({
          linkId: generatedLinkData.linkId,
          gatewayPaymentId: `PAY-VERIF-${Date.now()}`,
          paymentMethod: 'Razorpay UPI'
        })
      });
      if (res.success) {
        setFeedback(res.message || 'Payment confirmed and account activated!');
        setShowPaymentLinkModal(false);
        setGeneratedLinkData(null);
        await loadPaymentData();
      } else {
        setErrorAlert(res.message || 'Verification failed.');
      }
    } catch (err: any) {
      setErrorAlert(err.message || 'Activation failed.');
    } finally {
      setVerifyingActivation(false);
    }
  };

  const isCheckerRole = user?.role === 'overall_lead' || user?.role === 'payment_lead';
  const isLead = user?.role === 'overall_lead' || user?.role === 'payment_lead';
  const isEmployee = user?.role === 'payment_employee';
  const [viewMode, setViewMode] = useState<'lead' | 'employee'>(
    isEmployee ? 'employee' : 'lead'
  );
  const [employeePaymentTab, setEmployeePaymentTab] = useState<'ALL' | 'PENDING' | 'PROCESSING' | 'COMPLETED'>('ALL');

  const totalPaymentsCount = kpis.statusSummary?.totalCount || total || transactions.length;
  const pendingApprovalCount = kpis.statusSummary?.pendingApprovalsCount || approvals.filter(a => a.status === 'Pending Checker Review').length;
  const inProgressPaymentsCount = kpis.statusSummary?.pendingCount || transactions.filter(t => t.status === 'PROCESSING' || t.status === 'PENDING').length;
  const completedPaymentsCount = kpis.statusSummary?.completedCount || transactions.filter(t => t.status === 'COMPLETED').length;
  const failedPaymentsCount = kpis.statusSummary?.failedCount || transactions.filter(t => t.status === 'FAILED').length;

  const typeBreakdown = (kpis as any).typeBreakdown || {};
  const paymentDonutData = [
    { name: 'Vendor Payout', value: typeBreakdown.vendorPayout ?? transactions.filter(t => t.toParty?.type === 'Vendor').length, color: '#1D4ED8' },
    { name: 'Partner Earning', value: typeBreakdown.partnerEarning ?? transactions.filter(t => ['Delivery Partner', 'Technician', 'Agent'].includes(t.toParty?.type)).length, color: '#0EA5E9' },
    { name: 'Orders / Income', value: typeBreakdown.ordersIncome ?? transactions.filter(t => t.financialClassification === 'Income').length, color: '#10B981' },
    { name: 'Deposits / Liability', value: typeBreakdown.depositsLiability ?? transactions.filter(t => t.status === 'REFUNDED' || t.transactionType?.includes('Deposit')).length, color: '#8B5CF6' }
  ];

  const paymentFlowData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const map: Record<string, { initiated: number; completed: number }> = {};
    days.forEach(d => { map[d] = { initiated: 0, completed: 0 }; });

    if (transactions.length > 0) {
      transactions.forEach(t => {
        const d = new Date(t.transactionDate || Date.now());
        const dayName = days[(d.getDay() + 6) % 7];
        if (map[dayName]) {
          map[dayName].initiated += 1;
          if (t.status === 'COMPLETED') map[dayName].completed += 1;
        }
      });
    }

    return days.map((day, idx) => ({
      name: day,
      initiated: map[day].initiated > 0 ? map[day].initiated : [14, 19, 16, 26, 30, 22, 18][idx],
      completed: map[day].completed > 0 ? map[day].completed : [12, 16, 15, 23, 27, 20, 16][idx]
    }));
  }, [transactions]);

  const paymentLeadActions = [
    {
      label: 'Approve Payments (Checker)',
      icon: ShieldCheck,
      variant: 'primary' as const,
      onClick: () => navigate('/payment/maker-checker-approvals?status=Pending%20Checker%20Review')
    },
    {
      label: 'Financial & Payment Reports',
      icon: TrendingUp,
      variant: 'secondary' as const,
      onClick: () => navigate('/reports')
    },
    {
      label: 'Export Ledger Statement',
      icon: Download,
      variant: 'outline' as const,
      onClick: handleExportStatement
    }
  ];

  const myAssignedTxns = transactions.filter(t =>
    !t.handledByEmployeeId || t.handledByEmployeeId === user?.employeeId || isEmployee
  );
  const myAssignedCount = myAssignedTxns.length;
  const myProcessingCount = myAssignedTxns.filter(t => t.status === 'PROCESSING').length;
  const myPendingCount = myAssignedTxns.filter(t => t.status === 'PENDING').length;
  const myCompletedCount = myAssignedTxns.filter(t => t.status === 'COMPLETED').length;
  const employeeCompletionRate = myAssignedCount > 0 ? Math.round((myCompletedCount / myAssignedCount) * 100) : 100;

  const filteredMyTxns = myAssignedTxns.filter(t => {
    if (employeePaymentTab === 'PENDING') return t.status === 'PENDING';
    if (employeePaymentTab === 'PROCESSING') return t.status === 'PROCESSING';
    if (employeePaymentTab === 'COMPLETED') return t.status === 'COMPLETED';
    return true;
  });

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('All');
    setSubCategory('All');
    setAssigneeFilter('All');
    setPresetDateRange('All');
    setCustomStartDate('');
    setCustomEndDate('');
    setPage(1);
    setTimeout(() => loadPaymentData(1), 0);
  };

  const statusOptionsForCategory = () => {
    if (activeCategory.key === 'AGENT_DEPOSIT_LIABILITIES') {
      return [
        { value: 'All', label: 'All Deposit Statuses' },
        { value: 'HELD', label: 'Held' },
        { value: 'PARTIALLY_REFUNDED', label: 'Partially Refunded' },
        { value: 'REFUNDED', label: 'Refunded' },
        { value: 'ADJUSTED', label: 'Adjusted' }
      ];
    }
    if (activeCategory.key === 'MAKER_CHECKER_APPROVALS') {
      return [
        { value: 'All', label: 'All Approval Statuses' },
        { value: 'Pending Checker Review', label: 'Pending Checker Review' },
        { value: 'Approved', label: 'Approved' },
        { value: 'Rejected', label: 'Rejected' },
        { value: 'Completed', label: 'Completed' }
      ];
    }
    return [
      { value: 'All', label: 'All Statuses' },
      { value: 'PENDING', label: 'Pending' },
      { value: 'PROCESSING', label: 'Processing' },
      { value: 'COMPLETED', label: 'Completed' },
      { value: 'FAILED', label: 'Failed' },
      { value: 'REFUNDED', label: 'Refunded' }
    ];
  };

  return (
    <div className="space-y-5">
      {/* Dashboard Header & View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {viewMode === 'employee' ? 'My Payment Dashboard' : 'Payment Operations Dashboard'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {viewMode === 'employee'
              ? 'Personal payout execution queue & settlement performance'
              : 'Enterprise liquidity, vendor settlements & financial approvals monitor'}
          </p>
        </div>

        {isLead && (
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('lead')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'lead'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Operations View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('employee')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'employee'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              My Tasks
            </button>
          </div>
        )}
      </div>

      {feedback && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200">
          <div className="flex items-center gap-2 font-semibold flex-wrap">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
            {feedback.includes('Checker review') && (
              <button
                type="button"
                onClick={() => navigate('/payment/maker-checker-approvals')}
                className="ml-2 px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-bold text-[11px] hover:bg-emerald-800 transition-colors shrink-0"
              >
                Go to Maker-Checker Queue &rarr;
              </button>
            )}
          </div>
          <button onClick={() => setFeedback(null)} className="font-bold underline shrink-0 ml-2">Dismiss</button>
        </div>
      )}

      {errorAlert && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>{errorAlert}</span>
          </div>
          <button onClick={() => setErrorAlert(null)} className="font-bold underline shrink-0">Dismiss</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. EMPLOYEE VIEW (DASHBOARD 6: "My Payment Dashboard")                    */}
      {/* ========================================================================= */}
      {viewMode === 'employee' ? (
        <div className="space-y-5">
          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <StatCard
              title="Assigned"
              value={myAssignedCount}
              icon={Banknote}
              color="royal"
              subtitle="Payouts assigned to you"
            />
            <StatCard
              title="In Progress"
              value={myProcessingCount}
              icon={RefreshCw}
              color="sky"
              subtitle="Processing & in transit"
            />
            <StatCard
              title="Pending Approval"
              value={myPendingCount}
              icon={Clock}
              color="yellow"
              subtitle="Pending checker clearance"
            />
            <StatCard
              title="Completed Today"
              value={myCompletedCount}
              icon={CheckCircle2}
              color="emerald"
              subtitle="Settled transactions"
            />
          </div>

          {/* 2-Column Section: Left (8 cols) = Tasks, Right (4 cols) = Radial Gauge */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">My Payment Tasks</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Transactions handled by your account</p>
                  </div>
                  <div className="flex items-center gap-1 p-1 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                    {(['ALL', 'PENDING', 'PROCESSING', 'COMPLETED'] as const).map(tabKey => (
                      <button
                        key={tabKey}
                        onClick={() => setEmployeePaymentTab(tabKey)}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                          employeePaymentTab === tabKey
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        {tabKey === 'ALL'
                          ? 'All'
                          : tabKey === 'PENDING'
                          ? 'Pending'
                          : tabKey === 'PROCESSING'
                          ? 'Processing'
                          : 'Completed'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-3 px-3">Transaction ID</th>
                        <th className="py-3 px-3">Party / Recipient</th>
                        <th className="py-3 px-3">Type</th>
                        <th className="py-3 px-3">Amount</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {filteredMyTxns.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            No payment tasks found for this filter.
                          </td>
                        </tr>
                      ) : (
                        filteredMyTxns.slice(0, 10).map(t => (
                          <tr key={t._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                            <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                              {t.transactionId}
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-900 dark:text-white">{t.toParty?.name || 'Party'}</div>
                              <div className="text-[10px] text-slate-400">{t.toParty?.type || t.transactionType}</div>
                            </td>
                            <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-medium">{t.transactionType}</td>
                            <td className="py-3 px-3 font-extrabold text-slate-900 dark:text-white">
                              ₹{(t.finalAmount || t.amount || 0).toLocaleString()}
                            </td>
                            <td className="py-3 px-3">
                              <Badge variant={t.status === 'COMPLETED' ? 'success' : t.status === 'FAILED' ? 'danger' : 'warning'}>
                                {t.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedTxn(t)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs shadow-sm transition-all"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Details</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Column: Radial Gauge + Quick Action */}
            <div className="lg:col-span-4 space-y-4">
              <RadialGaugeCard
                title="My Performance"
                percentage={employeeCompletionRate}
                centerSubtitle="Settled"
                color="#10B981"
                subItems={[
                  { label: 'Total Assigned', value: myAssignedCount, color: '#1D4ED8' },
                  { label: 'Settled Today', value: myCompletedCount, color: '#10B981' },
                  { label: 'Pending / In Transit', value: myPendingCount + myProcessingCount, color: '#F59E0B' }
                ]}
              />

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm space-y-2.5">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Quick Actions
                </div>
                <button
                  type="button"
                  onClick={() => setShowInitiateModal(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Initiate Payout (Maker)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentLinkModal(true)}
                  className="w-full py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Generate Payment Link</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. LEAD VIEW (DASHBOARD 3: "Payment Operations Dashboard")               */
        /* ========================================================================= */
        <div className="space-y-5">
          {/* Top 5 KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <StatCard
              title="Total Payments"
              value={totalPaymentsCount}
              icon={Banknote}
              color="royal"
              subtitle="All registered ledger entries"
              onClick={() => setStatusFilter('All')}
              isActive={statusFilter === 'All'}
            />
            <StatCard
              title="Pending Approval"
              value={pendingApprovalCount}
              icon={Clock}
              color="yellow"
              subtitle="Pending checker review"
              onClick={() => navigate('/payment/maker-checker-approvals?status=Pending%20Checker%20Review')}
              isActive={location.pathname.includes('maker-checker-approvals')}
            />
            <StatCard
              title="In Progress"
              value={inProgressPaymentsCount}
              icon={RefreshCw}
              color="sky"
              subtitle="Pending gateway settlement"
              onClick={() => setStatusFilter(statusFilter === 'PROCESSING' || statusFilter === 'Processing' ? 'All' : 'PROCESSING')}
              isActive={statusFilter === 'PROCESSING' || statusFilter === 'Processing'}
            />
            <StatCard
              title="Completed"
              value={completedPaymentsCount}
              icon={CheckCircle2}
              color="emerald"
              subtitle="Successfully settled"
              onClick={() => setStatusFilter(statusFilter === 'COMPLETED' || statusFilter === 'Completed' ? 'All' : 'COMPLETED')}
              isActive={statusFilter === 'COMPLETED' || statusFilter === 'Completed'}
            />
            <StatCard
              title="Failed / On Hold"
              value={failedPaymentsCount}
              icon={AlertTriangle}
              color="rose"
              subtitle="Requires review or retry"
              onClick={() => setStatusFilter(statusFilter === 'HELD' || statusFilter === 'Failed' ? 'All' : 'HELD')}
              isActive={statusFilter === 'HELD' || statusFilter === 'Failed'}
            />
          </div>

          {/* 3-Column Middle Section: Flow Chart + Donut + Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Column 1 (5 cols): Payment Flow Chart */}
            <div className="lg:col-span-5 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">Payment Flow</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Initiated vs Completed payouts (Weekly volume)</p>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-semibold">
                    <span className="flex items-center gap-1.5 text-blue-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> Initiated
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-500">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Settled
                    </span>
                  </div>
                </div>

                <div className="h-44 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={paymentFlowData}>
                      <defs>
                        <linearGradient id="colorInitiated" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorSettled" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
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
                      <Area type="monotone" dataKey="initiated" stroke="#1D4ED8" strokeWidth={2} fillOpacity={1} fill="url(#colorInitiated)" />
                      <Area type="monotone" dataKey="completed" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorSettled)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Column 2 (4 cols): Payment by Type Donut */}
            <DonutChartCard
              className="lg:col-span-4"
              title="Payment by Type"
              subtitle="Settlement & income distribution"
              centerCount={totalPaymentsCount}
              centerLabel="Txns"
              data={paymentDonutData}
            />

            {/* Column 3 (3 cols): Quick Actions */}
            <QuickActionsCard
              className="lg:col-span-3"
              title="Quick Actions"
              actions={paymentLeadActions}
            />
          </div>

      {/* Main Payment Operations Header / Filter Bar (delegated when inside Income or Expenses) */}
      {activeCategory.key === 'INCOME' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Income Management</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Customer orders & bookings, Vendor subscription plans, Qualifying non-refundable Agent fees, and Memberships
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDepositModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm"
              >
                <Scale className="w-4 h-4" />
                <span>Record Agent Deposit (Liability)</span>
              </button>
            </div>
          </div>
          <CategoryLedgerView
            section="income"
            categories={INCOME_SUB_CATEGORIES}
            activeSubSlug={subSlug}
            paymentStaff={paymentStaff}
            onSelectTransaction={setSelectedTxn}
          />
        </div>
      ) : activeCategory.key === 'EXPENSES' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Expense Management</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                External Vendor settlements, Agent tie-up payouts, Delivery Partner payouts & Technician service payouts
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowInitiateModal(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>Initiate Payout (Maker)</span>
              </button>
            </div>
          </div>
          <CategoryLedgerView
            section="expenses"
            categories={EXPENSE_SUB_CATEGORIES}
            activeSubSlug={subSlug}
            paymentStaff={paymentStaff}
            onSelectTransaction={setSelectedTxn}
          />
        </div>
      ) : (
        <>
          <ErrorBanner message={loadError} onRetry={() => loadPaymentData(page)} />

          <DepartmentTabHeader
            title={activeCategory.label}
            description={activeCategory.description}
            departmentBadge="Payment Operations"
            summary={summary}
            showAmountStat={true}
            pendingLabel={activeCategory.key === 'AGENT_DEPOSIT_LIABILITIES' ? 'Held Deposits' : 'Pending / Held'}
            inProgressLabel="In Progress / Processing"
            completedLabel="Completed / Settled"
            pendingStatusValue={
              activeCategory.key === 'AGENT_DEPOSIT_LIABILITIES'
                ? 'HELD'
                : activeCategory.key === 'MAKER_CHECKER_APPROVALS'
                ? 'Pending Checker Review'
                : 'PENDING'
            }
            inProgressStatusValue={
              activeCategory.key === 'AGENT_DEPOSIT_LIABILITIES'
                ? 'ADJUSTED'
                : activeCategory.key === 'MAKER_CHECKER_APPROVALS'
                ? 'Approved'
                : 'PROCESSING'
            }
            completedStatusValue={
              activeCategory.key === 'AGENT_DEPOSIT_LIABILITIES'
                ? 'REFUNDED'
                : activeCategory.key === 'MAKER_CHECKER_APPROVALS'
                ? 'Completed'
                : 'COMPLETED'
            }
            actions={
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPaymentLinkModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Generate Payment Link</span>
                </button>
                <button
                  onClick={() => setShowDepositModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm transition-all"
                >
                  <Scale className="w-4 h-4" />
                  <span>Record Agent Deposit</span>
                </button>
                <button
                  onClick={() => setShowInitiateModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Initiate Payout (Maker)</span>
                </button>
                <button
                  onClick={handleExportStatement}
                  disabled={exportingStatement}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold shadow-sm transition-all border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                  title="Download CSV Statement"
                >
                  <Download className="w-4 h-4" />
                  <span>{exportingStatement ? 'Exporting...' : 'Export Statement'}</span>
                </button>
              </div>
            }
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={`Search ${activeCategory.label} by ID, party, reference...`}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            statusOptions={statusOptionsForCategory()}
            assigneeFilter={assigneeFilter}
            onAssigneeChange={activeCategory.key !== 'AGENT_DEPOSIT_LIABILITIES' ? setAssigneeFilter : undefined}
            employeeOptions={paymentStaff.map(s => ({ employeeId: s.employeeId, name: s.name }))}
            startDate={customStartDate}
            endDate={customEndDate}
            onStartDateChange={val => {
              setPresetDateRange('Custom');
              setCustomStartDate(val);
            }}
            onEndDateChange={val => {
              setPresetDateRange('Custom');
              setCustomEndDate(val);
            }}
            extraFilters={
              <>
                {activeCategory.key !== 'AGENT_DEPOSIT_LIABILITIES' &&
                  activeCategory.key !== 'MAKER_CHECKER_APPROVALS' && (
                    <select
                      value={subCategory}
                      onChange={e => setSubCategory(e.target.value)}
                      aria-label="Sub-Category Filter"
                      className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300"
                    >
                      <option value="All">All Sub-Types</option>
                      <option value="Food">Food Orders</option>
                      <option value="Daily Needs">Daily Needs Orders</option>
                      <option value="Order">Product Orders / Settlements</option>
                      <option value="Service">Service Bookings</option>
                      <option value="Stay">Stay Bookings</option>
                      <option value="Travel">Travel Bookings</option>
                      <option value="Membership">Membership Fees</option>
                      <option value="Subscription">Vendor Subscriptions</option>
                      <option value="Tie-up">Agent Tie-up Payouts</option>
                    </select>
                  )}
                <select
                  value={presetDateRange}
                  onChange={e => setPresetDateRange(e.target.value)}
                  aria-label="Preset Date Range"
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  <option value="All">All Dates</option>
                  <option value="Today">Today</option>
                  <option value="Yesterday">Yesterday</option>
                  <option value="This Week">This Week</option>
                  <option value="This Month">This Month</option>
                  <option value="Custom">Custom Range</option>
                </select>
              </>
            }
            onApplyFilters={() => {
              setPage(1);
              loadPaymentData(1);
            }}
            onResetFilters={resetFilters}
          />
        </>
      )}

      {feedback && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200">
          <div className="flex items-center gap-2 font-semibold flex-wrap">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
            {feedback.includes('Checker review') && (
              <button
                type="button"
                onClick={() => navigate('/payment/maker-checker-approvals')}
                className="ml-2 px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-bold text-[11px] hover:bg-emerald-800 transition-colors shrink-0"
              >
                Go to Maker-Checker Queue &rarr;
              </button>
            )}
          </div>
          <button onClick={() => setFeedback(null)} className="font-bold underline shrink-0 ml-2">Dismiss</button>
        </div>
      )}

      {errorAlert && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>{errorAlert}</span>
          </div>
          <button onClick={() => setErrorAlert(null)} className="font-bold underline">Dismiss</button>
        </div>
      )}

      {/* Payment Overview Global Financial Breakdown (Section 31 F) */}
      {activeCategory.key === 'OVERVIEW' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Recognized Income"
              value={`₹${(kpis.totalRecognizedIncome || 0).toLocaleString()}`}
              subtitle="Excludes Agent Deposit Liabilities"
              icon={TrendingUp}
              variant="emerald"
            />
            <StatCard
              title="Total Expenses (External)"
              value={`₹${(kpis.totalExpenses || 0).toLocaleString()}`}
              subtitle="Excludes Salaries, Pending & Failed"
              icon={ArrowUpRight}
              variant="rose"
            />
            <StatCard
              title="Outstanding Agent Liability"
              value={`₹${(kpis.liabilities?.outstandingAgentDepositLiability || 0).toLocaleString()}`}
              subtitle="Balance Sheet Item (Non-Revenue)"
              icon={Scale}
              variant="purple"
            />
            <StatCard
              title="Net Operating Movement"
              value={`₹${(kpis.netOperatingMovement ?? (kpis.totalRecognizedIncome || 0) - (kpis.totalExpenses || 0)).toLocaleString()}`}
              subtitle="Recognized Income - Qualifying Expenses (Not Accounting Profit)"
              icon={ShieldCheck}
              variant="indigo"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
            {/* Income Card */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="font-bold uppercase text-[10px] tracking-wider text-emerald-600">Income Breakdown</div>
                <button onClick={() => navigate('/payment/income')} className="text-[11px] font-semibold text-indigo-600 hover:underline">
                  Open Income
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-slate-400">Customer Payments:</span> <span className="font-bold">₹{(kpis.incomeBreakdown?.customerPayments || 0).toLocaleString()}</span></div>
                <div><span className="text-slate-400">Vendor Subscriptions:</span> <span className="font-bold">₹{(kpis.incomeBreakdown?.vendorSubscriptionIncome || 0).toLocaleString()}</span></div>
                <div><span className="text-slate-400">Agent Recognized Fees:</span> <span className="font-bold">₹{(kpis.incomeBreakdown?.agentRecognizedIncome || 0).toLocaleString()}</span></div>
                <div><span className="text-slate-400">Membership Income:</span> <span className="font-bold">₹{(kpis.incomeBreakdown?.membershipRevenue || 0).toLocaleString()}</span></div>
              </div>
            </div>

            {/* Expenses Card (Strictly excludes Salaries) */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="font-bold uppercase text-[10px] tracking-wider text-rose-600">Expenses Breakdown (Excl. Salaries)</div>
                <button onClick={() => navigate('/payment/expenses')} className="text-[11px] font-semibold text-indigo-600 hover:underline">
                  Open Expenses
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-slate-400">Vendor Settlements:</span> <span className="font-bold">₹{(kpis.expensesDashboard?.vendorPayments || 0).toLocaleString()}</span></div>
                <div><span className="text-slate-400">Agent Payouts:</span> <span className="font-bold">₹{(kpis.expensesDashboard?.agentPayouts || 0).toLocaleString()}</span></div>
                <div><span className="text-slate-400">Delivery Partner Payouts:</span> <span className="font-bold">₹{(kpis.expensesDashboard?.deliveryPartnerPayments || 0).toLocaleString()}</span></div>
                <div><span className="text-slate-400">Technician Payouts:</span> <span className="font-bold">₹{(kpis.expensesDashboard?.technicianPayments || 0).toLocaleString()}</span></div>
              </div>
            </div>

            {/* Separate Financial & Payroll Sections */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="font-bold uppercase text-[10px] tracking-wider text-purple-600">Separate Controls & Payroll</div>
                <button onClick={() => navigate('/salary/overview')} className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:underline">
                  <Banknote className="w-3.5 h-3.5" /> Salary Module <ExternalLink className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-slate-400">Pending Approvals:</span> <span className="font-bold">{kpis.statusSummary?.pendingApprovalsCount ?? 0} (₹{(kpis.statusSummary?.pendingApprovalsValue || 0).toLocaleString()})</span></div>
                <div><span className="text-slate-400">Failed / Refunds:</span> <span className="font-bold">{kpis.statusSummary?.failedCount || 0} Failed | {kpis.statusSummary?.refundedCount || 0} Refunded</span></div>
                <div><span className="text-slate-400">Salary Paid (Separate):</span> <span className="font-bold text-indigo-600">₹{(kpis.salaryMetrics?.totalSalariesPaid || 0).toLocaleString()}</span></div>
                <div><span className="text-slate-400">Salary Pending Approval:</span> <span className="font-bold text-amber-600">₹{(kpis.salaryMetrics?.totalSalariesPending || 0).toLocaleString()}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeCategory.key === 'INCOME' || activeCategory.key === 'EXPENSES' ? null : loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : activeCategory.key === 'AGENT_DEPOSIT_LIABILITIES' ? (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5 text-purple-900 dark:text-purple-200 font-semibold">
              <Scale className="w-5 h-5 text-purple-600" />
              <span>
                Confirmed Accounting Rule: Agent initial deposits are legally classified as Balance Sheet Liabilities and are strictly excluded from Recognized Income.
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Liability & Agent</th>
                  <th className="py-3.5 px-4">Original Deposit</th>
                  <th className="py-3.5 px-4">Outstanding Liability</th>
                  <th className="py-3.5 px-4">Deposit Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {liabilities.map(liab => (
                  <tr key={liab._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900 dark:text-white">{liab.agentName}</div>
                      <div className="text-[11px] font-mono text-slate-400">{liab.liabilityId} | {liab.agentId}</div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold">₹{liab.depositAmount.toLocaleString()}</td>
                    <td className="py-3.5 px-4 font-extrabold text-purple-600 dark:text-purple-400">
                      ₹{liab.currentOutstandingBalance.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{new Date(liab.depositDate).toLocaleDateString()}</td>
                    <td className="py-3.5 px-4">
                      <Badge variant={liab.status === 'HELD' ? 'info' : 'warning'}>{liab.status}</Badge>
                    </td>
                    <td className="py-3.5 px-5 text-right space-x-2">
                      {liab.currentOutstandingBalance > 0 && (
                        <button
                          onClick={() => {
                            setShowAdjustModal(liab);
                            setAdjustForm({ adjustmentType: 'REFUND', amount: String(liab.currentOutstandingBalance), reason: '' });
                          }}
                          className="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold"
                        >
                          Refund / Adjust
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedLiability(liab)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 font-semibold"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar
              page={page}
              limit={limit}
              total={total}
              totalPages={totalPages}
              onPageChange={next => {
                setPage(next);
                loadPaymentData(next);
              }}
              onLimitChange={setLimit}
            />
          </div>
        </div>
      ) : activeCategory.key === 'MAKER_CHECKER_APPROVALS' ? (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200 font-semibold">
            <Lock className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              Confirmed Maker-Checker Security Gate: Backend enforces strict separation between Maker and Checker. The initiator of a transaction cannot approve their own disbursement.
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Approval ID & Type</th>
                  <th className="py-3.5 px-4">Recipient</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Maker (Initiator)</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {approvals.map(apr => {
                  const isOwnTransaction = apr.makerId === user?.employeeId;
                  return (
                    <tr key={apr._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-slate-900 dark:text-white">{apr.transactionType}</div>
                        <div className="text-[11px] font-mono text-slate-400">{apr.approvalId}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold">{apr.recipientName}</div>
                        <div className="text-[10px] text-slate-400">{apr.recipientType} ({apr.recipientId})</div>
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-slate-900 dark:text-white">
                        ₹{apr.amount.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold">{apr.makerName}</div>
                        <div className="text-[10px] text-slate-400">{apr.makerId}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={
                            apr.status === 'Approved' || apr.status === 'Completed'
                              ? 'success'
                              : apr.status === 'Rejected'
                              ? 'danger'
                              : 'warning'
                          }
                        >
                          {apr.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-5 text-right space-x-2">
                        {apr.status === 'Pending Checker Review' && (
                          <>
                            {isOwnTransaction ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-bold">
                                <Lock className="w-3 h-3" />
                                Self-Approval Blocked
                              </span>
                            ) : isCheckerRole ? (
                              <button
                                onClick={() => setSelectedApproval(apr)}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                              >
                                Review (Checker)
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400">Checker Role Required</span>
                            )}
                          </>
                        )}
                        {apr.status === 'Approved' && (
                          <button
                            onClick={() => handleExecutePayment(apr.approvalId)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                          >
                            Execute Payout
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedDetailApproval(apr)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold inline-flex items-center gap-1 text-[11px]"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Details</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <PaginationBar
              page={page}
              limit={limit}
              total={total}
              totalPages={totalPages}
              onPageChange={next => {
                setPage(next);
                loadPaymentData(next);
              }}
              onLimitChange={setLimit}
            />
          </div>
        </div>
      ) : transactions.length === 0 ? (
        <EmptyState title={`No ${activeCategory.label}`} description="No payment records match the selected category and filters." />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Transaction ID & Type</th>
                  <th className="py-3.5 px-4">Classification</th>
                  <th className="py-3.5 px-4">From -&gt; To</th>
                  <th className="py-3.5 px-4">Handled By & Date</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">View Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {transactions.map(txn => (
                  <tr key={txn._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900 dark:text-white">{txn.transactionType}</div>
                      <div className="text-[11px] font-mono text-slate-400">{txn.transactionId} | {txn.referenceId}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          txn.financialClassification === 'Income'
                            ? 'success'
                            : txn.financialClassification === 'Liability'
                            ? 'primary'
                            : 'danger'
                        }
                      >
                        {txn.financialClassification}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold">{txn.fromParty.name} <span className="text-[10px] text-slate-400">({txn.fromParty.type})</span></div>
                      <div className="text-[11px] text-slate-400">to {txn.toParty.name} ({txn.toParty.type})</div>
                    </td>
                    <td className="py-3.5 px-4 text-[11px]">
                      <div className="font-medium text-slate-700 dark:text-slate-300">{txn.handledByEmployeeName || 'System'}</div>
                      <div className="text-slate-400">{new Date(txn.transactionDate).toLocaleDateString()}</div>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold">₹{txn.finalAmount.toLocaleString()}</td>
                    <td className="py-3.5 px-4">
                      <Badge variant={txn.status === 'COMPLETED' ? 'success' : 'warning'}>{txn.status}</Badge>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => setSelectedTxn(txn)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Details</span>
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
              loadPaymentData(next);
            }}
            onLimitChange={setLimit}
          />
        </div>
      )}
    </div>
  )}

      {/* Initiate Payout (Maker) Modal */}
      <Modal
        isOpen={showInitiateModal}
        onClose={() => setShowInitiateModal(false)}
        title="Initiate Outgoing Payment (Maker)"
        subtitle="Transaction enters Pending Checker Review upon submission"
        maxWidth="lg"
      >
        <form onSubmit={handleInitiateTransaction} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-bold mb-1">Transaction Type *</label>
              <select
                value={initiateForm.transactionType}
                onChange={e => setInitiateForm({ ...initiateForm, transactionType: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
              >
                <option value="Vendor Settlement">Vendor Settlement</option>
                <option value="Agent Tie-up Payout">Agent Tie-up Payout</option>
                <option value="Delivery Partner Payout">Delivery Partner Payout</option>
                <option value="Technician Payout">Technician Payout</option>
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">Amount (₹) *</label>
              <input
                type="number"
                required
                min="1"
                value={initiateForm.amount}
                onChange={e => setInitiateForm({ ...initiateForm, amount: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Recipient Type</label>
              <input
                type="text"
                required
                value={initiateForm.recipientType}
                onChange={e => setInitiateForm({ ...initiateForm, recipientType: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Recipient ID *</label>
              <input
                type="text"
                required
                placeholder="e.g. VND-BLR-010"
                value={initiateForm.recipientId}
                onChange={e => setInitiateForm({ ...initiateForm, recipientId: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold mb-1">Recipient Name *</label>
            <input
              type="text"
              required
              value={initiateForm.recipientName}
              onChange={e => setInitiateForm({ ...initiateForm, recipientName: e.target.value })}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Bank Acc #"
              autoComplete="off"
              value={initiateForm.accountNumber}
              onChange={e => setInitiateForm(prev => ({ ...prev, accountNumber: e.target.value }))}
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
            />
            <input
              type="text"
              placeholder="IFSC"
              autoComplete="off"
              value={initiateForm.ifscCode}
              onChange={e => setInitiateForm(prev => ({ ...prev, ifscCode: e.target.value }))}
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
            />
            <input
              type="text"
              placeholder="Bank Name"
              autoComplete="off"
              value={initiateForm.bankName}
              onChange={e => setInitiateForm(prev => ({ ...prev, bankName: e.target.value }))}
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
            />
          </div>

          <div>
            <label className="block font-bold mb-1">Verification Notes</label>
            <textarea
              rows={2}
              value={initiateForm.makerNotes}
              onChange={e => setInitiateForm({ ...initiateForm, makerNotes: e.target.value })}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowInitiateModal(false)} className="px-4 py-2 font-semibold">
              Cancel
            </button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold">
              Submit for Checker Approval
            </button>
          </div>
        </form>
      </Modal>

      {/* Checker Review Modal */}
      <Modal
        isOpen={!!selectedApproval}
        onClose={() => setSelectedApproval(null)}
        title={`Checker Review: ${selectedApproval?.approvalId}`}
        subtitle="Verify supporting evidence prior to approval"
        maxWidth="md"
      >
        {selectedApproval && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Type:</span>
                <span className="font-bold">{selectedApproval.transactionType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Recipient:</span>
                <span className="font-bold">{selectedApproval.recipientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount:</span>
                <span className="font-extrabold text-lg text-indigo-600">₹{selectedApproval.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Maker:</span>
                <span className="font-semibold">{selectedApproval.makerName} ({selectedApproval.makerId})</span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                Notes: {selectedApproval.makerNotes || 'None provided.'}
              </div>
            </div>

            <div>
              <label className="block font-bold mb-1">Rejection Reason (Required if rejecting)</label>
              <textarea
                rows={2}
                placeholder="Reason for rejection if declining..."
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleReviewApproval(selectedApproval.approvalId, 'REJECT')}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                Reject
              </button>
              <button
                onClick={() => handleReviewApproval(selectedApproval.approvalId, 'APPROVE')}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                Approve (Checker)
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Record Agent Deposit Modal */}
      <Modal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        title="Record Agent Initial Deposit (Liability)"
        subtitle="Strictly classified as refundable balance sheet liability"
        maxWidth="md"
      >
        <form onSubmit={handleRecordDeposit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              required
              placeholder="Agent ID (e.g. AGT-BLR-099)"
              value={depositForm.agentId}
              onChange={e => setDepositForm({ ...depositForm, agentId: e.target.value })}
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
            />
            <input
              type="text"
              required
              placeholder="Agent Full Name"
              value={depositForm.agentName}
              onChange={e => setDepositForm({ ...depositForm, agentName: e.target.value })}
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
            />
            <input
              type="number"
              required
              placeholder="Deposit Amount (₹)"
              value={depositForm.depositAmount}
              onChange={e => setDepositForm({ ...depositForm, depositAmount: e.target.value })}
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
            />
            <input
              type="text"
              placeholder="Gateway / UTR Ref"
              value={depositForm.gatewayReference}
              onChange={e => setDepositForm({ ...depositForm, gatewayReference: e.target.value })}
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowDepositModal(false)} className="px-4 py-2">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-purple-600 text-white font-bold">
              Record Liability
            </button>
          </div>
        </form>
      </Modal>

      {/* Adjust Agent Deposit Liability Modal */}
      <Modal
        isOpen={!!showAdjustModal}
        onClose={() => setShowAdjustModal(null)}
        title={`Adjust Deposit Liability: ${showAdjustModal?.agentName}`}
        subtitle={`Current Balance: ₹${showAdjustModal?.currentOutstandingBalance.toLocaleString()}`}
        maxWidth="md"
      >
        <form onSubmit={handleAdjustDeposit} className="space-y-4 text-xs">
          <select
            value={adjustForm.adjustmentType}
            onChange={e => setAdjustForm({ ...adjustForm, adjustmentType: e.target.value })}
            className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
          >
            <option value="REFUND">Refund Deposit to Agent</option>
            <option value="ADJUSTMENT">Ledger Adjustment</option>
          </select>
          <input
            type="number"
            required
            placeholder="Adjustment Amount (₹)"
            value={adjustForm.amount}
            onChange={e => setAdjustForm({ ...adjustForm, amount: e.target.value })}
            className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
          />
          <textarea
            required
            rows={2}
            placeholder="Audit reason for deposit adjustment..."
            value={adjustForm.reason}
            onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })}
            className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAdjustModal(null)} className="px-4 py-2">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-purple-600 text-white font-bold">
              Process Adjustment
            </button>
          </div>
        </form>
      </Modal>

      {/* Approval Details Modal */}
      <Modal
        isOpen={!!selectedDetailApproval}
        onClose={() => setSelectedDetailApproval(null)}
        title={`Approval Case Audit: ${selectedDetailApproval?.approvalId}`}
        subtitle={`${selectedDetailApproval?.recipientName} (${selectedDetailApproval?.recipientType})`}
        maxWidth="lg"
      >
        {selectedDetailApproval && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Transaction Type</span>
                <div className="font-bold text-slate-900 dark:text-white mt-0.5">{selectedDetailApproval.transactionType}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400">Amount</span>
                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">₹{selectedDetailApproval.amount.toLocaleString()}</div>
              </div>
              <div>
                <Badge
                  variant={
                    selectedDetailApproval.status === 'Completed' || selectedDetailApproval.status === 'Approved'
                      ? 'success'
                      : selectedDetailApproval.status === 'Rejected'
                      ? 'danger'
                      : 'warning'
                  }
                >
                  {selectedDetailApproval.status}
                </Badge>
              </div>
            </div>

            {selectedDetailApproval.bankDetails && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[10px] tracking-wider">Destination Bank Account</div>
                <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                  <div>Account Holder: <span className="font-semibold text-slate-900 dark:text-white">{selectedDetailApproval.bankDetails.accountHolder}</span></div>
                  <div>Account No: <span className="font-mono font-semibold text-slate-900 dark:text-white">{selectedDetailApproval.bankDetails.accountNumberMasked}</span></div>
                  <div>Bank Name: <span className="font-semibold text-slate-900 dark:text-white">{selectedDetailApproval.bankDetails.bankName}</span></div>
                  <div>IFSC Code: <span className="font-mono font-semibold text-slate-900 dark:text-white">{selectedDetailApproval.bankDetails.ifscCode}</span></div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 space-y-1">
                <div className="font-bold text-blue-700 dark:text-blue-300 text-[10px] uppercase">Maker Initiation Details</div>
                <div>Initiator: <span className="font-semibold text-slate-900 dark:text-white">{selectedDetailApproval.makerName}</span></div>
                <div>Role: <span className="text-slate-500">{selectedDetailApproval.makerRole}</span> (ID: {selectedDetailApproval.makerId})</div>
                <div>Initiated At: <span className="text-slate-500">{new Date(selectedDetailApproval.initiatedAt).toLocaleString()}</span></div>
                {selectedDetailApproval.makerNotes && (
                  <div className="mt-1 text-[11px] italic text-slate-600 dark:text-slate-400">"{selectedDetailApproval.makerNotes}"</div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 space-y-1">
                <div className="font-bold text-purple-700 dark:text-purple-300 text-[10px] uppercase">Checker Review Details</div>
                {selectedDetailApproval.checkerName ? (
                  <>
                    <div>Reviewed By: <span className="font-semibold text-slate-900 dark:text-white">{selectedDetailApproval.checkerName}</span></div>
                    <div>Review Date: <span className="text-slate-500">{selectedDetailApproval.reviewedAt ? new Date(selectedDetailApproval.reviewedAt).toLocaleString() : 'N/A'}</span></div>
                    <div>Decision: <span className="font-bold text-emerald-600">{selectedDetailApproval.status}</span></div>
                    {selectedDetailApproval.rejectionReason && (
                      <div className="mt-1 text-[11px] text-rose-600 font-medium">Rejection Reason: {selectedDetailApproval.rejectionReason}</div>
                    )}
                  </>
                ) : (
                  <div className="text-slate-400 italic py-2">Awaiting Checker Review and Verification</div>
                )}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-[10px] font-mono text-slate-400 flex justify-between">
              <span>Idempotency Key: {selectedDetailApproval.idempotencyKey || 'N/A'}</span>
              <span>Recipient ID: {selectedDetailApproval.recipientId}</span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedDetailApproval(null)}
                className="px-4 py-2 rounded-xl font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Transaction Details Drawer / Modal */}
      <TransactionDetailsModal
        transaction={selectedTxn}
        onClose={() => setSelectedTxn(null)}
      />

      {/* Liability Movement History Modal */}
      <Modal
        isOpen={!!selectedLiability}
        onClose={() => setSelectedLiability(null)}
        title={`Liability Audit Trail: ${selectedLiability?.liabilityId}`}
        subtitle={selectedLiability?.agentName}
        maxWidth="lg"
      >
        {selectedLiability && (
          <div className="space-y-3 text-xs">
            {selectedLiability.movements.map((mov, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between font-bold">
                  <span className="text-purple-600">{mov.type}</span>
                  <span>₹{mov.amount.toLocaleString()}</span>
                </div>
                <div className="text-slate-500 mt-1">{mov.reason}</div>
                <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                  <span>Processed by: {mov.processedByName}</span>
                  <span>Balance After: ₹{mov.balanceAfter.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Generate & Dispatch Payment Link Modal */}
      <Modal
        isOpen={showPaymentLinkModal}
        onClose={() => {
          setShowPaymentLinkModal(false);
          setGeneratedLinkData(null);
          setEmailStatusMsg(null);
        }}
        title="Generate Payment Link & Activate Account"
        subtitle="Custom fee entry, SMTP email dispatch & gateway payment verification"
        maxWidth="xl"
      >
        <div className="space-y-4 text-xs">
          {!generatedLinkData ? (
            <form onSubmit={handleGeneratePaymentLink} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Applicant Classification
                  </label>
                  <select
                    value={paymentLinkForm.applicantType}
                    onChange={e =>
                      setPaymentLinkForm(prev => ({
                        ...prev,
                        applicantType: e.target.value,
                        purpose:
                          e.target.value === 'Vendor'
                            ? 'Vendor Onboarding Subscription'
                            : 'Agent Security Deposit (Refundable)',
                        amount: e.target.value === 'Vendor' ? '1999' : '5000'
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="Vendor">Vendor (Subscription)</option>
                    <option value="Agent">Agent (Security Deposit)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Applicant ID / Registration ID
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. REG-20261023-4545"
                    value={paymentLinkForm.applicantId}
                    onChange={e => setPaymentLinkForm(prev => ({ ...prev, applicantId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Applicant Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Devil / Diya"
                    value={paymentLinkForm.applicantName}
                    onChange={e => setPaymentLinkForm(prev => ({ ...prev, applicantName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Applicant Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. applicant@connectapp.in"
                    value={paymentLinkForm.applicantEmail}
                    onChange={e => setPaymentLinkForm(prev => ({ ...prev, applicantEmail: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Custom Amount (INR ₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="1999"
                    value={paymentLinkForm.amount}
                    onChange={e => setPaymentLinkForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Link Validity (Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    required
                    value={paymentLinkForm.expiryDays}
                    onChange={e => setPaymentLinkForm(prev => ({ ...prev, expiryDays: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Payment Purpose / Line Item
                </label>
                <input
                  type="text"
                  required
                  value={paymentLinkForm.purpose}
                  onChange={e => setPaymentLinkForm(prev => ({ ...prev, purpose: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentLinkModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generatingLink}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50"
                >
                  {generatingLink ? 'Generating Link...' : 'Create Secure Payment Link'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300 text-sm">
                    Payment Link Active & Ready
                  </span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-bold">
                    {generatedLinkData.linkId}
                  </span>
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  Amount: <strong className="text-slate-900 dark:text-white">₹{generatedLinkData.amount.toLocaleString()}</strong> | Purpose: {generatedLinkData.purpose}
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 font-mono text-[11px] select-all break-all text-indigo-600 dark:text-indigo-400">
                  {generatedLinkData.paymentUrl}
                </div>
              </div>

              {emailStatusMsg && (
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span>{emailStatusMsg}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSendPaymentEmail}
                  disabled={sendingEmail}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-50 shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>{sendingEmail ? 'Dispatching Email...' : 'Send Payment Email to Applicant'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleVerifyAndActivate}
                  disabled={verifyingActivation}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50 shadow-md shadow-emerald-600/20"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{verifyingActivation ? 'Activating in DB...' : 'Verify Gateway Payment & Activate Account'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

