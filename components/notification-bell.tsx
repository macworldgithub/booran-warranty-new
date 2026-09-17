'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { WarrantyCase } from '../lib/types';

interface NotificationItem {
  id: string;
  type: 'FLAG' | 'NEW_CASE' | 'SUBMITTED';
  title: string;
  description: string;
  badgeText: string;
  badgeColor: string;
  timeAgo: string;
  caseId: string;
  roNumber: string;
  isUnread: boolean;
  link: string;
}

export function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('booran_read_notification_ids');
        if (saved) {
          return new Set(JSON.parse(saved));
        }
      } catch {
        // ignore
      }
    }
    return new Set();
  });
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateReadIds = (newSet: Set<string>) => {
    setReadIds(newSet);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'booran_read_notification_ids',
          JSON.stringify(Array.from(newSet))
        );
      } catch {
        // ignore
      }
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Load notifications from recent cases
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.getWarrantyCases({ limit: 15 });
      const caseList: WarrantyCase[] = res.data || [];

      const notifs: NotificationItem[] = [];

      caseList.forEach((c) => {
        const activeFlags = (c.flagHistory || c.flags || []).filter((f: any) => !f.resolvedAt);

        // 1. Flagged cases
        if (activeFlags.length > 0 || c.status === 'Flagged') {
          const firstFlag = activeFlags[0];
          const reason = firstFlag?.reasonCode ? firstFlag.reasonCode.replace(/_/g, ' ') : 'Quality Gate Warning';
          notifs.push({
            id: `flag_${c.id}`,
            type: 'FLAG',
            title: `Evidence Flagged · RO #${c.roNumber}`,
            description: firstFlag?.instruction || `Rejected: ${reason}. Technician recapture required.`,
            badgeText: 'ACTION REQUIRED',
            badgeColor: 'bg-red-50 text-red-600 border-red-200',
            timeAgo: getTimeAgo(c.updatedAt || c.createdAt),
            caseId: c.id,
            roNumber: c.roNumber,
            isUnread: !readIds.has(`flag_${c.id}`),
            link: `/cases/${c.id}?retake=true`,
          });
        }

        // 2. Awaiting Review cases
        if (c.status === 'Awaiting Review') {
          notifs.push({
            id: `awaiting_${c.id}`,
            type: 'NEW_CASE',
            title: `New Pack Submitted · RO #${c.roNumber}`,
            description: `${c.make || 'BYD'} ${c.model || 'Vehicle'} from ${c.siteName || 'Cranbourne'} awaiting audit verification.`,
            badgeText: 'AWAITING AUDIT',
            badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
            timeAgo: getTimeAgo(c.updatedAt || c.createdAt),
            caseId: c.id,
            roNumber: c.roNumber,
            isUnread: !readIds.has(`awaiting_${c.id}`),
            link: `/cases/${c.id}`,
          });
        }

        // 3. Submitted cases
        if (c.status === 'Submitted') {
          notifs.push({
            id: `submitted_${c.id}`,
            type: 'SUBMITTED',
            title: `Claim Approved · RO #${c.roNumber}`,
            description: `Claim #${c.claimNumber || 'PENDING'} recorded. OEM submission ZIP ready.`,
            badgeText: 'SUBMITTED',
            badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            timeAgo: getTimeAgo(c.updatedAt || c.createdAt),
            caseId: c.id,
            roNumber: c.roNumber,
            isUnread: !readIds.has(`submitted_${c.id}`),
            link: `/cases/${c.id}`,
          });
        }
      });

      setNotifications(notifs.slice(0, 8));
    } catch (err) {
      console.warn('[NotificationBell] Could not load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const markAllAsRead = () => {
    const all = new Set<string>(readIds);
    notifications.forEach((n) => all.add(n.id));
    updateReadIds(all);
  };

  const handleNotificationClick = (item: NotificationItem) => {
    const updated = new Set(readIds);
    updated.add(item.id);
    updateReadIds(updated);
    setIsOpen(false);
    router.push(item.link);
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="View notifications"
        className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
      >
        <svg
          className="w-5 h-5 text-slate-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread Counter Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-[#E11F26] text-[10px] font-black text-white shadow-sm ring-2 ring-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 border border-slate-200 z-50 overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-slate-900">Warranty Alerts</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-[#E11F26] text-[10px] font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {loading && notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Checking for alerts...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center px-4 space-y-1">
                <p className="text-xs font-bold text-slate-700">No active alerts</p>
                <p className="text-[11px] text-slate-400">
                  All workshop evidence packs are up to date and verified.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const isUnread = !readIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-start gap-3 ${
                      isUnread ? 'bg-red-50/20' : ''
                    }`}
                  >
                    {/* Status Dot / Icon */}
                    <div className="shrink-0 mt-0.5">
                      {item.type === 'FLAG' ? (
                        <div className="w-7 h-7 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center text-[#E11F26] text-xs font-bold">
                          ⚠️
                        </div>
                      ) : item.type === 'NEW_CASE' ? (
                        <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 text-xs font-bold">
                          📥
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 text-xs font-bold">
                          ✓
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${item.badgeColor}`}>
                          {item.badgeText}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {item.timeAgo}
                        </span>
                      </div>

                      <p className="text-xs font-bold text-slate-900 truncate">
                        {item.title}
                      </p>

                      <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-snug">
                        {item.description}
                      </p>
                    </div>

                    {/* Unread marker */}
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-[#E11F26] shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <Link
              href="/cases"
              onClick={() => setIsOpen(false)}
              className="text-[#E11F26] hover:text-[#c81a20] font-bold text-[11px] flex items-center gap-1 transition-colors"
            >
              <span>View Review Inbox</span>
              <span>→</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                const testNotif: NotificationItem = {
                  id: `test_${Date.now()}`,
                  type: 'FLAG',
                  title: `Test Alert · RO #CR-${Math.floor(10000 + Math.random() * 90000)}`,
                  description: 'Sample quality gate warning: VIN glare detected. Recapture required.',
                  badgeText: 'TEST ALERT',
                  badgeColor: 'bg-red-50 text-red-600 border-red-200',
                  timeAgo: 'Just now',
                  caseId: 'CASE-CR22222-4933',
                  roNumber: 'CR-TEST',
                  isUnread: true,
                  link: '/cases/CASE-CR22222-4933',
                };
                setNotifications((prev) => [testNotif, ...prev]);
              }}
              className="px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold cursor-pointer transition-colors"
              title="Add simulated alert to test bell counter"
            >
              + Test Alert
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getTimeAgo(dateString?: string): string {
  if (!dateString) return 'Just now';
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    return `${diffDays}d ago`;
  } catch {
    return 'Recently';
  }
}
