import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  FileText,
  Image as ImageIcon,
  Film,
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Briefcase,
  Calendar,
  Clock,
  Search,
  Check,
  ChevronDown,
  ChevronUp,
  History,
  ShieldCheck,
  UserCheck,
  ExternalLink,
  Archive,
  FileWarning,
  FileCheck,
  Lock,
  EyeOff
} from 'lucide-react';
import JSZip from 'jszip';
import { KycRequest, Employee } from '../../types';
import { Badge } from '../common/Badge';
import { apiFetch, getAuthToken } from '../../services/api';

interface KycVerificationWorkbenchProps {
  request: KycRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  kycStaff: Employee[];
  currentUserRole?: string;
  currentUserId?: string;
}

// Helper to resolve document URLs: handles Cloudinary public IDs, local files, or full URLs
export const resolveDocumentUrl = (rawUrl?: string): string => {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }
  // Cloudinary public ID or short identifier
  if (/^[a-zA-Z0-9_\-\/]+$/.test(trimmed)) {
    return `https://res.cloudinary.com/r6vovvet/image/upload/${trimmed}`;
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

// Category-specific mandatory document checklists
const CATEGORY_DOC_CHECKLIST: Record<string, string[]> = {
  Vendor: ['PAN Card', 'Aadhaar Card', 'GST Certificate', 'Business Registration', 'Storefront / Business Photos', 'Bank Proof'],
  Agent: ['Aadhaar Card', 'PAN Card', 'Passport Photograph', 'Specimen Signature', 'Cancelled Cheque', 'Educational Certificate'],
  Manager: ['Aadhaar Card', 'PAN Card', 'Passport Photograph', 'Specimen Signature', 'Bank Passbook / Cheque', 'Degree Certificate'],
  'Delivery Partner': ['Driving License', 'Vehicle RC', 'Commercial Insurance', 'Aadhaar Card', 'Profile Photo'],
  Technician: ['Trade Certificate / ITI', 'Aadhaar Card', 'PAN Card', 'Workshop / Profile Photo'],
  'KYC Team Employee': ['Background Verification (BGV) Report', 'Aadhaar / ID Proof', 'PAN Card', 'Degree Certificate', 'Offer Letter'],
  'Payment Team Employee': ['PAN & Bank Verification', 'Aadhaar / ID Proof', 'Background Clearance', 'Offer Letter'],
  'Queries Team Employee': ['Aadhaar / ID Proof', 'Offer Letter', 'Educational Certificate', 'PAN Card'],
  Customer: ['Aadhaar Card / ID Proof', 'Address Proof']
};

export const KycVerificationWorkbench: React.FC<KycVerificationWorkbenchProps> = ({
  request,
  isOpen,
  onClose,
  onRefresh,
  kycStaff,
  currentUserRole,
  currentUserId
}) => {
  // Viewport / Maximize state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Document Selection & Navigation
  const [activeDocIndex, setActiveDocIndex] = useState(0);
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [docSearch, setDocSearch] = useState('');
  const [docStatusFilter, setDocStatusFilter] = useState<'All' | 'Pending' | 'Verified' | 'Re-upload Required'>('All');

  // Previewer Controls
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [fitToScreen, setFitToScreen] = useState(true);
  const [previewError, setPreviewError] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  // ZIP Download State
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [zipProgressText, setZipProgressText] = useState<string | null>(null);

  // Accordion Sections State (Open by default: Personal, Category Details, Actions)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    overview: true,
    personal: true,
    address: true,
    identity: true,
    categoryDetails: true,
    bank: true,
    checklist: true,
    assignment: true,
    attribution: true,
    actions: true
  });

  const toggleSection = (sec: string) => {
    setOpenSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  // Action Modes
  const [actionMode, setActionMode] = useState<'NONE' | 'APPROVE' | 'REJECT' | 'REUPLOAD' | 'ESCALATE' | 'RESUBMIT'>('NONE');
  const [actionRemarks, setActionRemarks] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [selectedDocForReupload, setSelectedDocForReupload] = useState('');
  const [resubmitDocUrl, setResubmitDocUrl] = useState('');
  const [resubmitDocName, setResubmitDocName] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Re-fetch fresh request data upon mount
  const [liveReq, setLiveReq] = useState<KycRequest | null>(request);

  // Controlled sensitive identifier reveal state
  const [unmaskedSensitive, setUnmaskedSensitive] = useState<{
    pan?: string;
    aadhaar?: string;
    gst?: string;
    bankAccount?: string;
    ifsc?: string;
  } | null>(null);
  const [revealingSensitive, setRevealingSensitive] = useState(false);

  const handleRevealSensitive = async () => {
    if (!liveReq?.requestId) return;
    // Reversible toggle: if already unmasked, clicking again re-masks the data
    if (unmaskedSensitive) {
      setUnmaskedSensitive(null);
      return;
    }
    try {
      setRevealingSensitive(true);
      const res = await apiFetch<any>(`/kyc/requests/${liveReq.requestId}/reveal-sensitive`, {
        method: 'POST'
      });
      if (res.success && res.data) {
        setUnmaskedSensitive(res.data);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to reveal sensitive details.');
    } finally {
      setRevealingSensitive(false);
    }
  };

  useEffect(() => {
    if (request) {
      setLiveReq(request);
      setActiveDocIndex(0);
      setActiveSide('front');
      setUnmaskedSensitive(null);
    }
  }, [request]);

  useEffect(() => {
    if (!request?.requestId) return;
    let isMounted = true;
    const fetchFresh = async () => {
      try {
        const res = await apiFetch<KycRequest>(`/kyc/requests/${request.requestId}`);
        if (isMounted && res.success && res.data) {
          setLiveReq(res.data);
        }
      } catch (err) {
        // Fallback to initial prop
      }
    };
    fetchFresh();
    return () => {
      isMounted = false;
    };
  }, [request?.requestId]);

  // Reset viewer controls when active document changes
  useEffect(() => {
    setZoomLevel(1);
    setRotationDeg(0);
    setPreviewError(false);
    setActiveSide('front');
  }, [activeDocIndex]);

  // All documents list
  const documents = liveReq?.documents || [];
  const activeDoc = documents[activeDocIndex] || documents[0] || null;

  // Filtered documents list based on search and status
  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      const matchSearch =
        !docSearch ||
        doc.docName.toLowerCase().includes(docSearch.toLowerCase()) ||
        doc.docType.toLowerCase().includes(docSearch.toLowerCase());
      const matchStatus =
        docStatusFilter === 'All' || doc.status === docStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [documents, docSearch, docStatusFilter]);

  // Dynamic Grouping of Documents
  const categorizedDocs = useMemo(() => {
    const groups: {
      identity: typeof documents;
      business: typeof documents;
      qualification: typeof documents;
      bank: typeof documents;
      other: typeof documents;
    } = {
      identity: [],
      business: [],
      qualification: [],
      bank: [],
      other: []
    };

    documents.forEach((doc, idx) => {
      const typeLower = (doc.docType || '').toLowerCase();
      const nameLower = (doc.docName || '').toLowerCase();
      const combined = `${typeLower} ${nameLower}`;

      if (combined.includes('pan') || combined.includes('aadhaar') || combined.includes('passport') || combined.includes('voter') || combined.includes('id proof')) {
        groups.identity.push(doc);
      } else if (combined.includes('gst') || combined.includes('license') || combined.includes('registration') || combined.includes('store') || combined.includes('shop') || combined.includes('authority')) {
        groups.business.push(doc);
      } else if (combined.includes('degree') || combined.includes('iti') || combined.includes('driving') || combined.includes('rc') || combined.includes('insurance') || combined.includes('bgv') || combined.includes('background') || combined.includes('offer')) {
        groups.qualification.push(doc);
      } else if (combined.includes('bank') || combined.includes('cheque') || combined.includes('passbook') || combined.includes('statement')) {
        groups.bank.push(doc);
      } else {
        groups.other.push(doc);
      }
    });

    return groups;
  }, [documents]);

  // Missing documents determination
  const missingDocs = useMemo(() => {
    const checklist = CATEGORY_DOC_CHECKLIST[liveReq?.applicantType || ''] || [];
    const uploadedNames = documents.map(d => (d.docType || '').toLowerCase());
    return checklist.filter(reqDoc => {
      const needle = reqDoc.toLowerCase();
      return !uploadedNames.some(u => u.includes(needle) || needle.includes(u));
    });
  }, [liveReq?.applicantType, documents]);

  // Queue Duration Formatter
  const queueDuration = useMemo(() => {
    if (!liveReq?.submissionDate) return '-';
    if (liveReq.status === 'Approved' || liveReq.status === 'Rejected') return 'Completed';
    const hrs = Math.max(0, Math.round((Date.now() - new Date(liveReq.submissionDate).getTime()) / (1000 * 60 * 60)));
    if (hrs >= 24) return `${Math.floor(hrs / 24)}d ${hrs % 24}h in Queue`;
    return `${hrs}h in Queue`;
  }, [liveReq?.submissionDate, liveReq?.status]);

  // Single Document Download Handler
  const handleDownloadSingle = (e: React.MouseEvent, docUrl: string, docName: string) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = docUrl;
    link.target = '_blank';
    link.download = docName || 'document';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // "Download All Documents (ZIP)" Handler
  const handleDownloadAllZip = async () => {
    if (!liveReq || documents.length === 0) return;
    setDownloadingZip(true);
    setZipProgressText('Initiating secure archive download...');

    try {
      // 1. Try Backend Streaming ZIP endpoint
      const token = getAuthToken() || localStorage.getItem('token') || '';
      const zipUrl = `/api/kyc/requests/${liveReq.requestId}/download-zip`;

      const response = await fetch(zipUrl, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const cleanName = liveReq.applicantName.replace(/[^a-zA-Z0-9_]/g, '_');
        a.download = `${liveReq.requestId}_${cleanName}_KYC_Documents.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        setZipProgressText('Download completed successfully!');
        setTimeout(() => setDownloadingZip(false), 1500);
        return;
      }
    } catch (backendErr) {
      console.warn('Backend ZIP fetch error, running client-side JSZip packaging:', backendErr);
    }

    // 2. Client-Side JSZip Fallback
    try {
      setZipProgressText(`Packaging ${documents.length} files client-side...`);
      const zip = new JSZip();

      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const resolvedDocUrl = resolveDocumentUrl(doc.docUrl);
        if (!resolvedDocUrl) continue;
        setZipProgressText(`Fetching ${doc.docName || doc.docType} (${i + 1}/${documents.length})...`);
        try {
          const fileRes = await fetch(resolvedDocUrl);
          if (fileRes.ok) {
            const buffer = await fileRes.arrayBuffer();
            let ext = 'png';
            const lower = (resolvedDocUrl + ' ' + doc.docName).toLowerCase();
            if (lower.includes('.pdf')) ext = 'pdf';
            else if (lower.includes('.jpg') || lower.includes('.jpeg')) ext = 'jpg';
            else if (lower.includes('.webp')) ext = 'webp';

            const cleanDocName = (doc.docName || doc.docType).replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/\.[a-zA-Z0-9]+$/, '');
            const filename = `${cleanDocName}_v${doc.version || 1}.${ext}`;
            zip.file(filename, buffer);
          }
        } catch (fetchErr) {
          console.warn(`Could not package ${doc.docUrl}`, fetchErr);
        }
      }

      setZipProgressText('Generating ZIP bundle...');
      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      const cleanName = liveReq.applicantName.replace(/[^a-zA-Z0-9_]/g, '_');
      a.download = `${liveReq.requestId}_${cleanName}_KYC_Documents.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setZipProgressText('Download completed!');
      setTimeout(() => setDownloadingZip(false), 1500);
    } catch (err: any) {
      setZipProgressText(`Error downloading ZIP: ${err.message || 'Unknown'}`);
      setTimeout(() => setDownloadingZip(false), 2500);
    }
  };

  // KYC Actions Execution Handler
  const handleExecuteAction = async (actionType: 'APPROVE' | 'REJECT' | 'REUPLOAD' | 'ESCALATE' | 'RESUBMIT') => {
    if (!liveReq) return;
    setActionFeedback(null);
    setSubmittingAction(true);

    try {
      if (actionType === 'APPROVE') {
        await apiFetch('/kyc/verify', {
          method: 'POST',
          body: JSON.stringify({
            requestId: liveReq.requestId,
            action: 'APPROVE',
            remarks: actionRemarks || 'Documents and registration details verified.'
          })
        });
        setActionFeedback({
          type: 'success',
          message: `KYC for ${liveReq.applicantName} approved successfully.${
            ['Vendor', 'Agent'].includes(liveReq.applicantType) ? ' Payment onboarding task automatically routed.' : ''
          }`
        });
      } else if (actionType === 'REJECT') {
        if (!actionReason.trim()) {
          setActionFeedback({ type: 'error', message: 'Rejection reason is mandatory.' });
          setSubmittingAction(false);
          return;
        }
        await apiFetch('/kyc/verify', {
          method: 'POST',
          body: JSON.stringify({
            requestId: liveReq.requestId,
            action: 'REJECT',
            reason: actionReason.trim()
          })
        });
        setActionFeedback({ type: 'success', message: 'KYC Request marked as Rejected.' });
      } else if (actionType === 'REUPLOAD') {
        if (!selectedDocForReupload || !actionReason.trim()) {
          setActionFeedback({ type: 'error', message: 'Please select a document and specify the re-upload instructions.' });
          setSubmittingAction(false);
          return;
        }
        await apiFetch('/kyc/verify', {
          method: 'POST',
          body: JSON.stringify({
            requestId: liveReq.requestId,
            action: 'REQUEST_REUPLOAD',
            documentType: selectedDocForReupload,
            reason: actionReason.trim()
          })
        });
        setActionFeedback({ type: 'success', message: `Re-upload requested for ${selectedDocForReupload}.` });
      } else if (actionType === 'ESCALATE') {
        await apiFetch(`/kyc/requests/${liveReq.requestId}/escalate`, {
          method: 'POST',
          body: JSON.stringify({
            reason: actionReason || 'Escalated to KYC Team Lead for supervisory assessment.'
          })
        });
        setActionFeedback({ type: 'success', message: 'Request escalated to KYC Team Lead.' });
      } else if (actionType === 'RESUBMIT') {
        if (!resubmitDocUrl.trim() || !resubmitDocName.trim()) {
          setActionFeedback({ type: 'error', message: 'Please provide document URL and name for resubmission.' });
          setSubmittingAction(false);
          return;
        }
        await apiFetch(`/kyc/requests/${liveReq.requestId}/resubmit`, {
          method: 'POST',
          body: JSON.stringify({
            docType: selectedDocForReupload || activeDoc?.docType || 'Identity Document',
            docName: resubmitDocName.trim(),
            docUrl: resubmitDocUrl.trim()
          })
        });
        setActionFeedback({ type: 'success', message: 'Applicant document resubmission recorded.' });
      }

      setActionMode('NONE');
      setActionReason('');
      setActionRemarks('');
      setResubmitDocUrl('');
      setResubmitDocName('');

      // Refresh parent table & local view
      onRefresh();
      const updated = await apiFetch<KycRequest>(`/kyc/requests/${liveReq.requestId}`);
      if (updated.success && updated.data) {
        setLiveReq(updated.data);
      }
    } catch (err: any) {
      setActionFeedback({ type: 'error', message: err.message || 'Action failed.' });
    } finally {
      setSubmittingAction(false);
    }
  };

  if (!isOpen || !request || !liveReq) return null;

  // Helper for rendering details
  const details = liveReq.applicantDetails || {};

  return createPortal(
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] w-screen h-screen m-0 p-0 overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <div className="flex flex-col w-full h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* ========================================================================= */}
        {/* TOP COMMAND BAR                                                           */}
        {/* ========================================================================= */}
        <div className="shrink-0 flex items-center justify-between px-6 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight truncate">
                  {liveReq.applicantName}
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  {liveReq.requestId}
                </span>
                <Badge variant={liveReq.status === 'Approved' ? 'success' : liveReq.status === 'Rejected' ? 'danger' : 'warning'}>
                  {liveReq.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">{liveReq.applicantType}</span>
                <span>•</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">{liveReq.priority} Priority</span>
                <span>•</span>
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                  {queueDuration}
                </span>
              </div>
            </div>
          </div>

          {/* Top Actions: ZIP Download, Maximize, Close */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadAllZip}
              disabled={downloadingZip || documents.length === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
              title="Download all applicant documents in a single ZIP archive"
            >
              {downloadingZip ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>{zipProgressText || 'Archiving...'}</span>
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4" />
                  <span>Download All Documents (ZIP)</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[10px] font-extrabold">
                    {documents.length}
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-300 transition-colors"
              title="Close Workbench"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Feedback Alert Banner */}
        {actionFeedback && (
          <div
            className={`px-5 py-2.5 text-xs font-semibold flex items-center justify-between ${
              actionFeedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/80 border-b border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/80 border-b border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span>{actionFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="hover:underline text-[11px]"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* THREE-PANEL CORE BODY                                                     */}
        {/* ========================================================================= */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden bg-slate-100 dark:bg-slate-950">
          {/* ======================================================================= */}
          {/* LEFT PANEL (Col 1-3): All Uploaded Documents                            */}
          {/* ======================================================================= */}
          <div className="lg:col-span-3 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 min-h-0">
            {/* Left Panel Header */}
            <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-2.5 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Uploaded Documents
                </span>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {documents.length} Files
                </span>
              </div>

              {/* Document Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={docSearch}
                  onChange={e => setDocSearch(e.target.value)}
                  placeholder="Search documents..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto text-[10px] font-bold">
                {(['All', 'Pending', 'Verified', 'Re-upload Required'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setDocStatusFilter(st)}
                    className={`px-2 py-1 rounded-lg shrink-0 transition-colors ${
                      docStatusFilter === st
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Missing Mandatory Documents Indicator */}
            {missingDocs.length > 0 && (
              <div className="m-3 p-3 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs space-y-1 shrink-0">
                <div className="flex items-center gap-1.5 font-bold text-[11px]">
                  <FileWarning className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Missing Mandatory Proofs ({missingDocs.length})</span>
                </div>
                <div className="text-[10px] text-amber-200/80 leading-relaxed">
                  Required for {liveReq.applicantType}:
                  <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                    {missingDocs.map((md, i) => (
                      <li key={i}>{md}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Document List (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              {filteredDocs.length === 0 ? (
                <div className="p-6 text-center text-slate-500 text-xs">
                  No documents found matching filters.
                </div>
              ) : (
                filteredDocs.map((doc, idx) => {
                  const isSelected = activeDocIndex === idx;
                  const isPdf = (doc.docUrl + ' ' + doc.docName).toLowerCase().includes('.pdf');
                  const isVid = /\.(mp4|webm|mov)(\?|$)/i.test(doc.docUrl + ' ' + doc.docName);

                  return (
                    <div
                      key={idx}
                      onClick={() => setActiveDocIndex(idx)}
                      className={`group p-3 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-950/60 border-indigo-500 shadow-lg shadow-indigo-950/50'
                          : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div
                            className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-700/60 text-slate-400 group-hover:text-white'
                            }`}
                          >
                            {isPdf ? (
                              <FileText className="w-4 h-4" />
                            ) : isVid ? (
                              <Film className="w-4 h-4" />
                            ) : (
                              <ImageIcon className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-white truncate">
                              {doc.docType || 'Document'}
                            </div>
                            <div className="font-mono text-[10px] text-slate-400 truncate mt-0.5">
                              {doc.docName}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-700 text-slate-300">
                                v{doc.version || 1}
                              </span>
                              <Badge
                                variant={
                                  doc.status === 'Verified'
                                    ? 'success'
                                    : doc.status === 'Rejected'
                                    ? 'danger'
                                    : 'warning'
                                }
                              >
                                {doc.status}
                              </Badge>
                              {doc.docName.toLowerCase().includes('back') && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-900/60 text-purple-300 border border-purple-800">
                                  Back Side
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Individual Download Action */}
                        <button
                          type="button"
                          onClick={e => handleDownloadSingle(e, resolveDocumentUrl(doc.docUrl), doc.docName)}
                          className="p-1.5 rounded-lg bg-slate-700 hover:bg-indigo-600 text-slate-300 hover:text-white transition-colors shrink-0"
                          title="Download this document"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {doc.remarks && (
                        <div className="mt-2 text-[10px] p-1.5 rounded bg-rose-950/40 border border-rose-900/60 text-rose-300">
                          {doc.remarks}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Left Panel Footer Summary */}
            <div className="p-3 border-t border-slate-800 bg-slate-950/60 text-slate-400 text-[11px] flex items-center justify-between shrink-0">
              <span className="flex items-center gap-1 text-emerald-400">
                <FileCheck className="w-3.5 h-3.5" />
                {documents.filter(d => d.status === 'Verified').length} Verified
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <Clock className="w-3.5 h-3.5" />
                {documents.filter(d => d.status === 'Pending').length} Pending
              </span>
            </div>
          </div>

          {/* ======================================================================= */}
          {/* CENTER PANEL (Col 4-8): Interactive Document Previewer                  */}
          {/* ======================================================================= */}
          <div className="lg:col-span-5 flex flex-col bg-slate-950 min-h-0 border-r border-slate-800">
            {/* Preview Toolbar */}
            <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-white truncate">
                  {activeDoc?.docType || 'Document Preview'}
                </span>
                {activeDoc && (
                  <Badge variant={activeDoc.status === 'Verified' ? 'success' : 'warning'}>
                    v{activeDoc.version || 1} • {activeDoc.status}
                  </Badge>
                )}
              </div>

              {/* Viewer Control Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Zoom Out (-25%)"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(1)}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 font-mono text-[11px] text-slate-200"
                  title="Reset Zoom to 100%"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Zoom In (+25%)"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                <div className="h-4 w-px bg-slate-700 mx-1" />

                <button
                  type="button"
                  onClick={() => setRotationDeg(r => (r - 90) % 360)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Rotate Left (-90°)"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotationDeg(r => (r + 90) % 360)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Rotate Right (+90°)"
                >
                  <RotateCw className="w-4 h-4" />
                </button>

                <div className="h-4 w-px bg-slate-700 mx-1" />

                {activeDoc && (
                  <button
                    type="button"
                    onClick={e => handleDownloadSingle(e, resolveDocumentUrl(activeDoc.docUrl), activeDoc.docName)}
                    className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                    title="Download this file"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Document Canvas Area */}
            <div className="flex-1 bg-slate-950 flex items-center justify-center p-4 overflow-auto relative min-h-0">
              {activeDoc ? (
                (() => {
                  const url = resolveDocumentUrl(activeDoc.docUrl);
                  const lower = (url + ' ' + activeDoc.docName).toLowerCase();

                  if (previewError) {
                    return (
                      <div className="text-center space-y-3 p-6 max-w-sm rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
                        <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
                        <div className="text-sm font-bold text-white">Preview Render Notice</div>
                        <div className="text-xs">
                          Direct preview for this document cannot be rendered inline.
                        </div>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Open Document in New Tab
                        </a>
                      </div>
                    );
                  }

                  if (lower.includes('.pdf') || lower.includes('/raw/upload/')) {
                    return (
                      <div className="w-full h-full rounded-2xl overflow-hidden bg-white shadow-2xl flex flex-col">
                        <iframe
                          src={`${url}#toolbar=1&navpanes=0`}
                          title={activeDoc.docName}
                          onError={() => setPreviewError(true)}
                          className="w-full h-full border-0"
                        />
                      </div>
                    );
                  }

                  if (lower.includes('/video/upload/') || /\.(mp4|webm|mov)(\?|$)/i.test(lower)) {
                    return (
                      <video
                        src={url}
                        controls
                        className="max-h-full max-w-full rounded-2xl shadow-2xl"
                      />
                    );
                  }

                  // Default: Image Rendering with Smooth Transformation
                  return (
                    <div
                      className="transition-transform duration-200 flex items-center justify-center max-h-full max-w-full"
                      style={{
                        transform: `scale(${zoomLevel}) rotate(${rotationDeg}deg)`
                      }}
                    >
                      <img
                        src={url}
                        alt={activeDoc.docName}
                        onError={() => setPreviewError(true)}
                        className="max-h-[75vh] max-w-full object-contain rounded-2xl shadow-2xl border border-slate-800"
                      />
                    </div>
                  );
                })()
              ) : (
                <div className="text-center text-slate-500 text-sm">
                  No document selected.
                </div>
              )}
            </div>

            {/* Preserved Historical Version Drawer Toggle */}
            <div className="border-t border-slate-800 bg-slate-900/90 shrink-0">
              <button
                type="button"
                onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
                className="w-full px-4 py-2 flex items-center justify-between text-xs font-bold text-slate-400 hover:text-white"
              >
                <span className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-indigo-400" />
                  Preserved Historical Document Versions ({(liveReq.previousDocumentVersions || []).length})
                </span>
                {showHistoryDrawer ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>

              {showHistoryDrawer && (
                <div className="p-3 max-h-40 overflow-y-auto space-y-1.5 border-t border-slate-800 bg-slate-950">
                  {(liveReq.previousDocumentVersions || []).length === 0 ? (
                    <div className="text-slate-500 text-[11px] py-1 text-center">
                      No historical versions archived for this applicant.
                    </div>
                  ) : (
                    liveReq.previousDocumentVersions.map((pv, pidx) => (
                      <div
                        key={pidx}
                        className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-semibold text-white">
                            {pv.docType} (v{pv.version})
                          </div>
                          <div className="text-[10px] text-slate-400">{pv.remarks || pv.status}</div>
                        </div>
                        <a
                          href={pv.docUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:underline font-bold"
                        >
                          <Eye className="w-3 h-3" />
                          View Archive
                        </a>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ======================================================================= */}
          {/* RIGHT PANEL (Col 9-12): Dynamic Registration Profile & KYC Actions      */}
          {/* ======================================================================= */}
          <div className="lg:col-span-4 flex flex-col bg-white dark:bg-slate-900 min-h-0 overflow-y-auto border-l border-slate-200 dark:border-slate-800">
            <div className="p-4 space-y-3">
              {/* Accordion 1: Personal & Contact Information */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('personal')}
                  className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/40"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Personal & Contact Information
                  </span>
                  {openSections.personal ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {openSections.personal && (
                  <div className="p-3.5 pt-0 border-t border-slate-200 dark:border-slate-800/60 text-xs space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Applicant / Owner Name</span>
                        <div className="font-bold text-slate-900 dark:text-white mt-0.5">{details.ownerName || liveReq.applicantName}</div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Primary Mobile</span>
                        <div className="font-bold text-slate-900 dark:text-white mt-0.5">{liveReq.phone || 'N/A'}</div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Alternate Contact</span>
                        <div className="text-slate-700 dark:text-slate-300 mt-0.5">{details.alternatePhone || details.altPhone || 'N/A'}</div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Email Address</span>
                        <div className="text-slate-700 dark:text-slate-300 mt-0.5 truncate">{liveReq.email || 'N/A'}</div>
                      </div>
                      {details.dob && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Date of Birth</span>
                          <div className="text-slate-700 dark:text-slate-300 mt-0.5">{details.dob}</div>
                        </div>
                      )}
                      {details.gender && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Gender</span>
                          <div className="text-slate-700 dark:text-slate-300 mt-0.5 capitalize">{details.gender}</div>
                        </div>
                      )}
                      {details.emergencyContact && (
                        <div className="col-span-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Emergency Contact</span>
                          <div className="text-slate-700 dark:text-slate-300 mt-0.5">
                            {typeof details.emergencyContact === 'object'
                              ? `${details.emergencyContact.name} (${details.emergencyContact.relationship}): ${details.emergencyContact.phone}`
                              : details.emergencyContact}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion 2: Address & Jurisdiction Information */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('address')}
                  className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/40"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                    Address & Jurisdiction
                  </span>
                  {openSections.address ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {openSections.address && (
                  <div className="p-3.5 pt-0 border-t border-slate-200 dark:border-slate-800/60 text-xs space-y-2">
                    <div className="space-y-2 text-slate-700 dark:text-slate-300">
                      {/* Formatted Full Address / Territory */}
                      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                          Full Jurisdiction & Address
                        </div>
                        <div className="font-medium leading-relaxed text-slate-900 dark:text-slate-100">
                          {details.address?.fullAddress ||
                           details.territoryFormatted ||
                           [details.address?.doorNo, details.address?.street, details.address?.division || details.address?.taluk || details.division, details.address?.district || details.district, details.address?.state || details.state, details.address?.pincode || details.pincode].filter(Boolean).join(', ') ||
                           'Address details registered with territory'}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[9px]">State</span>
                          <div className="font-semibold text-slate-900 dark:text-white">{details.state || details.address?.state || 'N/A'}</div>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[9px]">District</span>
                          <div className="font-semibold text-slate-900 dark:text-white">{details.district || details.address?.district || 'N/A'}</div>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[9px]">Taluk / Division</span>
                          <div className="font-semibold text-slate-900 dark:text-white">{details.division || details.address?.taluk || details.address?.division || 'N/A'}</div>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[9px]">Pincode</span>
                          <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {details.pincode || details.address?.pincode || 'N/A'}
                          </div>
                        </div>
                      </div>

                      {/* Onboarding Source & Admin Attribution */}
                      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] space-y-1.5 mt-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Onboarding & Governance Attribution
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 dark:text-slate-400">Source:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">{details.registrationSource || 'Direct Registration'}</span>
                        </div>
                        {details.onboardingAgent && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 dark:text-slate-400">Onboarding Agent:</span>
                            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                              {typeof details.onboardingAgent === 'object' ? `${details.onboardingAgent.name || details.onboardingAgent.id || ''}` : details.onboardingAgent}
                            </span>
                          </div>
                        )}
                        {details.responsibleAdmin && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 dark:text-slate-400">Territory Sub Admin:</span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {typeof details.responsibleAdmin === 'object' ? `${details.responsibleAdmin.name || details.responsibleAdmin.email || ''}` : details.responsibleAdmin}
                            </span>
                          </div>
                        )}
                        {details.pincodeAdminApproval && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 dark:text-slate-400">Pincode Admin Status:</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {details.pincodeAdminApproval.status || 'Approved'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion 3: Identity & Tax Verification */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('identity')}
                  className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/40"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                    Identity & Tax Verification
                  </span>
                  {openSections.identity ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {openSections.identity && (
                  <div className="p-3.5 pt-0 border-t border-slate-200 dark:border-slate-800/60 text-xs space-y-3">
                    <div className={`flex items-center justify-between p-2 rounded-xl border transition-colors ${
                      unmaskedSensitive
                        ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50'
                        : 'bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50'
                    }`}>
                      <div className={`flex items-center gap-1.5 text-[11px] font-semibold ${
                        unmaskedSensitive
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-purple-700 dark:text-purple-300'
                      }`}>
                        {unmaskedSensitive ? <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> : <Lock className="w-3.5 h-3.5" />}
                        <span>{unmaskedSensitive ? 'Sensitive Data Revealed (Audited Access)' : 'Protected Identity Data'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRevealSensitive}
                        disabled={revealingSensitive}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-white font-bold text-[10px] shadow-sm disabled:opacity-50 transition-all ${
                          unmaskedSensitive
                            ? 'bg-amber-600 hover:bg-amber-700'
                            : 'bg-purple-600 hover:bg-purple-700'
                        }`}
                      >
                        {unmaskedSensitive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {revealingSensitive ? 'Revealing...' : unmaskedSensitive ? 'Hide Sensitive Data (Re-mask)' : 'Reveal (Audit Logged)'}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">PAN Number</span>
                        <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                          {unmaskedSensitive
                            ? unmaskedSensitive.pan
                            : details.panNumberMasked || (details.pan ? (details.pan.length > 4 ? `••••••${details.pan.slice(-4)}` : '••••••••') : '•••••9012•')}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Aadhaar Number</span>
                        <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                          {unmaskedSensitive
                            ? unmaskedSensitive.aadhaar
                            : details.aadhaarNumberMasked || (details.aadhaar ? `•••• •••• ${details.aadhaar.slice(-4)}` : '•••• •••• 8812')}
                        </div>
                      </div>
                      {(details.gst !== undefined || details.gstNumber || unmaskedSensitive?.gst) && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">GST Registration</span>
                          <div className="text-slate-700 dark:text-slate-300 font-mono mt-0.5">
                            {unmaskedSensitive?.gst || (unmaskedSensitive && (details.gst || details.gstNumber))
                              ? (unmaskedSensitive?.gst || details.gst || details.gstNumber)
                              : (details.gst || details.gstNumber)
                              ? `${String(details.gst || details.gstNumber).slice(0, 2)}•••••••••${String(details.gst || details.gstNumber).slice(-3)}`
                              : details.gstStatus || 'Unregistered'}
                          </div>
                        </div>
                      )}
                      {details.msmeNumber && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">MSME / Udyam No</span>
                          <div className="text-slate-700 dark:text-slate-300 mt-0.5">{details.msmeNumber}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion 4: Category-Specific Details (Dynamic across all 9 Categories) */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('categoryDetails')}
                  className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/40"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                    {liveReq.applicantType} Profile Details
                  </span>
                  {openSections.categoryDetails ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {openSections.categoryDetails && (
                  <div className="p-3.5 pt-0 border-t border-slate-200 dark:border-slate-800/60 text-xs space-y-2">
                    {/* Category 1: Vendor */}
                    {liveReq.applicantType === 'Vendor' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Business / Storefront</span>
                          <div className="font-bold text-slate-900 dark:text-white mt-0.5">{details.businessName || liveReq.applicantName}</div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Business Category</span>
                          <div className="font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">{details.category || 'Retail Goods'}</div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Subcategory</span>
                          <div className="text-slate-700 dark:text-slate-300 mt-0.5">{details.subCategory || 'General Merchandise'}</div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Operating Hours</span>
                          <div className="text-slate-700 dark:text-slate-300 mt-0.5">{details.operatingHours || '9:00 AM - 9:00 PM'}</div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Store Type</span>
                          <div className="text-slate-700 dark:text-slate-300 mt-0.5">{details.storeType || 'Physical Store'}</div>
                        </div>
                        {details.onboardingAgent && (
                          <div className="col-span-2 p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 mt-1">
                            <span className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-300">Onboarding Agent Reference</span>
                            <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                              {typeof details.onboardingAgent === 'object' ? `${details.onboardingAgent.name || ''} (${details.onboardingAgent.agentId || details.onboardingAgent.id || ''})` : details.onboardingAgent}
                            </div>
                            {typeof details.onboardingAgent === 'object' && details.onboardingAgent.phone && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">{details.onboardingAgent.phone}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Category 2: Agent */}
                    {liveReq.applicantType === 'Agent' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Agent Role Tier</span>
                          <div className="font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 capitalize">{details.roleTier || 'District Agent'}</div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Qualification</span>
                          <div className="text-slate-700 dark:text-slate-300 mt-0.5">{details.qualification || 'Graduate'}</div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Experience</span>
                          <div className="text-slate-700 dark:text-slate-300 mt-0.5">{details.experience || '2+ Years'}</div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Territory Scope</span>
                          <div className="text-slate-700 dark:text-slate-300 mt-0.5">{details.territoryFormatted || details.state || 'N/A'}</div>
                        </div>
                      </div>
                    )}

                    {/* Category 3: Manager */}
                    {liveReq.applicantType === 'Manager' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Managerial Scope</span>
                          <div className="font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{details.role || 'Regional Manager'}</div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Jurisdiction</span>
                          <div className="text-slate-700 dark:text-slate-300 mt-0.5">{details.territoryFormatted || details.district || details.state || 'Assigned Territory'}</div>
                        </div>
                      </div>
                    )}

                    {/* Category 4: Sub Admin */}
                    {liveReq.applicantType === 'Sub Admin' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Administrative Scope</span>
                          <div className="font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{details.adminScope || 'District Admin'}</div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Authorization Code</span>
                          <div className="font-mono text-slate-700 dark:text-slate-300 mt-0.5">{details.authorizationCode || 'SUB-ADM-01'}</div>
                        </div>
                      </div>
                    )}

                    {/* Category 5: Delivery Partner */}
                    {liveReq.applicantType === 'Delivery Partner' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Vehicle Type</span>
                          <div className="font-bold text-slate-900 dark:text-white mt-0.5">{details.vehicleType || 'Two Wheeler'}</div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Vehicle Number</span>
                          <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{details.vehicleNumber || 'KA-01-EV-9042'}</div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Driving License</span>
                          <div className="font-mono text-slate-700 dark:text-slate-300 mt-0.5">{details.drivingLicense || 'KA01-2021-88912'}</div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Service Zone</span>
                          <div className="text-slate-700 dark:text-slate-300 mt-0.5">{details.serviceZone || 'Bengaluru South'}</div>
                        </div>
                      </div>
                    )}

                    {/* Category 6: Technician */}
                    {liveReq.applicantType === 'Technician' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Skill Trade Category</span>
                          <div className="font-bold text-slate-900 dark:text-white mt-0.5">{details.skillCategory || 'Electrical & Appliance Repair'}</div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Trade License / ITI ID</span>
                          <div className="font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">{details.certificationId || 'ITI-BLR-2022'}</div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Service Operational Zone</span>
                          <div className="text-slate-700 dark:text-slate-300 mt-0.5">{details.serviceZone || 'Central Zone'}</div>
                        </div>
                      </div>
                    )}

                    {/* Categories 7, 8 & 9: Internal Staff Employees */}
                    {['KYC Team Employee', 'Payment Team Employee', 'Queries Team Employee'].includes(liveReq.applicantType) && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Staff Employee ID</span>
                          <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{details.employeeId || liveReq.applicantId}</div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Department</span>
                          <div className="font-bold text-slate-900 dark:text-white mt-0.5">{details.department || liveReq.applicantType}</div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Designation</span>
                          <div className="text-slate-700 dark:text-slate-300 mt-0.5">{details.designation || 'Verification Specialist'}</div>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Work Location</span>
                          <div className="text-slate-700 dark:text-slate-300 mt-0.5">{details.workLocation || 'Headquarters'}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Accordion 5: Bank & Settlement Information */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('bank')}
                  className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/40"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-300 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                    Bank & Settlement Account
                  </span>
                  {openSections.bank ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {openSections.bank && (
                  <div className="p-3.5 pt-0 border-t border-slate-200 dark:border-slate-800/60 text-xs space-y-2">
                    {details.bankDetails ? (
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">Account Holder</span>
                          <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                            {details.bankDetails.accountHolder || details.bankDetails.accountHolderName || liveReq.applicantName}
                          </div>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">Bank Name</span>
                          <div className="text-slate-700 dark:text-slate-300 mt-0.5">{details.bankDetails.bankName || 'State Bank of India'}</div>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">Account Number</span>
                          <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                            {unmaskedSensitive?.bankAccount || details.bankDetails.accountNumber || '••••••••7812'}
                          </div>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">IFSC Code</span>
                          <div className="font-mono text-slate-700 dark:text-slate-300 mt-0.5">
                            {unmaskedSensitive?.ifsc || details.bankDetails.ifscCode || 'SBIN0001234'}
                          </div>
                        </div>
                        {details.bankDetails.branchName && (
                          <div className="col-span-2">
                            <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">Branch Name</span>
                            <div className="text-slate-700 dark:text-slate-300 mt-0.5">{details.bankDetails.branchName}</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-slate-500 dark:text-slate-400 italic">Bank details verified via primary settlement ledger.</div>
                    )}
                  </div>
                )}
              </div>

              {/* Accordion 6: Assignment & SLA Details */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('assignment')}
                  className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/40"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                    Assignment & Verification SLA
                  </span>
                  {openSections.assignment ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {openSections.assignment && (
                  <div className="p-3.5 pt-0 border-t border-slate-200 dark:border-slate-800/60 text-xs space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-500">Assigned Specialist</span>
                        <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                          {liveReq.assignedEmployeeName || 'Unassigned Queue'}
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-500">Specialist ID</span>
                        <div className="font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                          {liveReq.assignedEmployeeId || 'N/A'}
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-500">Submission Date</span>
                        <div className="text-slate-700 dark:text-slate-300 mt-0.5">
                          {new Date(liveReq.submissionDate).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-500">Registration Date</span>
                        <div className="text-slate-700 dark:text-slate-300 mt-0.5">
                          {new Date(liveReq.registrationDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Accordion 7: Official Attribution & Audit Trail */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('attribution')}
                  className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800/40"
                >
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                    Official Verification & Audit Trail
                  </span>
                  {openSections.attribution ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </button>
                {openSections.attribution && (
                  <div className="p-3.5 pt-0 border-t border-slate-200 dark:border-slate-800/60 text-xs space-y-3">
                    {/* Official Approver Attribution Card */}
                    {liveReq.status === 'Approved' && liveReq.approvedBy && (
                      <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-300 text-[11px] uppercase">Approved By</span>
                          <span className="font-mono text-[10px] text-emerald-400">{liveReq.approvedBy.employeeId}</span>
                        </div>
                        <div className="font-bold text-white">{liveReq.approvedBy.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {liveReq.approvedBy.role} • {liveReq.approvedBy.department}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {liveReq.approvedBy.at ? new Date(liveReq.approvedBy.at).toLocaleString() : ''}
                        </div>
                        {liveReq.approvedBy.remarks && (
                          <div className="text-[10px] text-emerald-300 italic pt-1 border-t border-emerald-900/60">
                            "{liveReq.approvedBy.remarks}"
                          </div>
                        )}
                      </div>
                    )}

                    {/* Official Rejector Attribution Card */}
                    {liveReq.status === 'Rejected' && liveReq.rejectedBy && (
                      <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-rose-300 text-[11px] uppercase">Rejected By</span>
                          <span className="font-mono text-[10px] text-rose-400">{liveReq.rejectedBy.employeeId}</span>
                        </div>
                        <div className="font-bold text-white">{liveReq.rejectedBy.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {liveReq.rejectedBy.role} • {liveReq.rejectedBy.department}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {liveReq.rejectedBy.at ? new Date(liveReq.rejectedBy.at).toLocaleString() : ''}
                        </div>
                        <div className="text-[11px] font-semibold text-rose-200 pt-1 border-t border-rose-900/60">
                          Reason: {liveReq.rejectedBy.reason}
                        </div>
                      </div>
                    )}

                    {/* Chronological Approval & Review Events */}
                    {(liveReq.approvalHistory || []).length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Chronological Activity Timeline
                        </span>
                        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                          {(liveReq.approvalHistory || []).map((ev, i) => (
                            <div key={i} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] space-y-0.5">
                              <div className="flex items-center justify-between">
                                <span
                                  className={`font-bold text-[9px] px-1.5 py-0.2 rounded ${
                                    ev.action === 'APPROVED'
                                      ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                                      : ev.action === 'REJECTED'
                                      ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300'
                                      : 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300'
                                  }`}
                                >
                                  {ev.action}
                                </span>
                                <span className="text-[9px] text-slate-500">{new Date(ev.timestamp).toLocaleString()}</span>
                              </div>
                              <div className="text-slate-700 dark:text-slate-300 font-medium">
                                {ev.actorName} <span className="text-slate-500">({ev.actorRole})</span>
                              </div>
                              {ev.remarks && <div className="text-[10px] text-slate-400 italic">"{ev.remarks}"</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* =================================================================== */}
              {/* SECTION 8: KYC Action Controls                                      */}
              {/* =================================================================== */}
              {liveReq.status !== 'Approved' && (
                <div className="pt-3 border-t border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Verification Actions
                    </span>
                    {['Vendor', 'Agent'].includes(liveReq.applicantType) && (
                      <span className="text-[10px] font-semibold text-indigo-400">
                        ⚡ Payment Auto-Routing
                      </span>
                    )}
                  </div>

                  {actionMode === 'NONE' && (
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        type="button"
                        onClick={() => setActionMode('APPROVE')}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-md shadow-emerald-600/20"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Approve KYC Request</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActionMode('REUPLOAD');
                          setSelectedDocForReupload(activeDoc?.docType || documents[0]?.docType || '');
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition-all shadow-md shadow-amber-500/20"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>Request Document Re-upload</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActionMode('REJECT')}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Reject Request</span>
                      </button>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setActionMode('ESCALATE')}
                          className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] transition-all"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-purple-400" />
                          <span>Escalate to Lead</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActionMode('RESUBMIT')}
                          className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] transition-all"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
                          <span>Record Resubmission</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* APPROVE KYC FORM */}
                  {actionMode === 'APPROVE' && (
                    <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-800/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-300 text-xs flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          Confirm KYC Approval
                        </span>
                        <button
                          type="button"
                          onClick={() => setActionMode('NONE')}
                          className="text-[11px] text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-300 leading-relaxed">
                        You are verifying all submitted registration documents for{' '}
                        <span className="font-bold text-white">{liveReq.applicantName}</span>.
                        {['Vendor', 'Agent'].includes(liveReq.applicantType) && (
                          <div className="mt-1.5 p-2 rounded-lg bg-indigo-950/60 border border-indigo-900/60 text-indigo-300 text-[10px]">
                            Notice: Approving this {liveReq.applicantType} will automatically create an onboarding settlement task for the Payment Team.
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                          Approval Remarks (Optional)
                        </label>
                        <input
                          type="text"
                          value={actionRemarks}
                          onChange={e => setActionRemarks(e.target.value)}
                          placeholder="e.g. All documents verified against original registration."
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleExecuteAction('APPROVE')}
                          disabled={submittingAction}
                          className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                        >
                          {submittingAction ? 'Approving...' : 'Confirm Approval'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionMode('NONE')}
                          className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  )}

                  {/* RE-UPLOAD REQUEST FORM */}
                  {actionMode === 'REUPLOAD' && (
                    <div className="p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-800 dark:text-amber-300 text-xs flex items-center gap-1.5">
                          <RefreshCw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          Request Document Re-upload
                        </span>
                        <button
                          type="button"
                          onClick={() => setActionMode('NONE')}
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                          Target Document Needing Re-upload
                        </label>
                        <select
                          value={selectedDocForReupload}
                          onChange={e => setSelectedDocForReupload(e.target.value)}
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          {documents.map((d, i) => (
                            <option key={i} value={d.docType}>
                              {d.docType} ({d.docName})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                          Deficiency Reason & Applicant Instructions (Mandatory)
                        </label>
                        <textarea
                          value={actionReason}
                          onChange={e => setActionReason(e.target.value)}
                          rows={2}
                          placeholder="e.g. Scan is blurred or corners cut off. Please upload full high-resolution image."
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleExecuteAction('REUPLOAD')}
                          disabled={submittingAction || !actionReason.trim()}
                          className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs disabled:opacity-50 transition-colors shadow-sm"
                        >
                          {submittingAction ? 'Sending Request...' : 'Send Re-upload Request'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionMode('NONE')}
                          className="px-3.5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  )}

                  {/* REJECT REQUEST FORM */}
                  {actionMode === 'REJECT' && (
                    <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-800/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-rose-300 text-xs flex items-center gap-1.5">
                          <XCircle className="w-4 h-4" />
                          Reject KYC Application
                        </span>
                        <button
                          type="button"
                          onClick={() => setActionMode('NONE')}
                          className="text-[11px] text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                          Official Rejection Reason (Mandatory Audit Trail)
                        </label>
                        <textarea
                          value={actionReason}
                          onChange={e => setActionReason(e.target.value)}
                          rows={3}
                          placeholder="Specify exact non-compliance reasons (e.g. Mismatched name on PAN vs Aadhaar, invalid GSTIN registration status)."
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleExecuteAction('REJECT')}
                          disabled={submittingAction || !actionReason.trim()}
                          className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs disabled:opacity-50"
                        >
                          {submittingAction ? 'Rejecting...' : 'Confirm Official Rejection'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionMode('NONE')}
                          className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ESCALATE FORM */}
                  {actionMode === 'ESCALATE' && (
                    <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-purple-800 dark:text-purple-300 text-xs flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-purple-600" />
                          Escalate to KYC Team Lead
                        </span>
                        <button
                          type="button"
                          onClick={() => setActionMode('NONE')}
                          className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 mb-1">
                          Escalation Notes for Team Lead
                        </label>
                        <textarea
                          value={actionReason}
                          onChange={e => setActionReason(e.target.value)}
                          rows={2}
                          placeholder="Explain ambiguity or policy question requiring Lead review."
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleExecuteAction('ESCALATE')}
                          disabled={submittingAction}
                          className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                        >
                          {submittingAction ? 'Escalating...' : 'Confirm Escalation'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionMode('NONE')}
                          className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  )}

                  {/* RECORD RESUBMISSION FORM */}
                  {actionMode === 'RESUBMIT' && (
                    <div className="p-3.5 rounded-2xl bg-sky-950/40 border border-sky-800/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sky-300 text-xs flex items-center gap-1.5">
                          <RefreshCw className="w-4 h-4" />
                          Record Applicant Resubmission
                        </span>
                        <button
                          type="button"
                          onClick={() => setActionMode('NONE')}
                          className="text-[11px] text-slate-400 hover:text-white"
                        >
                          Cancel
                        </button>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                          Document Type
                        </label>
                        <select
                          value={selectedDocForReupload}
                          onChange={e => setSelectedDocForReupload(e.target.value)}
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                        >
                          {documents.map((d, i) => (
                            <option key={i} value={d.docType}>
                              {d.docType} (Current v{d.version || 1})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 mb-1">
                          New Document Name
                        </label>
                        <input
                          type="text"
                          value={resubmitDocName}
                          onChange={e => setResubmitDocName(e.target.value)}
                          placeholder="e.g. pan_card_v2.png"
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 mb-1">
                          Document Asset URL
                        </label>
                        <input
                          type="text"
                          value={resubmitDocUrl}
                          onChange={e => setResubmitDocUrl(e.target.value)}
                          placeholder="https://res.cloudinary.com/... or /uploads/..."
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleExecuteAction('RESUBMIT')}
                          disabled={submittingAction || !resubmitDocUrl.trim() || !resubmitDocName.trim()}
                          className="flex-1 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs disabled:opacity-50"
                        >
                          {submittingAction ? 'Saving...' : 'Record New Version'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setActionMode('NONE')}
                          className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
