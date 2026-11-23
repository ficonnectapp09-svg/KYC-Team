import React from 'react';

interface MetricSubItem {
  label: string;
  value: number | string;
  color?: string;
}

interface RadialGaugeCardProps {
  title: string;
  percentage: number;
  centerSubtitle?: string;
  subItems?: MetricSubItem[];
  color?: string;
  className?: string;
}

export const RadialGaugeCard: React.FC<RadialGaugeCardProps> = ({
  title,
  percentage,
  centerSubtitle = 'Completed',
  subItems = [],
  color = '#10B981',
  className = ''
}) => {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  return (
    <div className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between ${className}`}>
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">{title}</h3>
      </div>

      <div className="flex items-center justify-between gap-4 py-3">
        {/* SVG Circle Gauge */}
        <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 110 110">
            {/* Background Track */}
            <circle
              cx="55"
              cy="55"
              r={radius}
              stroke="#F1F5F9"
              strokeWidth="10"
              fill="transparent"
              className="dark:stroke-slate-800"
            />
            {/* Progress Stroke */}
            <circle
              cx="55"
              cy="55"
              r={radius}
              stroke={color}
              strokeWidth="10"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-black text-slate-900 dark:text-white leading-none">
              {percentage}%
            </span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-1">
              {centerSubtitle}
            </span>
          </div>
        </div>

        {/* Sub metrics list */}
        {subItems.length > 0 && (
          <div className="flex-1 space-y-2 text-xs">
            {subItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color || color }}
                  />
                  <span className="text-slate-600 dark:text-slate-300 font-medium text-[11px]">
                    {item.label}
                  </span>
                </div>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

