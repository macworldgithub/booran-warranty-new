'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { UserRole } from '@/lib/types';

interface SidebarProps {
  userRole?: UserRole;
  userName?: string;
  userEmail?: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
  highlight?: boolean;
}

export function Sidebar({ userRole = 'ADMIN', userName = 'Marcus Vance', userEmail = 'admin@booran.com.au' }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = userRole === 'ADMIN';

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('booran_user');
      localStorage.removeItem('booran_user_profile');
      localStorage.removeItem('booran_jwt');
      localStorage.removeItem('booran_auth_token');
    }
    router.replace('/login');
  };

  const adminNavItems: NavItem[] = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
    },
    {
      label: 'Warranty Cases',
      href: '/cases',
      badge: 'Live',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      label: 'Brand Packs & Rules',
      href: '/brand-packs',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
    {
      label: 'Dealership Sites',
      href: '/sites',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      label: 'User Access',
      href: '/users',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
  ];

  const techNavItems: NavItem[] = [
    {
      label: 'New RO Capture',
      href: '/cases/new',
      highlight: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
    {
      label: 'My Workshop Cases',
      href: '/cases',
      badge: 'Active',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      label: 'Brand Rules Reference',
      href: '/brand-packs',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
  ];

  const navItems = isAdmin ? adminNavItems : techNavItems;

  return (
    <aside className="w-64 bg-[#0B0F17] border-r border-slate-800/80 flex flex-col justify-between shrink-0 min-h-screen sticky top-0 z-40 shadow-[4px_0_24px_rgba(0,0,0,0.35)] transition-all">
      <div>
        {/* Brand Logo Header */}
        <div className="p-4 border-b border-slate-800/80 bg-gradient-to-b from-[#0F1624] to-[#0B0F17]">
          <Link href={isAdmin ? "/dashboard" : "/cases"} className="block group">
            <div className="flex items-center justify-between gap-2">
              <img
                src="/booran-motors-official.png"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/booran-logo.png';
                }}
                alt="Booran Motors"
                className="h-8 max-w-[155px] object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] group-hover:opacity-95 transition-opacity"
              />
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-red-950/70 text-red-400 border border-red-800/60 font-bold shrink-0">
                {isAdmin ? 'ADMIN' : 'TECH'}
              </span>
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono tracking-wider">
              <span className="text-slate-400 font-medium">WARRANTY EVIDENCE</span>
              <span className="text-[#E11F26] font-extrabold tracking-widest">PORTAL</span>
            </div>
          </Link>
        </div>

        {/* Franchises Roster Pill (Matches website hero sub-bar) */}
        <div className="mx-3 mt-3.5 mb-1 px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)] animate-pulse" />
            <span className="text-[11px] font-medium text-slate-300">VIC Multi-Franchise</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 uppercase">5 Sites</span>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  item.highlight
                    ? isActive
                      ? 'bg-[#E11F26] text-white shadow-lg shadow-red-950/60 font-bold'
                      : 'bg-red-950/40 text-red-400 border border-red-800/60 hover:bg-[#E11F26] hover:text-white font-bold'
                    : isActive
                    ? 'bg-[#E11F26] text-white font-bold shadow-lg shadow-red-950/50'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
                    {item.icon}
                  </span>
                  <span className={`transition-colors ${isActive ? 'text-white font-bold' : 'text-slate-300 group-hover:text-white'}`}>
                    {item.label}
                  </span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full transition-colors ${
                      isActive
                        ? 'bg-white text-[#E11F26]'
                        : 'bg-red-950/80 text-red-300 border border-red-800/60'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Footer Profile & Logout */}
      <div className="p-3.5 border-t border-slate-800/80 bg-[#070A10]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#E11F26] text-white flex items-center justify-center text-xs font-black shadow-md shadow-red-950/60 shrink-0">
              {userName ? userName.split(' ').map((n) => n[0]).join('') : 'U'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">{userName}</div>
              <div className="text-[10px] text-slate-400 truncate font-mono">{userEmail}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title="Log Out (Clear Session)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
