'use client';

import React from 'react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function Header({ title, subtitle, action }: HeaderProps) {
  return (
    <header className="px-8 py-5 border-b border-[#1a56db]/20 bg-[#081225]/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between">
      <div>
        <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
          {title}
        </h2>
        {subtitle && <p className="text-xs text-[#cbd5e1]/70 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        {action}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0d1b3e] border border-[#1a56db]/20 text-xs text-[#cbd5e1]">
          <span className="w-2 h-2 rounded-full bg-[#10b981]" />
          <span>VIC Multi-Franchise Network</span>
        </div>
      </div>
    </header>
  );
}
