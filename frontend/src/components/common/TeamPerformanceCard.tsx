import React from 'react';
import { ShieldCheck, Award } from 'lucide-react';

export interface TeamMemberPerformance {
  name: string;
  avatarUrl?: string;
  todayCount: number;
  approvedCount: number;
  efficiencyPercent?: number;
  role?: string;
}

interface TeamPerformanceCardProps {
  title?: string;
  subtitle?: string;
  members: TeamMemberPerformance[];
  className?: string;
}

export const TeamPerformanceCard: React.FC<TeamPerformanceCardProps> = ({
  title = 'Team Performance',
  subtitle = 'Staff throughput & verification accuracy',
  members,
  className = ''
}) => {
  return (
    <div className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600">
          <Award className="w-4 h-4" />
        </div>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto max-h-48 pr-1">
        {members.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No active team activity recorded today.
          </div>
        ) : (
          members.map((m, idx) => {
            const eff = m.efficiencyPercent !== undefined
              ? m.efficiencyPercent
              : m.todayCount > 0
              ? Math.min(100, Math.round((m.approvedCount / m.todayCount) * 100))
              : null;

            return (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 p-2 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100/80 dark:border-slate-800"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                    {m.name.charAt(0)}
                  </div>
                  <div className="truncate">
                    <div className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">
                      {m.name}
                    </div>
                    {m.role && (
                      <div className="text-[10px] text-slate-400 truncate">
                        {m.role}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-right">
                  <div className="text-[11px] text-slate-500">
                    <span>Today: <strong className="text-slate-700 dark:text-slate-300">{m.todayCount}</strong></span>
                    <span className="mx-1 text-slate-300">·</span>
                    <span>Approved: <strong className="text-emerald-600">{m.approvedCount}</strong></span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    eff === null
                      ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60'
                  }`}>
                    {eff === null ? 'N/A' : `${eff}%`}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

