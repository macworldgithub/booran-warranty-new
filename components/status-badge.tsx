import React from 'react';
import { CaseStatus } from '../lib/types';

interface StatusBadgeProps {
  status: CaseStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const styles: Record<CaseStatus, string> = {
    'Draft': 'bg-slate-100 text-slate-700 border-slate-300',
    'Uploading': 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse',
    'Awaiting Review': 'bg-amber-50 text-amber-800 border-amber-300 font-semibold',
    'Flagged': 'bg-red-50 text-[#E11F26] border-red-300 font-bold',
    'Submitted': 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold',
    'Closed': 'bg-slate-100 text-slate-600 border-slate-200',
    'Withdrawn': 'bg-slate-50 text-slate-500 border-slate-200',
  };

  const px = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold border uppercase tracking-wider ${px} ${styles[status] || styles['Draft']}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
