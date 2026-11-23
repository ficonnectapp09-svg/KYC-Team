import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface QuickActionItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  disabled?: boolean;
}

interface QuickActionsCardProps {
  title?: string;
  actions: QuickActionItem[];
  className?: string;
}

export const QuickActionsCard: React.FC<QuickActionsCardProps> = ({
  title = 'Quick Actions',
  actions,
  className = ''
}) => {
  return (
    <div className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between ${className}`}>
      <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight mb-3">
        {title}
      </h3>

      <div className="space-y-2.5 flex-1 flex flex-col justify-center">
        {actions.map((act, idx) => {
          const Icon = act.icon;
          let btnClass = 'w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 ';

          if (act.variant === 'primary' || !act.variant) {
            // Royal Blue
            btnClass += 'bg-[#1D4ED8] hover:bg-[#1E40AF] text-white shadow-blue-500/20';
          } else if (act.variant === 'secondary') {
            // Forge Yellow
            btnClass += 'bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 shadow-amber-500/20';
          } else if (act.variant === 'danger') {
            // Rose
            btnClass += 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20';
          } else {
            // Outline
            btnClass += 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60';
          }

          if (act.disabled) {
            btnClass += ' opacity-50 cursor-not-allowed';
          }

          return (
            <button
              key={idx}
              type="button"
              disabled={act.disabled}
              onClick={act.onClick}
              className={btnClass}
            >
              {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
              <span>{act.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

