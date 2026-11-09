'use client';

import React, { useSyncExternalStore } from 'react';
import { Menu } from 'lucide-react';
import { NotificationBell } from './notification-bell';
import { useMobileMenu } from './mobile-menu-context';

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  portalRole?: 'ADMIN' | 'CLERK' | 'TECHNICIAN' | string;
  onMenuToggle?: () => void;
}

function subscribeToSession(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}

function getStoredRole(): string {
  if (typeof window === 'undefined') return 'ADMIN';
  const userStr = localStorage.getItem('booran_user') || localStorage.getItem('booran_user_profile');
  if (!userStr) return 'ADMIN';
  try {
    return JSON.parse(userStr).role || 'ADMIN';
  } catch {
    return 'ADMIN';
  }
}

export function Header({ title, subtitle, action, portalRole, onMenuToggle }: HeaderProps) {
  const { openMenu } = useMobileMenu();
  const handleMenuClick = onMenuToggle || openMenu;
  const storedRole = useSyncExternalStore(subscribeToSession, getStoredRole, () => '');
  const role = portalRole || storedRole;

  const isAdmin = role.toUpperCase() === 'ADMIN';
  const isClerk = role.toUpperCase() === 'CLERK';
  const portalLabel = isAdmin
    ? 'Admin'
    : isClerk
      ? 'Clerk'
      : 'Technician';

  return (
    <header className="px-4 sm:px-6 lg:px-8 py-3.5 border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.03)] pt-[max(0.875rem,env(safe-area-inset-top,0px))]">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile Hamburger Drawer Trigger */}
        <button
          type="button"
          onClick={handleMenuClick}
          className="lg:hidden p-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0 border border-slate-200 active:scale-95"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5 text-slate-800" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base sm:text-lg lg:text-xl font-extrabold text-slate-900 tracking-tight truncate">
              {title}
            </h1>

            {/* Header Title Role Pill */}
            {role && (
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-black tracking-wider uppercase border shadow-xs shrink-0 ${
                  isAdmin
                    ? 'bg-slate-900 text-white border-slate-700'
                    : isClerk
                      ? 'bg-red-950 text-red-100 border-red-700'
                      : 'bg-blue-900 text-blue-100 border-blue-700'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isAdmin || isClerk ? 'bg-[#E11F26] animate-pulse' : 'bg-cyan-400 animate-pulse'
                  }`}
                />
                <span className="hidden xs:inline">{portalLabel}</span>
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-0.5 truncate hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {action && <div className="shrink-0">{action}</div>}

        {/* Notification Bell with live unread badge & dropdown */}
        <NotificationBell />

        {/* Dealership Network Pill (hidden on small screens) */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold">VIC Multi-Franchise</span>
        </div>
      </div>
    </header>
  );
}
