'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '../../../components/header';
import { api } from '../../../lib/api';
import { UserProfile } from '../../../lib/types';

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getUsers();
        setUsers(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase().trim();
      const matchName = u.name?.toLowerCase().includes(q);
      const matchEmail = u.email?.toLowerCase().includes(q);
      const matchRole = u.role?.toLowerCase().replace(/_/g, ' ').includes(q);
      const matchSite = u.defaultSiteId?.toLowerCase().includes(q);

      return matchName || matchEmail || matchRole || matchSite;
    });
  }, [users, searchQuery, roleFilter]);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: users.length };
    users.forEach((u) => {
      counts[u.role] = (counts[u.role] || 0) + 1;
    });
    return counts;
  }, [users]);

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="User Access & Role Management"
        subtitle="Group Admin, Warranty Clerks, Service Managers, and Workshop Technicians"
      />

      <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Search & Filter Bar */}
        <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[280px]">
            <input
              type="text"
              placeholder="Search by name, email, role, or site ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-9 pr-8 text-xs w-full"
            />
            <svg
              className="w-4 h-4 absolute left-3 top-3 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 text-sm"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Role Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'ALL', label: 'All Roles' },
              { id: 'WARRANTY_CLERK', label: 'Clerks' },
              { id: 'TECHNICIAN', label: 'Techs' },
              { id: 'SERVICE_MANAGER', label: 'Managers' },
              { id: 'GROUP_ADMIN', label: 'Admins' },
            ].map((rf) => {
              const count = roleCounts[rf.id] || 0;
              const isSelected = roleFilter === rf.id;
              return (
                <button
                  key={rf.id}
                  onClick={() => setRoleFilter(rf.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-[#E11F26] text-white shadow-xs font-bold'
                      : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-300'
                  }`}
                >
                  <span>{rf.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Results Info Bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            Showing <strong className="text-slate-900">{filteredUsers.length}</strong> of{' '}
            <strong className="text-slate-900">{users.length}</strong> users
          </span>
          {(searchQuery || roleFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setRoleFilter('ALL');
              }}
              className="text-[#E11F26] hover:underline font-semibold"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Table Container */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Default Site</th>
                <th className="py-3.5 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    Loading user access directory...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="max-w-xs mx-auto space-y-2">
                      <div className="w-10 h-10 rounded-full bg-red-50 text-[#E11F26] border border-red-200 flex items-center justify-center mx-auto">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">No users matched your search</p>
                      <p className="text-xs text-slate-500">
                        Try adjusting your keywords or clearing the role filter.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{u.name}</td>
                    <td className="py-3.5 px-4 text-slate-700 font-mono">{u.email}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded border border-slate-300 text-slate-800 bg-white font-mono font-medium text-[11px]">
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono">{u.defaultSiteId}</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                        Active
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
