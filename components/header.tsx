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
        {/* Prominent Portal Identifier Badge in Top Navbar */}
        {role && (
          <div
            className={`hidden md:flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl border shadow-sm ${
              isAdmin
                ? 'bg-slate-900 border-slate-800 text-white'
                : 'bg-blue-950 border-blue-900 text-white'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isAdmin ? 'bg-red-400' : 'bg-cyan-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isAdmin ? 'bg-[#E11F26]' : 'bg-cyan-400'
                  }`}
                />
              </span>
              {isAdmin ? (
                <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-cyan-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              <span className="text-xs font-black tracking-wide">
                {isAdmin ? 'Admin Portal' : 'Technician Portal'}
              </span>
            </div>
            <span
              className={`text-[10px] font-mono uppercase tracking-wider pl-2 border-l ${
                isAdmin ? 'border-slate-700 text-slate-400' : 'border-blue-800 text-blue-300'
              }`}
            >
              {isAdmin ? 'Warranty Management' : 'Workshop Capture'}
            </span>
          </div>
        )}

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
