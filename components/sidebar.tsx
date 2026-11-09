'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  Layers,
  Building2,
  ArrowUpDown,
  Car,
  Users,
  KeyRound,
  MapPin,
  FileWarning,
  Mail,
  Archive,
  PlusCircle,
  LogOut,
  X,
  ShieldAlert,
} from 'lucide-react';
import { UserRole } from '@/lib/types';
import { canReadHistoricalArchive } from '@/lib/historical-archive';
import { ALL_ASSIGNED_SITES, useClerkSite } from './clerk-site-context';

interface SidebarProps {
  userRole?: UserRole;
  userName?: string;
  userEmail?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  highlight?: boolean;
}

export function Sidebar({
  userRole = 'TECHNICIAN',
  userName = 'Marcus Vance',
  userEmail = 'admin@booran.com.au',
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const role = String(userRole || 'TECHNICIAN').toUpperCase();
  const isAdmin = role === 'ADMIN';
  const isClerk = role === 'CLERK';
  const { activeSiteId, assignedSites, setActiveSiteId } = useClerkSite();

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
      icon: LayoutDashboard,
    },
    {
      label: 'Warranty Cases',
      href: '/cases',
      badge: 'Live',
      icon: FileText,
    },
    {
      label: 'Brand Packs & Rules',
      href: '/brand-packs',
      icon: Layers,
    },
    {
      label: 'Dealership Sites',
      href: '/sites',
      icon: Building2,
    },
    {
      label: 'Hoist Inspections',
      href: '/hoists',
      badge: 'Daily',
      icon: ArrowUpDown,
    },
    {
      label: 'OEM Brands',
      href: '/brands',
      icon: Car,
    },
    {
      label: 'User Access',
      href: '/users',
      icon: Users,
    },
    {
      label: 'Loan Operations',
      href: '/loaners',
      badge: 'Active',
      icon: KeyRound,
    },
    {
      label: 'Test Drives & Geofence',
      href: '/test-drives',
      badge: 'Live',
      icon: MapPin,
    },
    {
      label: 'Warranty Bulletins',
      href: '/warranty-bulletins',
      icon: FileWarning,
    },
  ];

  const techNavItems: NavItem[] = [
    {
      label: 'New RO Capture',
      href: '/cases/new',
      highlight: true,
      icon: PlusCircle,
    },
    {
      label: 'My Workshop Cases',
      href: '/cases',
      badge: 'Active',
      icon: FileText,
    },
    {
      label: 'Brand Rules Reference',
      href: '/brand-packs',
      icon: Layers,
    },
    {
      label: 'Hoist Inspections',
      href: '/hoists',
      badge: 'Daily',
      icon: ArrowUpDown,
    },
  ];

  const clerkNavItems = adminNavItems.filter((item) =>
    ['/dashboard', '/cases', '/hoists', '/loaners', '/test-drives'].includes(item.href)
  );

  if (isAdmin) {
    adminNavItems.push({
      label: 'Technician Invitations',
      href: '/invitations',
      icon: Mail,
    });
  }

  const navItems = isAdmin ? adminNavItems : isClerk ? clerkNavItems : techNavItems;

  if (canReadHistoricalArchive(role, userEmail)) {
    navItems.push({
      label: 'Booran Motors Archive',
      href: '/historical-archive',
      icon: Archive,
    });
  }

  const homeHref = isAdmin || isClerk ? '/dashboard' : '/cases';
  const roleLabel = isAdmin ? 'ADMIN' : isClerk ? 'CLERK' : 'TECH';

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full min-h-screen">
      <div className="flex-1 overflow-y-auto">
        {/* Brand Logo Header */}
        <div className="p-4 border-b border-slate-800/80 bg-gradient-to-b from-[#0F1624] to-[#0B0F17]">
          <div className="flex items-center justify-between">
            <Link
              href={homeHref}
              onClick={() => onMobileClose?.()}
              className="block group flex-1"
            >
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
                  {roleLabel}
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono tracking-wider">
                <span className="text-slate-400 font-medium">WARRANTY EVIDENCE</span>
                <span className="text-[#E11F26] font-extrabold tracking-widest">PORTAL</span>
              </div>
            </Link>

            {/* Close button for mobile drawer */}
            {onMobileClose && (
              <button
                type="button"
                onClick={onMobileClose}
                className="lg:hidden ml-2 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Franchises Roster Pill */}
        <div className="mx-3 mt-3.5 mb-1 px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)] animate-pulse" />
            <span className="text-[11px] font-medium text-slate-300">VIC Multi-Franchise</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400 uppercase">5 Sites</span>
        </div>

        {isClerk && assignedSites.length > 0 && (
          <div className="mx-3 mt-3 rounded-xl border border-slate-700 bg-slate-900 p-3">
            <label
              htmlFor="clerk-active-rooftop"
              className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-400"
            >
              Active rooftop
            </label>
            <select
              id="clerk-active-rooftop"
              value={activeSiteId}
              onChange={(event) => setActiveSiteId(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#0B0F17] px-2.5 py-2 text-xs font-semibold text-white outline-none focus:border-[#E11F26]"
              aria-label="Switch active rooftop"
            >
              {assignedSites.length > 1 && <option value={ALL_ASSIGNED_SITES}>All Assigned Rooftops</option>}
              {assignedSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && item.href !== '/cases' && pathname.startsWith(`${item.href}/`));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onMobileClose?.()}
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
                  <Icon
                    className={`w-5 h-5 transition-colors shrink-0 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                    }`}
                  />
                  <span
                    className={`transition-colors truncate ${
                      isActive ? 'text-white font-bold' : 'text-slate-300 group-hover:text-white'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full transition-colors shrink-0 ${
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
      <div className="p-3.5 border-t border-slate-800/80 bg-[#070A10] shrink-0 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#E11F26] text-white flex items-center justify-center text-xs font-black shadow-md shadow-red-950/60 shrink-0">
              {userName
                ? userName
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()
                : 'U'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">{userName}</div>
              <div className="text-[10px] text-slate-400 truncate font-mono">{userEmail}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="Log Out (Clear Session)"
            aria-label="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 bg-[#0B0F17] border-r border-slate-800/80 flex-col shrink-0 min-h-screen sticky top-0 z-40 shadow-[4px_0_24px_rgba(0,0,0,0.35)]">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (Overlay and Sliding Panel) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-fadeIn"
            onClick={onMobileClose}
            aria-hidden="true"
          />

          {/* Drawer content */}
          <div className="relative w-72 max-w-[85vw] bg-[#0B0F17] border-r border-slate-800 flex flex-col h-full shadow-2xl z-10 animate-slideInLeft">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
