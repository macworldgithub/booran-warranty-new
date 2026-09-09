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
    <aside className="w-64 bg-[#0d1b3e]/90 backdrop-blur-xl border-r border-[#1a56db]/20 flex flex-col justify-between shrink-0 min-h-screen sticky top-0 z-40 transition-all">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-[#1a56db]/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#1a56db] to-[#00f0ff] flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.4)]">
              <span className="font-extrabold text-white text-lg tracking-wider">B</span>
            </div>
            <div>
              <div className="font-bold text-white text-sm tracking-wide flex items-center gap-1.5">
                BOORAN
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#1a56db]/30 text-[#00f0ff] border border-[#00f0ff]/30">
                  {isAdmin ? 'ADMIN' : 'TECH'}
                </span>
              </div>
              <div className="text-[11px] text-gray-400">Warranty Evidence CRM</div>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  item.highlight
                    ? isActive
                      ? 'bg-gradient-to-r from-[#1a56db] to-[#00f0ff] text-white shadow-[0_0_20px_rgba(0,240,255,0.4)]'
                      : 'bg-[#1a56db]/20 text-[#00f0ff] border border-[#00f0ff]/30 hover:bg-[#1a56db]/30'
                    : isActive
                    ? 'bg-[#1a56db]/20 text-white border-l-4 border-[#00f0ff] shadow-inner'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-[#00f0ff]' : 'text-gray-400'}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-[#1a56db]/30 text-[#00f0ff] border border-[#1a56db]/50">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Footer Profile & Logout */}
      <div className="p-4 border-t border-[#1a56db]/20 bg-[#081225]/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#1a56db]/40 border border-[#00f0ff]/40 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {userName ? userName.split(' ').map((n) => n[0]).join('') : 'U'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">{userName}</div>
              <div className="text-[10px] text-gray-400 truncate">{userEmail}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="p-1.5 text-gray-400 hover:text-red-400 rounded hover:bg-red-500/10 transition-colors"
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
