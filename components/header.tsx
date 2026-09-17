'use client';

import React from 'react';
import { NotificationBell } from './notification-bell';

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function Header({ title, subtitle, action }: HeaderProps) {
  return (
    <header className="px-8 py-4 border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          {title}
        </h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {action}

        {/* Notification Bell with live unread badge & dropdown */}
        <NotificationBell />

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="font-semibold">VIC Multi-Franchise Network</span>
        </div>
      </div>
    </header>
  );
}
