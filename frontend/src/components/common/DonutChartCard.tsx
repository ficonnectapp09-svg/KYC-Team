import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

export interface DonutSegment {
  name: string;
  value: number;
  color: string;
  percentage?: number;
}

interface DonutChartCardProps {
  title: string;
  subtitle?: string;
  centerCount: number | string;
  centerLabel: string;
  data: DonutSegment[];
  className?: string;
}

export const DonutChartCard: React.FC<DonutChartCardProps> = ({
  title,
  subtitle,
  centerCount,
  centerLabel,
  data,
  className = ''
}) => {
  const total = data.reduce((acc, curr) => acc + (curr.value || 0), 0);

  return (
    <div className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between ${className}`}>
      <div className="mb-2">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center justify-between gap-4 py-2">
        {/* Donut Chart with Center Text */}
        <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.length > 0 ? data : [{ name: 'None', value: 1, color: '#E2E8F0' }]}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={65}
                paddingAngle={data.length > 1 ? 3 : 0}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(val: any) => [val, 'Count']}
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderRadius: '12px',
                  border: '1px solid #334155',
                  fontSize: '11px',
                  color: '#ffffff'
                }}
                itemStyle={{ color: '#ffffff', fontWeight: 600 }}
                labelStyle={{ color: '#cbd5e1', fontWeight: 600 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            <span className="text-lg font-black text-slate-900 dark:text-white leading-none">
              {centerCount}
            </span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
              {centerLabel}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2 text-xs">
          {data.map((item, idx) => {
            const pct = item.percentage !== undefined ? item.percentage : total > 0 ? Math.round((item.value / total) * 100) : 0;
            return (
              <div key={idx} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600 dark:text-slate-300 font-medium truncate text-[11px]">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    {pct}%
                  </span>
                  {item.value !== undefined && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({item.value})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

