import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Building,
  Phone,
  Mail,
  Shield,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Eye,
  Edit3,
  CalendarCheck2,
  UploadCloud,
  Lock,
  Key,
  Clock,
  Play,
  Square,
  AlertTriangle,
  CreditCard
} from 'lucide-react';
import { apiFetch, uploadMediaFile } from '../../services/api';
import { Employee } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { DepartmentTabHeader, PaginationBar, TabSummaryCounts } from '../../components/common/DepartmentTabHeader';
import { STAFF_DIRECTORY_CATEGORIES } from '../../config/categoryCatalog';

export const StaffManagement: React.FC = () => {
  const { user } = useAuth();
  const { categorySlug } = useParams<{ categorySlug?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'directory' | 'attendance'>('directory');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [attSummary, setAttSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<TabSummaryCounts>({});
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    const openId = searchParams.get('openId');
    const searchParam = searchParams.get('search');
    if (searchParam && search !== searchParam) {
      setSearch(searchParam);
    }
    if (openId && employees.length > 0) {
      const match = employees.find(
        (e) => e.employeeId === openId || (e as any)._id === openId || e.email === openId
      );
      if (match) {
        openProfileOverview(match);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('openId');
        newParams.delete('search');
        navigate({ search: newParams.toString() }, { replace: true });
      }
    }
  }, [searchParams, employees]);

  const visibleStaffCategories = React.useMemo(() => {
    if (!user) return STAFF_DIRECTORY_CATEGORIES;
    if (user.role === 'overall_lead') return STAFF_DIRECTORY_CATEGORIES;
    if (user.department === 'KYC Team') {
      return STAFF_DIRECTORY_CATEGORIES.filter((c) => ['ALL', 'KYC_LEAD', 'KYC_EMPLOYEES'].includes(c.key));
    }
    if (user.department === 'Payment Team') {
      return STAFF_DIRECTORY_CATEGORIES.filter((c) => ['ALL', 'PAYMENT_LEAD', 'PAYMENT_EMPLOYEES'].includes(c.key));
    }
    if (user.department === 'Queries Team') {
      return STAFF_DIRECTORY_CATEGORIES.filter((c) => ['ALL', 'QUERIES_LEAD', 'QUERIES_EMPLOYEES'].includes(c.key));
    }
    return STAFF_DIRECTORY_CATEGORIES.filter((c) => c.key === 'ALL');
  }, [user]);

  const activeCategory = React.useMemo(() => {
    const found = visibleStaffCategories.find((c) => c.slug === (categorySlug || 'all'));
    return found || visibleStaffCategories[0];
  }, [categorySlug, visibleStaffCategories]);

  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [empOverview, setEmpOverview] = useState<any>(null);
  const [profileTab, setProfileTab] = useState<'info' | 'attendance' | 'performance' | 'salary'>('info');

  // Self-service contact edit state
  const [showEditContactModal, setShowEditContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({ phone: '', address: '', workLocation: '' });

  // Self-service bank details edit state
  const [showEditBankModal, setShowEditBankModal] = useState(false);
  const [bankForm, setBankForm] = useState({ bankName: '', accountHolder: '', accountNumber: '', ifscCode: '' });

  // Change password modal state
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Live Shift Attendance State
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [shiftElapsedSeconds, setShiftElapsedSeconds] = useState(0);

  const [attForm, setAttForm] = useState({
    employeeId: user?.employeeId || '',
    status: 'Present',
    leaveType: 'Casual',
    remarks: ''
  });

  // Onboarding form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    department: (user?.department === 'Overall' ? 'KYC Team' : (user?.department || 'KYC Team')) as string,
    designation: 'KYC Executive',
    role: 'kyc_employee',
    employmentType: 'Full-time',
    workLocation: 'Main Operations Center',
    salaryCycle: 'Monthly',
    bankAccountHolder: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankName: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadEmployees = async (targetPage = page) => {
    try {
      setLoading(true);
      setLoadError(null);
      const query = new URLSearchParams();
      query.append('staffCategory', activeCategory.key);
      query.append('page', String(targetPage));
      query.append('limit', String(limit));
      if (deptFilter !== 'All') query.append('department', deptFilter);
      if (statusFilter !== 'All') query.append('status', statusFilter);
      if (startDate) query.append('startDate', startDate);
      if (endDate) query.append('endDate', endDate);
      if (search) query.append('search', search);

      const res = await apiFetch<Employee[]>(`/staff?${query.toString()}`);
      if (res.success && res.data) {
        setEmployees(res.data);
        setSummary((res as any).summary || {});
        setCategoryCounts((res as any).categoryCounts || {});
        setTotal((res as any).total ?? res.data.length);
        setTotalPages((res as any).totalPages ?? 1);
      } else {
        setLoadError((res as any).message || 'Failed to load staff directory.');
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load staff directory.');
    } finally {
      setLoading(false);
    }
  };

  const loadAttendance = async () => {
    try {
      const [listRes, sumRes, todayRes] = await Promise.all([
        apiFetch<any[]>('/attendance'),
        apiFetch<any>('/attendance/summary'),
        apiFetch<any>('/attendance/today-status')
      ]);
      if (listRes.success) setAttendanceRecords(listRes.data || []);
      if (sumRes.success) setAttSummary(sumRes.data);
      if (todayRes.success) {
        setTodayAttendance(todayRes.data);
        if (todayRes.data?.checkInTime && !todayRes.data?.checkOutTime) {
          const elapsed = Math.floor((Date.now() - new Date(todayRes.data.checkInTime).getTime()) / 1000);
          setShiftElapsedSeconds(Math.max(0, elapsed));
        }
      }
    } catch (err) {
      console.error('Failed to load attendance:', err);
    }
  };

  useEffect(() => {
    let timer: any = null;
    if (todayAttendance?.checkInTime && !todayAttendance?.checkOutTime) {
      timer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - new Date(todayAttendance.checkInTime).getTime()) / 1000);
        setShiftElapsedSeconds(Math.max(0, elapsed));
      }, 1000);
    }
    return () => timer && clearInterval(timer);
  }, [todayAttendance]);

  const handleCheckIn = async () => {
    try {
      setSubmitting(true);
      const res = await apiFetch<any>('/attendance/check-in', { method: 'POST' });
      if (res.success) {
        setTodayAttendance(res.data);
        setFeedbackMsg('Checked in successfully. Live shift timer activated.');
        await loadAttendance();
      } else {
        setFeedbackMsg(res.message || 'Check-in failed.');
      }
    } catch (err: any) {
      setFeedbackMsg(err.message || 'Check-in error.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setSubmitting(true);
      const res = await apiFetch<any>('/attendance/check-out', { method: 'POST' });
      if (res.success) {
        setTodayAttendance(res.data);
        setFeedbackMsg(`Checked out successfully. Shift logged: ${res.data?.workHours || 0} hrs.`);
        await loadAttendance();
      } else {
        setFeedbackMsg(res.message || 'Check-out failed.');
      }
    } catch (err: any) {
      setFeedbackMsg(err.message || 'Check-out error.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;
    try {
      setSubmitting(true);
      const res = await apiFetch(`/staff/${selectedEmp.employeeId}/self-profile`, {
        method: 'PUT',
        body: JSON.stringify(contactForm)
      });
      if (res.success && res.data) {
        setSelectedEmp(res.data);
        setShowEditContactModal(false);
        setFeedbackMsg('Contact and workplace details updated successfully.');
        await loadEmployees();
      } else {
        setFeedbackMsg(res.message || 'Failed to update contact info.');
      }
    } catch (err: any) {
      setFeedbackMsg(err.message || 'Failed to update contact info.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;
    try {
      setSubmitting(true);
      const res = await apiFetch(`/staff/${selectedEmp.employeeId}/self-bank`, {
        method: 'PUT',
        body: JSON.stringify(bankForm)
      });
      if (res.success && res.data) {
        setSelectedEmp(res.data);
        setShowEditBankModal(false);
        setFeedbackMsg('Disbursement and payroll bank details updated successfully.');
        await loadEmployees();
      } else {
        setFeedbackMsg(res.message || 'Failed to update bank details.');
      }
    } catch (err: any) {
      setFeedbackMsg(err.message || 'Failed to update bank details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }
    try {
      setSubmitting(true);
      const res = await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      if (res.success) {
        setShowChangePasswordModal(false);
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setFeedbackMsg('Account password changed successfully.');
      } else {
        setPasswordError(res.message || 'Password update failed.');
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Password update error.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadEmployees(1);
  }, [activeCategory.key, deptFilter, statusFilter, startDate, endDate, limit]);

  useEffect(() => {
    loadAttendance();
  }, []);

  const openProfileOverview = async (emp: Employee) => {
    setSelectedEmp(emp);
    setProfileTab('info');
    setEmpOverview(null);
    try {
      const res = await apiFetch<any>(`/staff/${emp.employeeId}/overview`);
      if (res.success) setEmpOverview(res.data);
    } catch (err) {
      console.error('Failed to load employee overview:', err);
    }
  };

  const handleUploadStaffPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingEmp) return;
    try {
      setUploadingPhoto(true);
      const uploaded = await uploadMediaFile(file, 'staff');
      setEditingEmp({ ...editingEmp, photo: uploaded.secureUrl });
    } catch (err: any) {
      alert(err.message || 'Failed to upload profile photo.');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleSaveEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp) return;
    setSubmitting(true);
    try {
      await apiFetch(`/staff/${editingEmp.employeeId}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editingEmp.name,
          phone: editingEmp.phone,
          designation: editingEmp.designation,
          department: editingEmp.department,
          workLocation: editingEmp.workLocation,
          salaryCycle: editingEmp.salaryCycle,
          photo: editingEmp.photo || ''
        })
      });
      setEditingEmp(null);
      await loadEmployees();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/attendance/mark', {
        method: 'POST',
        body: JSON.stringify(attForm)
      });
      setAttForm({ ...attForm, remarks: '' });
      await loadAttendance();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReviewLeave = async (attendanceId: string, decision: 'Approved' | 'Rejected') => {
    try {
      await apiFetch(`/attendance/${attendanceId}/review-leave`, {
        method: 'POST',
        body: JSON.stringify({ decision })
      });
      await loadAttendance();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      await apiFetch('/staff/onboard', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          bankDetails: {
            accountHolder: formData.bankAccountHolder || formData.name,
            accountNumber: formData.bankAccountNumber,
            ifscCode: formData.bankIfsc,
            bankName: formData.bankName
          }
        })
      });

      setShowOnboardModal(false);
      setFormData({
        ...formData,
        name: '',
        email: '',
        phone: '',
        password: '',
        bankAccountHolder: '',
        bankAccountNumber: '',
        bankIfsc: '',
        bankName: ''
      });
      await loadEmployees();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (employeeId: string, newStatus: 'active' | 'inactive' | 'suspended') => {
    try {
      await apiFetch(`/staff/${employeeId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus, reason: `Status updated by ${user?.name}` })
      });
      await loadEmployees();
      if (selectedEmp?.employeeId === employeeId) {
        setSelectedEmp(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const isOverall = user?.role === 'overall_lead';
  const isLead = isOverall || user?.role.includes('lead');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Staff & Hierarchy Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Two-tier onboarding: Overall Lead manages Department Team Leads; Team Leads manage department staff.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              onClick={() => setActiveTab('directory')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'directory'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Staff Directory ({employees.length})
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'attendance'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <CalendarCheck2 className="w-3.5 h-3.5" />
              Attendance & Leave
            </button>
          </div>

          {isLead && (
            <button
              onClick={() => setShowOnboardModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Onboard Staff Member</span>
            </button>
          )}
        </div>
      </div>
      {feedbackMsg && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-xs font-bold underline hover:opacity-80 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {activeTab === 'attendance' ? (
        <div className="space-y-6">
          {/* Live Operational Shift Tracker Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-slate-950 dark:via-indigo-950 text-white border border-indigo-900/60 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`p-3.5 rounded-2xl ${todayAttendance?.checkInTime && !todayAttendance?.checkOutTime ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm tracking-tight text-white">Daily Operational Shift Tracker</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    todayAttendance?.checkOutTime
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : todayAttendance?.checkInTime
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {todayAttendance?.checkOutTime
                      ? 'Shift Completed'
                      : todayAttendance?.checkInTime
                      ? 'Shift In Progress'
                      : 'Not Checked In'}
                  </span>
                </div>
                <div className="text-xs text-slate-300 mt-1 flex items-center gap-3 flex-wrap">
                  <span>Shift Date: <strong>{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</strong></span>
                  {todayAttendance?.checkInTime && (
                    <span>Check-in: <strong className="text-emerald-400">{new Date(todayAttendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
                  )}
                  {todayAttendance?.checkOutTime && (
                    <span>Check-out: <strong className="text-blue-400">{new Date(todayAttendance.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
                  )}
                  {todayAttendance?.workHours !== undefined && todayAttendance.workHours > 0 && (
                    <span>Logged Hours: <strong className="text-amber-300">{todayAttendance.workHours}h</strong></span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {todayAttendance?.checkInTime && !todayAttendance?.checkOutTime && (
                <div className="px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Shift Elapsed</div>
                  <div className="font-mono text-sm font-bold text-emerald-400">
                    {Math.floor(shiftElapsedSeconds / 3600).toString().padStart(2, '0')}:
                    {Math.floor((shiftElapsedSeconds % 3600) / 60).toString().padStart(2, '0')}:
                    {(shiftElapsedSeconds % 60).toString().padStart(2, '0')}
                  </div>
                </div>
              )}

              {!todayAttendance?.checkInTime ? (
                <button
                  type="button"
                  onClick={handleCheckIn}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{submitting ? 'Checking In...' : 'Start Shift (Check-In)'}</span>
                </button>
              ) : !todayAttendance?.checkOutTime ? (
                <button
                  type="button"
                  onClick={handleCheckOut}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>{submitting ? 'Ending Shift...' : 'End Shift (Check-Out)'}</span>
                </button>
              ) : (
                <span className="text-xs font-semibold text-slate-400 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700">
                  Shift Closed for Today
                </span>
              )}
            </div>
          </div>
          {attSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase">Present Today</div>
                <div className="text-2xl font-black text-emerald-600 mt-1">{attSummary.presentToday}</div>
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase">On Leave</div>
                <div className="text-2xl font-black text-amber-600 mt-1">{attSummary.onLeaveToday}</div>
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase">Late Arrival</div>
                <div className="text-2xl font-black text-sky-600 mt-1">{attSummary.lateToday}</div>
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase">Absent</div>
                <div className="text-2xl font-black text-rose-600 mt-1">{attSummary.absentToday}</div>
              </div>
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] font-bold text-slate-400 uppercase">Pending Leave Review</div>
                <div className="text-2xl font-black text-indigo-600 mt-1">{attSummary.pendingLeaveApprovals}</div>
              </div>
            </div>
          )}

          {/* Mark Attendance / Submit Leave Form */}
          <form
            onSubmit={handleMarkAttendance}
            className="grid grid-cols-1 sm:grid-cols-5 gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm items-end text-xs"
          >
            <div>
              <label className="block font-bold text-slate-500 mb-1">Employee</label>
              <select
                value={attForm.employeeId}
                onChange={(e) => setAttForm({ ...attForm, employeeId: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                {employees.map((emp) => (
                  <option key={emp.employeeId} value={emp.employeeId}>
                    {emp.name} ({emp.employeeId})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-500 mb-1">Status</label>
              <select
                value={attForm.status}
                onChange={(e) => setAttForm({ ...attForm, status: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                <option value="Present">Present</option>
                <option value="Remote">Remote</option>
                <option value="Half Day">Half Day</option>
                <option value="Late">Late</option>
                <option value="On Leave">On Leave</option>
                <option value="Absent">Absent</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-500 mb-1">Leave Type (if Leave)</label>
              <select
                value={attForm.leaveType}
                onChange={(e) => setAttForm({ ...attForm, leaveType: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                <option value="Casual">Casual</option>
                <option value="Sick">Sick</option>
                <option value="Earned">Earned</option>
                <option value="Unpaid">Unpaid</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-500 mb-1">Remarks</label>
              <input
                type="text"
                placeholder="Shift or leave reason..."
                value={attForm.remarks}
                onChange={(e) => setAttForm({ ...attForm, remarks: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              Record Attendance
            </button>
          </form>

          {/* Attendance Table */}
          <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Hours / Leave</th>
                  <th className="py-3 px-4 text-right">Lead Approval</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {attendanceRecords.map((rec) => (
                  <tr key={rec.attendanceId}>
                    <td className="py-3 px-4 font-mono">{rec.dateKey}</td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{rec.employeeName}</td>
                    <td className="py-3 px-4">{rec.department}</td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          rec.status === 'Present' || rec.status === 'Remote'
                            ? 'success'
                            : rec.status === 'Absent'
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {rec.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {rec.status === 'On Leave' ? (
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {rec.leaveType || 'Leave'} ({rec.leaveApprovalStatus})
                          </div>
                          {rec.reviewedBy?.name && (
                            <div className="text-[10px] text-slate-400">
                              Reviewed By: {rec.reviewedBy.name} ({rec.reviewedBy.role ? rec.reviewedBy.role.replace(/_/g, ' ') : 'Lead'})
                            </div>
                          )}
                          {rec.leaveReason && (
                            <div className="text-[10px] text-slate-400 italic">
                              "{rec.leaveReason}"
                            </div>
                          )}
                        </div>
                      ) : (
                        `${rec.workHours || 0} hrs`
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      {rec.status === 'On Leave' ? (
                        rec.leaveApprovalStatus === 'Pending' ? (
                          rec.employeeId === user?.employeeId ? (
                            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-800">
                              Pending Review (Self)
                            </span>
                          ) : isLead ? (
                            rec.designation?.toLowerCase().includes('lead') && !isOverall ? (
                              <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-1 rounded-md border border-purple-200 dark:border-purple-800">
                                Pending Overall Lead
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleReviewLeave(rec.attendanceId, 'Approved')}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReviewLeave(rec.attendanceId, 'Rejected')}
                                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors"
                                >
                                  Reject
                                </button>
                              </>
                            )
                          ) : (
                            <span className="text-[11px] text-slate-400">Pending Review</span>
                          )
                        ) : rec.leaveApprovalStatus === 'Approved' ? (
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
                            Approved by {rec.reviewedBy?.name || 'Lead'}
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 rounded-md border border-rose-200 dark:border-rose-800">
                            Rejected by {rec.reviewedBy?.name || 'Lead'}
                          </span>
                        )
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Auto-Recorded Shift</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          <ErrorBanner message={loadError} onRetry={() => loadEmployees(page)} />

          <DepartmentTabHeader
            title={activeCategory.label}
            description={activeCategory.description}
            departmentBadge={user?.department === 'Overall' ? 'All Departments' : `${user?.department || 'Staff'} Directory`}
            summary={summary}
            pendingLabel="Inactive / Leave"
            pendingStatusValue="inactive"
            inProgressLabel="Suspended"
            inProgressStatusValue="suspended"
            completedLabel="Active Staff"
            completedStatusValue="active"
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search Employee ID, name, email, phone, designation..."
            statusFilter={statusFilter}
            onStatusChange={(val) => {
              setStatusFilter(val);
              setSearch('');
              setPage(1);
            }}
            statusOptions={[
              { value: 'All', label: 'All Statuses' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive / Leave' },
              { value: 'suspended', label: 'Suspended' }
            ]}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onApplyFilters={() => {
              setPage(1);
              loadEmployees(1);
            }}
            onResetFilters={() => {
              setSearch('');
              setDeptFilter('All');
              setStatusFilter('All');
              setStartDate('');
              setEndDate('');
              setPage(1);
            }}
            extraFilters={
              isOverall ? (
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none"
                >
                  <option value="All">All Departments</option>
                  <option value="Overall">Overall Leadership</option>
                  <option value="KYC Team">KYC Team</option>
                  <option value="Payment Team">Payment Team</option>
                  <option value="Queries Team">Queries Team</option>
                </select>
              ) : undefined
            }
          />

      {/* Staff List Table */}
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : employees.length === 0 ? (
        <EmptyState
          title="No Staff Found"
          description="No employees match the current filters."
          icon={Users}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-5">Employee</th>
                  <th className="py-3.5 px-4">Department & Role</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Salary Cycle</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {employees.map(emp => {
                  const isSelf = emp.employeeId === user?.employeeId || emp.email === user?.email || (emp as any)._id === (user as any).id;
                  return (
                  <tr
                    key={emp._id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center">
                          {emp.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {emp.name}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {emp.employeeId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {emp.designation}
                      </div>
                      <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                        {emp.department}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3" />
                        <span>{emp.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3" />
                        <span>{emp.phone}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant="neutral">{emp.salaryCycle}</Badge>
                    </td>
                    <td className="py-3.5 px-4">
                      {emp.status === 'active' && (
                        <Badge variant="success">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Active</span>
                        </Badge>
                      )}
                      {emp.status === 'inactive' && (
                        <Badge variant="warning">
                          <PauseCircle className="w-3 h-3" />
                          <span>Inactive</span>
                        </Badge>
                      )}
                      {emp.status === 'suspended' && (
                        <Badge variant="danger">
                          <XCircle className="w-3 h-3" />
                          <span>Suspended</span>
                        </Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right space-x-1.5">
                      {isLead && !isSelf && (
                        <button
                          onClick={() => setEditingEmp(emp)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold transition-colors"
                          title="Edit Staff Details"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      )}
                      <button
                        onClick={() => openProfileOverview(emp)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Profile</span>
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
            onPageChange={(nextPage) => {
              setPage(nextPage);
              loadEmployees(nextPage);
            }}
            onLimitChange={(nextLimit) => {
              setLimit(nextLimit);
              setPage(1);
            }}
          />
        </div>
      )}
        </>
      )}

      {/* Onboard Employee Modal */}
      <Modal
        isOpen={showOnboardModal}
        onClose={() => setShowOnboardModal(false)}
        title="Onboard New Backoffice Staff"
        subtitle="Strict Hierarchical Onboarding Policy Enforced"
        maxWidth="2xl"
      >
        <form onSubmit={handleOnboard} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Mobile Number *
              </label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Initial Account Password *
              </label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Enter initial temporary password"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Department *
              </label>
              <select
                value={formData.department}
                disabled={!isOverall}
                onChange={e => {
                  const dept = e.target.value;
                  let defaultRole = 'kyc_employee';
                  let defaultDesig = 'KYC Verification Officer';
                  if (dept === 'Payment Team') {
                    defaultRole = 'payment_employee';
                    defaultDesig = 'Payment Operations Officer';
                  } else if (dept === 'Queries Team') {
                    defaultRole = 'queries_employee';
                    defaultDesig = 'Queries Support Specialist';
                  }
                  setFormData({ ...formData, department: dept, role: defaultRole, designation: defaultDesig });
                }}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs disabled:opacity-70"
              >
                <option value="KYC Team">KYC Team</option>
                <option value="Payment Team">Payment Team</option>
                <option value="Queries Team">Queries Team</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                System Role *
              </label>
              <select
                value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              >
                {isOverall && <option value="kyc_lead">KYC Team Lead</option>}
                {isOverall && <option value="payment_lead">Payment Team Lead</option>}
                {isOverall && <option value="queries_lead">Queries Team Lead</option>}
                <option value="kyc_employee">KYC Team Employee</option>
                <option value="payment_employee">Payment Team Employee</option>
                <option value="queries_employee">Queries Team Employee</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Designation Title *
              </label>
              <input
                type="text"
                required
                value={formData.designation}
                onChange={e => setFormData({ ...formData, designation: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Salary Cycle
              </label>
              <select
                value={formData.salaryCycle}
                onChange={e => setFormData({ ...formData, salaryCycle: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              >
                <option value="Monthly">Monthly</option>
                <option value="Weekly">Weekly</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Work Location
              </label>
              <input
                type="text"
                value={formData.workLocation}
                onChange={e => setFormData({ ...formData, workLocation: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Bank Details (Protected & Masked)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Account Number"
                autoComplete="off"
                value={formData.bankAccountNumber}
                onChange={e => setFormData(prev => ({ ...prev, bankAccountNumber: e.target.value }))}
                className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              />
              <input
                type="text"
                placeholder="IFSC Code"
                autoComplete="off"
                value={formData.bankIfsc}
                onChange={e => setFormData(prev => ({ ...prev, bankIfsc: e.target.value }))}
                className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              />
              <input
                type="text"
                placeholder="Bank Name"
                autoComplete="off"
                value={formData.bankName}
                onChange={e => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowOnboardModal(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md disabled:opacity-50"
            >
              {submitting ? 'Onboarding...' : 'Complete Onboarding'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Employee Modal */}
      <Modal
        isOpen={!!editingEmp}
        onClose={() => setEditingEmp(null)}
        title="Edit Employee Details"
        subtitle={editingEmp?.employeeId}
        maxWidth="lg"
      >
        {editingEmp && (
          <form onSubmit={handleSaveEditEmployee} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editingEmp.name}
                  onChange={(e) => setEditingEmp({ ...editingEmp, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Phone</label>
                <input
                  type="text"
                  required
                  value={editingEmp.phone}
                  onChange={(e) => setEditingEmp({ ...editingEmp, phone: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Designation</label>
                <input
                  type="text"
                  required
                  value={editingEmp.designation}
                  onChange={(e) => setEditingEmp({ ...editingEmp, designation: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Work Location</label>
                <input
                  type="text"
                  value={editingEmp.workLocation}
                  onChange={(e) => setEditingEmp({ ...editingEmp, workLocation: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
              {isOverall && (
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Department</label>
                  <select
                    value={editingEmp.department}
                    onChange={(e) => setEditingEmp({ ...editingEmp, department: e.target.value as any })}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="Overall">Overall</option>
                    <option value="KYC Team">KYC Team</option>
                    <option value="Payment Team">Payment Team</option>
                    <option value="Queries Team">Queries Team</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Salary Cycle</label>
                <select
                  value={editingEmp.salaryCycle}
                  onChange={(e) => setEditingEmp({ ...editingEmp, salaryCycle: e.target.value as any })}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <option value="Monthly">Monthly</option>
                  <option value="Weekly">Weekly</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Profile Photo (Cloudinary)
                </label>
                <div className="flex items-center gap-3">
                  {editingEmp.photo ? (
                    <img
                      src={editingEmp.photo}
                      alt={editingEmp.name}
                      className="w-11 h-11 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center">
                      {editingEmp.name.charAt(0)}
                    </div>
                  )}
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-semibold cursor-pointer">
                    <UploadCloud className="w-4 h-4 text-indigo-600" />
                    <span>{uploadingPhoto ? 'Uploading...' : 'Upload Profile Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingPhoto}
                      onChange={handleUploadStaffPhoto}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => setEditingEmp(null)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold">
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold">
                {submitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Staff Profile Modal with Tabs: Profile, Attendance, Performance, Salary & Activity */}
      <Modal
        isOpen={!!selectedEmp}
        onClose={() => setSelectedEmp(null)}
        title="Employee 360° Operational Profile"
        subtitle={selectedEmp?.employeeId}
        maxWidth="6xl"
        fullScreen={true}
      >
        {selectedEmp && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
              <div className="flex items-center gap-4">
                {selectedEmp.photo ? (
                  <img
                    src={selectedEmp.photo}
                    alt={selectedEmp.name}
                    className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white text-xl font-bold flex items-center justify-center">
                    {selectedEmp.name.charAt(0)}
                  </div>
                )}
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">{selectedEmp.name}</h4>
                  <p className="text-indigo-600 dark:text-indigo-400 font-semibold">
                    {selectedEmp.designation} ({selectedEmp.department})
                  </p>
                </div>
              </div>
              <Badge variant={selectedEmp.status === 'active' ? 'success' : 'danger'}>
                {selectedEmp.status.toUpperCase()}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
              {([
                ['info', 'Profile & Controls'],
                ['attendance', 'Attendance'],
                ['performance', 'Performance & Tasks'],
                ['salary', 'Salary & Activity History']
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setProfileTab(key)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                    profileTab === key
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {profileTab === 'info' && (
              <div className="space-y-4">
                {/* Contact & Location */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Contact & Workplace Details
                    </div>
                    {(selectedEmp.employeeId === user?.employeeId || selectedEmp.email === user?.email || (selectedEmp as any)._id === (user as any).id) && (
                      <button
                        type="button"
                        onClick={() => {
                          setContactForm({
                            phone: selectedEmp.phone || '',
                            address: selectedEmp.address || '',
                            workLocation: selectedEmp.workLocation || ''
                          });
                          setShowEditContactModal(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 font-bold text-[11px] transition-colors"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit Details</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <div className="text-slate-400 font-bold text-[10px] uppercase">Email</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 truncate" title={selectedEmp.email}>{selectedEmp.email}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-bold text-[10px] uppercase">Phone</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedEmp.phone || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-bold text-[10px] uppercase">Work Location</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedEmp.workLocation || 'Main Office'}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-bold text-[10px] uppercase">Residential Address</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 truncate" title={selectedEmp.address || 'Not Provided'}>{selectedEmp.address || 'Not Provided'}</div>
                    </div>
                  </div>
                </div>

                {/* Employment & Role Context */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Employment & Organizational Hierarchy
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <div className="text-slate-400 font-bold text-[10px] uppercase">Department</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedEmp.department}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-bold text-[10px] uppercase">Designation / Role</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedEmp.designation} ({selectedEmp.role})</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-bold text-[10px] uppercase">Employment Type</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedEmp.employmentType || 'Full-time'}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-bold text-[10px] uppercase">Joining Date</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {selectedEmp.joiningDate ? new Date(selectedEmp.joiningDate).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-bold text-[10px] uppercase">Reporting Lead</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedEmp.reportingLead || 'Department Lead'}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-bold text-[10px] uppercase">Salary Cycle</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedEmp.salaryCycle || 'Monthly'}</div>
                    </div>
                  </div>
                </div>

                {/* Operational Permissions */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Authorized Permissions & Operational Scopes
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedEmp.permissions && selectedEmp.permissions.length > 0 ? (
                      selectedEmp.permissions.map((p, idx) => (
                        <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {p}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 text-xs">Standard operational scope for {selectedEmp.role}</span>
                    )}
                  </div>
                </div>

                {/* Bank & Payroll Info */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Disbursement & Payroll Bank Details
                    </div>
                    {(selectedEmp.employeeId === user?.employeeId || selectedEmp.email === user?.email || (selectedEmp as any)._id === (user as any).id) && (
                      <button
                        type="button"
                        onClick={() => {
                          setBankForm({
                            bankName: selectedEmp.bankDetails?.bankName || '',
                            accountHolder: selectedEmp.bankDetails?.accountHolder || selectedEmp.name,
                            accountNumber: selectedEmp.bankDetails?.accountNumber || '',
                            ifscCode: selectedEmp.bankDetails?.ifscCode || ''
                          });
                          setShowEditBankModal(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 font-bold text-[11px] transition-colors"
                      >
                        <CreditCard className="w-3 h-3" />
                        <span>Edit Bank Info</span>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <div className="text-slate-400 font-bold text-[10px] uppercase">Bank Name</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedEmp.bankDetails?.bankName || 'Not Provided'}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-bold text-[10px] uppercase">Account Holder</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedEmp.bankDetails?.accountHolder || selectedEmp.name}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-bold text-[10px] uppercase">Account Number</div>
                      <div className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {selectedEmp.bankDetails?.accountNumber ? `••••${selectedEmp.bankDetails.accountNumber.slice(-4)}` : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-bold text-[10px] uppercase">IFSC Code</div>
                      <div className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedEmp.bankDetails?.ifscCode || 'N/A'}</div>
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Account Controls (Preserves Audit History)
                  </span>
                  {(selectedEmp.employeeId === user?.employeeId || selectedEmp.email === user?.email || (selectedEmp as any)._id === (user as any).id) ? (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 italic">
                        Self-modification of status is locked to safeguard audit integrity.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                          setPasswordError(null);
                          setShowChangePasswordModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm transition-colors"
                      >
                        <Key className="w-3.5 h-3.5" />
                        <span>Change Password</span>
                      </button>
                    </div>
                  ) : isLead ? (
                    <div className="flex gap-2">
                        {selectedEmp.status !== 'active' && (
                          <button
                            onClick={() => handleStatusChange(selectedEmp.employeeId, 'active')}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                          >
                            Activate
                          </button>
                        )}
                        {selectedEmp.status === 'active' && (
                          <button
                            onClick={() => handleStatusChange(selectedEmp.employeeId, 'inactive')}
                            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold"
                          >
                            Mark On Leave / Inactive
                          </button>
                        )}
                        {selectedEmp.status !== 'suspended' && (
                          <button
                            onClick={() => handleStatusChange(selectedEmp.employeeId, 'suspended')}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold"
                          >
                            Suspend
                          </button>
                        )}
                      </div>
                    ) : null}
                </div>
              </div>
            )}

            {profileTab === 'attendance' && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {!(empOverview?.attendance?.length > 0) ? (
                  <div className="p-4 text-slate-400">No attendance history logged yet.</div>
                ) : (
                  empOverview.attendance.map((a: any) => (
                    <div key={a.attendanceId} className="flex justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                      <span className="font-mono font-bold">{a.dateKey}</span>
                      <span>{a.status} ({a.workHours}h)</span>
                      <span className="text-slate-400">{a.remarks || '—'}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {profileTab === 'performance' && (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Total Tasks</div>
                    <div className="text-lg font-black">{empOverview?.performance?.totalTasks ?? 0}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Completion</div>
                    <div className="text-lg font-black text-emerald-600">{empOverview?.performance?.completionRate ?? 0}%</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">KYC Handled</div>
                    <div className="text-lg font-black">{empOverview?.performance?.kycAssignedCount ?? 0}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Queries</div>
                    <div className="text-lg font-black">{empOverview?.performance?.queriesAssignedCount ?? 0}</div>
                  </div>
                </div>
              </div>
            )}

            {profileTab === 'salary' && (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                <div>
                  <div className="font-bold text-slate-700 dark:text-slate-300 mb-1.5">Salary Statements</div>
                  {!(empOverview?.salaryHistory?.length > 0) ? (
                    <div className="text-slate-400">No salary statements recorded yet.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {empOverview.salaryHistory.map((s: any) => (
                        <div key={s.salaryId} className="flex justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                          <span className="font-semibold">{s.periodLabel} ({s.salaryId})</span>
                          <span className="font-bold">₹{s.netSalary?.toLocaleString()}</span>
                          <Badge variant={s.status === 'Paid' ? 'success' : 'warning'}>{s.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-bold text-slate-700 dark:text-slate-300 mb-1.5">Recent Audit Activity</div>
                  {!(empOverview?.recentActivity?.length > 0) ? (
                    <div className="text-slate-400">No activity logs recorded yet.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {empOverview.recentActivity.map((act: any, idx: number) => (
                        <div key={idx} className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                          <div className="font-bold">{act.action}</div>
                          <div className="text-slate-500">{act.details}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Self-Service Contact Details Modal */}
      <Modal
        isOpen={showEditContactModal}
        onClose={() => setShowEditContactModal(false)}
        title="Update Contact & Workplace Information"
        subtitle={selectedEmp?.employeeId}
        maxWidth="md"
      >
        <form onSubmit={handleSaveContact} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Mobile Phone Number *
            </label>
            <input
              type="text"
              required
              value={contactForm.phone}
              onChange={e => setContactForm({ ...contactForm, phone: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Work Location *
            </label>
            <input
              type="text"
              required
              value={contactForm.workLocation}
              onChange={e => setContactForm({ ...contactForm, workLocation: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Residential Address
            </label>
            <textarea
              rows={3}
              value={contactForm.address}
              onChange={e => setContactForm({ ...contactForm, address: e.target.value })}
              placeholder="Enter current residential address..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowEditContactModal(false)}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-50 shadow-sm"
            >
              {submitting ? 'Saving...' : 'Save Contact Details'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Self-Service Bank Details Modal */}
      <Modal
        isOpen={showEditBankModal}
        onClose={() => setShowEditBankModal(false)}
        title="Update Disbursement & Payroll Bank Details"
        subtitle={selectedEmp?.employeeId}
        maxWidth="md"
      >
        <form onSubmit={handleSaveBank} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Bank Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. HDFC Bank, State Bank of India"
              value={bankForm.bankName}
              onChange={e => setBankForm({ ...bankForm, bankName: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Account Holder Name *
            </label>
            <input
              type="text"
              required
              value={bankForm.accountHolder}
              onChange={e => setBankForm({ ...bankForm, accountHolder: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Account Number *
            </label>
            <input
              type="text"
              required
              autoComplete="off"
              value={bankForm.accountNumber}
              onChange={e => setBankForm({ ...bankForm, accountNumber: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              IFSC Code *
            </label>
            <input
              type="text"
              required
              autoComplete="off"
              value={bankForm.ifscCode}
              onChange={e => setBankForm({ ...bankForm, ifscCode: e.target.value.toUpperCase() })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs uppercase"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowEditBankModal(false)}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-50 shadow-sm"
            >
              {submitting ? 'Saving...' : 'Save Bank Details'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        isOpen={showChangePasswordModal}
        onClose={() => {
          setShowChangePasswordModal(false);
          setPasswordError(null);
        }}
        title="Change Account Password"
        subtitle="Secure Password Modification"
        maxWidth="md"
      >
        <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
          {passwordError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
              {passwordError}
            </div>
          )}

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Current Password *
            </label>
            <input
              type="password"
              required
              value={passwordForm.currentPassword}
              onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              New Password *
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={passwordForm.newPassword}
              onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Confirm New Password *
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={passwordForm.confirmPassword}
              onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setShowChangePasswordModal(false);
                setPasswordError(null);
              }}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-50 shadow-sm"
            >
              {submitting ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
