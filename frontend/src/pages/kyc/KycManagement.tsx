import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ShieldCheck,
  UserCheck,
  RefreshCw,
  FileText,
  ZoomIn,
  ZoomOut,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRightCircle,
  Clock,
  Eye,
  Download,
  History,
  UploadCloud,
  Database
} from 'lucide-react';
import { apiFetch, uploadMediaFile } from '../../services/api';
import { KycRequest, Employee } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { DepartmentTabHeader, PaginationBar, TabSummaryCounts } from '../../components/common/DepartmentTabHeader';
import { KYC_NAV_CATEGORIES } from '../../config/categoryCatalog';
import { KycVerificationWorkbench } from '../../components/kyc/KycVerificationWorkbench';
import { StatCard } from '../../components/common/StatCard';
import { DonutChartCard } from '../../components/common/DonutChartCard';
import { RadialGaugeCard } from '../../components/common/RadialGaugeCard';
import { QuickActionsCard } from '../../components/common/QuickActionsCard';
import { TeamPerformanceCard } from '../../components/common/TeamPerformanceCard';

function formatPendingDuration(submissionDate: string, status: string): string {
  if (status === 'Approved' || status === 'Rejected') return 'Completed';
  const hrs = Math.max(0, Math.round((Date.now() - new Date(submissionDate).getTime()) / (1000 * 60 * 60)));
  if (hrs >= 24) return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
  return `${hrs}h`;
}

export const KycManagement: React.FC = () => {
  const { user } = useAuth();
  const { categorySlug } = useParams<{ categorySlug?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const activeCategory =
    KYC_NAV_CATEGORIES.find(c => c.slug === (categorySlug || 'all')) || KYC_NAV_CATEGORIES[0];

  const [requests, setRequests] = useState<KycRequest[]>([]);
  const [stats, setStats] = useState<any>({});
  const [summary, setSummary] = useState<TabSummaryCounts>({});
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [kycStaff, setKycStaff] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [assigneeFilter, setAssigneeFilter] = useState('All');
  const [pendingDurationFilter, setPendingDurationFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedReq, setSelectedReq] = useState<KycRequest | null>(null);
  const [viewedEscalations, setViewedEscalations] = useState<Set<string>>(new Set());
  const [showAssignModal, setShowAssignModal] = useState<KycRequest | null>(null);
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [assignReason, setAssignReason] = useState('');

  // Document viewer zoom & verification actions
  const [zoomLevel, setZoomLevel] = useState(1);
  const [activeDocIndex, setActiveDocIndex] = useState(0);
  const [actionMode, setActionMode] = useState<'NONE' | 'REJECT' | 'REUPLOAD' | 'ESCALATE' | 'RESUBMIT'>('NONE');
  const [actionReason, setActionReason] = useState('');
  const [reuploadDocType, setReuploadDocType] = useState('');
  const [resubmitUrl, setResubmitUrl] = useState('');
  const [resubmitDocName, setResubmitDocName] = useState('');
  const [uploadingResubmit, setUploadingResubmit] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Dedicated KYC Queries transferred from Queries Team
  const [transferredQueries, setTransferredQueries] = useState<any[]>([]);
  const [selectedTransferredQuery, setSelectedTransferredQuery] = useState<any | null>(null);
  const [transferredAction, setTransferredAction] = useState<'RE_KYC_REQUESTED' | 'IN_PROGRESS' | 'RESOLVED' | 'TRANSFER_BACK_TO_QUERIES'>('IN_PROGRESS');
  const [transferredNotes, setTransferredNotes] = useState('');
  const [submittingTransferredAction, setSubmittingTransferredAction] = useState(false);

  const loadData = async (targetPage = page) => {
    try {
      setLoading(true);
      setLoadError(null);

      // Handle dedicated KYC Queries Tab (Transferred from Queries Team)
      if (activeCategory.key === 'KYC_QUERIES') {
        const tRes = await apiFetch<any>('/kyc/transferred-queries');
        if (tRes.success) {
          setTransferredQueries(tRes.data || []);
          setSummary(tRes.summary || {});
          setTotal(tRes.count ?? (tRes.data || []).length);
          setTotalPages(1);
        } else {
          setLoadError(tRes.message || 'Failed to load transferred KYC queries.');
        }
        return;
      }

      const query = new URLSearchParams();
      query.append('category', activeCategory.key);
      query.append('page', String(targetPage));
      query.append('limit', String(limit));
      if (statusFilter !== 'All') query.append('status', statusFilter);
      if (priorityFilter !== 'All') query.append('priority', priorityFilter);
      if (assigneeFilter !== 'All') query.append('assignedEmployeeId', assigneeFilter);
      if (pendingDurationFilter !== 'All') query.append('minPendingHours', pendingDurationFilter);
      if (startDate) query.append('startDate', startDate);
      if (endDate) query.append('endDate', endDate);
      if (search) query.append('search', search);

      const [reqRes, statsRes] = await Promise.all([
        apiFetch<any>(`/kyc/requests?${query.toString()}`),
        apiFetch(`/kyc/stats?category=${activeCategory.key}`)
      ]);

      if (reqRes.success) {
        setRequests(reqRes.data || []);
        setSummary((reqRes as any).summary || {});
        setCategoryCounts((reqRes as any).categoryCounts || {});
        setTotal((reqRes as any).total ?? (reqRes.data || []).length);
        setTotalPages((reqRes as any).totalPages ?? 1);
      } else {
        setLoadError((reqRes as any).message || 'Failed to load KYC requests.');
      }
      if (statsRes.success) setStats(statsRes.data || {});

      if (user?.role === 'overall_lead' || user?.role === 'kyc_lead') {
        const staffRes = await apiFetch<Employee[]>('/staff?department=KYC Team');
        if (staffRes.success) {
          setKycStaff((staffRes.data || []).filter(s => s.status === 'active'));
        }
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load KYC requests.');
    } finally {
      setLoading(false);
    }
  };

  const handleActionTransferredQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTransferredQuery) return;
    try {
      setSubmittingTransferredAction(true);
      let backendAction: 'UPDATE_STATUS' | 'REQUEST_REKYC' | 'TRANSFER_BACK' | 'RESOLVE' = 'UPDATE_STATUS';
      let statusParam: string | undefined = undefined;

      if (transferredAction === 'IN_PROGRESS') {
        backendAction = 'UPDATE_STATUS';
        statusParam = 'In Progress';
      } else if (transferredAction === 'RE_KYC_REQUESTED') {
        backendAction = 'REQUEST_REKYC';
      } else if (transferredAction === 'RESOLVED') {
        backendAction = 'RESOLVE';
      } else if (transferredAction === 'TRANSFER_BACK_TO_QUERIES') {
        backendAction = 'TRANSFER_BACK';
      }

      const res = await apiFetch(`/kyc/transferred-queries/${selectedTransferredQuery.queryId}/action`, {
        method: 'POST',
        body: JSON.stringify({
          action: backendAction,
          status: statusParam,
          notes: transferredNotes
        })
      });
      setFeedbackMsg(res.message || 'Transferred query action recorded successfully.');
      setSelectedTransferredQuery(null);
      setTransferredNotes('');
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Action failed.');
    } finally {
      setSubmittingTransferredAction(false);
    }
  };

  useEffect(() => {
    const openId = searchParams.get('openId');
    const searchParam = searchParams.get('search');
    if (searchParam && search !== searchParam) {
      setSearch(searchParam);
    }
    if (openId && requests.length > 0) {
      const match = requests.find(r => r.requestId === openId || r.applicantId === openId || (r as any)._id === openId);
      if (match) {
        setSelectedReq(match);
        setViewedEscalations(prev => new Set(prev).add(match.requestId).add(match._id));
      }
    }
  }, [searchParams, requests]);

  useEffect(() => {
    setPage(1);
    loadData(1);
  }, [activeCategory.key, statusFilter, priorityFilter, assigneeFilter, pendingDurationFilter, limit]);

  const handleSyncEcosystem = async () => {
    try {
      const res = await apiFetch<any>('/kyc/sync-ecosystem', { method: 'POST' });
      setFeedbackMsg(res.message || 'Synced pending Connect App vendor & agent KYCs.');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResubmitFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingResubmit(true);
      const uploaded = await uploadMediaFile(file, 'kyc');
      setResubmitUrl(uploaded.secureUrl);
      setResubmitDocName(uploaded.originalFilename);
      setFeedbackMsg(`Uploaded "${uploaded.originalFilename}" to Cloudinary storage.`);
    } catch (err: any) {
      alert(err.message || 'Failed to upload file to Cloudinary.');
    } finally {
      setUploadingResubmit(false);
      e.target.value = '';
    }
  };

  const handleResubmitDoc = async () => {
    if (!selectedReq) return;
    const targetDoc = reuploadDocType || selectedReq.documents[activeDocIndex]?.docType;
    if (!targetDoc) return;
    try {
      const res = await apiFetch(`/kyc/requests/${selectedReq.requestId}/resubmit`, {
        method: 'POST',
        body: JSON.stringify({
          docType: targetDoc,
          docUrl: resubmitUrl,
          docName: resubmitDocName || undefined,
          remarks: 'Corrected document uploaded with clearer resolution.'
        })
      });
      setFeedbackMsg(res.message || 'Resubmission recorded with prior version preserved.');
      setSelectedReq(res.data);
      setResubmitDocName('');
      setActionMode('NONE');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAutoAssign = async (requestId: string) => {
    try {
      const res = await apiFetch('/kyc/auto-assign', {
        method: 'POST',
        body: JSON.stringify({ requestId })
      });
      setFeedbackMsg(res.message || 'Auto-assigned successfully.');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleManualAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAssignModal || !assignEmployeeId) return;

    try {
      const res = await apiFetch('/kyc/assign', {
        method: 'POST',
        body: JSON.stringify({
          requestId: showAssignModal.requestId,
          newEmployeeId: assignEmployeeId,
          reason: assignReason
        })
      });
      setFeedbackMsg(res.message || 'Assigned successfully.');
      setShowAssignModal(null);
      setAssignReason('');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleVerifyAction = async (action: 'APPROVE' | 'REJECT' | 'REQUEST_REUPLOAD' | 'ESCALATE') => {
    if (!selectedReq) return;

    try {
      const res = await apiFetch('/kyc/verify', {
        method: 'POST',
        body: JSON.stringify({
          requestId: selectedReq.requestId,
          action,
          reason: actionReason,
          documentType: reuploadDocType || selectedReq.documents[activeDocIndex]?.docType,
          remarks: action === 'APPROVE' ? 'Verified and approved.' : actionReason
        })
      });
      setFeedbackMsg(res.message || 'Action completed.');
      setSelectedReq(null);
      setActionMode('NONE');
      setActionReason('');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const isLead = user?.role === 'overall_lead' || user?.role === 'kyc_lead';
  const isEmployee = user?.role === 'kyc_employee';
  const [viewMode, setViewMode] = useState<'lead' | 'employee'>(
    isEmployee ? 'employee' : 'lead'
  );
  const [employeeStatusTab, setEmployeeStatusTab] = useState<'ALL' | 'IN_PROGRESS' | 'REUPLOAD' | 'COMPLETED'>('ALL');

  const totalKycCount = total || (summary as any).totalCount || requests.length;
  const pendingKycCount = (summary as any).pendingCount ?? (stats.unassigned || 0);
  const inProgressKycCount = (summary as any).inProgressCount ?? (stats.inProgress || 0);
  const approvedKycCount = (summary as any).completedCount ?? (stats.approved || 0);
  const reuploadKycCount = stats.reuploadRequired || 0;

  const donutData = [
    { name: 'Approved', value: approvedKycCount, color: '#10B981' },
    { name: 'In Progress', value: inProgressKycCount, color: '#0EA5E9' },
    { name: 'Pending', value: pendingKycCount, color: '#F59E0B' },
    { name: 'Re-upload', value: reuploadKycCount, color: '#EF4444' }
  ];

  const teamMembers = (stats.employeeWorkload && stats.employeeWorkload.length > 0)
    ? stats.employeeWorkload.map((w: any) => ({
        name: w.employeeName || w.employeeId,
        todayCount: (w.activeCount || 0) + (w.completedCount || 0),
        approvedCount: w.completedCount || 0,
        role: 'KYC Officer'
      }))
    : kycStaff.map((s) => ({
        name: s.name,
        todayCount: 0,
        approvedCount: 0,
        role: s.designation || 'KYC Officer'
      }));

  const myRequests = requests.filter(r =>
    !r.assignedEmployeeId || r.assignedEmployeeId === user?.employeeId || isEmployee
  );
  const myAssignedCount = myRequests.length;
  const myInProgressCount = myRequests.filter(r => r.status === 'In Progress' || r.status === 'Assigned').length;
  const myPendingActionCount = myRequests.filter(r => ['Unassigned', 'Re-upload Requested'].includes(r.status)).length;
  const myCompletedCount = myRequests.filter(r => ['Approved', 'Rejected'].includes(r.status)).length;
  const employeeCompletionRate = myAssignedCount > 0 ? Math.round((myCompletedCount / myAssignedCount) * 100) : 100;

  const filteredMyRequests = myRequests.filter(r => {
    if (employeeStatusTab === 'IN_PROGRESS') return r.status === 'In Progress' || r.status === 'Assigned';
    if (employeeStatusTab === 'REUPLOAD') return r.status === 'Re-upload Requested' || r.status === 'Unassigned';
    if (employeeStatusTab === 'COMPLETED') return ['Approved', 'Rejected'].includes(r.status);
    return true;
  });

  const kycLeadActions = [
    {
      label: 'Assign KYC to Officer',
      icon: UserCheck,
      variant: 'primary' as const,
      onClick: () => {
        const firstUnassigned = requests.find(r => r.status === 'Unassigned');
        if (firstUnassigned) {
          setShowAssignModal(firstUnassigned);
          setAssignEmployeeId(kycStaff[0]?.employeeId || '');
        } else if (requests.length > 0) {
          setShowAssignModal(requests[0]);
          setAssignEmployeeId(requests[0].assignedEmployeeId || kycStaff[0]?.employeeId || '');
        } else {
          alert('No KYC requests currently available to assign.');
        }
      }
    },
    {
      label: 'Escalate to Total Lead',
      icon: ArrowRightCircle,
      variant: 'secondary' as const,
      onClick: () => navigate('/overall')
    },
    {
      label: 'KYC Audit & Reports',
      icon: FileText,
      variant: 'outline' as const,
      onClick: () => navigate('/reports')
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Escalated':
        return (
          <Badge variant="danger">
            <AlertTriangle className="w-3 h-3 mr-1 inline text-rose-500" />
            Escalated to Lead
          </Badge>
        );
      case 'Approved':
        return <Badge variant="success">Approved</Badge>;
      case 'Rejected':
        return <Badge variant="danger">Rejected</Badge>;
      case 'Re-upload Requested':
        return <Badge variant="warning">Re-upload Required</Badge>;
      case 'Unassigned':
        return <Badge variant="neutral">Unassigned</Badge>;
      default:
        return <Badge variant="info">{status}</Badge>;
    }
  };

  const resetFilters = () => {
    setStatusFilter('All');
    setPriorityFilter('All');
    setAssigneeFilter('All');
    setPendingDurationFilter('All');
    setStartDate('');
    setEndDate('');
    setSearch('');
    setPage(1);
    setTimeout(() => loadData(1), 0);
  };

  return (
    <div className="space-y-5">
      {/* Dashboard Header & View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {viewMode === 'employee' ? 'My KYC Dashboard' : 'KYC Operations Dashboard'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {viewMode === 'employee'
              ? 'Personal verification queue & daily throughput metrics'
              : 'Enterprise onboarding identity verification & officer workload monitor'}
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
              My Queue
            </button>
          </div>
        )}
      </div>

      <ErrorBanner message={loadError} onRetry={() => loadData(page)} />

      {feedbackMsg && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs font-bold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. EMPLOYEE VIEW (DASHBOARD 5: "My KYC Dashboard")                       */}
      {/* ========================================================================= */}
      {viewMode === 'employee' ? (
        <div className="space-y-5">
          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <StatCard
              title="Assigned"
              value={myAssignedCount}
              icon={FileText}
              color="royal"
              subtitle="Total assigned to you"
            />
            <StatCard
              title="In Progress"
              value={myInProgressCount}
              icon={RefreshCw}
              color="sky"
              subtitle="Under active verification"
            />
            <StatCard
              title="Pending Action"
              value={myPendingActionCount}
              icon={Clock}
              color="yellow"
              subtitle="Awaiting user re-upload"
            />
            <StatCard
              title="Completed Today"
              value={myCompletedCount}
              icon={CheckCircle2}
              color="emerald"
              subtitle="Approved & rejected records"
            />
          </div>

          {/* 2-Column Section: Left (8 cols) = Table, Right (4 cols) = Radial Gauge */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Column: My Assigned Requests */}
            <div className="lg:col-span-8 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">My Assigned Requests</h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Verification queue assigned to your account</p>
                  </div>
                  {/* Status filter tabs */}
                  <div className="flex items-center gap-1 p-1 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                    {(['ALL', 'IN_PROGRESS', 'REUPLOAD', 'COMPLETED'] as const).map(tabKey => (
                      <button
                        key={tabKey}
                        onClick={() => setEmployeeStatusTab(tabKey)}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                          employeeStatusTab === tabKey
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        {tabKey === 'ALL'
                          ? 'All'
                          : tabKey === 'IN_PROGRESS'
                          ? 'In Progress'
                          : tabKey === 'REUPLOAD'
                          ? 'Needs Action'
                          : 'Completed'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-3 px-3">Request ID</th>
                        <th className="py-3 px-3">Applicant / Entity</th>
                        <th className="py-3 px-3">Category</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Pending</th>
                        <th className="py-3 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {filteredMyRequests.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            No requests match your current tab filter.
                          </td>
                        </tr>
                      ) : (
                        filteredMyRequests.slice(0, 10).map(req => {
                          const pendingText = formatPendingDuration(req.submissionDate, req.status);
                          return (
                            <tr key={req._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                              <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                                {req.requestId}
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-900 dark:text-white">{req.applicantName}</div>
                                <div className="text-[10px] text-slate-400">{req.phone || req.applicantId}</div>
                              </td>
                              <td className="py-3 px-3">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {req.applicantType}
                                </span>
                              </td>
                              <td className="py-3 px-3">{getStatusBadge(req.status)}</td>
                              <td className="py-3 px-3 font-semibold text-slate-600 dark:text-slate-300">{pendingText}</td>
                              <td className="py-3 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedReq(req);
                                    setActiveDocIndex(0);
                                    setZoomLevel(1);
                                    setActionMode('NONE');
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs shadow-sm transition-all"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Verify</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Column: Radial Gauge + Quick Action */}
            <div className="lg:col-span-4 space-y-4">
              <RadialGaugeCard
                title="My Progress (Today)"
                percentage={employeeCompletionRate}
                centerSubtitle="Completed"
                color="#10B981"
                subItems={[
                  { label: 'Total Assigned', value: myAssignedCount, color: '#1D4ED8' },
                  { label: 'Completed Today', value: myCompletedCount, color: '#10B981' },
                  { label: 'In Progress', value: myInProgressCount, color: '#0EA5E9' }
                ]}
              />

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Quick Actions
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextUnverified = myRequests.find(r => r.status === 'In Progress' || r.status === 'Assigned' || r.status === 'Unassigned');
                    if (nextUnverified) {
                      setSelectedReq(nextUnverified);
                      setActiveDocIndex(0);
                      setZoomLevel(1);
                      setActionMode('NONE');
                    } else if (myRequests.length > 0) {
                      setSelectedReq(myRequests[0]);
                    } else {
                      alert('No pending requests to verify.');
                    }
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Start Next Verification</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. LEAD VIEW (DASHBOARD 2: "KYC Operations Dashboard")                   */
        /* ========================================================================= */
        <div className="space-y-5">
          {/* Top 5 KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <StatCard
              title="Total KYC"
              value={totalKycCount}
              icon={FileText}
              color="royal"
              subtitle="All registered requests"
            />
            <StatCard
              title="Pending"
              value={pendingKycCount}
              icon={Clock}
              color="yellow"
              subtitle="Unassigned / awaiting action"
            />
            <StatCard
              title="In Progress"
              value={inProgressKycCount}
              icon={RefreshCw}
              color="sky"
              subtitle="Under review by officer"
            />
            <StatCard
              title="Approved"
              value={approvedKycCount}
              icon={CheckCircle2}
              color="emerald"
              subtitle="Verification successful"
            />
            <StatCard
              title="Re-upload"
              value={reuploadKycCount}
              icon={AlertTriangle}
              color="rose"
              subtitle="Action required from user"
            />
          </div>

          {/* 3-Column Middle Section: Donut + Team Performance + Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Column 1 (4 cols): KYC Status Overview Donut */}
            <DonutChartCard
              className="lg:col-span-4"
              title="KYC Status Overview"
              subtitle="Live verification distribution"
              centerCount={totalKycCount}
              centerLabel="Total"
              data={donutData}
            />

            {/* Column 2 (5 cols): Team Performance */}
            <TeamPerformanceCard
              className="lg:col-span-5"
              title="Team Performance"
              subtitle="Verification throughput by officer"
              members={teamMembers}
            />

            {/* Column 3 (3 cols): Quick Actions */}
            <QuickActionsCard
              className="lg:col-span-3"
              title="Quick Actions"
              actions={kycLeadActions}
            />
          </div>

          {/* Horizontal Role-Wise KYC Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 border-b border-slate-200 dark:border-slate-800">
            {KYC_NAV_CATEGORIES.map(cat => {
              const isActive = activeCategory.key === cat.key;
              const cnt = categoryCounts[cat.key];
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => navigate(`/kyc/${cat.slug}`)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#1D4ED8] text-white shadow-sm'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{cat.label}</span>
                  {typeof cnt === 'number' && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {cnt}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Scoped KPIs & Unified Filter Bar */}
          <DepartmentTabHeader
            title={activeCategory.label}
            description={`${activeCategory.description} — Avg TAT: ${stats.avgVerificationHours || 0}h | SLA Overdue (>24h): ${stats.overdueCount || 0}`}
            departmentBadge="KYC Operations"
            summary={summary}
            pendingLabel="Unassigned / Re-upload"
            inProgressLabel="Assigned / In Progress"
            completedLabel="Approved"
            actions={
              isLead ? (
                <button
                  onClick={handleSyncEcosystem}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-blue-600 text-white text-xs font-bold hover:opacity-90 shadow-sm shrink-0"
                >
                  <Database className="w-4 h-4" />
                  <span>Sync Connect App Pending KYC</span>
                </button>
              ) : undefined
            }
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={`Search ${activeCategory.label} by ID, name, phone...`}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            statusOptions={[
              { value: 'All', label: 'All Statuses' },
              { value: 'Escalated', label: 'Escalated to Lead' },
              { value: 'Unassigned', label: 'Unassigned' },
              { value: 'Assigned', label: 'Assigned' },
              { value: 'In Progress', label: 'In Progress' },
              { value: 'Re-upload Requested', label: 'Re-upload Requested' },
              { value: 'Approved', label: 'Approved' },
              { value: 'Rejected', label: 'Rejected' }
            ]}
            priorityFilter={priorityFilter}
            onPriorityChange={setPriorityFilter}
            assigneeFilter={assigneeFilter}
            onAssigneeChange={setAssigneeFilter}
            employeeOptions={kycStaff.map(s => ({ employeeId: s.employeeId, name: s.name }))}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            extraFilters={
              <select
                value={pendingDurationFilter}
                onChange={e => setPendingDurationFilter(e.target.value)}
                aria-label="Pending Duration Filter"
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                <option value="All">Any Pending Duration</option>
                <option value="24">Pending &gt; 24h (Overdue)</option>
                <option value="48">Pending &gt; 48h (Critical)</option>
              </select>
            }
            onApplyFilters={() => {
              setPage(1);
              loadData(1);
            }}
            onResetFilters={resetFilters}
          />

          {/* Transferred KYC Queries or Regular KYC Table */}
          {activeCategory.key === 'KYC_QUERIES' ? (
        loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : transferredQueries.length === 0 ? (
          <EmptyState
            title="No Transferred KYC Queries"
            description="There are currently no cases transferred from the Queries Team to KYC operations."
            icon={ShieldCheck}
          />
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-4">Query ID</th>
                    <th className="py-3.5 px-4">User / Applicant</th>
                    <th className="py-3.5 px-4">Role & Category</th>
                    <th className="py-3.5 px-4">Subject & Description</th>
                    <th className="py-3.5 px-4">Transferred From</th>
                    <th className="py-3.5 px-4">Transfer Reason</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-5 text-right">Process Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {transferredQueries.map((q: any) => {
                    const latestTransfer = q.transferHistory && q.transferHistory.length > 0
                      ? q.transferHistory[q.transferHistory.length - 1]
                      : null;

                    return (
                      <tr key={q._id || q.queryId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                        <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {q.queryId}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">{q.userName || 'Anonymous User'}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{q.userPhone || q.userEmail || 'No contact'}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {q.userType || 'Customer'}
                          </span>
                          <div className="text-[11px] text-slate-400 mt-0.5">{q.category}</div>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-semibold text-slate-900 dark:text-white truncate">{q.subject}</div>
                          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{q.description}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            {latestTransfer?.transferredByName || q.transferredBy?.name || 'Queries Team'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {latestTransfer?.transferredAt || q.transferredAt ? new Date(latestTransfer?.transferredAt || q.transferredAt).toLocaleString() : 'Transferred'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-800 dark:text-amber-200">
                            {latestTransfer?.reason || q.transferReason || 'Document verification / correction required'}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge
                            variant={
                              q.status === 'Resolved' || q.status === 'Closed'
                                ? 'success'
                                : q.status === 'In Progress'
                                ? 'info'
                                : 'warning'
                            }
                          >
                            {q.status}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTransferredQuery(q);
                              setTransferredAction('IN_PROGRESS');
                              setTransferredNotes('');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition-all"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Process KYC Query</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : requests.length === 0 ? (
        <EmptyState title={`No ${activeCategory.label}`} description="No KYC records match your active category or filter." icon={ShieldCheck} />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {activeCategory.key === 'VENDOR' ? (
                    <>
                      <th className="py-3.5 px-4">Vendor ID</th>
                      <th className="py-3.5 px-4">Vendor Name</th>
                      <th className="py-3.5 px-4">Business Name & Type</th>
                      <th className="py-3.5 px-4">Reg / KYC Submitted</th>
                      <th className="py-3.5 px-4">Assigned Employee</th>
                      <th className="py-3.5 px-4">Verification Status</th>
                      <th className="py-3.5 px-4">Approved / Reviewed By</th>
                      <th className="py-3.5 px-4">Approver Role / Dept</th>
                      <th className="py-3.5 px-4">Pending Duration</th>
                      <th className="py-3.5 px-5 text-right">View Details</th>
                    </>
                  ) : activeCategory.key === 'AGENT' ? (
                    <>
                      <th className="py-3.5 px-4">Agent ID</th>
                      <th className="py-3.5 px-4">Agent Name & Mobile</th>
                      <th className="py-3.5 px-4">Assigned State / Jurisdiction</th>
                      <th className="py-3.5 px-4">Reg / KYC Submitted</th>
                      <th className="py-3.5 px-4">Assigned Employee</th>
                      <th className="py-3.5 px-4">Status & Payment Route</th>
                      <th className="py-3.5 px-4">Approved / Reviewed By</th>
                      <th className="py-3.5 px-4">Approver Role / Dept</th>
                      <th className="py-3.5 px-4">Pending Duration</th>
                      <th className="py-3.5 px-5 text-right">View Details</th>
                    </>
                  ) : (
                    <>
                      <th className="py-3.5 px-4">Applicant ID & Name</th>
                      <th className="py-3.5 px-4">
                        {activeCategory.key === 'CUSTOMER'
                          ? 'Mobile & Email'
                          : activeCategory.key === 'DELIVERY_PARTNER'
                          ? 'Vehicle & Delivery Zone'
                          : activeCategory.key === 'TECHNICIAN'
                          ? 'Skill Category & Zone'
                          : ['KYC_EMPLOYEE', 'PAYMENT_EMPLOYEE', 'QUERIES_EMPLOYEE'].includes(activeCategory.key)
                          ? 'Department & Designation'
                          : activeCategory.key === 'MANAGER'
                          ? 'Territory / Jurisdiction'
                          : 'Applicant Category'}
                      </th>
                      <th className="py-3.5 px-4">Reg / KYC Submitted</th>
                      <th className="py-3.5 px-4">Assigned Employee</th>
                      <th className="py-3.5 px-4">Verification Status</th>
                      <th className="py-3.5 px-4">Approved / Reviewed By</th>
                      <th className="py-3.5 px-4">Approver Role / Dept</th>
                      <th className="py-3.5 px-4">Pending Duration</th>
                      <th className="py-3.5 px-5 text-right">View Details</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {requests.map(req => {
                  const details = req.applicantDetails || {};
                  const pendingText = formatPendingDuration(req.submissionDate, req.status);
                  const isEscalatedReq = req.isEscalated ||
                    req.verificationRemarks?.startsWith('ESCALATED') ||
                    req.approvalHistory?.some((h: any) => h.action === 'ESCALATED' && !['Approved', 'Rejected'].includes(req.status));
                  const isUnviewedEscalation = isEscalatedReq && !viewedEscalations.has(req.requestId) && !viewedEscalations.has(req._id);

                  return (
                    <tr
                      key={req._id}
                      className={`transition-colors ${
                        isUnviewedEscalation
                          ? 'bg-rose-50/60 dark:bg-rose-950/20 border-l-4 border-l-rose-500'
                          : isEscalatedReq
                          ? 'border-l-4 border-l-rose-300 dark:border-l-rose-900/60 hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                          : 'border-l-4 border-l-transparent hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {activeCategory.key === 'VENDOR' ? (
                        <>
                          <td className="py-3.5 px-4 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                            <div>{req.applicantId}</div>
                            <div className="text-[10px] text-slate-400">{req.requestId}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">{req.applicantName}</div>
                            <div className="text-[11px] text-slate-400">{req.phone}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">{details.businessName || req.applicantName}</div>
                            <div className="text-[11px] text-slate-400">{details.businessType || details.category || 'Registered Merchant'}</div>
                          </td>
                        </>
                      ) : activeCategory.key === 'AGENT' ? (
                        <>
                          <td className="py-3.5 px-4 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                            <div>{req.applicantId}</div>
                            <div className="text-[10px] text-slate-400">{req.requestId}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">{req.applicantName}</div>
                            <div className="text-[11px] text-slate-500">{req.phone}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {details.state || details.jurisdiction || 'Regional Field Zone'}
                            </div>
                            <div className="text-[11px] text-slate-400">{details.agentRole || 'Connect Agent'}</div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">{req.applicantName}</div>
                            <div className="text-[11px] font-mono text-slate-400">
                              {req.applicantId} | {req.requestId}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            {activeCategory.key === 'CUSTOMER' ? (
                              <>
                                <div className="font-semibold text-slate-800 dark:text-slate-200">{req.phone}</div>
                                <div className="text-[11px] text-slate-400">{req.email}</div>
                              </>
                            ) : activeCategory.key === 'DELIVERY_PARTNER' ? (
                              <>
                                <div className="font-semibold text-slate-800 dark:text-slate-200">{details.vehicleNumber || details.vehicleType || 'Fleet Rider'}</div>
                                <div className="text-[11px] text-slate-400">{details.serviceZone || req.phone}</div>
                              </>
                            ) : activeCategory.key === 'TECHNICIAN' ? (
                              <>
                                <div className="font-semibold text-slate-800 dark:text-slate-200">{details.skillCategory || 'Field Technician'}</div>
                                <div className="text-[11px] text-slate-400">{details.serviceZone || details.certificationId || req.phone}</div>
                              </>
                            ) : ['KYC_EMPLOYEE', 'PAYMENT_EMPLOYEE', 'QUERIES_EMPLOYEE'].includes(activeCategory.key) ? (
                              <>
                                <div className="font-semibold text-slate-800 dark:text-slate-200">{details.designation || req.applicantType}</div>
                                <div className="text-[11px] text-slate-400">{details.department || details.workLocation || req.email}</div>
                              </>
                            ) : activeCategory.key === 'MANAGER' ? (
                              <>
                                <div className="font-semibold text-slate-800 dark:text-slate-200">{details.jurisdiction || details.region || details.adminScope || req.applicantType}</div>
                                <div className="text-[11px] text-slate-400">{req.phone}</div>
                              </>
                            ) : (
                              <>
                                <div className="font-semibold text-indigo-600 dark:text-indigo-400">{req.applicantType}</div>
                                <div className="text-[10px] font-bold uppercase text-slate-400">{req.priority} Priority</div>
                              </>
                            )}
                          </td>
                        </>
                      )}

                      {/* Shared Date, Assignee, Status, Pending Duration, Actions */}
                      <td className="py-3.5 px-4 text-[11px]">
                        <div className="text-slate-500">Reg: {new Date(req.registrationDate).toLocaleDateString()}</div>
                        <div className="font-semibold text-slate-700 dark:text-slate-300">Sub: {new Date(req.submissionDate).toLocaleDateString()}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        {req.assignedEmployeeName ? (
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-200">{req.assignedEmployeeName}</div>
                            <div className="text-[10px] font-mono text-slate-400">{req.assignedEmployeeId}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned Queue</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 space-y-1 min-w-[155px] whitespace-nowrap align-middle">
                        <div className="flex flex-col gap-1 items-start">
                          {isEscalatedReq && (
                            <Badge variant="danger" className="whitespace-nowrap inline-flex items-center gap-1 shrink-0">
                              <AlertTriangle className="w-3 h-3 mr-1 inline text-rose-500 shrink-0" />
                              <span>Escalated to Lead</span>
                            </Badge>
                          )}
                          <div>{getStatusBadge(req.status)}</div>
                        </div>
                        {(activeCategory.key === 'VENDOR' || activeCategory.key === 'AGENT' || activeCategory.key === 'ALL') && (
                          <div>
                            {req.routedToPayment ? (
                              <Badge variant="success" className="whitespace-nowrap inline-flex items-center gap-1 shrink-0">
                                <ArrowRightCircle className="w-3 h-3 shrink-0" />
                                <span>Routed: {req.paymentTaskId}</span>
                              </Badge>
                            ) : ['Vendor', 'Agent'].includes(req.applicantType) ? (
                              <span className="text-[10px] text-amber-600 font-semibold whitespace-nowrap">Payment Post-Approval</span>
                            ) : (
                              <span className="text-[10px] text-slate-400 whitespace-nowrap">Direct Approval</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Official Approver Attribution Columns */}
                      <td className="py-3.5 px-4 text-xs">
                        {req.status === 'Approved' ? (
                          req.approvedBy?.name ? (
                            <div>
                              <div className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{req.approvedBy.name}</span>
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">{req.approvedBy.employeeId}</div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Approval History Not Available</span>
                          )
                        ) : req.status === 'Rejected' ? (
                          req.rejectedBy?.name ? (
                            <div>
                              <div className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span>{req.rejectedBy.name}</span>
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">{req.rejectedBy.employeeId}</div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Rejection History Not Available</span>
                          )
                        ) : (
                          <span className="text-[11px] text-amber-600 font-medium">Pending Verification</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        {req.status === 'Approved' && req.approvedBy ? (
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{req.approvedBy.role.replace(/_/g, ' ')}</div>
                            <div className="text-[10px] text-slate-400">{req.approvedBy.department}</div>
                          </div>
                        ) : req.status === 'Rejected' && req.rejectedBy ? (
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{req.rejectedBy.role.replace(/_/g, ' ')}</div>
                            <div className="text-[10px] text-slate-400">{req.rejectedBy.department}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300">
                        {pendingText}
                      </td>

                      <td className="py-3.5 px-5 text-right space-x-1.5 whitespace-nowrap">
                        {req.status === 'Unassigned' && (
                          <button
                            onClick={() => handleAutoAssign(req.requestId)}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-semibold text-[11px]"
                          >
                            Auto Assign
                          </button>
                        )}
                        {isLead && (
                          <button
                            onClick={() => {
                              setShowAssignModal(req);
                              setAssignEmployeeId(req.assignedEmployeeId || (kycStaff[0]?.employeeId || ''));
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px]"
                          >
                            {req.assignedEmployeeId ? 'Reassign' : 'Assign'}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedReq(req);
                            setViewedEscalations(prev => new Set(prev).add(req.requestId).add(req._id));
                            setActiveDocIndex(0);
                            setZoomLevel(1);
                            setActionMode('NONE');
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
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
            onLimitChange={nextLim => setLimit(nextLim)}
          />
        </div>
      )}
    </div>
  )}

      {/* Manual Assignment / Reassignment Modal */}
      <Modal
        isOpen={!!showAssignModal}
        onClose={() => setShowAssignModal(null)}
        title={showAssignModal?.assignedEmployeeId ? 'Reassign KYC Request' : 'Manual KYC Assignment'}
        subtitle={`Request: ${showAssignModal?.requestId} (${showAssignModal?.applicantName})`}
        maxWidth="md"
      >
        <form onSubmit={handleManualAssign} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Select KYC Verification Officer
            </label>
            <select
              required
              value={assignEmployeeId}
              onChange={e => setAssignEmployeeId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              <option value="">-- Choose Officer --</option>
              {kycStaff.map(emp => (
                <option key={emp.employeeId} value={emp.employeeId}>
                  {emp.name} ({emp.employeeId})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Assignment / Override Reason
            </label>
            <textarea
              required
              rows={3}
              value={assignReason}
              onChange={e => setAssignReason(e.target.value)}
              placeholder="e.g. Priority onboarding escalation or load balancing..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAssignModal(null)}
              className="px-4 py-2 rounded-xl font-semibold text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              Confirm Assignment
            </button>
          </div>
        </form>
      </Modal>

      {/* Transferred KYC Query Processing Modal */}
      <Modal
        isOpen={!!selectedTransferredQuery}
        onClose={() => setSelectedTransferredQuery(null)}
        title={`Process Transferred KYC Query: ${selectedTransferredQuery?.queryId}`}
        subtitle={`${selectedTransferredQuery?.userName} (${selectedTransferredQuery?.userType})`}
        maxWidth="lg"
      >
        {selectedTransferredQuery && (
          <form onSubmit={handleActionTransferredQuery} className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                {selectedTransferredQuery.subject}
              </div>
              <div className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {selectedTransferredQuery.description}
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-500">
                <span>Transferred from: <strong>{selectedTransferredQuery.transferHistory?.[selectedTransferredQuery.transferHistory?.length - 1]?.transferredByName || selectedTransferredQuery.transferredBy?.name || 'Queries Team'}</strong></span>
                <span>Reason: <strong className="text-amber-600 dark:text-amber-400">{selectedTransferredQuery.transferHistory?.[selectedTransferredQuery.transferHistory?.length - 1]?.reason || selectedTransferredQuery.transferReason || 'Document verification'}</strong></span>
              </div>
            </div>

            {selectedTransferredQuery.messages && selectedTransferredQuery.messages.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Conversation Thread ({selectedTransferredQuery.messages.length})
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                  {selectedTransferredQuery.messages.map((m: any, idx: number) => (
                    <div key={idx} className={`p-2.5 rounded-xl ${m.senderRole === 'user' ? 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'}`}>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                        <span className="font-bold">{m.senderName || m.senderRole}</span>
                        <span>{m.sentAt ? new Date(m.sentAt).toLocaleString() : ''}</span>
                      </div>
                      <div className="text-xs leading-relaxed">{m.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Select KYC Action
              </label>
              <select
                value={transferredAction}
                onChange={e => setTransferredAction(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="IN_PROGRESS">Mark In Progress (Under KYC Verification)</option>
                <option value="RE_KYC_REQUESTED">Trigger Re-KYC Verification for User</option>
                <option value="RESOLVED">Mark Resolved (KYC Verification Complete)</option>
                <option value="TRANSFER_BACK_TO_QUERIES">Transfer Back to Queries Team</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                KYC Officer Notes / Response Instructions
              </label>
              <textarea
                value={transferredNotes}
                onChange={e => setTransferredNotes(e.target.value)}
                placeholder="Enter details on verification outcome or why this case is transferred back..."
                rows={4}
                required
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedTransferredQuery(null)}
                className="px-4 py-2 rounded-xl font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingTransferredAction}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-50"
              >
                {submittingTransferredAction ? 'Processing...' : 'Confirm Action'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Redesigned 3-Panel Registration-Based KYC Verification Workbench */}
      {selectedReq && (
        <KycVerificationWorkbench
          request={selectedReq}
          isOpen={!!selectedReq}
          onClose={() => setSelectedReq(null)}
          onRefresh={() => loadData(page)}
          kycStaff={kycStaff}
          currentUserRole={user?.role}
          currentUserId={user?.employeeId}
        />
      )}
    </div>
  );
};

