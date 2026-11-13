import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  ArrowUpRight,
  Users,
  ShoppingBag,
  Store,
  CreditCard,
  Award,
  Truck,
  Wrench,
  Clock,
  Calendar,
  AlertTriangle,
  Download,
  Eye,
  Lock,
  ShieldAlert
} from 'lucide-react';
import { apiFetch, getAuthToken } from '../../services/api';
import { Employee, PaymentTransaction } from '../../types';
import { NavCategoryDef } from '../../config/categoryCatalog';
import { useAuth } from '../../contexts/AuthContext';
import { StatCard } from '../common/StatCard';
import { Badge } from '../common/Badge';
import { EmptyState } from '../common/EmptyState';
import { ErrorBanner } from '../common/ErrorBanner';
import { DepartmentTabHeader, PaginationBar, TabSummaryCounts } from '../common/DepartmentTabHeader';

interface CategoryLedgerViewProps {
  section: 'income' | 'expenses';
  categories: NavCategoryDef[];
  activeSubSlug?: string;
  paymentStaff: Employee[];
  onSelectTransaction: (txn: PaymentTransaction) => void;
}

const PAYMENT_METHODS = [
  'All',
  'UPI',
  'Credit Card',
  'Debit Card',
  'NetBanking',
  'Bank Transfer (IMPS)',
  'Bank Transfer',
  'NEFT',
  'IMPS',
  'UPI AutoPay'
];

export const CategoryLedgerView: React.FC<CategoryLedgerViewProps> = ({
  section,
  categories,
  activeSubSlug,
  paymentStaff,
  onSelectTransaction
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const activeTab =
    categories.find(c => c.slug === activeSubSlug) || categories[0];

  const [kpis, setKpis] = useState<any>({});
  const [rows, setRows] = useState<PaymentTransaction[]>([]);
  const [summary, setSummary] = useState<TabSummaryCounts>({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [paymentMethod, setPaymentMethod] = useState('All');
  const [subCategory, setSubCategory] = useState('All');
  const [assigneeFilter, setAssigneeFilter] = useState('All');
  const [presetDateRange, setPresetDateRange] = useState('All');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const canExport = user?.role === 'overall_lead' || user?.role === 'payment_lead';

  const buildQueryParams = (targetPage: number, includePagination = true) => {
    const q = new URLSearchParams();
    q.append('section', section);
    q.append('category', activeTab.key);
    if (includePagination) {
      q.append('page', String(targetPage));
      q.append('limit', String(limit));
    }
    if (search) q.append('search', search);
    if (statusFilter !== 'All') q.append('status', statusFilter);
    if (paymentMethod !== 'All') q.append('paymentMethod', paymentMethod);
    if (subCategory !== 'All') q.append('subCategory', subCategory);
    if (assigneeFilter !== 'All') q.append('handledByEmployeeId', assigneeFilter);
    if (presetDateRange !== 'All') q.append('presetDateRange', presetDateRange);
    if (customStartDate) q.append('startDate', customStartDate);
    if (customEndDate) q.append('endDate', customEndDate);
    return q;
  };

  const loadData = async (targetPage = page) => {
    try {
      setLoading(true);
      setLoadError(null);
      const q = buildQueryParams(targetPage, true);
      const [txnRes, kpiRes] = await Promise.all([
        apiFetch<any>(`/payments/transactions?${q.toString()}`),
        apiFetch<any>('/payments/kpis')
      ]);

      if (txnRes?.success) {
        setRows(txnRes.data || []);
        setSummary(txnRes.summary || {});
        setTotal(txnRes.total ?? (txnRes.data || []).length);
        setTotalPages(txnRes.totalPages ?? 1);
      } else {
        setLoadError(txnRes?.message || `Failed to load ${section} transactions.`);
      }
      if (kpiRes?.success) {
        setKpis(kpiRes.data || {});
      }
    } catch (err: any) {
      setLoadError(err?.message || `Unable to load ${section} transactions.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSubCategory('All');
    setPage(1);
    loadData(1);
  }, [section, activeTab.key]);

  useEffect(() => {
    setPage(1);
    loadData(1);
  }, [statusFilter, paymentMethod, subCategory, assigneeFilter, presetDateRange, limit]);

  const handleReset = () => {
    setSearch('');
    setStatusFilter('All');
    setPaymentMethod('All');
    setSubCategory('All');
    setAssigneeFilter('All');
    setPresetDateRange('All');
    setCustomStartDate('');
    setCustomEndDate('');
    setPage(1);
    setTimeout(() => loadData(1), 0);
  };

  const handleExportCsv = async () => {
    if (!canExport) return;
    try {
      setExporting(true);
      const apiBase = import.meta.env.VITE_API_URL || '/api';
      const q = buildQueryParams(1, false);
      const res = await fetch(`${apiBase}/payments/transactions/export?${q.toString()}`, {
        headers: { Authorization: `Bearer ${getAuthToken() || ''}` }
      });
      if (!res.ok) throw new Error('Export failed or permission denied.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${section}-${activeTab.slug}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setLoadError(err?.message || 'CSV export failed.');
    } finally {
      setExporting(false);
    }
  };

  const incomeDash = kpis.incomeDashboard || {};
  const expenseDash = kpis.expensesDashboard || {};

  const statusBadgeVariant = (status: string) => {
    if (status === 'COMPLETED') return 'success';
    if (status === 'FAILED') return 'danger';
    return 'warning';
  };

  const subTypeOptions =
    section === 'income' && activeTab.key === 'CUSTOMER_PAYMENTS'
      ? [
        { value: 'All', label: 'All Order & Booking Types' },
        { value: 'Product Order', label: 'Product Orders' },
        { value: 'Food Order', label: 'Food Orders' },
        { value: 'Daily Needs Order', label: 'Daily Needs Orders' },
        { value: 'Service Booking', label: 'Service Bookings' },
        { value: 'Stay Booking', label: 'Stay Bookings' },
        { value: 'Travel Booking', label: 'Travel Bookings' }
      ]
      : section === 'expenses' && activeTab.key === 'VENDOR_PAYMENTS'
        ? [
          { value: 'All', label: 'All Vendor Settlements' },
          { value: 'Order Settlement', label: 'Customer Order Settlements' },
          { value: 'Booking Settlement', label: 'Booking Settlements' }
        ]
        : [];

  const renderHeaders = () => {
    if (section === 'income') {
      if (activeTab.key === 'CUSTOMER_PAYMENTS') {
        return ['Transaction ID', 'Customer ID', 'Customer Name', 'Order / Booking ID', 'Category', 'Gross', 'Tax', 'Discount', 'Final Paid', 'Method', 'Date', 'Status', 'Action'];
      }
      if (activeTab.key === 'VENDOR_SUBSCRIPTION_PAYMENTS') {
        return ['Vendor ID', 'Vendor Name', 'Business Name', 'Subscription Plan', 'Duration', 'Transaction ID', 'Amount Received', 'Method', 'Payment Date', 'Expiry', 'Status', 'Action'];
      }
      if (activeTab.key === 'AGENT_PAYMENTS_RECEIVED') {
        return ['Agent ID', 'Agent Name', 'Payment Category', 'Transaction ID', 'Amount Received', 'Method', 'Payment Date', 'Payment Reference', 'Status', 'Action'];
      }
      return ['Customer ID', 'Customer Name', 'Membership ID', 'Membership Plan', 'Transaction ID', 'Purchase / Renewal Date', 'Validity Period', 'Amount Received', 'Method', 'Status', 'Action'];
    }

    if (activeTab.key === 'VENDOR_PAYMENTS') {
      return ['Vendor ID', 'Vendor Name', 'Business Name', 'Settlement ID', 'Order / Booking ID', 'Gross Amount', 'Commission', 'Deductions', 'Final Payable', 'Payment Date', 'Transaction ID', 'Status', 'Action'];
    }
    if (activeTab.key === 'AGENT_PAYMENTS') {
      return ['Agent ID', 'Agent Name', 'Payout Category', 'Vendor / Tie-up Ref', 'Eligible Amount', 'Approved Amount', 'Deductions', 'Final Payable', 'Payment Date', 'Transaction ID', 'Status', 'Action'];
    }
    if (activeTab.key === 'DELIVERY_PARTNER_PAYMENTS') {
      return ['Delivery Partner ID', 'Delivery Partner Name', 'Order / Delivery ID', 'Completed Deliveries', 'Delivery Fees', 'Adjustments', 'Final Payable', 'Payment Date', 'Transaction ID', 'Status', 'Action'];
    }
    return ['Technician ID', 'Technician Name', 'Service Booking ID', 'Completed Service', 'Service Amount', 'Commission', 'Deductions', 'Final Payable', 'Payment Date', 'Transaction ID', 'Status', 'Action'];
  };

  const renderCells = (txn: PaymentTransaction) => {
    const md = txn.metadata || {};
    const dt = new Date(txn.transactionDate).toLocaleDateString();

    if (section === 'income') {
      if (activeTab.key === 'CUSTOMER_PAYMENTS') {
        return (
          <>
            <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">{txn.transactionId}</td>
            <td className="py-3 px-3 font-mono text-slate-500">{txn.fromParty.id}</td>
            <td className="py-3 px-3 font-semibold">{txn.fromParty.name}</td>
            <td className="py-3 px-3 font-mono">{txn.referenceId}</td>
            <td className="py-3 px-3">{txn.transactionType}</td>
            <td className="py-3 px-3">₹{(txn.grossAmount || txn.amount).toLocaleString()}</td>
            <td className="py-3 px-3 text-slate-500">₹{(txn.tax || 0).toLocaleString()}</td>
            <td className="py-3 px-3 text-slate-500">-₹{(txn.discount || 0).toLocaleString()}</td>
            <td className="py-3 px-3 font-extrabold text-emerald-600">₹{txn.finalAmount.toLocaleString()}</td>
            <td className="py-3 px-3">{txn.paymentMethod}</td>
            <td className="py-3 px-3 text-slate-500">{dt}</td>
          </>
        );
      }
      if (activeTab.key === 'VENDOR_SUBSCRIPTION_PAYMENTS') {
        return (
          <>
            <td className="py-3 px-3 font-mono text-slate-500">{txn.fromParty.id}</td>
            <td className="py-3 px-3 font-semibold">{txn.fromParty.name}</td>
            <td className="py-3 px-3">{md.businessName || txn.fromParty.name}</td>
            <td className="py-3 px-3 font-medium">{md.subscriptionPlan || txn.transactionType}</td>
            <td className="py-3 px-3">{md.subscriptionDuration || '12 Months'}</td>
            <td className="py-3 px-3 font-mono">{txn.transactionId}</td>
            <td className="py-3 px-3 font-extrabold text-emerald-600">₹{txn.finalAmount.toLocaleString()}</td>
            <td className="py-3 px-3">{txn.paymentMethod}</td>
            <td className="py-3 px-3 text-slate-500">{dt}</td>
            <td className="py-3 px-3 text-slate-500">{md.subscriptionExpiry ? new Date(md.subscriptionExpiry).toLocaleDateString() : 'Active Cycle'}</td>
          </>
        );
      }
      if (activeTab.key === 'AGENT_PAYMENTS_RECEIVED') {
        return (
          <>
            <td className="py-3 px-3 font-mono text-slate-500">{txn.fromParty.id}</td>
            <td className="py-3 px-3 font-semibold">{txn.fromParty.name}</td>
            <td className="py-3 px-3">{md.paymentCategory || txn.transactionType}</td>
            <td className="py-3 px-3 font-mono">{txn.transactionId}</td>
            <td className="py-3 px-3 font-extrabold text-emerald-600">₹{txn.finalAmount.toLocaleString()}</td>
            <td className="py-3 px-3">{txn.paymentMethod}</td>
            <td className="py-3 px-3 text-slate-500">{dt}</td>
            <td className="py-3 px-3 font-mono text-slate-500">{md.paymentReference || txn.gatewayReference || txn.referenceId}</td>
          </>
        );
      }
      return (
        <>
          <td className="py-3 px-3 font-mono text-slate-500">{txn.fromParty.id}</td>
          <td className="py-3 px-3 font-semibold">{txn.fromParty.name}</td>
          <td className="py-3 px-3 font-mono">{md.membershipId || txn.referenceId}</td>
          <td className="py-3 px-3 font-medium">{md.membershipPlan || txn.transactionType}</td>
          <td className="py-3 px-3 font-mono">{txn.transactionId}</td>
          <td className="py-3 px-3 text-slate-500">{dt}</td>
          <td className="py-3 px-3">{md.validityPeriod || '12 Months'}</td>
          <td className="py-3 px-3 font-extrabold text-emerald-600">₹{txn.finalAmount.toLocaleString()}</td>
          <td className="py-3 px-3">{txn.paymentMethod}</td>
        </>
      );
    }

    if (activeTab.key === 'VENDOR_PAYMENTS') {
      return (
        <>
          <td className="py-3 px-3 font-mono text-slate-500">{txn.toParty.id}</td>
          <td className="py-3 px-3 font-semibold">{txn.toParty.name}</td>
          <td className="py-3 px-3">{md.businessName || txn.toParty.name}</td>
          <td className="py-3 px-3 font-mono">{md.settlementId || txn.referenceId}</td>
          <td className="py-3 px-3 font-mono">{md.relatedOrderId || txn.referenceId}</td>
          <td className="py-3 px-3">₹{(txn.grossAmount || txn.amount).toLocaleString()}</td>
          <td className="py-3 px-3 text-slate-500">₹{(txn.commission || 0).toLocaleString()}</td>
          <td className="py-3 px-3 text-slate-500">-₹{(txn.deductions || 0).toLocaleString()}</td>
          <td className="py-3 px-3 font-extrabold text-rose-600">₹{txn.finalAmount.toLocaleString()}</td>
          <td className="py-3 px-3 text-slate-500">{dt}</td>
          <td className="py-3 px-3 font-mono">{txn.transactionId}</td>
        </>
      );
    }
    if (activeTab.key === 'AGENT_PAYMENTS') {
      return (
        <>
          <td className="py-3 px-3 font-mono text-slate-500">{txn.toParty.id}</td>
          <td className="py-3 px-3 font-semibold">{txn.toParty.name}</td>
          <td className="py-3 px-3">{txn.transactionType}</td>
          <td className="py-3 px-3 font-mono">{md.relatedVendorRef || txn.referenceId}</td>
          <td className="py-3 px-3">₹{(txn.grossAmount || txn.amount).toLocaleString()}</td>
          <td className="py-3 px-3 font-semibold">₹{(txn.amount || txn.finalAmount).toLocaleString()}</td>
          <td className="py-3 px-3 text-slate-500">-₹{(txn.deductions || 0).toLocaleString()}</td>
          <td className="py-3 px-3 font-extrabold text-rose-600">₹{txn.finalAmount.toLocaleString()}</td>
          <td className="py-3 px-3 text-slate-500">{dt}</td>
          <td className="py-3 px-3 font-mono">{txn.transactionId}</td>
        </>
      );
    }
    if (activeTab.key === 'DELIVERY_PARTNER_PAYMENTS') {
      return (
        <>
          <td className="py-3 px-3 font-mono text-slate-500">{txn.toParty.id}</td>
          <td className="py-3 px-3 font-semibold">{txn.toParty.name}</td>
          <td className="py-3 px-3 font-mono">{md.relatedOrderId || txn.referenceId}</td>
          <td className="py-3 px-3 font-semibold">{md.completedDeliveries ?? 'Batch Verified'}</td>
          <td className="py-3 px-3">₹{(txn.grossAmount || txn.amount).toLocaleString()}</td>
          <td className="py-3 px-3 text-slate-500">₹{(md.adjustments ?? txn.deductions ?? 0).toLocaleString()}</td>
          <td className="py-3 px-3 font-extrabold text-rose-600">₹{txn.finalAmount.toLocaleString()}</td>
          <td className="py-3 px-3 text-slate-500">{dt}</td>
          <td className="py-3 px-3 font-mono">{txn.transactionId}</td>
        </>
      );
    }
    return (
      <>
        <td className="py-3 px-3 font-mono text-slate-500">{txn.toParty.id}</td>
        <td className="py-3 px-3 font-semibold">{txn.toParty.name}</td>
        <td className="py-3 px-3 font-mono">{md.serviceBookingId || txn.referenceId}</td>
        <td className="py-3 px-3">{md.completedService || txn.notes || 'Completed Service Job'}</td>
        <td className="py-3 px-3">₹{(txn.grossAmount || txn.amount).toLocaleString()}</td>
        <td className="py-3 px-3 text-slate-500">₹{(txn.commission || 0).toLocaleString()}</td>
        <td className="py-3 px-3 text-slate-500">-₹{(txn.deductions || 0).toLocaleString()}</td>
        <td className="py-3 px-3 font-extrabold text-rose-600">₹{txn.finalAmount.toLocaleString()}</td>
        <td className="py-3 px-3 text-slate-500">{dt}</td>
        <td className="py-3 px-3 font-mono">{txn.transactionId}</td>
      </>
    );
  };

  return (
    <div className="space-y-5">
      {/* Section Dashboard KPIs */}
      {section === 'income' ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Recognized Income" value={`₹${(incomeDash.totalIncome || 0).toLocaleString()}`} subtitle="Completed revenue only" icon={TrendingUp} variant="emerald" />
            <StatCard title="Customer Payments" value={`₹${(incomeDash.customerPayments || 0).toLocaleString()}`} subtitle="Orders & Bookings" icon={ShoppingBag} variant="indigo" />
            <StatCard title="Vendor Subscription Income" value={`₹${(incomeDash.vendorSubscriptionIncome || 0).toLocaleString()}`} subtitle="Plans & Renewals" icon={Store} variant="sky" />
            <StatCard title="Agent Recognized Income" value={`₹${(incomeDash.agentRecognizedIncome || 0).toLocaleString()}`} subtitle="Excludes Deposit Liabilities" icon={Users} variant="purple" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Membership Income" value={`₹${(incomeDash.membershipIncome || 0).toLocaleString()}`} icon={Award} variant="indigo" />
            <StatCard title="Today's Income" value={`₹${(incomeDash.todayIncome || 0).toLocaleString()}`} icon={Clock} variant="emerald" />
            <StatCard title="This Week's Income" value={`₹${(incomeDash.weekIncome || 0).toLocaleString()}`} icon={Calendar} variant="sky" />
            <StatCard title="This Month's Income" value={`₹${(incomeDash.monthIncome || 0).toLocaleString()}`} icon={CreditCard} variant="emerald" />
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Financial Classification Policy: Only successful, qualifying revenue transactions are included in Income. Refundable Agent Initial Deposits remain isolated under Agent Deposit Liabilities.
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Completed Expenses" value={`₹${(expenseDash.totalExpenses || 0).toLocaleString()}`} subtitle="External payouts (excl. Salaries)" icon={ArrowUpRight} variant="rose" />
            <StatCard title="Vendor Payments" value={`₹${(expenseDash.vendorPayments || 0).toLocaleString()}`} subtitle="Order & Booking settlements" icon={Store} variant="indigo" />
            <StatCard title="Agent Payouts" value={`₹${(expenseDash.agentPayouts || 0).toLocaleString()}`} subtitle="Tie-ups & Commissions" icon={Users} variant="purple" />
            <StatCard title="Delivery & Technician" value={`₹${((expenseDash.deliveryPartnerPayments || 0) + (expenseDash.technicianPayments || 0)).toLocaleString()}`} subtitle={`DP: ₹${(expenseDash.deliveryPartnerPayments || 0).toLocaleString()} | Tech: ₹${(expenseDash.technicianPayments || 0).toLocaleString()}`} icon={Truck} variant="sky" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Today's Expenses" value={`₹${(expenseDash.todayExpenses || 0).toLocaleString()}`} icon={Clock} variant="rose" />
            <StatCard title="This Week's Expenses" value={`₹${(expenseDash.weekExpenses || 0).toLocaleString()}`} icon={Calendar} variant="amber" />
            <StatCard title="This Month's Expenses" value={`₹${(expenseDash.monthExpenses || 0).toLocaleString()}`} icon={Wrench} variant="rose" />
            <StatCard
              title="Pending / Failed (Excluded)"
              value={`₹${((expenseDash.pendingExpensesAmount || 0) + (expenseDash.failedExpensesAmount || 0)).toLocaleString()}`}
              subtitle={`${expenseDash.pendingExpensesCount || 0} Pending (₹${(expenseDash.pendingExpensesAmount || 0).toLocaleString()}) | ${expenseDash.failedExpensesCount || 0} Failed (₹${(expenseDash.failedExpensesAmount || 0).toLocaleString()})`}
              icon={AlertTriangle}
              variant="amber"
            />
          </div>
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Payroll & Status Separation: Employee Salary Payments are managed strictly in Salary Management and excluded from Expenses. Pending and Failed payouts are reported separately above and excluded from Completed Expenses.
            </span>
          </div>
        </div>
      )}

      {/* Sub-Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {categories.map(cat => {
          const isSelected = activeTab.key === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => navigate(`/payment/${section}/${cat.slug}`)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-all ${isSelected
                  ? 'bg-slate-900 text-white dark:bg-indigo-600 border-slate-900 dark:border-indigo-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
                }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Independent Filters, Scoped Tab Summary & Export Permission Action */}
      <DepartmentTabHeader
        title={activeTab.label}
        description={activeTab.description}
        departmentBadge={section === 'income' ? 'Payment Operations • Income' : 'Payment Operations • Expenses'}
        summary={summary}
        showAmountStat={true}
        pendingLabel="Pending / On Hold"
        inProgressLabel="Processing"
        completedLabel={section === 'income' ? 'Recognized (Completed)' : 'Paid Out (Completed)'}
        actions={
          canExport ? (
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white text-xs font-bold shadow-sm disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] font-semibold">
              <Lock className="w-3.5 h-3.5" /> Lead Permission Required to Export
            </span>
          )
        }
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={`Search ${activeTab.label} by Txn ID, Party, Reference...`}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        statusOptions={[
          { value: 'All', label: 'All Statuses' },
          { value: 'COMPLETED', label: 'Completed' },
          { value: 'PENDING', label: 'Pending' },
          { value: 'PROCESSING', label: 'Processing' },
          { value: 'FAILED', label: 'Failed' },
          { value: 'REFUNDED', label: 'Refunded' }
        ]}
        assigneeFilter={assigneeFilter}
        onAssigneeChange={setAssigneeFilter}
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
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              aria-label="Payment Method Filter"
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              {PAYMENT_METHODS.map(m => (
                <option key={m} value={m}>{m === 'All' ? 'All Payment Methods' : m}</option>
              ))}
            </select>

            {subTypeOptions.length > 0 && (
              <select
                value={subCategory}
                onChange={e => setSubCategory(e.target.value)}
                aria-label="Sub-Category Filter"
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {subTypeOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}

            <select
              value={presetDateRange}
              onChange={e => setPresetDateRange(e.target.value)}
              aria-label="Date Range Preset"
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
          loadData(1);
        }}
        onResetFilters={handleReset}
      />

      <ErrorBanner message={loadError} onRetry={() => loadData(page)} />

      {/* Category-Specific Listing Table */}
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={`No ${activeTab.label}`}
          description="No qualifying records match the active filters."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {renderHeaders().map(h => (
                    <th key={h} className={`py-3 px-3 ${h === 'Action' ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs whitespace-nowrap">
                {rows.map(txn => (
                  <tr key={txn._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    {renderCells(txn)}
                    <td className="py-3 px-3">
                      <Badge variant={statusBadgeVariant(txn.status)}>{txn.status}</Badge>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectTransaction(txn)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
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
              loadData(next);
            }}
            onLimitChange={setLimit}
          />
        </div>
      )}
    </div>
  );
};

