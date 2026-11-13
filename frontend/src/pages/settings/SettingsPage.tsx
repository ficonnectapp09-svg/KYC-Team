import React, { useEffect, useState } from 'react';
import { Settings, ShieldCheck, Save, CheckCircle2, Lock } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { useAuth } from '../../contexts/AuthContext';

interface SystemConfigState {
  kycSettings: {
    autoAssignEnabled: boolean;
    assignmentStrategy: 'least_workload' | 'round_robin';
    maxActivePerEmployee: number;
    slaHours: number;
    reuploadReminderHours: number;
    requireMandatoryRejectReason: boolean;
  };
  paymentSettings: {
    makerCheckerEnforced: boolean;
    highValueThresholdInr: number;
    agentDepositTrackedAsLiability: boolean;
    requireOverallLeadSalaryApproval: boolean;
    salaryCutoffDayMonthly: number;
    salaryCutoffDayWeekly: string;
  };
  queriesSettings: {
    autoAssignEnabled: boolean;
    slaHours: number;
    overdueEscalationHours: number;
    sharedTransferVisibility: boolean;
    maskPrivateNotesAcrossDepts: boolean;
  };
  rolePermissions: Record<string, string[]>;
  updatedBy?: { name: string; at: string };
}

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const isOverallLead = user?.role === 'overall_lead';
  const [config, setConfig] = useState<SystemConfigState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [error, setError] = useState('');

  const loadSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<SystemConfigState>('/settings');
      if (res.success && res.data) {
        setConfig(res.data);
      } else {
        setError((res as any).message || 'Failed to load settings.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    if (!config || !isOverallLead) return;
    setSaving(true);
    setStatusMsg('');
    setError('');
    try {
      const res = await apiFetch<SystemConfigState>('/settings', {
        method: 'PUT',
        body: JSON.stringify({
          kycSettings: config.kycSettings,
          paymentSettings: config.paymentSettings,
          queriesSettings: config.queriesSettings,
          rolePermissions: config.rolePermissions
        })
      });
      if (res.success) {
        setConfig(res.data);
        setStatusMsg('Department settings & permission matrix saved to database and audited.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-12 w-72 rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="space-y-4">
        <ErrorBanner message={error || 'Unable to load system configuration from backend.'} onRetry={loadSettings} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-indigo-600" />
            Department Settings & Access Matrix
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure SLA thresholds, automated routing rules, financial safeguards, and RBAC capabilities.
          </p>
        </div>

        {isOverallLead ? (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold shadow-sm transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        ) : (
          <Badge variant="amber">Read-Only (Overall Lead Only)</Badge>
        )}
      </div>

      {statusMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {statusMsg}
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* 3 Operational Department Policy Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KYC Settings */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white">KYC Workflow Policy</h3>
            <Badge variant="amber">KYC Team</Badge>
          </div>

          <label className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
            <span>Auto-Assign Incoming Requests</span>
            <input
              type="checkbox"
              disabled={!isOverallLead}
              checked={config.kycSettings.autoAssignEnabled}
              onChange={(e) =>
                setConfig({
                  ...config,
                  kycSettings: { ...config.kycSettings, autoAssignEnabled: e.target.checked }
                })
              }
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </label>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Distribution Strategy</label>
            <select
              disabled={!isOverallLead}
              value={config.kycSettings.assignmentStrategy}
              onChange={(e) =>
                setConfig({
                  ...config,
                  kycSettings: {
                    ...config.kycSettings,
                    assignmentStrategy: e.target.value as 'least_workload' | 'round_robin'
                  }
                })
              }
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="least_workload">Least Workload Balanced</option>
              <option value="round_robin">Strict Round Robin</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">SLA Target (Hrs)</label>
              <input
                type="number"
                disabled={!isOverallLead}
                value={config.kycSettings.slaHours}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    kycSettings: { ...config.kycSettings, slaHours: Number(e.target.value) }
                  })
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Max Active Load</label>
              <input
                type="number"
                disabled={!isOverallLead}
                value={config.kycSettings.maxActivePerEmployee}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    kycSettings: { ...config.kycSettings, maxActivePerEmployee: Number(e.target.value) }
                  })
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>
        </div>

        {/* Payment & Payroll Settings */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white">Payment & Payroll Rules</h3>
            <Badge variant="emerald">Confirmed Gates</Badge>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                Enforce Maker-Checker
              </span>
              <Badge variant="emerald">Active</Badge>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                Agent Deposit = Liability
              </span>
              <Badge variant="indigo">Enforced</Badge>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                Overall Lead Salary Approval
              </span>
              <Badge variant="indigo">Mandatory</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">High-Value Alert (₹)</label>
              <input
                type="number"
                disabled={!isOverallLead}
                value={config.paymentSettings.highValueThresholdInr}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    paymentSettings: {
                      ...config.paymentSettings,
                      highValueThresholdInr: Number(e.target.value)
                    }
                  })
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Monthly Cutoff Day</label>
              <input
                type="number"
                min={1}
                max={31}
                disabled={!isOverallLead}
                value={config.paymentSettings.salaryCutoffDayMonthly}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    paymentSettings: {
                      ...config.paymentSettings,
                      salaryCutoffDayMonthly: Number(e.target.value)
                    }
                  })
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>
        </div>

        {/* Queries Settings */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white">Queries & Transfer SLA</h3>
            <Badge variant="purple">Queries Team</Badge>
          </div>

          <label className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
            <span>Shared Cross-Dept Transfer Visibility</span>
            <input
              type="checkbox"
              disabled={!isOverallLead}
              checked={config.queriesSettings.sharedTransferVisibility}
              onChange={(e) =>
                setConfig({
                  ...config,
                  queriesSettings: {
                    ...config.queriesSettings,
                    sharedTransferVisibility: e.target.checked
                  }
                })
              }
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </label>

          <label className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
            <span>Mask Department-Private Notes</span>
            <input
              type="checkbox"
              disabled={!isOverallLead}
              checked={config.queriesSettings.maskPrivateNotesAcrossDepts}
              onChange={(e) =>
                setConfig({
                  ...config,
                  queriesSettings: {
                    ...config.queriesSettings,
                    maskPrivateNotesAcrossDepts: e.target.checked
                  }
                })
              }
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Response SLA (Hrs)</label>
              <input
                type="number"
                disabled={!isOverallLead}
                value={config.queriesSettings.slaHours}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    queriesSettings: { ...config.queriesSettings, slaHours: Number(e.target.value) }
                  })
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Escalation (Hrs)</label>
              <input
                type="number"
                disabled={!isOverallLead}
                value={config.queriesSettings.overdueEscalationHours}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    queriesSettings: {
                      ...config.queriesSettings,
                      overdueEscalationHours: Number(e.target.value)
                    }
                  })
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Role & Permission Matrix */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Enterprise RBAC Permission Matrix
            </h3>
          </div>
          {config.updatedBy?.name && (
            <span className="text-xs text-slate-400">
              Last updated by {config.updatedBy.name} on {new Date(config.updatedBy.at).toLocaleString()}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3 pr-4">Role Identifier</th>
                <th className="py-3">Granted Capability Scopes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
              {Object.entries(config.rolePermissions || {}).map(([roleKey, perms]) => (
                <tr key={roleKey}>
                  <td className="py-3.5 pr-4 font-bold text-slate-900 dark:text-white uppercase whitespace-nowrap">
                    {roleKey.replace(/_/g, ' ')}
                  </td>
                  <td className="py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {perms.map((p) => (
                        <span
                          key={p}
                          className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px]"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

