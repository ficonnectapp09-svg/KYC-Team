import React, { useEffect, useState } from 'react';
import { ScrollText, Search, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { AuditTrail } from '../../types';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorBanner } from '../../components/common/ErrorBanner';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditTrail[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState('All');
  const [search, setSearch] = useState('');

  const loadLogs = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const q = new URLSearchParams();
      if (moduleFilter !== 'All') q.append('module', moduleFilter);
      if (search) q.append('search', search);

      const res = await apiFetch<AuditTrail[]>(`/audit-logs?${q.toString()}`);
      if (res.success) {
        setLogs(res.data || []);
      } else {
        setLoadError((res as any).message || 'Failed to load audit logs.');
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load system audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [moduleFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Immutable System Audit Logs
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Chronological security and financial compliance record across all backoffice modules.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search actor, action, target ID, or details..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadLogs()}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
          />
        </div>
        <select
          value={moduleFilter}
          onChange={e => setModuleFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
        >
          <option value="All">All Modules</option>
          <option value="AUTH">AUTH</option>
          <option value="STAFF">STAFF</option>
          <option value="KYC">KYC</option>
          <option value="PAYMENT">PAYMENT</option>
          <option value="QUERIES">QUERIES</option>
          <option value="SALARY">SALARY</option>
          <option value="TASK">TASK</option>
        </select>
        <button onClick={loadLogs} className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-bold">
          Search
        </button>
      </div>

      <ErrorBanner message={loadError} onRetry={loadLogs} />

      {/* Table */}
      {loading ? (
        <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
      ) : logs.length === 0 ? (
        <EmptyState title="No Audit Entries" icon={ScrollText} />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Timestamp</th>
                  <th className="py-3.5 px-4">Actor & Role</th>
                  <th className="py-3.5 px-4">Module & Action</th>
                  <th className="py-3.5 px-4">Target & Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {logs.map(log => (
                  <tr key={log._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-5 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{log.actorName}</div>
                      <div className="text-[10px] text-slate-400">{log.actorId} | {log.actorRole}</div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="primary" size="sm">{log.module}</Badge>
                      <div className="font-mono font-bold text-[11px] text-indigo-600 mt-1">{log.action}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{log.details}</div>
                      {log.targetId && (
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">Target Ref: {log.targetId}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

