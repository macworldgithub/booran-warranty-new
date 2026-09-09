'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('booran_user') || localStorage.getItem('booran_user_profile');
      const token = localStorage.getItem('booran_jwt') || localStorage.getItem('booran_auth_token');

      if (userStr && token) {
        try {
          const user = JSON.parse(userStr);
          router.replace(user.role === 'TECHNICIAN' ? '/cases/new' : '/dashboard');
          return;
        } catch {
          // fall through
        }
      }
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#081225] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#00f0ff]/30 border-t-[#00f0ff] rounded-full animate-spin" />
    </div>
  );
}
