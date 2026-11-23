import React from 'react';
import {
  Search,
  Layers,
  Clock,
  RefreshCw,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RotateCcw
} from 'lucide-react';
import { StatCard } from './StatCard';

export interface TabSummaryCounts {
  totalCount?: number;
  pendingCount?: number;
  inProgressCount?: number;
  completedCount?: number;
  totalAmount?: number;
}

interface EmployeeOption {
  employeeId: string;
  name: string;
}

interface DepartmentTabHeaderProps {
  title: string;
  description: string;
  departmentBadge: string;
  summary: TabSummaryCounts;
  showAmountStat?: boolean;
  showInProgress?: boolean;
  completedLabel?: string;
  pendingLabel?: string;
  inProgressLabel?: string;
  pendingStatusValue?: string;
  inProgressStatusValue?: string;
  completedStatusValue?: string;
  actions?: React.ReactNode;
  // Common filters
  search: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;
  statusFilter?: string;
  onStatusChange?: (val: string) => void;
  statusOptions?: { value: string; label: string }[];
  priorityFilter?: string;
  onPriorityChange?: (val: string) => void;
  assigneeFilter?: string;
  onAssigneeChange?: (val: string) => void;
  employeeOptions?: EmployeeOption[];
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (val: string) => void;
  onEndDateChange?: (val: string) => void;
  extraFilters?: React.ReactNode;
  onApplyFilters?: () => void;
  onResetFilters?: () => void;
}

export const DepartmentTabHeader: React.FC<DepartmentTabHeaderProps> = ({
  title,
  description,
  departmentBadge,
  summary,
  showAmountStat = false,
  showInProgress = true,
  completedLabel = 'Approved / Completed',
  pendingLabel = 'Pending',
  inProgressLabel = 'In Progress',
  pendingStatusValue,
  inProgressStatusValue,
  completedStatusValue,
  actions,
  search,
  onSearchChange,
  searchPlaceholder = 'Search ID, party name, phone, subject...',
  statusFilter,
  onStatusChange,
  statusOptions,
  priorityFilter,
  onPriorityChange,
  assigneeFilter,
  onAssigneeChange,
  employeeOptions,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  extraFilters,
  onApplyFilters,
  onResetFilters
}) => {
  return (
    <div className="space-y-4">
      {/* Category Title Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{title}</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60">
              {departmentBadge}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
        </div>
        {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
      </div>

      {/* Category-Scoped Common KPI Strip */}
      <div className={`grid grid-cols-2 ${showInProgress ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
        <StatCard
          title="Total Records"
          value={summary.totalCount ?? 0}
          icon={Layers}
          variant="indigo"
          subtitle={showAmountStat && summary.totalAmount !== undefined ? `Volume: ₹${(summary.totalAmount || 0).toLocaleString()}` : undefined}
          onClick={onStatusChange ? () => onStatusChange('All') : undefined}
          isActive={onStatusChange ? !statusFilter || statusFilter === 'All' : false}
        />
        <StatCard
          title={pendingLabel}
          value={summary.pendingCount ?? 0}
          icon={Clock}
          variant="amber"
          onClick={onStatusChange ? () => onStatusChange(pendingStatusValue || 'Unassigned') : undefined}
          isActive={
            onStatusChange
              ? statusFilter === (pendingStatusValue || 'Unassigned') ||
                statusFilter === 'Pending' ||
                statusFilter === 'PENDING' ||
                statusFilter === 'HELD' ||
                statusFilter === 'Pending Checker Review' ||
                statusFilter === 'Re-upload Requested'
              : false
          }
        />
        {showInProgress && (
          <StatCard
            title={inProgressLabel}
            value={summary.inProgressCount ?? 0}
            icon={RefreshCw}
            variant="purple"
            onClick={onStatusChange ? () => onStatusChange(inProgressStatusValue || 'In Progress') : undefined}
            isActive={
              onStatusChange
                ? statusFilter === (inProgressStatusValue || 'In Progress') ||
                  statusFilter === 'PROCESSING' ||
                  statusFilter === 'Processing' ||
                  statusFilter === 'Assigned' ||
                  statusFilter === 'ADJUSTED'
                : false
            }
          />
        )}
        <StatCard
          title={completedLabel}
          value={summary.completedCount ?? 0}
          icon={CheckCircle2}
          variant="emerald"
          onClick={onStatusChange ? () => onStatusChange(completedStatusValue || 'Approved') : undefined}
          isActive={
            onStatusChange
              ? statusFilter === (completedStatusValue || 'Approved') ||
                statusFilter === 'Completed' ||
                statusFilter === 'COMPLETED' ||
                statusFilter === 'Settled' ||
                statusFilter === 'REFUNDED'
              : false
          }
        />
      </div>

      {/* Common Filter Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onApplyFilters?.()}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
          />
        </div>

        {statusOptions && onStatusChange && (
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            aria-label="Status Filter"
            className="px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {onPriorityChange && (
          <select
            value={priorityFilter}
            onChange={(e) => onPriorityChange(e.target.value)}
            aria-label="Priority Filter"
            className="px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300"
          >
            <option value="All">All Priorities</option>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        )}

        {employeeOptions && employeeOptions.length > 0 && onAssigneeChange && (
          <select
            value={assigneeFilter}
            onChange={(e) => onAssigneeChange(e.target.value)}
            aria-label="Employee Assignment Filter"
            className="px-3 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300"
          >
            <option value="All">All Employees</option>
            <option value="UNASSIGNED">Unassigned</option>
            {employeeOptions.map((emp) => (
              <option key={emp.employeeId} value={emp.employeeId}>
                {emp.name}
              </option>
            ))}
          </select>
        )}

        {onStartDateChange && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <select
              value={(() => {
                if (!startDate && !endDate) return 'All';
                const today = new Date().toISOString().split('T')[0];
                if (startDate === today && endDate === today) return 'Today';
                const now = new Date();
                const day = now.getDay();
                const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
                const monday = new Date(new Date().setDate(diffToMonday)).toISOString().split('T')[0];
                if (startDate === monday && endDate === today) return 'This Week';
                const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
                if (startDate === firstOfMonth && endDate === today) return 'This Month';
                return 'Custom';
              })()}
              onChange={(e) => {
                const preset = e.target.value;
                const today = new Date().toISOString().split('T')[0];
                if (preset === 'All') {
                  onStartDateChange('');
                  onEndDateChange?.('');
                } else if (preset === 'Today') {
                  onStartDateChange(today);
                  onEndDateChange?.(today);
                } else if (preset === 'This Week') {
                  const now = new Date();
                  const day = now.getDay();
                  const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
                  const monday = new Date(new Date().setDate(diffToMonday)).toISOString().split('T')[0];
                  onStartDateChange(monday);
                  onEndDateChange?.(today);
                } else if (preset === 'This Month') {
                  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
                  onStartDateChange(firstOfMonth);
                  onEndDateChange?.(today);
                }
              }}
              aria-label="Date Range Period"
              className="px-2.5 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300"
            >
              <option value="All">All Time</option>
              <option value="Today">Today</option>
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
              <option value="Custom">Custom Range</option>
            </select>
            <input
              type="date"
              value={startDate || ''}
              onChange={(e) => onStartDateChange(e.target.value)}
              aria-label="From Date"
              className="px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={endDate || ''}
              onChange={(e) => onEndDateChange?.(e.target.value)}
              aria-label="To Date"
              className="px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300"
            />
          </div>
        )}

        {extraFilters}

        {onApplyFilters && (
          <button
            type="button"
            onClick={onApplyFilters}
            className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Apply
          </button>
        )}

        {onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Reset Filters"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        )}
      </div>
    </div>
  );
};

interface PaginationBarProps {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPageChange: (nextPage: number) => void;
  onLimitChange?: (nextLimit: number) => void;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  page,
  limit,
  total,
  totalPages,
  onPageChange,
  onLimitChange
}) => {
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(total, page * limit);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs">
      <div className="text-slate-500 dark:text-slate-400">
        Showing <span className="font-semibold text-slate-900 dark:text-white">{startItem}–{endItem}</span> of{' '}
        <span className="font-semibold text-slate-900 dark:text-white">{total}</span> records
      </div>

      <div className="flex items-center gap-2">
        {onLimitChange && (
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            aria-label="Rows per page"
            className="px-2 py-1 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
          >
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
          </select>
        )}

        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Prev
        </button>

        <span className="px-2 font-semibold text-slate-700 dark:text-slate-300">
          Page {page} of {Math.max(1, totalPages)}
        </span>

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Next <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
