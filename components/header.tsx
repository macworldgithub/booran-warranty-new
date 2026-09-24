'use client';

import React, { useEffect, useState } from 'react';
import { NotificationBell } from './notification-bell';

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  portalRole?: 'ADMIN' | 'TECHNICIAN' | string;
}

export function Header({ title, subtitle, action, portalRole }: HeaderProps) {
  const [role, setRole] = useState<string>(portalRole || '');

  useEffect(() => {
    if (portalRole) {
      setRole(portalRole);
      return;
    }
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('booran_user') || localStorage.getItem('booran_user_profile');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          setRole(user.role || 'ADMIN');
        } catch {
          setRole('ADMIN');
        }
      } else {
        setRole('ADMIN');
      }
    }
  }, [portalRole]);

  const isAdmin = role.toUpperCase() === 'ADMIN';

  return (
    <header className="px-6 lg:px-8 py-4 border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight truncate">
              {title}
            </h2>
            {/* Header Title Role Pill */}
            {role && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wider uppercase border shadow-xs ${
                  isAdmin
                    ? 'bg-slate-900 text-white border-slate-700'
                    : 'bg-blue-900 text-blue-100 border-blue-700'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isAdmin ? 'bg-[#E11F26] animate-pulse' : 'bg-cyan-400 animate-pulse'
                  }`}
                />
                {isAdmin ? 'Admin Portal' : 'Technician Portal'}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">


        {action}

        {/* Notification Bell with live unread badge & dropdown */}
        <NotificationBell />

        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="font-semibold">VIC Multi-Franchise Network</span>
        </div>
      </div>
    </header>
  );
}
