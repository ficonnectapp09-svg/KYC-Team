import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  variant?: 'blue' | 'yellow' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'purple' | 'royal';
  color?: 'blue' | 'yellow' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'purple' | 'royal' | string;
  onClick?: () => void;
  isActive?: boolean;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant,
  color,
  onClick,
  isActive = false,
  className = ''
}) => {
  const chosenColor = color || variant || 'blue';
  const resolvedVariant = chosenColor === 'royal' ? 'blue' : chosenColor;

  const variantColors: Record<string, { bg: string; text: string; border: string }> = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950/50',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'hover:border-blue-300 dark:hover:border-blue-700'
    },
    royal: {
      bg: 'bg-blue-50 dark:bg-blue-950/50',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'hover:border-blue-300 dark:hover:border-blue-700'
    },
    yellow: {
      bg: 'bg-amber-50 dark:bg-amber-950/50',
      text: 'text-amber-500 dark:text-amber-400',
      border: 'hover:border-amber-300 dark:hover:border-amber-700'
    },
    indigo: {
      bg: 'bg-indigo-50 dark:bg-indigo-950/50',
      text: 'text-indigo-600 dark:text-indigo-400',
      border: 'hover:border-indigo-300 dark:hover:border-indigo-700'
    },
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/50',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'hover:border-emerald-300 dark:hover:border-emerald-700'
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950/50',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'hover:border-amber-300 dark:hover:border-amber-700'
    },
    rose: {
      bg: 'bg-rose-50 dark:bg-rose-950/50',
      text: 'text-rose-600 dark:text-rose-400',
      border: 'hover:border-rose-300 dark:hover:border-rose-700'
    },
    sky: {
      bg: 'bg-sky-50 dark:bg-sky-950/50',
      text: 'text-sky-600 dark:text-sky-400',
      border: 'hover:border-sky-300 dark:hover:border-sky-700'
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-950/50',
      text: 'text-purple-600 dark:text-purple-400',
      border: 'hover:border-purple-300 dark:hover:border-purple-700'
    }
  };

  const style = variantColors[resolvedVariant] || variantColors.blue;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
      className={`relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border p-4 shadow-sm transition-all duration-200 ${
        isActive
          ? 'ring-2 ring-[#F59E0B] border-[#F59E0B] shadow-md bg-amber-50/20 dark:bg-amber-950/20'
          : 'border-slate-100 dark:border-slate-800'
      } ${onClick ? 'cursor-pointer hover:shadow-md active:scale-[0.99] select-none' : ''} ${style.border} ${className}`}
    >
      <div className="flex items-center gap-3.5">
        <div className={`p-3 rounded-xl shrink-0 ${style.bg} ${style.text}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="space-y-0.5 truncate">
          <div className="flex items-baseline gap-2">
            <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
              {value}
            </h3>
            {trend && (
              <span
                className={`text-[11px] font-bold ${
                  trend.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {trend.value}
              </span>
            )}
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
            {title}
          </p>
          {subtitle && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

