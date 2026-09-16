'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Header } from '../../../components/header';
import { useToast } from '../../../components/toast';
import { api } from '../../../lib/api';
import { Brand } from '../../../lib/types';

/* ─── Modal ─── */
interface BrandModalProps {
  brand: Brand | null;
  onClose: () => void;
  onSaved: (b: Brand) => void;
}

function BrandModal({ brand, onClose, onSaved }: BrandModalProps) {
  const isEdit = !!brand;
  const [name, setName] = useState(brand?.name ?? '');
  const [description, setDescription] = useState(brand?.description ?? '');
  const [checklistRef, setChecklistRef] = useState(brand?.seedChecklistReference ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !description.trim()) {
      setError('Brand name and description are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let saved: Brand;
      if (isEdit && brand) {
        saved = await api.updateBrand(brand.id, {
          name,
          description,
          seedChecklistReference: checklistRef || undefined,
        });
      } else {
        saved = await api.createBrand({
          name,
          description,
          seedChecklistReference: checklistRef || undefined,
        });
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
        className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              {isEdit ? 'Edit OEM Brand' : 'New OEM Brand'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit
                ? 'Update brand information and default checklist standard.'
                : 'Register a new franchised carmaker in the Booran network.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
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
              Brand Name <span className="text-[#E11F26]">*</span>
            </label>
            <input
              className="input-field w-full text-xs"
              placeholder="e.g. BYD, Hyundai, Kia, MG"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Description / Franchise Category <span className="text-[#E11F26]">*</span>
            </label>
            <input
              className="input-field w-full text-xs"
              placeholder="e.g. Build Your Dreams - EV / DM-i Super Hybrid"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Checklist / Standard Reference <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              className="input-field w-full text-xs font-mono"
              placeholder="e.g. Tier 1 Common Pack / BYD Attachment A"
              value={checklistRef}
              onChange={(e) => setChecklistRef(e.target.value)}
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Leave blank to default to Booran Group Tier 1 Common Warranty Pack.
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
            className="btn-ghost text-xs px-4 py-2 rounded-xl font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-xs px-5 py-2 rounded-xl font-bold disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Brand'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ─── */
export default function BrandsPage() {
  const { showToast } = useToast();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [modalBrand, setModalBrand] = useState<Brand | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [deactivating, setDeactivating] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getBrands();
        setBrands(data);
      } catch (err) {
        console.error(err);
        showToast('Failed to load OEM brands.', 'error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [showToast]);

  const activeBrands = useMemo(() => brands.filter((b) => b.isActive !== false), [brands]);
  const inactiveBrands = useMemo(() => brands.filter((b) => b.isActive === false), [brands]);

  const filteredBrands = useMemo(() => {
    return brands.filter((b) => {
      if (statusFilter === 'ACTIVE' && b.isActive === false) return false;
      if (statusFilter === 'INACTIVE' && b.isActive !== false) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        b.name?.toLowerCase().includes(q) ||
        b.description?.toLowerCase().includes(q) ||
        b.seedChecklistReference?.toLowerCase().includes(q)
      );
    });
  }, [brands, searchQuery, statusFilter]);

  const openCreate = () => {
    setModalBrand(null);
    setShowModal(true);
  };

  const openEdit = (b: Brand) => {
    setModalBrand(b);
    setShowModal(true);
  };

  const handleSaved = (saved: Brand) => {
    setBrands((prev) => {
      const idx = prev.findIndex((b) => b.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setShowModal(false);
    showToast(modalBrand ? 'Brand updated successfully.' : 'New OEM brand created successfully.', 'success');
  };

  const handleDeactivate = async (b: Brand) => {
    if (!confirm(`Deactivate "${b.name}"? Technicians will no longer see this brand in checklists.`)) return;
    setDeactivating(b.id);
    try {
      await api.deactivateBrand(b.id);
      setBrands((prev) => prev.map((x) => (x.id === b.id ? { ...x, isActive: false } : x)));
      showToast(`${b.name} deactivated.`, 'info');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to deactivate brand', 'error');
    } finally {
      setDeactivating(null);
    }
  };

  const handleReactivate = async (b: Brand) => {
    try {
      const updated = await api.updateBrand(b.id, { isActive: true });
      setBrands((prev) => prev.map((x) => (x.id === b.id ? updated : x)));
      showToast(`${b.name} reactivated.`, 'success');
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Failed to reactivate brand', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="OEM Vehicle Brands"
        subtitle="Manage the Booran brand roster — each brand can be linked to dealership rooftops via the Sites page"
      />

      <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm transition-all hover:border-slate-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Franchises</span>
              <div className="w-8 h-8 rounded-lg bg-red-50 text-[#E11F26] flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                </svg>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{brands.length}</span>
              <span className="text-xs font-bold text-slate-500">OEM brands registered</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm transition-all hover:border-slate-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active in Workshops</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{activeBrands.length}</span>
              <span className="text-xs font-bold text-emerald-600">active brand packs</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm transition-all hover:border-slate-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Deactivated</span>
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{inactiveBrands.length}</span>
              <span className="text-xs font-bold text-slate-500">archived brands</span>
            </div>
          </div>
        </div>

        {/* Informational Banner */}
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex gap-3.5 items-start text-xs text-amber-900 shadow-xs">
          <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="leading-relaxed">
            <strong className="font-semibold text-amber-950">Multi-Franchise Dealership Integration: </strong>
            After configuring an OEM brand here, navigate to{' '}
            <Link href="/sites" className="font-bold underline text-amber-950 hover:text-[#E11F26]">
              Dealership Sites
            </Link>{' '}
            to link it to authorized rooftop locations. Technicians will only see brand checklist standards enabled for their active dealership site.
          </div>
        </div>

        {/* Search, Filter & Actions Toolbar */}
        <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-[260px]">
            <input
              type="text"
              placeholder="Search brands by name, description, or checklist reference..."
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
                { id: 'ALL', label: 'All Brands' },
                { id: 'ACTIVE', label: `Active (${activeBrands.length})` },
                { id: 'INACTIVE', label: `Inactive (${inactiveBrands.length})` },
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
              <span>New Brand</span>
            </button>
          </div>
        </div>

        {/* Results Counter */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>
            Showing <strong className="text-slate-900">{filteredBrands.length}</strong> of{' '}
            <strong className="text-slate-900">{brands.length}</strong> OEM vehicle brands
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

        {/* Brands Grid */}
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-500 bg-white border border-slate-200 rounded-2xl">
            <div className="w-8 h-8 border-2 border-[#E11F26]/20 border-t-[#E11F26] rounded-full animate-spin mx-auto mb-3" />
            <span>Loading OEM brand roster...</span>
          </div>
        ) : filteredBrands.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <div className="max-w-xs mx-auto space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                </svg>
              </div>
              <p className="text-sm font-bold text-slate-900">No OEM brands found</p>
              <p className="text-xs text-slate-500">
                {searchQuery
                  ? `No brand matched "${searchQuery}". Try a different name or keyword.`
                  : 'No OEM brands registered yet.'}
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
                  + New Brand
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredBrands.map((b) => {
              const isInactive = b.isActive === false;
              return (
                <div
                  key={b.id}
                  className={`bg-white border rounded-2xl p-5 shadow-sm transition-all duration-200 flex flex-col justify-between ${
                    isInactive
                      ? 'border-slate-200 opacity-60'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  <div className="space-y-3.5">
                    {/* Brand Card Top */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-red-50 border border-red-100 text-[#E11F26] font-black text-sm flex items-center justify-center tracking-wider shrink-0 shadow-2xs">
                          {b.name.slice(0, 3).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900 tracking-tight">{b.name}</h3>
                            {b.id === 'brand_byd' && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                                Attachment A
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 uppercase">
                            {b.code || b.id}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          isInactive
                            ? 'bg-slate-100 text-slate-500 border-slate-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {isInactive ? 'Inactive' : 'Active'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed min-h-[32px]">
                      {b.description}
                    </p>

                    {/* Seed checklist ref */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-center justify-between">
                      <span className="text-slate-500 font-medium text-[11px]">Rule Benchmark Pack:</span>
                      <span className="font-mono font-semibold text-xs text-slate-900 truncate max-w-[170px]" title={b.seedChecklistReference || 'Tier 1 Common Pack'}>
                        {b.seedChecklistReference || 'Tier 1 Common Pack'}
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 pt-4 mt-4 border-t border-slate-100">
                    <button
                      onClick={() => openEdit(b)}
                      className="flex-1 btn-ghost text-xs py-2 rounded-xl font-semibold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Edit Brand</span>
                    </button>

                    {isInactive ? (
                      <button
                        onClick={() => handleReactivate(b)}
                        className="flex-1 text-xs py-2 rounded-xl font-semibold border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Reactivate</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDeactivate(b)}
                        disabled={deactivating === b.id}
                        className="flex-1 text-xs py-2 rounded-xl font-semibold border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {deactivating === b.id ? 'Deactivating...' : 'Deactivate'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <BrandModal brand={modalBrand} onClose={() => setShowModal(false)} onSaved={handleSaved} />
      )}
    </div>
  );
}
