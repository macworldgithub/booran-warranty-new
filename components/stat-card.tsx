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
  const accentGlow = {
    blue: 'border-[#1a56db]/40 hover:border-[#1a56db] shadow-[0_0_15px_rgba(26,86,219,0.15)]',
    cyan: 'border-[#00f0ff]/40 hover:border-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.15)]',
    gold: 'border-[#f59e0b]/40 hover:border-[#f59e0b] shadow-[0_0_15px_rgba(245,158,11,0.15)]',
    green: 'border-[#10b981]/40 hover:border-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.15)]',
    red: 'border-[#ef4444]/40 hover:border-[#ef4444] shadow-[0_0_15px_rgba(239,68,68,0.15)]',
  }[accent];

  const accentText = {
    blue: 'text-[#1a56db]',
    cyan: 'text-[#00f0ff]',
    gold: 'text-[#f59e0b]',
    green: 'text-[#10b981]',
    red: 'text-[#ef4444]',
  }[accent];

  return (
    <div className={`p-5 rounded-2xl bg-[#0d1b3e]/80 border transition-all duration-300 backdrop-blur-md ${accentGlow}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-[#cbd5e1]/70 uppercase tracking-wider">{label}</span>
        {icon && <span className={`${accentText} opacity-80`}>{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black text-white tracking-tight">{value}</span>
        {trend && (
          <span
            className={`text-xs font-bold ${
              trendPositive ? 'text-[#10b981]' : 'text-[#ef4444]'
            }`}
          >
            {trend}
          </span>
        )}
      </div>
      {subtext && <p className="text-[11px] text-[#64748b] mt-1 font-medium">{subtext}</p>}
    </div>
  );
}
