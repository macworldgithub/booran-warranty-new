import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  trend?: string;
  trendPositive?: boolean;
  accent?: 'blue' | 'cyan' | 'gold' | 'green' | 'red';
  icon?: React.ReactNode;
}

export function StatCard({
  label,
  value,
  subtext,
  trend,
  trendPositive = true,
  accent = 'blue',
  icon,
}: StatCardProps) {
  const accentText = {
    blue: 'text-[#E11F26]',
    cyan: 'text-slate-700',
    gold: 'text-amber-600',
    green: 'text-emerald-600',
    red: 'text-[#E11F26]',
  }[accent];

  return (
    <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        {icon && <span className={`${accentText}`}>{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black text-slate-900 tracking-tight">{value}</span>
        {trend && (
          <span
            className={`text-xs font-bold ${
              trendPositive ? 'text-emerald-600' : 'text-[#E11F26]'
            }`}
          >
            {trend}
          </span>
        )}
      </div>
      {subtext && <p className="text-[11px] text-slate-500 mt-1 font-medium">{subtext}</p>}
    </div>
  );
}
