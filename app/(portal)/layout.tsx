'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '../../components/sidebar';
import { ToastProvider } from '../../components/toast';
import { UserProfile } from '../../lib/types';
import { clearStoredSession } from '../../lib/api';
import { ClerkSiteProvider } from '../../components/clerk-site-context';
import { canReadHistoricalArchive } from '../../lib/historical-archive';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('booran_user') || localStorage.getItem('booran_user_profile');
      const token = localStorage.getItem('booran_jwt') || localStorage.getItem('booran_auth_token');

      if (!userStr || !token) {
        router.replace('/login');
        return;
      }

      if (!token.startsWith('session_v1.')) {
        clearStoredSession();
        router.replace('/login');
        return;
      }

      try {
        const parsed = JSON.parse(userStr);
        const role = String(parsed.role || '').toUpperCase();
        if (role === 'CLERK') {
          const allowedPrefixes = ['/dashboard', '/cases', '/loaners', '/test-drives', '/hoists'];
          if (canReadHistoricalArchive(role, parsed.email || '')) allowedPrefixes.push('/historical-archive');
          if (!allowedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
            router.replace('/dashboard');
            return;
          }
        }
        if (role === 'TECHNICIAN') {
          const allowedPrefixes = ['/cases', '/brand-packs', '/hoists'];
          if (!allowedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
            router.replace('/cases');
            return;
          }
        }
        setUser(parsed);
      } catch (err) {
        router.replace('/login');
        return;
      }

      setLoading(false);
    }
  }, [pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#E11F26]/20 border-t-[#E11F26] rounded-full animate-spin" />
          <span className="text-xs text-slate-700 font-bold tracking-wider uppercase">Verifying Authorization...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <ToastProvider>
      <ClerkSiteProvider user={user}>
        <div className="flex min-h-screen bg-[#f8fafc] text-slate-900">
          <Sidebar
            userRole={user.role}
            userName={user.name}
            userEmail={user.email}
          />
          <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
            {children}
          </main>
        </div>
      </ClerkSiteProvider>
    </ToastProvider>
  );
}
