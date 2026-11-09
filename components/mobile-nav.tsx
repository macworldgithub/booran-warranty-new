'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Plus,
  ArrowUpDown,
  Layers,
  Menu,
  Building2,
  KeyRound,
} from 'lucide-react';
import { UserRole } from '@/lib/types';

interface MobileNavProps {
  userRole?: UserRole;
  onOpenMenu: () => void;
}

interface MobileNavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isFab?: boolean;
}

export function MobileNav({ userRole = 'TECHNICIAN', onOpenMenu }: MobileNavProps) {
  const pathname = usePathname();
  const role = String(userRole || 'TECHNICIAN').toUpperCase();
  const isAdmin = role === 'ADMIN';
  const isClerk = role === 'CLERK';
  const isTech = role === 'TECHNICIAN';

  const techItems: MobileNavItem[] = [
    { label: 'Cases', href: '/cases', icon: FileText },
    { label: 'Rules', href: '/brand-packs', icon: Layers },
    { label: 'New RO', href: '/cases/new', icon: Plus, isFab: true },
    { label: 'Hoists', href: '/hoists', icon: ArrowUpDown },
  ];

  const adminItems: MobileNavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Cases', href: '/cases', icon: FileText },
    { label: 'Sites', href: '/sites', icon: Building2 },
    { label: 'Hoists', href: '/hoists', icon: ArrowUpDown },
  ];

  const clerkItems: MobileNavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Cases', href: '/cases', icon: FileText },
    { label: 'Loaners', href: '/loaners', icon: KeyRound },
    { label: 'Hoists', href: '/hoists', icon: ArrowUpDown },
  ];

  const items = isTech ? techItems : isClerk ? clerkItems : adminItems;

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B0F17]/95 backdrop-blur-xl border-t border-slate-800/90 shadow-[0_-8px_20px_rgba(0,0,0,0.4)] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
      <div className="flex items-center justify-around px-2 py-1.5 max-w-lg mx-auto">
        {items.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.isFab) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative -top-3.5 flex flex-col items-center group cursor-pointer"
              >
                <div className="w-13 h-13 rounded-full bg-[#E11F26] text-white flex items-center justify-center shadow-lg shadow-red-900/60 border-4 border-[#0B0F17] group-active:scale-95 transition-all">
                  <Icon className="w-6 h-6 stroke-[2.5]" />
                </div>
                <span className="text-[10px] font-bold text-white mt-0.5 tracking-tight">
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center py-1 px-1 transition-all group ${
                isActive ? 'text-[#E11F26]' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform group-active:scale-90 ${
                    isActive ? 'text-[#E11F26] stroke-[2.3]' : 'text-slate-400'
                  }`}
                />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#E11F26]" />
                )}
              </div>
              <span
                className={`text-[10px] mt-1 tracking-tight truncate max-w-[64px] ${
                  isActive ? 'font-bold text-[#E11F26]' : 'font-medium text-slate-400'
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* More / Menu Drawer Trigger */}
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex-1 flex flex-col items-center py-1 px-1 text-slate-400 hover:text-slate-200 transition-all cursor-pointer group"
          aria-label="Open Navigation Menu"
        >
          <div className="relative">
            <Menu className="w-5 h-5 text-slate-400 transition-transform group-active:scale-90" />
          </div>
          <span className="text-[10px] mt-1 font-medium text-slate-400 tracking-tight">
            More
          </span>
        </button>
      </div>
    </div>
  );
}
