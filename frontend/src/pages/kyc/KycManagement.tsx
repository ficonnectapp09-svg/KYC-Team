import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { DepartmentTabHeader, PaginationBar, TabSummaryCounts } from '../../components/common/DepartmentTabHeader';
import { KYC_NAV_CATEGORIES } from '../../config/categoryCatalog';

function formatPendingDuration(submissionDate: string, status: string): string {
  if (status === 'Approved' || status === 'Rejected') return 'Completed';
  const hrs = Math.max(0, Math.round((Date.now() - new Date(submissionDate).getTime()) / (1000 * 60 * 60)));
  if (hrs >= 24) return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
  return `${hrs}h`;
}

export const KycManagement: React.FC = () => {
  const { user } = useAuth();
  const { categorySlug } = useParams<{ categorySlug?: string }>();
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
  const [showAssignModal, setShowAssignModal] = useState<KycRequest | null>(null);
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [assignReason, setAssignReason] = useState('');

  // Document viewer zoom & verification actions
  const [zoomLevel, setZoomLevel] = useState(1);
  const [activeDocIndex, setActiveDocIndex] = useState(0);
  const [actionMode, setActionMode] = useState<'NONE' | 'REJECT' | 'REUPLOAD' | 'ESCALATE' | 'RESUBMIT'>('NONE');
  const [actionReason, setActionReason] = useState('');
  const [reuploadDocType, setReuploadDocType] = useState('');
  const [resubmitUrl, setResubmitUrl] = useState('https://placehold.co/700x450/png?text=Corrected+KYC+Document+v2');
  const [resubmitDocName, setResubmitDocName] = useState('');
  const [uploadingResubmit, setUploadingResubmit] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const loadData = async (targetPage = page) => {
    try {
      setLoading(true);
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
      }
      if (statsRes.success) setStats(statsRes.data || {});

      if (user?.role === 'overall_lead' || user?.role === 'kyc_lead') {
        const staffRes = await apiFetch<Employee[]>('/staff?department=KYC Team');
        if (staffRes.success) {
          setKycStaff((staffRes.data || []).filter(s => s.status === 'active'));
        }
      }
    } catch (err) {
      console.error('Failed to load KYC data:', err);
    } finally {
      setLoading(false);
    }
  };

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

  const getStatusBadge = (status: string) => {
    switch (status) {
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
                  ? 'bg-indigo-600 text-white shadow-sm'
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

      {/* Common Category Header, Scoped KPIs & Unified Filter Bar */}
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
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white text-xs font-bold hover:opacity-90 shadow-sm shrink-0"
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

      {/* Team Lead Employee Workload Matrix */}
      {isLead && stats.employeeWorkload?.length > 0 && (
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            KYC Employee Workload Distribution ({activeCategory.label})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {stats.employeeWorkload.map((w: any) => (
              <div key={w.employeeId} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{w.employeeName}</div>
                  <div className="text-[11px] font-mono text-slate-400">{w.employeeId}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-indigo-600">{w.activeCount} Active</div>
                  <div className="text-[11px] text-emerald-600">{w.completedCount} Completed</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Role-Specific Table */}
      {loading ? (
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
                      <th className="py-3.5 px-4">Status & Payment Route</th>
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
                          : activeCategory.key === 'MANAGER' || activeCategory.key === 'SUB_ADMIN'
                          ? 'Territory / Jurisdiction'
                          : 'Applicant Category'}
                      </th>
                      <th className="py-3.5 px-4">Reg / KYC Submitted</th>
                      <th className="py-3.5 px-4">Assigned Employee</th>
                      <th className="py-3.5 px-4">Verification Status</th>
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

                  return (
                    <tr key={req._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
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
                            ) : activeCategory.key === 'MANAGER' || activeCategory.key === 'SUB_ADMIN' ? (
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

                      <td className="py-3.5 px-4 space-y-1">
                        <div>{getStatusBadge(req.status)}</div>
                        {(activeCategory.key === 'VENDOR' || activeCategory.key === 'AGENT' || activeCategory.key === 'ALL') && (
                          <div>
                            {req.routedToPayment ? (
                              <Badge variant="success">
                                <ArrowRightCircle className="w-3 h-3" />
                                <span>Routed: {req.paymentTaskId}</span>
                              </Badge>
                            ) : ['Vendor', 'Agent'].includes(req.applicantType) ? (
                              <span className="text-[10px] text-amber-600 font-semibold">Payment Post-Approval</span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Direct Approval</span>
                            )}
                          </div>
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

      {/* KYC Document Viewer & Verification Modal */}
      <Modal
        isOpen={!!selectedReq}
        onClose={() => setSelectedReq(null)}
        title={`KYC Verification Workbench: ${selectedReq?.applicantName}`}
        subtitle={`${selectedReq?.requestId} | Type: ${selectedReq?.applicantType}`}
        maxWidth="6xl"
      >
        {selectedReq && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
            {/* Left 2 Columns: Secure Document Viewer */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-x-auto">
                  {selectedReq.documents.map((doc, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setActiveDocIndex(idx);
                        setZoomLevel(1);
                      }}
                      className={`px-3 py-1.5 rounded-xl font-bold border transition-all ${
                        activeDocIndex === idx
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {doc.docType} (v{doc.version})
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-[11px] px-2">{Math.round(zoomLevel * 100)}%</span>
                  <button
                    onClick={() => setZoomLevel(z => Math.min(2.5, z + 0.25))}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Document Canvas */}
              <div className="h-96 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-auto p-4 relative">
                {selectedReq.documents[activeDocIndex] ? (
                  (() => {
                    const url = selectedReq.documents[activeDocIndex].docUrl;
                    const lowerUrl = url.toLowerCase();
                    if (lowerUrl.includes('.pdf') || lowerUrl.includes('/raw/upload/')) {
                      return (
                        <iframe
                          src={url}
                          title={selectedReq.documents[activeDocIndex].docName}
                          className="w-full h-full rounded-lg bg-white"
                        />
                      );
                    }
                    if (
                      lowerUrl.includes('/video/upload/') ||
                      /\.(mp4|webm|mov|avi)(\?|$)/.test(lowerUrl)
                    ) {
                      return (
                        <video
                          src={url}
                          controls
                          className="max-h-full w-full rounded-lg object-contain shadow-xl"
                        />
                      );
                    }
                    return (
                      <img
                        src={url}
                        alt={selectedReq.documents[activeDocIndex].docName}
                        style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.2s ease' }}
                        className="max-h-full rounded-lg object-contain shadow-xl"
                      />
                    );
                  })()
                ) : (
                  <span className="text-slate-500">No document preview available</span>
                )}
              </div>

              {/* Active Document Info & Authorized Download */}
              {selectedReq.documents[activeDocIndex] && (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      {selectedReq.documents[activeDocIndex].docName} (v{selectedReq.documents[activeDocIndex].version || 1})
                    </div>
                    {selectedReq.documents[activeDocIndex].remarks && (
                      <div className="text-[11px] text-rose-600 mt-0.5">
                        Note: {selectedReq.documents[activeDocIndex].remarks}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={selectedReq.documents[activeDocIndex].docUrl}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </a>
                    <Badge variant={selectedReq.documents[activeDocIndex].status === 'Verified' ? 'success' : 'warning'}>
                      {selectedReq.documents[activeDocIndex].status}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Preserved Historical Document Versions */}
              {(selectedReq.previousDocumentVersions?.length || 0) > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="font-bold uppercase tracking-wider text-slate-500 text-[10px] flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Preserved Historical Document Versions ({selectedReq.previousDocumentVersions.length})
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {selectedReq.previousDocumentVersions.map((pv: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-white dark:bg-slate-900">
                        <span>{pv.docType} (v{pv.version}) — {pv.remarks || pv.status}</span>
                        <a href={pv.docUrl} target="_blank" rel="noreferrer" className="text-indigo-600 font-semibold hover:underline">
                          View Archive
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Applicant Info, Audit History & Actions */}
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                <h4 className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                  Applicant Profile
                </h4>
                <div className="font-bold text-sm text-slate-900 dark:text-white">{selectedReq.applicantName}</div>
                <div className="text-slate-500">ID: {selectedReq.applicantId}</div>
                <div className="text-slate-500">Phone: {selectedReq.phone}</div>
                <div className="text-slate-500">Email: {selectedReq.email}</div>
                {['Vendor', 'Agent'].includes(selectedReq.applicantType) && (
                  <div className="mt-2 p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px]">
                    Approval Auto-Routing Active: Approving this {selectedReq.applicantType} creates an automatic Payment Team onboarding task.
                  </div>
                )}
              </div>

              {/* Assignment History */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2 max-h-40 overflow-y-auto">
                <h4 className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                  Assignment Audit Log ({selectedReq.assignmentHistory.length})
                </h4>
                {selectedReq.assignmentHistory.map((h, i) => (
                  <div key={i} className="text-[11px] pb-2 border-b border-slate-200/50 dark:border-slate-700/50 last:border-none">
                    <span className="font-bold text-indigo-600">{h.assignmentType}:</span> Assigned to{' '}
                    <span className="font-semibold">{h.newEmployeeName}</span>
                    {h.previousEmployeeName && ` (from ${h.previousEmployeeName})`}
                    <div className="text-slate-400 text-[10px]">{h.reason}</div>
                  </div>
                ))}
              </div>

              {/* Action Controls */}
              {selectedReq.status !== 'Approved' && (
                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  {actionMode === 'NONE' && (
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={() => handleVerifyAction('APPROVE')}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Approve KYC</span>
                      </button>
                      <button
                        onClick={() => setActionMode('REUPLOAD')}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Request Document Re-upload</span>
                      </button>
                      <button
                        onClick={() => setActionMode('REJECT')}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject Request</span>
                      </button>
                      <button
                        onClick={() => setActionMode('ESCALATE')}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold"
                      >
                        <AlertTriangle className="w-4 h-4" />
                        <span>Escalate to Team Lead</span>
                      </button>
                      {selectedReq.status === 'Re-upload Requested' && (
                        <button
                          onClick={() => setActionMode('RESUBMIT')}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold"
                        >
                          <UploadCloud className="w-4 h-4" />
                          <span>Record Applicant Document Resubmission</span>
                        </button>
                      )}
                    </div>
                  )}

                  {actionMode === 'ESCALATE' && (
                    <div className="space-y-2 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
                      <label className="font-bold text-indigo-800 dark:text-indigo-300">Escalation Reason</label>
                      <textarea
                        rows={2}
                        placeholder="Why does this require KYC Team Lead attention?"
                        value={actionReason}
                        onChange={e => setActionReason(e.target.value)}
                        className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border text-xs"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setActionMode('NONE')} className="flex-1 py-1.5 rounded-lg bg-slate-200 text-slate-700 font-bold">
                          Cancel
                        </button>
                        <button onClick={() => handleVerifyAction('ESCALATE')} className="flex-1 py-1.5 rounded-lg bg-indigo-600 text-white font-bold">
                          Confirm Escalation
                        </button>
                      </div>
                    </div>
                  )}

                  {actionMode === 'RESUBMIT' && (
                    <div className="space-y-2 p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800">
                      <label className="font-bold text-sky-800 dark:text-sky-300">
                        Upload Corrected Image, Video, or Document (v2+)
                      </label>
                      <label className="flex items-center justify-center gap-2 w-full p-2.5 rounded-lg border border-dashed border-sky-400 dark:border-sky-700 bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-300 font-semibold cursor-pointer hover:bg-sky-50 dark:hover:bg-sky-950/50">
                        <UploadCloud className="w-4 h-4" />
                        <span>
                          {uploadingResubmit ? 'Uploading to Cloudinary...' : 'Choose File (Image / Video / PDF / Doc)'}
                        </span>
                        <input
                          type="file"
                          accept="image/*,video/*,.pdf,.doc,.docx"
                          disabled={uploadingResubmit}
                          onChange={handleResubmitFileSelect}
                          className="hidden"
                        />
                      </label>
                      <input
                        type="text"
                        value={resubmitUrl}
                        onChange={e => setResubmitUrl(e.target.value)}
                        placeholder="Cloudinary file URL or external document URL"
                        className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border text-xs"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setActionMode('NONE')} className="flex-1 py-1.5 rounded-lg bg-slate-200 text-slate-700 font-bold">
                          Cancel
                        </button>
                        <button
                          onClick={handleResubmitDoc}
                          disabled={uploadingResubmit || !resubmitUrl.trim()}
                          className="flex-1 py-1.5 rounded-lg bg-sky-600 disabled:opacity-50 text-white font-bold"
                        >
                          Upload & Archive Prior Version
                        </button>
                      </div>
                    </div>
                  )}

                  {actionMode === 'REUPLOAD' && (
                    <div className="space-y-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                      <label className="font-bold text-amber-800 dark:text-amber-300">Document Requiring Re-upload</label>
                      <select
                        value={reuploadDocType || selectedReq.documents[activeDocIndex]?.docType}
                        onChange={e => setReuploadDocType(e.target.value)}
                        className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border text-xs"
                      >
                        {selectedReq.documents.map((d, idx) => (
                          <option key={idx} value={d.docType}>{d.docType}</option>
                        ))}
                      </select>
                      <textarea
                        rows={2}
                        placeholder="Clear re-upload instruction for applicant..."
                        value={actionReason}
                        onChange={e => setActionReason(e.target.value)}
                        className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border text-xs"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setActionMode('NONE')}
                          className="flex-1 py-1.5 rounded-lg bg-slate-200 text-slate-700 font-bold"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleVerifyAction('REQUEST_REUPLOAD')}
                          className="flex-1 py-1.5 rounded-lg bg-amber-600 text-white font-bold"
                        >
                          Send Request
                        </button>
                      </div>
                    </div>
                  )}

                  {actionMode === 'REJECT' && (
                    <div className="space-y-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                      <label className="font-bold text-rose-800 dark:text-rose-300">Mandatory Rejection Reason</label>
                      <textarea
                        rows={3}
                        placeholder="Enter exact verification failure reason..."
                        value={actionReason}
                        onChange={e => setActionReason(e.target.value)}
                        className="w-full p-2 rounded-lg bg-white dark:bg-slate-900 border text-xs"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setActionMode('NONE')}
                          className="flex-1 py-1.5 rounded-lg bg-slate-200 text-slate-700 font-bold"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleVerifyAction('REJECT')}
                          className="flex-1 py-1.5 rounded-lg bg-rose-600 text-white font-bold"
                        >
                          Confirm Rejection
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

