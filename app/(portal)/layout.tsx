'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../../components/sidebar';
import { ToastProvider } from '../../components/toast';
import { UserProfile } from '../../lib/types';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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

      try {
        const parsed = JSON.parse(userStr);
        setUser(parsed);
      } catch (err) {
        router.replace('/login');
        return;
      }

      setLoading(false);
    }
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#081225] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#00f0ff]/20 border-t-[#00f0ff] rounded-full animate-spin shadow-[0_0_15px_rgba(0,240,255,0.4)]" />
          <span className="text-xs text-[#00f0ff] font-semibold tracking-wider uppercase">Verifying Authorization...</span>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-[#081225] text-[#cbd5e1]">
        <Sidebar
          userRole={user?.role}
          userName={user?.name}
          userEmail={user?.email}
        />
        <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
