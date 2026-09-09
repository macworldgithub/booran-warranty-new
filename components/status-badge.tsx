import React from 'react';
import { CaseStatus } from '../lib/types';

interface StatusBadgeProps {
  status: CaseStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const styles: Record<CaseStatus, string> = {
    'Draft': 'bg-[#64748b]/20 text-[#cbd5e1] border-[#64748b]/30',
    'Uploading': 'bg-[#1a56db]/20 text-[#00f0ff] border-[#1a56db]/40 animate-pulse',
    'Awaiting Review': 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]',
    'Flagged': 'bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/40 shadow-[0_0_10px_rgba(239,68,68,0.2)] font-bold',
    'Submitted': 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]',
    'Closed': 'bg-[#64748b]/20 text-[#64748b] border-[#64748b]/30',
    'Withdrawn': 'bg-[#ef4444]/10 text-[#64748b] border-transparent',
  };

  const px = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold border uppercase tracking-wider ${px} ${styles[status] || styles['Draft']}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
