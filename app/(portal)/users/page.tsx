'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '../../../components/header';
import { Pagination } from '../../../components/pagination';
import { api } from '../../../lib/api';
import { Site, UserProfile, UserRole } from '../../../lib/types';

export default function UsersPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Guard against Technician accessing users page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('booran_user') || localStorage.getItem('booran_user_profile');
      if (userStr) {
        try {
          const parsed = JSON.parse(userStr);
          if (parsed.role === 'TECHNICIAN') {
            router.replace('/cases');
            return;
          }
        } catch {}
      }
      setAuthorized(true);
    }
  }, [router]);

  // Add User Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: 'Booran2026!',
    role: 'ADMIN' as UserRole,
    siteId: 'site_cranbourne_byd',
  });

  // Delete User Modal State
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    try {
      const [usersData, sitesData] = await Promise.all([
        api.getUsers(),
        api.getSites().catch(() => []),
      ]);
      setUsers(usersData);
      if (sitesData && sitesData.length > 0) {
        setSites(sitesData);
        setFormData((prev) => ({
          ...prev,
          siteId: prev.siteId || sitesData[0].id,
        }));
      }
    } catch (err) {
      console.error('Failed to load user directory data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authorized) {
      loadData();
    }
  }, [authorized]);

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

  // Reset to page 1 on filter or search change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, roleFilter]);

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredUsers.slice(start, start + limit);
  }, [filteredUsers, page, limit]);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: users.length };
    users.forEach((u) => {
      counts[u.role] = (counts[u.role] || 0) + 1;
    });
    return counts;
  }, [users]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!formData.name.trim()) {
      setFormError('Please enter full name.');
      return;
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setFormError('Please enter a valid work email address.');
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      setFormError('Password must be at least 6 characters.');
      return;
    }

    setFormSubmitting(true);
    try {
      const newUser = await api.createUser({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password.trim(),
        role: formData.role,
        siteId: formData.siteId,
      });

      setFormSuccess(`User account for ${newUser.name} created successfully!`);
      setUsers((prev) => [newUser, ...prev]);

      // Reset form
      setFormData({
        name: '',
        email: '',
        password: 'Booran2026!',
        role: 'ADMIN',
        siteId: sites.length > 0 ? sites[0].id : 'site_cranbourne_byd',
      });

      setTimeout(() => {
        setShowAddModal(false);
        setFormSuccess(null);
      }, 900);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create user account. Please try again.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await api.deleteUser(deleteTarget.id);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setNotificationMsg({
        type: 'success',
        text: `User account for ${deleteTarget.name} was successfully deleted.`,
      });
      setDeleteTarget(null);

      setTimeout(() => {
        setNotificationMsg(null);
      }, 3500);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete user. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="User Access & Role Management"
        subtitle="Group Admin, Warranty Clerks, Service Managers, and Workshop Technicians"
      />

      <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Notification Toast */}
        {notificationMsg && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 ${
              notificationMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {notificationMsg.type === 'success' ? (
                <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span>{notificationMsg.text}</span>
            </div>
            <button
              onClick={() => setNotificationMsg(null)}
              className="text-slate-400 hover:text-slate-600 text-sm px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Search, Filter & Action Bar */}
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

          {/* Role Filter Pills & Add User Button */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'ALL', label: 'All Roles' },
                { id: 'ADMIN', label: 'Warranty Admins' },
                { id: 'TECHNICIAN', label: 'Workshop Techs' },
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

            {/* Add User Button */}
            <button
              onClick={() => {
                setShowAddModal(true);
                setFormError(null);
                setFormSuccess(null);
              }}
              className="px-4 py-2 bg-[#E11F26] hover:bg-[#c9181e] text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              <span>Add User</span>
            </button>
          </div>
        </div>

        {/* Results Info Bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            Showing <strong className="text-slate-900 font-bold">{Math.min(page * limit, filteredUsers.length)}</strong> of{' '}
            <strong className="text-slate-900 font-bold">{filteredUsers.length}</strong> users
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
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Loading user access directory...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
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
                paginatedUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                            u.role === 'ADMIN'
                              ? 'bg-red-50 text-[#E11F26] border border-red-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {u.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <span className="font-bold text-slate-900">{u.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-mono">{u.email}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full border font-semibold text-[11px] inline-flex items-center gap-1.5 ${
                          u.role === 'ADMIN'
                            ? 'bg-red-50 text-[#E11F26] border-red-200'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            u.role === 'ADMIN' ? 'bg-[#E11F26]' : 'bg-slate-400'
                          }`}
                        />
                        {u.role === 'ADMIN' ? 'Warranty Admin' : 'Workshop Tech'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono">
                      {sites.find((s) => s.id === u.defaultSiteId)?.name || u.defaultSiteId || 'Standard Site'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
                        Active
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {u.id === 'usr_admin_1' || u.email === 'admin@booran.com.au' ? (
                        <span className="text-[10px] text-slate-400 font-semibold px-2 py-0.5 bg-slate-100 border border-slate-200 rounded">
                          Root Admin
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTarget(u);
                            setDeleteError(null);
                          }}
                          className="px-2.5 py-1 text-slate-500 hover:text-[#E11F26] hover:bg-red-50 border border-transparent hover:border-red-200 rounded-lg text-xs font-semibold transition-all cursor-pointer inline-flex items-center gap-1"
                          title={`Delete account for ${u.name}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                          <span>Delete</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!loading && filteredUsers.length > 0 && (
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(filteredUsers.length / limit) || 1}
              totalItems={filteredUsers.length}
              itemsPerPage={limit}
              isLoading={loading}
              onPageChange={setPage}
              onItemsPerPageChange={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
            />
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h2 className="text-lg font-black text-slate-900">Provision New User Account</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Create an Admin or Workshop Technician with instant portal & mobile access.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Error / Success Feedback */}
            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0 text-[#E11F26]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>{formSuccess}</span>
              </div>
            )}

            {/* Creation Form */}
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-[#E11F26]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field text-xs w-full"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Work Email Address <span className="text-[#E11F26]">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. sarah.j@booran.com.au"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-field text-xs w-full font-mono"
                />
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Assigned Workspace Role <span className="text-[#E11F26]">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'ADMIN' })}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      formData.role === 'ADMIN'
                        ? 'border-[#E11F26] bg-red-50/50 ring-1 ring-[#E11F26]'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          formData.role === 'ADMIN' ? 'bg-[#E11F26]' : 'bg-slate-300'
                        }`}
                      />
                      <span className="font-bold text-xs text-slate-900">Warranty Admin</span>
                    </div>
                    <p className="text-[11px] text-slate-500">Full audit, packs, sites & user access</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, role: 'TECHNICIAN' })}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      formData.role === 'TECHNICIAN'
                        ? 'border-[#E11F26] bg-red-50/50 ring-1 ring-[#E11F26]'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          formData.role === 'TECHNICIAN' ? 'bg-[#E11F26]' : 'bg-slate-300'
                        }`}
                      />
                      <span className="font-bold text-xs text-slate-900">Workshop Tech</span>
                    </div>
                    <p className="text-[11px] text-slate-500">Evidence camera & repair capture</p>
                  </button>
                </div>
              </div>

              {/* Dealership Site */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Dealership Rooftop
                </label>
                <select
                  value={formData.siteId}
                  onChange={(e) => setFormData({ ...formData, siteId: e.target.value })}
                  className="input-field text-xs w-full bg-white"
                >
                  {sites.length > 0 ? (
                    sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name} ({site.location || site.id})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="site_cranbourne_byd">Booran Cranbourne (BYD)</option>
                      <option value="site_dandenong_multi">Booran Dandenong Multi-Franchise</option>
                      <option value="site_cheltenham_mg">Booran Cheltenham (MG)</option>
                      <option value="site_berwick_toyota_ford">Booran Berwick (Toyota / Ford)</option>
                    </>
                  )}
                </select>
              </div>

              {/* Initial Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Initial Password <span className="text-[#E11F26]">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400">User can reset later via OTP</span>
                </div>
                <input
                  type="text"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="input-field text-xs w-full font-mono"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2.5 bg-[#E11F26] hover:bg-[#c9181e] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                >
                  {formSubmitting ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <span>Create User Account</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Icon & Header */}
            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-red-50 text-[#E11F26] border border-red-200 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete User Account</h3>
                <p className="text-xs text-slate-500">Revoke portal access & permanently delete</p>
              </div>
            </div>

            {/* Warning Details */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 mb-5 space-y-2">
              <p className="text-xs text-slate-700 leading-relaxed">
                Are you sure you want to delete the user account for{' '}
                <strong className="text-slate-900 font-bold">{deleteTarget.name}</strong>?
              </p>
              <div className="text-[11px] font-mono text-slate-500 bg-white p-2 rounded-lg border border-slate-200">
                Email: {deleteTarget.email}
                <br />
                Role: {deleteTarget.role}
              </div>
              <p className="text-[11px] text-red-600 font-medium pt-1">
                ⚠️ This will immediately revoke their ability to sign in to the portal and mobile app.
              </p>
            </div>

            {deleteError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                {deleteError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 bg-[#E11F26] hover:bg-[#c9181e] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Yes, Delete User</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
