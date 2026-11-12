import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  MessageSquare,
  Send,
  ArrowLeftRight,
  Lock,
  CheckCircle2,
  Plus,
  Eye,
  ShieldAlert,
  UserPlus,
  RotateCcw,
  AlertTriangle,
  Paperclip,
  FileText,
  X
} from 'lucide-react';
import { apiFetch, uploadMediaFile } from '../../services/api';
import { QueryTicket, Employee } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { DepartmentTabHeader, PaginationBar, TabSummaryCounts } from '../../components/common/DepartmentTabHeader';
import { QUERY_NAV_CATEGORIES } from '../../config/categoryCatalog';

export const QueriesManagement: React.FC = () => {
  const { user } = useAuth();
  const { categorySlug } = useParams<{ categorySlug?: string }>();
  const navigate = useNavigate();

  const activeCategory =
    QUERY_NAV_CATEGORIES.find(c => c.slug === (categorySlug || 'all')) || QUERY_NAV_CATEGORIES[0];

  const [queries, setQueries] = useState<QueryTicket[]>([]);
  const [kpis, setKpis] = useState<any>({});
  const [summary, setSummary] = useState<TabSummaryCounts>({});
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [deptStaff, setDeptStaff] = useState<Employee[]>([]);
  const [assigneeId, setAssigneeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [assigneeFilter, setAssigneeFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedQuery, setSelectedQuery] = useState<QueryTicket | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  const [replyMessage, setReplyMessage] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<{ url: string; name: string; resourceType: string }[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [internalNote, setInternalNote] = useState('');
  const [isDeptPrivate, setIsDeptPrivate] = useState(false);

  const [transferDest, setTransferDest] = useState('Payment Team');
  const [transferReason, setTransferReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    userType: 'Customer',
    userId: '',
    userName: '',
    category: 'Service Issue',
    subject: '',
    description: '',
    priority: 'Medium'
  });

  const loadQueries = async (targetPage = page) => {
    try {
      setLoading(true);
      const q = new URLSearchParams();
      q.append('sourceCategory', activeCategory.key);
      q.append('page', String(targetPage));
      q.append('limit', String(limit));
      if (statusFilter !== 'All') q.append('status', statusFilter);
      if (priorityFilter !== 'All') q.append('priority', priorityFilter);
      if (assigneeFilter !== 'All') q.append('assignedEmployeeId', assigneeFilter);
      if (startDate) q.append('startDate', startDate);
      if (endDate) q.append('endDate', endDate);
      if (search) q.append('search', search);

      const [res, kpiRes] = await Promise.all([
        apiFetch<any>(`/queries?${q.toString()}`),
        apiFetch(`/queries/kpis?sourceCategory=${activeCategory.key}`)
      ]);
      if (res.success && res.data) {
        setQueries(res.data);
        setSummary((res as any).summary || {});
        setCategoryCounts((res as any).categoryCounts || {});
        setTotal((res as any).total ?? res.data.length);
        setTotalPages((res as any).totalPages ?? 1);
      }
      if (kpiRes.success && kpiRes.data) {
        setKpis(kpiRes.data);
      }

      if (user?.role === 'overall_lead' || user?.role.includes('lead')) {
        const sRes = await apiFetch<Employee[]>('/staff');
        if (sRes.success) setDeptStaff((sRes.data || []).filter(s => s.status === 'active'));
      }
    } catch (err) {
      console.error('Failed to load queries:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshSelectedQuery = async (queryId: string) => {
    const res = await apiFetch<QueryTicket>(`/queries/${queryId}`);
    if (res.success && res.data) {
      setSelectedQuery(res.data);
    }
  };

  useEffect(() => {
    setPage(1);
    loadQueries(1);
  }, [activeCategory.key, statusFilter, priorityFilter, assigneeFilter, limit]);

  const handleCreateQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/queries', {
        method: 'POST',
        body: JSON.stringify(createForm)
      });
      setFeedback(res.message || 'Query created.');
      setShowCreateModal(false);
      await loadQueries();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUploadReplyAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingAttachment(true);
      const uploaded = await uploadMediaFile(file, 'queries');
      setReplyAttachments((prev) => [
        ...prev,
        {
          url: uploaded.secureUrl,
          name: uploaded.originalFilename,
          resourceType: uploaded.resourceType
        }
      ]);
    } catch (err: any) {
      alert(err.message || 'Failed to upload attachment.');
    } finally {
      setUploadingAttachment(false);
      e.target.value = '';
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuery || !replyMessage.trim()) return;
    try {
      await apiFetch(`/queries/${selectedQuery.queryId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          message: replyMessage,
          attachments: replyAttachments.map((a) => a.url)
        })
      });
      setReplyMessage('');
      setReplyAttachments([]);
      await refreshSelectedQuery(selectedQuery.queryId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuery || !internalNote.trim()) return;
    try {
      await apiFetch(`/queries/${selectedQuery.queryId}/internal-notes`, {
        method: 'POST',
        body: JSON.stringify({ note: internalNote, isDepartmentPrivate: isDeptPrivate })
      });
      setInternalNote('');
      await refreshSelectedQuery(selectedQuery.queryId);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuery) return;
    try {
      const res = await apiFetch(`/queries/${selectedQuery.queryId}/transfer`, {
        method: 'POST',
        body: JSON.stringify({
          destinationDepartment: transferDest,
          reason: transferReason
        })
      });
      setFeedback(res.message || 'Case transferred with shared visibility.');
      setShowTransferModal(false);
      setTransferReason('');
      await refreshSelectedQuery(selectedQuery.queryId);
      await loadQueries();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResolve = async () => {
    if (!selectedQuery) return;
    try {
      await apiFetch(`/queries/${selectedQuery.queryId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ resolutionNotes: 'Resolved via Centralized Backoffice' })
      });
      setFeedback(`Case ${selectedQuery.queryId} marked Resolved. Shared across departments.`);
      await refreshSelectedQuery(selectedQuery.queryId);
      await loadQueries();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAssignQuery = async () => {
    if (!selectedQuery || !assigneeId) return;
    try {
      const res = await apiFetch(`/queries/${selectedQuery.queryId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ employeeId: assigneeId })
      });
      setFeedback(res.message || 'Query assigned.');
      setAssigneeId('');
      await refreshSelectedQuery(selectedQuery.queryId);
      await loadQueries();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleEscalateQuery = async () => {
    if (!selectedQuery) return;
    try {
      const res = await apiFetch(`/queries/${selectedQuery.queryId}/escalate`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'SLA risk escalated to Team Lead / Overall Lead' })
      });
      setFeedback(res.message || 'Query escalated to Urgent.');
      await refreshSelectedQuery(selectedQuery.queryId);
      await loadQueries();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReopenQuery = async () => {
    if (!selectedQuery) return;
    try {
      const res = await apiFetch(`/queries/${selectedQuery.queryId}/reopen`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'Follow-up investigation requested' })
      });
      setFeedback(res.message || 'Query reopened.');
      await refreshSelectedQuery(selectedQuery.queryId);
      await loadQueries();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const resetFilters = () => {
    setStatusFilter('All');
    setPriorityFilter('All');
    setAssigneeFilter('All');
    setStartDate('');
    setEndDate('');
    setSearch('');
    setPage(1);
    setTimeout(() => loadQueries(1), 0);
  };

  const defaultUserTypeForModal = () => {
    switch (activeCategory.key) {
      case 'VENDOR':
        return 'Vendor';
      case 'AGENT':
        return 'Agent';
      case 'MANAGER':
        return 'Manager';
      case 'SUB_ADMIN':
        return 'Sub Admin';
      case 'DELIVERY_PARTNER':
        return 'Delivery Partner';
      case 'TECHNICIAN':
        return 'Technician';
      case 'KYC_TEAM':
        return 'KYC Team';
      case 'PAYMENT_TEAM':
        return 'Payment Team';
      case 'QUERIES_INTERNAL':
        return 'Queries Team Internal';
      default:
        return 'Customer';
    }
  };

  return (
    <div className="space-y-5">
      {/* Horizontal User-Type Query Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 border-b border-slate-200 dark:border-slate-800">
        {QUERY_NAV_CATEGORIES.map(cat => {
          const isActive = activeCategory.key === cat.key;
          const cnt = categoryCounts[cat.key];
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => navigate(`/queries/${cat.slug}`)}
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

      {/* Common Header, Scoped KPIs & Unified Filter Bar */}
      <DepartmentTabHeader
        title={activeCategory.label}
        description={`${activeCategory.description} — Avg Resolution: ${kpis.avgResolutionHours || 0}h | Transferred: ${kpis.transferredToKyc ?? 0} KYC / ${kpis.transferredToPayment ?? 0} Payment`}
        departmentBadge="Queries Operations"
        summary={summary}
        pendingLabel="New / Waiting / Overdue"
        inProgressLabel="Assigned / In Progress"
        completedLabel="Resolved"
        actions={
          <button
            onClick={() => {
              setCreateForm(prev => ({ ...prev, userType: defaultUserTypeForModal() }));
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Support Case</span>
          </button>
        }
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={`Search ${activeCategory.label} by ID, name, subject...`}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        statusOptions={[
          { value: 'All', label: 'All Statuses' },
          { value: 'New', label: 'New' },
          { value: 'Assigned', label: 'Assigned' },
          { value: 'In Progress', label: 'In Progress' },
          { value: 'Waiting for Response', label: 'Waiting for Response' },
          { value: 'Transferred to KYC', label: 'Transferred to KYC' },
          { value: 'Transferred to Payment', label: 'Transferred to Payment' },
          { value: 'Resolved', label: 'Resolved' },
          { value: 'Reopened', label: 'Reopened' }
        ]}
        priorityFilter={priorityFilter}
        onPriorityChange={setPriorityFilter}
        assigneeFilter={assigneeFilter}
        onAssigneeChange={setAssigneeFilter}
        employeeOptions={deptStaff.map(s => ({ employeeId: s.employeeId, name: s.name }))}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApplyFilters={() => {
          setPage(1);
          loadQueries(1);
        }}
        onResetFilters={resetFilters}
      />

      {feedback && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 text-xs text-emerald-800 dark:text-emerald-200">
          <span className="font-semibold">{feedback}</span>
          <button onClick={() => setFeedback(null)} className="font-bold underline">Dismiss</button>
        </div>
      )}

      {/* Role-Specific Query Table */}
      {loading ? (
        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
      ) : queries.length === 0 ? (
        <EmptyState title={`No ${activeCategory.label}`} description="No tickets match your current role tab or filters." icon={MessageSquare} />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">Query ID</th>
                  <th className="py-3.5 px-4">
                    {activeCategory.key === 'VENDOR'
                      ? 'Vendor ID & Business Name'
                      : activeCategory.key === 'CUSTOMER'
                      ? 'Customer ID & Name'
                      : 'Source Party & Role'}
                  </th>
                  <th className="py-3.5 px-4">Category & Subject</th>
                  <th className="py-3.5 px-4">Priority & Created</th>
                  <th className="py-3.5 px-4">Assigned Employee</th>
                  <th className="py-3.5 px-4">Current & Shared Dept</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">View Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {queries.map(q => (
                  <tr key={q._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                      {q.queryId}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{q.userName}</div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {q.userId} | {q.userType}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 max-w-xs truncate">{q.subject}</div>
                      <div className="text-[10px] text-slate-400">{q.category}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={q.priority === 'Urgent' ? 'danger' : q.priority === 'High' ? 'warning' : 'neutral'}>
                        {q.priority}
                      </Badge>
                      <div className="text-[10px] text-slate-400 mt-1">{new Date(q.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {q.assignedEmployeeName ? (
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{q.assignedEmployeeName}</div>
                          {q.assignedEmployeeId && <div className="text-[10px] font-mono text-slate-400">{q.assignedEmployeeId}</div>}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-indigo-600 dark:text-indigo-400">{q.currentDepartment}</div>
                      {q.sharedDepartments.length > 1 && (
                        <div className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold mt-0.5">
                          Shared: {q.sharedDepartments.join(' + ')}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant={q.status === 'Resolved' ? 'success' : q.status.includes('Transferred') ? 'info' : 'warning'}>
                        {q.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => refreshSelectedQuery(q.queryId)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
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
              loadQueries(next);
            }}
            onLimitChange={nextLim => setLimit(nextLim)}
          />
        </div>
      )}

      {/* Case Detail & Shared Visibility Modal */}
      <Modal
        isOpen={!!selectedQuery}
        onClose={() => setSelectedQuery(null)}
        title={`Case ${selectedQuery?.queryId}: ${selectedQuery?.subject}`}
        subtitle={`Owner: ${selectedQuery?.currentDepartment} | Shared Visibility: ${selectedQuery?.sharedDepartments.join(', ')}`}
        maxWidth="4xl"
      >
        {selectedQuery && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
            {/* Conversation Thread */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                  Shared Case Conversation
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedQuery.status !== 'Resolved' ? (
                    <>
                      <button
                        onClick={() => setShowTransferModal(true)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span>Transfer Case</span>
                      </button>
                      <button
                        onClick={handleEscalateQuery}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Escalate</span>
                      </button>
                      <button
                        onClick={handleResolve}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolve</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleReopenQuery}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reopen Case</span>
                    </button>
                  )}
                </div>
              </div>

              {deptStaff.length > 0 && selectedQuery.status !== 'Resolved' && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                  <UserPlus className="w-4 h-4 text-indigo-600 shrink-0" />
                  <select
                    value={assigneeId}
                    onChange={e => setAssigneeId(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <option value="">Assign / Reassign Owner...</option>
                    {deptStaff.map(emp => (
                      <option key={emp.employeeId} value={emp.employeeId}>
                        {emp.name} ({emp.department})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAssignQuery}
                    disabled={!assigneeId}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 disabled:opacity-50 text-white font-bold"
                  >
                    Assign
                  </button>
                </div>
              )}

              <div className="space-y-3 max-h-80 overflow-y-auto p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                {selectedQuery.conversation.map((msg, i) => (
                  <div key={i} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-indigo-600">{msg.senderName} ({msg.senderRole})</span>
                      <span className="text-[10px] text-slate-400">{new Date(msg.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{msg.message}</p>
                    {(msg.attachments?.length || 0) > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {msg.attachments!.map((attUrl, idx) => {
                          const lower = attUrl.toLowerCase();
                          if (/\.(mp4|webm|mov|avi)(\?|$)/.test(lower) || lower.includes('/video/upload/')) {
                            return (
                              <video
                                key={idx}
                                src={attUrl}
                                controls
                                className="max-h-36 rounded-lg border border-slate-200 dark:border-slate-700"
                              />
                            );
                          }
                          if (
                            /\.(png|jpe?g|webp|gif)(\?|$)/.test(lower) ||
                            (lower.includes('/image/upload/') && !lower.includes('.pdf'))
                          ) {
                            return (
                              <a key={idx} href={attUrl} target="_blank" rel="noreferrer">
                                <img
                                  src={attUrl}
                                  alt={`Attachment ${idx + 1}`}
                                  className="max-h-28 rounded-lg border border-slate-200 dark:border-slate-700 object-cover"
                                />
                              </a>
                            );
                          }
                          return (
                            <a
                              key={idx}
                              href={attUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold hover:underline"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Document {idx + 1}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {selectedQuery.status !== 'Resolved' && (
                <div className="space-y-2">
                  {replyAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {replyAttachments.map((att, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-semibold"
                        >
                          <span className="max-w-[160px] truncate">{att.name}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setReplyAttachments((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="hover:text-rose-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <form onSubmit={handleSendReply} className="flex gap-2">
                    <label
                      title="Attach image, video, or document (Cloudinary)"
                      className="inline-flex items-center justify-center px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      <Paperclip className="w-4 h-4" />
                      <input
                        type="file"
                        accept="image/*,video/*,.pdf,.doc,.docx,.csv,.txt"
                        disabled={uploadingAttachment}
                        onChange={handleUploadReplyAttachment}
                        className="hidden"
                      />
                    </label>
                    <input
                      type="text"
                      placeholder={
                        uploadingAttachment
                          ? 'Uploading attachment to Cloudinary...'
                          : 'Write a shared case update or customer reply...'
                      }
                      value={replyMessage}
                      onChange={e => setReplyMessage(e.target.value)}
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                    <button
                      type="submit"
                      disabled={uploadingAttachment}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 disabled:opacity-50 text-white font-bold"
                    >
                      <Send className="w-4 h-4" />
                      <span>Send</span>
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Right: Internal Notes & Transfer Trail */}
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5">
                <h4 className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                  Internal Notes (Department Isolation Applied)
                </h4>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selectedQuery.internalNotes.length === 0 ? (
                    <div className="text-slate-400 italic">No internal notes visible.</div>
                  ) : (
                    selectedQuery.internalNotes.map((n, i) => (
                      <div key={i} className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-[11px]">
                        <div className="flex items-center justify-between font-bold">
                          <span>{n.authorName} ({n.department})</span>
                          {n.isDepartmentPrivate && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] text-amber-600">
                              <Lock className="w-2.5 h-2.5" /> Private
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600 dark:text-slate-300 mt-1">{n.note}</div>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleAddInternalNote} className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <textarea
                    rows={2}
                    placeholder="Add internal operational note..."
                    value={internalNote}
                    onChange={e => setInternalNote(e.target.value)}
                    className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border text-[11px]"
                  />
                  <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={isDeptPrivate}
                      onChange={e => setIsDeptPrivate(e.target.checked)}
                      className="rounded"
                    />
                    <span>Department-Private Only (Hidden from other teams)</span>
                  </label>
                  <button type="submit" className="w-full py-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 text-white font-bold">
                    Save Note
                  </button>
                </form>
              </div>

              {/* Transfer History */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
                <h4 className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                  Shared Transfer Audit Trail
                </h4>
                {selectedQuery.transferHistory.length === 0 ? (
                  <div className="text-slate-400 italic">No department transfers yet.</div>
                ) : (
                  selectedQuery.transferHistory.map((t, i) => (
                    <div key={i} className="text-[11px] pb-2 border-b border-slate-200/50 last:border-none">
                      <div className="font-bold text-sky-600">
                        {t.fromDepartment} -&gt; {t.toDepartment}
                      </div>
                      <div className="text-slate-500 mt-0.5">{t.reason}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">By {t.transferredByName}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Transfer Case Modal */}
      <Modal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        title="Cross-Department Case Transfer"
        subtitle="Preserves Single Linked Case ID & Shared Visibility"
        maxWidth="md"
      >
        <form onSubmit={handleTransfer} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold mb-1">Destination Department</label>
            <select
              value={transferDest}
              onChange={e => setTransferDest(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
            >
              <option value="KYC Team">KYC Team</option>
              <option value="Payment Team">Payment Team</option>
              <option value="Queries Team">Queries Team</option>
            </select>
          </div>
          <div>
            <label className="block font-bold mb-1">Transfer Reason *</label>
            <textarea
              required
              rows={3}
              placeholder="Explain why case requires attention from destination department..."
              value={transferReason}
              onChange={e => setTransferReason(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowTransferModal(false)} className="px-4 py-2">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-sky-600 text-white font-bold">
              Transfer & Preserve Shared Access
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Query Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Support Query"
        maxWidth="md"
      >
        <form onSubmit={handleCreateQuery} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <select
              value={createForm.userType}
              onChange={e => setCreateForm({ ...createForm, userType: e.target.value })}
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
            >
              <option value="Customer">Customer</option>
              <option value="Vendor">Vendor</option>
              <option value="Agent">Agent</option>
              <option value="Manager">Manager</option>
              <option value="Sub Admin">Sub Admin</option>
              <option value="Delivery Partner">Delivery Partner</option>
              <option value="Technician">Technician</option>
              <option value="KYC Team">KYC Team</option>
              <option value="Payment Team">Payment Team</option>
              <option value="Queries Team Internal">Queries Team Internal</option>
            </select>
            <input
              type="text"
              required
              placeholder="User Name"
              value={createForm.userName}
              onChange={e => setCreateForm({ ...createForm, userName: e.target.value })}
              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
            />
          </div>
          <input
            type="text"
            required
            placeholder="Subject"
            value={createForm.subject}
            onChange={e => setCreateForm({ ...createForm, subject: e.target.value })}
            className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
          />
          <textarea
            required
            rows={3}
            placeholder="Detailed Issue Description..."
            value={createForm.description}
            onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
            className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2">Cancel</button>
            <button type="submit" className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold">Create Query</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

