'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Header } from '../../../components/header';
import { Pagination } from '../../../components/pagination';
import { useToast } from '../../../components/toast';
import { api } from '../../../lib/api';
import { Site, Brand } from '../../../lib/types';

/* ─── helpers ─── */
function brandLabel(id: string, allBrands: Brand[]) {
  const found = allBrands.find((b) => b.id === id);
  if (found) return found.name;
  return id.replace(/^brand_/, '').toUpperCase();
}

/* ─── Modal ─── */
interface SiteModalProps {
  allBrands: Brand[];
  site: Site | null;
  onClose: () => void;
  onSaved: (s: Site) => void;
}

function SiteModal({ allBrands, site, onClose, onSaved }: SiteModalProps) {
  const isEdit = !!site;
  const [name, setName] = useState(site?.name ?? '');
  const [location, setLocation] = useState(site?.location ?? '');
  const [roPrefix, setRoPrefix] = useState(site?.roPrefix ?? '');
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>(site?.authorizedBrandIds ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleBrand = useCallback((brandId: string) => {
    setSelectedBrandIds((prev) =>
      prev.includes(brandId) ? prev.filter((b) => b !== brandId) : [...prev, brandId],
    );
  }, []);

  const handleSave = async () => {
    if (!name.trim() || !location.trim() || !roPrefix.trim()) {
      setError('Rooftop name, address/location, and RO prefix are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let saved: Site;
      if (isEdit && site) {
        saved = await api.updateSite(site.id, { name, location, roPrefix });
        saved = await api.updateSiteBrands(site.id, selectedBrandIds);
      } else {
        saved = await api.createSite({ name, location, roPrefix, authorizedBrandIds: selectedBrandIds });
      }
      onSaved(saved);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              {isEdit ? 'Edit Dealership Rooftop' : 'New Dealership Rooftop'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit
                ? 'Update location details and authorized OEM franchise links.'
                : 'Register a new Booran dealership site and link franchised brands.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-4 text-sm text-slate-700">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Site / Rooftop Name <span className="text-[#E11F26]">*</span>
            </label>
            <input
              className="input-field w-full text-xs"
              placeholder="e.g. Booran BYD Cranbourne"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Location / Street Address <span className="text-[#E11F26]">*</span>
            </label>
            <input
              className="input-field w-full text-xs"
              placeholder="e.g. South Gippsland Hwy, Cranbourne VIC 3977"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              RO Prefix <span className="text-[#E11F26]">*</span>
            </label>
            <input
              className="input-field w-full text-xs font-mono font-bold"
              placeholder="e.g. CR-"
              value={roPrefix}
              onChange={(e) => setRoPrefix(e.target.value.toUpperCase())}
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Prefix automatically assigned to Repair Orders created at this site (e.g. CR-90210).
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Authorized OEM Franchises
            </label>
            <p className="text-[11px] text-slate-500 mb-2.5">
              Select all OEM brands operating at this rooftop. Technicians at this site will only see checklists for selected brands.
            </p>
            <div className="flex flex-wrap gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 min-h-[52px]">
              {allBrands.length === 0 && (
                <span className="text-xs text-slate-400">No brands available — configure OEM brands first.</span>
              )}
              {allBrands.map((b) => {
                const active = selectedBrandIds.includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleBrand(b.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                      active
                        ? 'bg-red-50 border-[#E11F26] text-[#E11F26] font-bold shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                    }`}
                  >
                    {active ? (
                      <span className="w-3.5 h-3.5 rounded-full bg-[#E11F26] text-white flex items-center justify-center text-[9px] font-bold">
                        ✓
                      </span>
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300" />
                    )}
                    <span>{b.name}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
              {selectedBrandIds.length} brand{selectedBrandIds.length !== 1 ? 's' : ''} linked to this site
            </p>
          </div>

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="btn-ghost text-xs px-4 py-2 rounded-xl font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-xs px-5 py-2 rounded-xl font-bold disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Rooftop'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ─── */
export default function SitesPage() {
  const { showToast } = useToast();
  const [sites, setSites] = useState<Site[]>([]);
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(6);
  const [modalSite, setModalSite] = useState<Site | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deactivating, setDeactivating] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [s, b] = await Promise.all([api.getSites(), api.getBrands()]);
        setSites(s);
        setAllBrands(b);
      } catch (err) {
        console.error(err);
        showToast('Failed to load dealership sites or brands.', 'error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [showToast]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter]);

  const activeSites = useMemo(() => sites.filter((s) => s.isActive !== false), [sites]);
  const inactiveSites = useMemo(() => sites.filter((s) => s.isActive === false), [sites]);

  const filteredSites = useMemo(() => {
    return sites.filter((site) => {
      if (statusFilter === 'ACTIVE' && site.isActive === false) return false;
      if (statusFilter === 'INACTIVE' && site.isActive !== false) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const matchName = site.name?.toLowerCase().includes(q);
      const matchLocation = site.location?.toLowerCase().includes(q);
      const matchPrefix = site.roPrefix?.toLowerCase().includes(q);
      const matchBrand = site.authorizedBrandIds?.some((bid) => {
        const b = allBrands.find((brand) => brand.id === bid);
        return b?.name?.toLowerCase().includes(q) || bid.toLowerCase().includes(q);
      });

      return matchName || matchLocation || matchPrefix || matchBrand;
    });
  }, [sites, allBrands, searchQuery, statusFilter]);

  const paginatedSites = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredSites.slice(start, start + limit);
  }, [filteredSites, page, limit]);

  const openCreate = () => {
    setModalSite(null);
    setShowModal(true);
  };

  const openEdit = (site: Site) => {
    setModalSite(site);
    setShowModal(true);
  };

  const handleSaved = (saved: Site) => {
    setSites((prev) => {
      const idx = prev.findIndex((s) => s.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setShowModal(false);
    showToast(modalSite ? 'Rooftop updated successfully.' : 'New rooftop created successfully.', 'success');
  };

  const handleDeactivate = async (site: Site) => {
    if (!confirm(`Deactivate "${site.name}"? Technicians will no longer see this rooftop for new RO captures.`)) return;
    setDeactivating(site.id);
    try {
      await api.deactivateSite(site.id);
      setSites((prev) => prev.map((s) => (s.id === site.id ? { ...s, isActive: false } : s)));
      showToast(`${site.name} deactivated.`, 'info');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Deactivation failed', 'error');
    } finally {
      setDeactivating(null);
    }
  };

  const handleReactivate = async (site: Site) => {
    try {
      const updated = await api.updateSite(site.id, { isActive: true });
      setSites((prev) => prev.map((s) => (s.id === site.id ? updated : s)));
      showToast(`${site.name} reactivated.`, 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Reactivation failed', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Dealership Sites & Rooftops"
        subtitle="Manage Booran rooftop locations, authorized OEM franchises, and Repair Order prefix namespaces"
      />

      <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Metric KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm transition-all hover:border-slate-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Sites</span>
              <div className="w-8 h-8 rounded-lg bg-red-50 text-[#E11F26] flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{sites.length}</span>
              <span className="text-xs font-bold text-slate-500">dealership rooftops</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm transition-all hover:border-slate-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Operations</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{activeSites.length}</span>
              <span className="text-xs font-bold text-emerald-600">live across VIC</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm transition-all hover:border-slate-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">OEM Brands Linked</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                </svg>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{allBrands.length}</span>
              <span className="text-xs font-bold text-slate-500">OEM franchises</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm transition-all hover:border-slate-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inactive Rooftops</span>
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{inactiveSites.length}</span>
              <span className="text-xs font-bold text-slate-500">archived</span>
            </div>
          </div>
        </div>

        {/* Toolbar: Search, Status Filter & Actions */}
        <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[280px]">
            <input
              type="text"
              placeholder="Search by rooftop name, address, prefix (e.g. CR-, DAN-), or OEM brand..."
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
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 text-sm cursor-pointer"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
              {[
                { id: 'ALL', label: 'All' },
                { id: 'ACTIVE', label: `Active (${activeSites.length})` },
                { id: 'INACTIVE', label: `Inactive (${inactiveSites.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs font-bold border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={openCreate}
              className="btn-primary text-xs px-4 py-2 rounded-xl font-bold flex items-center gap-2 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>New Site</span>
            </button>
          </div>
        </div>

        {/* Results Counter */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            Showing <strong className="text-slate-900 font-bold">{Math.min(page * limit, filteredSites.length)}</strong> of{' '}
            <strong className="text-slate-900 font-bold">{filteredSites.length}</strong> dealership rooftops
          </span>
          {(searchQuery || statusFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
              }}
              className="text-[#E11F26] hover:underline font-semibold cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Sites Grid */}
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-500 bg-white border border-slate-200 rounded-2xl">
            <div className="w-8 h-8 border-2 border-[#E11F26]/20 border-t-[#E11F26] rounded-full animate-spin mx-auto mb-3" />
            <span>Loading dealership sites & rooftops...</span>
          </div>
        ) : filteredSites.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <div className="max-w-xs mx-auto space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <p className="text-sm font-bold text-slate-900">No dealership sites found</p>
              <p className="text-xs text-slate-500">
                {searchQuery
                  ? `No rooftop matched "${searchQuery}". Try a different keyword or prefix.`
                  : 'No dealership sites configured yet. Register your first rooftop location.'}
              </p>
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs font-semibold text-[#E11F26] hover:underline cursor-pointer"
                >
                  Clear search
                </button>
              ) : (
                <button
                  onClick={openCreate}
                  className="btn-primary text-xs px-4 py-2 rounded-xl font-bold cursor-pointer"
                >
                  + New Site
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {paginatedSites.map((site) => {
              const isInactive = site.isActive === false;
              return (
                <div
                  key={site.id}
                  className={`bg-white border rounded-2xl p-6 shadow-sm transition-all duration-200 flex flex-col justify-between ${
                    isInactive
                      ? 'border-slate-200 opacity-60'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  <div className="space-y-4">
                    {/* Top Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 text-[#E11F26] flex items-center justify-center shrink-0">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-slate-900 truncate tracking-tight">
                            {site.name}
                          </h3>
                          <p className="text-xs text-slate-500 truncate mt-0.5">{site.location}</p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          isInactive
                            ? 'bg-slate-100 text-slate-500 border border-slate-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isInactive ? 'bg-slate-400' : 'bg-emerald-500'}`} />
                        {isInactive ? 'Inactive' : 'Active'}
                      </span>
                    </div>

                    {/* Metadata Badges */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                          Site Code / ID
                        </span>
                        <span className="font-mono font-semibold text-slate-700">{site.id}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                          RO Prefix Namespace
                        </span>
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-[11px] inline-block border border-slate-200">
                          {site.roPrefix}
                        </span>
                      </div>
                    </div>

                    {/* Authorized Franchises */}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                          Authorized Franchises
                        </span>
                        <span className="text-slate-500 text-[10px] font-semibold">
                          {(site.authorizedBrandIds ?? []).length} Brands
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(site.authorizedBrandIds ?? []).length === 0 ? (
                          <span className="text-xs text-amber-600 italic bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                            ⚠ No OEM brands linked yet
                          </span>
                        ) : (
                          (site.authorizedBrandIds ?? []).map((bid) => (
                            <span
                              key={bid}
                              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 font-semibold text-xs shadow-2xs"
                            >
                              {brandLabel(bid, allBrands)}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 pt-5 mt-5 border-t border-slate-100">
                    <button
                      onClick={() => openEdit(site)}
                      className="flex-1 btn-ghost text-xs py-2 rounded-xl font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Edit & Brands</span>
                    </button>

                    {isInactive ? (
                      <button
                        onClick={() => handleReactivate(site)}
                        className="flex-1 text-xs py-2 rounded-xl font-semibold border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Reactivate</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDeactivate(site)}
                        disabled={deactivating === site.id}
                        className="flex-1 text-xs py-2 rounded-xl font-semibold border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {deactivating === site.id ? 'Deactivating...' : 'Deactivate'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && filteredSites.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <Pagination
              currentPage={page}
              totalPages={Math.ceil(filteredSites.length / limit) || 1}
              totalItems={filteredSites.length}
              itemsPerPage={limit}
              itemsPerPageOptions={[6, 12, 24, 48]}
              isLoading={loading}
              onPageChange={setPage}
              onItemsPerPageChange={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>

      {showModal && (
        <SiteModal
          allBrands={allBrands.filter((b) => b.isActive !== false)}
          site={modalSite}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
